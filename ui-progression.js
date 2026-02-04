// ui-progression.js — écran Progression
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-progression: composant listCard manquant.');
    }

    const refs = {};
    let refsResolved = false;
    const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const DEFAULT_MODULE_PERCENT = 1;
    const MODULE_OPTIONS = [
        { value: 'weight', label: 'Poids' },
        { value: 'sets', label: 'Séries' },
        { value: 'rpe', label: 'RPE' }
    ];
    const MAX_PLAN_DAYS = 28;
    const state = {
        plan: null,
        routines: [],
        expandedDayIndex: null
    };

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
    });

    A.openProgression = async function openProgression() {
        ensureRefs();
        highlightPlanningTab();
        await renderProgression();
        switchScreen('screenProgression');
    };

    async function renderProgression() {
        const { progressionRoutineList, progressionGlobalModules } = ensureRefs();
        if (!progressionRoutineList || !progressionGlobalModules) {
            return;
        }

        const plan = await ensurePlanningPlan();
        if (!plan) {
            return;
        }
        const routines = await loadRoutines();
        state.plan = plan;
        state.routines = routines;

        const routineMap = new Map(routines.map((routine) => [routine.id, routine]));
        const globalModules = getGlobalModules();
        const dayCount = clampDayCount(plan.length);
        const assignedRoutineEntries = [];
        for (let dayIndex = 1; dayIndex <= dayCount; dayIndex += 1) {
            const routineId = plan.days?.[String(dayIndex)] || null;
            if (!routineId) {
                continue;
            }
            const routine = routineMap.get(routineId);
            if (!routine) {
                continue;
            }
            assignedRoutineEntries.push({ dayIndex, routineId });
        }

        progressionRoutineList.innerHTML = '';
        progressionGlobalModules.innerHTML = '';
        progressionGlobalModules.appendChild(
            renderModuleSection({
                title: 'Progression globale',
                description: 'S’applique à toutes les séances sauf surcharge.',
                modules: globalModules,
                onAdd: async () => {
                    await setGlobalModules([...globalModules, createEmptyModule()]);
                },
                onUpdate: async (nextModules) => {
                    await setGlobalModules(nextModules);
                },
                onRemove: async (index) => {
                    const nextModules = globalModules.filter((_, idx) => idx !== index);
                    await setGlobalModules(nextModules);
                }
            })
        );
        if (!assignedRoutineEntries.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune routine attribuée dans ce cycle.';
            progressionRoutineList.appendChild(empty);
            return;
        }

        assignedRoutineEntries.forEach(({ dayIndex, routineId }) => {
            const routine = routineMap.get(routineId);
            if (!routine) {
                return;
            }
            progressionRoutineList.appendChild(renderRoutineCard(routine, dayIndex, globalModules));
        });
    }

    function renderRoutineCard(routine, dayIndex, globalModules) {
        const structure = listCard.createStructure({
            cardClass: 'meso-card progression-card'
        });
        const { card, body } = structure;

        const isExpanded = state.expandedDayIndex === dayIndex;
        const detailsId = `progression-day-details-${dayIndex}`;

        const header = document.createElement('div');
        header.className = 'meso-card__header progression-card__header';

        const content = document.createElement('div');
        content.className = 'meso-card__content progression-card__content';

        const headline = document.createElement('div');
        headline.className = 'meso-card__headline progression-card__headline';

        const title = document.createElement('div');
        title.className = 'element meso-card__title progression-card__title';
        const dayName = getDayLabel(dayIndex, state.plan?.startDay);
        title.textContent = `${dayName} - ${routine?.name || 'Routine'}`;

        const routineModules = getRoutineModules(routine.id);
        const routineProgression = document.createElement('div');
        routineProgression.className = 'progression-module-summary';
        routineProgression.textContent = buildRoutineProgressionSummary(routineModules, globalModules);

        const summary = document.createElement('div');
        summary.className = 'details meso-card__summary progression-card__summary';
        summary.textContent = buildProgressionSummary(routine);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn tiny meso-card__toggle progression-card__toggle';
        toggle.textContent = isExpanded ? 'Réduire' : 'Détails';
        toggle.setAttribute('aria-expanded', String(isExpanded));
        toggle.setAttribute('aria-controls', detailsId);
        toggle.addEventListener('click', () => {
            state.expandedDayIndex = isExpanded ? null : dayIndex;
            void renderProgression();
        });

        headline.append(title, toggle);

        const meta = document.createElement('div');
        meta.className = 'progression-card__meta';
        meta.append(routineProgression, summary);

        content.append(headline, meta);
        header.appendChild(content);

        const detailsWrapper = document.createElement('div');
        detailsWrapper.className = 'meso-card__details progression-card__details';
        detailsWrapper.id = detailsId;
        detailsWrapper.hidden = !isExpanded;

        const routineModulesSection = renderModuleSection({
            title: 'Progression de la séance',
            description: routineModules === null
                ? 'Utilise la progression globale.'
                : 'Personnalisez la progression de cette séance.',
            modules: routineModules || [],
            isInherited: routineModules === null,
            onAdd: async () => {
                const base = routineModules === null ? [] : routineModules;
                await setRoutineModules(routine.id, [...base, createEmptyModule()]);
            },
            onUpdate: async (nextModules) => {
                await setRoutineModules(routine.id, nextModules);
            },
            onRemove: async (index) => {
                const nextModules = (routineModules || []).filter((_, idx) => idx !== index);
                await setRoutineModules(routine.id, nextModules);
            }
        });

        const exercises = document.createElement('div');
        exercises.className = 'progression-exercise-list';
        const exercisesTitle = document.createElement('div');
        exercisesTitle.className = 'details progression-exercise-title';
        exercisesTitle.textContent = 'Exercices';
        exercises.appendChild(exercisesTitle);
        const moves = Array.isArray(routine?.moves) ? [...routine.moves] : [];
        moves.sort((a, b) => (a?.pos ?? 0) - (b?.pos ?? 0));

        if (!moves.length) {
            const empty = document.createElement('div');
            empty.className = 'details progression-empty';
            empty.textContent = 'Aucun exercice dans cette routine.';
            exercises.appendChild(empty);
        } else {
            moves.forEach((move) => {
                exercises.appendChild(renderExerciseLine(move));
            });
        }

        detailsWrapper.append(routineModulesSection, exercises);
        body.append(header, detailsWrapper);
        const routineName = routine?.name || 'Routine';
        card.setAttribute('aria-label', `${routineName} - ${dayName}`);

        return card;
    }

    function buildProgressionSummary(routine) {
        const moves = Array.isArray(routine?.moves) ? routine.moves : [];
        const exerciseCount = moves.length;
        const exerciseLabel = exerciseCount === 1 ? 'exercice' : 'exercices';
        return `${exerciseCount} ${exerciseLabel}`;
    }

    function buildRoutineProgressionSummary(routineModules, globalModules) {
        const hasCustom = Array.isArray(routineModules);
        const count = hasCustom ? routineModules.length : globalModules.length;
        const label = count === 1 ? 'module' : 'modules';
        if (hasCustom) {
            return `Progression personnalisée · ${count} ${label}`;
        }
        return `Progression globale · ${count} ${label}`;
    }

    function renderExerciseLine(move) {
        const line = document.createElement('div');
        line.className = 'progression-exercise-line list-line--compact';

        const name = document.createElement('div');
        name.className = 'progression-exercise-name';
        name.textContent = move?.exerciseName || 'Exercice';
        line.appendChild(name);
        return line;
    }

    function renderModuleSection({
        title,
        description,
        modules,
        isInherited = false,
        onAdd,
        onUpdate,
        onRemove
    }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'progression-module-section';

        const header = document.createElement('div');
        header.className = 'progression-module-section__header';

        const heading = document.createElement('div');
        heading.className = 'element progression-module-section__title';
        heading.textContent = title;

        const desc = document.createElement('div');
        desc.className = 'details progression-module-section__description';
        desc.textContent = description;

        header.append(heading, desc);

        const list = document.createElement('div');
        list.className = 'progression-module-list';

        if (isInherited) {
            const inherited = document.createElement('div');
            inherited.className = 'details progression-module-inherited';
            inherited.textContent = 'Aucune progression personnalisée.';
            list.appendChild(inherited);
        } else if (!modules.length) {
            const empty = document.createElement('div');
            empty.className = 'details progression-module-empty';
            empty.textContent = 'Aucune progression définie.';
            list.appendChild(empty);
        }

        modules.forEach((module, index) => {
            list.appendChild(
                renderModuleRow(module, index, modules, {
                    onUpdate,
                    onRemove
                })
            );
        });

        const actions = document.createElement('div');
        actions.className = 'progression-module-actions';

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'btn small';
        addButton.textContent = 'Ajouter une progression';
        addButton.addEventListener('click', async () => {
            if (typeof onAdd === 'function') {
                await onAdd();
                await renderProgression();
            }
        });
        actions.appendChild(addButton);

        wrapper.append(header, list, actions);
        return wrapper;
    }

    function renderModuleRow(module, index, modules, { onUpdate, onRemove }) {
        const row = document.createElement('div');
        row.className = 'progression-module-row';

        const select = document.createElement('select');
        select.className = 'input progression-module-select';
        MODULE_OPTIONS.forEach((option) => {
            const item = document.createElement('option');
            item.value = option.value;
            item.textContent = option.label;
            if (option.value === module.metric) {
                item.selected = true;
            }
            select.appendChild(item);
        });

        const percentWrapper = document.createElement('div');
        percentWrapper.className = 'progression-module-percent';

        const percentInput = document.createElement('input');
        percentInput.type = 'number';
        percentInput.className = 'input progression-module-input';
        percentInput.value = String(formatPercent(module.percent));
        percentInput.step = '0.1';
        percentInput.min = '-100';
        percentInput.max = '500';

        const suffix = document.createElement('span');
        suffix.className = 'progression-module-suffix';
        suffix.textContent = '%';

        percentWrapper.append(percentInput, suffix);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn tiny progression-module-remove';
        removeButton.textContent = 'Supprimer';

        const handleChange = async () => {
            if (typeof onUpdate !== 'function') {
                return;
            }
            const nextPercent = parseGoalPercent(percentInput.value);
            percentInput.value = String(formatPercent(nextPercent));
            const nextModules = modules.map((item, idx) => {
                if (idx !== index) {
                    return item;
                }
                return {
                    metric: select.value,
                    percent: nextPercent
                };
            });
            await onUpdate(nextModules);
            await renderProgression();
        };

        select.addEventListener('change', handleChange);
        percentInput.addEventListener('change', handleChange);

        removeButton.addEventListener('click', async () => {
            if (typeof onRemove === 'function') {
                await onRemove(index);
                await renderProgression();
            }
        });

        row.append(select, percentWrapper, removeButton);
        return row;
    }

    function createEmptyModule() {
        return {
            metric: MODULE_OPTIONS[0].value,
            percent: DEFAULT_MODULE_PERCENT
        };
    }

    function getGlobalModules() {
        const plan = state.plan;
        if (!plan) {
            return [];
        }
        const modules = ensureProgressionModules(plan).global;
        return normalizeModules(modules);
    }

    function getRoutineModules(routineId) {
        const plan = state.plan;
        if (!plan || !routineId) {
            return null;
        }
        const routines = ensureProgressionModules(plan).routines;
        if (!Object.prototype.hasOwnProperty.call(routines, routineId)) {
            return null;
        }
        return normalizeModules(routines[routineId]);
    }

    async function setGlobalModules(modules) {
        const plan = state.plan;
        if (!plan) {
            return;
        }
        const progressionModules = ensureProgressionModules(plan);
        progressionModules.global = normalizeModules(modules);
        await db.put('plans', plan);
    }

    async function setRoutineModules(routineId, modules) {
        const plan = state.plan;
        if (!plan || !routineId) {
            return;
        }
        const progressionModules = ensureProgressionModules(plan);
        if (!modules || !modules.length) {
            delete progressionModules.routines[routineId];
        } else {
            progressionModules.routines[routineId] = normalizeModules(modules);
        }
        await db.put('plans', plan);
    }

    function normalizeModules(modules) {
        if (!Array.isArray(modules)) {
            return [];
        }
        return modules
            .map((module) => ({
                metric: MODULE_OPTIONS.some((option) => option.value === module?.metric)
                    ? module.metric
                    : MODULE_OPTIONS[0].value,
                percent: parseGoalPercent(module?.percent)
            }));
    }

    function ensureProgressionModules(plan) {
        if (!plan.progressionModules || typeof plan.progressionModules !== 'object') {
            plan.progressionModules = {};
        }
        if (!Array.isArray(plan.progressionModules.global)) {
            plan.progressionModules.global = [];
        }
        if (!plan.progressionModules.routines || typeof plan.progressionModules.routines !== 'object') {
            plan.progressionModules.routines = {};
        }
        return plan.progressionModules;
    }

    async function ensurePlanningPlan() {
        if (typeof A.getPlanningPlan === 'function') {
            const plan = await A.getPlanningPlan();
            if (plan) {
                return plan;
            }
        }
        return null;
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

    function getDayLabel(dayIndex, startDay) {
        const offset = Number.parseInt(startDay, 10);
        const safeOffset = Number.isFinite(offset) ? Math.min(7, Math.max(1, offset)) : 1;
        const labelIndex = (safeOffset - 1 + dayIndex - 1) % DAY_LABELS.length;
        return DAY_LABELS[labelIndex] || `Jour ${dayIndex}`;
    }

    function parseGoalPercent(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return DEFAULT_MODULE_PERCENT;
        }
        return numeric;
    }

    function formatPercent(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return DEFAULT_MODULE_PERCENT;
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
        refs.screenPlanEdit = document.getElementById('screenPlanEdit');
        refs.screenPlanCycle = document.getElementById('screenPlanCycle');
        refs.screenMeso = document.getElementById('screenMeso');
        refs.screenProgression = document.getElementById('screenProgression');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.tabPlanning = document.getElementById('tabPlanning');
        refs.progressionGlobalModules = document.getElementById('progressionGlobalModules');
        refs.progressionRoutineList = document.getElementById('progressionRoutineList');
        refs.btnProgressionBack = document.getElementById('btnProgressionBack');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const { btnProgressionBack } = ensureRefs();
        btnProgressionBack?.addEventListener('click', () => {
            const planId = state.plan?.id || A.planningState?.planId;
            const returnSection = A.planningState?.returnSection || 'plans';
            void A.openPlanEdit?.({ planId, returnSection });
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
            screenPlanEdit,
            screenPlanCycle,
            screenMeso,
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
            screenPlanEdit,
            screenPlanCycle,
            screenMeso,
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
