// ui-exec-edit.js — 3.4.2 (Colonne A) : édition + timer, sans bouton "Enregistrer"
// - Lignes cliquables pour éditer
// - Reps/Poids: stepper vertical (+ au-dessus / − au-dessous)
// - Bouton bas unique "Repos" <-> "Reprendre une série"
// - Timer en bas (pause/play, -10s / affichage / +10s), visible uniquement pendant le repos

(function(){
  const A = window.App;

  // Contexte courant
  A.execCtx = { dateKey:null, exerciseId:null, exerciseName:'' };

  // État du timer
  A.execTimer = { running:false, startSec:0, remainSec:0, iv:null };

  // -------- Ouvrir l’éditeur --------
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
        row.addEventListener('click', ()=> renderColumnA(it.pos)); // éditer en cliquant
        wrapExec.appendChild(row);
      }
    }

    // 2) Si aucune ligne en édition ET il reste des prévues, éditer la première prévue
    if (!wrapEdit.children.length) {
      const firstPlanned = ex.sets.find(x=>x.done!==true);
      if (firstPlanned) wrapEdit.appendChild(rowEditable(firstPlanned, false));
    }

    // 3) Bouton bas : Repos <-> Reprendre une série
    const restBtn = document.getElementById('execRestToggle');
    restBtn.onclick = async ()=>{
      const timerVisible = !document.getElementById('execTimerBar').hidden;

      if (!timerVisible) {
        // --- REPOS ---
        // Sauver la série en cours (ligne éditable) comme done:true
        const holder = document.querySelector('#execEditable .js-edit-holder');
        if (!holder || !holder._collect) return alert('Renseigne la série avant le repos.');
        const payload = JSON.parse(holder.dataset.payload || '{}');
        const val = holder._collect();

        const s1 = await db.getSession(A.execCtx.dateKey);
        const ex1 = s1.exercises.find(e => e.exerciseId===A.execCtx.exerciseId);
        if (payload.isNew) {
          ex1.sets.push({ pos: ex1.sets.length+1, ...val, done:true });
        } else {
          const idx = ex1.sets.findIndex(x=>x.pos===payload.pos);
          if (idx>=0) ex1.sets[idx] = { ...ex1.sets[idx], ...val, done:true };
        }
        await db.saveSession(s1);
        await renderColumnA(); // repasser en lecture seule

        // Démarrer le timer à partir de ce "rest"
        startTimer(val.rest);
        restBtn.textContent = 'Reprendre une série';
      } else {
        // --- REPRENDRE UNE SÉRIE ---
        // Stopper & masquer le timer, et ENREGISTRER LE TEMPS RESTANT dans la DERNIÈRE série
        const remaining = A.execTimer.remainSec; // demande: "enregistrer le temps restant"
        const s2 = await db.getSession(A.execCtx.dateKey);
        const ex2 = s2.exercises.find(e => e.exerciseId===A.execCtx.exerciseId);
        if (ex2 && ex2.sets.length) {
          const last = ex2.sets[ex2.sets.length-1];
          last.rest = Math.max(0, remaining);
          await db.saveSession(s2);
          await renderColumnA();
        }
        stopTimer();
        updateTimerUI(); // cache la barre
        restBtn.textContent = 'Repos';

        // Créer une nouvelle ligne vide en édition
        const s3  = await db.getSession(A.execCtx.dateKey);
        const ex3 = s3.exercises.find(e=>e.exerciseId===A.execCtx.exerciseId);
        const nextPos = (ex3?.sets.length || 0) + 1;
        wrapEdit.innerHTML = '';
        wrapEdit.appendChild(rowEditable(defaultNewSet(nextPos), true));
      }
    };

    // 4) Bouton OK (valider ce qui est en cours puis retour Séances)
    document.getElementById('execOk').onclick = async ()=>{
      const holder = document.querySelector('#execEditable .js-edit-holder');
      if (holder && holder._collect) {
        const payload = JSON.parse(holder.dataset.payload || '{}');
        const val = holder._collect();

        const s4 = await db.getSession(A.execCtx.dateKey);
        const ex4 = s4.exercises.find(e => e.exerciseId===A.execCtx.exerciseId);
        if (payload.isNew) {
          ex4.sets.push({ pos: ex4.sets.length+1, ...val, done:true });
        } else {
          const idx = ex4.sets.findIndex(x=>x.pos===payload.pos);
          if (idx>=0) ex4.sets[idx] = { ...ex4.sets[idx], ...val, done:true };
        }
        await db.saveSession(s4);
      }
      backToSessions();
    };

    // 5) Barre timer : masquée tant que non lancée
    updateTimerUI();
  }

  // -------- Lignes --------
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

    // Stepper VERTICAUX
    const reps   = vStepper(safeInt(it.reps),   0, 100);
    const weight = vStepper(safeInt(it.weight), 0, 999);

    // RPE (5..10)
    const rpeWrap = document.createElement('div');
    const rpe = document.createElement('input');
    rpe.type='number'; rpe.className='input'; rpe.min='5'; rpe.max='10'; rpe.inputMode='numeric';
    rpe.value = it.rpe==null ? '' : String(it.rpe);
    rpe.oninput = ()=>{ rpeWrap.dataset.rpe = clampInt(rpe.value,5,10) || ''; };
    rpeWrap.appendChild(rpe); rpeWrap.className='rpe-wrap';

    // Repos (mm:ss)
    const rest = document.createElement('input');
    rest.type='text'; rest.className='input'; rest.placeholder='mm:ss';
    rest.value = fmtTime(safeInt(it.rest)); rest.pattern='^\\d{1,2}:\\d{2}$';

    // Pas de bouton "Enregistrer" ici — piloté par Repos/Reprendre
    const holder = document.createElement('div');
    holder.className = 'js-edit-holder';
    holder.dataset.payload = JSON.stringify({ pos: it.pos, isNew });
    holder._collect = ()=>({
      reps: parseInt(reps.input.value||'0',10),
      weight: parseInt(weight.input.value||'0',10),
      rpe: rpe.value ? parseInt(rpe.value,10) : null,
      rest: parseTime(rest.value)
    });

    r.append(reps.el, weight.el, rpeWrap, rest, holder);
    return r;
  }

  function defaultNewSet(pos){
    return { pos, reps:8, weight:0, rpe:null, rest:90, done:false };
  }

  // -------- Helpers UI --------
  // Stepper vertical (+ au-dessus, − en dessous)
  function vStepper(val, min, max){
    const wrap = document.createElement('div'); wrap.className='vstepper';
    const plus  = document.createElement('button'); plus.className='btn'; plus.textContent='+';
    const input = document.createElement('input'); input.type='number'; input.className='input'; input.inputMode='numeric'; input.value=String(val); input.min=String(min); input.max=String(max);
    const minus = document.createElement('button'); minus.className='btn'; minus.textContent='−';
    plus.onclick  = ()=>{ input.value = String(Math.min(max, (parseInt(input.value||'0',10)+1))); };
    minus.onclick = ()=>{ input.value = String(Math.max(min, (parseInt(input.value||'0',10)-1))); };
    wrap.append(plus, input, minus);
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

  // -------- Timer --------
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

    // Et on ajuste le "rest" de la dernière série (en repos)
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

  function updateTimerUI(){
    const bar = document.getElementById('execTimerBar');
    const disp= document.getElementById('tmrDisplay');
    const tgl = document.getElementById('tmrToggle');
    if (!bar) return;

    // La barre n'apparaît que pendant un repos (sinon cachée)
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

  // -------- Navigation --------
  function backToSessions(){
    document.getElementById('screenExecEdit').hidden = true;
    document.getElementById('screenSessions').hidden = false;
    A.renderWeek().then(()=>A.renderSession());
  }

  // -------- Wire global --------
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('execBack')?.addEventListener('click', backToSessions);

    document.getElementById('tmrToggle')?.addEventListener('click', ()=>{
      if (A.execTimer.running) pauseTimer(); else resumeTimer();
    });
    document.getElementById('tmrMinus')?.addEventListener('click', ()=>adjustTimer(-10));
    document.getElementById('tmrPlus') ?.addEventListener('click', ()=>adjustTimer(+10));
    // pas de bouton Next : la reprise est gérée par "Reprendre une série"
  });
})();
