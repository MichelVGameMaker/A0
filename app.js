import { db, ensureSeed } from './db.js';

/* ===== utils ===== */
const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const last = a => a[a.length-1];
const pad = n => String(n).padStart(2,'0');
const fmtDate = d => d.toISOString().slice(0,10);
const parseISO = s => { const [y,m,d]=s.split('-').map(Number); const dt = new Date(y,m-1,d); dt.setHours(0,0,0,0); return dt; };
const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };

/* ===== nav/header ===== */
let navStack = [];
let currentRoute = 'sessions';
let currentRoutineId = null;
let currentExerciseId = null;

const header = {
  set({back=false, title='', ok=false}){
    qs('#btnBack').hidden = !back;
    qs('#btnOk').hidden = !ok;
    qs('#title').textContent = title;
  },
  onBack(cb){ qs('#btnBack').onclick = cb; },
  onOk(cb){ qs('#btnOk').onclick = cb; }
};

function showView(id, {push=true}={}){
  const next = qs('#'+id);
  const cur  = last(navStack);
  next.hidden = false;
  if(push){
    next.classList.add('enter-from-right');
    requestAnimationFrame(()=>{
      if(cur) cur.classList.add('leave-to-left');
      next.classList.remove('enter-from-right');
    });
    next.addEventListener('transitionend', function onEnd(){
      next.removeEventListener('transitionend', onEnd);
      if(cur){ cur.hidden = true; cur.classList.remove('leave-to-left'); }
    });
    navStack.push(next);
  }else{
    if(cur) cur.hidden = true;
    navStack = [next];
  }
  currentRoute = next.dataset.route;
  renderSubtabs();
}
function back(){
  if(navStack.length<=1) return;
  const cur = navStack.pop();
  const prev = last(navStack);
  prev.hidden = false;
  prev.classList.add('enter-from-left');
  requestAnimationFrame(()=>{
    cur.classList.add('leave-to-right');
    prev.classList.remove('enter-from-left');
  });
  cur.addEventListener('transitionend', function onEnd(){
    cur.removeEventListener('transitionend', onEnd);
    cur.hidden = true;
    cur.classList.remove('leave-to-right');
  });
  currentRoute = prev.dataset.route;
  renderSubtabs();
}

/* ===== sub tabs (bibliothèques / stats) ===== */
function renderSubtabs(){
  const st = qs('#subTabs'); st.innerHTML=''; st.hidden = true;
  const libs = ['routines','plan','exercises'];
  const stats = ['stats-general','stats-progress','goals'];

  if(['exercises','routines','routine-form','add-movements','plan'].includes(currentRoute)){
    st.hidden = false;
    libs.forEach(id=>{
      const b=document.createElement('button'); b.className='chip';
      b.textContent = id==='routines'?'Routines':id==='plan'?'Plan':'Exercices';
      if((currentRoute.startsWith('routine') && id==='routines') || currentRoute===id) b.classList.add('active');
      b.onclick = ()=>{ if(id==='routines') openRoutines(); if(id==='plan') openPlan(); if(id==='exercises') openExercises(); };
      st.appendChild(b);
    });
  } else if(['stats-general','stats-progress','goals'].includes(currentRoute)){
    st.hidden = false;
    stats.forEach(id=>{
      const b=document.createElement('button'); b.className='chip';
      b.textContent = id==='stats-general'?'Général':id==='stats-progress'?'Progrès':'Objectifs';
      if(currentRoute===id) b.classList.add('active');
      b.onclick = ()=>{ if(id==='stats-general') openStatsGeneral(); if(id==='stats-progress') openStatsProgress(); if(id==='goals') openGoals(); };
      st.appendChild(b);
    });
  }
}

/* ===== bottom tabs ===== */
qsa('.tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    qsa('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    if(tab==='sessions'){ header.set({back:false,title:'Séances',ok:false}); showView('v-sessions',{push:false}); renderSessions(); }
    if(tab==='libraries'){ openRoutines(); }
    if(tab==='stats'){ openStatsGeneral(); }
    if(tab==='settings'){ openSettings(); }
  });
});

