// ui-meso.js — écran Méso du planning
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-meso: composant listCard manquant.');
    }

    const refs = {};
    let refsResolved = false;
    const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const MAX_PLAN_DAYS = 28;
    const MAX_MESO_CYCLE_COUNT = 8;
    const DEFAULT_MESO_CYCLE_COUNT = 8;
    const state = {
        plan: null,
        routines: [],
        selectedCycle: 1,
        expandedDayIndex: null
    };

    const MODIFIER_OPTIONS = [
        { value: 'reps', label: 'Reps', type: 'percent', defaultValue: 2.5, step: 0.1 },
        { value: 'weight', label: 'Poids', type: 'percent', defaultValue: 2.5, step: 0.1 },
        { value: 'rpe', label: 'RPE', type: 'absolute', defaultValue: -0.5, step: 0.5 },
        { value: 'sets', label: 'Séries', type: 'absolute', defaultValue: 1, step: 1 }
    ];

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
    });

    A.openMeso = async function openMeso() {
        ensureRefs();
        highlightPlanningTab();
        await renderMeso();
        switchScreen('screenMeso');
    };

    async function renderMeso() {
        const { mesoCycleTags, mesoCycleList } = ensureRefs();
        if (!mesoCycleTags || !mesoCycleList) {
            return;
        }

        const plan = await ensurePlanningPlan();
        if (!plan) {
            return;
        }
        const routines = await loadRoutines();
        const routineMap = new Map(routines.map((routine) => [routine.id, routine]));
        state.plan = plan;
        state.routines = routines;

        const meso = ensureMesoData(plan);
        const cycleCount = clampCycleCount(meso.cycleCount);
        meso.cycleCount = cycleCount;
        state.selectedCycle = clampCycle(meso.selectedCycle, cycleCount);
        if (meso.selectedCycle !== state.selectedCycle) {
            meso.selectedCycle = state.selectedCycle;
            await db.put('plans', plan);
        }

        renderCycleCountPicker();
        renderCycleTags();

        mesoCycleList.innerHTML = '';
        const dayCount = clampDayCount(plan.length);
        for (let dayIndex = 1; dayIndex <= dayCount; dayIndex += 1) {
            const routineId = plan.days?.[String(dayIndex)] || null;
            if (!routineId) {
                continue;
            }
            const routine = routineMap.get(routineId);
            if (!routine) {
                continue;
            }
            mesoCycleList.appendChild(renderDayCard(dayIndex, routine));
        }
    }

    function renderCycleTags() {
        const { mesoCycleTags } = refs;
        if (!mesoCycleTags) {
            return;
        }
        const cycleCount = getCycleCount();
        mesoCycleTags.style.setProperty('--tag-columns', String(cycleCount));
        mesoCycleTags.innerHTML = '';
        for (let index = 1; index <= cycleCount; index += 1) {
            const tag = document.createElement('button');
            tag.type = 'button';
            tag.className = 'tag';
            tag.textContent = `Cycle ${index}`;
            tag.dataset.value = String(index);
            const isSelected = index === state.selectedCycle;
            tag.classList.toggle('selected', isSelected);
            tag.setAttribute('aria-pressed', String(isSelected));
            tag.addEventListener('click', () => {
                void selectCycle(index);
            });
            mesoCycleTags.appendChild(tag);
        }
    }

    function renderCycleCountPicker() {
        const { mesoCycleCountButton, mesoCycleCountMenu } = refs;
        if (!mesoCycleCountButton || !mesoCycleCountMenu) {
            return;
        }
        if (!mesoCycleCountButton.dataset.wired) {
            mesoCycleCountButton.addEventListener('click', () => {
                const isOpen = mesoCycleCountMenu.classList.toggle('is-open');
                mesoCycleCountButton.setAttribute('aria-expanded', String(isOpen));
            });
            mesoCycleCountButton.dataset.wired = 'true';
        }
        const cycleCount = getCycleCount();
        mesoCycleCountMenu.innerHTML = '';
        for (let index = 1; index <= MAX_MESO_CYCLE_COUNT; index += 1) {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'meso-cycle-count-option';
            option.textContent = `${index} cycle${index > 1 ? 's' : ''}`;
            option.setAttribute('role', 'menuitemradio');
            option.setAttribute('aria-checked', String(index === cycleCount));
            option.addEventListener('click', async () => {
                await updateCycleCount(index);
                mesoCycleCountMenu.classList.remove('is-open');
                mesoCycleCountButton.setAttribute('aria-expanded', 'false');
            });
            mesoCycleCountMenu.appendChild(option);
        }
    }

    async function updateCycleCount(count) {
        const plan = state.plan || (await ensurePlanningPlan());
        if (!plan) {
            return;
        }
        const meso = ensureMesoData(plan);
        const nextCount = clampCycleCount(count);
        meso.cycleCount = nextCount;
        meso.selectedCycle = clampCycle(meso.selectedCycle, nextCount);
        await db.put('plans', plan);
        await renderMeso();
    }

    async function selectCycle(index) {
        const plan = state.plan || (await ensurePlanningPlan());
        if (!plan) {
            return;
        }
        const meso = ensureMesoData(plan);
        meso.selectedCycle = clampCycle(index, getCycleCount());
        await db.put('plans', plan);
        await renderMeso();
    }

    function renderDayCard(dayIndex, routine) {
        const structure = listCard.createStructure({
            cardClass: 'meso-card'
        });
        const { card, body } = structure;

        const isExpanded = state.expandedDayIndex === dayIndex;
        const detailsId = `meso-day-details-${state.selectedCycle}-${dayIndex}`;

        card.classList.toggle('is-expanded', isExpanded);
        card.classList.toggle('is-collapsed', !isExpanded);

        const header = document.createElement('div');
        header.className = 'meso-card__header';

        const content = document.createElement('div');
        content.className = 'meso-card__content';

        const headline = document.createElement('div');
        headline.className = 'meso-card__headline';

        const title = document.createElement('div');
        title.className = 'element meso-card__title';
        title.textContent = buildDayRoutineLabel(dayIndex, routine);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn tiny meso-card__toggle';
        toggle.textContent = isExpanded ? 'Réduire' : 'Détails';
        toggle.setAttribute('aria-expanded', String(isExpanded));
        toggle.setAttribute('aria-controls', detailsId);
        toggle.addEventListener('click', () => {
            state.expandedDayIndex = isExpanded ? null : dayIndex;
            void renderMeso();
        });

        headline.append(title, toggle);

        const summary = document.createElement('div');
        summary.className = 'details meso-card__summary';
        summary.textContent = buildModifierSummary(dayIndex);

        content.append(headline, summary);
        header.append(content);

        const detailsWrapper = document.createElement('div');
        detailsWrapper.className = 'meso-card__details';
        detailsWrapper.id = detailsId;
        detailsWrapper.hidden = !isExpanded;

        const modifiersList = renderModifiers(dayIndex);
        const modifierPicker = createModifierPicker(dayIndex);

        detailsWrapper.append(modifiersList, modifierPicker);
        body.append(header, detailsWrapper);
        card.setAttribute('aria-label', `Jour ${dayIndex} - ${routine?.name || 'Aucune routine'}`);

        return card;
    }

    function buildDayRoutineLabel(dayIndex, routine) {
        const dayLabel = getDayLabel(dayIndex, state.plan?.startDay);
        const shortDay = dayLabel.slice(0, 2);
        const routineName = routine?.name || 'Aucune routine';
        return `${shortDay} - ${routineName}`;
    }

    function buildModifierSummary(dayIndex) {
        const modifiers = getDayModifiers(dayIndex);
        if (!modifiers.length) {
            return 'Aucun modificateur';
        }
        return modifiers.map((modifier) => formatModifierLabel(modifier)).join(', ');
    }

    function createModifierPicker(dayIndex) {
        const wrapper = document.createElement('div');
        wrapper.className = 'meso-modifier-actions';

        const modifiers = getDayModifiers(dayIndex);
        const usedMetrics = new Set(modifiers.map((modifier) => modifier.metric));
        MODIFIER_OPTIONS.forEach((option) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn small';
            button.textContent = option.label;
            button.disabled = usedMetrics.has(option.value);
            button.addEventListener('click', async () => {
                await addModifierToDay(dayIndex, option.value);
            });
            wrapper.appendChild(button);
        });
        return wrapper;
    }

    function renderModifiers(dayIndex) {
        const container = document.createElement('div');
        container.className = 'meso-modifier-list';
        const modifiers = getDayModifiers(dayIndex);
        modifiers.forEach((modifier, index) => {
            const config = getMetricConfig(modifier.metric);
            const row = document.createElement('div');
            row.className = 'progression-module-row meso-modifier-row';

            const label = document.createElement('div');
            label.className = 'progression-module-label';
            label.textContent = config.label;

            const valueWrapper = document.createElement('div');
            valueWrapper.className = 'progression-module-percent';

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'input progression-module-input';
            input.value = String(formatModifierValue(modifier.metric, modifier.value));
            input.step = String(config.step);
            if (config.type === 'percent') {
                input.min = '-100';
                input.max = '500';
            }

            const suffix = document.createElement('span');
            suffix.className = 'progression-module-suffix';
            suffix.textContent = config.type === 'percent' ? '%' : '';

            valueWrapper.append(input, suffix);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn tiny meso-modifier-remove';
            remove.textContent = 'Supprimer';
            remove.addEventListener('click', async () => {
                await removeModifierFromDay(dayIndex, modifier.metric);
            });

            input.addEventListener('change', async () => {
                await updateModifierValue(dayIndex, index, modifier.metric, input.value);
            });

            row.append(label, valueWrapper, remove);
            container.appendChild(row);
        });

        if (!modifiers.length) {
            const empty = document.createElement('div');
            empty.className = 'details meso-empty';
            empty.textContent = 'Aucun modificateur appliqué.';
            container.appendChild(empty);
        }
        return container;
    }

    async function addModifierToDay(dayIndex, metric) {
        const plan = state.plan || (await ensurePlanningPlan());
        if (!plan) {
            return;
        }
        const dayData = ensureDayData(plan, state.selectedCycle, dayIndex);
        if (!dayData.modifiers.some((modifier) => modifier.metric === metric)) {
            dayData.modifiers.push(createModifier(metric));
            await db.put('plans', plan);
            await renderMeso();
        }
    }

    async function removeModifierFromDay(dayIndex, metric) {
        const plan = state.plan || (await ensurePlanningPlan());
        if (!plan) {
            return;
        }
        const dayData = ensureDayData(plan, state.selectedCycle, dayIndex);
        const next = dayData.modifiers.filter((modifier) => modifier.metric !== metric);
        dayData.modifiers = next;
        await db.put('plans', plan);
        await renderMeso();
    }

    function getDayModifiers(dayIndex) {
        if (!state.plan) {
            return [];
        }
        const meso = ensureMesoData(state.plan);
        const cycle = meso.cycles[state.selectedCycle];
        const dayKey = String(dayIndex);
        const dayData = cycle?.days?.[dayKey];
        return normalizeModifiers(dayData?.modifiers);
    }

    async function updateModifierValue(dayIndex, index, metric, value) {
        const plan = state.plan || (await ensurePlanningPlan());
        if (!plan) {
            return;
        }
        const dayData = ensureDayData(plan, state.selectedCycle, dayIndex);
        const next = normalizeModifiers(dayData.modifiers);
        if (!next[index]) {
            return;
        }
        next[index] = {
            metric,
            value: normalizeModifierValue(metric, value)
        };
        dayData.modifiers = next;
        await db.put('plans', plan);
        await renderMeso();
    }

    function normalizeModifiers(modifiers) {
        if (!Array.isArray(modifiers)) {
            return [];
        }
        return modifiers
            .map((modifier) => {
                if (!modifier || typeof modifier !== 'object') {
                    return null;
                }
                const config = getMetricConfig(modifier.metric);
                return {
                    metric: config.value,
                    value: normalizeModifierValue(config.value, modifier.value ?? modifier.percent)
                };
            })
            .filter(Boolean);
    }

    function createModifier(metric) {
        const config = getMetricConfig(metric);
        return {
            metric: config.value,
            value: config.defaultValue
        };
    }

    function getMetricConfig(metric) {
        const match = MODIFIER_OPTIONS.find((option) => option.value === metric);
        return match || MODIFIER_OPTIONS[0];
    }

    function normalizeModifierValue(metric, value) {
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

    function formatModifierValue(metric, value) {
        return normalizeModifierValue(metric, value);
    }

    function formatModifierLabel(modifier) {
        const config = getMetricConfig(modifier.metric);
        const value = normalizeModifierValue(modifier.metric, modifier.value);
        const sign = value > 0 ? '+' : '';
        const suffix = config.type === 'percent' ? '%' : '';
        return `${config.label} ${sign}${value}${suffix}`;
    }

    function getExerciseOverride(dayIndex, exerciseId) {
        if (!state.plan || !exerciseId) {
            return null;
        }
        const meso = ensureMesoData(state.plan);
        const cycle = meso.cycles[state.selectedCycle];
        const dayKey = String(dayIndex);
        const overrides = cycle?.days?.[dayKey]?.exerciseOverrides;
        if (!overrides || typeof overrides !== 'object') {
            return null;
        }
        return overrides[exerciseId] || null;
    }

    async function updateExerciseSet(dayIndex, move, setIndex, patch) {
        const plan = state.plan || (await ensurePlanningPlan());
        if (!plan) {
            return;
        }
        const dayData = ensureDayData(plan, state.selectedCycle, dayIndex);
        if (!dayData.exerciseOverrides || typeof dayData.exerciseOverrides !== 'object') {
            dayData.exerciseOverrides = {};
        }
        const exerciseId = move?.exerciseId;
        if (!exerciseId) {
            return;
        }

        const overrides = dayData.exerciseOverrides[exerciseId] || {};
        const baseSets = getEffectiveSets(dayIndex, move, overrides.sets);
        const nextSets = baseSets.map((set) => ({ ...set }));
        if (!nextSets[setIndex]) {
            nextSets[setIndex] = { reps: null, weight: null, rpe: null };
        }
        nextSets[setIndex] = { ...nextSets[setIndex], ...patch };

        dayData.exerciseOverrides[exerciseId] = { sets: nextSets };
        await db.put('plans', plan);
    }

    async function clearExerciseOverride(dayIndex, exerciseId) {
        if (!exerciseId) {
            return;
        }
        const plan = state.plan || (await ensurePlanningPlan());
        if (!plan) {
            return;
        }
        const dayData = ensureDayData(plan, state.selectedCycle, dayIndex);
        if (!dayData.exerciseOverrides || typeof dayData.exerciseOverrides !== 'object') {
            return;
        }
        delete dayData.exerciseOverrides[exerciseId];
        await db.put('plans', plan);
        await renderMeso();
    }

    function getEffectiveSets(dayIndex, move, explicitOverrides) {
        const overrides = explicitOverrides || getExerciseOverride(dayIndex, move?.exerciseId)?.sets;
        if (Array.isArray(overrides) && overrides.length) {
            return overrides.map((set) => ({
                reps: normalizeNumber(set?.reps),
                weight: normalizeNumber(set?.weight),
                rpe: normalizeNumber(set?.rpe)
            }));
        }

        const baseSets = Array.isArray(move?.sets) ? move.sets : [];
        let next = baseSets.map((set) => ({
            reps: normalizeNumber(set?.reps),
            weight: normalizeNumber(set?.weight),
            rpe: normalizeNumber(set?.rpe)
        }));

        const modifiers = getDayModifiers(dayIndex);

        const setsModifier = modifiers.find((modifier) => modifier.metric === 'sets');
        if (setsModifier) {
            const delta = normalizeModifierValue('sets', setsModifier.value);
            if (delta > 0) {
                const last = next[next.length - 1] || { reps: null, weight: null, rpe: null };
                for (let index = 0; index < delta; index += 1) {
                    next.push({ ...last });
                }
            }
            if (delta < 0) {
                next = next.slice(0, Math.max(0, next.length + delta));
            }
        }

        const repsModifier = modifiers.find((modifier) => modifier.metric === 'reps');
        const weightModifier = modifiers.find((modifier) => modifier.metric === 'weight');
        const rpeModifier = modifiers.find((modifier) => modifier.metric === 'rpe');

        next = next.map((set) => ({
            reps: repsModifier
                ? applyPercent(set.reps, normalizeModifierValue('reps', repsModifier.value))
                : set.reps,
            weight: weightModifier
                ? applyPercent(set.weight, normalizeModifierValue('weight', weightModifier.value))
                : set.weight,
            rpe: rpeModifier
                ? adjustValue(set.rpe, normalizeModifierValue('rpe', rpeModifier.value))
                : set.rpe
        }));

        return next;
    }

    function normalizeNumber(value) {
        return Number.isFinite(value) ? value : null;
    }

    function adjustValue(value, delta = 0) {
        if (!Number.isFinite(value)) {
            return value;
        }
        if (!Number.isFinite(delta) || delta === 0) {
            return value;
        }
        return Math.round((value + delta) * 10) / 10;
    }

    function applyPercent(value, percent = 0) {
        if (!Number.isFinite(value) || !Number.isFinite(percent) || percent === 0) {
            return value;
        }
        return Math.round(value * (1 + percent / 100) * 10) / 10;
    }

    function ensureDayData(plan, cycleIndex, dayIndex) {
        const meso = ensureMesoData(plan);
        const cycle = meso.cycles[cycleIndex];
        if (!cycle.days || typeof cycle.days !== 'object') {
            cycle.days = {};
        }
        const dayKey = String(dayIndex);
        if (!cycle.days[dayKey]) {
            cycle.days[dayKey] = { modifiers: [], exerciseOverrides: {} };
        }
        if (!Array.isArray(cycle.days[dayKey].modifiers)) {
            cycle.days[dayKey].modifiers = [];
        } else {
            cycle.days[dayKey].modifiers = normalizeModifiers(cycle.days[dayKey].modifiers);
        }
        if (!cycle.days[dayKey].exerciseOverrides || typeof cycle.days[dayKey].exerciseOverrides !== 'object') {
            cycle.days[dayKey].exerciseOverrides = {};
        }
        return cycle.days[dayKey];
    }

    function ensureMesoData(plan) {
        if (!plan.meso || typeof plan.meso !== 'object') {
            plan.meso = {};
        }
        if (!plan.meso.cycles || typeof plan.meso.cycles !== 'object') {
            plan.meso.cycles = {};
        }
        if (!plan.meso.selectedCycle) {
            plan.meso.selectedCycle = 1;
        }
        if (!plan.meso.cycleCount) {
            plan.meso.cycleCount = DEFAULT_MESO_CYCLE_COUNT;
        }
        for (let index = 1; index <= MAX_MESO_CYCLE_COUNT; index += 1) {
            if (!plan.meso.cycles[index]) {
                plan.meso.cycles[index] = { days: {} };
            }
        }
        return plan.meso;
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

    function clampCycle(value, maxValue = DEFAULT_MESO_CYCLE_COUNT) {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isFinite(numeric)) {
            return 1;
        }
        return Math.min(maxValue, Math.max(1, numeric));
    }

    function clampCycleCount(value) {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isFinite(numeric)) {
            return DEFAULT_MESO_CYCLE_COUNT;
        }
        return Math.min(MAX_MESO_CYCLE_COUNT, Math.max(1, numeric));
    }

    function getCycleCount() {
        if (!state.plan) {
            return DEFAULT_MESO_CYCLE_COUNT;
        }
        const meso = ensureMesoData(state.plan);
        return clampCycleCount(meso.cycleCount);
    }

    function getDayLabel(dayIndex, startDay) {
        const offset = Number.parseInt(startDay, 10);
        const safeOffset = Number.isFinite(offset) ? Math.min(7, Math.max(1, offset)) : 1;
        const labelIndex = (safeOffset - 1 + dayIndex - 1) % DAY_LABELS.length;
        return DAY_LABELS[labelIndex] || `Jour ${dayIndex}`;
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
        refs.btnMesoBack = document.getElementById('btnMesoBack');
        refs.mesoCycleCountButton = document.getElementById('mesoCycleCountButton');
        refs.mesoCycleCountMenu = document.getElementById('mesoCycleCountMenu');
        refs.mesoCycleTags = document.getElementById('mesoCycleTags');
        refs.mesoCycleList = document.getElementById('mesoCycleList');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const { btnMesoBack } = ensureRefs();
        btnMesoBack?.addEventListener('click', () => {
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
