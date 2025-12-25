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

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        wireAddExercisesButton();
        wireAddRoutinesButton();
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
        const weekday = (date.getDay() + 6) % 7 + 1;
        return plan.days?.[String(weekday)] || null;
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

        if (!(session?.exercises?.length)) {
            sessionList.innerHTML = '<div class="empty">Aucun exercice pour cette date.</div>';
            return;
        }

        session.exercises.forEach((exercise) => {
            const structure = listCard.createStructure({ clickable: true });
            const { card, start, body, end } = structure;
            card.dataset.exerciseId = exercise.exerciseId;

            const handle = listCard.createHandle({
                interactive: true,
                ariaLabel: "Réordonner l'exercice"
            });
            start.insertBefore(handle, body);

            const exerciseName = exercise.exerciseName || 'Exercice';

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
                currentId: exercise.exerciseId,
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
        const byId = new Map(session.exercises.map((item) => [item.exerciseId, item]));
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
            item.pos = index + 1;
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
                routineInstructions: '',
                note: '',
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
    A.addRoutineToSession = async function addRoutineToSession(routineIds) {
        const ids = Array.isArray(routineIds) ? routineIds : [routineIds];
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
            return;
        }

        const dateKey = A.ymd(A.activeDate);
        const session = (await db.getSession(dateKey)) || createSession(A.activeDate);
        const existingIds = new Set((session.exercises || []).map((exercise) => exercise.exerciseId));

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
                session.exercises.push({
                    pos: session.exercises.length + 1,
                    exerciseId: move.exerciseId,
                    exerciseName: move.exerciseName,
                    routineInstructions: typeof move.instructions === 'string' ? move.instructions : '',
                    note: '',
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
        }

        await db.saveSession(session);
        await A.renderWeek();
        await A.renderSession();
    };

    /* UTILS */
    function createSession(date) {
        return {
            id: A.sessionId(date),
            date: A.sessionISO(date),
            comments: '',
            exercises: []
        };
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
        refs.selectRoutine = document.getElementById('selectRoutine');
        refs.todayLabel = document.getElementById('todayLabel');
        refs.sessionList = document.getElementById('sessionList');
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
})();
