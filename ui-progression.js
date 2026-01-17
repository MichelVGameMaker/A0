// ui-progression.js — écran Progression
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-progression: composant listCard manquant.');
    }

    const refs = {};
    let refsResolved = false;
    const DEFAULT_GOAL_PERCENT = 1;
    const MAX_PLAN_DAYS = 28;
    const state = {
        plan: null,
        routines: []
    };

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wirePlanningToggle();
    });

    A.openProgression = async function openProgression() {
        ensureRefs();
        highlightPlanningTab();
        setPlanningToggleActive('progression');
        await renderProgression();
        switchScreen('screenProgression');
    };

    async function renderProgression() {
        const { progressionRoutineList } = ensureRefs();
        if (!progressionRoutineList) {
            return;
        }

        const plan = await ensureActivePlan();
        const routines = await loadRoutines();
        state.plan = plan;
        state.routines = routines;

        const routineMap = new Map(routines.map((routine) => [routine.id, routine]));
        const dayCount = clampDayCount(plan.length);
        const assignedRoutineIds = [];
        const seen = new Set();
        for (let dayIndex = 1; dayIndex <= dayCount; dayIndex += 1) {
            const routineId = plan.days?.[String(dayIndex)] || null;
            if (!routineId || seen.has(routineId)) {
                continue;
            }
            const routine = routineMap.get(routineId);
            if (!routine) {
                continue;
            }
            assignedRoutineIds.push(routineId);
            seen.add(routineId);
        }

        progressionRoutineList.innerHTML = '';
        if (!assignedRoutineIds.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune routine attribuée dans ce cycle.';
            progressionRoutineList.appendChild(empty);
            return;
        }

        assignedRoutineIds.forEach((routineId) => {
            const routine = routineMap.get(routineId);
            if (!routine) {
                return;
            }
            progressionRoutineList.appendChild(renderRoutineCard(routine));
        });
    }

    function renderRoutineCard(routine) {
        const structure = listCard.createStructure({
            cardClass: 'progression-card'
        });
        const { card, body } = structure;

        const header = document.createElement('div');
        header.className = 'progression-card__header';

        const title = document.createElement('div');
        title.className = 'element progression-card__title';
        title.textContent = routine?.name || 'Routine';
        header.appendChild(title);

        const routineGoal = document.createElement('div');
        routineGoal.className = 'progression-goal-control progression-goal-control--routine';
        const routineGoalValue = getRoutineGoalPercent(routine.id);
        routineGoal.appendChild(createGoalPrefix());
        const routineInput = createGoalInput(routineGoalValue, async (value) => {
            await setRoutineGoalPercent(routine.id, value);
        });
        routineGoal.appendChild(routineInput);
        routineGoal.appendChild(createGoalSuffix());
        header.appendChild(routineGoal);

        const exercises = document.createElement('div');
        exercises.className = 'progression-exercise-list';
        const moves = Array.isArray(routine?.moves) ? [...routine.moves] : [];
        moves.sort((a, b) => (a?.pos ?? 0) - (b?.pos ?? 0));

        if (!moves.length) {
            const empty = document.createElement('div');
            empty.className = 'details progression-empty';
            empty.textContent = 'Aucun exercice dans cette routine.';
            exercises.appendChild(empty);
        } else {
            moves.forEach((move) => {
                exercises.appendChild(renderExerciseLine(routine.id, move, routineGoalValue));
            });
        }

        body.append(header, exercises);
        card.setAttribute('aria-label', routine?.name || 'Routine');

        return card;
    }

    function renderExerciseLine(routineId, move, routineGoalValue) {
        const line = document.createElement('div');
        line.className = 'progression-exercise-line list-line--compact';

        const name = document.createElement('div');
        name.className = 'progression-exercise-name';
        name.textContent = move?.exerciseName || 'Exercice';

        const goalWrapper = document.createElement('div');
        const override = getExerciseGoalPercent(routineId, move?.exerciseId);
        goalWrapper.className = 'progression-goal-control';
        goalWrapper.classList.toggle('is-inherited', override === null);
        goalWrapper.classList.toggle('is-custom', override !== null);

        const percentValue = override ?? routineGoalValue;
        goalWrapper.appendChild(createGoalPrefix());
        const input = createGoalInput(percentValue, async (value) => {
            await setExerciseGoalPercent(routineId, move?.exerciseId, value);
        });
        goalWrapper.appendChild(input);
        goalWrapper.appendChild(createGoalSuffix());

        line.append(name, goalWrapper);
        return line;
    }

    function createGoalPrefix() {
        const prefix = document.createElement('span');
        prefix.className = 'progression-goal-prefix';
        prefix.textContent = 'poids +';
        return prefix;
    }

    function createGoalSuffix() {
        const suffix = document.createElement('span');
        suffix.className = 'progression-goal-suffix';
        suffix.textContent = '%';
        return suffix;
    }

    function createGoalInput(value, onChange) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'input progression-goal-input';
        input.value = String(formatPercent(value));
        input.step = '0.1';
        input.min = '-100';
        input.max = '500';
        input.addEventListener('change', async () => {
            const next = parseGoalPercent(input.value);
            input.value = String(formatPercent(next));
            if (typeof onChange === 'function') {
                await onChange(next);
                await renderProgression();
            }
        });
        return input;
    }

    function getRoutineGoalPercent(routineId) {
        const plan = state.plan;
        if (!plan || !routineId) {
            return DEFAULT_GOAL_PERCENT;
        }
        const goals = ensureProgressionGoals(plan);
        const routineGoal = goals.routines[routineId];
        if (!routineGoal) {
            return DEFAULT_GOAL_PERCENT;
        }
        return parseGoalPercent(routineGoal.percent);
    }

    function getExerciseGoalPercent(routineId, exerciseId) {
        const plan = state.plan;
        if (!plan || !routineId || !exerciseId) {
            return null;
        }
        const goals = ensureProgressionGoals(plan);
        const routineGoal = goals.routines[routineId];
        const exerciseGoals = routineGoal?.exercises;
        if (!exerciseGoals || typeof exerciseGoals !== 'object') {
            return null;
        }
        if (!Object.prototype.hasOwnProperty.call(exerciseGoals, exerciseId)) {
            return null;
        }
        return parseGoalPercent(exerciseGoals[exerciseId]);
    }

    async function setRoutineGoalPercent(routineId, percent) {
        const plan = state.plan;
        if (!plan || !routineId) {
            return;
        }
        const goals = ensureProgressionGoals(plan);
        const routineGoal = goals.routines[routineId] || { percent: DEFAULT_GOAL_PERCENT, exercises: {} };
        routineGoal.percent = parseGoalPercent(percent);
        if (!routineGoal.exercises || typeof routineGoal.exercises !== 'object') {
            routineGoal.exercises = {};
        }
        goals.routines[routineId] = routineGoal;
        await db.put('plans', plan);
    }

    async function setExerciseGoalPercent(routineId, exerciseId, percent) {
        const plan = state.plan;
        if (!plan || !routineId || !exerciseId) {
            return;
        }
        const goals = ensureProgressionGoals(plan);
        const routineGoal = goals.routines[routineId] || { percent: DEFAULT_GOAL_PERCENT, exercises: {} };
        if (!routineGoal.exercises || typeof routineGoal.exercises !== 'object') {
            routineGoal.exercises = {};
        }
        routineGoal.exercises[exerciseId] = parseGoalPercent(percent);
        goals.routines[routineId] = routineGoal;
        await db.put('plans', plan);
    }

    function ensureProgressionGoals(plan) {
        if (!plan.progressionGoals || typeof plan.progressionGoals !== 'object') {
            plan.progressionGoals = {};
        }
        if (!plan.progressionGoals.routines || typeof plan.progressionGoals.routines !== 'object') {
            plan.progressionGoals.routines = {};
        }
        return plan.progressionGoals;
    }

    async function ensureActivePlan() {
        let plan = await db.getActivePlan();
        if (!plan) {
            plan = {
                id: 'active',
                name: 'Planning actif',
                days: {},
                length: 7,
                startDate: A.ymd(A.today()),
                active: true
            };
            await db.put('plans', plan);
        }
        let shouldPersist = false;
        if (!plan.days || typeof plan.days !== 'object') {
            plan.days = {};
            shouldPersist = true;
        }
        if (!plan.startDate) {
            plan.startDate = A.ymd(A.today());
            shouldPersist = true;
        }
        if (!plan.startDay) {
            plan.startDay = 1;
            shouldPersist = true;
        }
        if (shouldPersist) {
            await db.put('plans', plan);
        }
        return plan;
    }

    async function loadRoutines() {
        const raw = await db.getAll('routines');
        const routines = Array.isArray(raw) ? raw.slice() : [];
        return routines.sort((a, b) => {
            const nameA = (a?.name || '').toLocaleLowerCase('fr-FR');
            const nameB = (b?.name || '').toLocaleLowerCase('fr-FR');
            return nameA.localeCompare(nameB);
        });
    }

    function clampDayCount(value) {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isFinite(numeric)) {
            return 7;
        }
        return Math.min(MAX_PLAN_DAYS, Math.max(1, numeric));
    }

    function parseGoalPercent(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return DEFAULT_GOAL_PERCENT;
        }
        return numeric;
    }

    function formatPercent(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return DEFAULT_GOAL_PERCENT;
        }
        return Math.round(numeric * 10) / 10;
    }

    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenSessions = document.getElementById('screenSessions');
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenExerciseEdit = document.getElementById('screenExerciseEdit');
        refs.screenExerciseRead = document.getElementById('screenExerciseRead');
        refs.screenExecEdit = document.getElementById('screenExecEdit');
        refs.screenRoutineList = document.getElementById('screenRoutineList');
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenStatExercises = document.getElementById('screenStatExercises');
        refs.screenStatExercisesDetail = document.getElementById('screenStatExercisesDetail');
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenAdmin = document.getElementById('screenAdmin');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.screenApplication = document.getElementById('screenApplication');
        refs.screenPlanning = document.getElementById('screenPlanning');
        refs.screenProgression = document.getElementById('screenProgression');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.tabPlanning = document.getElementById('tabPlanning');
        refs.progressionRoutineList = document.getElementById('progressionRoutineList');
        refsResolved = true;
        return refs;
    }

    function wirePlanningToggle() {
        const toggleButtons = document.querySelectorAll('#screenProgression [data-planning-target]');
        toggleButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const target = button.dataset.planningTarget;
                if (target === 'cycle') {
                    void A.openPlanning?.();
                    return;
                }
                if (target === 'progression') {
                    void A.openProgression?.();
                }
            });
        });
    }

    function setPlanningToggleActive(target) {
        const toggleButtons = document.querySelectorAll('#screenProgression [data-planning-target]');
        toggleButtons.forEach((button) => {
            const isActive = button.dataset.planningTarget === target;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function highlightPlanningTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        refs.tabPlanning?.classList.add('active');
    }

    function switchScreen(target) {
        const {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineList,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatExercises,
            screenStatExercisesDetail,
            screenSettings,
            screenAdmin,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData,
            screenApplication,
            screenPlanning,
            screenProgression,
            screenFitHeroMapping
        } = ensureRefs();
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineList,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatExercises,
            screenStatExercisesDetail,
            screenSettings,
            screenAdmin,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData,
            screenApplication,
            screenPlanning,
            screenProgression,
            screenFitHeroMapping
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
        A.updateTimerUI?.();
    }
})();
