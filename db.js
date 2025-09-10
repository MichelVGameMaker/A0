
/* db.js — IndexedDB helpers (stores: exercises, routines, plans, sessions) */
const db = (() => {
  const DB_NAME = 'A0-db';
  const DB_VER  = 1;
  let _db;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath:'id' });
        if (!db.objectStoreNames.contains('routines'))  db.createObjectStore('routines',  { keyPath:'id' });
        if (!db.objectStoreNames.contains('plans'))     db.createObjectStore('plans',     { keyPath:'id' });
        if (!db.objectStoreNames.contains('sessions'))  db.createObjectStore('sessions',  { keyPath:'date' }); // 1 séance par date
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function init(){ _db = await open(); }

  function tx(store, mode='readonly'){ return _db.transaction(store, mode).objectStore(store); }

  async function get(store, key){
    return new Promise((res,rej)=>{
      const r = tx(store).get(key);
      r.onsuccess = ()=>res(r.result||null);
      r.onerror = ()=>rej(r.error);
    });
  }
  async function put(store, val){
    return new Promise((res,rej)=>{
      const r = tx(store,'readwrite').put(val);
      r.onsuccess = ()=>res(true);
      r.onerror = ()=>rej(r.error);
    });
  }
  async function getAll(store){
    return new Promise((res,rej)=>{
      const r = tx(store).getAll();
      r.onsuccess = ()=>res(r.result||[]);
      r.onerror = ()=>rej(r.error);
    });
  }
  async function count(store){
    return new Promise((res,rej)=>{
      const r = tx(store).count();
      r.onsuccess = ()=>res(r.result||0);
      r.onerror = ()=>rej(r.error);
    });
  }

  // Sessions
  async function getSession(date){ return get('sessions', date); }
  async function saveSession(sess){ return put('sessions', sess); }
  async function listSessionDates(){
    const all = await getAll('sessions');
    return all.map(s => ({ date: s.date }));
  }

  // Plan actif
  async function getActivePlan(){
    const all = await getAll('plans');
    return all.find(p => p.active) || null;
  }

  return {
    init, get, put, getAll, count,
    getSession, saveSession, listSessionDates,
    getActivePlan
  };
})();