/* ===== drag & drop (︙) ===== */
function enableReorder(listEl, onReorder){
  let dragEl=null, ph=null, pressTimer=null, startIndex=-1;

  const itemAtY = y => [...listEl.querySelectorAll('.item')].find(el=>{
    const r=el.getBoundingClientRect(); return y>=r.top && y<=r.bottom;
  });
  function startDrag(el, y){
    dragEl = el; startIndex=[...listEl.children].indexOf(el);
    ph = document.createElement('li'); ph.className='placeholder'; listEl.insertBefore(ph, el.nextSibling);
    el.classList.add('dragging');
    const r = el.getBoundingClientRect();
    el.style.position='fixed'; el.style.left=r.left+'px'; el.style.top=r.top+'px'; el.style.width=r.width+'px'; el.style.zIndex='9';
    document.body.style.touchAction='none';
  }
  function moveDrag(y){
    if(!dragEl) return;
    dragEl.style.top = (y - dragEl.offsetHeight/2) + 'px';
    const tgt = itemAtY(y);
    if(tgt && tgt!==ph && tgt!==dragEl){
      const r = tgt.getBoundingClientRect();
      listEl.insertBefore(ph, (y < r.top + r.height/2) ? tgt : tgt.nextSibling);
    }
  }
  function endDrag(){
    if(!dragEl) return;
    dragEl.classList.remove('dragging'); dragEl.style.cssText='';
    listEl.insertBefore(dragEl, ph);
    const newIndex = [...listEl.children].indexOf(dragEl);
    ph.remove(); ph=null; document.body.style.touchAction='';
    const ids = [...listEl.querySelectorAll('.item')].map(el=>Number(el.dataset.id||el.dataset.idx));
    onReorder?.(ids, startIndex, newIndex);
    dragEl=null;
  }

  listEl.addEventListener('contextmenu', e=>e.preventDefault());
  listEl.addEventListener('pointerdown', e=>{
    const handle = e.target.closest('.grab'); if(!handle) return;
    const li = e.target.closest('.item'); if(!li) return;
    pressTimer = setTimeout(()=> startDrag(li, e.clientY), 160);
  });
  window.addEventListener('pointermove', e=>{
    if(pressTimer && Math.abs(e.movementY)>2){ clearTimeout(pressTimer); pressTimer=null; }
    moveDrag(e.clientY);
  });
  window.addEventListener('pointerup', ()=>{ clearTimeout(pressTimer); pressTimer=null; endDrag(); });
}

/* ===== Exercices (3.1) ===== */
async function openExercises(){
  header.set({back:false,title:'Exercices',ok:false});
  showView('v-exercises',{push:false});
  await renderExerciseFilters();
  renderExerciseList();
}
async function renderExerciseFilters(){
  const exos = await db.getAll('exercises');
  const g = new Set(), m = new Set();
  exos.forEach(e=>{ if(e.group3) g.add(e.group3); if(e.equipment) m.add(e.equipment); });
  qs('#fGrp').innerHTML = '<option value="">Groupe musculaire</option>' + [...g].map(x=>`<option>${x}</option>`).join('');
  qs('#fMat').innerHTML = '<option value="">Matériel</option>' + [...m].map(x=>`<option>${x}</option>`).join('');
}
async function renderExerciseList(){
  const q = qs('#searchExo').value.trim().toLowerCase();
  const fgrp = qs('#fGrp').value; const fmat = qs('#fMat').value;
  const list = qs('#exerciseList'); list.innerHTML='';
  const exos = await db.getAll('exercises');
  exos
    .filter(e=>!q || e.name.toLowerCase().includes(q))
    .filter(e=>!fgrp || e.group3===fgrp)
    .filter(e=>!fmat || e.equipment===fmat)
    .sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(e=>{
      const li=document.createElement('li'); li.className='item'; li.dataset.id=e.id;
      li.innerHTML = `
        <div class="thumb"></div>
        <div class="grow">
          <div class="name">${e.name}</div>
          <div class="detail">${e.group3 || ''} – ${e.equipment || ''}</div>
        </div>
        <button class="edit">✏️</button>
      `;
      li.onclick = ()=> openExerciseForm(e.id);
      list.appendChild(li);
    });
}
qs('#btnNewExercise').onclick = ()=>openExerciseForm(null);
qs('#searchExo').oninput = renderExerciseList;
qs('#fGrp').onchange = renderExerciseList;
qs('#fMat').onchange = renderExerciseList;

