// ui-session-execution-edit.js — édition d'une exécution de séance (séries + timer)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    let execMoveSnapshot = null;
    const state = {
        dateKey: null,
        exerciseId: null,
        callerScreen: 'screenSessions',
        session: null,
        metaMode: 'history'
    };
    const medalIconMap = {
        progress: {
            icon: 'icons/badge_progress.svg',
            className: 'exec-medal--progress',
            label: 'Progression sur la série'
        },
        reps: {
            icon: 'icons/badge_reps.svg',
            className: 'exec-medal--reps',
            label: 'Record reps à ce poids'
        },
        orm: {
            icon: 'icons/badge-1rm.svg',
            className: 'exec-medal--danger',
            label: 'Record 1RM'
        },
        weight: {
            icon: 'icons/badge-kg.svg',
            className: 'exec-medal--kg',
            label: 'Record poids'
        },
        new: {
            icon: 'icons/badge-new.svg',
            className: 'exec-medal--new',
            label: 'Première séance'
        }
    };
    let inlineEditor = null;
    const inlineKeyboard = A.components?.inlineKeyboard || A.components?.createInlineKeyboard?.();
    if (inlineKeyboard && !A.components.inlineKeyboard) {
        A.components.inlineKeyboard = inlineKeyboard;
    }

    const defaultTimerState = () => ({
        running: false,
        startSec: 0,
        remainSec: 0,
        intervalId: null,
        attachment: null
    });

    const defaultTimerVisibility = () => ({
        hidden: true
    });

    let execTimer = A.execTimer;
    if (!execTimer) {
        execTimer = defaultTimerState();
    } else {
        execTimer.running = Boolean(execTimer.running);
        execTimer.startSec = safeInt(execTimer.startSec, 0);
        execTimer.remainSec = safeInt(execTimer.remainSec, 0);
        execTimer.intervalId = execTimer.intervalId ?? null;
        execTimer.attachment = execTimer.attachment ?? null;
    }
    A.execTimer = execTimer;
    let timerVisibility = A.timerVisibility;
    if (!timerVisibility) {
        timerVisibility = defaultTimerVisibility();
    } else {
        timerVisibility.hidden = Boolean(timerVisibility.hidden);
    }
    A.timerVisibility = timerVisibility;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireNavigation();
        wireActions();
        wireMetaDialog();
        wireTimerControls();
        wireValueStates();
    });

    /* ACTIONS */
    A.openExecEdit = async function openExecEdit(options = {}) {
        const { currentId, callerScreen = 'screenSessions' } = options;
        if (!currentId) {
            return;
        }

        const date = A.activeDate || A.today();
        const dateKey = A.ymd(date);
        const session = await db.getSession(dateKey);
        if (!session) {
            alert('Aucune séance pour cette date.');
            return;
        }
        const exercise = Array.isArray(session.exercises)
            ? session.exercises.find((item) => item.exercise_id === currentId)
            : null;
        if (!exercise) {
            alert('Exercice introuvable dans la séance.');
            return;
        }

        normalizeExerciseSets(exercise);

        state.dateKey = dateKey;
        state.exerciseId = currentId;
        state.callerScreen = callerScreen;
        state.session = session;
        const { execTitle, execDate, execRoutineInstructions, execMoveNote } = assertRefs();
        execTitle.textContent = exercise.exercise_name || 'Exercice';
        execDate.textContent = A.fmtUI(date);
        if (execRoutineInstructions) {
            execRoutineInstructions.value = exercise.routine_instructions || '';
        }
        if (execMoveNote) {
            execMoveNote.value = exercise.exercise_note || '';
        }
        refreshValueStates();
        setMetaMode('history');

        updateTimerUI();
        switchScreen('screenExecEdit');
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
        refs.tabSessions = document.getElementById('tabSessions');
        refs.execBack = document.getElementById('execBack');
        refs.execEditMeta = document.getElementById('execEditMeta');
        refs.execTitle = document.getElementById('execTitle');
        refs.execDate = document.getElementById('execDate');
        refs.execDelete = document.getElementById('execDelete');
        refs.execAddSet = document.getElementById('execAddSet');
        refs.execSets = document.getElementById('execSets');
        refs.execSetsLayout = document.getElementById('execSetsLayout');
        refs.execMetaHeader = document.getElementById('execMetaHeader');
        refs.execTimerBar = document.getElementById('execTimerBar');
        refs.timerDetails = document.getElementById('tmrDetails');
        refs.timerDisplay = document.getElementById('tmrDisplay');
        refs.timerToggle = document.getElementById('tmrToggle');
        refs.timerMinus = document.getElementById('tmrMinus');
        refs.timerPlus = document.getElementById('tmrPlus');
        refs.timerReset = document.getElementById('tmrReset');
        refs.dlgExecMoveEditor = document.getElementById('dlgExecMoveEditor');
        refs.execRoutineInstructions = document.getElementById('execRoutineInstructions');
        refs.execMoveNote = document.getElementById('execMoveNote');
        refs.execReplaceExercise = document.getElementById('execReplaceExercise');
        refs.execMoveEditorClose = document.getElementById('execMoveEditorClose');
        refs.execMoveEditorCancel = document.getElementById('execMoveEditorCancel');
        refs.execMetaToggle = document.getElementById('execMetaToggle');
        refsResolved = true;
        return refs;
    }

    function ensureInlineEditor() {
        if (!inlineEditor) {
            const { execSets } = assertRefs();
            inlineEditor = A.components?.createInlineSetEditor?.(execSets) || null;
        }
        return inlineEditor;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenExecEdit',
            'execBack',
            'execEditMeta',
            'execTitle',
            'execDate',
            'execDelete',
            'execAddSet',
            'execSets',
            'execTimerBar',
            'timerDetails',
            'timerDisplay',
            'timerToggle',
            'timerMinus',
            'timerPlus',
            'timerReset',
            'dlgExecMoveEditor',
            'execRoutineInstructions',
            'execMoveNote',
            'execReplaceExercise',
            'execMoveEditorClose',
            'execMoveEditorCancel',
            'execMetaToggle',
            'execMetaHeader'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-session-execution-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const { execBack, execTitle } = assertRefs();
        execBack.addEventListener('click', () => {
            inlineKeyboard?.detach?.();
            backToCaller();
        });
        execTitle.addEventListener('click', () => {
            if (!state.exerciseId) {
                return;
            }
            inlineKeyboard?.detach?.();
            void A.openExerciseRead({ currentId: state.exerciseId, callerScreen: 'screenExecEdit' });
        });
    }

    function wireActions() {
        const { execAddSet, execDelete, execReplaceExercise, execMetaToggle } = assertRefs();
        execAddSet.addEventListener('click', () => {
            void addSet();
        });
        execDelete.addEventListener('click', () => {
            void removeExercise();
        });
        execReplaceExercise.addEventListener('click', () => {
            void replaceExercise();
        });
        execMetaToggle.addEventListener('click', () => {
            const nextMode = getNextMetaMode();
            setMetaMode(nextMode);
        });
    }

    function wireMetaDialog() {
        const { execEditMeta, dlgExecMoveEditor, execMoveEditorClose, execMoveEditorCancel, execMoveNote } =
            assertRefs();
        execEditMeta.addEventListener('click', () => {
            const exercise = getExercise();
            execMoveSnapshot = exercise ? { note: exercise.exercise_note || '' } : null;
            if (execMoveSnapshot) {
                execMoveNote.value = execMoveSnapshot.note;
                refreshValueStates();
            }
            inlineKeyboard?.detach?.();
            dlgExecMoveEditor?.showModal();
        });
        execMoveEditorClose.addEventListener('click', () => {
            dlgExecMoveEditor?.close();
            execMoveSnapshot = null;
        });
        execMoveEditorCancel.addEventListener('click', () => {
            const exercise = getExercise();
            if (exercise && execMoveSnapshot) {
                exercise.exercise_note = execMoveSnapshot.note;
                execMoveNote.value = execMoveSnapshot.note;
                refreshValueStates();
                void persistSession(false);
            }
            dlgExecMoveEditor?.close();
            execMoveSnapshot = null;
        });
        execMoveNote.addEventListener('input', () => {
            const exercise = getExercise();
            if (!exercise) {
                return;
            }
            exercise.exercise_note = execMoveNote.value;
            void persistSession(false);
        });
    }

    function wireValueStates() {
        const { execRoutineInstructions, execMoveNote } = assertRefs();
        A.watchValueState?.([execRoutineInstructions, execMoveNote]);
    }

    function wireTimerControls() {
        const { execTimerBar, timerToggle, timerMinus, timerPlus, timerReset } = assertRefs();
        timerToggle.addEventListener('click', () => {
            const timer = ensureSharedTimer();
            if (timer.running) {
                pauseTimer();
            } else {
                resumeTimer();
            }
        });
        timerMinus.addEventListener('click', () => {
            void adjustTimer(-10);
        });
        timerPlus.addEventListener('click', () => {
            void adjustTimer(10);
        });
        timerReset.addEventListener('click', () => {
            resetTimerToDefault();
            setTimerVisibility({ hidden: true });
        });
    }

    function getMetaModeLabel(mode = state.metaMode) {
        switch (mode) {
            case 'goals':
                return 'Objectifs';
            case 'medals':
                return 'Médailles';
            default:
                return 'Historique';
        }
    }

    function getMetaTagLabel(mode = state.metaMode) {
        return `Mode : ${getMetaModeLabel(mode)}`;
    }

    function getNextMetaMode() {
        const order = ['history', 'goals', 'medals'];
        const currentIndex = order.indexOf(state.metaMode);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
        return order[nextIndex];
    }

    function setMetaMode(nextMode) {
        const { execMetaToggle } = assertRefs();
        const mode = nextMode || 'history';
        state.metaMode = mode;
        execMetaToggle.textContent = getMetaTagLabel(mode);
        execMetaToggle.classList.toggle('selected', true);
        execMetaToggle.setAttribute('aria-pressed', 'true');
        execMetaToggle.setAttribute('aria-label', getMetaTagLabel(mode));
        void renderSets();
    }

    function normalizeExerciseSets(exercise) {
        exercise.exercise_note = typeof exercise.exercise_note === 'string' ? exercise.exercise_note : '';
        exercise.routine_instructions =
            typeof exercise.routine_instructions === 'string' ? exercise.routine_instructions : '';
        const defaultRest = getDefaultRest();
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const normalized = sets.map((set, index) => ({
            ...set,
            pos: safeInt(set.pos, index + 1),
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight),
            rpe: set.rpe != null && set.rpe !== '' ? clampRpe(set.rpe) : null,
            rest: Math.max(0, safeInt(set.rest, defaultRest)),
            done: set.done === true,
            time: set.time ?? null,
            distance: set.distance ?? null,
            setType: set.setType ?? null
        }));
        normalized.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        normalized.forEach((set, index) => {
            set.pos = index + 1;
        });
        exercise.sets = normalized;
    }

    async function renderSets() {
        const exercise = getExercise();
        const { execSets, execMetaHeader } = assertRefs();
        ensureInlineEditor()?.close();
        inlineKeyboard?.detach?.();
        execSets.innerHTML = '';
        if (!exercise) {
            if (execMetaHeader) {
                execMetaHeader.textContent = getMetaHeaderLabel();
            }
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const meta = await buildSetMeta(exercise, sets);
        if (execMetaHeader) {
            execMetaHeader.textContent = getMetaHeaderLabel();
        }
        if (!sets.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune série prévue.';
            execSets.appendChild(empty);
        } else {
            sets.forEach((set, index) => {
                execSets.appendChild(renderSetRow(set, index, sets.length, meta));
            });
        }
    }

    async function refreshSetMetaFrom(startIndex = 0) {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        const { execSets } = assertRefs();
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (!sets.length) {
            return;
        }
        const meta = await buildSetMeta(exercise, sets);
        const rows = Array.from(execSets.querySelectorAll('.exec-set-row'));
        rows.forEach((row, index) => {
            if (index < startIndex || !sets[index]) {
                return;
            }
            const metaCell = row.querySelector('.exec-meta-cell');
            const nextMeta = buildMetaCell(sets[index], index, meta);
            if (metaCell) {
                row.replaceChild(nextMeta, metaCell);
            } else {
                row.appendChild(nextMeta);
            }
        });
    }

    function getMetaHeaderLabel() {
        return getMetaModeLabel(state.metaMode);
    }

    function buildMetaCell(set, index, meta) {
        const cell = document.createElement('div');
        cell.className = 'exec-meta-cell';
        const pos = safeInt(set?.pos, index + 1);
        if (state.metaMode === 'history' || state.metaMode === 'goals') {
            const map = state.metaMode === 'history' ? meta?.historyByPos : meta?.goalsByPos;
            const info = map?.get?.(pos) || null;
            const chip = document.createElement('div');
            chip.className = 'exec-history-set rpe-chip exec-meta-chip';
            chip.textContent = info?.text ?? '—';
            applyRpeTone(chip, info?.rpe);
            cell.appendChild(chip);
            return cell;
        }
        const medals = meta?.medalsByPos?.get?.(pos) || [];
        if (!medals.length) {
            return cell;
        }
        const list = document.createElement('div');
        list.className = 'exec-meta-medals';
        medals.forEach((medalKey) => {
            const medalConfig = medalIconMap[medalKey];
            if (!medalConfig) {
                return;
            }
            const badge = document.createElement('span');
            badge.className = `exec-medal ${medalConfig.className}`;
            badge.title = medalConfig.label;
            const icon = document.createElement('img');
            icon.src = medalConfig.icon;
            icon.alt = medalConfig.label;
            icon.className = 'exec-medal-icon';
            badge.appendChild(icon);
            list.appendChild(badge);
        });
        cell.appendChild(list);
        return cell;
    }

    function renderSetRow(set, index, totalSets, meta) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row routine-set-grid routine-set-grid--with-meta exec-set-row';
        row.classList.add(set.done === true ? 'exec-set-executed' : 'exec-set-planned');
        row.dataset.index = String(index);

        const order = document.createElement('div');
        order.className = 'routine-set-order';
        order.textContent = set.pos ?? index + 1;

        let currentIndex = index;

        const value = {
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight),
            rpe: set.rpe != null && set.rpe !== '' ? clampRpe(set.rpe) : null,
            rest: Math.max(0, safeInt(set.rest, getDefaultRest()))
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
            value.rpe = source.rpe != null && source.rpe !== '' ? clampRpe(source.rpe) : null;
            if (source.rest != null) {
                value.rest = Math.max(0, safeInt(source.rest, value.rest));
            } else {
                const minutes = safeInt(source.minutes, 0);
                const seconds = safeInt(source.seconds, 0);
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
            return [
                toggleAction,
                {
                    label: 'prévu',
                    className: 'inline-keyboard-action--muted',
                    onClick: async () => {
                        await applySetEditorResult(
                            currentIndex,
                            { reps: value.reps, weight: value.weight, rpe: value.rpe, rest: value.rest },
                            { done: false }
                        );
                    }
                },
                {
                    label: 'fait',
                    className: 'inline-keyboard-action--emphase inline-keyboard-action--span-2',
                    span: 2,
                    onClick: async () => {
                        await applySetEditorResult(
                            currentIndex,
                            { reps: value.reps, weight: value.weight, rpe: value.rpe, rest: value.rest },
                            { done: true }
                        );
                        startTimer(value.rest, { setId: set.id, setIndex: currentIndex });
                    }
                }
            ];
        };

        let selectField = null;
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
                onSelectField: (field) => selectField?.(field),
                onMove: async (direction) => {
                    const delta = direction === 'up' ? -1 : 1;
                    const nextIndex = await moveSet(currentIndex, delta, row);
                    if (nextIndex === null || nextIndex === undefined) {
                        return null;
                    }
                    currentIndex = nextIndex;
                    return { order: { position: currentIndex + 1 } };
                },
                actions: [
                    { id: 'plan', label: 'Planifier', variant: 'ghost', full: true },
                    { id: 'save', label: 'Enregistrer', variant: 'primary', full: true },
                    { id: 'delete', label: 'Supprimer', variant: 'danger', full: true }
                ],
                onApply: async (actionId, payload) => {
                    if (actionId === 'delete') {
                        await removeSet(currentIndex);
                        return;
                    }
                    const sanitized = sanitizeEditorResult(payload, value.rest);
                    const markDone = actionId === 'save';
                    await applySetEditorResult(currentIndex, sanitized, { done: markDone });
                    if (markDone) {
                        startTimer(sanitized.rest, { setId: set.id, setIndex: currentIndex });
                    }
                },
                onDelete: () => removeSet(currentIndex),
                onChange: updatePreview,
                onClose: () => row.classList.remove('routine-set-row-active', 'set-editor-highlight'),
                onOpen: () => row.classList.add('routine-set-row-active', 'set-editor-highlight')
            });
        };

        const applyDirectChange = async (field, rawValue) => {
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
            const currentDone = getExercise()?.sets?.[currentIndex]?.done ?? set.done;
            const markDone = rawValue !== '' ? true : currentDone;
            await applySetEditorResult(currentIndex, next, { done: markDone, render: false });
            updatePreview(next);
            row.classList.toggle('exec-set-executed', markDone);
            row.classList.toggle('exec-set-planned', !markDone);
            await refreshSetMetaFrom(currentIndex);
        };

        const createInput = (getValue, field, extraClass = '', options = {}) => {
            const input = document.createElement('input');
            const { inputMode = inlineKeyboard ? 'none' : 'numeric', type = 'text', html = false } = options;
            input.type = type;
            input.inputMode = inputMode;
            input.readOnly = Boolean(inlineKeyboard);
            input.className = `input set-edit-input${extraClass ? ` ${extraClass}` : ''}`;
            const update = () => {
                const content = getValue();
                input.value = html ? content.replace(/<[^>]+>/g, '') : String(content);
                if (field === 'rpe') {
                    applyRpeTone(input, content);
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
                void applyDirectChange(field, input.value);
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
                    actions: buildKeyboardActions,
                    edit: {
                        onMove: async (direction) => {
                            const delta = direction === 'up' ? -1 : 1;
                            const nextIndex = await moveSet(currentIndex, delta, row);
                            if (nextIndex === null || nextIndex === undefined) {
                                return;
                            }
                            currentIndex = nextIndex;
                            ensureInlineEditor()?.reposition?.(row, {
                                position: currentIndex + 1,
                                total: getExercise()?.sets?.length ?? totalSets
                            });
                        },
                        onDelete: async () => {
                            await removeSet(currentIndex);
                        }
                    },
                    getValue: () => input.value,
                    onChange: (next) => {
                        input.value = next;
                        if (field === 'rpe') {
                            applyRpeTone(input, next);
                        }
                        void applyDirectChange(field, input.value);
                    },
                    onClose: () => {
                        input.blur();
                        ensureInlineEditor()?.close();
                    }
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
        selectField = (field) => {
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
            target.focus({ preventScroll: true });
            target.select?.();
            inlineKeyboard?.selectTarget?.(target);
        };

        const metaCell = buildMetaCell(set, index, meta);
        row.append(order, repsInput, weightInput, rpeInput, restInput, metaCell);
        return row;
    }

    async function buildSetMeta(exercise, currentSets = []) {
        const exerciseId = exercise?.exercise_id;
        const weightUnit = exercise?.weight_unit === 'imperial' ? 'lb' : 'kg';
        const previous = await findPreviousSessionForHistory(exerciseId);
        const previousSets = Array.isArray(previous?.exercise?.sets) ? [...previous.exercise.sets] : [];
        previousSets.sort((a, b) => safeInt(a?.pos, 0) - safeInt(b?.pos, 0));
        const historyByPos = buildHistorySetMap(previousSets, weightUnit);
        const goalsByPos = buildHistorySetMap(previousSets, weightUnit);
        const medalsByPos = await buildMedalMap(exerciseId, currentSets);
        return { historyByPos, goalsByPos, medalsByPos };
    }

    function buildHistorySetMap(sets, weightUnit) {
        const map = new Map();
        (Array.isArray(sets) ? sets : []).forEach((set, index) => {
            const pos = safeInt(set?.pos, index + 1);
            map.set(pos, {
                text: formatHistorySetLine(set, weightUnit),
                rpe: set?.rpe ?? null
            });
        });
        return map;
    }

    async function buildMedalMap(exerciseId, currentSets = []) {
        const previousSets = await collectPreviousExerciseSets(exerciseId);
        if (!previousSets.length) {
            const medalsByPos = new Map();
            (Array.isArray(currentSets) ? currentSets : []).forEach((set, index) => {
                const pos = safeInt(set?.pos, index + 1);
                const medals = [];
                if (pos === 1) {
                    medals.push('new');
                }
                medalsByPos.set(pos, medals);
            });
            return medalsByPos;
        }
        let maxWeight = 0;
        let maxOrm = 0;
        const maxRepsByWeight = new Map();
        const bestByPos = new Map();
        previousSets.forEach((set, index) => {
            const pos = safeInt(set?.pos, index + 1);
            const weight = sanitizeWeight(set?.weight);
            const reps = safePositiveInt(set?.reps);
            if (weight != null) {
                maxWeight = Math.max(maxWeight, weight);
            }
            const orm = estimateOrm(weight, reps);
            if (orm != null) {
                maxOrm = Math.max(maxOrm, orm);
            }
            if (weight != null && reps > 0) {
                const key = normalizeWeightKey(weight);
                const bestReps = maxRepsByWeight.get(key) ?? 0;
                if (reps > bestReps) {
                    maxRepsByWeight.set(key, reps);
                }
            }
            if (weight != null) {
                const currentBest = bestByPos.get(pos);
                if (
                    !currentBest ||
                    weight > currentBest.weight ||
                    (weight === currentBest.weight && reps > currentBest.reps)
                ) {
                    bestByPos.set(pos, { weight, reps });
                }
            }
        });
        let weightRecordAssigned = false;
        let ormRecordAssigned = false;
        let repsRecordAssigned = false;
        const medalsByPos = new Map();
        (Array.isArray(currentSets) ? currentSets : []).forEach((set, index) => {
            const pos = safeInt(set?.pos, index + 1);
            const done = set?.done === true;
            const weight = sanitizeWeight(set?.weight);
            const reps = safePositiveInt(set?.reps);
            const medals = [];
            if (!done) {
                medalsByPos.set(pos, medals);
                return;
            }
            if (!weightRecordAssigned && weight != null && weight > maxWeight) {
                medals.push('weight');
                weightRecordAssigned = true;
            }
            const orm = estimateOrm(weight, reps);
            if (!ormRecordAssigned && orm != null && orm > maxOrm) {
                medals.push('orm');
                ormRecordAssigned = true;
            }
            if (!repsRecordAssigned && weight != null && reps > 0) {
                const key = normalizeWeightKey(weight);
                const bestReps = maxRepsByWeight.get(key) ?? 0;
                if (reps > bestReps) {
                    medals.push('reps');
                    repsRecordAssigned = true;
                }
            }
            const bestAtPos = bestByPos.get(pos);
            if (
                bestAtPos &&
                weight != null &&
                (weight > bestAtPos.weight || (weight === bestAtPos.weight && reps > bestAtPos.reps))
            ) {
                medals.push('progress');
            }
            medalsByPos.set(pos, medals.slice(0, 3));
        });
        return medalsByPos;
    }

    async function collectPreviousExerciseSets(exerciseId) {
        const dateKey = state.dateKey;
        if (!exerciseId || !dateKey) {
            return [];
        }
        const sessions = await db.listSessionDates();
        const previousDates = sessions
            .map((entry) => entry.date)
            .filter((date) => date && date < dateKey)
            .sort((a, b) => a.localeCompare(b));
        const results = [];
        for (const date of previousDates) {
            const session = await db.getSession(date);
            const exercise = Array.isArray(session?.exercises)
                ? session.exercises.find((item) => item.exercise_id === exerciseId)
                : null;
            if (exercise && Array.isArray(exercise.sets) && exercise.sets.length) {
                exercise.sets.forEach((set, index) => {
                    results.push({
                        pos: safeInt(set?.pos, index + 1),
                        reps: safePositiveInt(set?.reps),
                        weight: sanitizeWeight(set?.weight),
                        rpe: set?.rpe ?? null
                    });
                });
            }
        }
        return results;
    }

    function normalizeWeightKey(weight) {
        const normalized = Math.round(Number(weight) * 100) / 100;
        return String(normalized);
    }

    function estimateOrm(weight, reps) {
        if (weight == null || reps == null || reps <= 0) {
            return null;
        }
        return weight * (1 + reps / 30);
    }

    async function findPreviousSessionForHistory(exerciseId) {
        const dateKey = state.dateKey;
        if (!exerciseId || !dateKey) {
            return null;
        }
        const sessions = await db.listSessionDates();
        const previousDates = sessions
            .map((entry) => entry.date)
            .filter((date) => date && date < dateKey)
            .sort((a, b) => b.localeCompare(a));
        for (const date of previousDates) {
            const session = await db.getSession(date);
            const exercise = Array.isArray(session?.exercises)
                ? session.exercises.find((item) => item.exercise_id === exerciseId)
                : null;
            if (exercise && Array.isArray(exercise.sets) && exercise.sets.length) {
                return { date, session, exercise };
            }
        }
        return null;
    }

    function formatHistorySetLine(set, weightUnit) {
        const reps = Number.isFinite(set?.reps) ? set.reps : null;
        const weight = set?.weight != null ? Number(set.weight) : null;
        const parts = [];
        if (reps != null) {
            parts.push(`${reps}x`);
        }
        if (weight != null && !Number.isNaN(weight)) {
            parts.push(`${formatNumber(weight)}${weightUnit}`);
        }
        return parts.length ? parts.join(' ') : '—';
    }

    async function addSet() {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const previous = sets.length ? sets[sets.length - 1] : null;
        const now = new Date().toISOString();
        const restForNewSet = getRestForNewSet(previous?.rest);
        const preferredValues = await resolveNewSetValues(exercise, sets, previous);
        const newSet = {
            pos: sets.length + 1,
            reps: preferredValues?.reps ?? 8,
            weight: preferredValues?.weight ?? null,
            rpe: preferredValues?.rpe ?? null,
            rest: restForNewSet,
            done: true,
            date: now,
            time: previous?.time ?? null,
            distance: previous?.distance ?? null,
            setType: null
        };
        sets.push(newSet);
        hydrateSetIdentifiers(exercise, sets);
        exercise.sets = sets;
        await persistSession();
    }

    async function removeSet(index) {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (!sets[index]) {
            return;
        }
        sets.splice(index, 1);
        refreshSetOrderMetadata(exercise, sets);
        exercise.sets = sets;
        await persistSession();
    }

    function refreshExecSetOrderUI(container) {
        if (!container) {
            return;
        }
        Array.from(container.querySelectorAll('.exec-set-row')).forEach((node, idx) => {
            node.dataset.index = String(idx);
            const order = node.querySelector('.routine-set-order');
            if (order) {
                order.textContent = String(idx + 1);
            }
        });
    }

    async function moveSet(index, delta, row) {
        const exercise = getExercise();
        if (!exercise) {
            return null;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const target = index + delta;
        if (target < 0 || target >= sets.length) {
            return index;
        }
        const [item] = sets.splice(index, 1);
        sets.splice(target, 0, item);
        refreshSetOrderMetadata(exercise, sets);
        exercise.sets = sets;
        const { execSets } = assertRefs();
        if (row && execSets?.contains(row)) {
            const rows = Array.from(execSets.querySelectorAll('.exec-set-row'));
            const targetRow = rows[target];
            if (targetRow && targetRow !== row) {
                if (rows.indexOf(row) < target) {
                    if (targetRow.nextSibling) {
                        execSets.insertBefore(row, targetRow.nextSibling);
                    } else {
                        execSets.appendChild(row);
                    }
                } else {
                    execSets.insertBefore(row, targetRow);
                }
            }
        }
        refreshExecSetOrderUI(execSets);
        ensureInlineEditor()?.reposition?.(row, { position: target + 1, total: sets.length });
        await persistSession(false);
        await refreshSetMetaFrom(Math.min(index, target));
        return target;
    }

    async function applySetEditorResult(index, values, options = {}) {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (!sets[index]) {
            return;
        }
        const shouldRender = options.render !== false;
        const nextDone = options.done ?? sets[index].done ?? false;
        const rest = Math.max(0, safeInt(values.rest, getDefaultRest()));
        updateLastRestDuration(rest);
        sets[index] = {
            ...sets[index],
            pos: index + 1,
            reps: safePositiveInt(values.reps),
            weight: sanitizeWeight(values.weight),
            rpe: values.rpe != null && values.rpe !== '' ? clampRpe(values.rpe) : null,
            rest,
            done: nextDone,
            date: new Date().toISOString(),
            setType: null
        };
        hydrateSetIdentifiers(exercise, sets);
        exercise.sets = sets;
        await persistSession(shouldRender);
    }

    async function persistSession(shouldRender = true) {
        if (!state.session) {
            return;
        }
        await db.saveSession(state.session);
        if (shouldRender) {
            void renderSets();
        }
    }

    function refreshValueStates() {
        A.updateValueState?.(refs.execRoutineInstructions);
        A.updateValueState?.(refs.execMoveNote);
    }

    async function removeExercise() {
        if (!state.session?.exercises) {
            return;
        }
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Supprimer un exercice',
                message: 'Supprimer cet exercice de la séance ?',
                variant: 'danger'
            })
            : confirm('Supprimer cet exercice de la séance ?');
        if (!confirmed) {
            return;
        }
        const index = state.session.exercises.findIndex((item) => item.exercise_id === state.exerciseId);
        if (index === -1) {
            return;
        }
        state.session.exercises.splice(index, 1);
        if (state.session.exercises.length === 0) {
            if (state.session.id) {
                await db.del('sessions', state.session.id);
            }
            state.session = null;
        } else {
            await db.saveSession(state.session);
        }
        await refreshSessionViews();
        refs.dlgExecMoveEditor?.close();
        backToCaller();
    }

    async function replaceExercise() {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        refs.dlgExecMoveEditor?.close();
        A.openExercises({
            mode: 'add',
            callerScreen: 'screenExecEdit',
            selectionLimit: 1,
            onAdd: (ids) => {
                const [nextId] = ids;
                if (nextId) {
                    void applyExerciseReplacement(nextId);
                }
            }
        });
    }

    async function applyExerciseReplacement(nextId) {
        const exercise = getExercise();
        if (!exercise || !state.session) {
            return;
        }
        if (exercise.exercise_id === nextId) {
            return;
        }
        const nextExercise = await db.get('exercises', nextId);
        if (!nextExercise) {
            alert('Exercice introuvable.');
            return;
        }
        const nextName = nextExercise.name || nextId;
        exercise.exercise_id = nextId;
        exercise.exercise_name = nextName;
        exercise.type = nextId;
        exercise.id = buildSessionExerciseId(state.session.id, nextName);
        hydrateSetIdentifiers(exercise, exercise.sets || []);
        state.exerciseId = nextId;
        const { execTitle } = assertRefs();
        execTitle.textContent = nextName || 'Exercice';
        const timer = ensureSharedTimer();
        if (timer.attachment?.exerciseId === state.exerciseId) {
            resetTimerState();
        }
        await persistSession(false);
        await refreshSessionViews();
    }

    function getExercise() {
        if (!state.session?.exercises) {
            return null;
        }
        return state.session.exercises.find((item) => item.exercise_id === state.exerciseId) || null;
    }

    function refreshSetOrderMetadata(exercise, sets) {
        const now = new Date().toISOString();
        sets.forEach((set, idx) => {
            set.pos = idx + 1;
            set.date = now;
        });
        hydrateSetIdentifiers(exercise, sets);
    }

    function hydrateSetIdentifiers(exercise, sets) {
        const sessionId = state.session?.id || '';
        const exerciseName = exercise?.exercise_name || exercise?.exercise_id || 'exercice';
        sets.forEach((set) => {
            set.id = buildSessionSetId(sessionId, exerciseName, set.pos);
            set.type = exercise?.exercise_id || set.type || null;
            set.time = set.time ?? null;
            set.distance = set.distance ?? null;
            set.setType = null;
            if (typeof set.date !== 'string' || !set.date) {
                set.date = new Date().toISOString();
            }
        });
    }

    function buildSessionSetId(sessionId, rawName, position) {
        const base = slugifyExerciseName(rawName || 'exercice');
        const pos = String(position || 1).padStart(3, '0');
        if (!sessionId) {
            return `${base}_${pos}`;
        }
        return `${sessionId}_${base}_${pos}`;
    }

    function buildSessionExerciseId(sessionId, rawName) {
        const base = slugifyExerciseName(rawName || 'exercice');
        if (!sessionId) {
            return base;
        }
        return `${sessionId}_${base}`;
    }

    function slugifyExerciseName(value) {
        return String(value || '')
            .trim()
            .replace(/['’\s]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'exercice';
    }

    async function refreshSessionViews() {
        try {
            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
        } catch (error) {
            console.warn('ui-session-execution-edit.js: renderWeek a échoué', error);
        }
        try {
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('ui-session-execution-edit.js: renderSession a échoué', error);
        }
    }

    function backToCaller() {
        refs.dlgExecMoveEditor?.close();
        switchScreen(state.callerScreen || 'screenSessions');
        void refreshSessionViews();
    }

    function switchScreen(target) {
        inlineKeyboard?.detach?.();
        const {
            screenSessions,
            screenExercises,
            screenExerciseRead,
            screenExerciseEdit,
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
        } = assertRefs();
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseRead,
            screenExerciseEdit,
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
        updateTimerUI();
    }

    function renderRpeChip(value, muted = false) {
        if (value == null || value === '') {
            return '—';
        }
        const normalized = clampRpe(value);
        if (normalized == null) {
            return '—';
        }
        const extra = muted ? ' rpe-chip-muted' : '';
        const colorValue = getRpeColorKey(normalized);
        if (!colorValue) {
            return '—';
        }
        return `<span class="rpe rpe-chip${extra}" data-rpe="${colorValue}">${String(normalized)}</span>`;
    }

    function formatRepsDisplay(value) {
        return String(safePositiveInt(value));
    }

    function formatWeightValue(value) {
        if (value == null || value === '') {
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

    function sanitizeEditorResult(result, fallbackRest) {
        const reps = safePositiveInt(result.reps);
        const weight = sanitizeWeight(result.weight);
        const rpe = result.rpe != null && result.rpe !== '' ? clampRpe(result.rpe) : null;
        const minutes = safeInt(result.minutes, 0);
        const seconds = safeInt(result.seconds, 0);
        const computed = Math.max(0, minutes * 60 + seconds);
        const fallback = Math.max(0, safeInt(fallbackRest, getDefaultRest()));
        const rest = computed > 0 ? computed : fallback;
        return { reps, weight, rpe, rest };
    }

    function splitRest(value) {
        const secondsTotal = Math.max(0, safeInt(value, 0));
        const minutes = Math.floor(secondsTotal / 60);
        const seconds = secondsTotal % 60;
        return { minutes, seconds };
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

    async function resolveNewSetValues(exercise, sets, previous) {
        const source = A.preferences?.getNewSetValueSource?.() ?? 'last_set';
        const exerciseId = exercise.exercise_id;
        if (source === 'last_session') {
            const fromPreviousSession = await findPreviousSessionSet(exerciseId, sets.length + 1);
            if (fromPreviousSession) {
                return sanitizeSetValues(fromPreviousSession);
            }
            if (previous) {
                return sanitizeSetValues(previous);
            }
            const lastFromHistory = await findPreviousSessionLastSet(exerciseId);
            if (lastFromHistory) {
                return sanitizeSetValues(lastFromHistory);
            }
            return null;
        }
        if (previous) {
            return sanitizeSetValues(previous);
        }
        const lastFromHistory = await findPreviousSessionLastSet(exerciseId);
        if (lastFromHistory) {
            return sanitizeSetValues(lastFromHistory);
        }
        return null;
    }

    function sanitizeSetValues(source) {
        return {
            reps: safePositiveInt(source?.reps),
            weight: sanitizeWeight(source?.weight),
            rpe: source?.rpe != null && source?.rpe !== '' ? clampRpe(source?.rpe) : null
        };
    }

    async function findPreviousSessionSet(exerciseId, position) {
        const exercise = await findPreviousSessionExercise(exerciseId);
        if (!exercise) {
            return null;
        }
        return findSetByPosition(exercise.sets, position);
    }

    async function findPreviousSessionLastSet(exerciseId) {
        const exercise = await findPreviousSessionExercise(exerciseId);
        if (!exercise) {
            return null;
        }
        return findLastSet(exercise.sets);
    }

    async function findPreviousSessionExercise(exerciseId) {
        const dateKey = state.dateKey;
        if (!dateKey || !exerciseId) {
            return null;
        }
        const sessions = await db.listSessionDates();
        const previousDates = sessions
            .map((entry) => entry.date)
            .filter((date) => date && date < dateKey)
            .sort((a, b) => b.localeCompare(a));
        for (const date of previousDates) {
            const session = await db.getSession(date);
            const exercise = Array.isArray(session?.exercises)
                ? session.exercises.find((item) => item.exercise_id === exerciseId)
                : null;
            if (exercise && Array.isArray(exercise.sets) && exercise.sets.length) {
                return exercise;
            }
        }
        return null;
    }

    function findSetByPosition(sets, position) {
        if (!Array.isArray(sets) || !position) {
            return null;
        }
        const exactMatch = sets.find((set, index) => safeInt(set.pos, index + 1) === position);
        if (exactMatch) {
            return exactMatch;
        }
        return sets[position - 1] ?? null;
    }

    function findLastSet(sets) {
        if (!Array.isArray(sets) || !sets.length) {
            return null;
        }
        let best = null;
        let bestPos = -Infinity;
        sets.forEach((set, index) => {
            const pos = safeInt(set.pos, index + 1);
            if (pos >= bestPos) {
                bestPos = pos;
                best = set;
            }
        });
        return best;
    }

    function getDefaultRest() {
        const preferences = A.preferences;
        const restDefaultDuration = Math.max(0, safeInt(preferences?.getRestDefaultDuration?.(), 80));
        const lastRestDuration = Math.max(0, safeInt(preferences?.getLastRestDuration?.(), restDefaultDuration));
        const restDefaultEnabled = preferences?.getRestDefaultEnabled?.() !== false;
        return restDefaultEnabled ? restDefaultDuration : lastRestDuration;
    }

    function getRestForNewSet(previousRest) {
        const preferences = A.preferences;
        const restDefaultDuration = Math.max(0, safeInt(preferences?.getRestDefaultDuration?.(), 80));
        const lastRestDuration = Math.max(0, safeInt(preferences?.getLastRestDuration?.(), restDefaultDuration));
        const restDefaultEnabled = preferences?.getRestDefaultEnabled?.() !== false;
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

    function ensureSharedTimer() {
        if (!A.execTimer) {
            A.execTimer = defaultTimerState();
        }
        return A.execTimer;
    }

    function buildTimerAttachment(options = {}) {
        const exercise = options.exercise || getExercise();
        if (!exercise || !Array.isArray(exercise.sets)) {
            return null;
        }
        const set = resolveAttachmentSet(exercise, options);
        if (!set) {
            return null;
        }
        return {
            dateKey: state.dateKey,
            exerciseId: exercise.exercise_id,
            exerciseName: exercise.exercise_name || exercise.exercise_id || 'Exercice',
            setId: set.id ?? null,
            setPos: safeInt(set.pos, null),
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight)
        };
    }

    function resolveAttachmentSet(exercise, options = {}) {
        if (!exercise || !Array.isArray(exercise.sets)) {
            return null;
        }
        if (options?.setId) {
            return findSetById(exercise.sets, options.setId);
        }
        if (Number.isInteger(options?.setIndex)) {
            return exercise.sets[options.setIndex] ?? null;
        }
        return null;
    }

    function formatTimerAttachment(attachment) {
        if (!attachment?.exerciseName || !attachment?.setPos) {
            return '';
        }
        const reps = safePositiveInt(attachment.reps);
        const weight = attachment.weight;
        const weightLabel = weight != null ? ` ${formatNumber(weight)}kg` : '';
        return `${attachment.exerciseName} #${attachment.setPos} ${reps}x${weightLabel}`;
    }

    async function applyAttachmentRestDelta(delta) {
        const timer = ensureSharedTimer();
        const attachment = timer.attachment;
        if (!attachment?.dateKey || !attachment?.exerciseId || !attachment?.setId) {
            return;
        }
        const session =
            attachment.dateKey === state.dateKey && state.session ? state.session : await db.getSession(attachment.dateKey);
        if (!session) {
            return;
        }
        const exercise = Array.isArray(session.exercises)
            ? session.exercises.find((item) => item.exercise_id === attachment.exerciseId)
            : null;
        if (!exercise || !Array.isArray(exercise.sets)) {
            return;
        }
        const set = findSetById(exercise.sets, attachment.setId);
        if (!set) {
            return;
        }
        set.rest = Math.max(0, safeInt(set.rest, 0) + delta);
        updateLastRestDuration(set.rest);
        if (session === state.session) {
            await persistSession();
        } else {
            await db.saveSession(session);
        }
    }

    function setTimerVisibility(options = {}) {
        if (!timerVisibility) {
            return;
        }
        timerVisibility.hidden = options?.hidden != null ? Boolean(options.hidden) : timerVisibility.hidden;
        updateTimerUI();
    }
    A.setTimerVisibility = setTimerVisibility;

    function isTimerHidden() {
        return Boolean(timerVisibility?.hidden);
    }

    function resetTimerState() {
        const timer = ensureSharedTimer();
        stopTimer();
        Object.assign(timer, defaultTimerState());
        updateTimerUI();
    }

    function resetTimerToDefault() {
        const timer = ensureSharedTimer();
        stopTimer();
        const defaultRest = getDefaultRest();
        Object.assign(timer, defaultTimerState(), {
            startSec: defaultRest,
            remainSec: defaultRest
        });
        updateTimerUI();
    }
    A.resetTimerToDefault = resetTimerToDefault;

    function startTimer(duration, options = {}) {
        const timer = ensureSharedTimer();
        const seconds = Math.max(0, safeInt(duration, getDefaultRest()));
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
        }
        timer.startSec = seconds;
        timer.remainSec = seconds;
        timer.running = true;
        timer.intervalId = window.setInterval(runTick, 1000);
        timer.attachment = buildTimerAttachment(options);
        setTimerVisibility({ hidden: false });
        updateTimerUI();
    }

    function pauseTimer() {
        const timer = ensureSharedTimer();
        timer.running = false;
        updateTimerUI();
    }

    function resumeTimer() {
        const timer = ensureSharedTimer();
        timer.running = true;
        if (!timer.intervalId) {
            timer.intervalId = window.setInterval(runTick, 1000);
        }
        updateTimerUI();
    }

    function stopTimer() {
        const timer = ensureSharedTimer();
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
        }
        timer.intervalId = null;
        timer.running = false;
    }

    function runTick() {
        const timer = ensureSharedTimer();
        if (!timer.running) {
            return;
        }
        timer.remainSec -= 1;
        if (timer.remainSec === 0 && navigator.vibrate) {
            try {
                navigator.vibrate(200);
            } catch {
                /* ignore */
            }
        }
        updateTimerUI();
    }

    async function adjustTimer(delta) {
        const timer = ensureSharedTimer();
        timer.startSec += delta;
        timer.remainSec += delta;
        await applyAttachmentRestDelta(delta);
        updateTimerUI();
    }

    function updateTimerUI() {
        const timer = ensureSharedTimer();
        const { execTimerBar, timerDetails, timerDisplay, timerToggle } = assertRefs();
        if (!execTimerBar) {
            return;
        }
        ensureTimerPlacement(execTimerBar);
        const shouldHide = isTimerHidden();
        execTimerBar.hidden = shouldHide;
        syncTimerBarSpacer(execTimerBar, shouldHide);
        updateSessionTabDisplay(timer);
        if (shouldHide) {
            timerDisplay.classList.remove('tmr-display--warning', 'tmr-display--negative');
            return;
        }
        const detailText = formatTimerAttachment(timer.attachment);
        timerDetails.textContent = detailText;
        timerDetails.hidden = !detailText;
        const remaining = timer.remainSec;
        const sign = remaining < 0 ? '-' : '';
        const abs = Math.abs(remaining);
        const minutes = Math.floor(abs / 60);
        const seconds = abs % 60;
        const isNegative = remaining <= 0;
        const isWarning = remaining > 0 && remaining <= 10;
        timerDisplay.classList.toggle('tmr-display--warning', isWarning);
        timerDisplay.classList.toggle('tmr-display--negative', isNegative);
        timerDisplay.textContent = `${sign}${minutes}:${String(seconds).padStart(2, '0')}`;
        timerToggle.textContent = timer.running ? '⏸' : '▶︎';
        syncTimerBarSpacer(execTimerBar, false);
    }

    function updateSessionTabDisplay(timer = ensureSharedTimer()) {
        ensureRefs();
        const { tabSessions } = refs;
        if (!tabSessions) {
            return;
        }
        const isActive = tabSessions.classList.contains('active');
        tabSessions.classList.toggle('tab--session-timer', isActive);
        tabSessions.classList.toggle('tab--session-date', !isActive);
        if (!isActive) {
            tabSessions.classList.remove('tab--warning', 'tab--negative');
            tabSessions.textContent = A.fmtUI(A.activeDate || A.today());
            return;
        }

        const remaining = timer.remainSec;
        const sign = remaining < 0 ? '-' : '';
        const abs = Math.abs(remaining);
        const minutes = Math.floor(abs / 60);
        const seconds = abs % 60;
        const isNegative = remaining <= 0;
        const isWarning = remaining > 0 && remaining <= 10;
        tabSessions.classList.toggle('tab--warning', isWarning);
        tabSessions.classList.toggle('tab--negative', isNegative);
        tabSessions.innerHTML = `<span class="tab-session-arrow">⯅</span><span class="tab-session-time">${sign}${minutes}:${String(
            seconds
        ).padStart(2, '0')}</span>`;
    }
    A.updateSessionTabDisplay = () => updateSessionTabDisplay();

    function ensureTimerPlacement(execTimerBar) {
        const target = document.body;
        if (execTimerBar.parentElement === target) {
            return;
        }
        target.appendChild(execTimerBar);
    }

    function syncTimerBarSpacer(execTimerBar, shouldHide) {
        const root = document.documentElement;
        if (shouldHide) {
            root.style.setProperty('--timer-bar-h', '0px');
            return;
        }
        requestAnimationFrame(() => {
            const height = execTimerBar.offsetHeight;
            if (height) {
                root.style.setProperty('--timer-bar-h', `${height}px`);
            }
        });
    }

    function findSetById(sets, setId) {
        if (!Array.isArray(sets) || !setId) {
            return null;
        }
        return sets.find((set) => set.id === setId) || null;
    }

    function safeInt(value, fallback = 0) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function safePositiveInt(value) {
        const numeric = safeInt(value, 0);
        return numeric > 0 ? numeric : 0;
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
})();
