// init.js — bootstrap (seed, wiring, premiers rendus)

(async function(){
  const A = window.App;

  // DOM refs
  A.el.todayLabel      = document.getElementById('todayLabel');
  A.el.weekStrip       = document.getElementById('weekStrip');
  A.el.sessionList     = document.getElementById('sessionList');
  A.el.btnAddPlanned   = document.getElementById('btnAddPlanned');
  A.el.selectRoutine   = document.getElementById('selectRoutine');
  A.el.btnAddRoutine   = document.getElementById('btnAddRoutine');
  A.el.btnAddExercises = document.getElementById('btnAddExercises');
  A.el.dlgCalendar     = document.getElementById('dlgCalendar');
  A.el.bigCalendar     = document.getElementById('bigCalendar');

  document.getElementById('btnQuickNav').addEventListener('click', ()=>A.openCalendar());
  document.getElementById('dlgClose').addEventListener('click', ()=>A.el.dlgCalendar.close());

  // État initial : sélection = aujourd’hui (emphase par défaut)
  A.activeDate    = A.today();
  A.currentAnchor = A.today();

  // DB + seed
  await db.init();
  await ensureSeed();

  // Premier rendu
  await A.refreshPlannedRoutineName();
  await A.populateRoutineSelect();
  await A.renderWeek();
  await A.renderSession();

  // Actions
  A.el.btnAddPlanned.addEventListener('click', async ()=>{
    if (!A.plannedRoutineName) return;
    const plan = await db.getActivePlan();
    const wd = (A.activeDate.getDay()+6)%7 + 1;
    const id = plan.days[String(wd)];
    if (id) await A.addRoutineToSession(id);
  });

  A.el.btnAddRoutine.addEventListener('click', async ()=>{
    const id = A.el.selectRoutine.value;
    if (id) await A.addRoutineToSession(id);
  });

  A.el.btnAddExercises.addEventListener('click', async ()=>{
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
    } else alert('Cet exercice est déjà dans la séance.');
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
          {pos:1,reps:8,rest:90},{pos:2,reps:8,rest:90},{pos:3,reps:8,rest:120}
        ]}]});
      await db.put('routines', { id:'r_pull', name:'Row', type:'Hypertrophie', description:'',
        moves:[{ pos:1, exerciseId:'ex_row', exerciseName:'Rowing barre', sets:[
          {pos:1,reps:10,rest:90},{pos:2,reps:10,rest:90},{pos:3,reps:10,rest:120}
        ]}]});
    }
    if (!plCount) {
      await db.put('plans', { id:'active', name:'Plan par défaut', days:{ 1:'r_push', 4:'r_pull' }, active:true });
    }
  }

})();
