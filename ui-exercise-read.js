// ui-exercise-read.js — écran lecture d’un exercice
(function () {
  // Assure l'espace de noms
  const A = window.App || (window.App = {});
  A.el = A.el || {};

  // ---------- Utils ----------
  const toArray = v => Array.isArray(v) ? v : (v ? [v] : []);
  const joinNice = arr => toArray(arr).filter(Boolean).join(', ');
  const ucFirst = s => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);

  let currentId = null;       // null = ajout
  let callerScreen = null;    // mémorise l'écran d'origine
  
  function showScreen(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    const scr = document.getElementById(id);
    if (scr) scr.hidden = false;
  }

  // ---------- Références DOM (READ) ----------
  function ensureReadRefs() {
    // Si déjà branché, on sort
    if (A.el.exReadTitle && A.el.exReadHero && A.el.exReadMuscle && A.el.exReadEquipment && A.el.exReadInstruc) return;

    A.el.exReadTitle     = document.getElementById('exReadTitle');
    A.el.exReadHero      = document.getElementById('exReadHero');
    A.el.exReadMuscle    = document.getElementById('exReadMuscle');
    A.el.exReadEquipment = document.getElementById('exReadEquipment');
    A.el.exReadInstruc   = document.getElementById('exReadInstruc');
    A.el.exReadBack      = document.getElementById('exReadBack');
    A.el.exReadEdit      = document.getElementById('exReadEdit');
  }

  function assertReadRefs() {
    const must = {
      exReadTitle: A.el.exReadTitle,
      exReadHero: A.el.exReadHero,
      exReadMuscle: A.el.exReadMuscle,
      exReadEquipment: A.el.exReadEquipment,
      exReadInstruc: A.el.exReadInstruc
    };
    const missing = Object.entries(must).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      console.error('IDs manquants dans screenExerciseRead :', missing);
      alert('Écran "Consulter un exercice" incomplet dans le HTML. Manque : ' + missing.join(', '));
      return false;
    }
    return true;
  }

  /* =======================================================
     ==============   Ouvrir l’écran LECTURE   =============
     ======================================================= */
  A.openExerciseRead = async function (id, from) {
    try {
	ensureReadRefs();
	if (!assertReadRefs()) return;

		currentId    = id || null;
		callerScreen = from || 'screenExercises'; // par défaut

      // Récupération depuis la base
      const ex = await db.get('exercises', id);
      if (!ex) { alert('Exercice introuvable.'); return; }

      // Titre
      A.el.exReadTitle.textContent = ex.name || 'Exercice';

      // Image / GIF
      const hero = A.el.exReadHero;
      if (ex.image) {
        hero.src = ex.image;
        hero.style.objectFit = ''; // reset si précédemment "contain"
      } else {
        hero.src = './icons/placeholder-64.png';
        hero.style.objectFit = 'contain';
      }
      hero.alt = ex.name || 'exercice';

      // Muscles
      const targetMuscle    = ex.muscle || ex.muscleGroup2 || ex.muscleGroup3 || '—';
      const secondaryMuscle = joinNice(ex.secondaryMuscles);
      const primaryLine = secondaryMuscle
        ? `Principal : ${ucFirst(targetMuscle)} · Secondaires : ${secondaryMuscle}`
        : `Principal : ${ucFirst(targetMuscle)}`;
      A.el.exReadMuscle.textContent = primaryLine;

      // Matériel
      const equipLine = `Matériel : ${joinNice(ex.equipmentGroup2 || ex.equipment) || '—'}`;
      A.el.exReadEquipment.textContent = equipLine;

      // Instructions
      const steps = toArray(ex.instructions);
      const ol = A.el.exReadInstruc;
      ol.innerHTML = '';
      if (steps.length) {
        steps.forEach(t => {
          const li = document.createElement('li');
          li.textContent = String(t).replace(/^Step:\d+\s*/i, '');
          ol.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = '—';
        ol.appendChild(li);
      }

      // Afficher l’écran
      showScreen('screenExerciseRead');
    } catch (err) {
      console.error('Erreur dans openExerciseRead:', err);
      alert('Une erreur est survenue lors de l’ouverture de la fiche exercice. Consulte la console pour les détails.');
    }
  };

  /* =======================================================
     ======================   WIRE   =======================
     ======================================================= */
	document.addEventListener('DOMContentLoaded', () => {
		ensureReadRefs();

		// Bouton retour → retour à la liste
		A.el.exReadBack?.addEventListener('click', () => A.openExercises?.());

		// Bouton éditer → ouvre l’éditeur sur le même id
		A.el.exReadEdit?.addEventListener('click', () => {
			if (currentId && typeof A.openExerciseEdit === 'function') {
				A.openExerciseEdit(currentId, 'screenExerciseRead');
			} else if (!currentId) {
				alert('Aucun exercice sélectionné.');
			} else {
				console.error('A.openExerciseEdit est introuvable. Charge ui-exercise-edit.js avant.');
			}
		});
	});
	
})();
