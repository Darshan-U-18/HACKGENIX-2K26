const Incident = require('../models/Incident');
const Conflict = require('../models/Conflict');

exports.createIncident = async (req, res) => {
  try {
    const payload = req.body.payload || req.body;
    const operationId = req.body.operationId;
    
    const incident = new Incident(payload);
    if (operationId) {
      incident.appliedOperations.push(operationId);
      // Initialize field updates
      const now = req.body.timestamp || new Date();
      ['type', 'severity', 'description', 'peopleAffected'].forEach(f => {
        incident.fieldUpdates.set(f, now);
      });
    }
    await incident.save();
    res.status(201).json({ success: true, data: incident });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: incidents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }
    res.status(200).json({ success: true, data: incident });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateIncident = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }

    const isSync = !!req.body.operationId;
    
    if (isSync) {
      const { payload, operationId, timestamp, changedFields = [] } = req.body;
      
      // RULE 3: Duplicate operation
      if (incident.appliedOperations.includes(operationId)) {
        return res.status(200).json({ 
          success: true, 
          conflict: true, 
          resolution: 'DUPLICATE_IGNORED', 
          message: 'Operation already processed (idempotent)',
          data: incident 
        });
      }

      let isGlobalConflict = incident.updatedAt && new Date(incident.updatedAt) > new Date(timestamp);
      
      let conflictDetected = isGlobalConflict;
      let resolution = 'MERGED';
      let finalChanges = {};
      const opTime = new Date(timestamp);

      // Evaluate changed fields
      for (const field of changedFields) {
        const lastUpdated = incident.fieldUpdates.get(field);
        
        // RULE 2: Same field changed (latest wins)
        if (lastUpdated && new Date(lastUpdated) > opTime) {
          conflictDetected = true;
          resolution = 'LATEST_OPERATION_WINS';
          // We discard the incoming change for this field
        } else {
          // Incoming is newer or field never explicitly updated
          finalChanges[field] = payload[field];
          incident.fieldUpdates.set(field, opTime);
        }
      }

      // If there are valid changes, apply them (RULE 1: Merge changes)
      if (Object.keys(finalChanges).length > 0) {
        Object.assign(incident, finalChanges);
        incident.version += 1;
      } else if (changedFields.length > 0) {
        // All changes were rejected due to being older
        conflictDetected = true;
      }

      incident.appliedOperations.push(operationId);
      await incident.save();

      if (conflictDetected) {
        await Conflict.create({
          conflictId: `conf-${Date.now()}`,
          incidentId: incident._id,
          operationA: 'Server State',
          operationB: operationId,
          conflictingFields: changedFields,
          resolution: resolution,
          resolvedValue: JSON.stringify(finalChanges),
          status: 'RESOLVED',
          resolvedAt: new Date()
        });
        
        return res.status(200).json({ 
          success: true, 
          conflict: true, 
          resolution, 
          message: resolution === 'MERGED' ? 'Different field changes merged successfully' : 'Conflict detected and resolved',
          data: incident
        });
      }

      return res.status(200).json({ 
        success: true, 
        conflict: false, 
        message: 'Operation synchronized',
        data: incident
      });
      
    } else {
      // Normal direct online update
      const newVersion = (incident.version || 1) + 1;
      const updatedIncident = await Incident.findByIdAndUpdate(
        req.params.id, 
        { ...req.body, version: newVersion }, 
        { new: true, runValidators: true }
      );
      res.status(200).json({ success: true, data: updatedIncident });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getConflicts = async (req, res) => {
  try {
    const conflicts = await Conflict.find().sort({ resolvedAt: -1 });
    res.status(200).json({ success: true, data: conflicts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
