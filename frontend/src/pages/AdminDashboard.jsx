import React, { useState, useEffect } from 'react';
import { getPendingSyncOperations } from '../services/dbService';
import { syncData } from '../services/syncService';

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
        const [incRes, confRes] = await Promise.all([
          fetch('http://localhost:5000/api/incidents'),
          fetch('http://localhost:5000/api/conflicts')
        ]);
        
        if (!incRes.ok || !confRes.ok) throw new Error('API request failed');

        const incData = await incRes.json();
        const confData = await confRes.json();

        if (incData.success) setIncidents(incData.data);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>ResilSync Admin Dashboard</h1>
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
               PENDING SYNC: {pendingCount}
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

      <p>Monitor system status, incidents, and synchronizations. {lastSyncTime && <span>Last Sync: <strong>{new Date(lastSyncTime).toLocaleTimeString()}</strong></span>}</p>

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffe6e6', color: '#cc0000', border: '1px solid #cc0000', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* STATS CARDS */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '150px', padding: '1.5rem', backgroundColor: '#f0f2f5', borderRadius: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#555' }}>TOTAL INCIDENTS</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1890ff' }}>{totalIncidents}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', padding: '1.5rem', backgroundColor: '#fffbe6', borderRadius: '8px', textAlign: 'center', border: '1px solid #ffe58f' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#555' }}>PENDING SYNC</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#faad14' }}>{pendingCount}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', padding: '1.5rem', backgroundColor: '#f6ffed', borderRadius: '8px', textAlign: 'center', border: '1px solid #b7eb8f' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#555' }}>RESOLVED CONFLICTS</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#52c41a' }}>{resolvedConflicts}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', padding: '1.5rem', backgroundColor: '#e6f7ff', borderRadius: '8px', textAlign: 'center', border: '1px solid #91d5ff' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#555' }}>MERGED CONFLICTS</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#096dd9' }}>{mergedConflicts}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', padding: '1.5rem', backgroundColor: '#fff0f6', borderRadius: '8px', textAlign: 'center', border: '1px solid #ffadd2' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#555' }}>LATEST OP WINS</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#eb2f96' }}>{latestWins}</div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Incident Database</h2>
        {incidents.length === 0 ? (
          <p>No incidents available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2', textAlign: 'left' }}>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Incident ID</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Type</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Severity</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Location</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Worker ID</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Sync Status</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Updated Time</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc._id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>{inc._id}</td>
                    <td style={{ padding: '10px' }}>{inc.type}</td>
                    <td style={{ padding: '10px' }}>{inc.severity}</td>
                    <td style={{ padding: '10px' }}>{inc.location?.latitude.toFixed(4)}, {inc.location?.longitude.toFixed(4)}</td>
                    <td style={{ padding: '10px' }}>{inc.workerId}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ backgroundColor: '#d9f7be', color: '#237804', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85em', fontWeight: 'bold' }}>
                        SYNCED (v{inc.version})
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>{new Date(inc.updatedAt).toLocaleString()}</td>
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
          <p>No conflicts detected.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2', textAlign: 'left' }}>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Conflict ID</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Incident ID</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Conflicting Fields</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Resolution</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map(c => (
                  <tr key={c._id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>{c.conflictId}</td>
                    <td style={{ padding: '10px' }}>{c.incidentId}</td>
                    <td style={{ padding: '10px' }}>{c.conflictingFields.join(', ')}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ 
                        backgroundColor: c.resolution === 'MERGED' ? '#e6f7ff' : c.resolution === 'DUPLICATE_IGNORED' ? '#f5f5f5' : '#fff1f0',
                        color: c.resolution === 'MERGED' ? '#096dd9' : c.resolution === 'DUPLICATE_IGNORED' ? '#595959' : '#cf1322',
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.9em', fontWeight: 'bold'
                      }}>
                        {c.resolution}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>{c.status}</td>
                    <td style={{ padding: '10px' }}>{new Date(c.resolvedAt).toLocaleString()}</td>
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
