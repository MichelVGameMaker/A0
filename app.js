/* app.js — écran 3.4 Séances (SPA minimal ciblé) */

const BASE = '/A0/'; // IMPORTANT pour GitHub Pages
const EMPHASIS = '#0f62fe'; // couleur d’emphase (bleu IBM-like), ajuste si tu veux

// --- Utils date ---
const fmtUI = (d) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', '');
const ymd = (d) => d.toISOString().slice(0, 10);
const today = () => new Date(new Date().toDateString()); // sans heure
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Semaine affichée = centrée sur aujourd'hui avec scroll horizontal (mais 7 jours fixes)
let currentAnchor = today(); // ancre pour la semaine visible

// --- DOM refs ---
const elTodayLabel = document.getElementById('todayLabel');
const elWeekStrip   = document.getElementById('weekStrip');
const elSessionList = document.getElementById('sessionList');
const elAddActions  = document.getElementById('addActions');
const elBtnAddPlanned = document.getElementById('btnAddPlanned');
const elSelectRoutine  = document.getElementById('selectRoutine');
const elBtnAddRoutine  = document.getElementById('btnAddRoutine');
const elBtnAddExercises= document.getElementById('btnAddExercises');

const dlgCalendar = document.getElementById('dlgCalendar');
const bigCalendar = document.getElementById('bigCalendar');
document.getElementById('btnQuickNav').addEventListener('click', () => openCalendar());
document.getElementById('dlgClose').addEventListener('click', () => dlgCalendar.close());

// --- State runtime ---
let activeDate = today(); // date sélectionnée (par défaut aujourd'hui)
let plannedRoutineName = null; // nom de la routine du jour (depuis plan actif), si dispo

// --- Init ---
(async function init() {
  elTodayLabel.textContent = fmtUI(today());
  await db.init(); // IndexedDB
  await ensureSeed(); // petites données exemples si vide
  await refreshPlannedRoutineName();
  await populateRoutineSelect();
  renderWeek();
  await renderSession();
})();

// Seed de démo si tout est vide (lib exer, routines, plan)
async function ensureSeed() {
  const exCount = await db.count('exercises');
  const roCount = await db.count('routines');
  const plCount = await db.count('plans');
  if (!exCount) {
    await db.put('exercises', { id: 'ex_bp', name: 'Développé couché', group3: 'Pectoraux', equipment: 'Barre', description: '' });
    await db.put('exercises', { id: 'ex_row', name: 'Rowing barre', group3: 'Dos', equipment: 'Barre', description: '' });
    await db.put('exercises', { id: 'ex_sq', name: 'Squat', group3: 'Quadriceps', equipment: 'Barre', description: '' });
  }
  if (!roCount) {
    await db.put('routines', {
      id: 'r_push',
      name: 'Push',
      type: 'Hypertrophie',
      description: '',
      moves: [
        { pos: 1, exerciseId: 'ex_bp', exerciseName: 'Développé couché', sets: [
          { pos:1, reps:8, rest:90 }, { pos:2, reps:8, rest:90 }, { pos:3, reps:8, rest:120 }
        ]}
      ]
    });
    await db.put('routines', {
      id: 'r_pull',
      name: 'Row',
      type: 'Hypertrophie',
      description: '',
      moves: [
        { pos: 1, exerciseId: 'ex_row', exerciseName: 'Rowing barre', sets: [
          { pos:1, reps:10, rest:90 }, { pos:2, reps:10, rest:90 }, { pos:3, reps:10, rest:120 }
        ]}
      ]
    });
  }
  if (!plCount) {
    // Plan actif simple : Lundi=Push, Jeudi=Row
    await db.put('plans', {
      id: 'active',
      name: 'Plan par défaut',
      days: {
        1: 'r_push', // Lundi
        4: 'r_pull'  // Jeudi
      },
      active: true
    });
  }
}

