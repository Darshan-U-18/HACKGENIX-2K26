import React, { useState, useEffect } from 'react';
import { getPendingSyncOperations } from '../services/dbService';
import { syncData, reconcileIncidentsWithServer } from '../services/syncService';

function AdminDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('lastSyncTime'));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    fetchData();
    const interval = setInterval(fetchData, 5000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const fetchData = async () => {
    try {
      const pendingOps = await getPendingSyncOperations();
      setPendingCount(pendingOps.length);

      if (navigator.onLine) {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const [incRes, confRes] = await Promise.all([
          fetch(`${API_BASE}/incidents`),
          fetch(`${API_BASE}/conflicts`)
        ]);
        
        if (!incRes.ok || !confRes.ok) throw new Error('API request failed');

        const incData = await incRes.json();
        const confData = await confRes.json();

        if (incData.success) {
          await reconcileIncidentsWithServer(incData.data);
          setIncidents(incData.data);
        }
        if (confData.success) setConflicts(confData.data);
        setError('');
      }
      setLastSyncTime(localStorage.getItem('lastSyncTime'));
    } catch (err) {
      console.error(err);
      setError('Unable to fetch data from the server. Please check your connection.');
    }
  };

  const totalIncidents = incidents.length;
  const resolvedConflicts = conflicts.length;
  const mergedConflicts = conflicts.filter(c => c.resolution === 'MERGED').length;
  const latestWins = conflicts.filter(c => c.resolution === 'LATEST_OPERATION_WINS').length;

  const handleSync = async () => {
    if (!navigator.onLine) return;
    const result = await syncData();
    if (result.success) {
       await fetchData();
    }
  };

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Monitor system status, incidents, and synchronizations. {lastSyncTime && <span>Last Sync: <strong>{new Date(lastSyncTime).toLocaleTimeString()}</strong></span>}</p>
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

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* STATS CARDS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Incidents</div>
          <div className="stat-value primary">{totalIncidents}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Pending Sync</div>
          <div className="stat-value warning">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Resolved Conflicts</div>
          <div className="stat-value success">{resolvedConflicts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Merged Conflicts</div>
          <div className="stat-value">{mergedConflicts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Latest Op Wins</div>
          <div className="stat-value danger">{latestWins}</div>
        </div>
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <h2>Incident Database</h2>
        {incidents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <h3>No incidents available</h3>
            <p>New disaster reports will appear here when synced.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Location</th>
                  <th>Worker ID</th>
                  <th>Sync Status</th>
                  <th>Updated Time</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{inc._id}</td>
                    <td style={{ fontWeight: 500 }}>{inc.type}</td>
                    <td>
                      <span className={`badge badge-${inc.severity.toLowerCase()}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{inc.location?.latitude.toFixed(4)}, {inc.location?.longitude.toFixed(4)}</td>
                    <td>{inc.workerId}</td>
                    <td>
                      <span className="badge badge-online">
                        SYNCED (v{inc.version})
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>{new Date(inc.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2>Conflict Resolution Log</h2>
        {conflicts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <h3>No conflicts detected</h3>
            <p>All operations have synced without merge conflicts.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Conflict ID</th>
                  <th>Incident ID</th>
                  <th>Conflicting Fields</th>
                  <th>Resolution</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{c.conflictId}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{c.incidentId}</td>
                    <td>{c.conflictingFields.join(', ')}</td>
                    <td>
                      <span className={`badge ${c.resolution === 'MERGED' ? 'badge-online' : c.resolution === 'DUPLICATE_IGNORED' ? 'badge-neutral' : 'badge-warning'}`}>
                        {c.resolution}
                      </span>
                    </td>
                    <td>{c.status}</td>
                    <td style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>{new Date(c.resolvedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
