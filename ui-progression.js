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
    const MODULE_OPTIONS = [
        { value: 'reps', label: 'Reps', type: 'percent', defaultValue: 0 },
        { value: 'weight', label: 'Poids', type: 'percent', defaultValue: 0 },
        { value: 'rpe', label: 'RPE', type: 'absolute', defaultValue: 0 },
        { value: 'sets', label: 'Séries', type: 'absolute', defaultValue: 0 }
    ];
    const ABSOLUTE_VALUES = [-3, -2, -1, 0, 1, 2, 3];
    const PERCENT_VALUES = [-10, -5, -2.5, 0, 2.5, 5, 10];
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
                baseModules: globalModules,
                onUpdate: async (nextModules) => {
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
            baseModules: routineModules === null ? globalModules : routineModules,
            isInherited: routineModules === null,
            onUpdate: async (nextModules) => {
                await setRoutineModules(routine.id, nextModules);
            }
        });

        detailsWrapper.append(routineModulesSection);
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
        const count = hasCustom
            ? countActiveModules(routineModules)
            : countActiveModules(globalModules);
        const label = count === 1 ? 'module' : 'modules';
        if (hasCustom) {
            return `Progression personnalisée · ${count} ${label}`;
        }
        return `Progression globale · ${count} ${label}`;
    }

    function countActiveModules(modules) {
        const map = buildModuleValueMap(modules);
        return MODULE_OPTIONS.reduce((total, option) => {
            const value = map.get(option.value) ?? 0;
            return total + (value === 0 ? 0 : 1);
        }, 0);
    }

    function renderModuleSection({
        title,
        description,
        modules,
        baseModules,
        isInherited = false,
        onUpdate
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
            inherited.textContent = 'Utilise la progression globale.';
            list.appendChild(inherited);
        }

        const controls = renderModuleControls({
            modules,
            baseModules,
            onUpdate
        });

        wrapper.append(header, list, controls);
        return wrapper;
    }

    function renderModuleControls({ modules, baseModules, onUpdate }) {
        const controls = document.createElement('div');
        controls.className = 'metric-control-row';
        const valueMap = buildModuleValueMap(baseModules ?? modules);
        MODULE_OPTIONS.forEach((option) => {
            controls.appendChild(
                createMetricControl({
                    label: option.label,
                    metric: option.value,
                    type: option.type,
                    value: valueMap.get(option.value) ?? 0,
                    onSelect: async (nextValue) => {
                        if (typeof onUpdate !== 'function') {
                            return;
                        }
                        const nextMap = buildModuleValueMap(baseModules ?? modules);
                        nextMap.set(option.value, normalizeMetricValue(option.value, nextValue));
                        await onUpdate(moduleMapToArray(nextMap));
                        await renderProgression();
                    }
                })
            );
        });
        return controls;
    }

    function createMetricControl({ label, metric, type, value, onSelect }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'metric-control';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn small metric-control-button';
        button.textContent = `${label} ${formatMetricDisplay(metric, value)}`;

        const menu = document.createElement('div');
        menu.className = 'metric-control-menu';

        const options = type === 'percent' ? PERCENT_VALUES : ABSOLUTE_VALUES;
        options.forEach((optionValue) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'metric-control-option';
            option.textContent = formatMetricDisplay(metric, optionValue);
            option.addEventListener('click', async () => {
                menu.classList.remove('is-open');
                if (typeof onSelect === 'function') {
                    await onSelect(optionValue);
                }
            });
            menu.appendChild(option);
        });

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const shouldOpen = !menu.classList.contains('is-open');
            wrapper.parentElement?.querySelectorAll('.metric-control-menu').forEach((item) => {
                item.classList.remove('is-open');
            });
            if (shouldOpen) {
                menu.classList.add('is-open');
            }
        });

        wrapper.append(button, menu);
        return wrapper;
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
            .map((module) => {
                const metric = MODULE_OPTIONS.some((option) => option.value === module?.metric)
                    ? module.metric
                    : MODULE_OPTIONS[0].value;
                return {
                    metric,
                    value: normalizeMetricValue(metric, module?.value ?? module?.percent)
                };
            });
    }

    function buildModuleValueMap(modules) {
        const map = new Map();
        MODULE_OPTIONS.forEach((option) => {
            map.set(option.value, option.defaultValue);
        });
        normalizeModules(modules).forEach((module) => {
            map.set(module.metric, normalizeMetricValue(module.metric, module.value));
        });
        return map;
    }

    function moduleMapToArray(map) {
        return MODULE_OPTIONS.map((option) => ({
            metric: option.value,
            value: normalizeMetricValue(option.value, map.get(option.value))
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

    function getMetricConfig(metric) {
        const match = MODULE_OPTIONS.find((option) => option.value === metric);
        return match || MODULE_OPTIONS[0];
    }

    function normalizeMetricValue(metric, value) {
        const config = getMetricConfig(metric);
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return config.defaultValue;
        }
        if (metric === 'sets') {
            return Math.round(numeric);
        }
        return Math.round(numeric * 10) / 10;
    }

    function formatMetricDisplay(metric, value) {
        const config = getMetricConfig(metric);
        const numeric = normalizeMetricValue(metric, value);
        if (numeric === 0) {
            return '-';
        }
        const sign = numeric > 0 ? '+' : '';
        const suffix = config.type === 'percent' ? '%' : '';
        return `${sign}${numeric}${suffix}`;
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
