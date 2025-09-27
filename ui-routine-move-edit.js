// ui-routine-move-edit.js — édition des séries prévues d'un exercice de routine
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        routineId: null,
        moveId: null,
        callerScreen: 'screenRoutineEdit',
        routine: null,
        pendingSave: null
    };
    const dragState = {
        active: false,
        row: null,
        handle: null,
        placeholder: null,
        pointerId: null,
        offsetY: 0,
        container: null,
        initialOrder: []
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireNavigation();
        wireActions();
    });

    /* ACTIONS */
    A.openRoutineMoveEdit = async function openRoutineMoveEdit(options = {}) {
        const { routineId, moveId, callerScreen = 'screenRoutineEdit' } = options;
        if (!routineId || !moveId) {
            return;
        }
        state.routineId = routineId;
        state.moveId = moveId;
        state.callerScreen = callerScreen;

        const routine = await db.get('routines', routineId);
        state.routine = normalizeRoutine(routine);
        const move = findMove();
        if (!move) {
            alert('Exercice introuvable dans la routine.');
            return;
        }

        const { routineMoveTitle } = assertRefs();
        routineMoveTitle.textContent = move.exerciseName || 'Exercice';
        renderSets();
        switchScreen('screenRoutineMoveEdit');
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
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.routineMoveTitle = document.getElementById('routineMoveTitle');
        refs.routineMoveSets = document.getElementById('routineMoveSets');
        refs.routineMoveBack = document.getElementById('routineMoveBack');
        refs.routineMoveDone = document.getElementById('routineMoveDone');
        refs.routineMoveAddSet = document.getElementById('routineMoveAddSet');
        refs.routineMoveDelete = document.getElementById('routineMoveDelete');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenRoutineMoveEdit',
            'routineMoveTitle',
            'routineMoveSets',
            'routineMoveBack',
            'routineMoveDone',
            'routineMoveAddSet',
            'routineMoveDelete'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routine-move-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const { routineMoveBack, routineMoveDone } = assertRefs();
        routineMoveBack.addEventListener('click', () => {
            returnToCaller();
        });
        routineMoveDone.addEventListener('click', () => {
            returnToCaller();
        });
    }

    function wireActions() {
        const { routineMoveAddSet, routineMoveDelete } = assertRefs();
        routineMoveAddSet.addEventListener('click', () => {
            addSet();
        });
        routineMoveDelete.addEventListener('click', () => {
            removeMove();
        });
    }

    function renderSets() {
        const move = findMove();
        const { routineMoveSets } = assertRefs();
        routineMoveSets.innerHTML = '';
        if (!move) {
            return;
        }
        const sets = Array.isArray(move.sets) ? [...move.sets].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0)) : [];
        if (!sets.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune série prévue.';
            routineMoveSets.appendChild(empty);
            return;
        }
        sets.forEach((set, index) => {
            routineMoveSets.appendChild(renderSetRow(set, index));
        });
    }

    function renderSetRow(set, index) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row routine-set-row routine-set-grid';
        row.dataset.idx = String(index);

        const handle = document.createElement('div');
        handle.className = 'routine-set-handle';
        handle.title = 'Réordonner la série';
        handle.setAttribute('role', 'button');
        handle.textContent = '⋮⋮';

        const order = document.createElement('div');
        order.textContent = index + 1;

        const reps = document.createElement('input');
        reps.type = 'number';
        reps.inputMode = 'numeric';
        reps.className = 'input';
        reps.placeholder = 'Reps';
        reps.value = set.reps ?? '';
        reps.addEventListener('input', (event) => {
            const value = readIntValue(event.currentTarget);
            updateSetField(index, 'reps', value);
        });

        const weight = document.createElement('input');
        weight.type = 'number';
        weight.step = '0.5';
        weight.inputMode = 'decimal';
        weight.className = 'input';
        weight.placeholder = 'Poids';
        weight.value = set.weight ?? '';
        weight.addEventListener('input', (event) => {
            const value = readFloatValue(event.currentTarget);
            updateSetField(index, 'weight', value);
        });

        const rest = document.createElement('input');
        rest.type = 'number';
        rest.min = '0';
        rest.step = '1';
        rest.inputMode = 'numeric';
        rest.className = 'input';
        rest.placeholder = 'Repos (s)';
        rest.value = set.rest ?? '';
        rest.addEventListener('input', (event) => {
            const value = readIntValue(event.currentTarget);
            updateSetField(index, 'rest', value);
        });

        const actions = document.createElement('div');
        actions.className = 'routine-set-actions';
        actions.appendChild(createActionButton('🗑️', 'Supprimer', () => removeSet(index)));

        row.append(handle, order, reps, weight, rest, actions);
        makeSetRowDraggable(row, handle);
        return row;
    }

    function makeSetRowDraggable(row, handle) {
        handle.addEventListener('pointerdown', (event) => startSetDrag(event, row, handle));
    }

    function startSetDrag(event, row, handle) {
        if (dragState.active) {
            return;
        }
        if (event.button !== 0 && event.pointerType !== 'touch') {
            return;
        }
        event.preventDefault();
        event.stopPropagation();

        const { routineMoveSets } = assertRefs();
        dragState.active = true;
        dragState.row = row;
        dragState.handle = handle;
        dragState.pointerId = event.pointerId;
        dragState.container = routineMoveSets;
        dragState.initialOrder = getSetOrder(routineMoveSets);

        const rect = row.getBoundingClientRect();
        dragState.offsetY = event.clientY - rect.top;

        const placeholder = document.createElement('div');
        placeholder.className = 'exec-grid exec-row routine-set-row routine-set-placeholder routine-set-grid';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        for (let i = 0; i < 6; i += 1) {
            placeholder.appendChild(document.createElement('div'));
        }
        dragState.placeholder = placeholder;

        routineMoveSets.insertBefore(placeholder, row);
        routineMoveSets.appendChild(row);

        row.classList.add('routine-set-dragging');
        row.style.width = `${rect.width}px`;
        row.style.height = `${rect.height}px`;
        row.style.position = 'fixed';
        row.style.left = `${rect.left}px`;
        row.style.top = `${rect.top}px`;
        row.style.zIndex = '1000';
        row.style.pointerEvents = 'none';

        if (handle.setPointerCapture) {
            handle.setPointerCapture(event.pointerId);
        }
        handle.addEventListener('pointermove', onSetDragMove);
        handle.addEventListener('pointerup', onSetDragEnd);
        handle.addEventListener('pointercancel', onSetDragCancel);
    }

    function onSetDragMove(event) {
        if (!dragState.active || event.pointerId !== dragState.pointerId) {
            return;
        }
        event.preventDefault();

        const { row, container } = dragState;
        if (!row || !container) {
            return;
        }
        row.style.top = `${event.clientY - dragState.offsetY}px`;

        const siblings = Array.from(container.children).filter(
            (node) => node !== row && node !== dragState.placeholder
        );

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (event.clientY < midpoint) {
                container.insertBefore(dragState.placeholder, sibling);
                return;
            }
        }
        container.appendChild(dragState.placeholder);
    }

    function onSetDragEnd(event) {
        if (!dragState.active || event.pointerId !== dragState.pointerId) {
            return;
        }
        finalizeSetDrag(false);
    }

    function onSetDragCancel(event) {
        if (!dragState.active || event.pointerId !== dragState.pointerId) {
            return;
        }
        finalizeSetDrag(true);
    }

    function finalizeSetDrag(cancelled) {
        const { handle, row, placeholder, container, pointerId } = dragState;
        if (handle?.releasePointerCapture) {
            try {
                handle.releasePointerCapture(pointerId);
            } catch (error) {
                console.warn('releasePointerCapture ignoré:', error);
            }
        }
        handle?.removeEventListener('pointermove', onSetDragMove);
        handle?.removeEventListener('pointerup', onSetDragEnd);
        handle?.removeEventListener('pointercancel', onSetDragCancel);

        if (container && row && placeholder && placeholder.parentNode === container) {
            container.insertBefore(row, placeholder);
            container.removeChild(placeholder);
        }

        if (row) {
            row.classList.remove('routine-set-dragging');
            Object.assign(row.style, {
                position: '',
                left: '',
                top: '',
                width: '',
                height: '',
                zIndex: '',
                pointerEvents: ''
            });
        }

        const order = container ? getSetOrder(container) : [];
        const changed = !cancelled && container && !ordersEqual(order, dragState.initialOrder);

        dragState.active = false;
        dragState.row = null;
        dragState.handle = null;
        dragState.placeholder = null;
        dragState.pointerId = null;
        dragState.offsetY = 0;
        dragState.container = null;
        dragState.initialOrder = [];

        if (changed) {
            applySetOrder(order);
        }
    }

    function getSetOrder(container) {
        return Array.from(container.children)
            .filter(
                (node) =>
                    node instanceof HTMLElement &&
                    node.classList.contains('routine-set-row') &&
                    !node.classList.contains('routine-set-placeholder')
            )
            .map((node) => safeInt(node.dataset.idx, -1))
            .filter((value) => value >= 0);
    }

    function applySetOrder(order) {
        const move = findMove();
        if (!move?.sets?.length) {
            return;
        }
        const sets = Array.isArray(move.sets) ? [...move.sets] : [];
        if (order.length !== sets.length) {
            return;
        }
        const newSets = order.map((index) => sets[index]).filter(Boolean);
        if (newSets.length !== sets.length) {
            return;
        }
        newSets.forEach((set, idx) => {
            set.pos = idx + 1;
        });
        move.sets = newSets;
        scheduleSave();
        renderSets();
    }

    function ordersEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((value, index) => value === b[index]);
    }

    function createActionButton(symbol, title, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn ghost btn-icon';
        button.title = title;
        button.textContent = symbol;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            handler();
        });
        return button;
    }

    function addSet() {
        const move = findMove();
        if (!move) {
            return;
        }
        const sets = Array.isArray(move.sets) ? move.sets : [];
        sets.push({
            pos: sets.length + 1,
            reps: null,
            weight: null,
            rpe: null,
            rest: null
        });
        move.sets = sets;
        scheduleSave();
        renderSets();
    }

    function updateSetField(index, field, value) {
        const move = findMove();
        if (!move) {
            return;
        }
        if (!Array.isArray(move.sets) || !move.sets[index]) {
            return;
        }
        move.sets[index] = {
            ...move.sets[index],
            [field]: value,
            pos: index + 1
        };
        scheduleSave();
    }

    function removeSet(index) {
        const move = findMove();
        if (!move) {
            return;
        }
        if (!Array.isArray(move.sets) || !move.sets[index]) {
            return;
        }
        move.sets.splice(index, 1);
        move.sets.forEach((set, idx) => {
            set.pos = idx + 1;
        });
        scheduleSave();
        renderSets();
    }

    async function removeMove() {
        if (!state.routine) {
            return;
        }
        if (!confirm('Supprimer cet exercice de la routine ?')) {
            return;
        }
        const moves = state.routine.moves || [];
        const index = moves.findIndex((move) => move.id === state.moveId);
        if (index === -1) {
            return;
        }
        moves.splice(index, 1);
        moves.forEach((move, idx) => {
            move.pos = idx + 1;
        });
        state.routine.moves = moves;
        await persistRoutine();
        returnToCaller();
    }

    function scheduleSave() {
        if (state.pendingSave) {
            clearTimeout(state.pendingSave);
        }
        state.pendingSave = setTimeout(() => {
            state.pendingSave = null;
            void persistRoutine();
        }, 250);
    }

    async function persistRoutine() {
        if (!state.routine) {
            return;
        }
        await db.put('routines', serializeRoutine(state.routine));
        await A.refreshRoutineEdit();
    }

    function normalizeRoutine(routine) {
        if (!routine) {
            return null;
        }
        return {
            id: routine.id,
            name: routine.name || 'Routine',
            icon: routine.icon || '🏋️',
            moves: Array.isArray(routine.moves)
                ? routine.moves.map((move, index) => ({
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
                }))
                : []
        };
    }

    function serializeRoutine(routine) {
        return {
            id: routine.id,
            name: routine.name,
            icon: routine.icon,
            moves: Array.isArray(routine.moves)
                ? routine.moves.map((move, index) => ({
                    id: move.id || uid('move'),
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
                : []
        };
    }

    function findMove() {
        if (!state.routine) {
            return null;
        }
        return state.routine.moves?.find((move) => move.id === state.moveId) || null;
    }

    function returnToCaller() {
        switchScreen(state.callerScreen || 'screenRoutineEdit');
        void A.refreshRoutineEdit();
    }

    function switchScreen(target) {
        const { screenSessions, screenExercises, screenExerciseEdit, screenExerciseRead, screenExecEdit, screenRoutineEdit, screenRoutineMoveEdit } = assertRefs();
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineEdit,
            screenRoutineMoveEdit
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
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

    function readIntValue(input) {
        if (!(input instanceof HTMLInputElement)) {
            return null;
        }
        return safeIntOrNull(input.value);
    }

    function readFloatValue(input) {
        if (!(input instanceof HTMLInputElement)) {
            return null;
        }
        return safeFloatOrNull(input.value);
    }

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    }
})();
