// ui-exec-edit.js — édition d'une exécution de séance (séries + timer)
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

    const defaultTimerState = () => ({
        running: false,
        startSec: 0,
        remainSec: 0,
        intervalId: null,
        exerciseKey: null
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
        refsResolved = true;
        return refs;
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
            'timerPlus'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-exec-edit.js: références manquantes (${missing.join(', ')})`);
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
        const { timerToggle, timerMinus, timerPlus } = assertRefs();
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
    }

    function normalizeExerciseSets(exercise) {
        const defaultRest = getDefaultRest();
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const normalized = sets.map((set, index) => ({
            pos: safeInt(set.pos, index + 1),
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight),
            rpe: set.rpe != null && set.rpe !== '' ? clampInt(set.rpe, 5, 10) : null,
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
            execSets.appendChild(renderSetRow(set, index));
        });
    }

    function renderSetRow(set, index) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row routine-set-grid exec-set-row';
        row.classList.add(set.done === true ? 'exec-set-executed' : 'exec-set-planned');
        row.dataset.index = String(index);

        const order = document.createElement('div');
        order.className = 'routine-set-order';
        order.textContent = set.pos ?? index + 1;

        const value = {
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight),
            rpe: set.rpe != null && set.rpe !== '' ? clampInt(set.rpe, 5, 10) : null,
            rest: Math.max(0, safeInt(set.rest, getDefaultRest()))
        };

        const buttons = [];
        const collectButtons = (...items) => {
            items.forEach((button) => {
                if (button) {
                    buttons.push(button);
                }
            });
        };

        const updatePreview = (source) => {
            if (!source) {
                return;
            }
            value.reps = safePositiveInt(source.reps);
            value.weight = sanitizeWeight(source.weight);
            value.rpe = source.rpe != null && source.rpe !== '' ? clampInt(source.rpe, 5, 10) : null;
            const minutes = safeInt(source.minutes, 0);
            const seconds = safeInt(source.seconds, 0);
            value.rest = Math.max(0, minutes * 60 + seconds);
            buttons.forEach((button) => button?._update?.());
        };

        const openEditor = (focusField) => {
            const SetEditor = A.components?.SetEditor;
            if (!SetEditor?.open) {
                return;
            }
            const { minutes, seconds } = splitRest(value.rest);
            row.classList.add('routine-set-row-active', 'set-editor-highlight');
            SetEditor.open({
                title: `Série ${set.pos ?? index + 1}`,
                values: {
                    reps: value.reps,
                    weight: value.weight,
                    rpe: value.rpe,
                    minutes,
                    seconds
                },
                focus: focusField,
                tone: 'black',
                actionsLayout: 'vertical',
                actions: [
                    {
                        id: 'plan',
                        label: 'Planifier',
                        variant: 'ghost',
                        full: true
                    },
                    {
                        id: 'save',
                        label: 'Enregistrer',
                        variant: 'primary',
                        full: true
                    }
                ],
                onChange: updatePreview
            })
                .then(async (result) => {
                    if (!result || !result.values) {
                        return;
                    }
                    const sanitized = sanitizeEditorResult(result.values, value.rest);
                    const markDone = result.action === 'save';
                    await applySetEditorResult(index, sanitized, { done: markDone });
                    if (markDone) {
                        startTimer(sanitized.rest);
                    }
                })
                .finally(() => {
                    row.classList.remove('routine-set-row-active', 'set-editor-highlight');
                });
        };

        const createButton = (getContent, focusField, extraClass = '', options = {}) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn ghost set-edit-button${extraClass ? ` ${extraClass}` : ''}`;
            button.addEventListener('click', () => openEditor(focusField));
            const { html = false } = options;
            const update = () => {
                const content = getContent();
                if (html) {
                    button.innerHTML = content;
                } else {
                    button.textContent = content;
                }
            };
            button._update = update;
            update();
            return button;
        };

        const repsButton = createButton(() => formatRepsDisplay(value.reps), 'reps');
        const weightButton = createButton(() => formatWeightValue(value.weight), 'weight');
        const rpeButton = createButton(() => renderRpeChip(value.rpe, set.done !== true), 'rpe', '', { html: true });
        const restMinutesButton = createButton(() => formatRestMinutes(value.rest), 'minutes', 'exec-rest-cell');
        const restSecondsButton = createButton(() => formatRestSeconds(value.rest), 'seconds', 'exec-rest-cell');
        collectButtons(repsButton, weightButton, rpeButton, restMinutesButton, restSecondsButton);

        const actions = document.createElement('div');
        actions.className = 'routine-set-actions';
        actions.appendChild(createActionButton('🗑️', 'Supprimer', () => void removeSet(index)));

        row.append(order, repsButton, weightButton, rpeButton, restMinutesButton, restSecondsButton, actions);
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
                  rpe: previous.rpe != null && previous.rpe !== '' ? clampInt(previous.rpe, 5, 10) : null,
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

    async function applySetEditorResult(index, values, options = {}) {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (!sets[index]) {
            return;
        }
        const nextDone = options.done ?? sets[index].done ?? false;
        sets[index] = {
            ...sets[index],
            pos: index + 1,
            reps: safePositiveInt(values.reps),
            weight: sanitizeWeight(values.weight),
            rpe: values.rpe != null && values.rpe !== '' ? clampInt(values.rpe, 5, 10) : null,
            rest: Math.max(0, safeInt(values.rest, getDefaultRest())),
            done: nextDone
        };
        exercise.sets = sets;
        await persistSession();
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
            console.warn('ui-exec-edit.js: renderWeek a échoué', error);
        }
        try {
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('ui-exec-edit.js: renderSession a échoué', error);
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
            screenStatsDetail
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
            screenStatsDetail
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
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

    function renderRpeChip(value, muted = false) {
        if (value == null || value === '') {
            return '—';
        }
        const cssClass = getRpeClass(value);
        const extra = muted ? ' rpe-chip-muted' : '';
        return `<span class="rpe-chip ${cssClass}${extra}">${value}</span>`;
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
        const rpe = result.rpe != null && result.rpe !== '' ? clampInt(result.rpe, 5, 10) : null;
        const minutes = safeInt(result.minutes, 0);
        const seconds = safeInt(result.seconds, 0);
        const computed = Math.max(0, minutes * 60 + seconds);
        const fallback = Math.max(0, safeInt(fallbackRest, getDefaultRest()));
        const rest = computed > 0 ? computed : fallback;
        return { reps, weight, rpe, rest };
    }

    function getRpeClass(value) {
        const numeric = safeInt(value, 0);
        if (numeric <= 5) return 'rpe-5';
        if (numeric === 6) return 'rpe-6';
        if (numeric === 7) return 'rpe-7';
        if (numeric === 8) return 'rpe-8';
        if (numeric === 9) return 'rpe-9';
        return 'rpe-10';
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
        stopTimer();
        const timer = ensureSharedTimer();
        Object.assign(timer, defaultTimerState());
        updateTimerUI();
    }

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
        const shouldHide = !timer.intervalId && !timer.running && timer.startSec === 0;
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

    function clampInt(value, min, max) {
        const numeric = safeInt(value, min);
        if (numeric < min) {
            return min;
        }
        if (numeric > max) {
            return max;
        }
        return numeric;
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
