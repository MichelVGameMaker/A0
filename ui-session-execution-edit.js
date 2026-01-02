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
        historySelected: false
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
        exerciseKey: null
    });

    const defaultTimerVisibility = () => ({
        forcedHidden: false,
        reason: null
    });

    let execTimer = A.execTimer;
    if (!execTimer) {
        execTimer = defaultTimerState();
    } else {
        execTimer.running = Boolean(execTimer.running);
        execTimer.startSec = safeInt(execTimer.startSec, 0);
        execTimer.remainSec = safeInt(execTimer.remainSec, 0);
        execTimer.intervalId = execTimer.intervalId ?? null;
        execTimer.exerciseKey = execTimer.exerciseKey ?? null;
    }
    A.execTimer = execTimer;
    let timerVisibility = A.timerVisibility;
    if (!timerVisibility) {
        timerVisibility = defaultTimerVisibility();
    } else {
        timerVisibility.forcedHidden = Boolean(timerVisibility.forcedHidden);
        timerVisibility.reason = timerVisibility.reason || null;
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
        setTimerVisibility({ forcedHidden: false, reason: null });

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
        setHistorySelected(false);

        const timerKey = `${dateKey}::${currentId}`;
        const timer = ensureSharedTimer();
        if (timer.exerciseKey && timer.exerciseKey !== timerKey) {
            resetTimerState();
        }
        timer.exerciseKey = timerKey;
        updateTimerUI();

        renderSets();
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
        refs.execBack = document.getElementById('execBack');
        refs.execEditMeta = document.getElementById('execEditMeta');
        refs.execTitle = document.getElementById('execTitle');
        refs.execDate = document.getElementById('execDate');
        refs.execDelete = document.getElementById('execDelete');
        refs.execAddSet = document.getElementById('execAddSet');
        refs.execSets = document.getElementById('execSets');
        refs.execTimerBar = document.getElementById('execTimerBar');
        refs.timerDisplay = document.getElementById('tmrDisplay');
        refs.timerToggle = document.getElementById('tmrToggle');
        refs.timerMinus = document.getElementById('tmrMinus');
        refs.timerPlus = document.getElementById('tmrPlus');
        refs.timerReset = document.getElementById('tmrReset');
        refs.tabTimer = document.getElementById('tabTimer');
        refs.dlgExecMoveEditor = document.getElementById('dlgExecMoveEditor');
        refs.execRoutineInstructions = document.getElementById('execRoutineInstructions');
        refs.execMoveNote = document.getElementById('execMoveNote');
        refs.execReplaceExercise = document.getElementById('execReplaceExercise');
        refs.execMoveEditorClose = document.getElementById('execMoveEditorClose');
        refs.execMoveEditorCancel = document.getElementById('execMoveEditorCancel');
        refs.execHistoryToggle = document.getElementById('execHistoryToggle');
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
            'execHistoryToggle'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-session-execution-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const { execBack } = assertRefs();
        execBack.addEventListener('click', () => {
            backToCaller();
        });
    }

    function wireActions() {
        const { execAddSet, execDelete, execReplaceExercise, execHistoryToggle } = assertRefs();
        execAddSet.addEventListener('click', () => {
            void addSet();
        });
        execDelete.addEventListener('click', () => {
            void removeExercise();
        });
        execReplaceExercise.addEventListener('click', () => {
            void replaceExercise();
        });
        execHistoryToggle.addEventListener('click', () => {
            setHistorySelected(!state.historySelected);
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
        });
    }

    function setHistorySelected(selected) {
        const { execHistoryToggle } = assertRefs();
        state.historySelected = Boolean(selected);
        execHistoryToggle.classList.toggle('selected', state.historySelected);
        execHistoryToggle.setAttribute('aria-pressed', state.historySelected ? 'true' : 'false');
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

    function renderSets() {
        const exercise = getExercise();
        const { execSets } = assertRefs();
        ensureInlineEditor()?.close();
        inlineKeyboard?.detach?.();
        execSets.innerHTML = '';
        if (!exercise) {
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (!sets.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune série prévue.';
            execSets.appendChild(empty);
            return;
        }
        sets.forEach((set, index) => {
            execSets.appendChild(renderSetRow(set, index, sets.length));
        });
    }

    function renderSetRow(set, index, totalSets) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row routine-set-grid exec-set-row';
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
        };

        const buildKeyboardActions = () => [
            {
                icon: '🗑️',
                ariaLabel: 'Supprimer la série',
                className: 'inline-keyboard-action--danger inline-keyboard-action--icon',
                onClick: async () => {
                    await removeSet(currentIndex);
                }
            },
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
                    startTimer(value.rest);
                }
            }
        ];

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
                        startTimer(sanitized.rest);
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
                case 'minutes': {
                    const { seconds } = splitRest(value.rest);
                    next.rest = Math.max(0, safeInt(rawValue, 0) * 60 + seconds);
                    break;
                }
                case 'seconds': {
                    const { minutes } = splitRest(value.rest);
                    next.rest = Math.max(0, minutes * 60 + safeInt(rawValue, 0));
                    break;
                }
                default:
                    return;
            }
            const currentDone = getExercise()?.sets?.[currentIndex]?.done ?? set.done;
            const markDone = rawValue !== '' ? true : currentDone;
            await applySetEditorResult(currentIndex, next, { done: markDone, render: false });
            updatePreview(next);
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
                    layout: field === 'rpe' ? 'rpe' : 'default',
                    actions: buildKeyboardActions(),
                    getValue: () => input.value,
                    onChange: (next) => {
                        input.value = next;
                        if (field === 'rpe') {
                            applyRpeTone(input, next);
                        }
                        void applyDirectChange(field, input.value);
                    },
                    onClose: () => input.blur()
                });
                inlineKeyboard?.selectTarget?.(input);
            });
            return input;
        };

        const repsInput = createInput(() => formatRepsDisplay(value.reps), 'reps');
        const weightInput = createInput(
            () => (value.weight == null ? '' : formatNumber(value.weight)),
            'weight',
            '',
            { inputMode: 'decimal', type: 'text' }
        );
        const rpeInput = createInput(() => (value.rpe == null ? '' : String(value.rpe)), 'rpe');
        const restMinutesInput = createInput(() => formatRestMinutes(value.rest), 'minutes', 'exec-rest-cell');
        const restSecondsInput = createInput(() => formatRestSeconds(value.rest), 'seconds', 'exec-rest-cell');
        collectInputs(repsInput, weightInput, rpeInput, restMinutesInput, restSecondsInput);

        row.append(order, repsInput, weightInput, rpeInput, restMinutesInput, restSecondsInput);
        return row;
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
            const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
            if (sibling) {
                if (delta < 0) {
                    execSets.insertBefore(row, sibling);
                } else {
                    execSets.insertBefore(sibling, row);
                }
            }
        }
        refreshExecSetOrderUI(execSets);
        await persistSession(false);
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
            renderSets();
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
        if (!confirm('Supprimer cet exercice de la séance ?')) {
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
        timer.exerciseKey = `${state.dateKey}::${nextId}`;
        resetTimerState();
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

    function setTimerVisibility(options = {}) {
        if (!timerVisibility) {
            return;
        }
        const forcedHidden = Boolean(options?.forcedHidden);
        timerVisibility.forcedHidden = forcedHidden;
        timerVisibility.reason = forcedHidden ? options.reason || null : null;
        updateTimerUI();
    }
    A.setTimerVisibility = setTimerVisibility;

    function isTimerForcedHidden() {
        return Boolean(timerVisibility?.forcedHidden);
    }

    function resetTimerState() {
        const timer = ensureSharedTimer();
        const currentExerciseKey = timer.exerciseKey;
        stopTimer();
        Object.assign(timer, defaultTimerState(), { exerciseKey: currentExerciseKey });
        updateTimerUI();
    }

    function resetTimerToDefault() {
        const timer = ensureSharedTimer();
        const currentExerciseKey = timer.exerciseKey;
        stopTimer();
        const defaultRest = getDefaultRest();
        Object.assign(timer, defaultTimerState(), {
            exerciseKey: currentExerciseKey,
            startSec: defaultRest,
            remainSec: defaultRest
        });
        updateTimerUI();
    }
    A.resetTimerToDefault = resetTimerToDefault;

    function startTimer(duration) {
        const timer = ensureSharedTimer();
        const seconds = Math.max(0, safeInt(duration, getDefaultRest()));
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
        }
        timer.startSec = seconds;
        timer.remainSec = seconds;
        timer.running = true;
        timer.intervalId = window.setInterval(runTick, 1000);
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
        const exercise = getExercise();
        if (exercise && Array.isArray(exercise.sets) && exercise.sets.length) {
            const last = exercise.sets[exercise.sets.length - 1];
            last.rest = Math.max(0, safeInt(last.rest, 0) + delta);
            updateLastRestDuration(last.rest);
            await persistSession();
        }
        updateTimerUI();
    }

    function updateTimerUI() {
        const timer = ensureSharedTimer();
        const { execTimerBar, timerDisplay, timerToggle } = assertRefs();
        const { tabTimer } = refs;
        if (!execTimerBar) {
            return;
        }
        ensureTimerPlacement(execTimerBar);
        const baseHidden = !timer.intervalId && !timer.running && timer.startSec === 0;
        const shouldHide = baseHidden || isTimerForcedHidden();
        execTimerBar.hidden = shouldHide;
        if (tabTimer) {
            tabTimer.setAttribute('aria-pressed', String(!shouldHide));
            tabTimer.classList.toggle('is-on', !shouldHide);
        }
        if (shouldHide) {
            return;
        }
        const remaining = timer.remainSec;
        const sign = remaining < 0 ? '-' : '';
        const abs = Math.abs(remaining);
        const minutes = Math.floor(abs / 60);
        const seconds = abs % 60;
        timerDisplay.textContent = `${sign}${minutes}:${String(seconds).padStart(2, '0')}`;
        timerToggle.textContent = timer.running ? '⏸' : '▶︎';
    }

    function ensureTimerPlacement(execTimerBar) {
        const target = document.body;
        if (execTimerBar.parentElement === target) {
            return;
        }
        target.appendChild(execTimerBar);
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
