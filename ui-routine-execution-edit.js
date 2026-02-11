// ui-routine-execution-edit.js — édition des séries prévues d'un exercice de routine
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const SHEET_ANIMATION_MS = 220;
    const state = {
        routineId: null,
        moveId: null,
        callerScreen: 'screenRoutineEdit',
        routine: null,
        pendingSave: null,
        pendingFocus: null,
        replaceCallerScreen: 'screenRoutineMoveEdit'
    };
    const instructionsState = {
        move: null,
        initialDetails: ''
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
        wireDetailsDialog();
    });

    /* ACTIONS */
    A.openRoutineMoveEdit = async function openRoutineMoveEdit(options = {}) {
        const {
            routineId,
            moveId,
            callerScreen = 'screenRoutineEdit',
            focusSetIndex = null,
            focusField = null
        } = options;
        if (!routineId || !moveId) {
            return;
        }
        state.routineId = routineId;
        state.moveId = moveId;
        state.callerScreen = callerScreen;
        state.replaceCallerScreen = 'screenRoutineMoveEdit';
        if (Number.isInteger(focusSetIndex) && focusSetIndex >= 0) {
            state.pendingFocus = { index: focusSetIndex, field: focusField };
        } else {
            state.pendingFocus = null;
        }

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
        requestAnimationFrame(() => {
            refs.screenRoutineMoveEdit?.classList.add('is-active');
        });
    };

    A.openRoutineMoveMeta = async function openRoutineMoveMeta(options = {}) {
        const { routineId, moveId, callerScreen = 'screenRoutineEdit' } = options;
        if (!routineId || !moveId) {
            return;
        }
        state.routineId = routineId;
        state.moveId = moveId;
        state.callerScreen = callerScreen;
        state.replaceCallerScreen = callerScreen;
        state.pendingFocus = null;

        const routine = await db.get('routines', routineId);
        state.routine = normalizeRoutine(routine);
        const move = findMove();
        if (!move) {
            alert('Exercice introuvable dans la routine.');
            return;
        }

        const { dlgRoutineMoveEditor } = assertRefs();
        inlineKeyboard?.detach?.();
        dlgRoutineMoveEditor?.showModal();
        updateMoveOrderControls();
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
        refs.dlgRoutineMoveEditor = document.getElementById('dlgRoutineMoveEditor');
        refs.routineMoveUp = document.getElementById('routineMoveUp');
        refs.routineMoveDown = document.getElementById('routineMoveDown');
        refs.routineMoveAnnotate = document.getElementById('routineMoveAnnotate');
        refs.routineMoveDuplicate = document.getElementById('routineMoveDuplicate');
        refs.dlgRoutineMoveDetails = document.getElementById('dlgRoutineMoveDetails');
        refs.routineMoveDetailsInput = document.getElementById('routineMoveDetailsInput');
        refs.routineMoveDetailsClose = document.getElementById('routineMoveDetailsClose');
        refs.routineMoveDetailsCancel = document.getElementById('routineMoveDetailsCancel');
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
            'dlgRoutineMoveEditor',
            'routineMoveUp',
            'routineMoveDown',
            'routineMoveAnnotate',
            'routineMoveDuplicate',
            'dlgRoutineMoveDetails',
            'routineMoveDetailsInput',
            'routineMoveDetailsClose',
            'routineMoveDetailsCancel'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routine-execution-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const { routineMoveBack, routineMoveDone } = assertRefs();
        routineMoveBack.addEventListener('click', () => {
            inlineKeyboard?.detach?.();
            returnToCaller();
        });
        routineMoveDone?.addEventListener('click', () => {
            inlineKeyboard?.detach?.();
            returnToCaller();
        });
    }

    function wireActions() {
        const {
            routineMoveAddSet,
            routineMoveDelete,
            routineMoveReplace,
            routineMoveUp,
            routineMoveDown,
            routineMoveAnnotate,
            routineMoveDuplicate
        } = assertRefs();
        routineMoveAddSet.addEventListener('click', () => {
            addSet();
        });
        routineMoveDelete.addEventListener('click', () => {
            removeMove();
        });
        routineMoveReplace.addEventListener('click', () => {
            replaceMoveExercise();
        });
        routineMoveUp.addEventListener('click', () => {
            void moveRoutineExercise(-1);
        });
        routineMoveDown.addEventListener('click', () => {
            void moveRoutineExercise(1);
        });
        routineMoveAnnotate.addEventListener('click', () => {
            const { dlgRoutineMoveEditor } = assertRefs();
            if (A.closeDialog) {
                A.closeDialog(dlgRoutineMoveEditor);
            } else {
                dlgRoutineMoveEditor?.close();
            }
            void openRoutineMoveDetailsDialog();
        });
        routineMoveDuplicate.addEventListener('click', () => {
            void duplicateMove();
        });
    }

    function wireMetaDialog() {
        const { dlgRoutineMoveEditor } = assertRefs();
        dlgRoutineMoveEditor.addEventListener('click', (event) => {
            if (event.target === dlgRoutineMoveEditor) {
                if (A.closeDialog) {
                    A.closeDialog(dlgRoutineMoveEditor);
                } else {
                    dlgRoutineMoveEditor?.close();
                }
            }
        });
    }

    function wireDetailsDialog() {
        const {
            dlgRoutineMoveDetails,
            routineMoveDetailsInput,
            routineMoveDetailsClose,
            routineMoveDetailsCancel
        } = assertRefs();
        routineMoveDetailsClose.addEventListener('click', () => {
            void closeRoutineMoveDetailsDialog({ revert: false });
        });
        routineMoveDetailsCancel.addEventListener('click', () => {
            void closeRoutineMoveDetailsDialog({ revert: true });
        });
        dlgRoutineMoveDetails.addEventListener('close', () => {
            void flushRoutineMoveDetailsSave();
        });
        routineMoveDetailsInput.addEventListener('input', () => {
            if (!instructionsState.move) {
                return;
            }
            instructionsState.move.instructions_routine_exercice = routineMoveDetailsInput.value;
            scheduleSave();
        });
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
        const sets = normalizeMoveSets(move);
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
        if (state.pendingFocus) {
            const pending = state.pendingFocus;
            state.pendingFocus = null;
            requestAnimationFrame(() => focusSetCell(pending.index, pending.field));
        }
    }

    async function openRoutineMoveDetailsDialog() {
        const { dlgRoutineMoveDetails, routineMoveDetailsInput } = assertRefs();
        const move = findMove();
        if (!move) {
            return;
        }
        instructionsState.move = move;
        routineMoveDetailsInput.value = typeof move.instructions_routine_exercice === 'string'
            ? move.instructions_routine_exercice
            : '';
        instructionsState.initialDetails = routineMoveDetailsInput.value;
        dlgRoutineMoveDetails.showModal();
    }

    async function closeRoutineMoveDetailsDialog({ revert }) {
        const { dlgRoutineMoveDetails, routineMoveDetailsInput } = assertRefs();
        if (instructionsState.move) {
            const nextDetails = revert ? instructionsState.initialDetails || '' : routineMoveDetailsInput.value;
            instructionsState.move.instructions_routine_exercice = nextDetails;
            routineMoveDetailsInput.value = nextDetails;
        }
        await flushRoutineMoveDetailsSave({ refresh: !revert });
        if (A.closeDialog) {
            A.closeDialog(dlgRoutineMoveDetails);
        } else {
            dlgRoutineMoveDetails.close();
        }
        instructionsState.move = null;
    }

    async function flushRoutineMoveDetailsSave(options = {}) {
        const { refresh = false } = options;
        if (!instructionsState.move || !state.routine) {
            return;
        }
        await persistRoutine({ refresh });
    }

    function normalizeFocusField(field) {
        if (field === 'weight' || field === 'rpe' || field === 'rest' || field === 'reps') {
            return field;
        }
        return 'reps';
    }

    function focusSetCell(index, field) {
        const { routineMoveSets } = assertRefs();
        if (!routineMoveSets) {
            return;
        }
        const rows = Array.from(routineMoveSets.querySelectorAll('.routine-set-row'));
        const row = rows[index];
        if (!row) {
            return;
        }
        const normalizedField = normalizeFocusField(field);
        const selectors = {
            reps: '.exec-reps-cell',
            weight: '.exec-weight-cell',
            rpe: '.exec-rpe-cell',
            rest: '.exec-rest-cell'
        };
        const target = row.querySelector(selectors[normalizedField] || selectors.reps);
        if (target?.click) {
            target.click();
        }
    }

    function normalizeMoveSets(move) {
        if (!move) {
            return [];
        }
        const list = Array.isArray(move.sets) ? [...move.sets] : [];
        list.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        list.forEach((set, idx) => {
            set.pos = idx + 1;
        });
        move.sets = list;
        return list;
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

        const updatePreview = (source, { persist = true } = {}) => {
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
            if (persist) {
                applySetEditorResult(
                    currentIndex,
                    { reps: value.reps, weight: value.weight, rpe: value.rpe, rest: value.rest },
                    { render: false }
                );
            }
        };

        const buildKeyboardActions = (mode = 'input') => {
            const isEdit = mode === 'edit';
            const toggleAction = {
                icon: isEdit ? '🔢' : '…',
                ariaLabel: isEdit ? 'Basculer en mode saisie' : 'Basculer en mode édition',
                className: 'inline-keyboard-action--icon',
                close: false,
                onClick: () => inlineKeyboard?.setMode?.(isEdit ? 'input' : 'edit')
            };
            return [
                toggleAction,
                {
                    label: 'prévu',
                    className: 'inline-keyboard-action--span-2',
                    span: 2,
                    onClick: () => {
                        applySetEditorResult(currentIndex, {
                            reps: value.reps,
                            weight: value.weight,
                            rpe: value.rpe,
                            rest: value.rest
                        });
                    }
                },
                {
                    label: 'fermer clavier ⬇️'
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
                getValues: () => ({
                    reps: repsInput.value,
                    weight: weightInput.value,
                    rpe: rpeInput.value,
                    rest: parseRestInput(restInput.value, value.rest)
                }),
                onSelectField: (field) => selectField?.(field),
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
            updatePreview(next, { persist: false });
        };

        const resolveKeyboardLayout = (field) => {
            if (field === 'reps') {
                return 'integer';
            }
            if (field === 'rpe') {
                return 'rpe';
            }
            if (field === 'rest') {
                return 'time';
            }
            return 'default';
        };

        const attachInlineKeyboard = (input, field) => {
            if (!inlineKeyboard) {
                return;
            }
            inlineKeyboard.attach(input, {
                layout: resolveKeyboardLayout(field),
                mode: inlineKeyboard.getMode?.() || 'input',
                decimalSeparator: field === 'weight' ? ',' : undefined,
                actions: buildKeyboardActions,
                edit: {
                    onMove: (direction) => {
                        const delta = direction === 'up' ? -1 : 1;
                        const nextIndex = moveSet(currentIndex, delta, row);
                        if (nextIndex === null || nextIndex === undefined) {
                            return;
                        }
                        currentIndex = nextIndex;
                        const total = findMove()?.sets?.length ?? totalSets;
                        ensureInlineEditor()?.reposition?.(row, {
                            position: currentIndex + 1,
                            total
                        });
                    },
                    onDelete: () => {
                        removeSet(currentIndex);
                    }
                },
                getValue: () => input.value,
                onChange: (next, meta = {}) => {
                    input.value = next;
                    if (typeof meta?.caretPosition === 'number') {
                        const position = Math.max(0, Math.min(String(next).length, meta.caretPosition));
                        requestAnimationFrame(() => {
                            input.setSelectionRange(position, position);
                        });
                    }
                    if (field === 'rpe') {
                        applyRpeTone(input, next);
                    }
                    if (field === 'weight' && /[.,]$/.test(String(next))) {
                        return;
                    }
                    applyDirectChange(field, input.value);
                },
                onClose: () => {
                    input.blur();
                    ensureInlineEditor()?.close();
                }
            });
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
                attachInlineKeyboard(input, field);
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
        restInput.addEventListener('focus', () => {
            const colon = restInput.value.indexOf(':');
            const end = colon >= 0 ? colon : restInput.value.length;
            restInput.setSelectionRange(0, end);
        });
        collectInputs(repsInput, weightInput, rpeInput, restInput);
        syncRowTone();
        const selectField = (field) => {
            const map = {
                reps: repsInput,
                weight: weightInput,
                rpe: rpeInput,
                rest: restInput
            };
            const target = map[field];
            if (!target) {
                return;
            }
            attachInlineKeyboard(target, field);
        };

        row.append(order, repsInput, weightInput, rpeInput, restInput);
        return row;
    }

    function applySetEditorResult(index, values, options = {}) {
        const move = findMove();
        if (!move) {
            return;
        }
        normalizeMoveSets(move);
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
        const sets = normalizeMoveSets(move);
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
        state.pendingFocus = {
            index: sets.length - 1,
            field: 'reps'
        };
        scheduleSave();
        renderSets();
    }

    function removeSet(index) {
        const move = findMove();
        if (!move) {
            return;
        }
        normalizeMoveSets(move);
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
        const sets = normalizeMoveSets(move);
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
            const rows = Array.from(routineMoveSets.querySelectorAll('.routine-set-row'));
            const targetRow = rows[target];
            if (targetRow && targetRow !== row) {
                if (rows.indexOf(row) < target) {
                    if (targetRow.nextSibling) {
                        routineMoveSets.insertBefore(row, targetRow.nextSibling);
                    } else {
                        routineMoveSets.appendChild(row);
                    }
                } else {
                    routineMoveSets.insertBefore(row, targetRow);
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
        await persistRoutine({ refresh: false });
        if (A.closeDialog) {
            A.closeDialog(refs.dlgRoutineMoveEditor);
        } else {
            refs.dlgRoutineMoveEditor?.close();
        }
        if (!syncRoutineListRemoval(state.moveId)) {
            await A.refreshRoutineEdit();
        }
        if (isRoutineMoveEditActive()) {
            returnToCaller();
        }
    }

    async function duplicateMove() {
        if (!state.routine) {
            return;
        }
        const moves = state.routine.moves || [];
        const index = moves.findIndex((move) => move.id === state.moveId);
        if (index === -1) {
            return;
        }
        const move = moves[index];
        const copy = {
            ...move,
            id: uid('move'),
            pos: move.pos + 1,
            instructions_routine_exercice: typeof move.instructions_routine_exercice === 'string'
                ? move.instructions_routine_exercice
                : '',
            sets: Array.isArray(move.sets)
                ? move.sets.map((set, idx) => ({
                    pos: safeInt(set.pos, idx + 1),
                    reps: safeIntOrNull(set.reps),
                    weight: safeFloatOrNull(set.weight),
                    rpe: safeFloatOrNull(set.rpe),
                    rest: safeIntOrNull(set.rest)
                }))
                : []
        };
        moves.splice(index + 1, 0, copy);
        moves.forEach((item, idx) => {
            item.pos = idx + 1;
        });
        state.routine.moves = moves;
        await persistRoutine({ refresh: false });
        if (A.closeDialog) {
            A.closeDialog(refs.dlgRoutineMoveEditor);
        } else {
            refs.dlgRoutineMoveEditor?.close();
        }
        if (!syncRoutineListOrder()) {
            await A.refreshRoutineEdit();
        }
        A.ensureRoutineMoveInView?.(copy.id);
    }

    function replaceMoveExercise() {
        const move = findMove();
        if (!move) {
            return;
        }
        if (A.closeDialog) {
            A.closeDialog(refs.dlgRoutineMoveEditor);
        } else {
            refs.dlgRoutineMoveEditor?.close();
        }
        A.openExercises({
            mode: 'add',
            callerScreen: state.replaceCallerScreen || 'screenRoutineMoveEdit',
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
        const previousMoveId = move.id;
        const nextExercise = await db.get('exercises', nextId);
        if (!nextExercise) {
            alert('Exercice introuvable.');
            return;
        }
        move.exerciseId = nextId;
        move.exerciseName = nextExercise.name || nextId;
        const { routineMoveTitle } = assertRefs();
        routineMoveTitle.textContent = move.exerciseName || 'Exercice';
        await persistRoutine({ refresh: false });
        if (!syncRoutineCardReplacement(previousMoveId, move)) {
            await A.refreshRoutineEdit();
        }
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

    async function persistRoutine(options = {}) {
        const { refresh = true } = options;
        if (!state.routine) {
            return;
        }
        A.storeRoutineEditScroll?.();
        await db.put('routines', serializeRoutine(state.routine));
        if (refresh) {
            await A.refreshRoutineEdit();
        }
    }

    function updateMoveOrderControls() {
        const { routineMoveUp, routineMoveDown } = assertRefs();
        if (!state.routine?.moves?.length || !state.moveId) {
            routineMoveUp.disabled = true;
            routineMoveDown.disabled = true;
            return;
        }
        const ordered = [...state.routine.moves].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        const index = ordered.findIndex((move) => move.id === state.moveId);
        if (index === -1) {
            routineMoveUp.disabled = true;
            routineMoveDown.disabled = true;
            return;
        }
        routineMoveUp.disabled = index === 0;
        routineMoveDown.disabled = index === ordered.length - 1;
    }

    async function moveRoutineExercise(direction) {
        if (!state.routine?.moves?.length || !state.moveId) {
            return;
        }
        state.routine.moves.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        const moves = state.routine.moves;
        const index = moves.findIndex((move) => move.id === state.moveId);
        if (index === -1) {
            return;
        }
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= moves.length) {
            return;
        }
        const swap = moves[nextIndex];
        moves[nextIndex] = moves[index];
        moves[index] = swap;
        moves.forEach((move, idx) => {
            move.pos = idx + 1;
        });
        await persistRoutine({ refresh: false });
        if (!syncRoutineListOrder()) {
            await A.refreshRoutineEdit();
        }
        updateMoveOrderControls();
        A.ensureRoutineMoveInView?.(state.moveId);
    }

    function pickTextValue(...values) {
        for (const value of values) {
            if (typeof value === 'string') {
                return value;
            }
        }
        return '';
    }

    function normalizeRoutine(routine) {
        if (!routine) {
            return null;
        }
        return {
            id: routine.id,
            name: routine.name || 'Routine',
            icon: routine.icon || '🏋️',
            instructions_routine_global: pickTextValue(routine.instructions_routine_global, routine.details),
            moves: Array.isArray(routine.moves)
                ? routine.moves.map((move, index) => ({
                    id: move.id || uid('move'),
                    pos: safeInt(move.pos, index + 1),
                    exerciseId: move.exerciseId,
                    exerciseName: move.exerciseName || 'Exercice',
                    instructions_routine_exercice: pickTextValue(
                        move.instructions_routine_exercice,
                        move.details,
                        move.instructions
                    ),
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
            instructions_routine_global: routine.instructions_routine_global || '',
            moves: Array.isArray(routine.moves)
                ? routine.moves.map((move, index) => ({
                    id: move.id || uid('move'),
                    pos: safeInt(move.pos, index + 1),
                    exerciseId: move.exerciseId,
                    exerciseName: move.exerciseName,
                    instructions_routine_exercice: typeof move.instructions_routine_exercice === 'string'
                        ? move.instructions_routine_exercice
                        : '',
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
        if (A.closeDialog) {
            A.closeDialog(refs.dlgRoutineMoveEditor);
        } else {
            refs.dlgRoutineMoveEditor?.close();
        }
        const { screenRoutineMoveEdit } = assertRefs();
        if (screenRoutineMoveEdit?.classList.contains('is-active')) {
            screenRoutineMoveEdit.classList.remove('is-active');
            screenRoutineMoveEdit.classList.add('is-closing');
            setTimeout(() => {
                screenRoutineMoveEdit.classList.remove('is-closing');
                switchScreen(state.callerScreen || 'screenRoutineEdit');
                void A.refreshRoutineEdit();
            }, SHEET_ANIMATION_MS);
            return;
        }
        switchScreen(state.callerScreen || 'screenRoutineEdit');
        void A.refreshRoutineEdit();
    }

    function syncRoutineListOrder() {
        if (!isRoutineEditActive()) {
            return false;
        }
        const routineList = document.getElementById('routineList');
        if (!routineList || !state.routine?.moves?.length) {
            return false;
        }
        const cards = Array.from(routineList.querySelectorAll('.exercise-card'));
        if (!cards.length) {
            return false;
        }
        const cardMap = new Map(cards.map((card) => [card.dataset.moveId, card]));
        let updated = false;
        const ordered = [...state.routine.moves].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        ordered.forEach((move) => {
            const card = cardMap.get(move.id);
            if (card) {
                routineList.appendChild(card);
                updated = true;
            }
        });
        const empty = routineList.querySelector('.empty');
        if (empty && updated) {
            empty.remove();
        }
        return updated;
    }

    function syncRoutineListRemoval(moveId) {
        if (!isRoutineEditActive()) {
            return false;
        }
        const routineList = document.getElementById('routineList');
        if (!routineList) {
            return false;
        }
        if (!state.routine?.moves?.length) {
            routineList.innerHTML = '<div class="empty">Aucun exercice dans la routine.</div>';
            return true;
        }
        const card = findRoutineCard(routineList, moveId);
        if (!card) {
            return false;
        }
        card.remove();
        return true;
    }

    function syncRoutineCardReplacement(moveId, move) {
        if (!isRoutineEditActive()) {
            return false;
        }
        const routineList = document.getElementById('routineList');
        if (!routineList) {
            return false;
        }
        const card = findRoutineCard(routineList, moveId);
        if (!card) {
            return false;
        }
        const nextName = move.exerciseName || 'Exercice';
        card.setAttribute('aria-label', nextName);
        const titleRow = card.querySelector('.exercise-card-title-row');
        const name = document.createElement('div');
        name.className = 'element exercise-card-name';
        name.textContent = nextName;
        name.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!move.exerciseId) {
                return;
            }
            void A.openExerciseRead({ currentId: move.exerciseId, callerScreen: 'screenRoutineEdit' });
        });
        const oldName = card.querySelector('.exercise-card-name');
        if (titleRow && oldName) {
            titleRow.replaceChild(name, oldName);
        } else if (oldName) {
            oldName.replaceWith(name);
        }
        return true;
    }

    function findRoutineCard(routineList, moveId) {
        return Array.from(routineList.querySelectorAll('.exercise-card')).find((card) => card.dataset.moveId === moveId);
    }

    function isRoutineEditActive() {
        const screen = document.getElementById('screenRoutineEdit');
        return Boolean(screen && !screen.hidden);
    }

    function isRoutineMoveEditActive() {
        const screen = refs.screenRoutineMoveEdit || document.getElementById('screenRoutineMoveEdit');
        return Boolean(screen && !screen.hidden);
    }

    function switchScreen(target) {
        inlineKeyboard?.detach?.();
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
        const keepBehind = target === 'screenRoutineMoveEdit' ? state.callerScreen : null;
        Object.entries(map).forEach(([key, element]) => {
            if (!element) {
                return;
            }
            const shouldShow = key === target || (keepBehind && key === keepBehind);
            element.hidden = !shouldShow;
        });
        if (target === 'screenRoutineMoveEdit' && screenRoutineMoveEdit) {
            screenRoutineMoveEdit.classList.remove('is-closing');
        }
        if (target !== 'screenRoutineMoveEdit' && screenRoutineMoveEdit) {
            screenRoutineMoveEdit.classList.remove('is-active', 'is-closing');
        }
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
