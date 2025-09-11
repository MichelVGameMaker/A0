// ui-exec-edit.js — 3.4.2 Modifier l’exécution (Colonne A uniquement)

(function(){
  const A = window.App;

  // Contexte courant de l'éditeur
  A.execCtx = { dateKey: null, exerciseId: null, exerciseName: '' };

  // Ouvrir l’éditeur pour un exercice donné à la date active
  A.openExecEdit = async function(exerciseId){
    const key = A.ymd(A.activeDate);
    const s = await db.getSession(key);
    if (!s) return alert('Aucune séance pour cette date.');
    const ex = s.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) return alert('Exercice introuvable dans la séance.');

    // migration légère : ajout du flag done si manquant
    ex.sets = (ex.sets || []).map((x,i)=>({ done:false, ...x, pos: x.pos ?? (i+1) }));

    A.execCtx = { dateKey: key, exerciseId, exerciseName: ex.exerciseName || '' };

    // UI
    document.getElementById('execTitle').textContent = ex.exerciseName || 'Exercice';
    document.getElementById('execDate').textContent = A.fmtUI(A.activeDate);

    await renderColumnA();
    // Affiche l’écran
    document.getElementById('screenSessions').hidden = true;
    document.getElementById('screenExercises').hidden = true;
    document.getElementById('screenExerciseEdit').hidden = true;
    document.getElementById('screenExecEdit').hidden = false;
  };

  // Rendu Colonne A (Aujourd’hui — saisie)
  async function renderColumnA(){
    const s = await db.getSession(A.execCtx.dateKey);
    if (!s) return;
    const ex = s.exercises.find(e => e.exerciseId === A.execCtx.exerciseId);
    if (!ex) return;

    const executedWrap = document.getElementById('execExecuted');
    const editableWrap = document.getElementById('execEditable');
    executedWrap.innerHTML = '';
    editableWrap.innerHTML = '';

    // Spliter exécutées vs prévues (non exécutées)
    const executed = ex.sets.filter(x => x.done === true);
    const planned  = ex.sets.filter(x => x.done !== true);

    // 1) Séries exécutées : liste en lecture seule
    for (const it of executed) {
      executedWrap.appendChild(rowReadOnly(it));
    }

    // 2) Zone éditable :
    //    - s'il reste des prévues, on n'édite QUE la première
    //    - sinon on propose une "Nouvelle série"
    if (planned.length) {
      editableWrap.appendChild(rowEditable(planned[0], /*isNew*/false));
    } else {
      editableWrap.appendChild(rowEditable(defaultNewSet(), /*isNew*/true));
    }

    // Bouton "Supprimer la dernière série"
    const btnDel = document.getElementById('execDeleteLast');
    btnDel.onclick = async ()=>{
      const s2 = await db.getSession(A.execCtx.dateKey);
      const ex2 = s2.exercises.find(e => e.exerciseId === A.execCtx.exerciseId);
      if (!ex2 || !ex2.sets.length) return;
      if (!confirm('Supprimer la dernière série ?')) return;
      ex2.sets.pop();
      await db.saveSession(s2);
      await renderColumnA();
    };
  }

  function rowReadOnly(it){
    const r = document.createElement('div');
    r.className = 'exec-grid exec-row';
    r.innerHTML = `
      <div class="details">${safeInt(it.reps)}</div>
      <div class="details">${safeInt(it.weight)} kg</div>
      <div class="details">${safeInt(it.rpe) || '—'}</div>
      <div class="details">${fmtRest(it.rest)}</div>
      <div></div>
    `;
    return r;
  }

  function rowEditable(it, isNew){
    const r = document.createElement('div');
    r.className = 'exec-grid exec-row';

    const reps = inputNumber(safeInt(it.reps), 0, 100);
    const weight = inputNumber(safeInt(it.weight), 0, 999);
    const rpe = inputNumber(it.rpe ?? null, 5, 10, true); // autorise vide
    const rest = inputTime(safeInt(it.rest) || 90); // secondes

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = isNew ? 'Ajouter' : 'Enregistrer';

    saveBtn.onclick = async ()=>{
      const val = {
        reps: parseInt(reps.value||'0',10),
        weight: parseInt(weight.value||'0',10),
        rpe: rpe.value ? parseInt(rpe.value,10) : null,
        rest: parseTime(rest.value) // mm:ss -> sec
      };

      const s = await db.getSession(A.execCtx.dateKey);
      const ex = s.exercises.find(e => e.exerciseId === A.execCtx.exerciseId);

      if (isNew) {
        ex.sets.push({
          pos: ex.sets.length+1,
          reps: val.reps, weight: val.weight, rpe: val.rpe, rest: val.rest,
          done: true
        });
      } else {
        // marquer la première prévue comme exécutée
        const idx = ex.sets.findIndex(x => x.done !== true);
        if (idx >= 0) {
          ex.sets[idx] = { ...ex.sets[idx], ...val, done: true };
        } else {
          // fallback
          ex.sets.push({
            pos: ex.sets.length+1, ...val, done: true
          });
        }
      }

      await db.saveSession(s);
      await renderColumnA();
      // (Timer à ajouter plus tard)
    };

    r.append(reps, weight, rpe, rest, saveBtn);
    return r;
  }

  function defaultNewSet(){
    return { reps: 8, weight: 0, rpe: null, rest: 90, done:false };
  }

  // Inputs helpers
  function inputNumber(val, min, max, allowEmpty=false){
    const i = document.createElement('input');
    i.type = 'number';
    i.className = 'input';
    i.inputMode = 'numeric';
    if (!allowEmpty) i.value = String(val ?? 0);
    else i.value = val==null ? '' : String(val);
    i.min = String(min); i.max = String(max);
    return i;
  }
  function inputTime(sec){
    const i = document.createElement('input');
    i.type = 'text';
    i.className = 'input';
    i.placeholder = 'mm:ss';
    i.value = fmtTime(sec);
    i.pattern = '^\\d{1,2}:\\d{2}$';
    return i;
  }

  // Formats
  function safeInt(v){ return Number.isFinite(v) ? v : 0; }
  function fmtRest(sec){ return fmtTime(sec||0); }
  function fmtTime(sec){
    sec = parseInt(sec||0,10);
    const m = Math.floor(sec/60), s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }
  function parseTime(str){
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(str||''));
    if (!m) return 0;
    return parseInt(m[1],10)*60 + parseInt(m[2],10);
  }

  // Back button : enregistre déjà fait à chaque clic sur "Enregistrer/Ajouter"
  document.addEventListener('DOMContentLoaded', ()=>{
    const back = document.getElementById('execBack');
    if (back) back.addEventListener('click', async ()=>{
      // retour à l’écran Séances
      document.getElementById('screenExecEdit').hidden = true;
      document.getElementById('screenSessions').hidden = false;
      await A.renderWeek();
      await A.renderSession();
    });
  });

})();
