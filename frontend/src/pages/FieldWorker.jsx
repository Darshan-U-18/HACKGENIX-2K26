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

  const API_URL = 'http://localhost:5000/api/incidents';

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
    window.scrollTo(0, 0);
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1>ResilSync Field Worker</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            padding: '5px 10px', 
            borderRadius: '4px', 
            backgroundColor: isOnline ? '#e6ffe6' : '#ffe6e6',
            color: isOnline ? '#008000' : '#cc0000',
            fontWeight: 'bold',
            border: `1px solid ${isOnline ? '#00cc00' : '#ff0000'}`
          }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
          {pendingCount > 0 ? (
             <div style={{ color: '#d97706', fontWeight: 'bold' }}>
               Pending Sync: {pendingCount}
             </div>
          ) : (
             <div style={{ color: '#666', fontWeight: 'bold' }}>
               All changes synchronized
             </div>
          )}
          <button onClick={handleSync} disabled={!isOnline || pendingCount === 0} style={{ padding: '6px 12px', cursor: (isOnline && pendingCount > 0) ? 'pointer' : 'not-allowed' }}>
            Sync Now
          </button>
        </div>
      </div>
      
      {lastSyncTime && <div style={{ marginBottom: '20px', color: '#666', fontSize: '0.9em' }}>Last Sync: {new Date(lastSyncTime).toLocaleString()}</div>}
      
      {message && <div style={{ padding: '10px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', marginBottom: '20px' }}>{message}</div>}

      <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>{editingId ? 'Update Incident' : 'Report New Incident'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label>Worker ID: </label>
            <input name="workerId" value={formData.workerId} onChange={handleChange} required style={{ padding: '8px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label>Disaster Type: </label>
            <select name="type" value={formData.type} onChange={handleChange} style={{ padding: '8px' }}>
              <option value="Flood">Flood</option>
              <option value="Cyclone">Cyclone</option>
              <option value="Landslide">Landslide</option>
              <option value="Heavy Rainfall">Heavy Rainfall</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
              <label>Latitude: </label>
              <input name="latitude" type="number" step="any" value={formData.latitude} onChange={handleChange} required style={{ padding: '8px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
              <label>Longitude: </label>
              <input name="longitude" type="number" step="any" value={formData.longitude} onChange={handleChange} required style={{ padding: '8px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
              <label>Severity: </label>
              <select name="severity" value={formData.severity} onChange={handleChange} style={{ padding: '8px' }}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
              <label>People Affected: </label>
              <input name="peopleAffected" type="number" value={formData.peopleAffected} onChange={handleChange} required style={{ padding: '8px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label>Description: </label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={4} style={{ padding: '8px' }}></textarea>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {editingId ? 'Update Incident' : 'Submit Incident'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ padding: '10px 15px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div>
        <h2>Reported Incidents</h2>
        {incidents.length === 0 ? <p>No incidents reported yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {incidents.map(incident => (
              <div key={incident.id || incident._id} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong>ID: {incident.id || incident._id}</strong>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {incident.syncStatus === 'PENDING' && (
                       <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '10px', fontSize: '0.85em', fontWeight: 'bold' }}>PENDING SYNC</span>
                    )}
                    <span style={{ backgroundColor: '#eee', padding: '2px 8px', borderRadius: '10px', fontSize: '0.85em' }}>v{incident.version || 1}</span>
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}><strong>Type:</strong> {incident.type} | <strong>Severity:</strong> {incident.severity}</div>
                <div style={{ marginBottom: '8px' }}><strong>Location:</strong> {incident.location.latitude}, {incident.location.longitude}</div>
                <div style={{ marginBottom: '8px' }}><strong>People Affected:</strong> {incident.peopleAffected}</div>
                <div style={{ marginBottom: '8px', fontStyle: 'italic' }}>{incident.description}</div>
                <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '10px' }}>Last Updated: {new Date(incident.updatedAt || incident.createdAt).toLocaleString()}</div>
                <button onClick={() => handleEdit(incident)} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>
                  Update
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FieldWorker;
