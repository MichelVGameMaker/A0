// ui-exercise-read.js — écran lecture d’un exercice
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = { currentId: null, callerScreen: 'screenExercises' };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireNavigation();
    });

    /* ACTIONS */
    /**
     * Ouvre l'écran de lecture d'un exercice.
     * @param {{currentId: string, callerScreen?: string}} options Contexte d'ouverture.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.openExerciseRead = async function openExerciseRead(options) {
        const { currentId, callerScreen = 'screenExercises' } = options || {};
        if (!currentId) {
            return;
        }
        ensureRefs();
        assertRefs();

        state.currentId = currentId;
        state.callerScreen = callerScreen;

        const exercise = await db.get('exercises', currentId);
        if (!exercise) {
            alert('Exercice introuvable.');
            return;
        }

        refs.exReadTitle.textContent = exercise.name || 'Exercice';
        updateHero(exercise);
        updateMuscles(exercise);
        updateEquipment(exercise);
        updateInstructions(exercise);

        switchScreen('screenExerciseRead');
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenExerciseRead = document.getElementById('screenExerciseRead');
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenSessions = document.getElementById('screenSessions');
        refs.screenExerciseEdit = document.getElementById('screenExerciseEdit');
        refs.screenExecEdit = document.getElementById('screenExecEdit');
        refs.exReadTitle = document.getElementById('exReadTitle');
        refs.exReadHero = document.getElementById('exReadHero');
        refs.exReadMuscle = document.getElementById('exReadMuscle');
        refs.exReadEquipment = document.getElementById('exReadEquipment');
        refs.exReadInstruc = document.getElementById('exReadInstruc');
        refs.exReadBack = document.getElementById('exReadBack');
        refs.exReadEdit = document.getElementById('exReadEdit');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenExerciseRead',
            'exReadTitle',
            'exReadHero',
            'exReadMuscle',
            'exReadEquipment',
            'exReadInstruc',
            'exReadBack',
            'exReadEdit'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-exercise-read.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const { exReadBack, exReadEdit } = assertRefs();
        exReadBack?.addEventListener('click', () => {
            if (state.callerScreen === 'screenExercises') {
                void A.openExercises({ callerScreen: 'screenExerciseRead' });
            } else {
                switchScreen(state.callerScreen || 'screenExercises');
            }
        });
        exReadEdit?.addEventListener('click', () => {
            if (!state.currentId) {
                alert('Aucun exercice sélectionné.');
                return;
            }
            A.openExerciseEdit({ currentId: state.currentId, callerScreen: 'screenExerciseRead' });
        });
    }

    function updateHero(exercise) {
        const { exReadHero } = assertRefs();
        if (exercise.image) {
            exReadHero.src = exercise.image;
            exReadHero.classList.remove('exercise-hero-placeholder');
        } else {
            exReadHero.src = new URL('icons/placeholder-64.png', document.baseURI).href;
            exReadHero.classList.add('exercise-hero-placeholder');
        }
        exReadHero.alt = exercise.name || 'exercice';
    }

    function updateMuscles(exercise) {
        const { exReadMuscle } = assertRefs();
        const main = exercise.muscle || exercise.muscleGroup2 || exercise.muscleGroup3 || '—';
        const secondary = toArray(exercise.secondaryMuscles).filter(Boolean).join(', ');
        const primaryLine = secondary
            ? `Principal : ${ucFirst(main)} · Secondaires : ${secondary}`
            : `Principal : ${ucFirst(main)}`;
        exReadMuscle.textContent = primaryLine;
    }

    function updateEquipment(exercise) {
        const { exReadEquipment } = assertRefs();
        const line = `Matériel : ${toArray(exercise.equipmentGroup2 || exercise.equipment).filter(Boolean).join(', ') || '—'}`;
        exReadEquipment.textContent = line;
    }

    function updateInstructions(exercise) {
        const { exReadInstruc } = assertRefs();
        exReadInstruc.innerHTML = '';
        const steps = toArray(exercise.instructions);
        if (steps.length) {
            steps.forEach((step) => {
                const li = document.createElement('li');
                li.textContent = String(step).replace(/^Step:\d+\s*/i, '');
                exReadInstruc.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = '—';
            exReadInstruc.appendChild(li);
        }
    }

    function switchScreen(target) {
        const { screenExerciseRead, screenExercises, screenSessions, screenExerciseEdit, screenExecEdit } = assertRefs();
        const map = {
            screenExerciseRead,
            screenExercises,
            screenSessions,
            screenExerciseEdit,
            screenExecEdit
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }

    function toArray(value) {
        if (Array.isArray(value)) {
            return value;
        }
        if (value) {
            return [value];
        }
        return [];
    }

    function ucFirst(value) {
        const text = value || '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
})();
