'use strict';

const DB = (() => {
  const DB_NAME = 'HatakeDB';
  const DB_VERSION = 1;
  let db;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { db = req.result; resolve(); };
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('crops')) {
          d.createObjectStore('crops', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('records')) {
          const s = d.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date', { unique: false });
          s.createIndex('cropId', 'cropId', { unique: false });
        }
        if (!d.objectStoreNames.contains('planned')) {
          const p = d.createObjectStore('planned', { keyPath: 'id', autoIncrement: true });
          p.createIndex('cropId', 'cropId', { unique: false });
        }
      };
    });
  }

  function tx(storeName, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const s = t.objectStore(storeName);
      const req = fn(s);
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  function makeStore(name) {
    return {
      getAll:  ()   => tx(name, 'readonly',  s => s.getAll()),
      get:     id   => tx(name, 'readonly',  s => s.get(id)),
      add:     item => tx(name, 'readwrite', s => s.add({ ...item, createdAt: Date.now() })),
      put:     item => tx(name, 'readwrite', s => s.put(item)),
      delete:  id   => tx(name, 'readwrite', s => s.delete(id)),
    };
  }

  return {
    open,
    crops:   makeStore('crops'),
    records: makeStore('records'),
    planned: makeStore('planned'),
  };
})();
