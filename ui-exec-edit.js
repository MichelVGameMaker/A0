// ui-exec-edit.js — 3.4.2 (Colonne A) : édition + timer, sans bouton "Enregistrer"
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    let execCtx = { dateKey: null, exerciseId: null, exerciseName: '', callerScreen: 'screenSessions' };
    const defaultTimerState = () => ({ running: false, startSec: 0, remainSec: 0, intervalId: null, exerciseKey: null });

    let execTimer = A.execTimer;
    if (!execTimer) {
        execTimer = defaultTimerState();
        A.execTimer = execTimer;
    } else {
        execTimer.running = Boolean(execTimer.running);
        execTimer.startSec = safeInt(execTimer.startSec);
        execTimer.remainSec = safeInt(execTimer.remainSec);
        execTimer.intervalId = execTimer.intervalId ?? null;
        if (!('exerciseKey' in execTimer)) {
            execTimer.exerciseKey = null;
        }
    }

    let currentSelection = null;
    let currentHolder = null;
    let currentAction = 'add';

    A.execCtx = execCtx;
    A.execTimer = execTimer;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireNavigation();
        wireTimerControls();
    });

    /* ACTIONS */
    /**
     * Ouvre l'éditeur d'exécution pour l'exercice courant.
     * @param {{currentId: string, callerScreen?: string}} [options] Informations de contexte.
     * @returns {Promise<void>} Promesse résolue après affichage.
     */
    A.openExecEdit = async function openExecEdit(options = {}) {
        const { currentId, callerScreen = 'screenSessions' } = options;
        if (!currentId) {
            return;
        }

        const dateKey = A.ymd(A.activeDate);
        const session = await db.getSession(dateKey);
        if (!session) {
            alert('Aucune séance pour cette date.');
            return;
        }
        const exercise = session.exercises.find((item) => item.exerciseId === currentId);
        if (!exercise) {
            alert('Exercice introuvable dans la séance.');
            return;
        }

        exercise.sets = (exercise.sets || []).map((set, index) => ({
            pos: set.pos ?? index + 1,
            done: Boolean(set.done),
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            rpe: set.rpe ?? null,
            rest: set.rest ?? 90
        }));

        execCtx = {
            dateKey,
            exerciseId: currentId,
            exerciseName: exercise.exerciseName || '',
            callerScreen
        };
        A.execCtx = execCtx;

        const timerKey = `${dateKey}::${currentId}`;
        const timer = ensureSharedTimer();
        if (timer.exerciseKey && timer.exerciseKey !== timerKey) {
            resetTimerState();
        }
        timer.exerciseKey = timerKey;
        updateTimerUI();

        const { execTitle, execDate } = assertRefs();
        execTitle.textContent = exercise.exerciseName || 'Exercice';
        execDate.textContent = A.fmtUI(A.activeDate);

        await renderColumnA();
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
        refs.execTitle = document.getElementById('execTitle');
        refs.execDate = document.getElementById('execDate');
        refs.execExecuted = document.getElementById('execExecuted');
        refs.execEditable = document.getElementById('execEditable');
        refs.execRestToggle = document.getElementById('execRestToggle');
        refs.execOk = document.getElementById('execOk');
        refs.execBack = document.getElementById('execBack');
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
            'screenSessions',
            'screenExecEdit',
            'execTitle',
            'execDate',
            'execExecuted',
            'execEditable',
            'execRestToggle',
            'execOk',
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

    async function renderColumnA(selectionOverride = null) {
        const { execExecuted, execEditable, execRestToggle, execOk } = assertRefs();
        const session = await db.getSession(execCtx.dateKey);
        const exercise = session?.exercises.find((item) => item.exerciseId === execCtx.exerciseId);
        if (!exercise) {
            return;
        }

        execExecuted.innerHTML = '';
        execEditable.innerHTML = '';
        currentHolder = null;

        const orderedSets = [...exercise.sets].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        const executedSets = orderedSets.filter((set) => set.done === true);
        const plannedSets = orderedSets.filter((set) => set.done !== true);
        const entryKind = plannedSets.length ? 'planned' : 'new';
        let entryTemplate = null;

        if (selectionOverride) {
            currentSelection = selectionOverride;
        }

        const executedPositions = new Set(executedSets.map((set) => set.pos));
        if (currentSelection?.kind === 'existing' && !executedPositions.has(currentSelection.pos)) {
            currentSelection = null;
        }
        const plannedPositions = new Set(plannedSets.map((set) => set.pos));
        if (currentSelection?.kind === 'planned' && !plannedPositions.has(currentSelection.pos)) {
            currentSelection = null;
        }
        if (currentSelection?.kind === 'new' && entryKind !== 'new') {
            currentSelection = null;
        }

        if (entryKind === 'planned') {
            let target = null;
            if (currentSelection?.kind === 'planned') {
                target = plannedSets.find((set) => set.pos === currentSelection.pos) || null;
            }
            if (!target) {
                target = plannedSets[0] || null;
            }
            if (!currentSelection && target) {
                currentSelection = { kind: 'planned', pos: target.pos };
            }
            entryTemplate = target ? { ...target } : null;
        } else {
            entryTemplate = createTemplateFromLast(orderedSets);
            if (!currentSelection && entryTemplate) {
                currentSelection = { kind: 'new', pos: entryTemplate.pos };
            }
        }

        if (!currentSelection) {
            if (executedSets.length) {
                const last = executedSets[executedSets.length - 1];
                currentSelection = { kind: 'existing', pos: last.pos };
            }
        }

        executedSets.forEach((set) => {
            const row = rowReadOnly(set);
            row.classList.add('exec-executed');
            const isSelected = currentSelection?.kind === 'existing' && currentSelection.pos === set.pos;
            applySelectionStyle(row, isSelected);
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => {
                void renderColumnA({ kind: 'existing', pos: set.pos });
            });
            execExecuted.appendChild(row);
        });

        plannedSets.forEach((set) => {
            const row = rowPreview(set, 'planned');
            const isSelected = currentSelection?.kind === 'planned' && currentSelection.pos === set.pos;
            applySelectionStyle(row, isSelected);
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => {
                void renderColumnA({ kind: 'planned', pos: set.pos });
            });
            execExecuted.appendChild(row);
        });

        if (entryTemplate && entryKind === 'new') {
            const entryRow = rowPreview(entryTemplate, entryKind);
            const isEntrySelected = currentSelection && currentSelection.kind !== 'existing';
            applySelectionStyle(entryRow, Boolean(isEntrySelected));
            entryRow.style.cursor = 'pointer';
            entryRow.addEventListener('click', () => {
                void renderColumnA({ kind: 'new', pos: entryTemplate.pos });
            });
            execExecuted.appendChild(entryRow);
        }

        const formContext = resolveFormContext({ entryKind, entryTemplate, orderedSets });
        const formRow = rowEditable(formContext.set, formContext.isNew);
        execEditable.appendChild(formRow);
        currentHolder = formRow.querySelector('.js-edit-holder');
        currentAction = formContext.action;
        setupFormInteractions();

        execRestToggle.onclick = async () => {
            if (!currentHolder || !currentHolder._collect) {
                return;
            }
            if (execRestToggle.disabled) {
                return;
            }
            const payload = JSON.parse(currentHolder.dataset.payload || '{}');
            const value = currentHolder._collect();
            await saveSet(payload, value, true);
            startTimer(value.rest);
        };

        execOk.onclick = async () => {
            if (currentHolder && currentHolder._collect) {
                const payload = JSON.parse(currentHolder.dataset.payload || '{}');
                const value = currentHolder._collect();
                await saveSet(payload, value, true);
                startTimer(value.rest);
            }
            backToCaller();
        };

        updateTimerUI();
    }

    async function saveSet(payload, value, markDone) {
        const session = await db.getSession(execCtx.dateKey);
        const exercise = session.exercises.find((item) => item.exerciseId === execCtx.exerciseId);
        if (payload.isNew) {
            exercise.sets.push({ pos: exercise.sets.length + 1, ...value, done: markDone });
        } else {
            const index = exercise.sets.findIndex((set) => set.pos === payload.pos);
            if (index >= 0) {
                exercise.sets[index] = { ...exercise.sets[index], ...value, done: markDone };
            }
        }
        await db.saveSession(session);
        currentSelection = null;
        await renderColumnA();
    }

    async function saveRemainingRest(remaining) {
        const session = await db.getSession(execCtx.dateKey);
        const exercise = session.exercises.find((item) => item.exerciseId === execCtx.exerciseId);
        if (exercise && exercise.sets.length) {
            const last = exercise.sets[exercise.sets.length - 1];
            last.rest = Math.max(0, remaining);
            await db.saveSession(session);
            await renderColumnA();
        }
    }

    function rowReadOnly(set) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row routine-set-grid';
        const order = set.pos != null ? set.pos : '—';
        const { minutes, seconds } = splitRest(set.rest);
        row.innerHTML = `
            <div class="routine-set-order">${order}</div>
            <div class="details">${formatRepsDisplay(set.reps)}</div>
            <div class="details">${formatWeightWithUnit(set.weight)}</div>
            <div class="details">${rpeChip(clampInt(set.rpe, 5, 10))}</div>
            <div class="details exec-rest-cell">${minutes}</div>
            <div class="details exec-rest-cell">${String(seconds).padStart(2, '0')}</div>
            <div class="details"></div>
        `;
        return row;
    }

    function rowPreview(set, kind) {
        const row = rowReadOnly(set);
        row.classList.add('exec-preview');
        row.classList.add(kind === 'planned' ? 'exec-planned' : 'exec-new');
        row.style.opacity = '0.7';
        row.style.fontStyle = 'italic';
        const hint = kind === 'planned' ? 'Prévue' : 'À faire';
        const hintCell = row.children[6];
        if (hintCell) {
            hintCell.textContent = hint;
            hintCell.className = 'details';
        }
        return row;
    }

    function applySelectionStyle(row, isSelected) {
        row.classList.toggle('is-selected', isSelected);
        if (row.classList.contains('exec-preview')) {
            row.style.opacity = isSelected ? '1' : '0.7';
        }
    }

    function resolveFormContext({ entryKind, entryTemplate, orderedSets }) {
        if (currentSelection?.kind === 'existing') {
            const match = orderedSets.find((set) => set.pos === currentSelection.pos);
            if (match) {
                return { set: { ...match }, isNew: false, action: 'edit' };
            }
        }
        if (currentSelection?.kind === 'planned' && entryKind === 'planned' && entryTemplate) {
            return { set: { ...entryTemplate }, isNew: false, action: 'add' };
        }
        if (entryTemplate) {
            return { set: { ...entryTemplate }, isNew: entryKind === 'new', action: 'add' };
        }
        const fallbackPos = orderedSets.reduce((acc, item) => Math.max(acc, item.pos ?? 0), 0) + 1;
        return { set: defaultNewSet(fallbackPos), isNew: true, action: 'add' };
    }

    function setupFormInteractions() {
        const { execRestToggle } = assertRefs();
        if (!execRestToggle) {
            return;
        }

        const label = currentAction === 'edit' ? 'Editer' : 'Ajouter';
        execRestToggle.textContent = label;
        updateExecRestToggle();
    }

    function updateExecRestToggle() {
        const { execRestToggle } = assertRefs();
        if (!execRestToggle) {
            return;
        }

        if (!currentHolder || !currentHolder._value) {
            execRestToggle.disabled = true;
            return;
        }

        const repsValue = safePositiveInt(currentHolder._value.reps);
        execRestToggle.disabled = repsValue <= 0;
    }

    function rowEditable(set, isNew) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row exec-edit-row routine-set-grid';

        const holder = document.createElement('div');
        holder.className = 'js-edit-holder';
        holder.dataset.payload = JSON.stringify({ pos: set.pos, isNew });

        const defaultRest = A.preferences?.getDefaultTimerDuration?.() ?? 90;
        const value = {
            reps: safePositiveInt(set.reps),
            weight: sanitizeWeight(set.weight, true),
            rpe: clampInt(set.rpe, 5, 10),
            rest: Math.max(0, safeInt(set.rest, defaultRest))
        };

        holder._value = value;

        const title = set.pos ? `Série ${set.pos}` : 'Nouvelle série';

        const orderCell = document.createElement('div');
        orderCell.className = 'routine-set-order';
        orderCell.textContent = set.pos != null ? set.pos : '—';

        const openEditor = (focusField) => {
            const SetEditor = A.components?.SetEditor;
            if (!SetEditor?.open) {
                return;
            }
            const { minutes, seconds } = splitRest(value.rest);
            row.classList.add('set-editor-highlight');
            const tone = set.done === true ? 'black' : 'muted';
            const promise = SetEditor.open({
                title,
                values: {
                    reps: value.reps,
                    weight: value.weight,
                    rpe: value.rpe,
                    minutes,
                    seconds
                },
                focus: focusField,
                tone
            });
            if (!promise || typeof promise.then !== 'function') {
                row.classList.remove('set-editor-highlight');
                return;
            }
            promise
                .then((result) => {
                    if (!result) {
                        return;
                    }
                    value.reps = safePositiveInt(result.reps);
                    value.weight = sanitizeWeight(result.weight, true);
                    value.rpe = result.rpe != null ? clampInt(result.rpe, 5, 10) : null;
                    const totalRest = Math.max(0, Math.round((result.minutes ?? 0) * 60 + (result.seconds ?? 0)));
                    value.rest = totalRest;
                    updateButtons();
                    updateExecRestToggle();
                })
                .finally(() => {
                    row.classList.remove('set-editor-highlight');
                });
        };

        const createButton = (getContent, focusField, extraClass = '', options = {}) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn ghost set-edit-button${extraClass ? ` ${extraClass}` : ''}`;
            button.addEventListener('click', () => openEditor(focusField));
            const { html = false } = options;
            button._update = () => {
                const content = getContent();
                if (html) {
                    button.innerHTML = content;
                } else {
                    button.textContent = content;
                }
            };
            button._update();
            return button;
        };

        const repsButton = createButton(() => formatRepsDisplay(value.reps), 'reps');
        const weightButton = createButton(() => formatWeightValue(value.weight), 'weight');
        const rpeButton = createButton(() => rpeChip(value.rpe), 'rpe', '', { html: true });
        const restMinutesButton = createButton(() => formatRestMinutes(value.rest), 'minutes', 'exec-rest-cell');
        const restSecondsButton = createButton(() => formatRestSeconds(value.rest), 'seconds', 'exec-rest-cell');

        const updateButtons = () => {
            repsButton._update();
            weightButton._update();
            rpeButton._update();
            restMinutesButton._update();
            restSecondsButton._update();
        };

        holder._collect = () => ({
            reps: safePositiveInt(value.reps),
            weight: sanitizeWeight(value.weight, true),
            rpe: value.rpe != null ? clampInt(value.rpe, 5, 10) : null,
            rest: Math.max(0, Math.round(value.rest))
        });

        const actionCell = document.createElement('div');
        actionCell.className = 'exec-edit-actions';
        actionCell.style.visibility = 'hidden';
        holder.style.display = 'none';
        actionCell.appendChild(holder);

        row.append(orderCell, repsButton, weightButton, rpeButton, restMinutesButton, restSecondsButton, actionCell);
        updateButtons();
        return row;
    }

    function createTemplateFromLast(sets) {
        const nextPos = sets.reduce((acc, item) => Math.max(acc, item.pos ?? 0), 0) + 1;
        const lastDone = [...sets].reverse().find((item) => item.done === true);
        if (lastDone) {
            const { reps = 0, weight = 0, rpe = null, rest = 90 } = lastDone;
            return { pos: nextPos, reps, weight, rpe, rest, done: false };
        }
        return defaultNewSet(nextPos);
    }

    function defaultNewSet(pos) {
        return { pos, reps: 8, weight: 0, rpe: null, rest: 90, done: false };
    }

    function rpeChip(value) {
        if (value == null || value === '') {
            return '—';
        }
        const cssClass = getRpeClass(value);
        return `<span class="rpe-chip ${cssClass}">${value}</span>`;
    }

    function getRpeClass(value) {
        const numeric = parseInt(value, 10);
        if (numeric <= 5) return 'rpe-5';
        if (numeric === 6) return 'rpe-6';
        if (numeric === 7) return 'rpe-7';
        if (numeric === 8) return 'rpe-8';
        if (numeric === 9) return 'rpe-9';
        return 'rpe-10';
    }

    function formatRepsDisplay(value) {
        return String(safePositiveInt(value));
    }

    function formatWeightValue(value) {
        return formatNumber(sanitizeWeight(value, true));
    }

    function formatWeightWithUnit(value) {
        const numeric = sanitizeWeight(value);
        if (numeric == null) {
            return '—';
        }
        return `${formatNumber(numeric)} kg`;
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

    function sanitizeWeight(value, defaultZero = false) {
        const numeric = safeFloat(value, defaultZero ? 0 : null);
        if (numeric == null) {
            return defaultZero ? 0 : null;
        }
        return Math.max(0, Math.round(numeric * 100) / 100);
    }

    function safePositiveInt(value) {
        const numeric = safeInt(value, 0);
        return numeric > 0 ? numeric : 0;
    }

    function safeInt(value, fallback = 0) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function safeFloat(value, fallback = null) {
        if (value == null || value === '') {
            return fallback;
        }
        const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
        const numeric = Number.parseFloat(normalized);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function clampInt(value, min, max) {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Math.max(min, Math.min(max, numeric));
    }

    function splitRest(value) {
        const total = Math.max(0, safeInt(value, 0));
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return { minutes, seconds };
    }

    function ensureSharedTimer() {
        if (!A.execTimer) {
            A.execTimer = defaultTimerState();
        }
        if (execTimer !== A.execTimer) {
            execTimer = A.execTimer;
            if (!('exerciseKey' in execTimer)) {
                execTimer.exerciseKey = null;
            }
        }
        return execTimer;
    }

    function resetTimerState() {
        const timer = ensureSharedTimer();
        stopTimer();
        timer.startSec = 0;
        timer.remainSec = 0;
        timer.exerciseKey = null;
    }

    function currentTimerKey() {
        if (!execCtx.dateKey || !execCtx.exerciseId) {
            return null;
        }
        return `${execCtx.dateKey}::${execCtx.exerciseId}`;
    }

    function startTimer(startSec) {
        const timer = ensureSharedTimer();
        const startValue = startSec || 0;
        timer.startSec = startValue;
        timer.remainSec = startValue;
        timer.running = true;
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
        }
        timer.intervalId = window.setInterval(runTick, 1000);
        const timerKey = currentTimerKey();
        if (timerKey) {
            timer.exerciseKey = timerKey;
        }
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

        const session = await db.getSession(execCtx.dateKey);
        const exercise = session.exercises.find((item) => item.exerciseId === execCtx.exerciseId);
        if (exercise && exercise.sets.length) {
            const last = exercise.sets[exercise.sets.length - 1];
            last.rest = Math.max(0, (last.rest || 0) + delta);
            await db.saveSession(session);
            await renderColumnA();
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

    function wireNavigation() {
        const { execBack } = assertRefs();
        execBack?.addEventListener('click', backToCaller);
    }

    function wireTimerControls() {
        const { timerToggle, timerMinus, timerPlus } = assertRefs();
        timerToggle?.addEventListener('click', () => {
            const timer = ensureSharedTimer();
            if (timer.running) {
                pauseTimer();
            } else {
                resumeTimer();
            }
        });
        timerMinus?.addEventListener('click', () => {
            void adjustTimer(-10);
        });
        timerPlus?.addEventListener('click', () => {
            void adjustTimer(10);
        });
    }

    function backToCaller() {
        switchScreen(execCtx.callerScreen || 'screenSessions');
        void A.renderWeek().then(() => A.renderSession());
    }

    function switchScreen(target) {
        const { screenSessions, screenExercises, screenExerciseEdit, screenExecEdit, screenExerciseRead } = assertRefs();
        const { screenRoutineEdit, screenRoutineMoveEdit, screenStatsList, screenStatsDetail } = refs;
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExecEdit,
            screenExerciseRead,
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
})();
