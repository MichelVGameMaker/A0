// ui-session.js — liste de la séance du jour + ajouts (2 lignes)

(function(){
  const A = window.App;

  // Donne l'id de la routine prévue pour une date (via plan actif), sinon null
  A.getPlannedRoutineId = async function(date){
    const plan = await db.getActivePlan();
    if (!plan) return null;
    const wd = (date.getDay() + 6) % 7 + 1; // 1..7 (lun..dim)
    return plan.days?.[String(wd)] || null;
  };

  // Remplit le sélecteur avec la routine prévue en premier (pré-sélectionnée), puis les autres
  A.populateRoutineSelect = async function populateRoutineSelect(){
    const sel = A.el.selectRoutine;
    const all = await db.getAll('routines');
    const plannedId = await A.getPlannedRoutineId(A.activeDate);

    // Réinitialise
    sel.innerHTML = `<option value="">Ajouter une routine…</option>`;

    // Construit la liste : [planned en 1er si existe] + autres (sans doublon)
    const ordered = [];
    if (plannedId) {
      const p = all.find(r => r.id === plannedId);
      if (p) ordered.push(p);
    }
    for (const r of all) {
      if (!ordered.some(o => o.id === r.id)) ordered.push(r);
    }

    // Injecte options
    for (const r of ordered) {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    }

    // Sélection par défaut = routine prévue du jour si existe, sinon placeholder
    sel.value = plannedId || '';
  };

  // Rendu de la séance du jour
  A.renderSession = async function renderSession(){
    A.el.todayLabel.textContent = A.fmtUI(A.activeDate);

    const key = A.ymd(A.activeDate);
    const session = await db.getSession(key);
    const list = A.el.sessionList;
    list.innerHTML = '';

    if (!(session?.exercises?.length)) {
      list.innerHTML = `<div class="empty">Aucun exercice pour cette date.</div>`;
      return;
    }

    for (const ex of session.exercises) {
      const card = document.createElement('article'); card.className='exercise-card';

      const top  = document.createElement('div'); top.className='row between';
      const name = document.createElement('div'); name.className='element'; name.textContent = ex.exerciseName;
      const btn  = document.createElement('button'); btn.className='btn'; btn.textContent='Répétitions ✏️';
      btn.addEventListener('click', ()=>A.openExecEdit(ex.exerciseId));
      top.append(name, btn); card.appendChild(top);

      const grid = document.createElement('div'); grid.className='set-grid';
      for (const s of ex.sets) {
        const cell = document.createElement('div'); cell.className='set-cell';
        const reps = s.reps ?? 0;
        const w    = s.weight ?? 0;
        const rpeSmall = s.rpe ? `<sup>${s.rpe}</sup>` : '';
        cell.innerHTML = `<span class="details">${reps}×${w} kg ${rpeSmall}</span>`;
        grid.appendChild(cell);
      }
      card.appendChild(grid);

      card.addEventListener('click', ()=>btn.click());
      list.appendChild(card);
    }
  };
  
// === Ajout d'exercices sélectionnés à la séance courante ===
A.addExercisesToCurrentSession = async function addExercisesToCurrentSession(ids){
  if (!Array.isArray(ids) || !ids.length) return;

  const key = A.ymd(A.activeDate);
  let s = await db.getSession(key) || { date:key, exercises:[] };

  // Construire un set des exercices déjà présents pour éviter les doublons
  const existing = new Set((s.exercises || []).map(e => e.exerciseId));

  for (const id of ids){
    if (existing.has(id)) continue; // skip doublons
    const ex = await db.get('exercises', id);
    if (!ex) continue;

    s.exercises.push({
      pos: (s.exercises?.length || 0) + 1,
      exerciseId: ex.id,
      exerciseName: ex.name || 'Exercice',
      // une ligne de set vide par défaut (tu peux adapter)
      sets: [{ pos:1, reps:null, weight:null, rpe:null, rest:null, done:false }]
    });
  }

  await db.saveSession(s);
  await A.renderWeek?.();
  await A.renderSession?.();
};



  // Ajouter la routine choisie (sélecteur) à la séance
  A.addRoutineToSession = async function addRoutineToSession(routineId){
    const r = await db.get('routines', routineId);
    if (!r) return;
    const key = A.ymd(A.activeDate);
    let s = await db.getSession(key) || { date:key, exercises:[] };

    for (const m of r.moves) {
      if (s.exercises.some(e => e.exerciseId === m.exerciseId)) continue;
      s.exercises.push({
        pos: s.exercises.length+1,
        exerciseId: m.exerciseId,
        exerciseName: m.exerciseName,
        sets: m.sets.map(x=>({ pos:x.pos, reps:x.reps ?? null, weight:null, rpe:null, rest:x.rest ?? null, done:false }))     
      });
    }
    await db.saveSession(s);
    await A.populateRoutineSelect(); // garder la cohérence du sélecteur
    await A.renderWeek();
    await A.renderSession();
  };


  // === Init refs & handlers ===
  document.addEventListener('DOMContentLoaded', ()=>{
    A.el = A.el || {};
    A.el.btnAddExercises = document.getElementById('btnAddExercises');
    A.el.selectRoutine   = document.getElementById('selectRoutine');
    A.el.todayLabel      = document.getElementById('todayLabel');
    A.el.sessionList     = document.getElementById('sessionList');

    // Ouvrir la bibliothèque en MODE AJOUT depuis l'écran Séance
    A.el.btnAddExercises?.addEventListener('click', ()=>{
      A.openExercises({
        mode: 'add',
        from: 'screenSessions',
        onAdd: async (ids)=> {
          await A.addExercisesToCurrentSession(ids);
          // Le retour visuel à l'écran Séance est géré côté ui-exercices_list
        }
      });
    });
  });
  
  
})();
