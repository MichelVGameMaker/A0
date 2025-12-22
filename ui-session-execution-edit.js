// ui-session-execution-edit.js — édition d'une exécution de séance (séries + timer)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        dateKey: null,
        exerciseId: null,
        callerScreen: 'screenSessions',
        session: null
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
        exerciseKey: null,
        collapsed: false
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
        execTimer.collapsed = Boolean(execTimer.collapsed);
    }
    A.execTimer = execTimer;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireNavigation();
        wireActions();
        wireTimerControls();
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
            ? session.exercises.find((item) => item.exerciseId === currentId)
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

        const { execTitle, execDate } = assertRefs();
        execTitle.textContent = exercise.exerciseName || 'Exercice';
        execDate.textContent = A.fmtUI(date);

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

    A.toggleTimerVisibility = function toggleTimerVisibility() {
        ensureRefs();
        const timer = ensureSharedTimer();
        const baseHidden = !timer.intervalId && !timer.running && timer.startSec === 0;
        if (baseHidden) {
            return;
        }
        timer.collapsed = !timer.collapsed;
        updateTimerUI();
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
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.execBack = document.getElementById('execBack');
        refs.execOk = document.getElementById('execOk');
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
        refs.timerClose = document.getElementById('tmrClose');
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
            'execOk',
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
            'timerClose'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-session-execution-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const { execBack, execOk } = assertRefs();
        execBack.addEventListener('click', () => {
            backToCaller();
        });
        execOk.addEventListener('click', () => {
            backToCaller();
        });
    }

    function wireActions() {
        const { execAddSet, execDelete } = assertRefs();
        execAddSet.addEventListener('click', () => {
            void addSet();
        });
        execDelete.addEventListener('click', () => {
            void removeExercise();
        });
    }

    function wireTimerControls() {
        const { execTimerBar, timerToggle, timerMinus, timerPlus, timerClose } = assertRefs();
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
        timerClose.addEventListener('click', () => {
            resetTimerState();
            if (execTimerBar) {
                execTimerBar.hidden = true;
            }
        });
    }

    function normalizeExerciseSets(exercise) {
        const defaultRest = getDefaultRest();
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const normalized = sets.map((set, index) => ({
            pos: safeInt(set.pos, index + 1),
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight),
            rpe: set.rpe != null && set.rpe !== '' ? clampRpe(set.rpe) : null,
            rest: Math.max(0, safeInt(set.rest, defaultRest)),
            done: set.done === true
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
            await applySetEditorResult(currentIndex, next, { done: set.done, render: false });
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
        const defaultRest = getDefaultRest();
        const newSet = previous
            ? {
                  pos: sets.length + 1,
                  reps: safePositiveInt(previous.reps),
                  weight: sanitizeWeight(previous.weight),
                  rpe: previous.rpe != null && previous.rpe !== '' ? clampRpe(previous.rpe) : null,
                  rest: Math.max(0, safeInt(previous.rest, defaultRest)),
                  done: false
              }
            : {
                  pos: sets.length + 1,
                  reps: 8,
                  weight: null,
                  rpe: null,
                  rest: defaultRest,
                  done: false
              };
        sets.push(newSet);
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
        sets.forEach((item, idx) => {
            item.pos = idx + 1;
        });
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
        sets.forEach((set, idx) => {
            set.pos = idx + 1;
        });
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
        sets[index] = {
            ...sets[index],
            pos: index + 1,
            reps: safePositiveInt(values.reps),
            weight: sanitizeWeight(values.weight),
            rpe: values.rpe != null && values.rpe !== '' ? clampRpe(values.rpe) : null,
            rest: Math.max(0, safeInt(values.rest, getDefaultRest())),
            done: nextDone
        };
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

    async function removeExercise() {
        if (!state.session?.exercises) {
            return;
        }
        if (!confirm('Supprimer cet exercice de la séance ?')) {
            return;
        }
        const index = state.session.exercises.findIndex((item) => item.exerciseId === state.exerciseId);
        if (index === -1) {
            return;
        }
        state.session.exercises.splice(index, 1);
        await db.saveSession(state.session);
        await refreshSessionViews();
        backToCaller();
    }

    function getExercise() {
        if (!state.session?.exercises) {
            return null;
        }
        return state.session.exercises.find((item) => item.exerciseId === state.exerciseId) || null;
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
            screenStatsList,
            screenStatsDetail,
            screenSettings,
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
            screenStatsList,
            screenStatsDetail,
            screenSettings,
            screenPreferences,
            screenData
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
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

    function getDefaultRest() {
        return Math.max(0, safeInt(A.preferences?.getDefaultTimerDuration?.(), 90));
    }

    function ensureSharedTimer() {
        if (!A.execTimer) {
            A.execTimer = defaultTimerState();
        }
        return A.execTimer;
    }

    function resetTimerState() {
        const timer = ensureSharedTimer();
        const currentExerciseKey = timer.exerciseKey;
        stopTimer();
        Object.assign(timer, defaultTimerState(), { exerciseKey: currentExerciseKey });
        updateTimerUI();
    }

    function startTimer(duration) {
        const timer = ensureSharedTimer();
        const seconds = Math.max(0, safeInt(duration, getDefaultRest()));
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
        }
        timer.collapsed = false;
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
            await persistSession();
        }
        updateTimerUI();
    }

    function updateTimerUI() {
        const timer = ensureSharedTimer();
        const { execTimerBar, timerDisplay, timerToggle } = assertRefs();
        if (!execTimerBar) {
            return;
        }
        const baseHidden = !timer.intervalId && !timer.running && timer.startSec === 0;
        const shouldHide = baseHidden || timer.collapsed;
        execTimerBar.hidden = shouldHide;
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
