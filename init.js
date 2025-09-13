// init.js — bootstrap (seed, wiring, premiers rendus)
(async function(){
  const A = window.App;

  // ---------- Helpers navigation écrans & onglets ----------
  function showOnly(which){
    const sSessions  = document.getElementById('screenSessions');
    const sExercises = document.getElementById('screenExercises');
    const sEdit      = document.getElementById('screenExerciseEdit');

    if (sSessions)  sSessions.hidden  = (which !== 'sessions');
    if (sExercises) sExercises.hidden = (which !== 'exercises');
    if (sEdit)      sEdit.hidden      = (which !== 'edit'); // on n'ouvre l'éditeur que via openExerciseEdit
  }

  function setActiveTab(id){
    document.querySelectorAll('.tabbar .tab').forEach(b=>b.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  // ---------- DOM refs ----------
  A.el.todayLabel      = document.getElementById('todayLabel');
  A.el.weekStrip       = document.getElementById('weekStrip');
  A.el.sessionList     = document.getElementById('sessionList');
  A.el.selectRoutine   = document.getElementById('selectRoutine');
  A.el.btnAddRoutine   = document.getElementById('btnAddRoutine');
  A.el.btnAddExercises = document.getElementById('btnAddExercises');
  A.el.dlgCalendar     = document.getElementById('dlgCalendar');
  A.el.bigCalendar     = document.getElementById('bigCalendar');

  // ---------- État initial ----------
  A.activeDate         = A.today();                               // sélection = aujourd’hui
  A.currentAnchor      = new Date(A.activeDate);                  // ancre semaine
  A.calendarMonth      = new Date(A.activeDate.getFullYear(), A.activeDate.getMonth(), 1);

  // ---------- Boutons calendrier ----------
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

  // ---------- Initialisation de la base + seed ----------
  // initialise la base
  await db.init();        
  
  // importe si la base est vide  
  try {
    await db.importExternalExercisesIfNeeded(); // ✅ nouvelle forme exportée par db.js
   } catch(e) {
    console.warn('Import exercices ignoré:', e);
   }

  // Seed
  await ensureSeed();

  // ---------- Premier rendu (écran Séances par défaut) ----------
  setActiveTab('tabSessions');
  showOnly('sessions');
  await A.populateRoutineSelect();
  await A.renderWeek();
  await A.renderSession();

  // ---------- Onglets ----------
  const tabLibraries = document.getElementById('tabLibraries');
  if (tabLibraries) tabLibraries.addEventListener('click', async ()=>{
    setActiveTab('tabLibraries');
    showOnly('exercises');
    await App.openExercises();     // défini dans ui-exercises.js
  });

  const tabSessions = document.getElementById('tabSessions');
  if (tabSessions) tabSessions.addEventListener('click', async ()=>{
    setActiveTab('tabSessions');
    showOnly('sessions');
    await App.populateRoutineSelect();
    await App.renderWeek();
    await App.renderSession();
  });

  // ---------- Actions (2 lignes d’ajout) ----------
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

  // ---------- Seed minimal ----------
 // ---------- Seed minimal ----------
	async function ensureSeed(){
	  const roCount = await db.count('routines');
	  const plCount = await db.count('plans');

	  // S'assure que 3 exos "seed" existent (si absents) pour que les routines puissent pointer quelque chose.
	  async function ensureExercise(id, name, targetKey, equipmentKey){
		const exists = await db.get('exercises', id);
		if (exists) return;

		// Décodage via CFG (les clés sont en lowercase : target "chest", "lats", "quads"...)
		const mu = CFG.decodeMuscle(targetKey);
		const eq = CFG.decodeEquipment(equipmentKey);

		await db.put('exercises', {
		  id,
		  name,
		  equipment: equipmentKey,
		  equipmentGroup1: eq.g1,
		  equipmentGroup2: eq.g2,
		  muscle: mu.muscle,
		  muscleGroup1: mu.g1,
		  muscleGroup2: mu.g2,
		  muscleGroup3: mu.g3,
		  target: targetKey,
		  bodyPart: null,
		  image: null
		});
	  }

	  // Crée ces exos seulement s'ils n'existent pas déjà
	  /*await ensureExercise('ex_bp',  'Développé couché', 'chest', 'barbell');
	  await ensureExercise('ex_row', 'Rowing barre',     'lats',  'barbell');
	  await ensureExercise('ex_sq',  'Squat',            'quads', 'barbell');
		*/
	  // Routines
	  /*if (!roCount) {
		await db.put('routines', { id:'r_push', name:'Push', type:'Hypertrophie', description:'',
		  moves:[{ pos:1, exerciseId:'ex_bp', exerciseName:'Développé couché', sets:[
			{pos:1,reps:8,weight:0,rest:90},{pos:2,reps:8,weight:0,rest:90},{pos:3,reps:8,weight:0,rest:120}
		  ]}]} );
		await db.put('routines', { id:'r_pull', name:'Row', type:'Hypertrophie', description:'',
		  moves:[{ pos:1, exerciseId:'ex_row', exerciseName:'Rowing barre', sets:[
			{pos:1,reps:10,weight:0,rest:90},{pos:2,reps:10,weight:0,rest:90},{pos:3,reps:10,weight:0,rest:120}
		  ]}]} );
	  }
		*/
	  // Plan actif
	  if (!plCount) {
		await db.put('plans', { id:'active', name:'Plan par défaut', days:{ 1:'r_push', 4:'r_pull' }, active:true });
	  }
	}

  
})();
