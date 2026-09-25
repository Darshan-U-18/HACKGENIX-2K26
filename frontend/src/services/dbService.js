const DB_NAME = 'resilsync-db';
const DB_VERSION = 1;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject(event.target.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('incidents')) {
        db.createObjectStore('incidents', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'operationId' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
};

export const getStore = async (storeName, mode = 'readonly') => {
  const db = await initDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

export const saveIncident = async (incident) => {
  const store = await getStore('incidents', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(incident);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllIncidents = async () => {
  const store = await getStore('incidents', 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteIncident = async (id) => {
  const store = await getStore('incidents', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveSyncOperation = async (operation) => {
  const store = await getStore('syncQueue', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(operation);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getPendingSyncOperations = async () => {
  const store = await getStore('syncQueue', 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const allOps = request.result;
      resolve(allOps.filter(op => op.status === 'PENDING').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    request.onerror = () => reject(request.error);
  });
};

export const updateSyncOperationStatus = async (operationId, status) => {
  const store = await getStore('syncQueue', 'readwrite');
  return new Promise((resolve, reject) => {
    const getReq = store.get(operationId);
    getReq.onsuccess = () => {
      const data = getReq.result;
      if (data) {
        data.status = status;
        const putReq = store.put(data);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
};
