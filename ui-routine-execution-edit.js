// ui-routine-execution-edit.js — édition des séries prévues d'un exercice de routine
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    let routineMoveSnapshot = null;
    const state = {
        routineId: null,
        moveId: null,
        callerScreen: 'screenRoutineEdit',
        routine: null,
        pendingSave: null
    };
    let inlineEditor = null;
    const inlineKeyboard = A.components?.inlineKeyboard || A.components?.createInlineKeyboard?.();
    if (inlineKeyboard && !A.components.inlineKeyboard) {
        A.components.inlineKeyboard = inlineKeyboard;
    }

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireNavigation();
        wireActions();
        wireMetaDialog();
        wireValueStates();
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

        const { routineMoveTitle, routineMoveInstructions } = assertRefs();
        routineMoveTitle.textContent = move.exerciseName || 'Exercice';
        if (routineMoveInstructions) {
            routineMoveInstructions.value = move.instructions || '';
        }
        refreshValueStates();
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
        refs.screenStatExercises = document.getElementById('screenStatExercises');
        refs.screenStatExercisesDetail = document.getElementById('screenStatExercisesDetail');
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.routineMoveTitle = document.getElementById('routineMoveTitle');
        refs.routineMoveSets = document.getElementById('routineMoveSets');
        refs.routineMoveBack = document.getElementById('routineMoveBack');
        refs.routineMoveDone = document.getElementById('routineMoveDone');
        refs.routineMoveAddSet = document.getElementById('routineMoveAddSet');
        refs.routineMoveDelete = document.getElementById('routineMoveDelete');
        refs.routineMoveReplace = document.getElementById('routineMoveReplace');
        refs.routineMoveEditMeta = document.getElementById('routineMoveEditMeta');
        refs.dlgRoutineMoveEditor = document.getElementById('dlgRoutineMoveEditor');
        refs.routineMoveInstructions = document.getElementById('routineMoveInstructions');
        refs.routineMoveEditorClose = document.getElementById('routineMoveEditorClose');
        refs.routineMoveEditorCancel = document.getElementById('routineMoveEditorCancel');
        refsResolved = true;
        return refs;
    }

    function ensureInlineEditor() {
        if (!inlineEditor) {
            const { routineMoveSets } = assertRefs();
            inlineEditor = A.components?.createInlineSetEditor?.(routineMoveSets) || null;
        }
        return inlineEditor;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenRoutineMoveEdit',
            'routineMoveTitle',
            'routineMoveSets',
            'routineMoveBack',
            'routineMoveAddSet',
            'routineMoveDelete',
            'routineMoveReplace',
            'routineMoveEditMeta',
            'dlgRoutineMoveEditor',
            'routineMoveInstructions',
            'routineMoveEditorClose',
            'routineMoveEditorCancel'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routine-execution-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const { routineMoveBack, routineMoveDone, routineMoveTitle } = assertRefs();
        routineMoveBack.addEventListener('click', () => {
            returnToCaller();
        });
        routineMoveDone?.addEventListener('click', () => {
            returnToCaller();
        });
        routineMoveTitle.addEventListener('click', () => {
            const move = findMove();
            if (!move?.exerciseId) {
                return;
            }
            void A.openExerciseRead({ currentId: move.exerciseId, callerScreen: 'screenRoutineMoveEdit' });
        });
    }

    function wireActions() {
        const { routineMoveAddSet, routineMoveDelete, routineMoveReplace } = assertRefs();
        routineMoveAddSet.addEventListener('click', () => {
            addSet();
        });
        routineMoveDelete.addEventListener('click', () => {
            removeMove();
        });
        routineMoveReplace.addEventListener('click', () => {
            replaceMoveExercise();
        });
    }

    function wireMetaDialog() {
        const {
            routineMoveEditMeta,
            dlgRoutineMoveEditor,
            routineMoveEditorClose,
            routineMoveEditorCancel,
            routineMoveInstructions
        } =
            assertRefs();
        routineMoveEditMeta.addEventListener('click', () => {
            const move = findMove();
            routineMoveSnapshot = move ? { instructions: move.instructions || '' } : null;
            if (routineMoveSnapshot) {
                routineMoveInstructions.value = routineMoveSnapshot.instructions;
                refreshValueStates();
            }
            dlgRoutineMoveEditor?.showModal();
        });
        routineMoveEditorClose.addEventListener('click', () => {
            if (state.pendingSave) {
                clearTimeout(state.pendingSave);
                state.pendingSave = null;
                void persistRoutine();
            }
            dlgRoutineMoveEditor?.close();
            routineMoveSnapshot = null;
        });
        routineMoveEditorCancel.addEventListener('click', () => {
            const move = findMove();
            if (move && routineMoveSnapshot) {
                move.instructions = routineMoveSnapshot.instructions;
                routineMoveInstructions.value = routineMoveSnapshot.instructions;
                refreshValueStates();
                if (state.pendingSave) {
                    clearTimeout(state.pendingSave);
                    state.pendingSave = null;
                }
                void persistRoutine();
            }
            dlgRoutineMoveEditor?.close();
            routineMoveSnapshot = null;
        });
        routineMoveInstructions.addEventListener('input', () => {
            const move = findMove();
            if (!move) {
                return;
            }
            move.instructions = routineMoveInstructions.value;
            scheduleSave();
        });
    }

    function wireValueStates() {
        const { routineMoveInstructions } = assertRefs();
        A.watchValueState?.(routineMoveInstructions);
    }

    function renderSets() {
        const move = findMove();
        const { routineMoveSets } = assertRefs();
        ensureInlineEditor()?.close();
        inlineKeyboard?.detach?.();
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
            routineMoveSets.appendChild(renderSetRow(set, index, sets.length));
        });
    }

    function renderSetRow(set, index, totalSets) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row routine-set-row routine-set-grid';
        row.dataset.idx = String(index);

        const order = document.createElement('div');
        order.className = 'routine-set-order';
        order.textContent = index + 1;

        let currentIndex = index;

        const value = {
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight),
            rpe: clampRpe(set.rpe),
            rest: Math.max(0, safeInt(set.rest, 0))
        };

        const inputs = [];
        const collectInputs = (...items) => {
            items.forEach((input) => {
                if (input) {
                    inputs.push(input);
                }
            });
        };

        const syncRowTone = () => {
            applyRpeTone(repsInput, value.rpe);
            applyRpeTone(weightInput, value.rpe);
        };

        const updatePreview = (source) => {
            if (!source) {
                return;
            }
            value.reps = safePositiveInt(source.reps);
            value.weight = sanitizeWeight(source.weight);
            value.rpe = source.rpe != null ? clampRpe(source.rpe) : null;
            if (source.rest != null) {
                value.rest = Math.max(0, safeInt(source.rest, value.rest));
            } else {
                const minutes = Math.max(0, safeInt(source.minutes, 0));
                const seconds = Math.max(0, safeInt(source.seconds, 0));
                value.rest = Math.max(0, minutes * 60 + seconds);
            }
            inputs.forEach((input) => input?._update?.());
            syncRowTone();
        };

        const buildKeyboardActions = (mode = 'input') => {
            const isEdit = mode === 'edit';
            const toggleAction = {
                icon: isEdit ? '🔢' : '✏️',
                ariaLabel: isEdit ? 'Basculer en mode saisie' : 'Basculer en mode édition',
                className: 'inline-keyboard-action--icon',
                close: false,
                onClick: () => inlineKeyboard?.setMode?.(isEdit ? 'input' : 'edit')
            };
            if (isEdit) {
                return [toggleAction];
            }
            return [
                toggleAction,
                {
                    label: 'prévu',
                    className: 'inline-keyboard-action--span-3',
                    span: 3,
                    onClick: () => {
                        applySetEditorResult(currentIndex, {
                            reps: value.reps,
                            weight: value.weight,
                            rpe: value.rpe,
                            rest: value.rest
                        });
                    }
                }
            ];
        };

        const openEditor = (focusField) => {
            const editor = ensureInlineEditor();
            if (!editor) {
                return;
            }
            const { minutes, seconds } = splitRest(value.rest);
            editor.open(row, {
                values: { reps: value.reps, weight: value.weight, rpe: value.rpe, minutes, seconds },
                focus: focusField,
                tone: 'black',
                order: { position: set.pos ?? currentIndex + 1, total: totalSets },
                onMove: (direction) => {
                    const delta = direction === 'up' ? -1 : 1;
                    const nextIndex = moveSet(currentIndex, delta, row);
                    if (nextIndex === null || nextIndex === undefined) {
                        return null;
                    }
                    currentIndex = nextIndex;
                    return { order: { position: currentIndex + 1 } };
                },
                actions: [
                    { id: 'plan', label: 'Planifier', variant: 'primary', full: true },
                    { id: 'delete', label: 'Supprimer', variant: 'danger', full: true }
                ],
                onApply: (actionId, payload) => {
                    if (actionId !== 'plan') {
                        return;
                    }
                    const nextValues = {
                        reps: safePositiveInt(payload.reps),
                        weight: sanitizeWeight(payload.weight),
                        rpe: payload.rpe != null ? clampRpe(payload.rpe) : null,
                        rest: Math.max(0, Math.round(payload.rest ?? 0))
                    };
                    applySetEditorResult(currentIndex, nextValues);
                },
                onDelete: () => removeSet(currentIndex),
                onChange: updatePreview,
                onClose: () => row.classList.remove('routine-set-row-active', 'set-editor-highlight'),
                onOpen: () => row.classList.add('routine-set-row-active', 'set-editor-highlight')
            });
        };

        const applyDirectChange = (field, rawValue) => {
            const next = { reps: value.reps, weight: value.weight, rpe: value.rpe, rest: value.rest };
            switch (field) {
                case 'reps':
                    next.reps = safePositiveInt(rawValue);
                    break;
                case 'weight':
                    next.weight = sanitizeWeight(rawValue);
                    break;
                case 'rpe':
                    next.rpe = rawValue === '' ? null : clampRpe(rawValue);
                    break;
                case 'rest':
                    next.rest = parseRestInput(rawValue, value.rest);
                    break;
                default:
                    return;
            }
            applySetEditorResult(currentIndex, next, { render: false });
            updatePreview(next);
        };

        const createInput = (getValue, field, extraClass = '', options = {}) => {
            const input = document.createElement('input');
            const { inputMode = inlineKeyboard ? 'none' : 'numeric', type = 'text' } = options;
            input.type = type;
            input.inputMode = inputMode;
            input.readOnly = Boolean(inlineKeyboard);
            input.className = `input set-edit-input${extraClass ? ` ${extraClass}` : ''}`;
            const update = () => {
                const valueToSet = getValue();
                input.value = String(valueToSet);
                if (field === 'rpe') {
                    applyRpeTone(input, valueToSet);
                }
            };
            input._update = update;
            update();
            input.addEventListener('focus', () => {
                input.select();
            });
            const commit = () => {
                if (field === 'rpe') {
                    applyRpeTone(input, input.value);
                }
                applyDirectChange(field, input.value);
            };
            input.addEventListener('change', commit);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    commit();
                }
            });
            input.addEventListener('click', () => {
                openEditor(field);
                inlineKeyboard?.attach?.(input, {
                    layout: field === 'rpe' ? 'rpe' : field === 'rest' ? 'time' : 'default',
                    actions: buildKeyboardActions(),
                    getValue: () => input.value,
                    onChange: (next) => {
                        input.value = next;
                        if (field === 'rpe') {
                            applyRpeTone(input, next);
                        }
                        applyDirectChange(field, input.value);
                    },
                    onClose: () => input.blur()
                });
                inlineKeyboard?.selectTarget?.(input);
            });
            return input;
        };

        const repsInput = createInput(() => formatRepsDisplay(value.reps), 'reps', 'exec-reps-cell');
        const weightInput = createInput(
            () => (value.weight == null ? '' : formatNumber(value.weight)),
            'weight',
            'exec-weight-cell',
            { inputMode: 'decimal', type: 'text' }
        );
        const rpeInput = createInput(() => (value.rpe == null ? '' : String(value.rpe)), 'rpe', 'exec-rpe-cell');
        const restInput = createInput(() => formatRestDisplay(value.rest), 'rest', 'exec-rest-cell');
        collectInputs(repsInput, weightInput, rpeInput, restInput);
        syncRowTone();

        row.append(order, repsInput, weightInput, rpeInput, restInput);
        return row;
    }

    function applySetEditorResult(index, values, options = {}) {
        const move = findMove();
        if (!move) {
            return;
        }
        if (!Array.isArray(move.sets) || !move.sets[index]) {
            return;
        }
        const shouldRender = options.render !== false;
        const rest = values.rest ?? null;
        if (rest != null) {
            updateLastRestDuration(rest);
        }
        move.sets[index] = {
            ...move.sets[index],
            reps: values.reps ?? null,
            weight: values.weight ?? null,
            rpe: values.rpe ?? null,
            rest,
            pos: index + 1
        };
        scheduleSave();
        if (shouldRender) {
            renderSets();
        }
    }

    function addSet() {
        const move = findMove();
        if (!move) {
            return;
        }
        const sets = Array.isArray(move.sets) ? move.sets : [];
        const previous = sets.length ? sets[sets.length - 1] : null;
        const defaultRest = getRestForNewSet(previous?.rest);
        const newSet = previous
            ? {
                  pos: sets.length + 1,
                  reps: previous.reps ?? null,
                  weight: previous.weight ?? null,
                  rpe: previous.rpe ?? null,
                  rest: defaultRest
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

    function refreshRoutineSetOrderUI(container) {
        if (!container) {
            return;
        }
        Array.from(container.querySelectorAll('.routine-set-row')).forEach((node, idx) => {
            node.dataset.idx = String(idx);
            const order = node.querySelector('.routine-set-order');
            if (order) {
                order.textContent = String(idx + 1);
            }
        });
    }

    function moveSet(index, delta, row) {
        const move = findMove();
        if (!move) {
            return null;
        }
        const sets = Array.isArray(move.sets) ? move.sets : [];
        const target = index + delta;
        if (target < 0 || target >= sets.length) {
            return index;
        }
        const [item] = sets.splice(index, 1);
        sets.splice(target, 0, item);
        sets.forEach((set, idx) => {
            set.pos = idx + 1;
        });
        move.sets = sets;
        const { routineMoveSets } = assertRefs();
        if (row && routineMoveSets?.contains(row)) {
            const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
            if (sibling) {
                if (delta < 0) {
                    routineMoveSets.insertBefore(row, sibling);
                } else {
                    routineMoveSets.insertBefore(sibling, row);
                }
            }
        }
        refreshRoutineSetOrderUI(routineMoveSets);
        scheduleSave();
        return target;
    }

    async function removeMove() {
        if (!state.routine) {
            return;
        }
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Supprimer un exercice',
                message: 'Supprimer cet exercice de la routine ?',
                variant: 'danger'
            })
            : confirm('Supprimer cet exercice de la routine ?');
        if (!confirmed) {
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
        refs.dlgRoutineMoveEditor?.close();
        returnToCaller();
    }

    function replaceMoveExercise() {
        const move = findMove();
        if (!move) {
            return;
        }
        refs.dlgRoutineMoveEditor?.close();
        A.openExercises({
            mode: 'add',
            callerScreen: 'screenRoutineMoveEdit',
            selectionLimit: 1,
            onAdd: (ids) => {
                const [nextId] = ids;
                if (nextId) {
                    void applyMoveReplacement(nextId);
                }
            }
        });
    }

    async function applyMoveReplacement(nextId) {
        const move = findMove();
        if (!move) {
            return;
        }
        if (move.exerciseId === nextId) {
            return;
        }
        const nextExercise = await db.get('exercises', nextId);
        if (!nextExercise) {
            alert('Exercice introuvable.');
            return;
        }
        move.exerciseId = nextId;
        move.exerciseName = nextExercise.name || nextId;
        const { routineMoveTitle } = assertRefs();
        routineMoveTitle.textContent = move.exerciseName || 'Exercice';
        await persistRoutine();
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

    function refreshValueStates() {
        A.updateValueState?.(refs.routineMoveInstructions);
    }

    function normalizeRoutine(routine) {
        if (!routine) {
            return null;
        }
        return {
            id: routine.id,
            name: routine.name || 'Routine',
            icon: routine.icon || '🏋️',
            details: routine.details || '',
            moves: Array.isArray(routine.moves)
                ? routine.moves.map((move, index) => ({
                    id: move.id || uid('move'),
                    pos: safeInt(move.pos, index + 1),
                    exerciseId: move.exerciseId,
                    exerciseName: move.exerciseName || 'Exercice',
                    instructions: typeof move.instructions === 'string' ? move.instructions : '',
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
            details: routine.details || '',
            moves: Array.isArray(routine.moves)
                ? routine.moves.map((move, index) => ({
                    id: move.id || uid('move'),
                    pos: safeInt(move.pos, index + 1),
                    exerciseId: move.exerciseId,
                    exerciseName: move.exerciseName,
                    instructions: typeof move.instructions === 'string' ? move.instructions : '',
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
        refs.dlgRoutineMoveEditor?.close();
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
            screenRoutineMoveEdit,
            screenSettings,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData
        } = assertRefs();
        const { screenStatExercises, screenStatExercisesDetail } = refs;
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
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

    function getRestDefaultDuration() {
        return Math.max(0, safeInt(A.preferences?.getRestDefaultDuration?.(), 80));
    }

    function getRestForNewSet(previousRest) {
        const restDefaultDuration = getRestDefaultDuration();
        const lastRestDuration = Math.max(0, safeInt(A.preferences?.getLastRestDuration?.(), restDefaultDuration));
        const restDefaultEnabled = A.preferences?.getRestDefaultEnabled?.() !== false;
        if (restDefaultEnabled) {
            return restDefaultDuration;
        }
        if (previousRest != null) {
            return Math.max(0, safeInt(previousRest, lastRestDuration));
        }
        return lastRestDuration;
    }

    function updateLastRestDuration(value) {
        A.preferences?.setLastRestDuration?.(value);
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
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        const bounded = Math.min(10, Math.max(5, numeric));
        return Math.round(bounded * 2) / 2;
    }

    function getRpeColorKey(value) {
        const normalized = clampRpe(value);
        if (!Number.isFinite(normalized)) {
            return null;
        }
        return String(normalized).replace(/\.0$/, '');
    }

    function applyRpeTone(element, value) {
        if (!element) {
            return;
        }
        const colorKey = getRpeColorKey(value);
        if (colorKey) {
            element.dataset.rpe = colorKey;
        } else {
            element.removeAttribute('data-rpe');
        }
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

    function formatRestDisplay(value) {
        const { minutes, seconds } = splitRest(value);
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
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

    function parseRestInput(rawValue, fallback) {
        if (rawValue == null) {
            return Math.max(0, safeInt(fallback, 0));
        }
        const text = String(rawValue).trim();
        if (!text) {
            return 0;
        }
        const parts = text.split(':');
        if (parts.length === 1) {
            return Math.max(0, safeInt(parts[0], 0));
        }
        const minutes = safeInt(parts[0], 0);
        const seconds = safeInt(parts[1], 0);
        return Math.max(0, minutes * 60 + seconds);
    }

    function rpeChip(value) {
        if (value == null || value === '') {
            return '—';
        }
        const normalized = clampRpe(value);
        if (normalized == null) {
            return '—';
        }
        const colorValue = getRpeColorKey(normalized);
        if (!colorValue) {
            return '—';
        }
        return `<span class="rpe rpe-chip" data-rpe="${colorValue}">${String(normalized)}</span>`;
    }

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    }
})();
