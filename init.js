// init.js — bootstrap (seed, wiring, premiers rendus)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        wireNavigation();
        wireCalendar();
        wireRoutineSelection();
        void bootstrap();
    });

    /* ACTIONS */
    async function bootstrap() {
        A.activeDate = A.today();
        A.currentAnchor = new Date(A.activeDate);
        A.calendarMonth = new Date(A.activeDate.getFullYear(), A.activeDate.getMonth(), 1);

        await db.init();
        try {
            await db.importExternalExercisesIfNeeded();
        } catch (error) {
            console.warn('Import exercices ignoré:', error);
        }
        await ensureSeed();

        setActiveTab('tabSessions');
        showOnly('sessions');
        await A.populateRoutineSelect();
        await A.renderWeek();
        await A.renderSession();
    }

    function wireNavigation() {
        const { tabLibraries, tabSessions, tabSettings, screenSessions, screenExercises, screenExerciseEdit, screenRoutineEdit, screenRoutineMoveEdit } = refs;

        tabLibraries?.addEventListener('click', async () => {
            setActiveTab('tabLibraries');
            showOnly('exercises');
            await A.openExercises({ callerScreen: 'screenSessions' });
        });

        tabSessions?.addEventListener('click', async () => {
            setActiveTab('tabSessions');
            showOnly('sessions');
            await A.populateRoutineSelect();
            await A.renderWeek();
            await A.renderSession();
        });

        tabSettings?.addEventListener('click', async () => {
            setActiveTab('tabSettings');
            showOnly('routine');
            await A.openRoutineEdit({ routineId: 'routine-test' });
        });

        screenSessions?.setAttribute('data-screen', 'sessions');
        screenExercises?.setAttribute('data-screen', 'exercises');
        screenExerciseEdit?.setAttribute('data-screen', 'edit');
        screenRoutineEdit?.setAttribute('data-screen', 'routine');
        screenRoutineMoveEdit?.setAttribute('data-screen', 'routineMove');
    }

    function wireCalendar() {
        const { btnQuickNav, dlgClose, calPrev, calNext } = refs;

        btnQuickNav?.addEventListener('click', () => A.openCalendar());
        dlgClose?.addEventListener('click', () => refs.dlgCalendar?.close());

        calPrev?.addEventListener('click', async () => {
            A.calendarMonth = new Date(A.calendarMonth.getFullYear(), A.calendarMonth.getMonth() - 1, 1);
            await A.openCalendar();
        });
        calNext?.addEventListener('click', async () => {
            A.calendarMonth = new Date(A.calendarMonth.getFullYear(), A.calendarMonth.getMonth() + 1, 1);
            await A.openCalendar();
        });
    }

    function wireRoutineSelection() {
        const { btnAddRoutine, selectRoutine } = refs;
        btnAddRoutine?.addEventListener('click', async () => {
            const id = selectRoutine?.value;
            if (id) {
                await A.addRoutineToSession(id);
            }
        });
    }

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }

        refs.todayLabel = document.getElementById('todayLabel');
        refs.weekStrip = document.getElementById('weekStrip');
        refs.sessionList = document.getElementById('sessionList');
        refs.selectRoutine = document.getElementById('selectRoutine');
        refs.btnAddRoutine = document.getElementById('btnAddRoutine');
        refs.btnAddExercises = document.getElementById('btnAddExercises');
        refs.dlgCalendar = document.getElementById('dlgCalendar');
        refs.bigCalendar = document.getElementById('bigCalendar');
        refs.btnQuickNav = document.getElementById('btnQuickNav');
        refs.dlgClose = document.getElementById('dlgClose');
        refs.calPrev = document.getElementById('calPrev');
        refs.calNext = document.getElementById('calNext');
        refs.tabLibraries = document.getElementById('tabLibraries');
        refs.tabSessions = document.getElementById('tabSessions');
        refs.tabSettings = document.getElementById('tabSettings');
        refs.screenSessions = document.getElementById('screenSessions');
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenExerciseEdit = document.getElementById('screenExerciseEdit');
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenExecEdit = document.getElementById('screenExecEdit');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        const required = [
            'todayLabel',
            'weekStrip',
            'sessionList',
            'selectRoutine',
            'btnAddRoutine',
            'dlgCalendar',
            'bigCalendar',
            'tabLibraries',
            'tabSessions',
            'tabSettings'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`init.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function setActiveTab(id) {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('active');
        }
    }

    function showOnly(which) {
        const { screenSessions, screenExercises, screenExerciseEdit, screenRoutineEdit, screenRoutineMoveEdit, screenExecEdit } = refs;
        if (screenSessions) {
            screenSessions.hidden = which !== 'sessions';
        }
        if (screenExercises) {
            screenExercises.hidden = which !== 'exercises';
        }
        if (screenExerciseEdit) {
            screenExerciseEdit.hidden = which !== 'edit';
        }
        if (screenRoutineEdit) {
            screenRoutineEdit.hidden = which !== 'routine';
        }
        if (screenRoutineMoveEdit) {
            screenRoutineMoveEdit.hidden = which !== 'routineMove';
        }
        if (screenExecEdit) {
            screenExecEdit.hidden = which !== 'exec';
        }
    }

    async function ensureSeed() {
        const routineCount = await db.count('routines');
        const planCount = await db.count('plans');

        async function ensureExercise(id, name, targetKey, equipmentKey) {
            const exists = await db.get('exercises', id);
            if (exists) {
                return;
            }
            const muscle = CFG.decodeMuscle(targetKey);
            const equipment = CFG.decodeEquipment(equipmentKey);
            await db.put('exercises', {
                id,
                name,
                equipment: equipmentKey,
                equipmentGroup1: equipment.g1,
                equipmentGroup2: equipment.g2,
                muscle: muscle.muscle,
                muscleGroup1: muscle.g1,
                muscleGroup2: muscle.g2,
                muscleGroup3: muscle.g3,
                target: targetKey,
                bodyPart: null,
                image: null
            });
        }

        if (!routineCount) {
            await ensureExercise('push_up', 'Pompes', 'chest', 'body weight');
            await ensureExercise('pull_up', 'Tractions', 'lats', 'body weight');
            await ensureExercise('squat', 'Squat', 'quads', 'barbell');
            await db.put('routines', {
                id: 'routine-test',
                name: 'Routine test',
                icon: '🏋️',
                moves: [
                    {
                        id: 'move-push-test',
                        pos: 1,
                        exerciseId: 'push_up',
                        exerciseName: 'Pompes',
                        sets: [
                            { pos: 1, reps: 12, weight: null, rpe: 7, rest: null },
                            { pos: 2, reps: 12, weight: null, rpe: 8, rest: null },
                            { pos: 3, reps: 12, weight: null, rpe: 9, rest: null }
                        ]
                    },
                    {
                        id: 'move-pull-test',
                        pos: 2,
                        exerciseId: 'pull_up',
                        exerciseName: 'Tractions',
                        sets: [
                            { pos: 1, reps: 6, weight: null, rpe: 7, rest: null },
                            { pos: 2, reps: 6, weight: null, rpe: 8, rest: null },
                            { pos: 3, reps: 6, weight: null, rpe: 9, rest: null }
                        ]
                    },
                    {
                        id: 'move-squat-test',
                        pos: 3,
                        exerciseId: 'squat',
                        exerciseName: 'Squat',
                        sets: [
                            { pos: 1, reps: 8, weight: 60, rpe: 7, rest: null },
                            { pos: 2, reps: 8, weight: 60, rpe: 8, rest: null },
                            { pos: 3, reps: 8, weight: 60, rpe: 9, rest: null }
                        ]
                    }
                ]
            });
        }

        if (!planCount) {
            await db.put('plans', {
                id: 'active',
                name: 'Plan par défaut',
                days: { 1: 'r_push', 4: 'r_pull' },
                active: true
            });
        }
    }
})();
