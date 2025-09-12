// ui-exec-edit.js — 3.4.2 Modifier l’exécution (Colonne A, édition avancée + timer)
(function(){
  const A = window.App;

  // Contexte courant
  A.execCtx = { dateKey:null, exerciseId:null, exerciseName:'' };

  // État du timer
  A.execTimer = { running:false, startSec:0, remainSec:0, iv:null };

  // Ouvrir l’éditeur
  A.openExecEdit = async function(exerciseId){
    const key = A.ymd(A.activeDate);
    const s = await db.getSession(key);
    if (!s) return alert('Aucune séance pour cette date.');
    const ex = s.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) return alert('Exercice introuvable dans la séance.');

    // normaliser sets
    ex.sets = (ex.sets||[]).map((x,i)=>({
      pos: x.pos ?? (i+1),
      done: !!x.done,
      reps: x.reps ?? null,
      weight: x.weight ?? null,
      rpe: x.rpe ?? null,
      rest: x.rest ?? 90
    }));

    A.execCtx = { dateKey:key, exerciseId, exerciseName: ex.exerciseName||'' };

    // entête
    document.getElementById('execTitle').textContent = ex.exerciseName || 'Exercice';
    document.getElementById('execDate').textContent  = A.fmtUI(A.activeDate);

    await renderColumnA();

    // afficher écran
    document.getElementById('screenSessions').hidden = true;
    document.getElementById('screenExercises').hidden = true;
    document.getElementById('screenExerciseEdit').hidden = true;
    document.getElementById('screenExecEdit').hidden = false;
  };

  // -------- Rendu Colonne A --------
  async function renderColumnA(editPos=null){
    const s  = await db.getSession(A.execCtx.dateKey);
    const ex = s?.exercises.find(e=>e.exerciseId===A.execCtx.exerciseId);
    if (!ex) return;

    const wrapExec = document.getElementById('execExecuted');
    const wrapEdit = document.getElementById('execEditable');
    wrapExec.innerHTML = '';
    wrapEdit.innerHTML = '';

    // 1) Lignes lues (cliquables pour éditer)
    for (const it of ex.sets) {
      if (editPos===it.pos) {
        wrapEdit.appendChild(rowEditable(it, false));
      } else {
        const row = rowReadOnly(it);
        row.addEventListener('click', ()=> renderColumnA(it.pos)); // ✅ éditer en cliquant
        wrapExec.appendChild(row);
      }
    }

    // 2) Si aucune ligne en édition ET il reste des prévues, éditer la première prévue
    if (!wrapEdit.children.length) {
      const firstPlanned = ex.sets.find(x=>x.done!==true);
      if (firstPlanned) wrapEdit.appendChild(rowEditable(firstPlanned, false));
    }

    // 3) Bouton Ajouter → nouvelle ligne vide en édition
    document.getElementById('execAddNew').onclick = ()=>{
      wrapEdit.innerHTML = '';
      wrapEdit.appendChild(rowEditable(defaultNewSet(ex.sets.length+1), true));
    };

    // 4) Bouton OK (valider & retour séance)
    document.getElementById('execOk').onclick = async ()=>{
      const saveBtn = document.querySelector('#execEditable .js-save');
      if (saveBtn) await saveBtn.click(); // valide si un éditeur est ouvert
      backToSessions();
    };

    // 5) Barre timer : masquée tant que non lancée
    updateTimerUI();
  }

  function rowReadOnly(it){
    const r = document.createElement('div');
    r.className = 'exec-grid exec-row';
    r.innerHTML = `
      <div class="details">${safeInt(it.reps)}</div>
      <div class="details">${safeInt(it.weight)} kg</div>
      <div class="details">${rpeChip(it.rpe)}</div>
      <div class="details">${fmtTime(safeInt(it.rest))}</div>
      <div></div>
    `;
    return r;
  }

  function rowEditable(it, isNew){
    const r = document.createElement('div');
    r.className = 'exec-grid exec-row';

    // Stepper Reps
    const reps = stepper(safeInt(it.reps), 0, 100);
    // Stepper Weight
    const weight = stepper(safeInt(it.weight), 0, 999);
    // RPE (5..10, couleur)
    const rpeWrap = document.createElement('div');
    const rpe = document.createElement('input');
    rpe.type='number'; rpe.className='input'; rpe.min='5'; rpe.max='10'; rpe.inputMode='numeric';
    rpe.value = it.rpe==null ? '' : String(it.rpe);
    rpe.oninput = ()=>{ rpeWrap.dataset.rpe = clampInt(rpe.value,5,10) || ''; };
    rpeWrap.appendChild(rpe); rpeWrap.className='rpe-wrap';

    // Rest (mm:ss)
    const rest = document.createElement('input');
    rest.type='text'; rest.className='input'; rest.placeholder='mm:ss';
    rest.value = fmtTime(safeInt(it.rest)); rest.pattern='^\\d{1,2}:\\d{2}$';

    // Actions
    const btn = document.createElement('button');
    btn.className = 'btn js-save';
    btn.textContent = isNew ? 'Ajouter' : 'Enregistrer';

    btn.onclick = async ()=>{
      const val = {
        reps: parseInt(reps.input.value||'0',10),
        weight: parseInt(weight.input.value||'0',10),
        rpe: rpe.value ? parseInt(rpe.value,10) : null,
        rest: parseTime(rest.value)
      };
      const s = await db.getSession(A.execCtx.dateKey);
      const ex = s.exercises.find(e => e.exerciseId === A.execCtx.exerciseId);

      if (isNew) {
        ex.sets.push({ pos: ex.sets.length+1, ...val, done:true });
      } else {
        const idx = ex.sets.findIndex(x => x.pos===it.pos);
        if (idx>=0) ex.sets[idx] = { ...ex.sets[idx], ...val, done:true };
      }

      await db.saveSession(s);

      // ✅ lancer le timer pour la DERNIÈRE série (celle qu’on vient d’enregistrer)
      startTimer(val.rest);

      await renderColumnA(); // re-render (retour en lecture seule)
    };

    r.append(reps.el, weight.el, rpeWrap, rest, btn);
    return r;
  }

  function defaultNewSet(pos){
    return { pos, reps:8, weight:0, rpe:null, rest:90, done:false };
  }

  // ---- UI helpers ----
  function stepper(val, min, max){
    const wrap = document.createElement('div'); wrap.className='stepper';
    const minus = document.createElement('button'); minus.className='btn'; minus.textContent='−';
    const input = document.createElement('input'); input.type='number'; input.className='input'; input.inputMode='numeric'; input.value=String(val); input.min=String(min); input.max=String(max);
    const plus  = document.createElement('button'); plus.className='btn'; plus.textContent='+';
    minus.onclick = ()=>{ input.value = String(Math.max(min, (parseInt(input.value||'0',10)-1))); };
    plus.onclick  = ()=>{ input.value = String(Math.min(max, (parseInt(input.value||'0',10)+1))); };
    wrap.append(minus, input, plus);
    return { el:wrap, input };
  }

  function rpeChip(v){
    if (v==null || v==='') return '—';
    const c = getRpeClass(v);
    return `<span class="rpe-chip ${c}">${v}</span>`;
  }
  function getRpeClass(v){
    const n = parseInt(v,10);
    if (n<=5) return 'rpe-5';
    if (n===6) return 'rpe-6';
    if (n===7) return 'rpe-7';
    if (n===8) return 'rpe-8';
    if (n===9) return 'rpe-9';
    return 'rpe-10';
  }

  function safeInt(v){ return Number.isFinite(v) ? v : 0; }
  function clampInt(v, min, max){
    const n = parseInt(v,10); if (Number.isNaN(n)) return null;
    return Math.max(min, Math.min(max, n));
  }
  function fmtTime(sec){
    sec = parseInt(sec||0,10);
    const m = Math.floor(Math.abs(sec)/60), s = Math.abs(sec)%60;
    const sign = sec<0 ? '-' : '';
    return `${sign}${m}:${String(s).padStart(2,'0')}`;
  }
  function parseTime(str){
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(str||''));
    if (!m) return 0;
    return parseInt(m[1],10)*60 + parseInt(m[2],10);
  }

  // ---- Timer ----
  function startTimer(startSec){
    const bar = document.getElementById('execTimerBar');
    A.execTimer.startSec  = startSec || 0;
    A.execTimer.remainSec = startSec || 0;
    A.execTimer.running   = true;
    bar.hidden = false;
    runTick();
    if (A.execTimer.iv) clearInterval(A.execTimer.iv);
    A.execTimer.iv = setInterval(runTick, 1000);
    updateTimerUI();
  }
  function pauseTimer(){ A.execTimer.running = false; updateTimerUI(); }
  function resumeTimer(){ A.execTimer.running = true;  updateTimerUI(); }
  function stopTimer(){ if (A.execTimer.iv) clearInterval(A.execTimer.iv); A.execTimer.iv=null; A.execTimer.running=false; }

  function runTick(){
    if (!A.execTimer.running) return;
    A.execTimer.remainSec -= 1;
    updateTimerUI();
    if (A.execTimer.remainSec === 0) {
      if (navigator.vibrate) { try { navigator.vibrate(200); } catch{} }
    }
  }

  async function adjustTimer(delta){
    // delta en secondes (+/-10)
    A.execTimer.startSec  += delta;
    A.execTimer.remainSec += delta;

    // ✅ et on ajuste le "rest" de la dernière série (en cours de repos)
    const s  = await db.getSession(A.execCtx.dateKey);
    const ex = s.exercises.find(e=>e.exerciseId===A.execCtx.exerciseId);
    if (ex && ex.sets.length){
      const last = ex.sets[ex.sets.length-1];
      last.rest = Math.max(0, (last.rest||0) + delta);
      await db.saveSession(s);
      await renderColumnA(); // refléter le nouveau repos
    }
    updateTimerUI();
  }

  async function nextTimer(){
    // ✅ enregistre le temps écoulé sur la DERNIÈRE série
    const elapsed = A.execTimer.startSec - A.execTimer.remainSec;
    const s  = await db.getSession(A.execCtx.dateKey);
    const ex = s.exercises.find(e=>e.exerciseId===A.execCtx.exerciseId);
    if (ex && ex.sets.length){
      const last = ex.sets[ex.sets.length-1];
      last.rest = Math.max(0, elapsed);
      await db.saveSession(s);
      await renderColumnA();
    }
    stopTimer();
    updateTimerUI(); // peut masquer la barre
  }

  function updateTimerUI(){
    const bar = document.getElementById('execTimerBar');
    const disp= document.getElementById('tmrDisplay');
    const tgl = document.getElementById('tmrToggle');
    if (!bar) return;

    // Si jamais aucun timer lancé
    if (!A.execTimer.iv && !A.execTimer.running && A.execTimer.startSec===0){
      bar.hidden = true;
      return;
    }
    bar.hidden = false;

    const t = A.execTimer.remainSec;
    const sign = t<0 ? '-' : '';
    const abs = Math.abs(t);
    const m = Math.floor(abs/60), s = abs%60;
    disp.textContent = `${sign}${m}:${String(s).padStart(2,'0')}`;

    tgl.textContent = A.execTimer.running ? '⏸' : '▶︎';
  }

  // ---- Navigation ----
  function backToSessions(){
    document.getElementById('screenExecEdit').hidden = true;
    document.getElementById('screenSessions').hidden = false;
    A.renderWeek().then(()=>A.renderSession());
  }

  // ---- Wire global ----
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('execBack')?.addEventListener('click', backToSessions);

    document.getElementById('tmrToggle')?.addEventListener('click', ()=>{
      if (A.execTimer.running) pauseTimer(); else resumeTimer();
    });
    document.getElementById('tmrMinus')?.addEventListener('click', ()=>adjustTimer(-10));
    document.getElementById('tmrPlus') ?.addEventListener('click', ()=>adjustTimer(+10));
    document.getElementById('tmrNext') ?.addEventListener('click', ()=>nextTimer());
  });
})();