async function openExerciseForm(id){
  currentExerciseId = id;
  header.set({back:true,title:id?'Modifier':'Ajouter',ok:true});
  header.onBack(()=> back());
  header.onOk(async ()=>{
    const f = new FormData(qs('#exerciseForm'));
    const name = f.get('name')?.trim();
    const group3 = f.get('group3'); const equipment=f.get('equipment'); const desc=f.get('desc')||'';
    if(!name || !group3 || !equipment) return alert('Nom, groupe et matériel requis');
    const obj = {id: id||undefined, name, group3, equipment, desc};
    await db.put('exercises', obj);
    back(); openExercises();
  });
  qs('#exerciseDeleteRow').hidden = !id;
  qs('#btnDelExercise').onclick = async ()=>{
    if(confirm('Supprimer cet exercice ?')){
      await db.delete('exercises', id); back(); openExercises();
    }
  };
  const form = qs('#exerciseForm'); form.reset();
  if(id){
    const e = await db.get('exercises', id);
    form.name.value = e.name || '';
    form.group3.value = e.group3 || '';
    form.equipment.value = e.equipment || '';
    form.desc.value = e.desc || '';
  }
  showView('v-exercise-form');
}

/* ===== Routines (3.2) ===== */
async function openRoutines(){
  header.set({back:false,title:'Routines',ok:false});
  showView('v-routines',{push:false});
  renderRoutineList();
}
async function renderRoutineList(){
  const list = qs('#routineList'); list.innerHTML='';
  const q = qs('#searchRoutine').value.trim().toLowerCase();
  const t = qs('#fType').value;
  const routines = await db.getAll('routines');
  routines
    .filter(r=>!q || r.name.toLowerCase().includes(q))
    .filter(r=>!t || r.type===t)
    .forEach(r=>{
      const setsCount = (r.items||[]).reduce((a,m)=>a+(m.sets?.length||0),0);
      const li=document.createElement('li'); li.className='item'; li.dataset.id=r.id;
      li.innerHTML = `
        <button class="grab" aria-label="Réordonner">︙</button>
        <div class="grow">
          <div class="name">${r.name}</div>
          <div class="detail">${(r.items||[]).length} Exo. ${setsCount} Sets. ${r.groups||'—'}</div>
        </div>
        <button class="edit">✏️</button>
      `;
      li.onclick = ()=> openRoutineForm(r.id);
      list.appendChild(li);
    });
  enableReorder(list, async (_ids)=>{ /* si besoin : ordre global */ });
}
qs('#btnNewRoutine').onclick = ()=> openRoutineForm(null);
qs('#searchRoutine').oninput = renderRoutineList;
qs('#fType').onchange = renderRoutineList;

const state = { movementItems: [] };

