import React, { useState, useEffect } from 'react';
import { saveIncident, getAllIncidents, saveSyncOperation, getPendingSyncOperations } from '../services/dbService';
import { syncData, reconcileIncidentsWithServer } from '../services/syncService';

function FieldWorker() {
  const [incidents, setIncidents] = useState([]);
  const [formData, setFormData] = useState({
    workerId: 'worker-001',
    type: 'Flood',
    latitude: '',
    longitude: '',
    severity: 'Medium',
    description: '',
    peopleAffected: 0
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('lastSyncTime'));

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const API_URL = `${API_BASE}/incidents`;

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadIncidents();
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updatePendingCount = async () => {
    const pendingOps = await getPendingSyncOperations();
    setPendingCount(pendingOps.length);
    setLastSyncTime(localStorage.getItem('lastSyncTime'));
  };

  const loadIncidents = async () => {
    try {
      const localIncidents = await getAllIncidents();
      
      if (navigator.onLine) {
        const res = await fetch(API_URL);
        const result = await res.json();
        
        if (result.success) {
          await reconcileIncidentsWithServer(result.data);
          
          const finalIncidents = await getAllIncidents();
          finalIncidents.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
          setIncidents(finalIncidents);
        }
      } else {
        localIncidents.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setIncidents(localIncidents);
      }
    } catch (error) {
      console.error('Failed to load incidents', error);
      const localIncidents = await getAllIncidents();
      localIncidents.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      setIncidents(localIncidents);
    }
  };

  const handleSync = async () => {
    const result = await syncData();
    if (result.success) {
      if (result.message === 'All data synchronized.') {
         setMessage("All data synchronized.");
      } else {
         setMessage(`Sync complete. ${result.message}`);
      }
      await updatePendingCount();
      await loadIncidents();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      workerId: formData.workerId,
      type: formData.type,
      location: {
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude)
      },
      severity: formData.severity,
      description: formData.description,
      peopleAffected: Number(formData.peopleAffected)
    };

    if (navigator.onLine) {
      try {
        const isLocalEdit = editingId && editingId.toString().startsWith('local-');
        const url = (editingId && !isLocalEdit) ? `${API_URL}/${editingId}` : API_URL;
        const method = (editingId && !isLocalEdit) ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.success) {
          setMessage(`Incident synced successfully.`);
          
          await saveIncident({
            ...result.data,
            id: result.data._id,
            syncStatus: 'SYNCED'
          });
          
          resetForm();
          await loadIncidents();
          await updatePendingCount();
        } else {
          setMessage(`Error: ${result.error}`);
        }
      } catch (error) {
        await handleOfflineSubmit(payload);
      }
    } else {
      await handleOfflineSubmit(payload);
    }
  };

  const handleOfflineSubmit = async (payload) => {
    const isLocalEdit = editingId && editingId.toString().startsWith('local-');
    const operationType = (editingId && !isLocalEdit) ? 'UPDATE' : 'CREATE';
    const tempId = editingId || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    let changedFields = [];
    if (editingId && !isLocalEdit) {
      const existing = incidents.find(i => (i.id || i._id) === editingId);
      if (existing) {
        if (existing.type !== payload.type) changedFields.push('type');
        if (existing.severity !== payload.severity) changedFields.push('severity');
        if (existing.description !== payload.description) changedFields.push('description');
        if (existing.peopleAffected !== payload.peopleAffected) changedFields.push('peopleAffected');
        if (existing.location?.latitude !== payload.location.latitude || existing.location?.longitude !== payload.location.longitude) {
           changedFields.push('location');
        }
      }
    }

    const localIncident = {
      ...payload,
      id: tempId,
      _id: tempId,
      syncStatus: 'PENDING',
      createdAt: editingId ? undefined : now,
      updatedAt: now,
      version: 1
    };

    await saveIncident(localIncident);

    await saveSyncOperation({
      operationId,
      operationType,
      incidentId: tempId,
      payload,
      changedFields,
      createdAt: now,
      status: 'PENDING'
    });

    setMessage("Incident saved offline. Waiting for synchronization.");
    resetForm();
    await updatePendingCount();
    await loadIncidents();
  };

  const resetForm = () => {
    setFormData({
      workerId: formData.workerId,
      type: 'Flood',
      latitude: '',
      longitude: '',
      severity: 'Medium',
      description: '',
      peopleAffected: 0
    });
    setEditingId(null);
  };

  const handleEdit = (incident) => {
    setEditingId(incident.id || incident._id);
    setFormData({
      workerId: incident.workerId,
      type: incident.type,
      latitude: incident.location.latitude,
      longitude: incident.location.longitude,
      severity: incident.severity,
      description: incident.description,
      peopleAffected: incident.peopleAffected
    });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <h1>Field Worker Portal</h1>
          {lastSyncTime && <p>Last Sync: {new Date(lastSyncTime).toLocaleString()}</p>}
        </div>
        <div className="flex-gap" style={{ alignItems: 'center' }}>
          {isOnline ? (
            <span className="badge badge-online">
              <span className="badge-indicator"></span> ONLINE
            </span>
          ) : (
            <span className="badge badge-offline">
              <span className="badge-indicator"></span> OFFLINE
            </span>
          )}
          
          {pendingCount > 0 ? (
             <span className="badge badge-warning">
               <span className="badge-indicator"></span> PENDING SYNC: {pendingCount}
             </span>
          ) : (
             <span className="badge badge-neutral">
               All Synced
             </span>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleSync} 
            disabled={!isOnline || pendingCount === 0}
          >
            Sync Now
          </button>
        </div>
      </div>
      
      {message && <div className="alert">{message}</div>}

      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Update Incident' : 'Report New Incident'}</h2>
        <form onSubmit={handleSubmit} className="flex-col" style={{ gap: '1.25rem' }}>
          
          <div className="form-grid">
            <div className="flex-col">
              <label>Worker ID</label>
              <input name="workerId" value={formData.workerId} onChange={handleChange} required />
            </div>
            <div className="flex-col">
              <label>Disaster Type</label>
              <select name="type" value={formData.type} onChange={handleChange}>
                <option value="Flood">Flood</option>
                <option value="Cyclone">Cyclone</option>
                <option value="Landslide">Landslide</option>
                <option value="Heavy Rainfall">Heavy Rainfall</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="flex-col">
              <label>Latitude</label>
              <input name="latitude" type="number" step="any" value={formData.latitude} onChange={handleChange} required />
            </div>
            <div className="flex-col">
              <label>Longitude</label>
              <input name="longitude" type="number" step="any" value={formData.longitude} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-grid">
            <div className="flex-col">
              <label>Severity</label>
              <select name="severity" value={formData.severity} onChange={handleChange}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="flex-col">
              <label>People Affected</label>
              <input name="peopleAffected" type="number" value={formData.peopleAffected} onChange={handleChange} required />
            </div>
          </div>

          <div className="flex-col">
            <label>Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={4}></textarea>
          </div>
          
          <div className="flex-gap" style={{ marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Incident' : 'Submit Incident'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn btn-secondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div>
        <h2>Reported Incidents</h2>
        {incidents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <h3>No incidents reported yet</h3>
            <p>Use the form above to submit a new incident report.</p>
          </div>
        ) : (
          <div className="flex-col" style={{ gap: '1.25rem' }}>
            {incidents.map(incident => (
              <div key={incident.id || incident._id} className="incident-card">
                <div className="incident-header">
                  <strong style={{ fontFamily: 'monospace' }}>ID: {incident.id || incident._id}</strong>
                  <div className="flex-gap" style={{ alignItems: 'center', gap: '0.5rem' }}>
                    {incident.syncStatus === 'PENDING' && (
                       <span className="badge badge-warning">PENDING SYNC</span>
                    )}
                    <span className="badge badge-neutral">v{incident.version || 1}</span>
                  </div>
                </div>
                
                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="incident-detail"><strong>Type:</strong> <span style={{ fontWeight: 500 }}>{incident.type}</span></div>
                  <div className="incident-detail">
                    <strong>Severity:</strong> 
                    <span className={`badge badge-${incident.severity.toLowerCase()}`}>
                      {incident.severity}
                    </span>
                  </div>
                  <div className="incident-detail"><strong>Location:</strong> {incident.location.latitude}, {incident.location.longitude}</div>
                  <div className="incident-detail"><strong>People Affected:</strong> {incident.peopleAffected}</div>
                </div>
                
                <div className="incident-detail" style={{ fontStyle: 'italic', marginBottom: '1.5rem', lineHeight: 1.6 }}>{incident.description}</div>
                
                <div className="incident-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
                  <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                    Last Updated: {new Date(incident.updatedAt || incident.createdAt).toLocaleString()}
                  </div>
                  <button onClick={() => handleEdit(incident)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FieldWorker;
