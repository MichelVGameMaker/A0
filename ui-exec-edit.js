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
        const nextPlanned = orderedSets.find((set) => set.done !== true) || null;
        const entryKind = nextPlanned ? 'planned' : 'new';
        const entryTemplate = nextPlanned ? { ...nextPlanned } : createTemplateFromLast(orderedSets);

        if (selectionOverride) {
            currentSelection = selectionOverride;
        }

        const executedPositions = new Set(executedSets.map((set) => set.pos));
        if (currentSelection?.kind === 'existing' && !executedPositions.has(currentSelection.pos)) {
            currentSelection = null;
        }
        if (currentSelection?.kind === 'planned' && entryKind !== 'planned') {
            currentSelection = null;
        }
        if (currentSelection?.kind === 'new' && entryKind !== 'new') {
            currentSelection = null;
        }

        if (!currentSelection) {
            if (entryTemplate) {
                currentSelection = entryKind === 'planned' ? { kind: 'planned', pos: entryTemplate.pos } : { kind: 'new', pos: entryTemplate.pos };
            } else if (executedSets.length) {
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

        if (entryTemplate) {
            const entryRow = rowPreview(entryTemplate, entryKind);
            const isEntrySelected = currentSelection && currentSelection.kind !== 'existing';
            applySelectionStyle(entryRow, Boolean(isEntrySelected));
            entryRow.style.cursor = 'pointer';
            entryRow.addEventListener('click', () => {
                void renderColumnA(entryKind === 'planned' ? { kind: 'planned', pos: entryTemplate.pos } : { kind: 'new', pos: entryTemplate.pos });
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
        row.className = 'exec-grid exec-row';
        row.innerHTML = `
            <div class="details">${safeInt(set.reps)}</div>
            <div class="details">${safeInt(set.weight)} kg</div>
            <div class="details">${rpeChip(set.rpe)}</div>
            <div class="details">${fmtTime(safeInt(set.rest))}</div>
            <div></div>
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
        const hintCell = row.children[4];
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

        if (!currentHolder || !currentHolder._controls) {
            execRestToggle.disabled = true;
            return;
        }

        const controls = currentHolder._controls;
        const updateState = () => {
            const repsValue = parseInt(controls?.reps?.input?.value || '0', 10);
            execRestToggle.disabled = !repsValue;
        };

        const bindStepper = (stepper) => {
            if (!stepper) {
                return;
            }
            if (stepper.input) {
                stepper.input.addEventListener('input', updateState);
            }
            if (stepper.plus) {
                stepper.plus.addEventListener('click', () => {
                    window.setTimeout(updateState, 0);
                });
            }
            if (stepper.minus) {
                stepper.minus.addEventListener('click', () => {
                    window.setTimeout(updateState, 0);
                });
            }
        };

        bindStepper(controls.reps);
        bindStepper(controls.weight);

        controls.rpe?.addEventListener('change', updateState);
        controls.rest?.addEventListener('input', updateState);

        updateState();
    }

    function rowEditable(set, isNew) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row exec-edit-row';

        const reps = vStepper(safeInt(set.reps), 0, 100);
        const weight = vStepper(safeInt(set.weight), 0, 999);
        reps.input.dataset.role = 'reps';
        weight.input.dataset.role = 'weight';

        const rpeWrap = document.createElement('div');
        const rpe = document.createElement('select');
        rpe.className = 'input';
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '—';
        rpe.appendChild(emptyOption);
        for (let value = 5; value <= 10; value += 1) {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = String(value);
            rpe.appendChild(option);
        }
        const clampedRpe = clampInt(set.rpe, 5, 10);
        rpe.value = clampedRpe ? String(clampedRpe) : '';
        rpe.dataset.role = 'rpe';
        const updateRpeDataset = () => {
            const numeric = clampInt(rpe.value, 5, 10);
            rpeWrap.dataset.rpe = numeric ? String(numeric) : '';
        };
        rpe.addEventListener('change', updateRpeDataset);
        updateRpeDataset();
        rpeWrap.appendChild(rpe);
        rpeWrap.className = 'rpe-wrap';

        const rest = document.createElement('input');
        rest.type = 'text';
        rest.className = 'input';
        rest.placeholder = 'mm:ss';
        rest.value = fmtTime(safeInt(set.rest));
        rest.pattern = '^\\d{1,2}:\\d{2}$';
        rest.dataset.role = 'rest';

        const holder = document.createElement('div');
        holder.className = 'js-edit-holder';
        holder.dataset.payload = JSON.stringify({ pos: set.pos, isNew });
        holder._collect = () => ({
            reps: parseInt(reps.input.value || '0', 10),
            weight: parseInt(weight.input.value || '0', 10),
            rpe: rpe.value ? parseInt(rpe.value, 10) : null,
            rest: parseTime(rest.value)
        });
        holder._controls = { reps, weight, rpe, rest };

        row.append(reps.el, weight.el, rpeWrap, rest, holder);
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

    function vStepper(val, min, max) {
        const wrap = document.createElement('div');
        wrap.className = 'vstepper';
        const plus = document.createElement('button');
        plus.className = 'btn';
        plus.textContent = '+';
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'input';
        input.inputMode = 'numeric';
        input.value = String(val);
        input.min = String(min);
        input.max = String(max);
        const minus = document.createElement('button');
        minus.className = 'btn';
        minus.textContent = '−';
        plus.onclick = () => {
            input.value = String(Math.min(max, parseInt(input.value || '0', 10) + 1));
        };
        minus.onclick = () => {
            input.value = String(Math.max(min, parseInt(input.value || '0', 10) - 1));
        };
        wrap.append(plus, input, minus);
        return { el: wrap, input, plus, minus };
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

    function safeInt(value) {
        return Number.isFinite(value) ? value : 0;
    }

    function clampInt(value, min, max) {
        const numeric = parseInt(value, 10);
        if (Number.isNaN(numeric)) {
            return null;
        }
        return Math.max(min, Math.min(max, numeric));
    }

    function fmtTime(seconds) {
        const safe = parseInt(seconds || 0, 10);
        const minutes = Math.floor(Math.abs(safe) / 60);
        const secs = Math.abs(safe) % 60;
        const sign = safe < 0 ? '-' : '';
        return `${sign}${minutes}:${String(secs).padStart(2, '0')}`;
    }

    function parseTime(raw) {
        const match = /^(\d{1,2}):(\d{2})$/.exec(String(raw || ''));
        if (!match) {
            return 0;
        }
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
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
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExecEdit,
            screenExerciseRead
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
