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

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireInputs();
        wireAddExercisesButton();
        wireHeaderButtons();
        wireDuplication();
        wireDeletion();
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
        refs.routineDetails = document.getElementById('routineDetails');
        refs.dlgRoutineEditor = document.getElementById('dlgRoutineEditor');
        refs.routineEditorClose = document.getElementById('routineEditorClose');
        refs.routineEditorCancel = document.getElementById('routineEditorCancel');
        refs.routineDuplicate = document.getElementById('routineDuplicate');
        refs.routineDelete = document.getElementById('routineDelete');
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
            'routineDetails',
            'routineList',
            'routineEditTitle',
            'btnRoutineAddExercises',
            'routineEditBack',
            'routineEditEdit',
            'dlgRoutineEditor',
            'routineEditorClose',
            'routineEditorCancel',
            'routineDuplicate',
            'routineDelete'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routine-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireHeaderButtons() {
        const { routineEditBack, routineEditEdit, dlgRoutineEditor, routineName, routineIcon, routineDetails } = assertRefs();
        routineEditBack.addEventListener('click', () => {
            void A.openRoutineList({ callerScreen: state.callerScreen });
        });
        routineEditEdit.addEventListener('click', () => {
            if (state.routine) {
                routineEditorSnapshot = {
                    name: state.routine.name || '',
                    icon: state.routine.icon || ICONS[0],
                    details: state.routine.details || ''
                };
                routineName.value = routineEditorSnapshot.name;
                routineIcon.value = routineEditorSnapshot.icon;
                routineDetails.value = routineEditorSnapshot.details;
                renderIconPreview();
                refreshValueStates();
            }
            dlgRoutineEditor?.showModal();
        });
    }

    function wireDeletion() {
        const { routineDelete } = assertRefs();
        routineDelete.addEventListener('click', () => {
            void deleteRoutine();
        });
    }

    function wireDuplication() {
        const { routineDuplicate } = assertRefs();
        routineDuplicate.addEventListener('click', () => {
            void duplicateRoutine();
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
            details: base.details || '',
            moves: base.moves.map((move, index) => ({
                id: uid('move'),
                pos: safeInt(move.pos, index + 1),
                exerciseId: move.exerciseId,
                exerciseName: move.exerciseName,
                instructions: typeof move.instructions === 'string' ? move.instructions : '',
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

    async function loadRoutine(force = false) {
        if (!force && state.routine) {
            return state.routine;
        }
        const routine = await db.get('routines', state.routineId);
        state.routine = normalizeRoutine(routine || createEmptyRoutine(state.routineId));
        return state.routine;
    }

    function createEmptyRoutine(id) {
        return { id, name: 'Routine', icon: ICONS[0], details: '', moves: [] };
    }

    function normalizeRoutine(routine) {
        if (!routine) {
            return createEmptyRoutine(state.routineId);
        }
        const normalized = {
            id: routine.id || state.routineId,
            name: routine.name || 'Routine',
            icon: routine.icon || ICONS[0],
            details: routine.details || '',
            moves: Array.isArray(routine.moves) ? [...routine.moves] : []
        };
        normalized.moves = normalized.moves.map((move, index) => ({
            id: move.id || uid('move'),
            pos: safeInt(move.pos, index + 1),
            exerciseId: move.exerciseId,
            exerciseName: move.exerciseName || 'Exercice',
            instructions: typeof move.instructions === 'string' ? move.instructions : '',
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
            routineDetails,
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
        routineDetails.addEventListener('input', () => {
            if (!state.routine) {
                return;
            }
            state.routine.details = routineDetails.value;
            scheduleSave();
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
            state.routine.details = routineEditorSnapshot.details || '';
            routineName.value = routineEditorSnapshot.name;
            routineIcon.value = routineEditorSnapshot.icon;
            routineDetails.value = routineEditorSnapshot.details;
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

    function wireValueStates() {
        const { routineName, routineIcon, routineDetails } = assertRefs();
        A.watchValueState?.([routineName, routineIcon, routineDetails]);
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
        for (const id of ids) {
            if (existingIds.has(id)) {
                continue;
            }
            const exercise = await db.get('exercises', id);
            if (!exercise) {
                continue;
            }
            state.routine.moves.push({
                id: uid('move'),
                pos: state.routine.moves.length + 1,
                exerciseId: exercise.id,
                exerciseName: exercise.name || 'Exercice',
                instructions: '',
                sets: []
            });
            existingIds.add(exercise.id);
        }
        await persistRoutine();
        renderRoutineList();
    }

    function renderRoutine() {
        if (!state.routine) {
            return;
        }
        populateIconSelect();
        renderIconPreview();
        const { routineName, routineIcon, routineDetails, routineEditTitle } = assertRefs();
        routineName.value = state.routine.name || '';
        routineIcon.value = state.routine.icon || ICONS[0];
        routineDetails.value = state.routine.details || '';
        if (routineEditTitle) {
            routineEditTitle.textContent = state.routine.name || 'Routine';
        }
        refreshValueStates();
        renderRoutineList();
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
        routineList.innerHTML = '';
        if (!state.routine?.moves?.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucun exercice dans la routine.';
            routineList.appendChild(empty);
            return;
        }
        const ordered = [...state.routine.moves].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        ordered.forEach((move) => {
            routineList.appendChild(renderMoveCard(move));
        });
    }

    function renderMoveCard(move) {
        const structure = listCard.createStructure({
            endClass: 'exercise-card-end--top',
            cardClass: 'exercise-card--full-sets'
        });
        const { card, start, body, end } = structure;
        card.dataset.moveId = move.id;

        const handle = listCard.createHandle({
            interactive: true,
            ariaLabel: "Réordonner l'exercice"
        });
        start.insertBefore(handle, body);

        const name = document.createElement('div');
        name.className = 'element exercise-card-name';
        name.textContent = move.exerciseName || 'Exercice';
        name.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!move.exerciseId) {
                return;
            }
            void A.openExerciseRead({ currentId: move.exerciseId, callerScreen: 'screenRoutineEdit' });
        });
        const titleRow = document.createElement('div');
        titleRow.className = 'exercise-card-title-row';
        titleRow.appendChild(name);
        const setsWrapper = document.createElement('div');
        setsWrapper.className = 'session-card-sets';
        const sets = Array.isArray(move.sets)
            ? [...move.sets].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
            : [];
        if (sets.length) {
            sets.forEach((set, index) => {
                const line = document.createElement('div');
                line.className = 'session-card-sets-row';
                const pos = set?.pos ?? index + 1;
                const openWithFocus = (field) => {
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
        body.append(titleRow, setsWrapper);

        end.appendChild(createExerciseMenuButton(move));

        card.setAttribute('aria-label', move.exerciseName || 'Exercice');
        makeRoutineCardInteractive(card, handle);
        return card;
    }

    function createExerciseMenuButton(move) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'exercise-card-menu-button';
        button.textContent = '...';
        const labelName = move.exerciseName || 'Exercice';
        button.setAttribute('aria-label', `Éditer l'exercice ${labelName}`);
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            void A.openRoutineMoveMeta?.({
                routineId: state.routineId,
                moveId: move.id,
                callerScreen: 'screenRoutineEdit'
            });
        });
        return button;
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
        const preferredValues = await resolveNewSetValuesForRoutine(move.exerciseId, sets, previous);
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
        renderRoutineList();
    }

    async function resolveNewSetValuesForRoutine(exerciseId, sets, previous) {
        const source = A.preferences?.getNewSetValueSource?.() ?? 'last_set';
        if (source === 'last_session') {
            const fromLastSession = await findLastSessionSet(exerciseId, sets.length + 1);
            if (fromLastSession) {
                return sanitizeSetValues(fromLastSession);
            }
            if (previous) {
                return sanitizeSetValues(previous);
            }
            const lastFromHistory = await findLastSessionLastSet(exerciseId);
            if (lastFromHistory) {
                return sanitizeSetValues(lastFromHistory);
            }
            return null;
        }
        if (previous) {
            return sanitizeSetValues(previous);
        }
        const lastFromHistory = await findLastSessionLastSet(exerciseId);
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

    async function findLastSessionSet(exerciseId, position) {
        const exercise = await findLastSessionExercise(exerciseId);
        if (!exercise) {
            return null;
        }
        return findSetByPosition(exercise.sets, position);
    }

    async function findLastSessionLastSet(exerciseId) {
        const exercise = await findLastSessionExercise(exerciseId);
        if (!exercise) {
            return null;
        }
        return findLastSet(exercise.sets);
    }

    async function findLastSessionExercise(exerciseId) {
        if (!exerciseId) {
            return null;
        }
        const sessions = await db.listSessionDates();
        const orderedDates = sessions
            .map((entry) => entry.date)
            .filter(Boolean)
            .sort((a, b) => b.localeCompare(a));
        for (const date of orderedDates) {
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
            details: routine.details || '',
            moves: routine.moves.map((move, index) => ({
                id: move.id,
                pos: safeInt(move.pos, index + 1),
                exerciseId: move.exerciseId,
                exerciseName: move.exerciseName,
                instructions: typeof move.instructions === 'string' ? move.instructions : '',
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
        A.updateValueState?.(refs.routineDetails);
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
