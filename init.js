// init.js — bootstrap (seed, wiring, premiers rendus)
(async function(){
  const A = window.App;

  // routing basique des onglets
  function showOnly(id){
    // Séances
    const screenSessionsParts = ['weekStrip','sessionList','addActions'];
    const sessionsVisible = (id==='sessions');
    for (const pid of screenSessionsParts) {
      const el = document.getElementById(pid);
      if (el) el.parentElement.hidden = !sessionsVisible && pid==='weekStrip' ? true : false;
    }
    // Pour simplicité : on masque/affiche par sections dédiées
    document.getElementById('screenExercises').hidden     = (id!=='exercises');
    document.getElementById('screenExerciseEdit').hidden  = true; // fermé par défaut
  }
  
  // brancher les onglets
  document.getElementById('tabLibraries').addEventListener('click', async ()=>{
    // activer l’onglet visuellement
    document.querySelectorAll('.tabbar .tab').forEach(b=>b.classList.remove('active'));
    document.getElementById('tabLibraries').classList.add('active');
  
    showOnly('exercises');
    await App.openExercises();
  });
  
  document.getElementById('tabSessions').addEventListener('click', async ()=>{
    document.querySelectorAll('.tabbar .tab').forEach(b=>b.classList.remove('active'));
    document.getElementById('tabSessions').classList.add('active');
  
    showOnly('sessions');
    await App.renderWeek();
    await App.renderSession();
  });
  
  // DOM refs
  A.el.todayLabel      = document.getElementById('todayLabel');
  A.el.weekStrip       = document.getElementById('weekStrip');
  A.el.sessionList     = document.getElementById('sessionList');
  A.el.selectRoutine   = document.getElementById('selectRoutine');
  A.el.btnAddRoutine   = document.getElementById('btnAddRoutine');
  A.el.btnAddExercises = document.getElementById('btnAddExercises');
  A.el.dlgCalendar     = document.getElementById('dlgCalendar');
  A.el.bigCalendar     = document.getElementById('bigCalendar');

  // État initial
  A.activeDate    = A.today();                 // sélection = aujourd’hui
  A.currentAnchor = new Date(A.activeDate);    // ancre semaine
  A.calendarMonth = new Date(A.activeDate.getFullYear(), A.activeDate.getMonth(), 1);

  // Boutons calendrier
  const btnQuick = document.getElementById('btnQuickNav');
  if (btnQuick) btnQuick.addEventListener('click', ()=>A.openCalendar());

  const btnClose = document.getElementById('dlgClose');
  if (btnClose) btnClose.addEventListener('click', ()=>A.el.dlgCalendar?.close());

  const calPrev = document.getElementById('calPrev');
  if (calPrev) calPrev.addEventListener('click', async ()=>{
    A.calendarMonth = new Date(A.calendarMonth.getFullYear(), A.calendarMonth.getMonth()-1, 1);
    await A.openCalendar();
  });

  const calNext = document.getElementById('calNext');
  if (calNext) calNext.addEventListener('click', async ()=>{
    A.calendarMonth = new Date(A.calendarMonth.getFullYear(), A.calendarMonth.getMonth()+1, 1);
    await A.openCalendar();
  });

  // Init DB + seed
  await db.init();
  await ensureSeed();

  // Premier rendu
  await A.populateRoutineSelect();  // <- remplit le sélecteur selon la date
  await A.renderWeek();
  await A.renderSession();

  // Actions (2 lignes)
  A.el.btnAddRoutine?.addEventListener('click', async ()=>{
    const id = A.el.selectRoutine?.value;
    if (id) await A.addRoutineToSession(id);
  });

  A.el.btnAddExercises?.addEventListener('click', async ()=>{
    const all = await db.getAll('exercises');
    if (!all.length) return alert('Aucun exercice dans la bibliothèque.');
    const names = all.map(e=>e.name).join(', ');
    const name = prompt(`Ajouter un exercice (nom exact)\nParmi: ${names}`);
    const ex = all.find(e => e.name.toLowerCase() === String(name||'').toLowerCase());
    if (!ex) return alert('Nom non trouvé.');
    const key = A.ymd(A.activeDate);
    let s = await db.getSession(key) || { date:key, exercises:[] };
    if (!s.exercises.some(E=>E.exerciseId===ex.id)) {
      s.exercises.push({ pos:s.exercises.length+1, exerciseId:ex.id, exerciseName:ex.name, sets:[] });
      await db.saveSession(s);
      await A.renderWeek();
      await A.renderSession();
    } else {
      alert('Cet exercice est déjà dans la séance.');
    }
  });

  // Seed minimal
  async function ensureSeed(){
    const exCount = await db.count('exercises');
    const roCount = await db.count('routines');
    const plCount = await db.count('plans');
    if (!exCount) {
      await db.put('exercises', { id:'ex_bp', name:'Développé couché', group3:'Pectoraux',   equipment:'Barre', description:'' });
      await db.put('exercises', { id:'ex_row',name:'Rowing barre',     group3:'Dos',         equipment:'Barre', description:'' });
      await db.put('exercises', { id:'ex_sq', name:'Squat',            group3:'Quadriceps',  equipment:'Barre', description:'' });
    }
    if (!roCount) {
      await db.put('routines', { id:'r_push', name:'Push', type:'Hypertrophie', description:'',
        moves:[{ pos:1, exerciseId:'ex_bp', exerciseName:'Développé couché', sets:[
          {pos:1,reps:8,weight:0,rest:90},{pos:2,reps:8,weight:0,rest:90},{pos:3,reps:8,weight:0,rest:120}
        ]}]});
      await db.put('routines', { id:'r_pull', name:'Row', type:'Hypertrophie', description:'',
        moves:[{ pos:1, exerciseId:'ex_row', exerciseName:'Rowing barre', sets:[
          {pos:1,reps:10,weight:0,rest:90},{pos:2,reps:10,weight:0,rest:90},{pos:3,reps:10,weight:0,rest:120}
        ]}]});
    }
    if (!plCount) {
      await db.put('plans', { id:'active', name:'Plan par défaut', days:{ 1:'r_push', 4:'r_pull' }, active:true });
    }
  }
})();
