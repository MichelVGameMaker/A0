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
        refs.exReadOrigin.textContent = formatExerciseOrigin(exercise);
        updateHero(exercise);
        updateMuscles(exercise);
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
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenStatExercises = document.getElementById('screenStatExercises');
        refs.screenStatExercisesDetail = document.getElementById('screenStatExercisesDetail');
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.exReadTitle = document.getElementById('exReadTitle');
        refs.exReadOrigin = document.getElementById('exReadOrigin');
        refs.exReadHero = document.getElementById('exReadHero');
        refs.exReadMuscleMain = document.getElementById('exReadMuscleMain');
        refs.exReadMuscleSecondary = document.getElementById('exReadMuscleSecondary');
        refs.exReadInstruc = document.getElementById('exReadInstruc');
        refs.exReadBack = document.getElementById('exReadBack');
        refs.exReadEdit = document.getElementById('exReadEdit');
        refs.dlgExerciseActions = document.getElementById('dlgExerciseActions');
        refs.exerciseActionsClose = document.getElementById('exerciseActionsClose');
        refs.exerciseActionEdit = document.getElementById('exerciseActionEdit');
        refs.exerciseActionDuplicate = document.getElementById('exerciseActionDuplicate');
        refs.exerciseActionDelete = document.getElementById('exerciseActionDelete');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenExerciseRead',
            'exReadTitle',
            'exReadOrigin',
            'exReadHero',
            'exReadMuscleMain',
            'exReadMuscleSecondary',
            'exReadInstruc',
            'exReadBack',
            'exReadEdit',
            'dlgExerciseActions',
            'exerciseActionsClose',
            'exerciseActionEdit',
            'exerciseActionDuplicate',
            'exerciseActionDelete'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-exercise-read.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const {
            exReadBack,
            exReadEdit,
            dlgExerciseActions,
            exerciseActionsClose,
            exerciseActionEdit,
            exerciseActionDuplicate,
            exerciseActionDelete
        } = assertRefs();
        exReadBack?.addEventListener('click', () => {
            if (state.callerScreen === 'screenExercises') {
                void A.openExercises({ callerScreen: 'screenExerciseRead' });
            } else {
                switchScreen(state.callerScreen || 'screenExercises');
            }
        });
        exReadEdit?.addEventListener('click', () => {
            openExerciseActions();
        });
        exerciseActionsClose?.addEventListener('click', () => {
            dlgExerciseActions?.close();
        });
        exerciseActionEdit?.addEventListener('click', () => {
            void handleExerciseAction('edit');
        });
        exerciseActionDuplicate?.addEventListener('click', () => {
            void handleExerciseAction('duplicate');
        });
        exerciseActionDelete?.addEventListener('click', () => {
            void handleExerciseAction('delete');
        });
    }

    function openExerciseActions() {
        const { dlgExerciseActions } = assertRefs();
        if (!state.currentId) {
            alert('Aucun exercice sélectionné.');
            return;
        }
        if (!dlgExerciseActions.open) {
            dlgExerciseActions.showModal();
        }
    }

    async function handleExerciseAction(action) {
        const { dlgExerciseActions } = assertRefs();
        if (!state.currentId) {
            alert('Aucun exercice sélectionné.');
            return;
        }
        if (action === 'edit') {
            dlgExerciseActions.close();
            await A.openExerciseEdit({ currentId: state.currentId, callerScreen: 'screenExerciseRead' });
            return;
        }
        if (action === 'duplicate') {
            const exercise = await db.get('exercises', state.currentId);
            if (!exercise) {
                alert('Exercice introuvable.');
                return;
            }
            const copy = {
                ...exercise,
                id: buildUserExerciseId(exercise.name),
                origin: 'user',
                native_id: null
            };
            await db.put('exercises', copy);
            dlgExerciseActions.close();
            await A.openExerciseEdit({ currentId: copy.id, callerScreen: 'screenExerciseRead' });
            return;
        }
        if (action === 'delete') {
            const confirmed = A.components?.confirmDialog?.confirm
                ? await A.components.confirmDialog.confirm({
                    title: 'Supprimer un exercice',
                    message: 'Supprimer cet exercice ?'
                })
                : confirm('Supprimer cet exercice ?');
            if (!confirmed) {
                return;
            }
            await db.del('exercises', state.currentId);
            dlgExerciseActions.close();
            await A.openExercises({ callerScreen: 'screenExerciseRead' });
        }
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
        const { exReadMuscleMain, exReadMuscleSecondary } = assertRefs();
        const main = exercise.muscle || exercise.muscleGroup2 || exercise.muscleGroup3 || '—';
        const secondary = toArray(exercise.secondaryMuscles).filter(Boolean).join(', ');
        exReadMuscleMain.textContent = `Principal : ${ucFirst(main)}`;
        exReadMuscleSecondary.textContent = `Secondaires : ${secondary || '—'}`;
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

    function formatExerciseOrigin(exercise) {
        const origin = exercise?.origin;
        if (origin === 'modified') {
            return 'Modifié';
        }
        if (origin === 'native') {
            return 'Natif';
        }
        if (origin === 'import') {
            return 'Importé';
        }
        if (origin === 'user') {
            return 'Créé';
        }
        return 'Exercice';
    }

    function buildUserExerciseId(name) {
        const base = String(name || '')
            .trim()
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'exercise';
        return `user--${base}--${Date.now()}`;
    }

    function switchScreen(target) {
        const { screenExerciseRead, screenExercises, screenSessions, screenExerciseEdit, screenExecEdit } = assertRefs();
        const {
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatExercises,
            screenStatExercisesDetail,
            screenSettings,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData
        } = refs;
        const map = {
            screenExerciseRead,
            screenExercises,
            screenSessions,
            screenExerciseEdit,
            screenExecEdit,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatExercises,
            screenStatExercisesDetail,
            screenSettings,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData
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
