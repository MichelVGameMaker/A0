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
        session: null,
        metaMode: 'history',
        pendingFocus: null,
        replaceCallerScreen: 'screenExecEdit'
    };
    const detailsState = {
        exercise: null,
        initialDetails: '',
        saveTimer: null
    };
    let medalPopover = null;
    let medalPopoverCleanup = null;
    let detailsPopover = null;
    let detailsPopoverCleanup = null;
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
    A.getSessionMedalIconMap = () => medalIconMap;
    A.buildSessionExerciseMeta = async function buildSessionExerciseMeta(exercise, currentSets = [], options = {}) {
        return buildSetMeta(exercise, currentSets, options);
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
        wireDetails();
        wireMetaDialog();
        wireTimerControls();
    });

    /* ACTIONS */
    A.openExecEdit = async function openExecEdit(options = {}) {
        const {
            currentId,
            callerScreen = 'screenSessions',
            focusSetIndex = null,
            focusField = null,
            openMeta = false
        } = options;
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
        const exercise = Array.isArray(session.exercises) ? session.exercises.find((item) => item.id === currentId) : null;
        if (!exercise) {
            alert('Exercice introuvable dans la séance.');
            return;
        }

        normalizeExerciseSets(exercise);

        state.dateKey = dateKey;
        state.exerciseId = currentId;
        state.callerScreen = callerScreen;
        state.session = session;
        state.replaceCallerScreen = 'screenExecEdit';
        if (Number.isInteger(focusSetIndex) && focusSetIndex >= 0) {
            state.pendingFocus = {
                index: focusSetIndex,
                field: focusField
            };
        } else {
            state.pendingFocus = null;
        }
        const { execTitle, execDate } = assertRefs();
        execTitle.textContent = exercise.exercise_name || 'Exercice';
        execDate.textContent = A.fmtUI(date);
        updateExecDetailsPreview(exercise);
        setMetaMode('history');
        A.setTimerVisibility?.({ hidden: true });
        updateTimerUI();
        switchScreen('screenExecEdit');
        await renderSets();
        if (openMeta) {
            setTimeout(() => {
                if (state.exerciseId === currentId) {
                    openMoveEditorDialog();
                }
            }, 0);
        }
    };

    A.openExecMoveMeta = async function openExecMoveMeta(options = {}) {
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
        const exercise = Array.isArray(session.exercises) ? session.exercises.find((item) => item.id === currentId) : null;
        if (!exercise) {
            alert('Exercice introuvable dans la séance.');
            return;
        }

        normalizeExerciseSets(exercise);

        state.dateKey = dateKey;
        state.exerciseId = currentId;
        state.callerScreen = callerScreen;
        state.session = session;
        state.pendingFocus = null;
        state.replaceCallerScreen = callerScreen;
        updateExecDetailsPreview(exercise);

        openMoveEditorDialog();
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
        refs.execTitle = document.getElementById('execTitle');
        refs.execDate = document.getElementById('execDate');
        refs.execDelete = document.getElementById('execDelete');
        refs.execAddSet = document.getElementById('execAddSet');
        refs.execSets = document.getElementById('execSets');
        refs.execSetsLayout = document.getElementById('execSetsLayout');
        refs.execTimerBar = document.getElementById('execTimerBar');
        refs.execTimerDialog = document.getElementById('dlgExecTimer');
        refs.timerDetails = document.getElementById('tmrDetails');
        refs.timerDisplay = document.getElementById('tmrDisplay');
        refs.timerMinus = document.getElementById('tmrMinus');
        refs.timerPlus = document.getElementById('tmrPlus');
        refs.timerReset = document.getElementById('tmrReset');
        refs.dlgExecMoveEditor = document.getElementById('dlgExecMoveEditor');
        refs.execMoveUp = document.getElementById('execMoveUp');
        refs.execMoveDown = document.getElementById('execMoveDown');
        refs.execMoveAnnotate = document.getElementById('execMoveAnnotate');
        refs.execMoveDuplicate = document.getElementById('execMoveDuplicate');
        refs.execReplaceExercise = document.getElementById('execReplaceExercise');
        refs.execMetaToggle = document.getElementById('execMetaToggle');
        refs.btnExecDetails = document.getElementById('btnExecDetails');
        refs.execDetailsPreview = document.getElementById('execDetailsPreview');
        refs.dlgExecDetails = document.getElementById('dlgExecDetails');
        refs.execDetailsInput = document.getElementById('execDetailsInput');
        refs.execDetailsClose = document.getElementById('execDetailsClose');
        refs.execDetailsCancel = document.getElementById('execDetailsCancel');
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
            'execTitle',
            'execDate',
            'execDelete',
            'execAddSet',
            'execSets',
            'execTimerBar',
            'execTimerDialog',
            'timerDetails',
            'timerDisplay',
            'timerMinus',
            'timerPlus',
            'timerReset',
            'dlgExecMoveEditor',
            'execMoveUp',
            'execMoveDown',
            'execMoveAnnotate',
            'execMoveDuplicate',
            'execReplaceExercise',
            'execMetaToggle',
            'btnExecDetails',
            'execDetailsPreview',
            'dlgExecDetails',
            'execDetailsInput',
            'execDetailsClose',
            'execDetailsCancel'
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
            inlineKeyboard?.detach?.();
            backToCaller();
        });
    }

    function wireActions() {
        const {
            execAddSet,
            execDelete,
            execReplaceExercise,
            execMetaToggle,
            execMoveUp,
            execMoveDown,
            execMoveAnnotate,
            execMoveDuplicate
        } = assertRefs();
        execAddSet.addEventListener('click', () => {
            void addSet();
        });
        execDelete.addEventListener('click', () => {
            void removeExercise();
        });
        execReplaceExercise.addEventListener('click', () => {
            void replaceExercise();
        });
        execMoveUp.addEventListener('click', () => {
            void moveExerciseInSession(-1);
        });
        execMoveDown.addEventListener('click', () => {
            void moveExerciseInSession(1);
        });
        execMoveAnnotate.addEventListener('click', () => {
            const { dlgExecMoveEditor } = assertRefs();
            if (A.closeDialog) {
                A.closeDialog(dlgExecMoveEditor);
            } else {
                dlgExecMoveEditor?.close();
            }
            void openExecDetailsDialog();
        });
        execMoveDuplicate.addEventListener('click', () => {
            void duplicateExerciseInSession();
        });
        execMetaToggle.addEventListener('click', () => {
            const nextMode = getNextMetaMode();
            setMetaMode(nextMode);
        });
    }

    function wireDetails() {
        const {
            btnExecDetails,
            dlgExecDetails,
            execDetailsInput,
            execDetailsClose,
            execDetailsCancel
        } = ensureRefs();
        if (!btnExecDetails || !dlgExecDetails) {
            return;
        }
        btnExecDetails.addEventListener('click', () => {
            if (detailsPopover) {
                clearDetailsPopover();
                return;
            }
            const exercise = getExercise();
            const details = typeof exercise?.details === 'string' ? exercise.details.trim() : '';
            showDetailsPopover(btnExecDetails, details);
        });
        execDetailsClose?.addEventListener('click', () => {
            void closeExecDetailsDialog({ revert: false });
        });
        execDetailsCancel?.addEventListener('click', () => {
            void closeExecDetailsDialog({ revert: true });
        });
        dlgExecDetails.addEventListener('close', () => {
            void flushExecDetailsSave();
        });
        execDetailsInput?.addEventListener('input', () => {
            if (!detailsState.exercise) {
                return;
            }
            detailsState.exercise.details = execDetailsInput.value;
            updateExecDetailsPreview(detailsState.exercise);
            scheduleExecDetailsSave();
        });
    }

    function wireMetaDialog() {
        const { dlgExecMoveEditor } = assertRefs();
        dlgExecMoveEditor.addEventListener('click', (event) => {
            if (event.target === dlgExecMoveEditor) {
                if (A.closeDialog) {
                    A.closeDialog(dlgExecMoveEditor);
                } else {
                    dlgExecMoveEditor?.close();
                }
            }
        });
    }

    function openMoveEditorDialog() {
        const { dlgExecMoveEditor } = assertRefs();
        inlineKeyboard?.detach?.();
        dlgExecMoveEditor?.showModal();
        updateMoveOrderControls();
    }

    function wireTimerControls() {
        const { execTimerBar, execTimerDialog, timerMinus, timerPlus, timerReset, timerDisplay } = assertRefs();
        const handleToggle = () => {
            const timer = ensureSharedTimer();
            if (timer.running) {
                pauseTimer();
            } else {
                resumeTimer();
            }
        };
        timerDisplay.addEventListener('click', handleToggle);
        timerDisplay.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleToggle();
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

        execTimerDialog.addEventListener('click', (event) => {
            if (event.target === execTimerDialog) {
                setTimerVisibility({ hidden: true });
            }
        });

        execTimerDialog.addEventListener('close', () => {
            if (!isTimerHidden()) {
                setTimerVisibility({ hidden: true });
            }
        });
    }

    async function openExecDetailsDialog() {
        const { dlgExecDetails, execDetailsInput } = ensureRefs();
        const exercise = getExercise();
        if (!dlgExecDetails || !execDetailsInput || !exercise) {
            return;
        }
        detailsState.exercise = exercise;
        execDetailsInput.value = typeof exercise.details === 'string' ? exercise.details : '';
        detailsState.initialDetails = execDetailsInput.value;
        dlgExecDetails.showModal();
        focusTextareaAtEnd(execDetailsInput);
    }

    async function closeExecDetailsDialog({ revert }) {
        const { dlgExecDetails, execDetailsInput } = ensureRefs();
        if (!dlgExecDetails || !execDetailsInput) {
            return;
        }
        if (detailsState.exercise) {
            const nextDetails = revert ? detailsState.initialDetails || '' : execDetailsInput.value;
            detailsState.exercise.details = nextDetails;
            execDetailsInput.value = nextDetails;
            updateExecDetailsPreview(detailsState.exercise);
        }
        await flushExecDetailsSave();
        if (A.closeDialog) {
            A.closeDialog(dlgExecDetails);
        } else {
            dlgExecDetails.close();
        }
        if (!revert && isSessionScreenActive()) {
            await refreshSessionViews();
        }
    }

    function scheduleExecDetailsSave() {
        if (detailsState.saveTimer) {
            clearTimeout(detailsState.saveTimer);
        }
        detailsState.saveTimer = setTimeout(() => {
            void flushExecDetailsSave();
        }, 300);
    }

    async function flushExecDetailsSave() {
        if (detailsState.saveTimer) {
            clearTimeout(detailsState.saveTimer);
            detailsState.saveTimer = null;
        }
        if (!detailsState.exercise || !state.session) {
            return;
        }
        await persistSession(false);
    }

    function updateExecDetailsPreview(exercise) {
        const { execDetailsPreview } = ensureRefs();
        if (!execDetailsPreview) {
            return;
        }
        const details = typeof exercise?.details === 'string' ? exercise.details.trim() : '';
        execDetailsPreview.textContent = details;
        execDetailsPreview.dataset.empty = details ? 'false' : 'true';
    }

    function focusTextareaAtEnd(textarea) {
        if (!textarea) {
            return;
        }
        const focusInput = () => {
            textarea.focus();
            const length = textarea.value.length;
            textarea.setSelectionRange(length, length);
        };
        requestAnimationFrame(() => {
            focusInput();
            if (document.activeElement !== textarea) {
                setTimeout(focusInput, 0);
            }
        });
    }

    function getMetaModeLabel(mode = state.metaMode) {
        switch (mode) {
            case 'goals':
                return 'Objectifs';
            case 'medals':
                return 'Médailles';
            case 'record':
                return 'Record';
            default:
                return 'Historique';
        }
    }

    function getNextMetaMode() {
        const order = ['history', 'goals', 'medals', 'record'];
        const currentIndex = order.indexOf(state.metaMode);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
        return order[nextIndex];
    }

    function setMetaMode(nextMode) {
        const { execMetaToggle, execSetsLayout } = assertRefs();
        const mode = nextMode || 'history';
        state.metaMode = mode;
        execMetaToggle.textContent = getMetaModeLabel(mode);
        execMetaToggle.classList.toggle('selected', true);
        execMetaToggle.setAttribute('aria-pressed', 'true');
        execMetaToggle.setAttribute('aria-label', getMetaModeLabel(mode));
        if (execSetsLayout) {
            execSetsLayout.dataset.metaMode = state.metaMode;
        }
        closeInlineInputs();
        clearMedalPopover();
        clearDetailsPopover();
        void refreshSetMetaFrom(0);
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
        const { execSets, execMetaToggle, execSetsLayout } = assertRefs();
        ensureInlineEditor()?.close();
        clearMedalPopover();
        clearDetailsPopover();
        inlineKeyboard?.detach?.();
        execSets.innerHTML = '';
        if (execSetsLayout) {
            execSetsLayout.dataset.metaMode = state.metaMode;
        }
        if (!exercise) {
            if (execMetaToggle) {
                execMetaToggle.textContent = getMetaHeaderLabel();
            }
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const meta = await buildSetMeta(exercise, sets);
        if (execMetaToggle) {
            execMetaToggle.textContent = getMetaHeaderLabel();
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
        if (state.pendingFocus) {
            const pending = state.pendingFocus;
            state.pendingFocus = null;
            requestAnimationFrame(() => focusSetCell(pending.index, pending.field));
        }
    }

    function normalizeFocusField(field) {
        if (field === 'weight' || field === 'rpe' || field === 'rest' || field === 'reps') {
            return field;
        }
        return 'reps';
    }

    function focusSetCell(index, field) {
        const { execSets } = assertRefs();
        if (!execSets) {
            return;
        }
        const rows = Array.from(execSets.querySelectorAll('.exec-set-row'));
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

    function adjustExecScrollForKeyboard() {
        const { execAddSet, screenExecEdit } = assertRefs();
        const keyboard = document.querySelector('.inline-keyboard');
        const content = screenExecEdit?.querySelector?.('.content');
        if (!execAddSet || !keyboard || !content || keyboard.hidden) {
            return;
        }
        const keyboardRect = keyboard.getBoundingClientRect();
        if (!keyboardRect.height) {
            return;
        }
        const gap = 8;
        const desiredBottom = window.innerHeight - keyboardRect.height - gap;
        const addRect = execAddSet.getBoundingClientRect();
        if (addRect.bottom <= desiredBottom) {
            return;
        }
        const delta = addRect.bottom - desiredBottom;
        content.scrollTo({
            top: content.scrollTop + delta,
            behavior: 'smooth'
        });
    }

    async function refreshSetMetaFrom(startIndex = 0, metaOverride = null) {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        const { execSets } = assertRefs();
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (!sets.length) {
            return;
        }
        const meta = metaOverride || (await buildSetMeta(exercise, sets));
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

    function clearMedalPopover() {
        if (medalPopover) {
            medalPopover.remove();
            medalPopover = null;
        }
        if (medalPopoverCleanup) {
            medalPopoverCleanup();
            medalPopoverCleanup = null;
        }
    }

    function clearDetailsPopover() {
        if (detailsPopover) {
            detailsPopover.remove();
            detailsPopover = null;
        }
        if (detailsPopoverCleanup) {
            detailsPopoverCleanup();
            detailsPopoverCleanup = null;
        }
    }

    function showMedalPopover(target, label) {
        if (!target || !label) {
            return;
        }
        clearMedalPopover();
        const popover = document.createElement('div');
        popover.className = 'exec-medal-popover';
        if (String(label).includes('\n')) {
            popover.classList.add('exec-medal-popover--multiline');
        }
        popover.textContent = label;
        document.body.appendChild(popover);
        const rect = target.getBoundingClientRect();
        const popRect = popover.getBoundingClientRect();
        const padding = 8;
        let left = rect.left + rect.width / 2 - popRect.width / 2;
        left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
        let top = rect.top - popRect.height - padding;
        if (top < padding) {
            top = rect.bottom + padding;
        }
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        medalPopover = popover;
        const handleClose = (event) => {
            if (popover.contains(event.target) || target.contains(event.target)) {
                return;
            }
            clearMedalPopover();
        };
        const cleanup = () => {
            document.removeEventListener('click', handleClose);
            window.removeEventListener('scroll', handleClose, true);
            window.removeEventListener('resize', handleClose);
        };
        medalPopoverCleanup = cleanup;
        window.setTimeout(() => {
            document.addEventListener('click', handleClose);
            window.addEventListener('scroll', handleClose, true);
            window.addEventListener('resize', handleClose);
        }, 0);
    }

    function showDetailsPopover(target, detailsText) {
        if (!target) {
            return;
        }
        clearDetailsPopover();
        const popover = document.createElement('div');
        popover.className = 'exec-medal-popover exec-details-popover';
        const text = document.createElement('div');
        text.className = 'exec-details-popover__text';
        text.textContent = detailsText || 'Aucun détail.';
        const actions = document.createElement('div');
        actions.className = 'exec-details-popover__actions';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn ghost';
        editButton.textContent = 'Éditer';
        editButton.addEventListener('click', (event) => {
            event.stopPropagation();
            clearDetailsPopover();
            void openExecDetailsDialog();
        });
        actions.appendChild(editButton);
        popover.append(text, actions);
        document.body.appendChild(popover);
        const rect = target.getBoundingClientRect();
        const popRect = popover.getBoundingClientRect();
        const padding = 8;
        let left = rect.left + rect.width / 2 - popRect.width / 2;
        left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
        let top = rect.top - popRect.height - padding;
        if (top < padding) {
            top = rect.bottom + padding;
        }
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        detailsPopover = popover;
        const handleClose = (event) => {
            if (popover.contains(event.target) || target.contains(event.target)) {
                return;
            }
            clearDetailsPopover();
        };
        const cleanup = () => {
            document.removeEventListener('click', handleClose);
            window.removeEventListener('scroll', handleClose, true);
            window.removeEventListener('resize', handleClose);
        };
        detailsPopoverCleanup = cleanup;
        window.setTimeout(() => {
            document.addEventListener('click', handleClose);
            window.addEventListener('scroll', handleClose, true);
            window.addEventListener('resize', handleClose);
        }, 0);
    }

    function closeInlineInputs() {
        inlineKeyboard?.detach?.();
        ensureInlineEditor()?.close?.();
    }

    function buildMetaCell(set, index, meta) {
        const cell = document.createElement('div');
        cell.className = 'exec-meta-cell';
        const pos = safeInt(set?.pos, index + 1);
        if (state.metaMode === 'history' || state.metaMode === 'goals' || state.metaMode === 'record') {
            const map =
                state.metaMode === 'history'
                    ? meta?.historyByPos
                    : state.metaMode === 'goals'
                        ? meta?.goalsByPos
                        : meta?.recordByPos;
            const info = map?.get?.(pos) || null;
            const chip = document.createElement('div');
            chip.className = 'exec-history-set rpe-chip exec-meta-chip';
            chip.textContent = info?.text ?? '—';
            applyRpeTone(chip, info?.rpe);
            cell.appendChild(chip);
            cell.addEventListener('click', () => {
                closeInlineInputs();
                if (state.metaMode === 'record') {
                    const recordInfo = formatRecordInfo(info?.recordSet, meta?.weightUnit);
                    if (recordInfo) {
                        showMedalPopover(cell, recordInfo);
                    }
                }
                if (state.metaMode === 'history') {
                    const historyInfo = formatHistoryDetails(meta?.historyDetailsByPos?.get?.(pos));
                    if (historyInfo) {
                        showMedalPopover(cell, historyInfo);
                    }
                }
            });
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
            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = `exec-medal exec-medal-button ${medalConfig.className}`;
            badge.setAttribute('aria-label', medalConfig.label);
            const icon = document.createElement('img');
            icon.src = medalConfig.icon;
            icon.alt = medalConfig.label;
            icon.className = 'exec-medal-icon';
            badge.appendChild(icon);
            badge.addEventListener('click', (event) => {
                event.stopPropagation();
                closeInlineInputs();
                showMedalPopover(badge, medalConfig.label);
            });
            list.appendChild(badge);
        });
        cell.appendChild(list);
        cell.addEventListener('click', () => {
            closeInlineInputs();
            const medalInfo = formatMedalInfo(medals);
            if (medalInfo) {
                showMedalPopover(cell, medalInfo);
            }
        });
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

        const updatePreview = (source, { persist = true } = {}) => {
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
            if (persist) {
                const currentDone = getExercise()?.sets?.[currentIndex]?.done ?? set.done ?? false;
                void applySetEditorResult(
                    currentIndex,
                    { reps: value.reps, weight: value.weight, rpe: value.rpe, rest: value.rest },
                    { done: currentDone, render: false }
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
                    className: 'inline-keyboard-action--emphase',
                    onClick: async () => {
                        await applySetEditorResult(
                            currentIndex,
                            { reps: value.reps, weight: value.weight, rpe: value.rpe, rest: value.rest },
                            { done: true }
                        );
                        startTimer(value.rest, { setId: set.id, setIndex: currentIndex });
                    }
                },
                {
                    label: 'fermer clavier ⬇️'
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
                getValues: () => ({
                    reps: repsInput.value,
                    weight: weightInput.value,
                    rpe: rpeInput.value,
                    rest: parseRestInput(restInput.value, value.rest)
                }),
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
            const markDone = currentDone;
            await applySetEditorResult(currentIndex, next, { done: markDone, render: false });
            updatePreview(next, { persist: false });
            row.classList.toggle('exec-set-executed', markDone);
            row.classList.toggle('exec-set-planned', !markDone);
            await refreshSetMetaFrom(currentIndex);
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
                    if (field === 'weight' && /[.,]$/.test(String(next))) {
                        return;
                    }
                    void applyDirectChange(field, input.value);
                },
                onClose: () => {
                    input.blur();
                    ensureInlineEditor()?.close();
                }
            });
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
                attachInlineKeyboard(input, field);
                requestAnimationFrame(() => {
                    requestAnimationFrame(adjustExecScrollForKeyboard);
                });
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
            attachInlineKeyboard(target, field);
            requestAnimationFrame(() => {
                requestAnimationFrame(adjustExecScrollForKeyboard);
            });
        };

        const metaCell = buildMetaCell(set, index, meta);
        row.append(order, repsInput, weightInput, rpeInput, restInput, metaCell);
        return row;
    }

    async function buildSetMeta(exercise, currentSets = [], options = {}) {
        const { dateKey = state.dateKey } = options;
        const exerciseId = exercise?.exercise_id;
        const weightUnit = exercise?.weight_unit === 'imperial' ? 'lb' : 'kg';
        const previous = await findPreviousSessionForHistory(exerciseId, dateKey);
        const previousSets = Array.isArray(previous?.exercise?.sets) ? [...previous.exercise.sets] : [];
        previousSets.sort((a, b) => safeInt(a?.pos, 0) - safeInt(b?.pos, 0));
        const historyByPos = buildHistorySetMap(previousSets, weightUnit);
        const goalsByPos = buildHistorySetMap(previousSets, weightUnit);
        const previousAllSets = await collectPreviousExerciseSets(exerciseId, dateKey);
        const recordByPos = buildRecordSetMap(previousAllSets, weightUnit);
        const medalsByPos = await buildMedalMap(exerciseId, currentSets, dateKey, previousAllSets);
        const historyDetailsByPos = buildHistoryDetailsMap(previousAllSets, weightUnit);
        return { historyByPos, goalsByPos, recordByPos, medalsByPos, historyDetailsByPos, weightUnit };
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

    function buildHistoryDetailsMap(sets, weightUnit) {
        const sorted = (Array.isArray(sets) ? sets : [])
            .filter((set) => set?.dateKey)
            .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));
        const map = new Map();
        sorted.forEach((set, index) => {
            const pos = safeInt(set?.pos, index + 1);
            if (!pos) {
                return;
            }
            const list = map.get(pos) ?? [];
            if (list.length >= 5) {
                return;
            }
            list.push(formatHistoryDetailLine(set, weightUnit));
            map.set(pos, list);
        });
        return map;
    }

    function resolveSetOrm(value) {
        return Number.isFinite(value) ? value : null;
    }

    function buildRecordSetMap(sets, weightUnit) {
        const bestByPos = new Map();
        (Array.isArray(sets) ? sets : []).forEach((set, index) => {
            const pos = safeInt(set?.pos, index + 1);
            const orm = resolveSetOrm(set?.orm);
            if (orm == null) {
                return;
            }
            const currentBest = bestByPos.get(pos);
            if (!currentBest || orm > currentBest.orm) {
                bestByPos.set(pos, { set, orm });
            }
        });
        const map = new Map();
        bestByPos.forEach((record, pos) => {
            map.set(pos, {
                text: formatHistorySetLine(record.set, weightUnit),
                rpe: record.set?.rpe ?? null,
                recordSet: record.set
            });
        });
        return map;
    }

    async function buildMedalMap(exerciseId, currentSets = [], dateKey = state.dateKey, previousSetsOverride = null) {
        const previousSets = Array.isArray(previousSetsOverride)
            ? previousSetsOverride
            : await collectPreviousExerciseSets(exerciseId, dateKey);
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
            const orm = resolveSetOrm(set?.orm);
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
            const orm = resolveSetOrm(set?.orm);
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

    async function collectPreviousExerciseSets(exerciseId, dateKey = state.dateKey) {
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
                        rpe: set?.rpe ?? null,
                        rest: safeInt(set?.rest, null),
                        orm: resolveSetOrm(set?.orm),
                        ormRpe: resolveSetOrm(set?.ormRpe),
                        dateKey: date
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

    async function findPreviousSessionForHistory(exerciseId, dateKey = state.dateKey) {
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

    function formatOrmValue(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '0,0';
        }
        return numeric.toFixed(1).replace('.', ',');
    }

    function formatSetOrmSummary(set, weightUnit) {
        const orm = resolveSetOrm(set?.orm);
        const ormRpe = resolveSetOrm(set?.ormRpe);
        if (orm == null && ormRpe == null) {
            return '';
        }
        const left = orm != null ? `${formatOrmValue(orm)}${weightUnit}` : `—${weightUnit}`;
        const right = ormRpe != null ? `${formatOrmValue(ormRpe)}${weightUnit}` : `—${weightUnit}`;
        return `= ${left} / ${right}`;
    }

    function formatMetaSetLine(set, weightUnit) {
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

    function formatSetLineDetails(set, weightUnit) {
        const reps = Number.isFinite(set?.reps) ? set.reps : null;
        const weight = set?.weight != null ? Number(set.weight) : null;
        const rpe = set?.rpe != null && set?.rpe !== '' ? set.rpe : null;
        const rest = safeInt(set?.rest, null);
        const parts = [];
        if (reps != null) {
            parts.push(`${reps}x`);
        }
        if (weight != null && !Number.isNaN(weight)) {
            parts.push(`${formatNumber(weight)}${weightUnit}`);
        }
        if (rpe != null) {
            parts.push(`@rpe${formatRpeValue(rpe)}`);
        }
        let detail = parts.length ? parts.join(' ') : '—';
        if (rest != null && rest > 0) {
            detail += ` - ${formatRestDisplay(rest)}`;
        }
        const ormSummary = formatSetOrmSummary(set, weightUnit);
        if (ormSummary) {
            detail += ` ${ormSummary}`;
        }
        return detail;
    }

    function formatHistorySetLine(set, weightUnit) {
        return formatMetaSetLine(set, weightUnit);
    }

    function formatHistoryDateLabel(dateKey) {
        const date = dateKey ? new Date(dateKey) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatRpeValue(rpe) {
        if (rpe == null || rpe === '') {
            return '';
        }
        return formatNumber(rpe).replace('.', ',');
    }

    function formatHistoryDetailLine(set, weightUnit) {
        const dateLabel = formatHistoryDateLabel(set?.dateKey);
        const pos = safeInt(set?.pos, null);
        const setLabel = pos ? `#${pos}` : '#—';
        const detail = formatSetLineDetails(set, weightUnit);
        return `${dateLabel}, ${setLabel} - ${detail}`;
    }

    function formatHistoryDetails(lines = []) {
        const items = (Array.isArray(lines) ? lines : []).filter(Boolean);
        if (!items.length) {
            return '';
        }
        return items.join('\n');
    }

    function formatDetailedSetLine(set, weightUnit) {
        return formatMetaSetLine(set, weightUnit);
    }

    function formatRecordDateLabel(dateKey) {
        const date = dateKey ? new Date(dateKey) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: '2-digit' });
    }

    function formatRecordInfo(recordSet, weightUnit) {
        if (!recordSet) {
            return '';
        }
        const dateLabel = formatRecordDateLabel(recordSet.dateKey);
        const setLine = formatDetailedSetLine(recordSet, weightUnit || 'kg');
        if (dateLabel && dateLabel !== '—') {
            return `Record : ${dateLabel}, ${setLine}`;
        }
        return `Record : ${setLine}`;
    }

    function formatMedalInfo(medals = []) {
        const labels = (Array.isArray(medals) ? medals : [])
            .map((key) => medalIconMap[key]?.label)
            .filter(Boolean);
        if (!labels.length) {
            return '';
        }
        const prefix = labels.length > 1 ? 'Médailles : ' : 'Médaille : ';
        return `${prefix}${labels.join(' • ')}`;
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
        state.pendingFocus = {
            index: sets.length - 1,
            field: 'reps'
        };
        await persistSession(false);
        await appendSetRow(sets.length - 1);
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
        await persistSession(false);
        await removeSetRow(index);
    }

    async function appendSetRow(index) {
        const exercise = getExercise();
        const { execSets } = assertRefs();
        if (!exercise || !execSets) {
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const meta = await buildSetMeta(exercise, sets);
        const emptyState = execSets.querySelector('.empty');
        if (emptyState) {
            emptyState.remove();
        }
        execSets.appendChild(renderSetRow(sets[index], index, sets.length, meta));
        refreshExecSetOrderUI(execSets);
        await refreshSetMetaFrom(Math.max(0, index - 1), meta);
        if (state.pendingFocus) {
            const pending = state.pendingFocus;
            state.pendingFocus = null;
            requestAnimationFrame(() => focusSetCell(pending.index, pending.field));
        }
    }

    async function removeSetRow(index) {
        const exercise = getExercise();
        const { execSets } = assertRefs();
        if (!exercise || !execSets) {
            return;
        }
        closeInlineInputs();
        const rows = Array.from(execSets.querySelectorAll('.exec-set-row'));
        const row = rows[index];
        if (row) {
            row.remove();
        }
        refreshExecSetOrderUI(execSets);
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (!sets.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune série prévue.';
            execSets.appendChild(empty);
            return;
        }
        const meta = await buildSetMeta(exercise, sets);
        await refreshSetMetaFrom(index, meta);
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
        const reps = safePositiveInt(values.reps);
        const weight = sanitizeWeight(values.weight);
        const rpe = values.rpe != null && values.rpe !== '' ? clampRpe(values.rpe) : null;
        const orm = nextDone ? A.calculateOrm(weight, reps) : null;
        const ormRpe = nextDone ? A.calculateOrmWithRpe(weight, reps, rpe) : null;
        sets[index] = {
            ...sets[index],
            pos: index + 1,
            reps,
            weight,
            rpe,
            rest,
            done: nextDone,
            orm,
            ormRpe,
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

    function updateMoveOrderControls() {
        const { execMoveUp, execMoveDown } = assertRefs();
        if (!state.session?.exercises?.length || !state.exerciseId) {
            execMoveUp.disabled = true;
            execMoveDown.disabled = true;
            return;
        }
        const index = state.session.exercises.findIndex((item) => item.id === state.exerciseId);
        if (index === -1) {
            execMoveUp.disabled = true;
            execMoveDown.disabled = true;
            return;
        }
        execMoveUp.disabled = index === 0;
        execMoveDown.disabled = index === state.session.exercises.length - 1;
    }

    async function moveExerciseInSession(direction) {
        if (!state.session?.exercises?.length || !state.exerciseId) {
            return;
        }
        const index = state.session.exercises.findIndex((item) => item.id === state.exerciseId);
        if (index === -1) {
            return;
        }
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= state.session.exercises.length) {
            return;
        }
        const exercises = state.session.exercises;
        const swap = exercises[nextIndex];
        exercises[nextIndex] = exercises[index];
        exercises[index] = swap;
        exercises.forEach((item, idx) => {
            item.sort = idx + 1;
        });
        await persistSession(false);
        A.storeSessionScroll?.();
        if (!syncSessionListOrder()) {
            await refreshSessionViews();
        }
        updateMoveOrderControls();
        A.ensureSessionCardInView?.(state.exerciseId);
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
        const index = state.session.exercises.findIndex((item) => item.id === state.exerciseId);
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
        A.storeSessionScroll?.();
        if (!syncSessionListRemoval(state.exerciseId)) {
            await refreshSessionViews();
        }
        if (A.closeDialog) {
            A.closeDialog(refs.dlgExecMoveEditor);
        } else {
            refs.dlgExecMoveEditor?.close();
        }
        backToCaller();
    }

    async function duplicateExerciseInSession() {
        if (!state.session?.exercises?.length || !state.exerciseId) {
            return;
        }
        const index = state.session.exercises.findIndex((item) => item.id === state.exerciseId);
        if (index === -1) {
            return;
        }
        const original = state.session.exercises[index];
        const baseId =
            original.id || buildSessionExerciseId(state.session.id, original.exercise_name || original.exercise_id);
        const copy = {
            ...original,
            id: buildUniqueSessionExerciseId(baseId),
            date: state.session.date,
            sets: Array.isArray(original.sets) ? original.sets.map((set) => ({ ...set })) : []
        };
        refreshSetOrderMetadata(copy, copy.sets || []);
        state.session.exercises.splice(index + 1, 0, copy);
        state.session.exercises.forEach((item, idx) => {
            item.sort = idx + 1;
        });
        await persistSession(false);
        if (A.closeDialog) {
            A.closeDialog(refs.dlgExecMoveEditor);
        } else {
            refs.dlgExecMoveEditor?.close();
        }
        A.setSessionScrollTarget?.(copy.id);
        await refreshSessionViews();
        A.ensureSessionCardInView?.(copy.id);
    }

    async function replaceExercise() {
        const exercise = getExercise();
        if (!exercise) {
            return;
        }
        if (A.closeDialog) {
            A.closeDialog(refs.dlgExecMoveEditor);
        } else {
            refs.dlgExecMoveEditor?.close();
        }
        A.openExercises({
            mode: 'add',
            callerScreen: state.replaceCallerScreen || 'screenExecEdit',
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
        const previousId = exercise.id || exercise.exercise_id;
        const nextExercise = await db.get('exercises', nextId);
        if (!nextExercise) {
            alert('Exercice introuvable.');
            return;
        }
        const nextName = nextExercise.name || nextId;
        exercise.exercise_id = nextId;
        exercise.exercise_name = nextName;
        exercise.type = nextId;
        exercise.id = buildUniqueSessionExerciseId(
            exercise.id || buildSessionExerciseId(state.session.id, nextName),
            previousId
        );
        hydrateSetIdentifiers(exercise, exercise.sets || []);
        state.exerciseId = exercise.id;
        const { execTitle } = assertRefs();
        execTitle.textContent = nextName || 'Exercice';
        updateExecDetailsPreview(exercise);
        const timer = ensureSharedTimer();
        if (timer.attachment?.exerciseId === state.exerciseId) {
            resetTimerState();
        }
        await persistSession(false);
        A.storeSessionScroll?.();
        if (!syncSessionCardReplacement(previousId, exercise)) {
            await refreshSessionViews();
        }
    }

    function getExercise() {
        if (!state.session?.exercises) {
            return null;
        }
        return state.session.exercises.find((item) => item.id === state.exerciseId) || null;
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

    function buildUniqueSessionExerciseId(baseId, excludeId = null) {
        const fallback = baseId || 'exercice';
        if (!state.session?.exercises?.length) {
            return fallback;
        }
        const existing = new Set(
            state.session.exercises.map((exercise) => exercise.id || exercise.exercise_id).filter(Boolean)
        );
        if (excludeId) {
            existing.delete(excludeId);
        }
        if (!existing.has(fallback)) {
            return fallback;
        }
        let counter = 2;
        let candidate = `${fallback}-${counter}`;
        while (existing.has(candidate)) {
            counter += 1;
            candidate = `${fallback}-${counter}`;
        }
        return candidate;
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

    function syncSessionListOrder() {
        if (!isSessionScreenActive()) {
            return false;
        }
        const sessionList = document.getElementById('sessionList');
        if (!sessionList || !state.session?.exercises?.length) {
            return false;
        }
        const cards = Array.from(sessionList.querySelectorAll('.exercise-card'));
        if (!cards.length) {
            return false;
        }
        const cardMap = new Map(cards.map((card) => [card.dataset.exerciseId, card]));
        let updated = false;
        state.session.exercises.forEach((exercise) => {
            const card = cardMap.get(exercise.id || exercise.exercise_id);
            if (card) {
                sessionList.appendChild(card);
                updated = true;
            }
        });
        const empty = sessionList.querySelector('.empty');
        if (empty && updated) {
            empty.remove();
        }
        return updated;
    }

    function syncSessionListRemoval(exerciseId) {
        if (!isSessionScreenActive()) {
            return false;
        }
        const sessionList = document.getElementById('sessionList');
        if (!sessionList) {
            return false;
        }
        if (!state.session?.exercises?.length) {
            sessionList.innerHTML = '<div class="empty">Aucun exercice pour cette date.</div>';
            return true;
        }
        const card = findSessionCard(sessionList, exerciseId);
        if (!card) {
            return false;
        }
        card.remove();
        return true;
    }

    function syncSessionCardReplacement(previousId, exercise) {
        if (!isSessionScreenActive()) {
            return false;
        }
        const sessionList = document.getElementById('sessionList');
        if (!sessionList) {
            return false;
        }
        const card = findSessionCard(sessionList, previousId);
        if (!card) {
            return false;
        }
        const nextName = exercise.exercise_name || 'Exercice';
        card.dataset.exerciseId = exercise.id || exercise.exercise_id;
        card.setAttribute('aria-label', nextName);
        const titleRow = card.querySelector('.exercise-card-title-row');
        const name = document.createElement('div');
        name.className = 'element exercise-card-name';
        name.textContent = nextName;
        name.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!exercise.exercise_id) {
                return;
            }
            void A.openExerciseRead({ currentId: exercise.exercise_id, callerScreen: 'screenSessions' });
        });
        const oldName = card.querySelector('.exercise-card-name');
        if (titleRow && oldName) {
            titleRow.replaceChild(name, oldName);
        } else if (oldName) {
            oldName.replaceWith(name);
        }
        return true;
    }

    function findSessionCard(sessionList, exerciseId) {
        return Array.from(sessionList.querySelectorAll('.exercise-card')).find(
            (card) => card.dataset.exerciseId === exerciseId
        );
    }

    function isSessionScreenActive() {
        const screen = document.getElementById('screenSessions');
        return Boolean(screen && !screen.hidden);
    }

    function backToCaller() {
        if (A.closeDialog) {
            A.closeDialog(refs.dlgExecMoveEditor);
        } else {
            refs.dlgExecMoveEditor?.close();
        }
        switchScreen(state.callerScreen || 'screenSessions');
        void refreshSessionViews();
    }

    function switchScreen(target) {
        inlineKeyboard?.detach?.();
        if (target === 'screenSessions') {
            A.setTimerVisibility?.({ hidden: true });
        }
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
            exerciseId: exercise.id || exercise.exercise_id,
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
            ? session.exercises.find((item) => item.id === attachment.exerciseId) ||
              session.exercises.find((item) => item.exercise_id === attachment.exerciseId)
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
    A.isTimerHidden = () => isTimerHidden();

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
        if (timer.remainSec <= -5 * 60) {
            stopTimer();
            updateTimerUI();
            return;
        }
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
        const { execTimerBar, execTimerDialog, timerDetails, timerDisplay } = assertRefs();
        if (!execTimerBar) {
            return;
        }
        const shouldHide = isTimerHidden();
        syncTimerBarSpacer(execTimerBar, shouldHide);
        if (execTimerDialog) {
            if (shouldHide && execTimerDialog.open) {
                execTimerDialog.close();
            } else if (!shouldHide && !execTimerDialog.open) {
                execTimerDialog.show();
            }
        }
        updateSessionTabDisplay(timer);
        if (shouldHide) {
            timerDisplay.classList.remove('tmr-display--warning', 'tmr-display--negative');
            timerDisplay.classList.remove('tmr-display--running');
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
        timerDisplay.classList.toggle('tmr-display--running', timer.running);
        timerDisplay.classList.toggle('tmr-display--warning', isWarning);
        timerDisplay.classList.toggle('tmr-display--negative', isNegative);
        timerDisplay.textContent = `${sign}${minutes}:${String(seconds).padStart(2, '0')}`;
        syncTimerBarSpacer(execTimerBar, false);
    }

    function updateSessionTabDisplay(timer = ensureSharedTimer()) {
        ensureRefs();
        const { tabSessions, execTimerDialog } = refs;
        if (!tabSessions) {
            return;
        }
        const isActive = tabSessions.classList.contains('active');
        tabSessions.classList.toggle('tab--session-timer', isActive);
        tabSessions.classList.toggle('tab--session-date', !isActive);
        const showClose = isActive && execTimerDialog?.open && !isTimerHidden();
        if (showClose) {
            tabSessions.classList.remove('tab--warning', 'tab--negative');
            tabSessions.innerHTML = '<span class="tab-session-close">✕</span>';
            return;
        }
        if (!isActive) {
            tabSessions.classList.remove('tab--warning', 'tab--negative');
            const date = A.activeDate || A.today();
            tabSessions.textContent = date
                .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                .replace('.', '');
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
        tabSessions.innerHTML = `<span class="tab-session-time">${sign}${minutes}:${String(seconds).padStart(2, '0')}</span>`;
    }
    A.updateSessionTabDisplay = () => updateSessionTabDisplay();
    A.updateTimerUI = () => updateTimerUI();

    function syncTimerBarSpacer(execTimerBar, shouldHide) {
        const root = document.documentElement;
        root.style.setProperty('--timer-bar-h', '0px');
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
