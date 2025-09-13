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

  // =======================
  // IMPORT EXTERNAL EXERCISES
  // =======================

  async function fileExists(url){
    try {
      const r = await fetch(url, { method:'HEAD' });
      return r.ok;
    } catch { return false; }
  }

  async function normalizeExercise(ex){
    const id = String(ex.id || ex._id || ex.uuid || '').trim();
    if (!id) return null;

    // Transcodification
    const eq = CFG.decodeEquipment(ex.equipment);
    const mu = CFG.decodeMuscle(ex.target);

    // Image/GIF : essaye data/media/<filename>.gif avant l’URL d’origine
	let image = ex.gifUrl || ex.image || null;
	if (image) {
	  try {
		const fname = image.split('/').pop(); // "0001.gif"
		const localPathAbs = new URL(`data/media/${fname}`, document.baseURI).href;
		if (await fileExists(localPathAbs)) {
		  image = localPathAbs; // ✅ prend le GIF local si présent
		}
	  } catch(_) { /* ignore */ }
	}

    return {
      id,
      name: ex.name || ex.exercise || id,
      equipment: ex.equipment || null,
      equipmentGroup1: eq.g1,
      equipmentGroup2: eq.g2,
      muscle: mu.muscle,
      muscleGroup1: mu.g1,
      muscleGroup2: mu.g2,
      muscleGroup3: mu.g3,
      target: ex.target || null,
      bodyPart: ex.bodyPart || null,
      image
    };
  }

	async function importExternalExercisesIfNeeded(){
	  const count = await countStore('exercises');
	  if (count > 0) return;

	  try {
		// construit l’URL à partir de la page courante (robuste avec /A0/)
		const url = new URL('data/exercises.json', document.baseURI).href;
		const res = await fetch(url, { cache: 'no-store' });
		if (!res.ok) throw new Error('data/exercises.json introuvable');
		const data = await res.json();

		if (!Array.isArray(data)) {
		  console.warn('exercises.json pas un tableau, import ignoré.');
		  return;
		}

		const BATCH = 200;
		for (let i=0; i<data.length; i+=BATCH){
		  const slice = data.slice(i, i+BATCH);
		  const rows = await Promise.all(slice.map(normalizeExercise));
		  for (const ex of rows) if (ex) await put('exercises', ex);
		}
		console.log('Import exercises terminé.');
	  } catch (e) {
		console.warn('Import externe sauté :', e.message);
	  }
	}


  // helper interne (évite collision avec fonction globale)
  async function countStore(store){ return count(store); }

  return {
    init, get, put, getAll, count,
    getSession, saveSession, listSessionDates,
    getActivePlan,
    importExternalExercisesIfNeeded
  };
})();