async function openRoutineForm(id){
  currentRoutineId = id;
  header.set({back:true,title:id?'Modifier':'Ajouter',ok:true});
  header.onBack(()=> back());
  header.onOk(async ()=>{
    const f = new FormData(qs('#routineForm'));
    const name=f.get('name')?.trim(); if(!name) return alert('Nom requis');
    // recalcul groupes
    const groups = [...new Set((state.movementItems||[]).map(m=>m.group3).filter(Boolean))].join(', ');
    const obj = { id:id||undefined, name, type:f.get('type'), desc:f.get('desc')||'', items: state.movementItems||[], groups };
    await db.put('routines', obj);
    back(); openRoutines();
  });
  qs('#routineDeleteRow').hidden = !id;
  qs('#btnDelRoutine').onclick = async ()=>{
    if(confirm('Supprimer cette routine ?')){
      await db.delete('routines', id); back(); openRoutines();
    }
  };
  const form = qs('#routineForm'); form.reset();
  let routine = {name:'', type:'Général', desc:'', items:[]};
  if(id){ routine = await db.get('routines', id) || routine; }
  form.name.value = routine.name; form.type.value = routine.type; form.desc.value = routine.desc;
  state.movementItems = (routine.items||[]).map(x=>({...x}));
  renderMovementList();
  qs('#btnAddMovements').onclick = openAddMovements;
  showView('v-routine-form');
}
function renderMovementList(){
  const ul = qs('#movementList'); ul.innerHTML='';
  (state.movementItems||[]).forEach((m,idx)=>{
    const sets = m.sets?.length||0;
    const reps = (m.sets||[]).map(s=>s.repsDefault??0);
    const min = reps.length?Math.min(...reps):0;
    const max = reps.length?Math.max(...reps):0;
    const li=document.createElement('li'); li.className='item'; li.dataset.idx=idx;
    li.innerHTML = `
      <button class="grab" aria-label="Réordonner">︙</button>
      <div class="grow">
        <div class="name">${m.name || '(exercice supprimé)'}</div>
        <div class="detail">${sets} x ${min}-${max} Reps. ${m.group3||'—'}</div>
      </div>
      <button class="edit">✏️</button>
    `;
    li.onclick = ()=> editMovement(idx);
    ul.appendChild(li);
  });
  enableReorder(ul, (_ids, from, to)=>{
    const arr = state.movementItems; const [it]=arr.splice(from,1); arr.splice(to,0,it); renderMovementList();
  });
}
async function openAddMovements(){
  header.set({back:true,title:'Ajout d’exercices',ok:true});
  header.onBack(()=> back());
  header.onOk(()=>{
    const checked = qsa('#exercisePickList input[type=checkbox]:checked').map(x=>Number(x.value));
    addMovementsToRoutine(checked);
    back();
  });
  await renderExercisePickList();
  showView('v-add-movements');
}
async function renderExercisePickList(){
  const list = qs('#exercisePickList'); list.innerHTML='';
  const q = qs('#searchExoForRoutine').value.trim().toLowerCase();
  const grp = qs('#fGrp2').value; const mat = qs('#fMat2').value;
  const exos = await db.getAll('exercises');
  qs('#fGrp2').innerHTML = '<option value="">Groupe musculaire</option>'+[...new Set(exos.map(e=>e.group3).filter(Boolean))].map(g=>`<option>${g}</option>`).join('');
  qs('#fMat2').innerHTML = '<option value="">Matériel</option>'+[...new Set(exos.map(e=>e.equipment).filter(Boolean))].map(m=>`<option>${m}</option>`).join('');
  exos
    .filter(e=>!q || e.name.toLowerCase().includes(q))
    .filter(e=>!grp || e.group3===grp)
    .filter(e=>!mat || e.equipment===mat)
    .forEach(e=>{
      const li=document.createElement('li'); li.className='item';
      li.innerHTML = `
        <div class="thumb"></div>
        <div class="grow">
          <div class="name">${e.name}</div>
          <div class="detail">${e.group3} – ${e.equipment}</div>
        </div>
        <input type="checkbox" value="${e.id}">
      `;
      li.onclick = ev => { if(ev.target.tagName!=='INPUT') li.querySelector('input').click(); };
      list.appendChild(li);
    });
  qs('#searchExoForRoutine').oninput = renderExercisePickList;
  qs('#fGrp2').onchange = renderExercisePickList;
  qs('#fMat2').onchange = renderExercisePickList;
}
async function addMovementsToRoutine(exIds){
  const arr = state.movementItems||[];
  for(const id of exIds){
    const e = await db.get('exercises', id);
    if(!e) continue;
    if(arr.some(x=>x.exId===id)) continue;
    arr.push({ exId:id, name:e.name, group3:e.group3, sets:[{repsDefault:10, restDefault:60},{repsDefault:10, restDefault:60}] });
  }
  state.movementItems = arr;
  renderMovementList();
}
function editMovement(index){
  const m = state.movementItems[index];
  const add = confirm(`Ajouter une série à "${m.name}" ?`);
  if(add){ m.sets = (m.sets||[]).concat({repsDefault:10, restDefault:60}); renderMovementList(); }
}

/* ===== Plan (3.3) ===== */
async function openPlan(){
  header.set({back:false,title:'Plan',ok:false});
  showView('v-plan',{push:false});
  qs('#btnSetPlanStart').onclick = async ()=>{
    const d = prompt('Date de départ du plan (YYYY-MM-DD) :', (await db.get('settings','planStart'))?.value);
    if(!d) return;
    await db.put('settings',{key:'planStart', value:d});
    openPlan();
  };
  const ul = qs('#planList'); ul.innerHTML='';
  for(let day=1; day<=28; day++){
    const item = await db.get('plan', day);
    const li=document.createElement('li'); li.className='item';
    li.innerHTML = `
      <div class="grow">
        <div class="name">Jour ${day} — ${item?.name || 'Non défini'}</div>
        <div class="detail">${item?.groups || '—'}</div>
      </div>
      <button class="edit">✏️</button>
    `;
    li.onclick = async ()=>{
      const routines = await db.getAll('routines');
      const pick = prompt('Nom de routine (exact) :\n'+(routines.length? routines.map(r=>r.name).join('\n') : 'Aucune routine'));
      if(!pick) return;
      const r = routines.find(x=>x.name===pick);
      if(!r){ alert('Routine inconnue'); return; }
      await db.put('plan', {day, routineId:r.id, name:r.name, groups:r.groups||''});
      openPlan();
    };
    ul.appendChild(li);
  }
}

