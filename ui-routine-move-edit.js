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
        refs.screenStatsList = document.getElementById('screenStatsList');
        refs.screenStatsDetail = document.getElementById('screenStatsDetail');
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

        const order = document.createElement('div');
        order.className = 'routine-set-order';
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

        const TimePicker = A.components?.TimePicker;
        let restElement;
        if (typeof TimePicker === 'function') {
            const picker = new TimePicker({
                value: set.rest,
                defaultValue: A.preferences?.getDefaultTimerDuration?.() ?? 0,
                label: 'Repos (mm:ss)',
                onChange: (value) => {
                    updateSetField(index, 'rest', value ?? null);
                }
            });
            picker.button?.setAttribute('aria-label', `Temps de repos pour la série ${index + 1}`);
            restElement = picker.element;
        } else {
            const fallback = document.createElement('input');
            fallback.type = 'number';
            fallback.className = 'input';
            fallback.min = '0';
            fallback.step = '1';
            fallback.placeholder = 'Repos (s)';
            fallback.value = set.rest ?? '';
            fallback.addEventListener('input', (event) => {
                const value = readIntValue(event.currentTarget);
                updateSetField(index, 'rest', value);
            });
            restElement = fallback;
        }

        const actions = document.createElement('div');
        actions.className = 'routine-set-actions';
        actions.appendChild(createActionButton('🗑️', 'Supprimer', () => removeSet(index)));

        row.append(order, reps, weight, restElement, actions);
        return row;
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
        const previous = sets.length ? sets[sets.length - 1] : null;
        const defaultRest = A.preferences?.getDefaultTimerDuration?.() ?? 90;
        const newSet = previous
            ? {
                  pos: sets.length + 1,
                  reps: previous.reps ?? null,
                  weight: previous.weight ?? null,
                  rpe: previous.rpe ?? null,
                  rest: previous.rest ?? null
              }
            : {
                  pos: sets.length + 1,
                  reps: 10,
                  weight: null,
                  rpe: null,
                  rest: defaultRest
              };
        sets.push(newSet);
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
        const nextValue = field === 'rest' ? (Number.isFinite(value) ? Math.max(0, Math.round(value)) : null) : value;
        move.sets[index] = {
            ...move.sets[index],
            [field]: nextValue,
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
        const {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineEdit,
            screenRoutineMoveEdit
        } = assertRefs();
        const { screenStatsList, screenStatsDetail } = refs;
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatsList,
            screenStatsDetail
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