// Trouver routine prévue du jour via plan actif (pour bouton "Ajouter <routine>")
async function refreshPlannedRoutineName() {
  const plan = await db.getActivePlan();
  plannedRoutineName = null;
  if (!plan) return;
  const wd = (activeDate.getDay() + 6) % 7 + 1; // 1=Lundi..7=Dimanche
  const routineId = plan.days[String(wd)];
  if (routineId) {
    const r = await db.get('routines', routineId);
    plannedRoutineName = r?.name || null;
  }
  // maj bouton
  const btn = elBtnAddPlanned;
  if (plannedRoutineName) {
    btn.textContent = `Ajouter ${plannedRoutineName}`;
    btn.disabled = false;
  } else {
    btn.textContent = 'Ajouter <routine>';
    btn.disabled = true;
  }
}

// Remplir le select des routines
async function populateRoutineSelect() {
  const all = await db.getAll('routines');
  elSelectRoutine.innerHTML = `<option value="">Ajouter une routine…</option>`;
  for (const r of all) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    elSelectRoutine.appendChild(opt);
  }
}

// Rendu semaine
async function renderWeek() {
  elWeekStrip.innerHTML = '';
  const start = addDays(currentAnchor, -3); // 7 jours centrés
  const sessDates = new Set((await db.listSessionDates()).map(x => x.date));

  for (let i=0;i<7;i++) {
    const d = addDays(start, i);
    const key = ymd(d);
    const isToday = ymd(d) === ymd(today());

    // état couleur: entraînement existant ? plan futur ? aujourd'hui ?
    const hasSession = sessDates.has(key);
    const planned = await isPlannedDate(d);

    const btn = document.createElement('button');
    btn.className = 'day';
    btn.textContent = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric' }).replace('.', '');
    if (isToday) btn.classList.add('today');
    if (hasSession) btn.classList.add('has-session');
    if (!hasSession && planned && d >= today()) btn.classList.add('planned');

    btn.addEventListener('click', async () => {
      activeDate = d;
      await refreshPlannedRoutineName();
      await renderSession();
    });
    elWeekStrip.appendChild(btn);
  }
}

// Date a-t-elle une routine prévue (via plan actif) ?
async function isPlannedDate(d) {
  const plan = await db.getActivePlan();
  if (!plan) return false;
  const wd = (d.getDay() + 6) % 7 + 1;
  return Boolean(plan.days[String(wd)]);
}

// Rendu de la séance (liste exercices et cases séries)
async function renderSession() {
  elTodayLabel.textContent = fmtUI(activeDate);

  // Charger/create séance pour date
  const dateKey = ymd(activeDate);
  let session = await db.getSession(dateKey);

  const alreadyHasExercises = session?.exercises?.length > 0;
  // Règle: le bouton "Ajouter <routine>" disparaît dès qu'il y a des exos
  document.getElementById('btnAddPlanned').style.display = (plannedRoutineName && !alreadyHasExercises) ? 'block' : 'none';

  elSessionList.innerHTML = '';
  if (!alreadyHasExercises) {
    elSessionList.innerHTML = `<div class="empty">Aucun exercice pour cette date.</div>`;
  } else {
    for (const ex of session.exercises) {
      const card = document.createElement('article');
      card.className = 'exercise-card';

      const top = document.createElement('div');
      top.className = 'row between';
      const name = document.createElement('div');
      name.className = 'element';
      name.textContent = ex.exerciseName;
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn';
      btnEdit.textContent = 'Répétitions ✏️';
      btnEdit.addEventListener('click', () => {
        // Naviguer vers 3.4.2 — non implémenté ici (écran suivant)
        alert('Écran 3.4.2 “Modifier l’exécution” sera implémenté après.'); 
      });
      top.appendChild(name);
      top.appendChild(btnEdit);
      card.appendChild(top);

      // Cases des séries (3 par ligne max)
      const grid = document.createElement('div');
      grid.className = 'set-grid';
      for (const s of ex.sets) {
        const cell = document.createElement('div');
        cell.className = 'set-cell';
        const rpeSmall = s.rpe ? `<sup>${s.rpe}</sup>` : '';
        const weight = (s.weight ?? 0);
        const reps   = (s.reps ?? 0);
        cell.innerHTML = `<span class="details">${reps}×${weight} ${rpeSmall}</span>`;
        grid.appendChild(cell);
      }
      card.appendChild(grid);

      // Clic global aussi vers 3.4.2
      card.addEventListener('click', () => btnEdit.click());

      elSessionList.appendChild(card);
    }
  }
}

