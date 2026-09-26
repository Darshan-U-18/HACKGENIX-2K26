import { getPendingSyncOperations, updateSyncOperationStatus, saveIncident, deleteIncident, getAllIncidents } from './dbService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = `${API_BASE}/incidents`;

export const syncData = async () => {
  if (!navigator.onLine) return { success: false, message: 'Currently offline.' };
  
  const pendingOps = await getPendingSyncOperations();
  if (pendingOps.length === 0) return { success: true, message: 'All data synchronized.' };

  let syncedCount = 0;
  
  for (const op of pendingOps) {
    try {
      if (op.operationType === 'CREATE') {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: op.payload,
            operationId: op.operationId,
            timestamp: op.createdAt
          })
        });
        const result = await res.json();
        
        if (result.success) {
          await updateSyncOperationStatus(op.operationId, 'SYNCED');
          await deleteIncident(op.incidentId);
          await saveIncident({
            ...result.data,
            id: result.data._id,
            syncStatus: 'SYNCED'
          });
          syncedCount++;
        }
      } else if (op.operationType === 'UPDATE') {
        const urlId = op.incidentId.toString().startsWith('local-') ? '' : op.incidentId;
        if (!urlId) {
            // Cannot UPDATE an incident if it hasn't been created on server yet.
            // Ideally should combine ops or wait, but MVP keeps it simple.
            continue;
        }

        const res = await fetch(`${API_URL}/${urlId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             payload: op.payload,
             operationId: op.operationId,
             timestamp: op.createdAt,
             changedFields: op.changedFields || []
          })
        });
        const result = await res.json();
        if (result.success) {
          await updateSyncOperationStatus(op.operationId, 'SYNCED');
          await saveIncident({
            ...result.data,
            id: result.data._id,
            syncStatus: 'SYNCED'
          });
          syncedCount++;
        }
      }
    } catch (error) {
      console.error('Sync failed for operation:', op.operationId, error);
      // Fails quietly for this operation, keeping it PENDING
    }
  }

  if (syncedCount > 0 || pendingOps.length === 0) {
    localStorage.setItem('lastSyncTime', new Date().toISOString());
  }

  return { success: true, count: syncedCount, message: `Synced ${syncedCount} operation(s).` };
};

export const reconcileIncidentsWithServer = async (remoteIncidents) => {
  const localIncidents = await getAllIncidents();
  const pendingOps = await getPendingSyncOperations();
  
  const pendingIncidentIds = new Set();
  
  // Track incidents that have pending status or pending operations
  localIncidents.forEach(inc => {
    if (inc.syncStatus === 'PENDING') pendingIncidentIds.add(inc.id);
  });
  
  pendingOps.forEach(op => {
    pendingIncidentIds.add(op.incidentId);
  });

  const remoteIds = new Set(remoteIncidents.map(i => String(i._id || i.id)));

  // 1. Remove local records that no longer exist on the server
  for (const localInc of localIncidents) {
    const localId = String(localInc.id);
    if (!remoteIds.has(localId) && !pendingIncidentIds.has(localId)) {
      await deleteIncident(localInc.id);
    }
  }

  // 2. Update existing local records or add new server records
  for (const remoteInc of remoteIncidents) {
    const remoteId = String(remoteInc._id || remoteInc.id);
    // Protect local records that have pending offline work
    if (!pendingIncidentIds.has(remoteId)) {
      await saveIncident({
        ...remoteInc,
        id: remoteId,
        syncStatus: 'SYNCED'
      });
    }
  }
};
