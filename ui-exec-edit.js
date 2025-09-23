// ui-exec-edit.js — 3.4.2 (Colonne A) : édition + timer, sans bouton "Enregistrer"
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    let execCtx = { dateKey: null, exerciseId: null, exerciseName: '', callerScreen: 'screenSessions' };
    let execTimer = { running: false, startSec: 0, remainSec: 0, intervalId: null };

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

        execTimer = { running: false, startSec: 0, remainSec: 0, intervalId: null };
        A.execTimer = execTimer;

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

    async function renderColumnA(editPos = null) {
        const { execExecuted, execEditable, execRestToggle, execOk } = assertRefs();
        const session = await db.getSession(execCtx.dateKey);
        const exercise = session?.exercises.find((item) => item.exerciseId === execCtx.exerciseId);
        if (!exercise) {
            return;
        }

        execExecuted.innerHTML = '';
        execEditable.innerHTML = '';

        exercise.sets.forEach((set) => {
            if (editPos === set.pos) {
                execEditable.appendChild(rowEditable(set, false));
            } else {
                const row = rowReadOnly(set);
                row.addEventListener('click', () => {
                    void renderColumnA(set.pos);
                });
                execExecuted.appendChild(row);
            }
        });

        if (!execEditable.children.length) {
            const firstPlanned = exercise.sets.find((set) => set.done !== true);
            if (firstPlanned) {
                execEditable.appendChild(rowEditable(firstPlanned, false));
            }
        }

        execRestToggle.onclick = async () => {
            const timerVisible = !refs.execTimerBar.hidden;
            const holder = execEditable.querySelector('.js-edit-holder');
            if (!holder || !holder._collect) {
                alert('Renseigne la série avant le repos.');
                return;
            }
            const payload = JSON.parse(holder.dataset.payload || '{}');
            const value = holder._collect();

            if (!timerVisible) {
                await saveSet(payload, value, true);
                startTimer(value.rest);
                execRestToggle.textContent = 'Reprendre une série';
            } else {
                const remaining = execTimer.remainSec;
                await saveRemainingRest(remaining);
                stopTimer();
                updateTimerUI();
                execRestToggle.textContent = 'Repos';
                const sessionAfter = await db.getSession(execCtx.dateKey);
                const exerciseAfter = sessionAfter.exercises.find((item) => item.exerciseId === execCtx.exerciseId);
                const nextPos = (exerciseAfter?.sets.length || 0) + 1;
                execEditable.innerHTML = '';
                execEditable.appendChild(rowEditable(defaultNewSet(nextPos), true));
            }
        };

        execOk.onclick = async () => {
            const holder = execEditable.querySelector('.js-edit-holder');
            if (holder && holder._collect) {
                const payload = JSON.parse(holder.dataset.payload || '{}');
                const value = holder._collect();
                await saveSet(payload, value, true);
            }
            backToCaller();
        };

        updateTimerUI();
        execRestToggle.textContent = refs.execTimerBar?.hidden ? 'Repos' : 'Reprendre une série';
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

    function rowEditable(set, isNew) {
        const row = document.createElement('div');
        row.className = 'exec-grid exec-row';

        const reps = vStepper(safeInt(set.reps), 0, 100);
        const weight = vStepper(safeInt(set.weight), 0, 999);

        const rpeWrap = document.createElement('div');
        const rpe = document.createElement('input');
        rpe.type = 'number';
        rpe.className = 'input';
        rpe.min = '5';
        rpe.max = '10';
        rpe.inputMode = 'numeric';
        rpe.value = set.rpe == null ? '' : String(set.rpe);
        rpe.oninput = () => {
            rpeWrap.dataset.rpe = clampInt(rpe.value, 5, 10) || '';
        };
        rpeWrap.appendChild(rpe);
        rpeWrap.className = 'rpe-wrap';

        const rest = document.createElement('input');
        rest.type = 'text';
        rest.className = 'input';
        rest.placeholder = 'mm:ss';
        rest.value = fmtTime(safeInt(set.rest));
        rest.pattern = '^\\d{1,2}:\\d{2}$';

        const holder = document.createElement('div');
        holder.className = 'js-edit-holder';
        holder.dataset.payload = JSON.stringify({ pos: set.pos, isNew });
        holder._collect = () => ({
            reps: parseInt(reps.input.value || '0', 10),
            weight: parseInt(weight.input.value || '0', 10),
            rpe: rpe.value ? parseInt(rpe.value, 10) : null,
            rest: parseTime(rest.value)
        });

        row.append(reps.el, weight.el, rpeWrap, rest, holder);
        return row;
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
        return { el: wrap, input };
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

    function startTimer(startSec) {
        execTimer.startSec = startSec || 0;
        execTimer.remainSec = startSec || 0;
        execTimer.running = true;
        if (execTimer.intervalId) {
            clearInterval(execTimer.intervalId);
        }
        execTimer.intervalId = window.setInterval(runTick, 1000);
        A.execTimer = execTimer;
        updateTimerUI();
    }

    function pauseTimer() {
        execTimer.running = false;
        updateTimerUI();
    }

    function resumeTimer() {
        execTimer.running = true;
        updateTimerUI();
    }

    function stopTimer() {
        if (execTimer.intervalId) {
            clearInterval(execTimer.intervalId);
        }
        execTimer.intervalId = null;
        execTimer.running = false;
    }

    function runTick() {
        if (!execTimer.running) {
            return;
        }
        execTimer.remainSec -= 1;
        if (execTimer.remainSec === 0 && navigator.vibrate) {
            try {
                navigator.vibrate(200);
            } catch {
                /* ignore */
            }
        }
        updateTimerUI();
    }

    async function adjustTimer(delta) {
        execTimer.startSec += delta;
        execTimer.remainSec += delta;

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
        const { execTimerBar, timerDisplay, timerToggle } = assertRefs();
        if (!execTimerBar) {
            return;
        }

        const shouldHide = !execTimer.intervalId && !execTimer.running && execTimer.startSec === 0;
        execTimerBar.hidden = shouldHide;
        if (shouldHide) {
            return;
        }

        const remaining = execTimer.remainSec;
        const sign = remaining < 0 ? '-' : '';
        const abs = Math.abs(remaining);
        const minutes = Math.floor(abs / 60);
        const seconds = abs % 60;
        timerDisplay.textContent = `${sign}${minutes}:${String(seconds).padStart(2, '0')}`;
        timerToggle.textContent = execTimer.running ? '⏸' : '▶︎';
    }

    function wireNavigation() {
        const { execBack } = assertRefs();
        execBack?.addEventListener('click', backToCaller);
    }

    function wireTimerControls() {
        const { timerToggle, timerMinus, timerPlus } = assertRefs();
        timerToggle?.addEventListener('click', () => {
            if (execTimer.running) {
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
