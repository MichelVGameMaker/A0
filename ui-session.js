// ui-session.js — liste de la séance du jour + ajouts (2 lignes)
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-session: composant listCard manquant.');
    }

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const sessionEditorState = {
        session: null,
        saveTimer: null,
        initialComments: ''
    };
    const plannedRoutineState = {
        routineId: null
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        wireAddExercisesButton();
        wireAddRoutinesButton();
        wirePlannedRoutineButton();
        wireSessionEditor();
    });

    function getRpeDatasetValue(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        const bounded = Math.min(10, Math.max(5, numeric));
        const rounded = Math.round(bounded * 2) / 2;
        return String(rounded).replace(/\.0$/, '');
    }

    function formatSetSynopsis(reps, weight) {
        const repsDisplay = formatSynopsisReps(reps);
        const weightDisplay = formatSynopsisWeight(weight);
        return `${repsDisplay}x ${weightDisplay}`;
    }

    function formatSynopsisReps(value) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? String(numeric) : '—';
    }

    function formatSynopsisWeight(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return '—kg';
        }
        return `${formatSynopsisNumber(numeric)}kg`;
    }

    function formatSynopsisNumber(value) {
        if (Number.isInteger(value)) {
            return String(value);
        }
        return value
            .toFixed(2)
            .replace(/\.0+$/, '')
            .replace(/(\.\d*?)0+$/, '$1');
    }

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
        if (!plan.startDate) {
            plan.startDate = A.ymd(A.today());
            await db.put('plans', plan);
        }
        const dayIndex = A.getPlanDayIndex?.(date, plan);
        if (!dayIndex) {
            return null;
        }
        return plan.days?.[String(dayIndex)] || null;
    };

    /**
     * Met à jour le sélecteur de routine en mettant la routine planifiée en premier.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.populateRoutineSelect = async function populateRoutineSelect() {
        ensureRefs();
        if (!refs.selectRoutine) {
            return;
        }
        const all = await db.getAll('routines');
        const plannedId = await A.getPlannedRoutineId(A.activeDate);

        refs.selectRoutine.innerHTML = '<option value="">Ajouter une routine…</option>';

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
            refs.selectRoutine.appendChild(option);
        });

        refs.selectRoutine.value = plannedId || '';
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
        await updatePlannedRoutineButton();

        if (!(session?.exercises?.length)) {
            sessionList.innerHTML = '<div class="empty">Aucun exercice pour cette date.</div>';
            return;
        }

        session.exercises.forEach((exercise) => {
            const structure = listCard.createStructure({ clickable: true });
            const { card, start, body, end } = structure;
            card.dataset.exerciseId = exercise.exercise_id;

            const handle = listCard.createHandle({
                interactive: true,
                ariaLabel: "Réordonner l'exercice"
            });
            start.insertBefore(handle, body);

            const exerciseName = exercise.exercise_name || 'Exercice';

            const name = document.createElement('div');
            name.className = 'element';
            name.textContent = exerciseName;
            const setsWrapper = document.createElement('div');
            setsWrapper.className = 'session-card-sets';
            const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
            const MAX_LINES = 2;
            const BLOCKS_PER_LINE = 3;
            const MAX_BLOCKS = MAX_LINES * BLOCKS_PER_LINE;
            if (sets.length) {
                const hasOverflow = sets.length > MAX_BLOCKS;
                const displayedSets = hasOverflow
                    ? sets.slice(0, MAX_BLOCKS - 1)
                    : sets.slice(0, MAX_BLOCKS);
                const blocks = displayedSets.map((set) => {
                    const block = document.createElement('span');
                    block.className = 'session-card-set';
                    const rpeDatasetValue = getRpeDatasetValue(set.rpe);
                    if (rpeDatasetValue) {
                        block.dataset.rpe = rpeDatasetValue;
                    }
                    block.textContent = formatSetSynopsis(set.reps, set.weight);
                    return block;
                });
                if (hasOverflow) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'session-card-set session-card-set--ellipsis';
                    ellipsis.textContent = '…';
                    ellipsis.setAttribute('title', 'Autres séries');
                    blocks.push(ellipsis);
                }
                for (let lineIndex = 0; lineIndex < MAX_LINES; lineIndex += 1) {
                    const start = lineIndex * BLOCKS_PER_LINE;
                    const lineBlocks = blocks.slice(start, start + BLOCKS_PER_LINE);
                    if (!lineBlocks.length) {
                        break;
                    }
                    const line = document.createElement('div');
                    line.className = 'session-card-sets-row';
                    lineBlocks.forEach((block) => {
                        line.appendChild(block);
                    });
                    setsWrapper.appendChild(line);
                }
            }
            body.append(name, setsWrapper);

            const pencil = listCard.createIcon('✏️');
            end.appendChild(pencil);

            card.setAttribute('aria-label', `${exerciseName} — éditer`);

            makeSessionCardInteractive(card, handle, () => A.openExecEdit({
                currentId: exercise.exercise_id,
                callerScreen: 'screenSessions'
            }));

            sessionList.appendChild(card);
        });
    };

    A.reorderSessionExercises = async function reorderSessionExercises(order) {
        if (!Array.isArray(order) || !order.length) {
            return;
        }
        const dateKey = A.ymd(A.activeDate);
        const session = await db.getSession(dateKey);
        if (!session?.exercises?.length) {
            return;
        }
        const byId = new Map(session.exercises.map((item) => [item.exercise_id, item]));
        const reordered = [];
        order.forEach((id) => {
            const match = byId.get(id);
            if (match) {
                reordered.push(match);
            }
        });
        session.exercises.forEach((item) => {
            if (!reordered.includes(item)) {
                reordered.push(item);
            }
        });
        reordered.forEach((item, index) => {
            item.sort = index + 1;
        });
        session.exercises = reordered;
        await db.saveSession(session);
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

        const dateKey = A.ymd(A.activeDate);
        const session = (await db.getSession(dateKey)) || createSession(A.activeDate);
        const existing = new Set((session.exercises || []).map((exercise) => exercise.exercise_id));

        for (const id of ids) {
            if (existing.has(id)) {
                continue;
            }
            const exercise = await db.getExercise(id);
            if (!exercise) {
                continue;
            }
            session.exercises.push(
                createSessionExercise({
                    date: session.date,
                    sessionId: session.id,
                    exerciseId: exercise.id,
                    exerciseName: exercise.name || 'Exercice',
                    routineInstructions: '',
                    note: '',
                    sort: (session.exercises?.length || 0) + 1,
                    sets: []
                })
            );
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
    A.addRoutineToSession = async function addRoutineToSession(routineIds) {
        const ids = Array.isArray(routineIds) ? routineIds : [routineIds];
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
            return;
        }

        const dateKey = A.ymd(A.activeDate);
        const session = (await db.getSession(dateKey)) || createSession(A.activeDate);
        const existingIds = new Set((session.exercises || []).map((exercise) => exercise.exercise_id));

        for (const routineId of uniqueIds) {
            const routine = await db.get('routines', routineId);
            if (!routine) {
                continue;
            }
            routine.moves.forEach((move) => {
                if (existingIds.has(move.exerciseId)) {
                    return;
                }
                existingIds.add(move.exerciseId);
                session.exercises.push(
                    createSessionExercise({
                        date: session.date,
                        sessionId: session.id,
                        exerciseId: move.exerciseId,
                        exerciseName: move.exerciseName,
                        routineInstructions: typeof move.instructions === 'string' ? move.instructions : '',
                        note: '',
                        sort: session.exercises.length + 1,
                        sets: move.sets.map((set) => ({
                            pos: set.pos,
                            reps: set.reps ?? null,
                            weight: null,
                            rpe: null,
                            rest: set.rest ?? null,
                            done: false
                        }))
                    })
                );
            });
        }

        await db.saveSession(session);
        await A.renderWeek();
        await A.renderSession();
    };

    async function updatePlannedRoutineButton() {
        const { plannedRoutineRow, btnPlannedRoutine } = ensureRefs();
        if (!plannedRoutineRow || !btnPlannedRoutine) {
            return;
        }
        const plannedId = await A.getPlannedRoutineId(A.activeDate);
        if (!plannedId) {
            plannedRoutineRow.hidden = true;
            plannedRoutineState.routineId = null;
            return;
        }
        const routine = await db.get('routines', plannedId);
        if (!routine) {
            plannedRoutineRow.hidden = true;
            plannedRoutineState.routineId = null;
            return;
        }
        plannedRoutineState.routineId = plannedId;
        btnPlannedRoutine.textContent = routine.name || 'Routine planifiée';
        plannedRoutineRow.hidden = false;
    }

    /* UTILS */
    function createSession(date) {
        return {
            id: A.sessionId(date),
            date: A.sessionISO(date),
            comments: '',
            exercises: []
        };
    }

    function createSessionExercise(options = {}) {
        const {
            date,
            sessionId,
            exerciseId,
            exerciseName,
            routineInstructions,
            note,
            sort,
            sets
        } = options;
        const normalizedSets = normalizeSessionSets(sets, { sessionId, exerciseName, exerciseId, date });
        return {
            id: buildSessionExerciseId(sessionId, exerciseName || exerciseId),
            sort,
            exercise_id: exerciseId,
            exercise_name: exerciseName || 'Exercice',
            routine_instructions: routineInstructions || '',
            exercise_note: note || '',
            date,
            type: exerciseId,
            category: 'weight_reps',
            weight_unit: 'metric',
            distance_unit: 'metric',
            sets: normalizedSets
        };
    }

    function buildSessionExerciseId(sessionId, rawName) {
        const base = slugifyExerciseName(rawName || 'exercice');
        if (!sessionId) {
            return base;
        }
        return `${sessionId}_${base}`;
    }

    function buildSessionSetId(sessionId, rawName, position) {
        const base = slugifyExerciseName(rawName || 'exercice');
        const pos = String(position || 1).padStart(3, '0');
        if (!sessionId) {
            return `${base}_${pos}`;
        }
        return `${sessionId}_${base}_${pos}`;
    }

    function slugifyExerciseName(value) {
        return String(value || '')
            .trim()
            .replace(/['’\s]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'exercice';
    }

    function normalizeSessionSets(sets, context = {}) {
        const list = Array.isArray(sets) ? sets : [];
        const now = new Date().toISOString();
        return list.map((set, index) => {
            const pos = set?.pos ?? index + 1;
            const date = typeof set?.date === 'string' && set.date ? set.date : now;
            return {
                ...set,
                id: buildSessionSetId(context.sessionId, context.exerciseName || context.exerciseId, pos),
                pos,
                date,
                type: context.exerciseId,
                time: set?.time ?? null,
                distance: set?.distance ?? null,
                setType: null
            };
        });
    }
    const dragCtx = {
        active: false,
        card: null,
        handle: null,
        placeholder: null,
        pointerId: null,
        offsetY: 0,
        initialOrder: []
    };

    function makeSessionCardInteractive(card, handle, open) {
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.addEventListener('click', open);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
            }
        });

        handle.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        handle.addEventListener('pointerdown', (event) => startDrag(event, card, handle));
    }

    function startDrag(event, card, handle) {
        if (dragCtx.active) {
            return;
        }
        if (event.button !== 0 && event.pointerType !== 'touch') {
            return;
        }
        event.preventDefault();
        event.stopPropagation();

        const { sessionList } = assertRefs();
        dragCtx.active = true;
        dragCtx.card = card;
        dragCtx.handle = handle;
        dragCtx.pointerId = event.pointerId;
        dragCtx.initialOrder = getSessionOrder(sessionList);

        const rect = card.getBoundingClientRect();
        dragCtx.offsetY = event.clientY - rect.top;
        const placeholder = document.createElement('div');
        placeholder.className = 'session-card-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        dragCtx.placeholder = placeholder;

        sessionList.insertBefore(placeholder, card);
        sessionList.appendChild(card);

        card.classList.add('session-card-dragging');
        card.style.width = `${rect.width}px`;
        card.style.height = `${rect.height}px`;
        card.style.position = 'fixed';
        card.style.left = `${rect.left}px`;
        card.style.top = `${rect.top}px`;
        card.style.zIndex = '1000';
        card.style.pointerEvents = 'none';

        if (handle.setPointerCapture) {
            handle.setPointerCapture(event.pointerId);
        }
        handle.addEventListener('pointermove', onDragMove);
        handle.addEventListener('pointerup', onDragEnd);
        handle.addEventListener('pointercancel', onDragCancel);
    }

    function onDragMove(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        event.preventDefault();

        dragCtx.card.style.top = `${event.clientY - dragCtx.offsetY}px`;

        const { sessionList } = assertRefs();
        const siblings = Array.from(sessionList.children)
            .filter((node) => node !== dragCtx.card && node !== dragCtx.placeholder);

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                if (dragCtx.placeholder !== sibling) {
                    sessionList.insertBefore(dragCtx.placeholder, sibling);
                }
                return;
            }
        }
        sessionList.appendChild(dragCtx.placeholder);
    }

    async function onDragEnd(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        event.preventDefault();

        await finishDrag(true);
    }

    async function onDragCancel(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        event.preventDefault();

        await finishDrag(false);
    }

    async function finishDrag(shouldPersist) {
        const { sessionList } = assertRefs();
        const { handle } = dragCtx;

        handle?.removeEventListener('pointermove', onDragMove);
        handle?.removeEventListener('pointerup', onDragEnd);
        handle?.removeEventListener('pointercancel', onDragCancel);
        if (handle?.releasePointerCapture && dragCtx.pointerId != null) {
            handle.releasePointerCapture(dragCtx.pointerId);
        }

        if (dragCtx.placeholder && dragCtx.card) {
            sessionList.insertBefore(dragCtx.card, dragCtx.placeholder);
            dragCtx.placeholder.remove();
        }

        if (dragCtx.card) {
            dragCtx.card.classList.remove('session-card-dragging');
            dragCtx.card.style.position = '';
            dragCtx.card.style.left = '';
            dragCtx.card.style.top = '';
            dragCtx.card.style.width = '';
            dragCtx.card.style.height = '';
            dragCtx.card.style.zIndex = '';
            dragCtx.card.style.pointerEvents = '';
        }

        const newOrder = getSessionOrder(sessionList);
        const initial = dragCtx.initialOrder;

        dragCtx.active = false;
        dragCtx.card = null;
        dragCtx.handle = null;
        dragCtx.placeholder = null;
        dragCtx.pointerId = null;
        dragCtx.offsetY = 0;
        dragCtx.initialOrder = [];

        if (!shouldPersist) {
            await A.renderSession();
            return;
        }

        if (!arraysEqual(initial, newOrder)) {
            await A.reorderSessionExercises(newOrder);
            await A.renderSession();
        }
    }

    function getSessionOrder(container) {
        return Array.from(container.querySelectorAll('.exercise-card'))
            .map((node) => node.dataset.exerciseId)
            .filter(Boolean);
    }

    function arraysEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((value, index) => value === b[index]);
    }

    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.btnAddExercises = document.getElementById('btnAddExercises');
        refs.btnAddRoutines = document.getElementById('btnAddRoutines');
        refs.plannedRoutineRow = document.getElementById('plannedRoutineRow');
        refs.btnPlannedRoutine = document.getElementById('btnPlannedRoutine');
        refs.selectRoutine = document.getElementById('selectRoutine');
        refs.todayLabel = document.getElementById('todayLabel');
        refs.sessionList = document.getElementById('sessionList');
        refs.btnSessionEdit = document.getElementById('btnSessionEdit');
        refs.dlgSessionEditor = document.getElementById('dlgSessionEditor');
        refs.sessionEditorTitle = document.getElementById('sessionEditorTitle');
        refs.sessionEditorClose = document.getElementById('sessionEditorClose');
        refs.sessionEditorCancel = document.getElementById('sessionEditorCancel');
        refs.sessionComments = document.getElementById('sessionComments');
        refs.sessionCreateRoutine = document.getElementById('sessionCreateRoutine');
        refs.sessionDelete = document.getElementById('sessionDelete');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = ['todayLabel', 'sessionList'];
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

    function wireAddRoutinesButton() {
        const { btnAddRoutines } = refs;
        btnAddRoutines?.addEventListener('click', () => {
            A.openRoutineList({
                mode: 'add',
                callerScreen: 'screenSessions',
                onAdd: async (ids) => {
                    await A.addRoutineToSession(ids);
                }
            });
        });
    }

    function wirePlannedRoutineButton() {
        const { btnPlannedRoutine } = refs;
        btnPlannedRoutine?.addEventListener('click', async () => {
            if (!plannedRoutineState.routineId) {
                return;
            }
            await A.addRoutineToSession(plannedRoutineState.routineId);
        });
    }

    function wireSessionEditor() {
        const {
            btnSessionEdit,
            dlgSessionEditor,
            sessionEditorClose,
            sessionEditorCancel,
            sessionComments,
            sessionCreateRoutine,
            sessionDelete
        } = ensureRefs();
        if (!btnSessionEdit || !dlgSessionEditor) {
            return;
        }

        btnSessionEdit.addEventListener('click', () => {
            void openSessionEditor();
        });

        sessionEditorClose?.addEventListener('click', () => {
            flushSessionSave();
            dlgSessionEditor.close();
        });

        sessionEditorCancel?.addEventListener('click', () => {
            if (sessionEditorState.saveTimer) {
                clearTimeout(sessionEditorState.saveTimer);
                sessionEditorState.saveTimer = null;
            }
            if (sessionEditorState.session && sessionComments) {
                sessionEditorState.session.comments = sessionEditorState.initialComments || '';
                sessionComments.value = sessionEditorState.initialComments || '';
                void flushSessionSave();
            }
            dlgSessionEditor.close();
        });

        dlgSessionEditor.addEventListener('close', () => {
            flushSessionSave();
        });

        sessionComments?.addEventListener('input', () => {
            if (!sessionEditorState.session) {
                return;
            }
            sessionEditorState.session.comments = sessionComments.value;
            scheduleSessionSave();
        });

        sessionCreateRoutine?.addEventListener('click', () => {
            void createRoutineFromSession();
        });

        sessionDelete?.addEventListener('click', () => {
            void deleteSessionFromEditor();
        });
    }

    async function openSessionEditor() {
        const { dlgSessionEditor, sessionEditorTitle, sessionComments, sessionCreateRoutine } = ensureRefs();
        if (!dlgSessionEditor) {
            return;
        }
        const date = A.activeDate;
        if (sessionEditorTitle) {
            sessionEditorTitle.textContent = 'Éditer';
        }
        const session = await ensureSessionForDate(date);
        sessionEditorState.session = session;
        if (sessionComments) {
            sessionComments.value = session.comments || '';
            sessionEditorState.initialComments = sessionComments.value;
        }
        if (sessionCreateRoutine) {
            const hasExercises = Array.isArray(session.exercises) && session.exercises.length > 0;
            sessionCreateRoutine.disabled = !hasExercises;
        }
        dlgSessionEditor.showModal();
    }

    async function ensureSessionForDate(date) {
        const key = A.ymd(date);
        let session = await db.getSession(key);
        if (!session) {
            session = createSession(date);
            await db.saveSession(session);
            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
        }
        return session;
    }

    function scheduleSessionSave() {
        if (sessionEditorState.saveTimer) {
            clearTimeout(sessionEditorState.saveTimer);
        }
        sessionEditorState.saveTimer = setTimeout(() => {
            void flushSessionSave();
        }, 300);
    }

    async function flushSessionSave() {
        if (sessionEditorState.saveTimer) {
            clearTimeout(sessionEditorState.saveTimer);
            sessionEditorState.saveTimer = null;
        }
        if (!sessionEditorState.session) {
            return;
        }
        await db.saveSession(sessionEditorState.session);
    }

    async function createRoutineFromSession() {
        const { dlgSessionEditor } = ensureRefs();
        const session = sessionEditorState.session || await ensureSessionForDate(A.activeDate);
        const exercises = Array.isArray(session.exercises) ? session.exercises : [];
        if (!exercises.length) {
            return;
        }
        const routineId = createRoutineId();
        const routine = buildRoutineFromSession(session, routineId);
        await db.put('routines', routine);
        if (typeof A.refreshRoutineList === 'function') {
            await A.refreshRoutineList();
        }
        if (typeof A.populateRoutineSelect === 'function') {
            await A.populateRoutineSelect();
        }
        dlgSessionEditor?.close();
        if (typeof A.openRoutineEdit === 'function') {
            await A.openRoutineEdit({ routineId, callerScreen: 'screenSessions' });
        }
    }

    async function deleteSessionFromEditor() {
        const { dlgSessionEditor } = ensureRefs();
        const session = sessionEditorState.session;
        if (!session) {
            return;
        }
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Supprimer la séance',
                message: 'Supprimer la séance ?'
            })
            : confirm('Supprimer la séance ?');
        if (!confirmed) {
            return;
        }
        if (sessionEditorState.saveTimer) {
            clearTimeout(sessionEditorState.saveTimer);
            sessionEditorState.saveTimer = null;
        }
        if (session.id) {
            await db.del('sessions', session.id);
        }
        sessionEditorState.session = null;
        dlgSessionEditor?.close();
        if (typeof A.renderWeek === 'function') {
            await A.renderWeek();
        }
        if (typeof A.renderSession === 'function') {
            await A.renderSession();
        }
    }

    function buildRoutineFromSession(session, routineId) {
        const dateLabel = A.fmtUI(A.activeDate);
        const exercises = Array.isArray(session.exercises) ? session.exercises : [];
        const moves = exercises.map((exercise, index) => ({
            id: uid('move'),
            pos: index + 1,
            exerciseId: exercise.exercise_id,
            exerciseName: exercise.exercise_name || 'Exercice',
            instructions: typeof exercise.routine_instructions === 'string' ? exercise.routine_instructions : '',
            sets: Array.isArray(exercise.sets)
                ? exercise.sets.map((set, setIndex) => ({
                    pos: safeInt(set?.pos, setIndex + 1),
                    reps: safeIntOrNull(set?.reps),
                    weight: null,
                    rpe: safeFloatOrNull(set?.rpe),
                    rest: safeIntOrNull(set?.rest)
                }))
                : []
        }));

        return {
            id: routineId,
            name: `Séance ${dateLabel}`,
            icon: '🏋️',
            details: '',
            moves
        };
    }

    function createRoutineId() {
        return `routine-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
    }

    function safeInt(value, fallback) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function safeIntOrNull(value) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function safeFloatOrNull(value) {
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function uid(prefix) {
        const base = Math.random().toString(36).slice(2, 8);
        const time = Date.now().toString(36);
        return prefix ? `${prefix}-${base}-${time}` : `${base}-${time}`;
    }
})();
