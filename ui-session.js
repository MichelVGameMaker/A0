// ui-session.js — liste de la séance du jour + ajouts

(async function(){
  const A = window.App;

  A.refreshPlannedRoutineName = async function(){
    const plan = await db.getActivePlan();
    A.plannedRoutineName = null;
    if (plan) {
      const wd = (A.activeDate.getDay() + 6) % 7 + 1; // 1..7
      const rid = plan.days[String(wd)];
      if (rid) {
        const r = await db.get('routines', rid);
        A.plannedRoutineName = r?.name || null;
      }
    }
    const btn = A.el.btnAddPlanned;
    if (A.plannedRoutineName) { btn.textContent = `Ajouter ${A.plannedRoutineName}`; btn.disabled = false; }
    else { btn.textContent = 'Ajouter <routine>'; btn.disabled = true; }
  };

  A.populateRoutineSelect = async function(){
    const sel = A.el.selectRoutine;
    const all = await db.getAll('routines');
    sel.innerHTML = `<option value="">Ajouter une routine…</option>`;
    for (const r of all) {
      const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; sel.appendChild(o);
    }
  };

  A.renderSession = async function(){
    A.el.todayLabel.textContent = A.fmtUI(A.activeDate);

    const key = A.ymd(A.activeDate);
    const session = await db.getSession(key);
    const hasEx = session?.exercises?.length > 0;

    // Règle: "Ajouter <routine>" disparaît dès qu'il y a des exos
    A.el.btnAddPlanned.style.display = (A.plannedRoutineName && !hasEx) ? 'block' : 'none';

    const list = A.el.sessionList;
    list.innerHTML = '';
    if (!hasEx) {
      list.innerHTML = `<div class="empty">Aucun exercice pour cette date.</div>`;
      return;
    }

    for (const ex of session.exercises) {
      const card = document.createElement('article'); card.className='exercise-card';

      const top = document.createElement('div'); top.className='row between';
      const name = document.createElement('div'); name.className='element'; name.textContent = ex.exerciseName;
      const btn  = document.createElement('button'); btn.className='btn'; btn.textContent='Répétitions ✏️';
      btn.addEventListener('click', ()=>alert('Écran 3.4.2 “Modifier l’exécution” viendra après.'));
      top.append(name, btn); card.appendChild(top);

      const grid = document.createElement('div'); grid.className='set-grid';
      for (const s of ex.sets) {
        const cell = document.createElement('div'); 
        cell.className='set-cell';
        const reps = s.reps ?? 0, w = s.weight ?? 0, rpe = s.rpe ? `<sup>${s.rpe}</sup>`:'';
        cell.innerHTML = `<span class="details">${reps}×${w} kg ${rpe}</span>`;

        grid.appendChild(cell);
      }
      card.appendChild(grid);

      card.addEventListener('click', ()=>btn.click());
      list.appendChild(card);
    }
  };

  A.addRoutineToSession = async function(routineId){
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
        sets: m.sets.map(x=>({ pos:x.pos, reps:x.reps ?? null, weight:null, rpe:null, rest:x.rest ?? null }))
      });
    }
    await db.saveSession(s);
    await A.refreshPlannedRoutineName();
    await A.renderWeek();
    await A.renderSession();
  };

})();
