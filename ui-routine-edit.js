// ui-routine-edit.js — édition d'une routine (liste + méta)
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-routine-edit: composant listCard manquant.');
    }

    /* STATE */
    const ICONS = ['🏋️', '💪', '🤸', '🏃', '🧘', '🚴', '🥊', '🏊', '🧗', '⚽'];
    const refs = {};
    let refsResolved = false;
    const state = {
        routineId: 'routine-test',
        routine: null,
        active: false,
        pendingSave: null
    };
    const dragCtx = {
        active: false,
        card: null,
        handle: null,
        placeholder: null,
        pointerId: null,
        offsetY: 0,
        initialOrder: []
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireInputs();
        wireAddExercisesButton();
        wireHeaderButtons();
    });

    /* ACTIONS */
    A.openRoutineEdit = async function openRoutineEdit(options = {}) {
        const { routineId = 'routine-test' } = options;
        state.routineId = routineId;
        state.active = true;
        await loadRoutine(true);
        renderRoutine();
        switchScreen('screenRoutineEdit');
    };

    A.refreshRoutineEdit = async function refreshRoutineEdit() {
        if (!state.routineId) {
            return;
        }
        ensureRefs();
        state.active = !refs.screenRoutineEdit?.hidden;
        await loadRoutine(true);
        if (state.active) {
            renderRoutine();
        }
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenSessions = document.getElementById('screenSessions');
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenExerciseRead = document.getElementById('screenExerciseRead');
        refs.screenExerciseEdit = document.getElementById('screenExerciseEdit');
        refs.screenExecEdit = document.getElementById('screenExecEdit');
        refs.screenRoutineList = document.getElementById('screenRoutineList');
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenStatsList = document.getElementById('screenStatsList');
        refs.screenStatsDetail = document.getElementById('screenStatsDetail');
        refs.routineName = document.getElementById('routineName');
        refs.routineIcon = document.getElementById('routineIcon');
        refs.routineList = document.getElementById('routineList');
        refs.btnRoutineAddExercises = document.getElementById('btnRoutineAddExercises');
        refs.routineEditBack = document.getElementById('routineEditBack');
        refs.routineEditOk = document.getElementById('routineEditOk');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenRoutineEdit',
            'routineName',
            'routineIcon',
            'routineList',
            'btnRoutineAddExercises',
            'routineEditBack',
            'routineEditOk'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routine-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireHeaderButtons() {
        const { routineEditBack, routineEditOk } = assertRefs();
        routineEditBack.addEventListener('click', () => {
            void A.openRoutineList();
        });
        routineEditOk.addEventListener('click', () => {
            void A.openRoutineList();
        });
    }

    async function loadRoutine(force = false) {
        if (!force && state.routine) {
            return state.routine;
        }
        const routine = await db.get('routines', state.routineId);
        state.routine = normalizeRoutine(routine || createEmptyRoutine(state.routineId));
        return state.routine;
    }

    function createEmptyRoutine(id) {
        return { id, name: 'Routine', icon: ICONS[0], moves: [] };
    }

    function normalizeRoutine(routine) {
        if (!routine) {
            return createEmptyRoutine(state.routineId);
        }
        const normalized = {
            id: routine.id || state.routineId,
            name: routine.name || 'Routine',
            icon: routine.icon || ICONS[0],
            moves: Array.isArray(routine.moves) ? [...routine.moves] : []
        };
        normalized.moves = normalized.moves.map((move, index) => ({
            id: move.id || uid('move'),
            pos: safeInt(move.pos, index + 1),
            exerciseId: move.exerciseId,
            exerciseName: move.exerciseName || 'Exercice',
            sets: Array.isArray(move.sets)
                ? move.sets.map((set, idx) => ({
                    pos: safeInt(set.pos, idx + 1),
                    reps: safeIntOrNull(set.reps),
                    weight: safeFloatOrNull(set.weight),
                    rpe: safeFloatOrNull(set.rpe),
                    rest: safeIntOrNull(set.rest)
                }))
                : []
        }));
        normalized.moves.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        return normalized;
    }

    function wireInputs() {
        const { routineName, routineIcon } = assertRefs();
        routineName.addEventListener('input', () => {
            if (!state.routine) {
                return;
            }
            state.routine.name = routineName.value.trim() || 'Routine';
            scheduleSave();
        });
        routineIcon.addEventListener('change', () => {
            if (!state.routine) {
                return;
            }
            state.routine.icon = routineIcon.value || ICONS[0];
            scheduleSave();
            renderIconPreview();
        });
    }

    function wireAddExercisesButton() {
        const { btnRoutineAddExercises } = assertRefs();
        btnRoutineAddExercises.addEventListener('click', () => {
            A.openExercises({
                mode: 'add',
                callerScreen: 'screenRoutineEdit',
                onAdd: (ids) => {
                    void addExercises(ids);
                }
            });
        });
    }

    async function addExercises(ids) {
        if (!state.routine || !Array.isArray(ids) || !ids.length) {
            return;
        }
        const existingIds = new Set(state.routine.moves.map((move) => move.exerciseId));
        for (const id of ids) {
            if (existingIds.has(id)) {
                continue;
            }
            const exercise = await db.get('exercises', id);
            if (!exercise) {
                continue;
            }
            state.routine.moves.push({
                id: uid('move'),
                pos: state.routine.moves.length + 1,
                exerciseId: exercise.id,
                exerciseName: exercise.name || 'Exercice',
                sets: []
            });
            existingIds.add(exercise.id);
        }
        await persistRoutine();
        renderRoutineList();
    }

    function renderRoutine() {
        if (!state.routine) {
            return;
        }
        populateIconSelect();
        renderIconPreview();
        const { routineName, routineIcon } = assertRefs();
        routineName.value = state.routine.name || '';
        routineIcon.value = state.routine.icon || ICONS[0];
        renderRoutineList();
    }

    function renderIconPreview() {
        const { routineIcon } = assertRefs();
        Array.from(routineIcon.options).forEach((option) => {
            option.selected = option.value === routineIcon.value;
        });
    }

    function populateIconSelect() {
        const { routineIcon } = assertRefs();
        if (routineIcon.dataset.populated === '1') {
            return;
        }
        routineIcon.innerHTML = '';
        ICONS.forEach((icon) => {
            const option = document.createElement('option');
            option.value = icon;
            option.textContent = icon;
            routineIcon.appendChild(option);
        });
        routineIcon.dataset.populated = '1';
    }

    function renderRoutineList() {
        const { routineList } = assertRefs();
        routineList.innerHTML = '';
        if (!state.routine?.moves?.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucun exercice dans la routine.';
            routineList.appendChild(empty);
            return;
        }
        const ordered = [...state.routine.moves].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        ordered.forEach((move) => {
            routineList.appendChild(renderMoveCard(move));
        });
    }

    function renderMoveCard(move) {
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, start, body, end } = structure;
        card.dataset.moveId = move.id;

        const handle = listCard.createHandle({
            interactive: true,
            ariaLabel: "Réordonner l'exercice"
        });
        start.insertBefore(handle, body);

        const name = document.createElement('div');
        name.className = 'element';
        name.textContent = move.exerciseName || 'Exercice';
        const setsWrapper = document.createElement('div');
        setsWrapper.className = 'session-card-sets';
        const sets = Array.isArray(move.sets)
            ? [...move.sets].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
            : [];
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
        } else {
            const line = document.createElement('div');
            line.className = 'session-card-sets-row';
            const emptyBlock = document.createElement('span');
            emptyBlock.className = 'session-card-set session-card-set--empty';
            emptyBlock.textContent = 'Ajouter des séries';
            line.appendChild(emptyBlock);
            setsWrapper.appendChild(line);
        }
        body.append(name, setsWrapper);

        const pencil = listCard.createIcon('✏️');
        end.appendChild(pencil);

        card.setAttribute('aria-label', `${move.exerciseName || 'Exercice'} — éditer`);
        card.addEventListener('click', () => {
            A.openRoutineMoveEdit({
                routineId: state.routineId,
                moveId: move.id,
                callerScreen: 'screenRoutineEdit'
            });
        });

        makeRoutineCardInteractive(card, handle);
        return card;
    }

    function makeRoutineCardInteractive(card, handle) {
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

        const { routineList } = assertRefs();
        dragCtx.active = true;
        dragCtx.card = card;
        dragCtx.handle = handle;
        dragCtx.pointerId = event.pointerId;
        dragCtx.initialOrder = getRoutineOrder(routineList);

        const rect = card.getBoundingClientRect();
        dragCtx.offsetY = event.clientY - rect.top;
        const placeholder = document.createElement('div');
        placeholder.className = 'session-card-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        dragCtx.placeholder = placeholder;

        routineList.insertBefore(placeholder, card);
        routineList.appendChild(card);

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

        const { routineList } = assertRefs();
        const siblings = Array.from(routineList.children)
            .filter((node) => node !== dragCtx.card && node !== dragCtx.placeholder);

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (event.clientY < midpoint) {
                routineList.insertBefore(dragCtx.placeholder, sibling);
                break;
            }
            const last = siblings[siblings.length - 1];
            if (sibling === last) {
                routineList.appendChild(dragCtx.placeholder);
            }
        }
    }

    function onDragEnd(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        finalizeDrag();
    }

    function onDragCancel(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        finalizeDrag(true);
    }

    async function finalizeDrag(cancelled = false) {
        const { routineList } = assertRefs();
        if (dragCtx.handle?.releasePointerCapture) {
            try {
                dragCtx.handle.releasePointerCapture(dragCtx.pointerId);
            } catch (error) {
                console.warn('releasePointerCapture ignoré:', error);
            }
        }
        dragCtx.handle?.removeEventListener('pointermove', onDragMove);
        dragCtx.handle?.removeEventListener('pointerup', onDragEnd);
        dragCtx.handle?.removeEventListener('pointercancel', onDragCancel);

        if (dragCtx.placeholder && dragCtx.placeholder.parentNode === routineList) {
            routineList.insertBefore(dragCtx.card, dragCtx.placeholder);
            routineList.removeChild(dragCtx.placeholder);
        }
        dragCtx.card.classList.remove('session-card-dragging');
        Object.assign(dragCtx.card.style, { position: '', left: '', top: '', width: '', height: '', zIndex: '', pointerEvents: '' });

        if (!cancelled) {
            const order = getRoutineOrder(routineList);
            if (!arraysEqual(order, dragCtx.initialOrder)) {
                applyRoutineOrder(order);
                await persistRoutine();
                renderRoutineList();
            }
        }

        dragCtx.active = false;
        dragCtx.card = null;
        dragCtx.handle = null;
        dragCtx.placeholder = null;
        dragCtx.pointerId = null;
        dragCtx.offsetY = 0;
        dragCtx.initialOrder = [];
    }

    function getRoutineOrder(container) {
        return Array.from(container.children)
            .filter((node) => node instanceof HTMLElement && node.dataset.moveId)
            .map((node, index) => ({ moveId: node.dataset.moveId, pos: index + 1 }));
    }

    function applyRoutineOrder(order) {
        if (!state.routine?.moves?.length) {
            return;
        }
        const positionMap = new Map(order.map((entry) => [entry.moveId, entry.pos]));
        state.routine.moves.forEach((move) => {
            if (positionMap.has(move.id)) {
                move.pos = positionMap.get(move.id);
            }
        });
        state.routine.moves.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    }

    async function persistRoutine() {
        if (!state.routine) {
            return;
        }
        await db.put('routines', serializeRoutine(state.routine));
        void A.refreshRoutineEdit();
        if (typeof A.refreshRoutineList === 'function') {
            void A.refreshRoutineList();
        }
        if (typeof A.populateRoutineSelect === 'function') {
            void A.populateRoutineSelect();
        }
    }

    function scheduleSave() {
        if (state.pendingSave) {
            clearTimeout(state.pendingSave);
        }
        state.pendingSave = setTimeout(() => {
            state.pendingSave = null;
            void persistRoutine();
        }, 300);
    }

    function serializeRoutine(routine) {
        return {
            id: routine.id,
            name: routine.name,
            icon: routine.icon,
            moves: routine.moves.map((move, index) => ({
                id: move.id,
                pos: safeInt(move.pos, index + 1),
                exerciseId: move.exerciseId,
                exerciseName: move.exerciseName,
                sets: Array.isArray(move.sets)
                    ? move.sets.map((set, idx) => ({
                        pos: safeInt(set.pos, idx + 1),
                        reps: safeIntOrNull(set.reps),
                        weight: safeFloatOrNull(set.weight),
                        rpe: safeFloatOrNull(set.rpe),
                        rest: safeIntOrNull(set.rest)
                    }))
                    : []
            }))
        };
    }

    function arraysEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((entry, index) => {
            const other = b[index];
            return entry.moveId === other.moveId && entry.pos === other.pos;
        });
    }

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
        return `${repsDisplay}•${weightDisplay}`;
    }

    function formatSynopsisReps(value) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? String(numeric) : '—';
    }

    function formatSynopsisWeight(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return '—';
        }
        return `${formatSynopsisNumber(numeric)}k`;
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

    function safeInt(value, fallback = null) {
        const number = Number.parseInt(value, 10);
        return Number.isFinite(number) ? number : fallback;
    }

    function safeFloatOrNull(value) {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) ? number : null;
    }

    function safeIntOrNull(value) {
        const number = Number.parseInt(value, 10);
        return Number.isFinite(number) ? number : null;
    }

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    }

    function switchScreen(target) {
        const {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenRoutineList
        } = assertRefs();
        const { screenStatsList, screenStatsDetail } = refs;
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineEdit,
            screenRoutineList,
            screenRoutineMoveEdit,
            screenStatsList,
            screenStatsDetail
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
        state.active = target === 'screenRoutineEdit';
    }
})();
