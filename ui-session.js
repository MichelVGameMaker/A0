// ui-session.js — liste de la séance du jour + ajouts (2 lignes)
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-session: composant listCard manquant.');
    }

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const sessionEditorState = {
        session: null
    };
    const sessionCommentState = {
        session: null,
        saveTimer: null,
        initialComments: ''
    };
    let medalPopover = null;
    let medalPopoverCleanup = null;
    let detailsPopover = null;
    let detailsPopoverCleanup = null;
    const sessionScrollState = {
        top: 0,
        pendingRestore: false,
        targetExerciseId: null
    };
    let activeContextCard = null;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        wireAddExercisesButton();
        wireAddRoutinesButton();
        wireSessionNavigation();
        wireSessionEditor();
        wireSessionComments();
        wireSessionContextDialog();
        wireSessionScrollRestore();
    });

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

    function getMedalIconMap() {
        if (typeof A.getSessionMedalIconMap === 'function') {
            return A.getSessionMedalIconMap() || {};
        }
        return {
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

    function showDetailsPopover(target, instructionsText, commentsText) {
        if (!target) {
            return;
        }
        clearDetailsPopover();
        const popover = document.createElement('div');
        popover.className = 'exec-medal-popover exec-details-popover';
        const text = document.createElement('div');
        text.className = 'exec-details-popover__text';
        const instructions = typeof instructionsText === 'string' ? instructionsText.trim() : '';
        const comments = typeof commentsText === 'string' ? commentsText.trim() : '';
        if (!instructions && !comments) {
            text.textContent = 'Aucune instructions / commentaires';
        } else {
            if (instructions) {
                const instructionsNode = document.createElement('div');
                instructionsNode.textContent = `Instructions : ${instructions}`;
                text.appendChild(instructionsNode);
            }
            if (comments) {
                const commentsNode = document.createElement('div');
                commentsNode.textContent = `Commentaires : ${comments}`;
                text.appendChild(commentsNode);
            }
        }
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

    function formatMedalInfo(medals = []) {
        const iconMap = getMedalIconMap();
        const labels = (Array.isArray(medals) ? medals : []).map((key) => iconMap[key]?.label).filter(Boolean);
        if (!labels.length) {
            return '';
        }
        const prefix = labels.length > 1 ? 'Médailles : ' : 'Médaille : ';
        return `${prefix}${labels.join(' • ')}`;
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

    function createSetMetaCell({ text, rpeValue }) {
        const cell = document.createElement('div');
        cell.className = 'session-card-set-cell';
        cell.textContent = text;
        const rpeDatasetValue = getRpeDatasetValue(rpeValue);
        if (rpeDatasetValue) {
            cell.dataset.rpe = rpeDatasetValue;
        }
        return cell;
    }

    function createSetMedalsCell(medals = []) {
        const cell = document.createElement('div');
        cell.className = 'session-card-set-cell';
        if (!Array.isArray(medals) || medals.length === 0) {
            return cell;
        }
        const iconMap = getMedalIconMap();
        const medalKey = medals.find((key) => iconMap[key]);
        if (!medalKey) {
            return cell;
        }
        const medalConfig = iconMap[medalKey];
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
            showMedalPopover(badge, medalConfig.label);
        });
        cell.appendChild(badge);
        cell.addEventListener('click', () => {
            const medalInfo = formatMedalInfo(medals);
            if (medalInfo) {
                showMedalPopover(cell, medalInfo);
            }
        });
        return cell;
    }

    function attachSessionCardPressHandlers(card) {
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
            const exerciseId = card.dataset.exerciseId;
            if (!exerciseId) {
                return;
            }
            setSessionScrollTarget(exerciseId);
            void A.openExecEdit?.({
                currentId: exerciseId,
                callerScreen: 'screenSessions'
            });
        };
        const fireLongPress = () => {
            const exerciseId = card.dataset.exerciseId;
            if (!exerciseId) {
                return;
            }
            setSessionScrollTarget(exerciseId);
            setActiveContextCard(card);
            void A.openExecMoveMeta?.({
                currentId: exerciseId,
                callerScreen: 'screenSessions'
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

    function setSessionScrollTarget(exerciseId) {
        if (!exerciseId) {
            return;
        }
        sessionScrollState.targetExerciseId = exerciseId;
        storeSessionScroll();
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

    function wireSessionContextDialog() {
        const { dlgExecMoveEditor } = ensureRefs();
        if (!dlgExecMoveEditor) {
            return;
        }
        dlgExecMoveEditor.addEventListener('close', () => {
            clearActiveContextCard();
        });
    }

    /* ACTIONS */
    /**
     * Retourne l'identifiant de la routine planifiée pour une date.
     * @param {Date} date Date ciblée.
     * @returns {Promise<string|null>} Identifiant ou `null`.
     */
    A.getPlannedRoutineIds = async function getPlannedRoutineIds(date) {
        const plan = await db.getActivePlan();
        if (!plan) {
            return [];
        }
        if (!plan.startDate) {
            plan.startDate = A.ymd(A.today());
            await db.put('plans', plan);
        }
        const dayIndex = A.getPlanDayIndex?.(date, plan);
        if (!dayIndex) {
            return [];
        }
        const planned = plan.days?.[String(dayIndex)] || null;
        if (Array.isArray(planned)) {
            return planned.filter(Boolean);
        }
        return planned ? [planned] : [];
    };

    /**
     * Retourne l'identifiant de la routine planifiée pour une date.
     * @param {Date} date Date ciblée.
     * @returns {Promise<string|null>} Identifiant ou `null`.
     */
    A.getPlannedRoutineId = async function getPlannedRoutineId(date) {
        const planned = await A.getPlannedRoutineIds(date);
        return planned[0] || null;
    };

    /**
     * Met à jour le sélecteur de routine en mettant la routine planifiée en premier.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.populateRoutineSelect = async function populateRoutineSelect() {
        ensureRefs();
        if (!refs.selectRoutine) {
            return;
        }
        const all = await db.getAll('routines');
        const plannedId = await A.getPlannedRoutineId(A.activeDate);

        refs.selectRoutine.innerHTML = '<option value="">Ajouter une routine…</option>';

        const ordered = [];
        if (plannedId) {
            const planned = all.find((routine) => routine.id === plannedId);
            if (planned) {
                ordered.push(planned);
            }
        }
        for (const routine of all) {
            if (!ordered.some((item) => item.id === routine.id)) {
                ordered.push(routine);
            }
        }

        ordered.forEach((routine) => {
            const option = document.createElement('option');
            option.value = routine.id;
            option.textContent = routine.name;
            refs.selectRoutine.appendChild(option);
        });

        refs.selectRoutine.value = plannedId || '';
    };

    /**
     * Rend la séance du jour.
     * @returns {Promise<void>} Promesse résolue après affichage.
     */
    A.renderSession = async function renderSession() {
        const { todayLabel, sessionList } = assertRefs();
        todayLabel.textContent = A.fmtUI(A.activeDate);
        A.updateSessionTabDisplay?.();
        await updateSessionNavigation();
        clearDetailsPopover();

        const key = A.ymd(A.activeDate);
        const session = await db.getSession(key);
        updateSessionEditButtons(session);
        updateSessionCommentsPreview(session);
        sessionList.innerHTML = '';
        if (!(session?.exercises?.length)) {
            sessionList.innerHTML = '<div class="empty">Aucun exercice pour cette date.</div>';
            restoreSessionScroll();
            return;
        }

        for (const exercise of session.exercises) {
            const structure = listCard.createStructure({
                endClass: 'exercise-card-end--top',
                cardClass: 'exercise-card--full-sets'
            });
            const { card, start, body, end } = structure;
            const exerciseInstanceId = exercise.id || exercise.exercise_id;
            card.dataset.exerciseId = exerciseInstanceId;
            start.classList.add('list-card__start--solo');

            const exerciseName = exercise.exercise_name || 'Exercice';

            const name = document.createElement('div');
            name.className = 'element exercise-card-name';
            name.textContent = exerciseName;
            name.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!exercise.exercise_id) {
                    return;
                }
                setSessionScrollTarget(exerciseInstanceId);
                void A.openExerciseRead({ currentId: exercise.exercise_id, callerScreen: 'screenSessions' });
            });
            const titleRow = document.createElement('div');
            titleRow.className = 'exercise-card-title-row';
            titleRow.appendChild(name);
            const detailsButton = document.createElement('button');
            detailsButton.type = 'button';
            detailsButton.className = 'exercise-card-menu-button';
            detailsButton.textContent = 'ⓘ';
            detailsButton.setAttribute('aria-label', "Afficher les instructions et commentaires de l'exercice");
            detailsButton.addEventListener('click', (event) => {
                event.stopPropagation();
                const instructions = typeof exercise.instructions_routine_exercice === 'string'
                    ? exercise.instructions_routine_exercice.trim()
                    : '';
                const comments = typeof exercise.comments_session_exercice === 'string'
                    ? exercise.comments_session_exercice.trim()
                    : '';
                showDetailsPopover(detailsButton, instructions, comments);
            });
            end.appendChild(detailsButton);
            const setsWrapper = document.createElement('div');
            setsWrapper.className = 'session-card-sets';
            await renderSessionCardSets({ exercise, setsWrapper, dateKey: key });
            body.append(titleRow, setsWrapper);

            card.setAttribute('aria-label', exerciseName);
            attachSessionCardPressHandlers(card);

            sessionList.appendChild(card);
        }
        restoreSessionScroll();
    };

    async function renderSessionCardSets({ exercise, setsWrapper, dateKey }) {
        if (!exercise || !setsWrapper) {
            return;
        }
        const exerciseInstanceId = exercise.id || exercise.exercise_id;
        setsWrapper.innerHTML = '';
        const sets = Array.isArray(exercise.sets) ? [...exercise.sets] : [];
        sets.sort((a, b) => (a?.pos ?? 0) - (b?.pos ?? 0));
        const meta =
            typeof A.buildSessionExerciseMeta === 'function'
                ? await A.buildSessionExerciseMeta(exercise, sets, { dateKey })
                : { goalsByPos: new Map(), medalsByPos: new Map() };
        if (sets.length) {
            sets.forEach((set, index) => {
                const line = document.createElement('div');
                line.className = 'session-card-sets-row';
                const isPlanned = set?.done !== true;
                if (isPlanned) {
                    line.classList.add('session-card-sets-row--planned');
                } else {
                    const rowRpe = getRpeDatasetValue(set?.rpe);
                    if (rowRpe) {
                        line.dataset.rpe = rowRpe;
                    }
                }
                const pos = set?.pos ?? index + 1;
                const openWithFocus = (field) => {
                    setSessionScrollTarget(exerciseInstanceId);
                    void A.openExecEdit({
                        currentId: exerciseInstanceId,
                        callerScreen: 'screenSessions',
                        focusSetIndex: index,
                        focusField: normalizeFocusField(field)
                    });
                };
                const stopAndOpen = (field) => (event) => {
                    event.stopPropagation();
                    openWithFocus(field);
                };
                const goalInfo = meta?.goalsByPos?.get?.(pos) || null;
                const goalCell = createSetMetaCell({
                    text: goalInfo?.text ?? '—',
                    rpeValue: goalInfo?.rpe ?? null
                });
                const medalsCell = createSetMedalsCell(meta?.medalsByPos?.get?.(pos) || []);
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
                    goalCell,
                    medalsCell
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
            void addSetToSessionExercise(exerciseInstanceId);
        });
        setsWrapper.appendChild(addSetButton);
    }

    async function updateSessionExerciseCard(exercise, dateKey) {
        const { sessionList, screenSessions } = ensureRefs();
        const exerciseInstanceId = exercise?.id || exercise?.exercise_id;
        if (!exercise || !exerciseInstanceId || !sessionList || screenSessions?.hidden) {
            return false;
        }
        const card = sessionList.querySelector(`[data-exercise-id="${CSS.escape(exerciseInstanceId)}"]`);
        if (!card) {
            return false;
        }
        const setsWrapper = card.querySelector('.session-card-sets');
        if (!setsWrapper) {
            return false;
        }
        await renderSessionCardSets({ exercise, setsWrapper, dateKey });
        return true;
    }

    async function addSetToSessionExercise(exerciseId) {
        if (!exerciseId) {
            return;
        }
        const dateKey = A.ymd(A.activeDate);
        const session = await ensureSessionForDate(A.activeDate);
        if (!session?.exercises?.length) {
            return;
        }
        const exercise = session.exercises.find((item) => item.id === exerciseId);
        if (!exercise) {
            return;
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const previous = sets.length ? sets[sets.length - 1] : null;
        const restForNewSet = getRestForNewSet(previous?.rest);
        const preferredValues = await resolveNewSetValuesForSession(exercise, sets, previous, dateKey);
        const now = new Date().toISOString();
        const newSet = {
            pos: sets.length + 1,
            reps: preferredValues?.reps ?? 8,
            weight: preferredValues?.weight ?? null,
            rpe: preferredValues?.rpe ?? null,
            rest: restForNewSet,
            done: false,
            date: now,
            time: previous?.time ?? null,
            distance: previous?.distance ?? null,
            setType: null
        };
        const updatedSets = [...sets, newSet];
        exercise.sets = normalizeSessionSets(updatedSets, {
            sessionId: session.id,
            exerciseName: exercise.exercise_name,
            exerciseId: exercise.exercise_id,
            date: session.date
        });
        await db.saveSession(session);
        if (!(await updateSessionExerciseCard(exercise, dateKey))) {
            await A.renderSession();
        }
    }

    async function resolveNewSetValuesForSession(exercise, sets, previous, dateKey) {
        const source = A.preferences?.getNewSetValueSource?.() ?? 'last_set';
        const exerciseId = exercise.exercise_id;
        if (source === 'last_session') {
            const fromPreviousSession = await findPreviousSessionSet(exerciseId, sets.length + 1, dateKey);
            if (fromPreviousSession) {
                return sanitizeSetValues(fromPreviousSession);
            }
            if (previous) {
                return sanitizeSetValues(previous);
            }
            const lastFromHistory = await findPreviousSessionLastSet(exerciseId, dateKey);
            if (lastFromHistory) {
                return sanitizeSetValues(lastFromHistory);
            }
            return null;
        }
        if (previous) {
            return sanitizeSetValues(previous);
        }
        const lastFromHistory = await findPreviousSessionLastSet(exerciseId, dateKey);
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

    async function findPreviousSessionSet(exerciseId, position, dateKey) {
        const exercise = await findPreviousSessionExercise(exerciseId, dateKey);
        if (!exercise) {
            return null;
        }
        return findSetByPosition(exercise.sets, position);
    }

    async function findPreviousSessionLastSet(exerciseId, dateKey) {
        const exercise = await findPreviousSessionExercise(exerciseId, dateKey);
        if (!exercise) {
            return null;
        }
        return findLastSet(exercise.sets);
    }

    async function findPreviousSessionExercise(exerciseId, dateKey) {
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

    A.reorderSessionExercises = async function reorderSessionExercises(order) {
        if (!Array.isArray(order) || !order.length) {
            return;
        }
        const dateKey = A.ymd(A.activeDate);
        const session = await db.getSession(dateKey);
        if (!session?.exercises?.length) {
            return;
        }
        const byId = new Map(session.exercises.map((item) => [item.exercise_id, item]));
        const reordered = [];
        order.forEach((id) => {
            const match = byId.get(id);
            if (match) {
                reordered.push(match);
            }
        });
        session.exercises.forEach((item) => {
            if (!reordered.includes(item)) {
                reordered.push(item);
            }
        });
        reordered.forEach((item, index) => {
            item.sort = index + 1;
        });
        session.exercises = reordered;
        await db.saveSession(session);
    };

    /**
     * Ajoute des exercices sélectionnés à la séance courante.
     * @param {string[]} ids Identifiants d'exercice.
     * @returns {Promise<void>} Promesse résolue après sauvegarde.
     */
    A.addExercisesToCurrentSession = async function addExercisesToCurrentSession(ids) {
        if (!Array.isArray(ids) || !ids.length) {
            return;
        }

        const dateKey = A.ymd(A.activeDate);
        const session = (await db.getSession(dateKey)) || createSession(A.activeDate);
        const existing = new Set((session.exercises || []).map((exercise) => exercise.exercise_id));
        let firstAddedId = null;

        for (const id of ids) {
            if (existing.has(id)) {
                continue;
            }
            const exercise = await db.get('exercises', id);
            if (!exercise) {
                continue;
            }
            const created = createSessionExercise({
                date: session.date,
                sessionId: session.id,
                exerciseId: exercise.id,
                exerciseName: exercise.name || 'Exercice',
                routineInstructions: '',
                comments: '',
                isRoutine: false,
                routineId: '',
                routineName: '',
                sort: (session.exercises?.length || 0) + 1,
                sets: []
            });
            if (!firstAddedId) {
                firstAddedId = created.id;
            }
            session.exercises.push(created);
        }

        await db.saveSession(session);
        if (firstAddedId) {
            sessionScrollState.targetExerciseId = firstAddedId;
            sessionScrollState.pendingRestore = true;
        }
        await A.renderWeek();
        await A.renderSession();
    };

    /**
     * Ajoute une routine complète à la séance courante.
     * @param {string} routineId Identifiant de routine.
     * @returns {Promise<void>} Promesse résolue après sauvegarde.
     */
    A.addRoutineToSession = async function addRoutineToSession(routineIds) {
        const ids = Array.isArray(routineIds) ? routineIds : [routineIds];
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
            return;
        }

        const dateKey = A.ymd(A.activeDate);
        const session = (await db.getSession(dateKey)) || createSession(A.activeDate);
        const existingIds = new Set((session.exercises || []).map((exercise) => exercise.exercise_id));
        let firstAddedId = null;

        for (const routineId of uniqueIds) {
            const routine = await db.get('routines', routineId);
            if (!routine) {
                continue;
            }
            routine.moves.forEach((move) => {
                if (existingIds.has(move.exerciseId)) {
                    return;
                }
                existingIds.add(move.exerciseId);
                const created = createSessionExercise({
                    date: session.date,
                    sessionId: session.id,
                    exerciseId: move.exerciseId,
                    exerciseName: move.exerciseName,
                    routineInstructions: typeof move.instructions_routine_exercice === 'string'
                        ? move.instructions_routine_exercice
                        : typeof move.instructions === 'string'
                            ? move.instructions
                            : '',
                    comments: '',
                    isRoutine: true,
                    routineId: routine.id,
                    routineName: routine.name || 'Routine',
                    sort: session.exercises.length + 1,
                    sets: move.sets.map((set) => ({
                        pos: set.pos,
                        reps: set.reps ?? null,
                        weight: null,
                        rpe: set.rpe ?? null,
                        rest: set.rest ?? null,
                        done: false
                    }))
                });
                if (!firstAddedId) {
                    firstAddedId = created.id;
                }
                session.exercises.push(created);
            });
        }

        await db.saveSession(session);
        if (firstAddedId) {
            sessionScrollState.targetExerciseId = firstAddedId;
            sessionScrollState.pendingRestore = true;
        }
        await A.renderWeek();
        await A.renderSession();
    };

    /* UTILS */
    function createSession(date) {
        return {
            id: A.sessionId(date),
            date: A.sessionISO(date),
            comments_session_global: '',
            instructions_routine_global: '',
            exercises: []
        };
    }

    function createSessionExercise(options = {}) {
        const {
            date,
            sessionId,
            exerciseId,
            exerciseName,
            routineInstructions,
            comments,
            isRoutine,
            routineId,
            routineName,
            sort,
            sets
        } = options;
        const normalizedSets = normalizeSessionSets(sets, { sessionId, exerciseName, exerciseId, date });
        return {
            id: buildSessionExerciseId(sessionId, exerciseName || exerciseId),
            sort,
            exercise_id: exerciseId,
            exercise_name: exerciseName || 'Exercice',
            instructions_routine_exercice: routineInstructions || '',
            comments_session_exercice: comments || '',
            is_routine: Boolean(isRoutine),
            routine_id: routineId || '',
            routine_name: routineName || '',
            date,
            type: exerciseId,
            category: 'weight_reps',
            weight_unit: 'metric',
            distance_unit: 'metric',
            sets: normalizedSets
        };
    }

    function buildSessionExerciseId(sessionId, rawName) {
        const base = slugifyExerciseName(rawName || 'exercice');
        if (!sessionId) {
            return base;
        }
        return `${sessionId}_${base}`;
    }

    function buildSessionSetId(sessionId, rawName, position) {
        const base = slugifyExerciseName(rawName || 'exercice');
        const pos = String(position || 1).padStart(3, '0');
        if (!sessionId) {
            return `${base}_${pos}`;
        }
        return `${sessionId}_${base}_${pos}`;
    }

    function slugifyExerciseName(value) {
        return String(value || '')
            .trim()
            .replace(/['’\s]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'exercice';
    }

    function normalizeSessionSets(sets, context = {}) {
        const list = Array.isArray(sets) ? sets : [];
        const now = new Date().toISOString();
        return list.map((set, index) => {
            const pos = set?.pos ?? index + 1;
            const date = typeof set?.date === 'string' && set.date ? set.date : now;
            return {
                ...set,
                id: buildSessionSetId(context.sessionId, context.exerciseName || context.exerciseId, pos),
                pos,
                date,
                type: context.exerciseId,
                time: set?.time ?? null,
                distance: set?.distance ?? null,
                setType: null
            };
        });
    }
    const dragCtx = {
        active: false,
        card: null,
        handle: null,
        placeholder: null,
        pointerId: null,
        offsetY: 0,
        initialOrder: []
    };

    function makeSessionCardInteractive(card, handle) {
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

        const { sessionList } = assertRefs();
        dragCtx.active = true;
        dragCtx.card = card;
        dragCtx.handle = handle;
        dragCtx.pointerId = event.pointerId;
        dragCtx.initialOrder = getSessionOrder(sessionList);

        const rect = card.getBoundingClientRect();
        dragCtx.offsetY = event.clientY - rect.top;
        const placeholder = document.createElement('div');
        placeholder.className = 'session-card-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        dragCtx.placeholder = placeholder;

        sessionList.insertBefore(placeholder, card);
        sessionList.appendChild(card);

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

        const { sessionList } = assertRefs();
        const siblings = Array.from(sessionList.children)
            .filter((node) => node !== dragCtx.card && node !== dragCtx.placeholder);

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                if (dragCtx.placeholder !== sibling) {
                    sessionList.insertBefore(dragCtx.placeholder, sibling);
                }
                return;
            }
        }
        sessionList.appendChild(dragCtx.placeholder);
    }

    async function onDragEnd(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        event.preventDefault();

        await finishDrag(true);
    }

    async function onDragCancel(event) {
        if (!dragCtx.active || event.pointerId !== dragCtx.pointerId) {
            return;
        }
        event.preventDefault();

        await finishDrag(false);
    }

    async function finishDrag(shouldPersist) {
        const { sessionList } = assertRefs();
        const { handle } = dragCtx;

        handle?.removeEventListener('pointermove', onDragMove);
        handle?.removeEventListener('pointerup', onDragEnd);
        handle?.removeEventListener('pointercancel', onDragCancel);
        if (handle?.releasePointerCapture && dragCtx.pointerId != null) {
            handle.releasePointerCapture(dragCtx.pointerId);
        }

        if (dragCtx.placeholder && dragCtx.card) {
            sessionList.insertBefore(dragCtx.card, dragCtx.placeholder);
            dragCtx.placeholder.remove();
        }

        if (dragCtx.card) {
            dragCtx.card.classList.remove('session-card-dragging');
            dragCtx.card.style.position = '';
            dragCtx.card.style.left = '';
            dragCtx.card.style.top = '';
            dragCtx.card.style.width = '';
            dragCtx.card.style.height = '';
            dragCtx.card.style.zIndex = '';
            dragCtx.card.style.pointerEvents = '';
        }

        const newOrder = getSessionOrder(sessionList);
        const initial = dragCtx.initialOrder;

        dragCtx.active = false;
        dragCtx.card = null;
        dragCtx.handle = null;
        dragCtx.placeholder = null;
        dragCtx.pointerId = null;
        dragCtx.offsetY = 0;
        dragCtx.initialOrder = [];

        if (!shouldPersist) {
            await A.renderSession();
            return;
        }

        if (!arraysEqual(initial, newOrder)) {
            await A.reorderSessionExercises(newOrder);
            await A.renderSession();
        }
    }

    function getSessionOrder(container) {
        return Array.from(container.querySelectorAll('.exercise-card'))
            .map((node) => node.dataset.exerciseId)
            .filter(Boolean);
    }

    function arraysEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((value, index) => value === b[index]);
    }

    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.btnAddExercises = document.getElementById('btnAddExercises');
        refs.btnAddRoutines = document.getElementById('btnAddRoutines');
        refs.btnSessionEditFull = document.getElementById('btnSessionEditFull');
        refs.selectRoutine = document.getElementById('selectRoutine');
        refs.todayLabel = document.getElementById('todayLabel');
        refs.sessionList = document.getElementById('sessionList');
        refs.btnSessionPrev = document.getElementById('btnSessionPrev');
        refs.btnSessionNext = document.getElementById('btnSessionNext');
        refs.btnSessionSettings = document.getElementById('btnSessionSettings');
        refs.btnSessionEdit = document.getElementById('btnSessionEdit');
        refs.screenSessions = document.getElementById('screenSessions');
        refs.sessionContent = refs.screenSessions?.querySelector('.content') || null;
        refs.dlgSessionEditor = document.getElementById('dlgSessionEditor');
        refs.sessionEditorTitle = document.getElementById('sessionEditorTitle');
        refs.sessionEditorClose = document.getElementById('sessionEditorClose');
        refs.sessionEditorCancel = document.getElementById('sessionEditorCancel');
        refs.dlgExecMoveEditor = document.getElementById('dlgExecMoveEditor');
        refs.btnSessionComments = document.getElementById('btnSessionComments');
        refs.sessionCommentsPreview = document.getElementById('sessionCommentsPreview');
        refs.sessionCreateRoutine = document.getElementById('sessionCreateRoutine');
        refs.sessionDelete = document.getElementById('sessionDelete');
        refs.sessionShare = document.getElementById('sessionShare');
        refs.dlgSessionComment = document.getElementById('dlgSessionComment');
        refs.sessionCommentInstructions = document.getElementById('sessionCommentInstructions');
        refs.sessionCommentInput = document.getElementById('sessionCommentInput');
        refs.sessionCommentClose = document.getElementById('sessionCommentClose');
        refs.sessionCommentCancel = document.getElementById('sessionCommentCancel');
        refsResolved = true;
        return refs;
    }

    function wireSessionScrollRestore() {
        const { screenSessions } = ensureRefs();
        if (!screenSessions) {
            return;
        }
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName !== 'hidden') {
                    return;
                }
                if (screenSessions.hidden) {
                    storeSessionScroll();
                } else {
                    sessionScrollState.pendingRestore = true;
                }
            });
        });
        observer.observe(screenSessions, { attributes: true, attributeFilter: ['hidden'] });
    }

    function getSessionScrollContainer() {
        const { sessionContent, screenSessions } = ensureRefs();
        if (sessionContent) {
            return sessionContent;
        }
        const content = screenSessions?.querySelector('.content') || null;
        refs.sessionContent = content;
        return content;
    }

    function storeSessionScroll() {
        const container = getSessionScrollContainer();
        if (!container) {
            return;
        }
        sessionScrollState.top = container.scrollTop || 0;
        sessionScrollState.pendingRestore = true;
    }

    function restoreSessionScroll() {
        if (!sessionScrollState.pendingRestore) {
            return;
        }
        const container = getSessionScrollContainer();
        if (!container) {
            return;
        }
        let restored = false;
        if (sessionScrollState.targetExerciseId) {
            const target = container.querySelector(
                `[data-exercise-id="${CSS.escape(sessionScrollState.targetExerciseId)}"]`
            );
            if (target) {
                const containerRect = container.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                container.scrollTop = container.scrollTop + (targetRect.top - containerRect.top);
                restored = true;
            }
            sessionScrollState.targetExerciseId = null;
        }
        if (!restored) {
            container.scrollTop = sessionScrollState.top;
        }
        sessionScrollState.pendingRestore = false;
    }

    A.storeSessionScroll = () => storeSessionScroll();
    A.restoreSessionScroll = () => restoreSessionScroll();
    A.setSessionScrollTarget = (exerciseId) => setSessionScrollTarget(exerciseId);
    A.ensureSessionCardInView = (exerciseId) => {
        if (!exerciseId) {
            return false;
        }
        const container = getSessionScrollContainer();
        if (!container) {
            return false;
        }
        const target = container.querySelector(`[data-exercise-id="${CSS.escape(exerciseId)}"]`);
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

    function assertRefs() {
        ensureRefs();
        const required = ['todayLabel', 'sessionList'];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-session.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireAddExercisesButton() {
        const { btnAddExercises } = refs;
        btnAddExercises?.addEventListener('click', () => {
            A.openExercises({
                mode: 'add',
                callerScreen: 'screenSessions',
                onAdd: async (ids) => {
                    await A.addExercisesToCurrentSession(ids);
                }
            });
        });
    }

    function wireAddRoutinesButton() {
        const { btnAddRoutines } = refs;
        btnAddRoutines?.addEventListener('click', async () => {
            const preselectedIds = await A.getPlannedRoutineIds?.(A.activeDate);
            A.openRoutineList({
                mode: 'add',
                callerScreen: 'screenSessions',
                preselectedIds,
                onAdd: async (ids) => {
                    await A.addRoutineToSession(ids);
                }
            });
        });
    }

    function wireSessionNavigation() {
        const { btnSessionPrev, btnSessionNext, btnSessionSettings } = refs;
        if (btnSessionPrev) {
            btnSessionPrev.addEventListener('click', () => {
                const target = btnSessionPrev.dataset.targetDate;
                if (target) {
                    void goToSessionDate(target);
                }
            });
        }
        if (btnSessionNext) {
            btnSessionNext.addEventListener('click', () => {
                const target = btnSessionNext.dataset.targetDate;
                if (target) {
                    void goToSessionDate(target);
                }
            });
        }
        if (btnSessionSettings) {
            btnSessionSettings.addEventListener('click', () => {
                A.openSettings?.();
            });
        }
    }

    function wireSessionEditor() {
        const {
            btnSessionEdit,
            btnSessionEditFull,
            dlgSessionEditor,
            sessionEditorClose,
            sessionEditorCancel,
            sessionCreateRoutine,
            sessionDelete,
            sessionShare
        } = ensureRefs();
        if ((!btnSessionEdit && !btnSessionEditFull) || !dlgSessionEditor) {
            return;
        }

        const closeSessionEditorDialog = () => {
            if (A.closeDialog) {
                A.closeDialog(dlgSessionEditor);
            } else {
                dlgSessionEditor.close();
            }
        };

        btnSessionEdit?.addEventListener('click', () => {
            void openSessionEditor();
        });

        btnSessionEditFull?.addEventListener('click', () => {
            void openSessionEditor();
        });

        dlgSessionEditor.addEventListener('click', (event) => {
            if (event.target !== dlgSessionEditor) {
                return;
            }
            closeSessionEditorDialog();
        });

        sessionEditorClose?.addEventListener('click', () => {
            closeSessionEditorDialog();
        });

        sessionEditorCancel?.addEventListener('click', () => {
            closeSessionEditorDialog();
        });

        sessionCreateRoutine?.addEventListener('click', () => {
            closeSessionEditorDialog();
            void createRoutineFromSession();
        });

        sessionDelete?.addEventListener('click', () => {
            closeSessionEditorDialog();
            void deleteSessionFromEditor();
        });

        sessionShare?.addEventListener('click', () => {
            closeSessionEditorDialog();
            void A.openShareSessionsDialog?.();
        });
    }

    function wireSessionComments() {
        const {
            btnSessionComments,
            dlgSessionComment,
            sessionCommentInput,
            sessionCommentClose,
            sessionCommentCancel
        } = ensureRefs();
        if (!btnSessionComments || !dlgSessionComment) {
            return;
        }

        btnSessionComments.addEventListener('click', () => {
            void openSessionCommentDialog();
        });

        sessionCommentClose?.addEventListener('click', () => {
            void closeSessionCommentDialog({ revert: false });
        });

        sessionCommentCancel?.addEventListener('click', () => {
            void closeSessionCommentDialog({ revert: true });
        });

        dlgSessionComment.addEventListener('close', () => {
            void flushSessionCommentSave();
        });

        sessionCommentInput?.addEventListener('input', () => {
            if (!sessionCommentState.session) {
                return;
            }
            sessionCommentState.session.comments_session_global = sessionCommentInput.value;
            updateSessionCommentsPreview(sessionCommentState.session);
            scheduleSessionCommentSave();
        });
    }

    async function updateSessionNavigation() {
        const { btnSessionPrev, btnSessionNext } = ensureRefs();
        if (!btnSessionPrev && !btnSessionNext) {
            return;
        }
        const dates = await getSessionActivityDates();
        const dateKey = A.ymd(A.activeDate);
        const previous = getPreviousDate(dates, dateKey);
        const next = getNextDate(dates, dateKey);

        setNavButtonState(btnSessionPrev, previous);
        setNavButtonState(btnSessionNext, next);
    }

    async function getSessionActivityDates() {
        const sessions = typeof db.listSessionDatesWithActivity === 'function'
            ? await db.listSessionDatesWithActivity()
            : await db.listSessionDates();
        return sessions
            .map((entry) => entry.date)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    }

    function getPreviousDate(dates, currentKey) {
        if (!Array.isArray(dates) || !currentKey) {
            return null;
        }
        const earlier = dates.filter((date) => date < currentKey);
        return earlier.length ? earlier[earlier.length - 1] : null;
    }

    function getNextDate(dates, currentKey) {
        if (!Array.isArray(dates) || !currentKey) {
            return null;
        }
        return dates.find((date) => date > currentKey) || null;
    }

    function setNavButtonState(button, targetDate) {
        if (!button) {
            return;
        }
        if (targetDate) {
            button.disabled = false;
            button.dataset.targetDate = targetDate;
            button.setAttribute('aria-disabled', 'false');
        } else {
            button.disabled = true;
            delete button.dataset.targetDate;
            button.setAttribute('aria-disabled', 'true');
        }
    }

    function parseDateKey(dateKey) {
        if (!dateKey || typeof dateKey !== 'string') {
            return null;
        }
        const [year, month, day] = dateKey.split('-').map((value) => Number.parseInt(value, 10));
        if (!year || !month || !day) {
            return null;
        }
        return new Date(year, month - 1, day, 12);
    }

    async function goToSessionDate(dateKey) {
        if (!dateKey) {
            return;
        }
        const targetDate = parseDateKey(dateKey);
        if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) {
            return;
        }
        A.activeDate = targetDate;
        A.currentAnchor = A.startOfWeek(A.activeDate);
        await A.populateRoutineSelect();
        await A.renderWeek();
        await A.renderSession();
    }

    function updateSessionEditButtons(session) {
        const { btnSessionEditFull } = ensureRefs();
        if (!btnSessionEditFull) {
            return;
        }
        btnSessionEditFull.hidden = false;
        btnSessionEditFull.setAttribute('aria-hidden', 'false');
    }

    function hasSessionSets(session) {
        const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
        return exercises.some((exercise) => Array.isArray(exercise?.sets) && exercise.sets.length > 0);
    }

    async function openSessionEditor() {
        const { dlgSessionEditor, sessionEditorTitle, sessionCreateRoutine } = ensureRefs();
        if (!dlgSessionEditor) {
            return;
        }
        const date = A.activeDate;
        if (sessionEditorTitle) {
            sessionEditorTitle.textContent = formatSessionDateLabel(date);
        }
        const session = await ensureSessionForDate(date);
        sessionEditorState.session = session;
        if (sessionCreateRoutine) {
            const hasExercises = Array.isArray(session.exercises) && session.exercises.length > 0;
            sessionCreateRoutine.disabled = !hasExercises;
        }
        dlgSessionEditor.showModal();
    }

    async function ensureSessionForDate(date) {
        const key = A.ymd(date);
        let session = await db.getSession(key);
        if (!session) {
            session = createSession(date);
            await db.saveSession(session);
            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
        }
        return session;
    }

    async function openSessionCommentDialog() {
        const { dlgSessionComment, sessionCommentInput, sessionCommentInstructions } = ensureRefs();
        if (!dlgSessionComment || !sessionCommentInput || !sessionCommentInstructions) {
            return;
        }
        const session = await ensureSessionForDate(A.activeDate);
        sessionCommentState.session = session;
        sessionCommentInput.value = session.comments_session_global || '';
        sessionCommentState.initialComments = sessionCommentInput.value;
        const instructions = await resolveSessionInstructionsText();
        updateSessionInstructionsPreview(instructions);
        dlgSessionComment.showModal();
        focusTextareaAtEnd(sessionCommentInput);
    }

    async function closeSessionCommentDialog({ revert }) {
        const { dlgSessionComment, sessionCommentInput } = ensureRefs();
        if (!dlgSessionComment || !sessionCommentInput) {
            return;
        }
        if (revert && sessionCommentState.session) {
            sessionCommentState.session.comments_session_global = sessionCommentState.initialComments || '';
            sessionCommentInput.value = sessionCommentState.initialComments || '';
            updateSessionCommentsPreview(sessionCommentState.session);
        }
        await flushSessionCommentSave();
        if (A.closeDialog) {
            A.closeDialog(dlgSessionComment);
        } else {
            dlgSessionComment.close();
        }
    }

    function scheduleSessionCommentSave() {
        if (sessionCommentState.saveTimer) {
            clearTimeout(sessionCommentState.saveTimer);
        }
        sessionCommentState.saveTimer = setTimeout(() => {
            void flushSessionCommentSave();
        }, 300);
    }

    async function flushSessionCommentSave() {
        if (sessionCommentState.saveTimer) {
            clearTimeout(sessionCommentState.saveTimer);
            sessionCommentState.saveTimer = null;
        }
        if (!sessionCommentState.session) {
            return;
        }
        await db.saveSession(sessionCommentState.session);
    }

    function updateSessionCommentsPreview(session) {
        const { sessionCommentsPreview } = ensureRefs();
        if (!sessionCommentsPreview) {
            return;
        }
        const comment = typeof session?.comments_session_global === 'string'
            ? session.comments_session_global.trim()
            : '';
        sessionCommentsPreview.textContent = comment;
        sessionCommentsPreview.dataset.empty = comment ? 'false' : 'true';
    }

    async function resolveSessionInstructionsText() {
        if (typeof A.getPlannedRoutineIds !== 'function') {
            return '';
        }
        const routineIds = await A.getPlannedRoutineIds(A.activeDate);
        if (!routineIds.length) {
            return '';
        }
        const routines = await Promise.all(routineIds.map((routineId) => db.get('routines', routineId)));
        const blocks = routines.flatMap((routine) => {
            if (!routine) {
                return [];
            }
            const text = typeof routine.instructions_routine_global === 'string'
                ? routine.instructions_routine_global.trim()
                : '';
            if (!text) {
                return [];
            }
            if (routineIds.length > 1 && routine.name) {
                return [`${routine.name} : ${text}`];
            }
            return [text];
        });
        return blocks.join('\n\n');
    }

    function updateSessionInstructionsPreview(text) {
        const { sessionCommentInstructions } = ensureRefs();
        if (!sessionCommentInstructions) {
            return;
        }
        const instructions = typeof text === 'string' ? text.trim() : '';
        sessionCommentInstructions.textContent = instructions;
        sessionCommentInstructions.dataset.empty = instructions ? 'false' : 'true';
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

    async function createRoutineFromSession() {
        const { dlgSessionEditor } = ensureRefs();
        const session = sessionEditorState.session || await ensureSessionForDate(A.activeDate);
        const exercises = Array.isArray(session.exercises) ? session.exercises : [];
        if (!exercises.length) {
            return;
        }
        const routineId = createRoutineId();
        const routine = buildRoutineFromSession(session, routineId);
        await db.put('routines', routine);
        if (typeof A.refreshRoutineList === 'function') {
            await A.refreshRoutineList();
        }
        if (typeof A.populateRoutineSelect === 'function') {
            await A.populateRoutineSelect();
        }
        if (A.closeDialog) {
            A.closeDialog(dlgSessionEditor);
        } else {
            dlgSessionEditor?.close();
        }
        if (typeof A.openRoutineEdit === 'function') {
            await A.openRoutineEdit({ routineId, callerScreen: 'screenSessions' });
        }
    }

    async function deleteSessionFromEditor() {
        const { dlgSessionEditor } = ensureRefs();
        const session = sessionEditorState.session;
        if (!session) {
            return;
        }
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Supprimer la séance',
                message: 'Supprimer la séance ?',
                variant: 'danger'
            })
            : confirm('Supprimer la séance ?');
        if (!confirmed) {
            return;
        }
        if (session.id) {
            await db.del('sessions', session.id);
        }
        sessionEditorState.session = null;
        if (A.closeDialog) {
            A.closeDialog(dlgSessionEditor);
        } else {
            dlgSessionEditor?.close();
        }
        if (typeof A.renderWeek === 'function') {
            await A.renderWeek();
        }
        if (typeof A.renderSession === 'function') {
            await A.renderSession();
        }
    }

    function buildRoutineFromSession(session, routineId) {
        const sessionDate = session?.date ? new Date(session.date) : A.activeDate;
        const dateLabel = formatSessionDateLabel(sessionDate);
        const exercises = Array.isArray(session.exercises) ? session.exercises : [];
        const moves = exercises.map((exercise, index) => ({
            id: uid('move'),
            pos: index + 1,
            exerciseId: exercise.exercise_id,
            exerciseName: exercise.exercise_name || 'Exercice',
            instructions_routine_exercice: typeof exercise.instructions_routine_exercice === 'string'
                ? exercise.instructions_routine_exercice
                : '',
            sets: Array.isArray(exercise.sets)
                ? exercise.sets.map((set, setIndex) => ({
                    pos: safeInt(set?.pos, setIndex + 1),
                    reps: safeIntOrNull(set?.reps),
                    weight: null,
                    rpe: safeFloatOrNull(set?.rpe),
                    rest: safeIntOrNull(set?.rest)
                }))
                : []
        }));

        return {
            id: routineId,
            name: `Routine du ${dateLabel}`,
            icon: '🏋️',
            instructions_routine_global: '',
            moves
        };
    }

    function formatSessionDateLabel(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function createRoutineId() {
        return `routine-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
    }

    function safeInt(value, fallback) {
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

    function safeIntOrNull(value) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function safeFloatOrNull(value) {
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric : null;
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
        const base = Math.random().toString(36).slice(2, 8);
        const time = Date.now().toString(36);
        return prefix ? `${prefix}-${base}-${time}` : `${base}-${time}`;
    }
})();
