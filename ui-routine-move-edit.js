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

        const value = {
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight),
            rpe: clampRpe(set.rpe),
            rest: Math.max(0, safeInt(set.rest, 0))
        };

        const title = `Série ${index + 1}`;

        const openEditor = (focusField) => {
            const SetEditor = A.components?.SetEditor;
            if (!SetEditor?.open) {
                return;
            }
            const { minutes, seconds } = splitRest(value.rest);
            SetEditor.open({
                title,
                values: {
                    reps: value.reps,
                    weight: value.weight,
                    rpe: value.rpe,
                    minutes,
                    seconds
                },
                focus: focusField
            }).then((result) => {
                if (!result) {
                    return;
                }
                const nextValues = {
                    reps: safePositiveInt(result.reps),
                    weight: sanitizeWeight(result.weight),
                    rpe: result.rpe != null ? clampRpe(result.rpe) : null,
                    rest: Math.max(0, Math.round((result.minutes ?? 0) * 60 + (result.seconds ?? 0)))
                };
                applySetEditorResult(index, nextValues);
            });
        };

        const createButton = (getText, focusField, extraClass = '') => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn ghost set-edit-button${extraClass ? ` ${extraClass}` : ''}`;
            button.addEventListener('click', () => openEditor(focusField));
            const update = () => {
                button.textContent = getText();
            };
            button._update = update;
            update();
            return button;
        };

        const repsButton = createButton(() => formatRepsDisplay(value.reps), 'reps');
        const weightButton = createButton(() => formatWeightValue(value.weight), 'weight');
        const rpeButton = createButton(() => formatRpeDisplay(value.rpe), 'rpe');
        const restMinutesButton = createButton(() => formatRestMinutes(value.rest), 'minutes', 'exec-rest-cell');
        const restSecondsButton = createButton(() => formatRestSeconds(value.rest), 'seconds', 'exec-rest-cell');

        const actions = document.createElement('div');
        actions.className = 'routine-set-actions';
        actions.appendChild(createActionButton('🗑️', 'Supprimer', () => removeSet(index)));

        row.append(order, repsButton, weightButton, rpeButton, restMinutesButton, restSecondsButton, actions);
        return row;
    }

    function applySetEditorResult(index, values) {
        const move = findMove();
        if (!move) {
            return;
        }
        if (!Array.isArray(move.sets) || !move.sets[index]) {
            return;
        }
        move.sets[index] = {
            ...move.sets[index],
            reps: values.reps ?? null,
            weight: values.weight ?? null,
            rpe: values.rpe ?? null,
            rest: values.rest ?? null,
            pos: index + 1
        };
        scheduleSave();
        renderSets();
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

    function safePositiveInt(value) {
        const numeric = safeInt(value, 0);
        return numeric > 0 ? numeric : 0;
    }

    function sanitizeWeight(value) {
        if (value == null || value === '') {
            return null;
        }
        const numeric = Number.parseFloat(String(value).replace(',', '.'));
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Math.max(0, Math.round(numeric * 100) / 100);
    }

    function clampRpe(value) {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Math.max(5, Math.min(10, numeric));
    }

    function splitRest(value) {
        const total = Math.max(0, safeInt(value, 0));
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return { minutes, seconds };
    }

    function formatRepsDisplay(value) {
        return String(value ?? 0);
    }

    function formatWeightValue(value) {
        if (value == null) {
            return '—';
        }
        return formatNumber(value);
    }

    function formatRpeDisplay(value) {
        return value == null ? '—' : String(value);
    }

    function formatRestMinutes(value) {
        const { minutes } = splitRest(value);
        return String(minutes);
    }

    function formatRestSeconds(value) {
        const { seconds } = splitRest(value);
        return String(seconds).padStart(2, '0');
    }

    function formatNumber(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '0';
        }
        if (Number.isInteger(numeric)) {
            return String(numeric);
        }
        return numeric
            .toFixed(2)
            .replace(/\.0+$/, '')
            .replace(/(\.\d*?)0+$/, '$1');
    }

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    }
})();