// --- Actions d’ajout ---
elBtnAddPlanned.addEventListener('click', async () => {
  if (!plannedRoutineName) return;
  const plan = await db.getActivePlan();
  const wd = (activeDate.getDay() + 6) % 7 + 1;
  const routineId = plan.days[String(wd)];
  if (!routineId) return;

  await addRoutineToSession(routineId);
});

elBtnAddRoutine.addEventListener('click', async () => {
  const id = elSelectRoutine.value;
  if (!id) return;
  await addRoutineToSession(id);
});

elBtnAddExercises.addEventListener('click', async () => {
  // Simplification : on ajoute un seul exo via un prompt (l’écran 3.2.4 complet viendra plus tard)
  const all = await db.getAll('exercises');
  if (!all.length) return alert('Aucun exercice dans la bibliothèque.');
  const names = all.map(e => e.name).join(', ');
  const name = prompt(`Ajouter un exercice (nom exact)\nParmi: ${names}`);
  const ex = all.find(e => e.name.toLowerCase() === String(name||'').toLowerCase());
  if (!ex) return alert('Nom non trouvé.');
  const dateKey = ymd(activeDate);
  let session = await db.getSession(dateKey) || { date: dateKey, exercises: [] };
  if (!session.exercises.some(E => E.exerciseId === ex.id)) {
    session.exercises.push({ pos: session.exercises.length+1, exerciseId: ex.id, exerciseName: ex.name, sets: [] });
    await db.saveSession(session);
    await renderWeek();
    await renderSession();
  } else {
    alert('Cet exercice est déjà dans la séance.');
  }
});

async function addRoutineToSession(routineId) {
  const routine = await db.get('routines', routineId);
  if (!routine) return;

  const dateKey = ymd(activeDate);
  let session = await db.getSession(dateKey) || { date: dateKey, exercises: [] };

  // ajoute mouvements -> exécutions avec séries prévues vides sauf reps/rest préremplies
  for (const m of routine.moves) {
    if (session.exercises.some(e => e.exerciseId === m.exerciseId)) continue; // pas de doublon
    session.exercises.push({
      pos: session.exercises.length + 1,
      exerciseId: m.exerciseId,
      exerciseName: m.exerciseName,
      sets: m.sets.map(s => ({ pos: s.pos, reps: s.reps ?? null, weight: null, rpe: null, rest: s.rest ?? null }))
    });
  }
  await db.saveSession(session);
  await refreshPlannedRoutineName();
  await renderWeek();
  await renderSession();
}

// --- Gestes swipe pour semaine (scroll demi-écran simulé) ---
let touchStartX = null;
elWeekStrip.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, {passive:true});
elWeekStrip.addEventListener('touchend', (e) => {
  if (touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(dx) < 40) return;
  if (dx < 0) currentAnchor = addDays(currentAnchor, +7);
  else currentAnchor = addDays(currentAnchor, -7);
  renderWeek();
});

// --- Modale Calendrier global très simple (mois courant) ---
function openCalendar() {
  bigCalendar.innerHTML = '';
  const now = today();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0..11
  const first = new Date(year, month, 1);
  const startIdx = (first.getDay() + 6) % 7; // lundi=0
  const ul = document.createElement('div');
  ul.className = 'month-grid';
  // entêtes
  ['L','M','M','J','V','S','D'].forEach(lbl=>{
    const h = document.createElement('div'); h.className='dow'; h.textContent=lbl; ul.appendChild(h);
  });
  for (let i=0;i<startIdx;i++) { const empty = document.createElement('div'); ul.appendChild(empty); }
  const lastDay = new Date(year, month+1, 0).getDate();
  for (let d=1; d<=lastDay; d++) {
    const cell = document.createElement('button'); cell.className='day-cell';
    const dt = new Date(year, month, d);
    cell.textContent = d;
    if (ymd(dt) === ymd(today())) cell.classList.add('today');
    cell.addEventListener('click', async ()=>{
      activeDate = dt;
      dlgCalendar.close();
      await refreshPlannedRoutineName();
      await renderWeek();
      await renderSession();
    });
    ul.appendChild(cell);
  }
  bigCalendar.appendChild(ul);
  dlgCalendar.showModal();
}
