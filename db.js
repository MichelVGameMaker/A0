// IndexedDB minimal pour exercices / routines / séances / réglages / plan
const DB_NAME = 'muscu-db';
const DB_VER  = 1;

function openDB(){
  return new Promise((res, rej)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains('exercises')){
        const s = db.createObjectStore('exercises',{keyPath:'id',autoIncrement:true});
        s.createIndex('name','name'); s.createIndex('group3','group3'); s.createIndex('equipment','equipment');
      }
      if(!db.objectStoreNames.contains('routines')){
        db.createObjectStore('routines',{keyPath:'id',autoIncrement:true}); // {id,name,type,desc,items[]}
      }
      if(!db.objectStoreNames.contains('workouts')){
        db.createObjectStore('workouts',{keyPath:'date'}); // "YYYY-MM-DD"
      }
      if(!db.objectStoreNames.contains('settings')){
        db.createObjectStore('settings',{keyPath:'key'});
      }
      if(!db.objectStoreNames.contains('plan')){
        db.createObjectStore('plan',{keyPath:'day'}); // 1..28
      }
    };
    req.onsuccess = ()=>res(req.result);
    req.onerror = ()=>rej(req.error);
  });
}

async function store(name, mode='readonly'){
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export const db = {
  async getAll(name){ const s=await store(name); return new Promise(r=>{ const q=s.getAll(); q.onsuccess=()=>r(q.result); });},
  async get(name, key){ const s=await store(name); return new Promise(r=>{ const q=s.get(key); q.onsuccess=()=>r(q.result); });},
  async put(name, val){ const s=await store(name,'readwrite'); return new Promise(r=>{ const q=s.put(val); q.onsuccess=()=>r(q.result); });},
  async delete(name, key){ const s=await store(name,'readwrite'); return new Promise(r=>{ const q=s.delete(key); q.onsuccess=()=>r(); });}
};

// Seed de départ
export async function ensureSeed(){
  const exos = await db.getAll('exercises');
  if(exos.length===0){
    await db.put('exercises',{name:'Développé couché', group3:'Pectoraux', equipment:'Barre', desc:''});
    await db.put('exercises',{name:'Squat', group3:'Quadriceps', equipment:'Barre', desc:''});
    await db.put('exercises',{name:'Tractions', group3:'Dos', equipment:'Poids de corps', desc:''});
  }
  const st = await db.getAll('settings');
  if(st.length===0){
    await db.put('settings',{key:'fontSize', value:'normal'});
    await db.put('settings',{key:'defaultTimer', value:60});
    await db.put('settings',{key:'weightStep', value:1});
    await db.put('settings',{key:'seriesDefaultMode', value:'template'});
    await db.put('settings',{key:'theme', value:'light'});
  }
}