/* ===== Séances (3.4) ===== */
let selectedDate = new Date(); selectedDate.setHours(0,0,0,0);

function planRoutineForDate(dt, planStart, planMap){
  if(!planStart || planMap.length===0) return null;
  const days = Math.floor((dt - planStart)/(1000*3600*24));
  const idx = ((days % 28)+28)%28; // 0..27
  const dayNum = idx+1;
  return planMap.find(p=>p.day===dayNum) || null;
}
async function renderSessions(){
  const today = new Date(); today.setHours(0,0,0,0);
  qs('#todayLabel').textContent = new Intl.DateTimeFormat('fr-FR',{weekday:'long', day:'numeric', month:'short'}).format(selectedDate);

  // calendrier 3 semaines
  const cal = qs('#calendar'); cal.innerHTML='';
  const start = addDays(selectedDate, -7); // 21 jours
  const workouts = await db.getAll('workouts');
  const planStartStr = (await db.get('settings','planStart'))?.value;
  const planStart = planStartStr ? parseISO(planStartStr) : today;
  const planMap = await db.getAll('plan');

  for(let i=0;i<21;i++){
    const d = addDays(start, i);
    const div = document.createElement('div'); div.className='day';
    if(fmtDate(d)===fmtDate(today)) div.classList.add('today');
    if(fmtDate(d)===fmtDate(selectedDate)) div.classList.add('selected');
    // entraînement créé ?
    const hasW = workouts.some(w=>w.date===fmtDate(d));
    if(hasW) div.classList.add('has');
    // plan futur ?
    const p = planRoutineForDate(d, planStart, planMap);
    if(!hasW && p) div.classList.add('has');
    div.textContent = d.getDate();
    div.onclick = ()=>{ selectedDate=d; renderSessions(); };
    cal.appendChild(div);
  }

  // afficher exercices de la séance de la date
  const w = await db.get('workouts', fmtDate(selectedDate));
  renderSessionExercises(w);

  // “Ajouter <routine>” si plan + séance vide
  const planned = planRoutineForDate(selectedDate, planStart, planMap);
  const btnPlan = qs('#btnAddPlanned');
  if(planned && !w){
    btnPlan.disabled = false;
    btnPlan.textContent = `Ajouter ${planned.name}`;
    btnPlan.onclick = async ()=>{
      const routine = await db.get('routines', planned.routineId);
      if(!routine){ alert('Routine introuvable'); return; }
      const exos = (routine.items||[]).map(m=>({
        exId: m.exId, name:m.name,
        sets: (m.sets||[]).map(s=>({ plannedReps:s.repsDefault??0, plannedRest:s.restDefault??60, reps:null, weight:null, rpe:null, rest:s.restDefault??60 }))
      }));
      await db.put('workouts',{date:fmtDate(selectedDate), exercises:exos});
      renderSessions();
    };
  } else {
    btnPlan.disabled = true;
    btnPlan.textContent = 'Ajouter <routine>';
    btnPlan.onclick = null;
  }

  // “Ajouter une routine” sélecteur
  const pick = qs('#pickRoutine'); pick.innerHTML='';
  const listR = await db.getAll('routines');
  pick.appendChild(new Option('— Choisir une routine —',''));
  listR.forEach(r=> pick.appendChild(new Option(r.name, r.id)));
  pick.onchange = async ()=>{
    const id = Number(pick.value); if(!id) return;
    const routine = await db.get('routines', id);
    let cur = await db.get('workouts', fmtDate(selectedDate));
    if(!cur) cur = {date:fmtDate(selectedDate), exercises:[]};
    const exos = (routine.items||[]).map(m=>({
      exId: m.exId, name:m.name,
      sets: (m.sets||[]).map(s=>({ plannedReps:s.repsDefault??0, plannedRest:s.restDefault??60, reps:null, weight:null, rpe:null, rest:s.restDefault??60 }))
    }));
    cur.exercises = cur.exercises.concat(exos);
    await db.put('workouts', cur);
    pick.value='';
    renderSessions();
  };

  // “Ajouter exercice/s” depuis bibliothèque
  qs('#btnAddFromLibrary').onclick = async ()=>{
    // réutilise l’écran d’ajout de mouvements pour cocher des exos
    header.set({back:true,title:'Ajouter exercice/s',ok:true});
    header.onBack(()=> back());
    header.onOk(async ()=>{
      const checked = qsa('#exercisePickList input[type=checkbox]:checked').map(x=>Number(x.value));
      if(checked.length===0){ back(); return; }
      let cur = await db.get('workouts', fmtDate(selectedDate));
      if(!cur) cur = {date:fmtDate(selectedDate), exercises:[]};
      for(const id of checked){
        const e = await db.get('exercises', id);
        cur.exercises.push({ exId:id, name:e.name, sets:[] }); // séries vides
      }
      await db.put('workouts', cur);
      back(); renderSessions();
    });
    await renderExercisePickList();
    showView('v-add-movements');
  };
}
function renderSessionExercises(workout){
  const box = qs('#sessionExercises'); box.innerHTML='';
  if(!workout){ return; }
  workout.exercises.forEach((ex, idx)=>{
    // petite synthèse des séries (cases)
    const chips = (ex.sets||[]).map(s=>{
      const r = (s.reps!=null ? s.reps : (s.plannedReps ?? '—'));
      const w = (s.weight!=null ? s.weight : '—');
      const rp = (s.rpe!=null ? s.rpe : '•');
      return `<span class="chipset">${r}×${w} <sup>${rp}</sup></span>`;
    }).join(' ');
    const item = document.createElement('div'); item.className='item';
    item.innerHTML = `
      <div class="grow">
        <div class="name">${ex.name}</div>
        <div class="detail">${chips || 'Aucune série'}</div>
      </div>
      <button class="edit">✏️</button>
    `;
    item.onclick = ()=> openExecScreen(fmtDate(selectedDate), idx);
    box.appendChild(item);
  });
}

