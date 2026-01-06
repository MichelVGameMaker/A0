// ui-exercise-read.js — écran lecture d’un exercice
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        currentId: null,
        callerScreen: 'screenExercises',
        activeTab: 'exec',
        exercise: null
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireNavigation();
        wireTabs();
    });

    /* ACTIONS */
    /**
     * Ouvre l'écran de lecture d'un exercice.
     * @param {{currentId: string, callerScreen?: string}} options Contexte d'ouverture.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.openExerciseRead = async function openExerciseRead(options) {
        const { currentId, callerScreen = 'screenExercises', tab = 'exec' } = options || {};
        if (!currentId) {
            return;
        }
        ensureRefs();
        assertRefs();

        state.currentId = currentId;
        state.callerScreen = callerScreen;

        const exercise = await db.get('exercises', currentId);
        if (!exercise) {
            alert('Exercice introuvable.');
            return;
        }

        state.exercise = exercise;
        refs.exReadTitle.textContent = exercise.name || 'Exercice';
        refs.exReadOrigin.textContent = formatExerciseOrigin(exercise);
        updateHero(exercise);
        updateMuscles(exercise);
        updateInstructions(exercise);
        await updateHistory(exercise);
        setActiveTab(tab);

        switchScreen('screenExerciseRead');
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenExerciseRead = document.getElementById('screenExerciseRead');
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenSessions = document.getElementById('screenSessions');
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
        refs.exReadTitle = document.getElementById('exReadTitle');
        refs.exReadOrigin = document.getElementById('exReadOrigin');
        refs.exReadHero = document.getElementById('exReadHero');
        refs.exReadMuscleMain = document.getElementById('exReadMuscleMain');
        refs.exReadMuscleSecondary = document.getElementById('exReadMuscleSecondary');
        refs.exReadInstruc = document.getElementById('exReadInstruc');
        refs.exReadBack = document.getElementById('exReadBack');
        refs.exReadEdit = document.getElementById('exReadEdit');
        refs.exReadTabs = document.getElementById('exReadTabs');
        refs.exReadTabExec = document.getElementById('exReadTabExec');
        refs.exReadTabHistory = document.getElementById('exReadTabHistory');
        refs.exReadTabStats = document.getElementById('exReadTabStats');
        refs.exReadHistoryList = document.getElementById('exReadHistoryList');
        refs.dlgExerciseActions = document.getElementById('dlgExerciseActions');
        refs.exerciseActionsClose = document.getElementById('exerciseActionsClose');
        refs.exerciseActionName = document.getElementById('exerciseActionName');
        refs.exerciseActionEdit = document.getElementById('exerciseActionEdit');
        refs.exerciseActionConvert = document.getElementById('exerciseActionConvert');
        refs.exerciseActionDuplicate = document.getElementById('exerciseActionDuplicate');
        refs.exerciseActionDelete = document.getElementById('exerciseActionDelete');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenExerciseRead',
            'exReadTitle',
            'exReadOrigin',
            'exReadHero',
            'exReadMuscleMain',
            'exReadMuscleSecondary',
            'exReadInstruc',
            'exReadBack',
            'exReadEdit',
            'exReadTabs',
            'exReadTabExec',
            'exReadTabHistory',
            'exReadTabStats',
            'exReadHistoryList',
            'dlgExerciseActions',
            'exerciseActionsClose',
            'exerciseActionName',
            'exerciseActionEdit',
            'exerciseActionConvert',
            'exerciseActionDuplicate',
            'exerciseActionDelete'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-exercise-read.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireNavigation() {
        const {
            exReadBack,
            exReadEdit,
            dlgExerciseActions,
            exerciseActionsClose,
            exerciseActionConvert,
            exerciseActionEdit,
            exerciseActionDuplicate,
            exerciseActionDelete
        } = assertRefs();
        exReadBack?.addEventListener('click', () => {
            if (state.callerScreen === 'screenExercises') {
                void A.openExercises({ callerScreen: 'screenExerciseRead' });
            } else {
                switchScreen(state.callerScreen || 'screenExercises');
            }
        });
        exReadEdit?.addEventListener('click', () => {
            openExerciseActions();
        });
        exerciseActionsClose?.addEventListener('click', () => {
            dlgExerciseActions?.close();
        });
        exerciseActionEdit?.addEventListener('click', () => {
            void handleExerciseAction('edit');
        });
        exerciseActionConvert?.addEventListener('click', () => {
            void handleExerciseAction('convert');
        });
        exerciseActionDuplicate?.addEventListener('click', () => {
            void handleExerciseAction('duplicate');
        });
        exerciseActionDelete?.addEventListener('click', () => {
            void handleExerciseAction('delete');
        });
    }

    function wireTabs() {
        const { exReadTabs, exReadTabExec, exReadTabHistory, exReadTabStats } = assertRefs();
        if (!exReadTabs) {
            return;
        }
        exReadTabs.addEventListener('click', (event) => {
            const target = event.target.closest('[data-tab]');
            if (!target) {
                return;
            }
            const next = target.getAttribute('data-tab');
            if (!next) {
                return;
            }
            setActiveTab(next);
        });

        let touchStartX = 0;
        let touchStartY = 0;
        const handleTouchStart = (event) => {
            const touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        };
        const handleTouchEnd = (event) => {
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) {
                return;
            }
            const tabs = ['exec', 'history', 'stats'];
            const currentIndex = Math.max(0, tabs.indexOf(state.activeTab));
            const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
            const nextTab = tabs[nextIndex];
            if (nextTab) {
                setActiveTab(nextTab);
            }
        };
        [exReadTabExec, exReadTabHistory, exReadTabStats].forEach((panel) => {
            if (!panel) {
                return;
            }
            panel.addEventListener('touchstart', handleTouchStart, { passive: true });
            panel.addEventListener('touchend', handleTouchEnd);
        });
    }

    function openExerciseActions() {
        const { dlgExerciseActions } = assertRefs();
        if (!state.currentId) {
            alert('Aucun exercice sélectionné.');
            return;
        }
        updateExerciseActionsView();
        if (!dlgExerciseActions.open) {
            dlgExerciseActions.showModal();
        }
    }

    async function handleExerciseAction(action) {
        const { dlgExerciseActions } = assertRefs();
        if (!state.currentId) {
            alert('Aucun exercice sélectionné.');
            return;
        }
        if (action === 'edit') {
            dlgExerciseActions.close();
            await A.openExerciseEdit({ currentId: state.currentId, callerScreen: 'screenExerciseRead' });
            return;
        }
        if (action === 'convert') {
            dlgExerciseActions.close();
            await handleExerciseConversion();
            return;
        }
        if (action === 'duplicate') {
            const exercise = await db.get('exercises', state.currentId);
            if (!exercise) {
                alert('Exercice introuvable.');
                return;
            }
            const copy = {
                ...exercise,
                id: buildUserExerciseId(exercise.name),
                origin: 'user',
                native_id: null
            };
            await db.put('exercises', copy);
            dlgExerciseActions.close();
            await A.openExerciseEdit({ currentId: copy.id, callerScreen: 'screenExerciseRead' });
            return;
        }
        if (action === 'delete') {
            const confirmed = A.components?.confirmDialog?.confirm
                ? await A.components.confirmDialog.confirm({
                    title: 'Supprimer un exercice',
                    message: 'Supprimer cet exercice ?',
                    variant: 'danger'
                })
                : confirm('Supprimer cet exercice ?');
            if (!confirmed) {
                return;
            }
            await db.del('exercises', state.currentId);
            dlgExerciseActions.close();
            await A.openExercises({ callerScreen: 'screenExerciseRead' });
        }
    }

    function updateExerciseActionsView() {
        const { exerciseActionName, exerciseActionConvert } = assertRefs();
        const name = state.exercise?.name || '—';
        exerciseActionName.textContent = name;
        const isImported = state.exercise?.origin === 'import';
        if (exerciseActionConvert) {
            exerciseActionConvert.hidden = !isImported;
        }
    }

    async function handleExerciseConversion() {
        if (!state.exercise) {
            alert('Exercice introuvable.');
            return;
        }
        const sourceExercise = state.exercise;
        A.openExercises?.({
            mode: 'add',
            callerScreen: 'screenExerciseRead',
            selectionLimit: 1,
            onAdd: (ids) => {
                const exerciseId = Array.isArray(ids) ? ids[0] : null;
                if (!exerciseId) {
                    return;
                }
                void finalizeExerciseConversion(sourceExercise, exerciseId);
            }
        });
    }

    async function finalizeExerciseConversion(sourceExercise, exerciseId) {
        const targetExercise = await db.get('exercises', exerciseId);
        if (!targetExercise) {
            alert('Exercice introuvable.');
            return;
        }
        if (typeof A.applyFitHeroMapping !== 'function') {
            alert('Mapping FitHero indisponible.');
            return;
        }
        const slug = sourceExercise?.external_exercise_id || sourceExercise?.id || sourceExercise?.name || '—';
        const applied = await A.applyFitHeroMapping({
            slug,
            sourceExercise,
            targetExercise,
            skipRender: true
        });
        if (applied) {
            await A.openExerciseRead({ currentId: targetExercise.id, callerScreen: state.callerScreen });
        }
    }

    function updateHero(exercise) {
        const { exReadHero } = assertRefs();
        if (exercise.image) {
            exReadHero.src = exercise.image;
            exReadHero.classList.remove('exercise-hero-placeholder');
        } else {
            exReadHero.src = new URL('icons/placeholder-64.png', document.baseURI).href;
            exReadHero.classList.add('exercise-hero-placeholder');
        }
        exReadHero.alt = exercise.name || 'exercice';
    }

    function updateMuscles(exercise) {
        const { exReadMuscleMain, exReadMuscleSecondary } = assertRefs();
        const main = exercise.muscle || exercise.muscleGroup2 || exercise.muscleGroup3 || '—';
        const secondary = toArray(exercise.secondaryMuscles).filter(Boolean).join(', ');
        exReadMuscleMain.textContent = `Principal : ${ucFirst(main)}`;
        exReadMuscleSecondary.textContent = `Secondaires : ${secondary || '—'}`;
    }

    function updateInstructions(exercise) {
        const { exReadInstruc } = assertRefs();
        exReadInstruc.innerHTML = '';
        const steps = toArray(exercise.instructions);
        if (steps.length) {
            steps.forEach((step) => {
                const li = document.createElement('li');
                const cleaned = String(step)
                    .replace(/^Step:\s*\d+\s*/i, '')
                    .replace(/^\s*\d+\s*[\).:-]\s*/, '')
                    .replace(/^\s*\d+\s+/, '')
                    .trim();
                li.textContent = cleaned || '—';
                exReadInstruc.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = '—';
            exReadInstruc.appendChild(li);
        }
    }

    function setActiveTab(nextTab) {
        const { exReadTabs, exReadTabExec, exReadTabHistory, exReadTabStats } = assertRefs();
        const allowed = ['exec', 'history', 'stats'];
        const tab = allowed.includes(nextTab) ? nextTab : 'exec';
        state.activeTab = tab;
        exReadTabs.querySelectorAll('[data-tab]').forEach((button) => {
            const isActive = button.getAttribute('data-tab') === tab;
            button.classList.toggle('selected', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        exReadTabExec.hidden = tab !== 'exec';
        exReadTabHistory.hidden = tab !== 'history';
        exReadTabStats.hidden = tab !== 'stats';
        if (tab === 'history') {
            void updateHistory(state.exercise);
        }
        if (tab === 'stats' && state.currentId && typeof A.renderExerciseStatsEmbedded === 'function') {
            void A.renderExerciseStatsEmbedded(state.currentId);
        }
    }

    async function updateHistory(exercise) {
        const { exReadHistoryList } = assertRefs();
        if (!state.currentId || !exReadHistoryList) {
            return;
        }
        const sessionsRaw = await db.getAll('sessions');
        const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : [];
        const items = sessions
            .map((session) => {
                const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
                const match = exercises.find((item) => item?.exercise_id === state.currentId);
                if (!match || !Array.isArray(match.sets) || match.sets.length === 0) {
                    return null;
                }
                return {
                    session,
                    sets: match.sets.filter((set) => set && (set.reps || set.weight || set.rpe || set.rest))
                };
            })
            .filter(Boolean);

        items.sort((a, b) => {
            const timeA = new Date(a.session?.date || a.session?.id || 0).getTime();
            const timeB = new Date(b.session?.date || b.session?.id || 0).getTime();
            return timeB - timeA;
        });

        exReadHistoryList.innerHTML = '';
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune séance enregistrée.';
            exReadHistoryList.appendChild(empty);
            return;
        }

        const weightUnit = exercise?.weight_unit === 'imperial' ? 'lb' : 'kg';
        items.forEach(({ session, sets }) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'exercise-history-session';

            const dateLabel = document.createElement('div');
            dateLabel.className = 'lbl';
            dateLabel.textContent = formatSessionDate(session);
            wrapper.appendChild(dateLabel);

            if (!sets.length) {
                const emptyLine = document.createElement('div');
                emptyLine.className = 'details';
                emptyLine.textContent = '—';
                wrapper.appendChild(emptyLine);
            } else {
                sets.forEach((set) => {
                    const line = document.createElement('div');
                    line.className = 'details';
                    line.textContent = formatSetLine(set, weightUnit);
                    wrapper.appendChild(line);
                });
            }

            exReadHistoryList.appendChild(wrapper);
        });
    }

    function formatSessionDate(session) {
        const dateValue = session?.date || session?.id;
        const date = dateValue ? new Date(dateValue) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return '—';
        }
        return typeof A.fmtUI === 'function' ? A.fmtUI(date) : date.toLocaleDateString('fr-FR');
    }

    function formatSetLine(set, weightUnit) {
        const reps = Number.isFinite(set?.reps) ? set.reps : null;
        const weight = set?.weight != null ? Number(set.weight) : null;
        const rpe = set?.rpe != null ? set.rpe : null;
        const rest = Number.isFinite(set?.rest) ? set.rest : null;
        const parts = [];
        if (reps != null) {
            parts.push(`${reps}x`);
        }
        if (weight != null && !Number.isNaN(weight)) {
            parts.push(`${formatNumber(weight)}${weightUnit}`);
        }
        if (rpe != null && rpe !== '') {
            parts.push(`@rpe${rpe}`);
        }
        if (rest != null && rest > 0) {
            parts.push(`- rest ${formatRest(rest)}`);
        }
        return parts.length ? parts.join(' ') : '—';
    }

    function formatRest(seconds) {
        const total = Math.max(0, Math.round(seconds));
        const minutes = Math.floor(total / 60);
        const remaining = total % 60;
        return `${minutes}:${String(remaining).padStart(2, '0')}`;
    }

    function formatNumber(value) {
        return Number.isFinite(value) ? value.toLocaleString('fr-FR') : '—';
    }

    function formatExerciseOrigin(exercise) {
        const origin = exercise?.origin;
        if (origin === 'modified') {
            return 'Modifié';
        }
        if (origin === 'native') {
            return 'Natif';
        }
        if (origin === 'import') {
            return 'Importé';
        }
        if (origin === 'user') {
            return 'Créé';
        }
        return 'Exercice';
    }

    function buildUserExerciseId(name) {
        const base = String(name || '')
            .trim()
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'exercise';
        return `user--${base}--${Date.now()}`;
    }

    function switchScreen(target) {
        const { screenExerciseRead, screenExercises, screenSessions, screenExerciseEdit, screenExecEdit } = assertRefs();
        const {
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatExercises,
            screenStatExercisesDetail,
            screenSettings,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData
        } = refs;
        const map = {
            screenExerciseRead,
            screenExercises,
            screenSessions,
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
    }

    function toArray(value) {
        if (Array.isArray(value)) {
            return value;
        }
        if (value) {
            return [value];
        }
        return [];
    }

    function ucFirst(value) {
        const text = value || '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
})();
