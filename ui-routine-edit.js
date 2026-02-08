// ui-routine-edit.js — édition d'une routine (liste + méta)
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-routine-edit: composant listCard manquant.');
    }

    /* STATE */
    const ICONS = ['🏋️', '💪', '🤸', '🏃', '🧘', '🚴', '🥊', '🏊', '🧗', '⚽'];
    const refs = {};
    let refsResolved = false;
    let routineEditorSnapshot = null;
    let routineDetailsSnapshot = null;
    const state = {
        routineId: 'routine-test',
        callerScreen: 'screenSettings',
        routine: null,
        active: false,
        pendingSave: null
    };
    const dragCtx = {
        active: false,
        card: null,
        handle: null,
        placeholder: null,
        pointerId: null,
        offsetY: 0,
        initialOrder: []
    };
    const routineScrollState = {
        top: 0,
        pendingRestore: false,
        targetMoveId: null
    };
    let detailsPopover = null;
    let detailsPopoverCleanup = null;
    let activeContextCard = null;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireInputs();
        wireAddExercisesButton();
        wireHeaderButtons();
        wireRoutineDetails();
        wireRoutineActions();
        wireRoutineContextDialog();
        wireValueStates();
    });

    /* ACTIONS */
    A.openRoutineEdit = async function openRoutineEdit(options = {}) {
        const { routineId = 'routine-test', callerScreen = 'screenSettings' } = options;
        state.routineId = routineId;
        state.callerScreen = callerScreen;
        state.active = true;
        await loadRoutine(true);
        renderRoutine();
        switchScreen('screenRoutineEdit');
    };

    A.refreshRoutineEdit = async function refreshRoutineEdit() {
        if (!state.routineId) {
            return;
        }
        ensureRefs();
        state.active = !refs.screenRoutineEdit?.hidden;
        await loadRoutine(true);
        if (state.active) {
            renderRoutine();
        }
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
        refs.screenRoutineList = document.getElementById('screenRoutineList');
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenStatExercises = document.getElementById('screenStatExercises');
        refs.screenStatExercisesDetail = document.getElementById('screenStatExercisesDetail');
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.routineName = document.getElementById('routineName');
        refs.routineIcon = document.getElementById('routineIcon');
        refs.btnRoutineDetails = document.getElementById('btnRoutineDetails');
        refs.routineDetailsPreview = document.getElementById('routineDetailsPreview');
        refs.dlgRoutineDetails = document.getElementById('dlgRoutineDetails');
        refs.routineDetailsInput = document.getElementById('routineDetailsInput');
        refs.routineDetailsClose = document.getElementById('routineDetailsClose');
        refs.routineDetailsCancel = document.getElementById('routineDetailsCancel');
        refs.dlgRoutineEditor = document.getElementById('dlgRoutineEditor');
        refs.routineEditorClose = document.getElementById('routineEditorClose');
        refs.routineEditorCancel = document.getElementById('routineEditorCancel');
        refs.routineEditMenu = document.getElementById('routineEditMenu');
        refs.dlgRoutineMoveEditor = document.getElementById('dlgRoutineMoveEditor');
        refs.dlgRoutineActions = document.getElementById('dlgRoutineActions');
        refs.routineShare = document.getElementById('routineShare');
        refs.routineDuplicateAction = document.getElementById('routineDuplicateAction');
        refs.routineDeleteAction = document.getElementById('routineDeleteAction');
        refs.routineList = document.getElementById('routineList');
        refs.routineEditTitle = document.getElementById('routineEditTitle');
        refs.btnRoutineAddExercises = document.getElementById('btnRoutineAddExercises');
        refs.routineEditBack = document.getElementById('routineEditBack');
        refs.routineEditEdit = document.getElementById('routineEditEdit');
        refsResolved = true;
        return refs;
    }

    function isSettingsScreen(name) {
        return name === 'screenSettings' || name === 'screenPreferences' || name === 'screenData';
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenRoutineEdit',
            'routineName',
            'routineIcon',
            'routineList',
            'routineEditTitle',
            'btnRoutineAddExercises',
            'routineEditBack',
            'routineEditEdit',
            'dlgRoutineEditor',
            'routineEditorClose',
            'routineEditorCancel'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routine-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function getRoutineScrollContainer() {
        const { routineContent, screenRoutineEdit } = ensureRefs();
        if (routineContent) {
            return routineContent;
        }
        const content = screenRoutineEdit?.querySelector('.content') || null;
        refs.routineContent = content;
        return content;
    }

    function storeRoutineScroll() {
        const container = getRoutineScrollContainer();
        if (!container) {
            return;
        }
        routineScrollState.top = container.scrollTop || 0;
        routineScrollState.pendingRestore = true;
    }

    function restoreRoutineScroll() {
        if (!routineScrollState.pendingRestore) {
            return;
        }
        const container = getRoutineScrollContainer();
        if (!container) {
            return;
        }
        let restored = false;
        if (routineScrollState.targetMoveId) {
            const target = container.querySelector(
                `[data-move-id="${CSS.escape(routineScrollState.targetMoveId)}"]`
            );
            if (target) {
                const containerRect = container.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                container.scrollTop = container.scrollTop + (targetRect.top - containerRect.top);
                restored = true;
            }
            routineScrollState.targetMoveId = null;
        }
        if (!restored) {
            container.scrollTop = routineScrollState.top;
        }
        routineScrollState.pendingRestore = false;
    }

    A.storeRoutineEditScroll = () => storeRoutineScroll();
    A.restoreRoutineEditScroll = () => restoreRoutineScroll();
    A.setRoutineEditScrollTarget = (moveId) => setRoutineScrollTarget(moveId);
    A.setRoutineEditScrollTargetByExercise = (exerciseId) => {
        if (!exerciseId || !Array.isArray(state.routine?.moves)) {
            return;
        }
        const move = state.routine.moves.find((item) => item.exerciseId === exerciseId);
        if (move?.id) {
            setRoutineScrollTarget(move.id);
        }
    };
    A.ensureRoutineMoveInView = (moveId) => {
        if (!moveId) {
            return false;
        }
        const container = getRoutineScrollContainer();
        if (!container) {
            return false;
        }
        const target = container.querySelector(`[data-move-id="${CSS.escape(moveId)}"]`);
        if (!target) {
            return false;
        }
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        if (targetRect.top < containerRect.top) {
            container.scrollTop += targetRect.top - containerRect.top;
        } else if (targetRect.bottom > containerRect.bottom) {
            container.scrollTop += targetRect.bottom - containerRect.bottom;
        }
        return true;
    };

    function attachRoutineCardPressHandlers(card) {
        if (!card) {
            return;
        }
        const LONG_PRESS_DELAY = 450;
        let pressTimer = null;
        let longPressFired = false;
        let startX = 0;
        let startY = 0;
        const clearPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };
        const shouldIgnoreDown = (event) =>
            Boolean(event.target.closest('button, a, input, textarea, select, .exercise-card-name'));
        const shouldIgnoreShortPress = (event) =>
            Boolean(
                event.target.closest(
                    'button, a, input, textarea, select, .exercise-card-name, .session-card-sets'
                )
            );
        const fireShortPress = () => {
            const moveId = card.dataset.moveId;
            if (!moveId) {
                return;
            }
            setRoutineScrollTarget(moveId);
            void A.openRoutineMoveEdit?.({
                routineId: state.routineId,
                moveId,
                callerScreen: 'screenRoutineEdit'
            });
        };
        const fireLongPress = () => {
            const moveId = card.dataset.moveId;
            if (!moveId) {
                return;
            }
            setRoutineScrollTarget(moveId);
            setActiveContextCard(card);
            void A.openRoutineMoveMeta?.({
                routineId: state.routineId,
                moveId,
                callerScreen: 'screenRoutineEdit'
            });
        };
        const onPointerDown = (event) => {
            if (event.button !== 0 && event.pointerType !== 'touch') {
                return;
            }
            if (shouldIgnoreDown(event)) {
                return;
            }
            clearPress();
            longPressFired = false;
            startX = event.clientX;
            startY = event.clientY;
            pressTimer = setTimeout(() => {
                longPressFired = true;
                clearPress();
                fireLongPress();
            }, LONG_PRESS_DELAY);
        };
        const onPointerMove = (event) => {
            if (!pressTimer) {
                return;
            }
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            if (Math.hypot(deltaX, deltaY) > 8) {
                clearPress();
            }
        };
        const onPointerUp = (event) => {
            if (shouldIgnoreShortPress(event)) {
                clearPress();
                return;
            }
            if (pressTimer) {
                clearPress();
            }
            if (!longPressFired) {
                fireShortPress();
            }
        };
        const onPointerCancel = () => {
            clearPress();
        };

        card.addEventListener('pointerdown', onPointerDown);
        card.addEventListener('pointermove', onPointerMove);
        card.addEventListener('pointerup', onPointerUp);
        card.addEventListener('pointercancel', onPointerCancel);
        card.addEventListener('pointerleave', onPointerCancel);
    }

    function setRoutineScrollTarget(moveId) {
        if (!moveId) {
            return;
        }
        routineScrollState.targetMoveId = moveId;
        storeRoutineScroll();
    }

    function setActiveContextCard(card) {
        if (activeContextCard && activeContextCard !== card) {
            activeContextCard.classList.remove('is-context-open');
        }
        activeContextCard = card;
        activeContextCard?.classList.add('is-context-open');
    }

    function clearActiveContextCard() {
        if (!activeContextCard) {
            return;
        }
        activeContextCard.classList.remove('is-context-open');
        activeContextCard = null;
    }

    function wireRoutineContextDialog() {
        const { dlgRoutineMoveEditor } = ensureRefs();
        if (!dlgRoutineMoveEditor) {
            return;
        }
        dlgRoutineMoveEditor.addEventListener('close', () => {
            clearActiveContextCard();
        });
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

    function showDetailsPopover(target, detailsText) {
        if (!target) {
            return;
        }
        clearDetailsPopover();
        const popover = document.createElement('div');
        popover.className = 'exec-medal-popover exec-details-popover';
        const text = document.createElement('div');
        text.className = 'exec-details-popover__text';
        text.textContent = detailsText || 'Aucune instructions';
        popover.append(text);
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

    function wireHeaderButtons() {
        const { routineEditBack, routineEditEdit, dlgRoutineEditor, routineName, routineIcon } = assertRefs();
        routineEditBack.addEventListener('click', () => {
            if (state.callerScreen === 'screenPlanning' || state.callerScreen === 'screenPlanningRoutines') {
                void A.openPlanning?.({ section: 'routines' });
                return;
            }
            void A.openRoutineList({ callerScreen: state.callerScreen });
        });
        routineEditEdit.addEventListener('click', () => {
            if (state.routine) {
                routineEditorSnapshot = {
                    name: state.routine.name || '',
                    icon: state.routine.icon || ICONS[0]
                };
                routineName.value = routineEditorSnapshot.name;
                routineIcon.value = routineEditorSnapshot.icon;
                renderIconPreview();
                refreshValueStates();
            }
            dlgRoutineEditor?.showModal();
        });
    }

    function wireRoutineActions() {
        const {
            routineEditMenu,
            dlgRoutineActions,
            routineShare,
            routineDuplicateAction,
            routineDeleteAction
        } = ensureRefs();
        if (!routineEditMenu || !dlgRoutineActions) {
            return;
        }
        const closeRoutineActions = () => {
            if (A.closeDialog) {
                A.closeDialog(dlgRoutineActions);
            } else {
                dlgRoutineActions.close();
            }
        };
        routineEditMenu.addEventListener('click', () => {
            dlgRoutineActions.showModal();
        });
        dlgRoutineActions.addEventListener('click', (event) => {
            if (event.target !== dlgRoutineActions) {
                return;
            }
            closeRoutineActions();
        });
        routineShare?.addEventListener('click', () => {
            closeRoutineActions();
            void shareRoutine();
        });
        routineDuplicateAction?.addEventListener('click', () => {
            closeRoutineActions();
            void duplicateRoutine();
        });
        routineDeleteAction?.addEventListener('click', () => {
            closeRoutineActions();
            void deleteRoutine();
        });
    }

    async function deleteRoutine() {
        if (!state.routineId) {
            return;
        }
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Supprimer la routine',
                message: 'Supprimer cette routine de la liste des routines ?',
                variant: 'danger'
            })
            : confirm('Supprimer cette routine de la liste des routines ?');
        if (!confirmed) {
            return;
        }
        await db.del('routines', state.routineId);
        state.routine = null;
        const { dlgRoutineEditor } = assertRefs();
        if (A.closeDialog) {
            A.closeDialog(dlgRoutineEditor);
        } else {
            dlgRoutineEditor?.close();
        }
        if (typeof A.refreshRoutineList === 'function') {
            await A.refreshRoutineList();
        }
        if (typeof A.populateRoutineSelect === 'function') {
            await A.populateRoutineSelect();
        }
        void A.openRoutineList({ callerScreen: state.callerScreen });
    }

    async function duplicateRoutine() {
        if (!state.routine) {
            return;
        }
        const base = serializeRoutine(state.routine);
        const newRoutine = {
            id: uid('routine'),
            name: `${base.name || 'Routine'} (copie)`,
            icon: base.icon,
            instructions_routine_global: base.instructions_routine_global || '',
            moves: base.moves.map((move, index) => ({
                id: uid('move'),
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
        };
        await db.put('routines', newRoutine);
        state.routineId = newRoutine.id;
        state.routine = normalizeRoutine(newRoutine);
        const { dlgRoutineEditor } = assertRefs();
        if (A.closeDialog) {
            A.closeDialog(dlgRoutineEditor);
        } else {
            dlgRoutineEditor?.close();
        }
        if (typeof A.refreshRoutineList === 'function') {
            await A.refreshRoutineList();
        }
        if (typeof A.populateRoutineSelect === 'function') {
            await A.populateRoutineSelect();
        }
        renderRoutine();
    }

    async function shareRoutine() {
        if (!state.routine) {
            return;
        }
        const text = buildShareRoutineText(state.routine);
        if (!text) {
            return;
        }
        if (navigator.share) {
            await navigator.share({ text, title: 'Routine de musculation' });
            return;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Partager',
                    message: 'Texte copié dans le presse-papiers.',
                    variant: 'info'
                });
            } else {
                alert('Texte copié dans le presse-papiers.');
            }
            return;
        }
        window.prompt('Copiez ce texte pour le partager :', text);
    }

    async function loadRoutine(force = false) {
        if (!force && state.routine) {
            return state.routine;
        }
        const routine = await db.get('routines', state.routineId);
        state.routine = normalizeRoutine(routine || createEmptyRoutine(state.routineId));
        return state.routine;
    }

    function createEmptyRoutine(id) {
        return { id, name: 'Routine', icon: ICONS[0], instructions_routine_global: '', moves: [] };
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
            return createEmptyRoutine(state.routineId);
        }
        const normalized = {
            id: routine.id || state.routineId,
            name: routine.name || 'Routine',
            icon: routine.icon || ICONS[0],
            instructions_routine_global: pickTextValue(routine.instructions_routine_global, routine.details),
            moves: Array.isArray(routine.moves) ? [...routine.moves] : []
        };
        normalized.moves = normalized.moves.map((move, index) => ({
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
        }));
        normalized.moves.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        return normalized;
    }

    function wireInputs() {
        const {
            routineName,
            routineIcon,
            dlgRoutineEditor,
            routineEditorClose,
            routineEditorCancel
        } = assertRefs();
        routineName.addEventListener('input', () => {
            if (!state.routine) {
                return;
            }
            const nextName = routineName.value;
            state.routine.name = nextName.trim() ? nextName : 'Routine';
            scheduleSave();
        });
        routineIcon.addEventListener('change', () => {
            if (!state.routine) {
                return;
            }
            state.routine.icon = routineIcon.value || ICONS[0];
            scheduleSave();
            renderIconPreview();
        });
        routineEditorClose?.addEventListener('click', () => {
            if (state.pendingSave) {
                clearTimeout(state.pendingSave);
                state.pendingSave = null;
                void persistRoutine();
            }
            if (refs.routineEditTitle) {
                refs.routineEditTitle.textContent = state.routine?.name || 'Routine';
            }
            if (A.closeDialog) {
                A.closeDialog(dlgRoutineEditor);
            } else {
                dlgRoutineEditor?.close();
            }
            routineEditorSnapshot = null;
        });
        routineEditorCancel?.addEventListener('click', () => {
            if (!routineEditorSnapshot || !state.routine) {
                if (A.closeDialog) {
                    A.closeDialog(dlgRoutineEditor);
                } else {
                    dlgRoutineEditor?.close();
                }
                return;
            }
            if (state.pendingSave) {
                clearTimeout(state.pendingSave);
                state.pendingSave = null;
            }
            state.routine.name = routineEditorSnapshot.name || 'Routine';
            state.routine.icon = routineEditorSnapshot.icon || ICONS[0];
            routineName.value = routineEditorSnapshot.name;
            routineIcon.value = routineEditorSnapshot.icon;
            renderIconPreview();
            refreshValueStates();
            if (refs.routineEditTitle) {
                refs.routineEditTitle.textContent = state.routine?.name || 'Routine';
            }
            void persistRoutine();
            if (A.closeDialog) {
                A.closeDialog(dlgRoutineEditor);
            } else {
                dlgRoutineEditor?.close();
            }
            routineEditorSnapshot = null;
        });
    }

    function wireRoutineDetails() {
        const {
            btnRoutineDetails,
            dlgRoutineDetails,
            routineDetailsInput,
            routineDetailsClose,
            routineDetailsCancel
        } = ensureRefs();
        if (!btnRoutineDetails || !dlgRoutineDetails || !routineDetailsInput) {
            return;
        }
        const closeRoutineDetailsDialog = () => {
            if (A.closeDialog) {
                A.closeDialog(dlgRoutineDetails);
            } else {
                dlgRoutineDetails.close();
            }
        };
        btnRoutineDetails.addEventListener('click', () => {
            if (!state.routine) {
                return;
            }
            routineDetailsSnapshot = state.routine.instructions_routine_global || '';
            routineDetailsInput.value = routineDetailsSnapshot;
            dlgRoutineDetails.showModal();
        });
        routineDetailsInput.addEventListener('input', () => {
            if (!state.routine) {
                return;
            }
            state.routine.instructions_routine_global = routineDetailsInput.value;
            updateRoutineDetailsPreview(state.routine);
            scheduleSave();
        });
        routineDetailsClose?.addEventListener('click', () => {
            if (state.pendingSave) {
                clearTimeout(state.pendingSave);
                state.pendingSave = null;
                void persistRoutine();
            }
            closeRoutineDetailsDialog();
            routineDetailsSnapshot = null;
        });
        routineDetailsCancel?.addEventListener('click', () => {
            if (routineDetailsSnapshot == null || !state.routine) {
                closeRoutineDetailsDialog();
                return;
            }
            if (state.pendingSave) {
                clearTimeout(state.pendingSave);
                state.pendingSave = null;
            }
            state.routine.instructions_routine_global = routineDetailsSnapshot;
            routineDetailsInput.value = routineDetailsSnapshot;
            updateRoutineDetailsPreview(state.routine);
            void persistRoutine();
            closeRoutineDetailsDialog();
            routineDetailsSnapshot = null;
        });
    }

    function wireValueStates() {
        const { routineName, routineIcon } = assertRefs();
        A.watchValueState?.([routineName, routineIcon]);
    }

    function wireAddExercisesButton() {
        const { btnRoutineAddExercises } = assertRefs();
        btnRoutineAddExercises.addEventListener('click', () => {
            A.openExercises({
                mode: 'add',
                callerScreen: 'screenRoutineEdit',
                fromSettings: isSettingsScreen(state.callerScreen),
                onAdd: (ids) => {
                    void addExercises(ids);
                }
            });
        });
    }

    async function addExercises(ids) {
        if (!state.routine || !Array.isArray(ids) || !ids.length) {
            return;
        }
        const existingIds = new Set(state.routine.moves.map((move) => move.exerciseId));
        let firstAddedMoveId = null;
        for (const id of ids) {
            if (existingIds.has(id)) {
                continue;
            }
            const exercise = await db.get('exercises', id);
            if (!exercise) {
                continue;
            }
            const move = {
                id: uid('move'),
                pos: state.routine.moves.length + 1,
                exerciseId: exercise.id,
                exerciseName: exercise.name || 'Exercice',
                instructions_routine_exercice: '',
                sets: []
            };
            state.routine.moves.push(move);
            if (!firstAddedMoveId) {
                firstAddedMoveId = move.id;
            }
            existingIds.add(exercise.id);
        }
        await persistRoutine();
        if (firstAddedMoveId) {
            routineScrollState.targetMoveId = firstAddedMoveId;
            routineScrollState.pendingRestore = true;
        }
        renderRoutineList();
    }

    function renderRoutine() {
        if (!state.routine) {
            return;
        }
        populateIconSelect();
        renderIconPreview();
        const { routineName, routineIcon, routineEditTitle, routineDetailsInput } = assertRefs();
        routineName.value = state.routine.name || '';
        routineIcon.value = state.routine.icon || ICONS[0];
        if (routineDetailsInput) {
            routineDetailsInput.value = state.routine.instructions_routine_global || '';
        }
        if (routineEditTitle) {
            routineEditTitle.textContent = state.routine.name || 'Routine';
        }
        updateRoutineDetailsPreview(state.routine);
        refreshValueStates();
        renderRoutineList();
    }

    function updateRoutineDetailsPreview(routine) {
        const { routineDetailsPreview } = ensureRefs();
        if (!routineDetailsPreview) {
            return;
        }
        const instructions = routine?.instructions_routine_global || '';
        routineDetailsPreview.textContent = instructions;
        routineDetailsPreview.dataset.empty = instructions.trim() ? 'false' : 'true';
    }

    function renderIconPreview() {
        const { routineIcon } = assertRefs();
        Array.from(routineIcon.options).forEach((option) => {
            option.selected = option.value === routineIcon.value;
        });
    }

    function populateIconSelect() {
        const { routineIcon } = assertRefs();
        if (routineIcon.dataset.populated === '1') {
            return;
        }
        routineIcon.innerHTML = '';
        ICONS.forEach((icon) => {
            const option = document.createElement('option');
            option.value = icon;
            option.textContent = icon;
            routineIcon.appendChild(option);
        });
        routineIcon.dataset.populated = '1';
    }

    function renderRoutineList() {
        const { routineList } = assertRefs();
        clearDetailsPopover();
        routineList.innerHTML = '';
        if (!state.routine?.moves?.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucun exercice dans la routine.';
            routineList.appendChild(empty);
            restoreRoutineScroll();
            return;
        }
        const ordered = [...state.routine.moves].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        ordered.forEach((move) => {
            routineList.appendChild(renderMoveCard(move));
        });
        restoreRoutineScroll();
    }

    function renderMoveCard(move) {
        const structure = listCard.createStructure({
            endClass: 'exercise-card-end--top',
            cardClass: 'exercise-card--full-sets'
        });
        const { card, start, body, end } = structure;
        card.dataset.moveId = move.id;
        start.classList.add('list-card__start--solo');

        const name = document.createElement('div');
        name.className = 'element exercise-card-name';
        name.textContent = move.exerciseName || 'Exercice';
        name.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!move.exerciseId) {
                return;
            }
            setRoutineScrollTarget(move.id);
            void A.openExerciseRead({ currentId: move.exerciseId, callerScreen: 'screenRoutineEdit' });
        });
        const titleRow = document.createElement('div');
        titleRow.className = 'exercise-card-title-row';
        titleRow.appendChild(name);
        const detailsButton = document.createElement('button');
        detailsButton.type = 'button';
        detailsButton.className = 'exercise-card-menu-button';
        detailsButton.textContent = 'ⓘ';
        detailsButton.setAttribute('aria-label', "Afficher les instructions de l'exercice");
        detailsButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const instructions = typeof move.instructions_routine_exercice === 'string'
                ? move.instructions_routine_exercice.trim()
                : '';
            showDetailsPopover(detailsButton, instructions);
        });
        end.appendChild(detailsButton);
        const setsWrapper = document.createElement('div');
        setsWrapper.className = 'session-card-sets';
        renderRoutineCardSets(move, setsWrapper);
        body.append(titleRow, setsWrapper);

        card.setAttribute('aria-label', move.exerciseName || 'Exercice');
        attachRoutineCardPressHandlers(card);
        return card;
    }

    function renderRoutineCardSets(move, setsWrapper) {
        if (!move || !setsWrapper) {
            return;
        }
        setsWrapper.innerHTML = '';
        const sets = Array.isArray(move.sets)
            ? [...move.sets].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
            : [];
        if (sets.length) {
            sets.forEach((set, index) => {
                const line = document.createElement('div');
                line.className = 'session-card-sets-row';
                const pos = set?.pos ?? index + 1;
                const openWithFocus = (field) => {
                    setRoutineScrollTarget(move.id);
                    void A.openRoutineMoveEdit({
                        routineId: state.routineId,
                        moveId: move.id,
                        callerScreen: 'screenRoutineEdit',
                        focusSetIndex: index,
                        focusField: normalizeFocusField(field)
                    });
                };
                const stopAndOpen = (field) => (event) => {
                    event.stopPropagation();
                    openWithFocus(field);
                };
                line.append(
                    createSetCell({
                        label: formatSetIndex(pos),
                        field: 'order',
                        className: 'session-card-set-cell--index',
                        onClick: stopAndOpen('reps')
                    }),
                    createSetCell({
                        label: formatSetReps(set?.reps),
                        field: 'reps',
                        className: 'session-card-set-cell--reps',
                        onClick: stopAndOpen('reps')
                    }),
                    createSetCell({
                        label: formatSetWeight(set?.weight),
                        field: 'weight',
                        className: 'session-card-set-cell--weight',
                        onClick: stopAndOpen('weight')
                    }),
                    createSetCell({
                        label: formatSetRpe(set?.rpe),
                        field: 'rpe',
                        rpeValue: set?.rpe,
                        onClick: stopAndOpen('rpe')
                    }),
                    createEmptySetCell({ className: 'session-card-set-cell--goal' }),
                    createEmptySetCell({ className: 'session-card-set-cell--medal' })
                );
                setsWrapper.appendChild(line);
            });
        }
        const addSetButton = document.createElement('button');
        addSetButton.type = 'button';
        addSetButton.className = 'btn full session-card-add-set';
        const addSetPlus = document.createElement('span');
        addSetPlus.className = 'text-emphase';
        addSetPlus.textContent = '+';
        addSetButton.append(addSetPlus, document.createTextNode(' Ajouter série'));
        addSetButton.addEventListener('click', (event) => {
            event.stopPropagation();
            void addSetToMove(move.id);
        });
        setsWrapper.appendChild(addSetButton);
    }

    function updateRoutineMoveCard(move) {
        const { routineList, screenRoutineEdit } = ensureRefs();
        if (!move?.id || !routineList || screenRoutineEdit?.hidden) {
            return false;
        }
        const card = routineList.querySelector(`[data-move-id="${CSS.escape(move.id)}"]`);
        if (!card) {
            return false;
        }
        const setsWrapper = card.querySelector('.session-card-sets');
        if (!setsWrapper) {
            return false;
        }
        renderRoutineCardSets(move, setsWrapper);
        return true;
    }

    async function addSetToMove(moveId) {
        if (!moveId || !state.routine?.moves?.length) {
            return;
        }
        const move = state.routine.moves.find((item) => item.id === moveId);
        if (!move) {
            return;
        }
        const sets = Array.isArray(move.sets) ? move.sets : [];
        const previous = sets.length ? sets[sets.length - 1] : null;
        const restForNewSet = getRestForNewSet(previous?.rest);
        const preferredValues = previous ? sanitizeSetValues(previous) : null;
        const newSet = {
            pos: sets.length + 1,
            reps: preferredValues?.reps ?? 8,
            weight: preferredValues?.weight ?? null,
            rpe: preferredValues?.rpe ?? null,
            rest: restForNewSet
        };
        move.sets = [...sets, newSet];
        move.sets.forEach((set, idx) => {
            set.pos = idx + 1;
        });
        scheduleSave();
        if (!updateRoutineMoveCard(move)) {
            renderRoutineList();
        }
    }

    function sanitizeSetValues(source) {
        return {
            reps: safePositiveInt(source?.reps),
            weight: sanitizeWeight(source?.weight),
            rpe: source?.rpe != null && source?.rpe !== '' ? clampRpe(source?.rpe) : null
        };
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

    function makeRoutineCardInteractive(card, handle) {
        handle.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        handle.addEventListener('pointerdown', (event) => startDrag(event, card, handle));
    }

    function startDrag(event, card, handle) {
        if (dragCtx.active) {
            return;
        }
        if (event.button !== 0 && event.pointerType !== 'touch') {
            return;
        }
        event.preventDefault();
        event.stopPropagation();

        const { routineList } = assertRefs();
        dragCtx.active = true;
        dragCtx.card = card;
        dragCtx.handle = handle;
        dragCtx.pointerId = event.pointerId;
        dragCtx.initialOrder = getRoutineOrder(routineList);

        const rect = card.getBoundingClientRect();
        dragCtx.offsetY = event.clientY - rect.top;
        const placeholder = document.createElement('div');
        placeholder.className = 'session-card-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        dragCtx.placeholder = placeholder;

        routineList.insertBefore(placeholder, card);
        routineList.appendChild(card);

        card.classList.add('session-card-dragging');
        card.style.width = `${rect.width}px`;
        card.style.height = `${rect.height}px`;
        card.style.position = 'fixed';
        card.style.left = `${rect.left}px`;
        card.style.top = `${rect.top}px`;
        card.style.zIndex = '1000';
        card.style.pointerEvents = 'none';

        if (handle.setPointerCapture) {
            handle.setPointerCapture(event.pointerId);
        }
        handle.addEventListener('pointermove', onDragMove);
        handle.addEventListener('pointerup', onDragEnd);
        handle.addEventListener('pointercancel', onDragCancel);
    }

    function onDragMove(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        event.preventDefault();

        dragCtx.card.style.top = `${event.clientY - dragCtx.offsetY}px`;

        const { routineList } = assertRefs();
        const siblings = Array.from(routineList.children)
            .filter((node) => node !== dragCtx.card && node !== dragCtx.placeholder);

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (event.clientY < midpoint) {
                routineList.insertBefore(dragCtx.placeholder, sibling);
                break;
            }
            const last = siblings[siblings.length - 1];
            if (sibling === last) {
                routineList.appendChild(dragCtx.placeholder);
            }
        }
    }

    function onDragEnd(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        finalizeDrag();
    }

    function onDragCancel(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        finalizeDrag(true);
    }

    async function finalizeDrag(cancelled = false) {
        const { routineList } = assertRefs();
        if (dragCtx.handle?.releasePointerCapture) {
            try {
                dragCtx.handle.releasePointerCapture(dragCtx.pointerId);
            } catch (error) {
                console.warn('releasePointerCapture ignoré:', error);
            }
        }
        dragCtx.handle?.removeEventListener('pointermove', onDragMove);
        dragCtx.handle?.removeEventListener('pointerup', onDragEnd);
        dragCtx.handle?.removeEventListener('pointercancel', onDragCancel);

        if (dragCtx.placeholder && dragCtx.placeholder.parentNode === routineList) {
            routineList.insertBefore(dragCtx.card, dragCtx.placeholder);
            routineList.removeChild(dragCtx.placeholder);
        }
        dragCtx.card.classList.remove('session-card-dragging');
        Object.assign(dragCtx.card.style, { position: '', left: '', top: '', width: '', height: '', zIndex: '', pointerEvents: '' });

        if (!cancelled) {
            const order = getRoutineOrder(routineList);
            if (!arraysEqual(order, dragCtx.initialOrder)) {
                applyRoutineOrder(order);
                await persistRoutine();
                renderRoutineList();
            }
        }

        dragCtx.active = false;
        dragCtx.card = null;
        dragCtx.handle = null;
        dragCtx.placeholder = null;
        dragCtx.pointerId = null;
        dragCtx.offsetY = 0;
        dragCtx.initialOrder = [];
    }

    function getRoutineOrder(container) {
        return Array.from(container.children)
            .filter((node) => node instanceof HTMLElement && node.dataset.moveId)
            .map((node, index) => ({ moveId: node.dataset.moveId, pos: index + 1 }));
    }

    function applyRoutineOrder(order) {
        if (!state.routine?.moves?.length) {
            return;
        }
        const positionMap = new Map(order.map((entry) => [entry.moveId, entry.pos]));
        state.routine.moves.forEach((move) => {
            if (positionMap.has(move.id)) {
                move.pos = positionMap.get(move.id);
            }
        });
        state.routine.moves.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    }

    async function persistRoutine() {
        if (!state.routine) {
            return;
        }
        await db.put('routines', serializeRoutine(state.routine));
        void A.refreshRoutineEdit();
        if (typeof A.refreshRoutineList === 'function') {
            void A.refreshRoutineList();
        }
        if (typeof A.populateRoutineSelect === 'function') {
            void A.populateRoutineSelect();
        }
    }

    function scheduleSave() {
        if (state.pendingSave) {
            clearTimeout(state.pendingSave);
        }
        state.pendingSave = setTimeout(() => {
            state.pendingSave = null;
            void persistRoutine();
        }, 300);
    }

    function serializeRoutine(routine) {
        return {
            id: routine.id,
            name: routine.name,
            icon: routine.icon,
            instructions_routine_global: routine.instructions_routine_global || '',
            moves: routine.moves.map((move, index) => ({
                id: move.id,
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
        };
    }

    function arraysEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((entry, index) => {
            const other = b[index];
            return entry.moveId === other.moveId && entry.pos === other.pos;
        });
    }

    function getRpeDatasetValue(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        const bounded = Math.min(10, Math.max(5, numeric));
        const rounded = Math.round(bounded * 2) / 2;
        return String(rounded).replace(/\.0$/, '');
    }

    function formatSynopsisReps(value) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? String(numeric) : '—';
    }

    function formatSynopsisWeight(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return '—kg';
        }
        return `${formatSynopsisNumber(numeric)}kg`;
    }

    function formatSynopsisNumber(value) {
        if (Number.isInteger(value)) {
            return String(value);
        }
        return value
            .toFixed(2)
            .replace(/\.0+$/, '')
            .replace(/(\.\d*?)0+$/, '$1');
    }

    function formatSynopsisRpe(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return '—';
        }
        return String(numeric).replace(/\.0$/, '');
    }

    function formatShareNumber(value, options = {}) {
        if (value == null || value === '') {
            return '';
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return String(value).trim();
        }
        return numeric.toLocaleString('fr-FR', {
            maximumFractionDigits: options.maximumFractionDigits ?? 2
        });
    }

    function formatShareInteger(value) {
        if (value == null || value === '') {
            return '';
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return String(value).trim();
        }
        return String(Math.round(numeric));
    }

    function formatShareRoutineSetLine(set, index) {
        const weightValue = formatShareNumber(set?.weight, { maximumFractionDigits: 2 });
        const repsValue = formatShareInteger(set?.reps);
        const rpeValue = formatShareNumber(set?.rpe, { maximumFractionDigits: 1 });
        let label = '';
        if (weightValue && repsValue) {
            label = `${weightValue} kg x ${repsValue} reps`;
        } else if (weightValue) {
            label = `${weightValue} kg`;
        } else if (repsValue) {
            label = `${repsValue} reps`;
        } else if (rpeValue) {
            label = 'Série';
        }
        if (!label) {
            return null;
        }
        if (rpeValue) {
            label = `${label} @ rpe ${rpeValue}`;
        }
        return `${index}. ${label}`;
    }

    function buildShareRoutineText(routine) {
        if (!routine) {
            return '';
        }
        const name = routine?.name || 'Routine';
        const lines = ['Routine de musculation:', '', `> ROUTINE ${name.toUpperCase()}`, ''];
        const moves = Array.isArray(routine?.moves) ? [...routine.moves] : [];
        moves.sort((a, b) => (a?.pos ?? 0) - (b?.pos ?? 0));
        if (!moves.length) {
            lines.push('Aucun exercice.');
        } else {
            moves.forEach((move) => {
                lines.push(move?.exerciseName || 'Exercice');
                const sets = Array.isArray(move?.sets) ? [...move.sets] : [];
                sets.sort((a, b) => (a?.pos ?? 0) - (b?.pos ?? 0));
                const setLines = sets
                    .map((set, idx) => formatShareRoutineSetLine(set, idx + 1))
                    .filter(Boolean);
                if (setLines.length) {
                    lines.push(...setLines);
                } else {
                    lines.push('Aucune série.');
                }
                lines.push('');
            });
        }
        while (lines.length && lines[lines.length - 1] === '') {
            lines.pop();
        }
        return lines.join('\n');
    }

    function formatSetIndex(value) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? `#${numeric}` : '#—';
    }

    function formatSetReps(value) {
        return `${formatSynopsisReps(value)}x`;
    }

    function formatSetWeight(value) {
        return formatSynopsisWeight(value);
    }

    function formatSetRpe(value) {
        return `@${formatSynopsisRpe(value)}`;
    }

    function normalizeFocusField(field) {
        if (field === 'weight' || field === 'rpe' || field === 'reps') {
            return field;
        }
        return 'reps';
    }

    function createSetCell({ label, field, onClick, className, rpeValue }) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `session-card-set-cell${className ? ` ${className}` : ''}`;
        cell.textContent = label;
        if (field) {
            cell.dataset.field = field;
        }
        const rpeDatasetValue = getRpeDatasetValue(rpeValue);
        if (rpeDatasetValue) {
            cell.dataset.rpe = rpeDatasetValue;
        }
        if (onClick) {
            cell.addEventListener('click', onClick);
        }
        return cell;
    }

    function createEmptySetCell({ className } = {}) {
        const cell = document.createElement('div');
        cell.className = `session-card-set-cell${className ? ` ${className}` : ''}`;
        return cell;
    }

    function safeInt(value, fallback = null) {
        const number = Number.parseInt(value, 10);
        return Number.isFinite(number) ? number : fallback;
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

    function safeFloatOrNull(value) {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) ? number : null;
    }

    function safeIntOrNull(value) {
        const number = Number.parseInt(value, 10);
        return Number.isFinite(number) ? number : null;
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

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    }

    function refreshValueStates() {
        A.updateValueState?.(refs.routineName);
        A.updateValueState?.(refs.routineIcon);
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
            screenRoutineList,
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
            screenRoutineList,
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
        state.active = target === 'screenRoutineEdit';
    }
})();
