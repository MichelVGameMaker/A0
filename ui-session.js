// ui-session.js — liste de la séance du jour + ajouts (2 lignes)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        wireAddExercisesButton();
    });

    /* ACTIONS */
    /**
     * Retourne l'identifiant de la routine planifiée pour une date.
     * @param {Date} date Date ciblée.
     * @returns {Promise<string|null>} Identifiant ou `null`.
     */
    A.getPlannedRoutineId = async function getPlannedRoutineId(date) {
        const plan = await db.getActivePlan();
        if (!plan) {
            return null;
        }
        const weekday = (date.getDay() + 6) % 7 + 1;
        return plan.days?.[String(weekday)] || null;
    };

    /**
     * Met à jour le sélecteur de routine en mettant la routine planifiée en premier.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.populateRoutineSelect = async function populateRoutineSelect() {
        const { selectRoutine } = assertRefs();
        const all = await db.getAll('routines');
        const plannedId = await A.getPlannedRoutineId(A.activeDate);

        selectRoutine.innerHTML = '<option value="">Ajouter une routine…</option>';

        const ordered = [];
        if (plannedId) {
            const planned = all.find((routine) => routine.id === plannedId);
            if (planned) {
                ordered.push(planned);
            }
        }
        for (const routine of all) {
            if (!ordered.some((item) => item.id === routine.id)) {
                ordered.push(routine);
            }
        }

        ordered.forEach((routine) => {
            const option = document.createElement('option');
            option.value = routine.id;
            option.textContent = routine.name;
            selectRoutine.appendChild(option);
        });

        selectRoutine.value = plannedId || '';
    };

    /**
     * Rend la séance du jour.
     * @returns {Promise<void>} Promesse résolue après affichage.
     */
    A.renderSession = async function renderSession() {
        const { todayLabel, sessionList } = assertRefs();
        todayLabel.textContent = A.fmtUI(A.activeDate);

        const key = A.ymd(A.activeDate);
        const session = await db.getSession(key);
        sessionList.innerHTML = '';

        if (!(session?.exercises?.length)) {
            sessionList.innerHTML = '<div class="empty">Aucun exercice pour cette date.</div>';
            return;
        }

        session.exercises.forEach((exercise) => {
            const card = document.createElement('article');
            card.className = 'exercise-card';

            const top = document.createElement('div');
            top.className = 'row between';
            const name = document.createElement('div');
            name.className = 'element';
            name.textContent = exercise.exerciseName;
            const button = document.createElement('button');
            button.className = 'btn';
            button.textContent = 'Répétitions ✏️';
            button.addEventListener('click', () => A.openExecEdit({
                currentId: exercise.exerciseId,
                callerScreen: 'screenSessions'
            }));
            top.append(name, button);
            card.appendChild(top);

            const grid = document.createElement('div');
            grid.className = 'set-grid';
            exercise.sets.forEach((set) => {
                const cell = document.createElement('div');
                cell.className = 'set-cell';
                const reps = set.reps ?? 0;
                const weight = set.weight ?? 0;
                const rpeSmall = set.rpe ? `<sup>${set.rpe}</sup>` : '';
                cell.innerHTML = `<span class="details">${reps}×${weight} kg ${rpeSmall}</span>`;
                grid.appendChild(cell);
            });
            card.appendChild(grid);
            card.addEventListener('click', () => button.click());

            sessionList.appendChild(card);
        });
    };

    /**
     * Ajoute des exercices sélectionnés à la séance courante.
     * @param {string[]} ids Identifiants d'exercice.
     * @returns {Promise<void>} Promesse résolue après sauvegarde.
     */
    A.addExercisesToCurrentSession = async function addExercisesToCurrentSession(ids) {
        if (!Array.isArray(ids) || !ids.length) {
            return;
        }

        const key = A.ymd(A.activeDate);
        const session = (await db.getSession(key)) || { date: key, exercises: [] };
        const existing = new Set((session.exercises || []).map((exercise) => exercise.exerciseId));

        for (const id of ids) {
            if (existing.has(id)) {
                continue;
            }
            const exercise = await db.get('exercises', id);
            if (!exercise) {
                continue;
            }
            session.exercises.push({
                pos: (session.exercises?.length || 0) + 1,
                exerciseId: exercise.id,
                exerciseName: exercise.name || 'Exercice',
                sets: [{ pos: 1, reps: null, weight: null, rpe: null, rest: null, done: false }]
            });
        }

        await db.saveSession(session);
        await A.renderWeek();
        await A.renderSession();
    };

    /**
     * Ajoute une routine complète à la séance courante.
     * @param {string} routineId Identifiant de routine.
     * @returns {Promise<void>} Promesse résolue après sauvegarde.
     */
    A.addRoutineToSession = async function addRoutineToSession(routineId) {
        const routine = await db.get('routines', routineId);
        if (!routine) {
            return;
        }
        const key = A.ymd(A.activeDate);
        const session = (await db.getSession(key)) || { date: key, exercises: [] };

        routine.moves.forEach((move) => {
            if (session.exercises.some((exercise) => exercise.exerciseId === move.exerciseId)) {
                return;
            }
            session.exercises.push({
                pos: session.exercises.length + 1,
                exerciseId: move.exerciseId,
                exerciseName: move.exerciseName,
                sets: move.sets.map((set) => ({
                    pos: set.pos,
                    reps: set.reps ?? null,
                    weight: null,
                    rpe: null,
                    rest: set.rest ?? null,
                    done: false
                }))
            });
        });

        await db.saveSession(session);
        await A.populateRoutineSelect();
        await A.renderWeek();
        await A.renderSession();
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.btnAddExercises = document.getElementById('btnAddExercises');
        refs.selectRoutine = document.getElementById('selectRoutine');
        refs.todayLabel = document.getElementById('todayLabel');
        refs.sessionList = document.getElementById('sessionList');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = ['selectRoutine', 'todayLabel', 'sessionList'];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-session.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireAddExercisesButton() {
        const { btnAddExercises } = refs;
        btnAddExercises?.addEventListener('click', () => {
            A.openExercises({
                mode: 'add',
                callerScreen: 'screenSessions',
                onAdd: async (ids) => {
                    await A.addExercisesToCurrentSession(ids);
                }
            });
        });
    }
})();