/* ===== Exec 3.4.2 ===== */
let execTimer = {remain:0, tick:null};
async function openExecScreen(dateStr, exIndex){
  const w = await db.get('workouts', dateStr);
  if(!w) return;
  const ex = w.exercises[exIndex];
  header.set({back:true,title:ex.name,ok:false});
  header.onBack(async ()=>{ back(); renderSessions(); });

  // Colonne gauche = aujourd'hui (édition)
  qs('#execDateA').textContent = new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'2-digit'}).format(parseISO(dateStr));
  const ulA = qs('#execToday'); ulA.innerHTML='';
  const sets = ex.sets||[];
  if(sets.length===0){
    // une ligne vide si rien n'est prévu
    sets.push({plannedReps:null, plannedRest:60, reps:null, weight:null, rpe:null, rest:60});
  }
  sets.forEach((s,i)=>{
    const li = document.createElement('li'); li.className='exec-row';
    li.innerHTML = `
      <input type="number" inputmode="numeric" placeholder="${s.plannedReps ?? ''}" value="${s.reps ?? ''}">
      <input type="number" inputmode="numeric" placeholder="kg" value="${s.weight ?? ''}">
      <input type="number" inputmode="numeric" placeholder="RPE" value="${s.rpe ?? ''}">
      <input type="number" inputmode="numeric" placeholder="${s.plannedRest ?? 60}" value="${s.rest ?? s.plannedRest ?? 60}">
    `;
    const [repsEl, wEl, rpeEl, restEl] = [...li.querySelectorAll('input')];
    repsEl.onchange = async ()=>{ s.reps = repsEl.value? Number(repsEl.value):null; await db.put('workouts', w); };
    wEl.onchange    = async ()=>{ s.weight = wEl.value? Number(wEl.value):null; await db.put('workouts', w); };
    rpeEl.onchange  = async ()=>{ s.rpe = rpeEl.value? Number(rpeEl.value):null; await db.put('workouts', w); };
    restEl.onchange = async ()=>{ s.rest = restEl.value? Number(restEl.value):null; await db.put('workouts', w); };
    // appui "Enter" dans le champ rest => enregistre + lance minuteur + ajoute série suivante
    restEl.addEventListener('keydown', async ev=>{
      if(ev.key==='Enter'){
        ev.preventDefault();
        s.rest = restEl.value? Number(restEl.value): (s.plannedRest ?? 60);
        await db.put('workouts', w);
        startTimer(s.rest || 60);
        // ajoute une ligne suivante vide automatiquement
        if(i===sets.length-1){
          sets.push({plannedReps:s.plannedReps ?? null, plannedRest:s.plannedRest ?? s.rest ?? 60, reps:null, weight:null, rpe:null, rest:s.rest ?? 60});
          await db.put('workouts', w);
          openExecScreen(dateStr, exIndex); // refresh
        }
      }
    });
    ulA.appendChild(li);
  });

  qs('#btnDelLastSet').onclick = async ()=>{
    if(ex.sets && ex.sets.length>0){
      ex.sets.pop();
      await db.put('workouts', w);
      openExecScreen(dateStr, exIndex);
    }
  };

  // Colonne droite = précédente (lecture seule)
  const allW = await db.getAll('workouts');
  const prev = allW
    .filter(x=>x.date < dateStr)
    .sort((a,b)=>a.date.localeCompare(b.date))
    .reverse()
    .find(x=> (x.exercises||[]).some(e=>e.exId===ex.exId));
  const ulB = qs('#execPrev'); ulB.innerHTML='';
  if(prev){
    qs('#execDateB').textContent = new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'2-digit'}).format(parseISO(prev.date));
    const exPrev = prev.exercises.find(e=>e.exId===ex.exId);
    (exPrev.sets||[]).forEach(s=>{
      const li = document.createElement('li'); li.className='exec-row';
      li.innerHTML = `
        <input value="${s.reps ?? ''}"><input value="${s.weight ?? ''}"><input value="${s.rpe ?? ''}"><input value="${s.rest ?? ''}">
      `;
      ulB.appendChild(li);
    });
  } else {
    qs('#execDateB').textContent = '—';
  }

  // bandeau : objectif/record (placeholders)
  qs('#execGoal').textContent = 'Objectif : —';
  qs('#execRecord').textContent = 'Record : —';

  // timer
  qs('#tMinus').onclick = ()=> startTimer(Math.max(0, execTimer.remain-10));
  qs('#tPlus').onclick = ()=> startTimer(execTimer.remain+10);

  showView('v-exec');
}
function startTimer(seconds){
  execTimer.remain = seconds|0;
  updateTimerLabel();
  if(execTimer.tick) clearInterval(execTimer.tick);
  execTimer.tick = setInterval(()=>{
    execTimer.remain--;
    updateTimerLabel();
    if(execTimer.remain<=0){
      clearInterval(execTimer.tick); execTimer.tick=null;
      if('vibrate' in navigator) navigator.vibrate?.(200);
    }
  },1000);
}
function updateTimerLabel(){
  qs('#tDisplay').textContent = `${pad(Math.floor(execTimer.remain/60))}:${pad(execTimer.remain%60)}`;
}

/* ===== Stats/Objectifs/Settings (light) ===== */
function openGoals(){ header.set({back:false,title:'Objectifs',ok:false}); showView('v-goals',{push:false}); }
function openStatsGeneral(){ header.set({back:false,title:'Général',ok:false}); showView('v-stats-general',{push:false}); }
function openStatsProgress(){ header.set({back:false,title:'Progrès',ok:false}); showView('v-stats-progress',{push:false}); }
function openSettings(){
  header.set({back:false,title:'Réglages',ok:false});
  alert('Réglages: thème & préférences à brancher (stockées dans IndexedDB).'); // placeholder visuel
}

/* ===== démarrage ===== */
(async function start(){
  await ensureSeed();
  header.set({back:false,title:'Séances',ok:false});
  showView('v-sessions',{push:false});
  renderSessions();

  if('serviceWorker' in navigator){
    try { await navigator.serviceWorker.register('./sw.js?v=6'); } catch(e){}
  }

  // actions de la barre d’onglets secondaires au besoin
})();
