// ui-planning.js — écran Planning
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-planning: composant listCard manquant.');
    }

    const refs = {};
    let refsResolved = false;
    const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const MAX_PLAN_DAYS = 28;
    const PLANNING_SECTION_KEY = 'planningSection';
    const DEFAULT_PLANNING_SECTION = 'plans';
    const planningState = A.planningState || {
        section: DEFAULT_PLANNING_SECTION,
        planId: null,
        returnSection: DEFAULT_PLANNING_SECTION
    };
    A.planningState = planningState;

    const dialogState = {
        plan: null,
        selected: null,
        startDay: null
    };

    const planEditState = {
        plan: null
    };

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
        wirePlanningTabs();
    });

    A.openPlanning = async function openPlanning(options = {}) {
        ensureRefs();
        highlightPlanningTab();
        const section = options.section || planningState.section || DEFAULT_PLANNING_SECTION;
        setPlanningSection(section);
        await renderPlanningSection(section);
        switchScreen('screenPlanning');
    };

    A.openPlanEdit = async function openPlanEdit(options = {}) {
        ensureRefs();
        highlightPlanningTab();
        const { planId, returnSection } = options;
        const plan = await getPlanForEdit(planId);
        planEditState.plan = plan;
        planningState.planId = plan?.id || null;
        planningState.returnSection = returnSection || planningState.section || DEFAULT_PLANNING_SECTION;
        renderPlanEdit(plan);
        switchScreen('screenPlanEdit');
    };

    A.openPlanCycle = async function openPlanCycle() {
        ensureRefs();
        highlightPlanningTab();
        await renderPlanCycle();
        switchScreen('screenPlanCycle');
    };

    A.getPlanningPlan = async function getPlanningPlan() {
        const planId = planningState.planId;
        if (planId) {
            const plan = await db.get('plans', planId);
            if (plan) {
                return ensurePlanDefaults(plan);
            }
        }
        return ensureActivePlan();
    };

    async function renderPlanningSection(section) {
        if (section === 'routines') {
            await renderRoutinesSection();
        } else {
            await renderPlansSection();
        }
    }

    async function renderPlansSection() {
        const { planningPlansList } = ensureRefs();
        if (!planningPlansList) {
            return;
        }
        const plans = await loadPlans();
        const activePlan = await ensureActivePlan();
        planningPlansList.innerHTML = '';
        planningPlansList.appendChild(renderPlanCreateCard());

        if (activePlan) {
            planningPlansList.appendChild(renderPlanCard(activePlan, {
                label: 'Plan actuel',
                isActive: true,
                returnSection: 'plans'
            }));
        }

        const otherPlans = plans.filter((plan) => plan && plan.id !== activePlan?.id);
        otherPlans
            .sort((a, b) => (a?.name || '').localeCompare((b?.name || ''), 'fr-FR'))
            .forEach((plan) => {
                planningPlansList.appendChild(renderPlanCard(plan, { returnSection: 'plans' }));
            });
    }

    async function renderRoutinesSection() {
        const { planningRoutinesList } = ensureRefs();
        if (!planningRoutinesList) {
            return;
        }
        await renderPlanningRoutinesList();
    }

    function renderPlanCreateCard() {
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, body, end } = structure;
        card.classList.add('planning-plan-card');
        card.setAttribute('aria-label', 'Créer un nouveau plan');

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = '➕ Nouveau plan';

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = 'Créer un nouveau plan.';

        body.append(title, details);
        end.appendChild(listCard.createIcon('›'));

        card.addEventListener('click', () => {
            void handleCreatePlan();
        });

        return card;
    }

    async function renderPlanCycle() {
        const { planningDaysList } = ensureRefs();
        if (!planningDaysList) {
            return;
        }

        const plan = await A.getPlanningPlan();
        const startDay = clampStartDay(plan.startDay);
        const routines = await loadRoutines();
        const routineMap = new Map(routines.map((routine) => [routine.id, routine]));
        const dayCount = clampDayCount(plan.length);
        planningDaysList.innerHTML = '';
        const columns = Math.max(1, Math.ceil(dayCount / 7));
        planningDaysList.style.setProperty('--planning-columns', columns);

        for (let dayIndex = 1; dayIndex <= dayCount; dayIndex += 1) {
            const dayKey = String(dayIndex);
            const routineId = plan.days?.[dayKey] || null;
            const routine = routineId ? routineMap.get(routineId) : null;
            const routineName = routine?.name || 'Repos';
            const label = getDayLabel(dayIndex, startDay);
            const hasRoutine = Boolean(routineId);

            const structure = listCard.createStructure({
                clickable: true,
                role: 'button',
                cardClass: 'planning-day-card'
            });
            const { card, body, end } = structure;
            card.dataset.day = dayKey;
            card.classList.toggle('selected', hasRoutine);
            card.setAttribute('aria-label', `${label} — ${routineName}`);

            const title = document.createElement('div');
            title.className = 'element';
            title.textContent = label;

            const details = document.createElement('div');
            details.className = 'details';
            details.textContent = routineName;

            body.append(title, details);
            const endIcon = hasRoutine ? '✓' : '›';
            end.appendChild(listCard.createIcon(endIcon));

            card.addEventListener('click', () => {
                void selectRoutineForDay(dayIndex);
            });

            planningDaysList.appendChild(card);
        }
    }

    function renderPlanCard(plan, options = {}) {
        const { label, isActive = false, returnSection = 'plans' } = options;
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, body, end } = structure;
        card.classList.add('planning-plan-card');
        card.classList.toggle('is-active', isActive);
        card.setAttribute('aria-label', plan?.name || 'Plan');

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = plan?.name || 'Plan sans nom';

        const details = document.createElement('div');
        details.className = 'details';
        const planSummary = buildPlanCycleDetails(plan);
        if (label) {
            details.textContent = `${label} · ${planSummary}`;
        } else {
            details.textContent = planSummary;
        }

        body.append(title, details);
        const icon = listCard.createIcon(isActive ? '✓' : '›');
        end.appendChild(icon);

        card.addEventListener('click', () => {
            if (plan?.id) {
                void A.openPlanEdit({ planId: plan.id, returnSection });
            }
        });

        return card;
    }

    async function renderPlanningRoutinesList() {
        const { planningRoutinesList } = ensureRefs();
        if (!planningRoutinesList) {
            return;
        }
        planningRoutinesList.innerHTML = '';
        planningRoutinesList.appendChild(renderPlanningRoutineCreateCard());
        const routines = await loadRoutines();
        if (!routines.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune routine enregistrée.';
            planningRoutinesList.appendChild(empty);
            return;
        }
        routines.forEach((routine) => {
            planningRoutinesList.appendChild(renderPlanningRoutineCard(routine));
        });
    }

    function renderPlanningRoutineCreateCard() {
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, body, end } = structure;
        card.classList.add('planning-routine-create');
        card.setAttribute('aria-label', 'Créer une routine');

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = '+ Créer routine';

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = 'Ajouter une nouvelle routine.';

        body.append(title, details);
        end.appendChild(listCard.createIcon('+'));

        card.addEventListener('click', () => {
            const routineId = createRoutineId();
            void A.openRoutineEdit?.({ routineId, callerScreen: 'screenPlanning' });
        });

        return card;
    }

    function renderPlanningRoutineCard(routine) {
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, body, end } = structure;
        const routineName = routine?.name || 'Routine';
        card.setAttribute('aria-label', `${routineName} — éditer`);

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = routineName;

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = buildRoutineDetails(routine);

        body.append(title, details);
        end.appendChild(listCard.createIcon('›'));

        card.addEventListener('click', () => {
            if (!routine?.id) {
                return;
            }
            void A.openRoutineEdit?.({ routineId: routine.id, callerScreen: 'screenPlanning' });
        });

        return card;
    }

    function buildRoutineDetails(routine) {
        const moves = Array.isArray(routine?.moves) ? routine.moves : [];
        if (!moves.length) {
            return 'Aucun exercice.';
        }
        const exerciseCount = moves.length;
        const setCounts = moves.map((move) => (Array.isArray(move?.sets) ? move.sets.length : 0));
        const minSets = Math.min(...setCounts);
        const maxSets = Math.max(...setCounts);
        const totalReps = moves.reduce((total, move) => {
            const sets = Array.isArray(move?.sets) ? move.sets : [];
            return (
                total +
                sets.reduce((subtotal, set) => {
                    const repsValue = Number.parseInt(set?.reps, 10);
                    return Number.isFinite(repsValue) ? subtotal + repsValue : subtotal;
                }, 0)
            );
        }, 0);
        const totalSets = setCounts.reduce((total, value) => total + value, 0);
        const averageReps = totalSets ? Math.round(totalReps / totalSets) : 0;
        const exerciseLabel = exerciseCount > 1 ? 'exercices' : 'exercice';
        const setsLabel = minSets === maxSets ? `${minSets}` : `${minSets}-${maxSets}`;
        const seriesLabel = minSets === 1 && maxSets === 1 ? 'série' : 'séries';
        return `${exerciseCount} ${exerciseLabel} x ${setsLabel} ${seriesLabel} x ${averageReps} reps`;
    }

    async function selectRoutineForDay(dayIndex) {
        if (typeof A.openRoutineList !== 'function') {
            return;
        }
        await A.openRoutineList({
            callerScreen: 'screenPlanCycle',
            mode: 'add',
            autoAdd: true,
            includeNone: true,
            onAdd: async (ids) => {
                const routineId = Array.isArray(ids) ? ids[0] : ids;
                await assignRoutineToDay(dayIndex, routineId || null);
            }
        });
    }

    async function assignRoutineToDay(dayIndex, routineId) {
        const plan = await A.getPlanningPlan();
        const dayKey = String(dayIndex);
        if (!plan.days || typeof plan.days !== 'object') {
            plan.days = {};
        }
        if (routineId) {
            plan.days[dayKey] = routineId;
        } else {
            delete plan.days[dayKey];
        }
        await db.put('plans', plan);
        await renderPlanCycle();
        await A.populateRoutineSelect?.();
    }

    async function handleEditDayCount() {
        const plan = await A.getPlanningPlan();
        dialogState.plan = plan;
        dialogState.selected = clampDayCount(plan.length);
        dialogState.startDay = clampStartDay(plan.startDay);
        renderPlanningStartDayOptions();
        updatePlanningStartDaySelection();
        renderPlanningDurationTags();
        refs.dlgPlanningDuration?.showModal();
    }

    async function handleCreatePlan() {
        const plan = await createEmptyPlan();
        await db.put('plans', plan);
        await A.openPlanEdit({ planId: plan.id, returnSection: 'plans' });
    }

    async function handleDuplicatePlan() {
        const plan = planEditState.plan;
        if (!plan) {
            return;
        }
        const cloned = JSON.parse(JSON.stringify(plan));
        const next = {
            ...cloned,
            id: createPlanId(),
            name: `Copie de ${plan.name || 'Plan'}`,
            active: false
        };
        await db.put('plans', next);
        await A.openPlanEdit({ planId: next.id, returnSection: planningState.returnSection });
    }

    async function handleApplyPlan() {
        const plan = planEditState.plan;
        if (!plan?.id) {
            return;
        }
        const plans = await loadPlans();
        await Promise.all(
            plans.map(async (item) => {
                const next = { ...item, active: item.id === plan.id };
                await db.put('plans', next);
                if (next.id === plan.id) {
                    planEditState.plan = next;
                }
            })
        );
        renderPlanEdit(planEditState.plan);
        await renderPlansSection();
        await renderRoutinesSection();
    }

    function renderPlanEdit(plan) {
        const {
            planEditName,
            planEditComment,
            btnPlanApply,
            planEditCycleDetails,
            planEditMesoDetails,
            planEditProgressionDetails
        } = ensureRefs();
        if (!planEditName || !planEditComment) {
            return;
        }
        planEditName.value = plan?.name || '';
        planEditComment.value = plan?.comment || '';
        if (btnPlanApply) {
            const isActive = Boolean(plan?.active);
            btnPlanApply.disabled = isActive;
            btnPlanApply.textContent = isActive ? '✅ Plan actuel' : '✅ Appliquer ce plan';
        }
        if (planEditCycleDetails) {
            planEditCycleDetails.textContent = buildPlanCycleDetails(plan);
        }
        if (planEditMesoDetails) {
            planEditMesoDetails.textContent = buildMesoSummary(plan);
        }
        if (planEditProgressionDetails) {
            planEditProgressionDetails.textContent = buildProgressionSummary(plan);
        }
    }

    async function persistPlanField(field, value) {
        const plan = planEditState.plan;
        if (!plan) {
            return;
        }
        plan[field] = value;
        await db.put('plans', plan);
        if (planningState.section === 'plans') {
            await renderPlansSection();
        }
        if (planningState.section === 'routines') {
            await renderRoutinesSection();
        }
    }

    async function getPlanForEdit(planId) {
        if (planId) {
            const plan = await db.get('plans', planId);
            if (plan) {
                return ensurePlanDefaults(plan);
            }
        }
        return ensureActivePlan();
    }

    async function ensureActivePlan() {
        let plan = await db.getActivePlan();
        if (!plan) {
            plan = await createEmptyPlan();
            plan.active = true;
            await db.put('plans', plan);
        }
        return ensurePlanDefaults(plan);
    }

    function ensurePlanDefaults(plan) {
        let shouldPersist = false;
        if (!plan.id) {
            plan.id = createPlanId();
            shouldPersist = true;
        }
        if (!plan.name) {
            plan.name = 'Plan sans nom';
            shouldPersist = true;
        }
        if (!plan.comment) {
            plan.comment = '';
            shouldPersist = true;
        }
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
        if (!Number.isFinite(Number.parseInt(plan.length, 10))) {
            plan.length = 7;
            shouldPersist = true;
        }
        if (shouldPersist) {
            void db.put('plans', plan);
        }
        return plan;
    }

    function buildPlanCycleDetails(plan) {
        const dayCount = clampDayCount(plan?.length);
        const sessionCount = countPlanSessions(plan, dayCount);
        const sessionLabel = sessionCount > 1 ? 'séances' : 'séance';
        const dayLabel = dayCount > 1 ? 'jours' : 'jour';
        return `${sessionCount} ${sessionLabel} sur ${dayCount} ${dayLabel}`;
    }

    function countPlanSessions(plan, dayCount) {
        const totalDays = Number.isFinite(dayCount) ? dayCount : clampDayCount(plan?.length);
        let count = 0;
        for (let dayIndex = 1; dayIndex <= totalDays; dayIndex += 1) {
            const routineId = plan?.days?.[String(dayIndex)];
            if (routineId) {
                count += 1;
            }
        }
        return count;
    }

    function buildMesoSummary(plan) {
        const cycleCount = clampMesoCycleCount(plan?.meso?.cycleCount);
        const label = cycleCount > 1 ? 'cycles' : 'cycle';
        return `${cycleCount} ${label}`;
    }

    function buildProgressionSummary(plan) {
        const percent = getProgressionPercent(plan);
        const formatted = formatPercentFr(percent);
        return `+ ${formatted}% de poids`;
    }

    function getProgressionPercent(plan) {
        const routineGoals = plan?.progressionGoals?.routines || {};
        const percents = Object.values(routineGoals)
            .map((goal) => Number.parseFloat(goal?.percent))
            .filter((value) => Number.isFinite(value));
        if (!percents.length) {
            return 2.5;
        }
        const total = percents.reduce((sum, value) => sum + value, 0);
        return total / percents.length;
    }

    function formatPercentFr(value) {
        const numeric = Number.isFinite(value) ? value : 0;
        const hasDecimal = Math.abs(numeric % 1) > Number.EPSILON;
        return numeric.toLocaleString('fr-FR', {
            minimumFractionDigits: hasDecimal ? 1 : 0,
            maximumFractionDigits: 1
        });
    }

    async function loadPlans() {
        const raw = await db.getAll('plans');
        return Array.isArray(raw) ? raw.slice() : [];
    }

    async function createEmptyPlan() {
        const plans = await loadPlans();
        const nextNumber = getNextPlanNumber(plans);
        return {
            id: createPlanId(),
            name: `Plan ${nextNumber}`,
            comment: '',
            days: {},
            length: 7,
            startDate: A.ymd(A.today()),
            startDay: 1,
            active: false
        };
    }

    function getNextPlanNumber(plans) {
        const used = new Set(
            plans
                .map((plan) => {
                    const match = String(plan?.name || '').match(/Plan\s+(\d+)/i);
                    return match ? Number.parseInt(match[1], 10) : null;
                })
                .filter((value) => Number.isFinite(value))
        );
        let next = 1;
        while (used.has(next)) {
            next += 1;
        }
        return next;
    }

    function createPlanId() {
        return `plan-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
    }

    function createRoutineId() {
        return `routine-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
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

    function clampMesoCycleCount(value) {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isFinite(numeric)) {
            return 8;
        }
        return Math.min(8, Math.max(1, numeric));
    }

    function clampStartDay(value) {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isFinite(numeric)) {
            return 1;
        }
        return Math.min(7, Math.max(1, numeric));
    }

    function renderPlanningStartDayOptions() {
        const { planningStartDay } = ensureRefs();
        if (!planningStartDay) {
            return;
        }
        if (planningStartDay.options.length === DAY_LABELS.length) {
            return;
        }
        planningStartDay.innerHTML = '';
        DAY_LABELS.forEach((label, index) => {
            const option = document.createElement('option');
            option.value = String(index + 1);
            option.textContent = label;
            planningStartDay.appendChild(option);
        });
    }

    function updatePlanningStartDaySelection() {
        const { planningStartDay } = refs;
        if (!planningStartDay) {
            return;
        }
        const nextValue = clampStartDay(dialogState.startDay);
        planningStartDay.value = String(nextValue);
    }

    function renderPlanningDurationTags() {
        const { planningDurationTags } = ensureRefs();
        if (!planningDurationTags) {
            return;
        }
        planningDurationTags.innerHTML = '';
        for (let index = 1; index <= MAX_PLAN_DAYS; index += 1) {
            const tag = document.createElement('button');
            tag.type = 'button';
            tag.className = 'tag';
            tag.textContent = String(index);
            tag.dataset.value = String(index);
            const isSelected = dialogState.selected === index;
            tag.classList.toggle('selected', isSelected);
            tag.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            tag.addEventListener('click', () => {
                dialogState.selected = index;
                updatePlanningDurationSelection();
            });
            planningDurationTags.appendChild(tag);
        }
    }

    function updatePlanningDurationSelection() {
        const { planningDurationTags } = refs;
        if (!planningDurationTags) {
            return;
        }
        const tags = planningDurationTags.querySelectorAll('.tag');
        tags.forEach((tag) => {
            const value = Number.parseInt(tag.dataset.value, 10);
            const isSelected = value === dialogState.selected;
            tag.classList.toggle('selected', isSelected);
            tag.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }

    async function savePlanningDuration() {
        const plan = dialogState.plan || (await A.getPlanningPlan());
        const next = clampDayCount(dialogState.selected);
        const current = clampDayCount(plan.length);
        const nextStartDay = clampStartDay(dialogState.startDay ?? plan.startDay);
        const currentStartDay = clampStartDay(plan.startDay);
        if (next === current && nextStartDay === currentStartDay) {
            refs.dlgPlanningDuration?.close();
            return;
        }
        plan.length = next;
        plan.startDay = nextStartDay;
        if (!plan.days || typeof plan.days !== 'object') {
            plan.days = {};
        }
        Object.keys(plan.days).forEach((key) => {
            const numeric = Number.parseInt(key, 10);
            if (Number.isFinite(numeric) && numeric > next) {
                delete plan.days[key];
            }
        });
        await db.put('plans', plan);
        await renderPlanCycle();
        await A.populateRoutineSelect?.();
        refs.dlgPlanningDuration?.close();
    }

    function getDayLabel(dayIndex, startDay) {
        const offset = clampStartDay(startDay) - 1;
        const labelIndex = (offset + dayIndex - 1) % DAY_LABELS.length;
        return DAY_LABELS[labelIndex] || `Jour ${dayIndex}`;
    }

    function setPlanningSection(section) {
        const nextSection = section === 'routines' ? 'routines' : 'plans';
        planningState.section = nextSection;
        localStorage.setItem(PLANNING_SECTION_KEY, nextSection);
        updatePlanningTabs(nextSection);
    }

    function updatePlanningTabs(section) {
        const toggleButtons = document.querySelectorAll('#screenPlanning [data-planning-section]');
        toggleButtons.forEach((button) => {
            const isActive = button.dataset.planningSection === section;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
        const plansSection = refs.planningPlansSection;
        const routinesSection = refs.planningRoutinesSection;
        if (plansSection) {
            plansSection.hidden = section !== 'plans';
        }
        if (routinesSection) {
            routinesSection.hidden = section !== 'routines';
        }
    }

    function wirePlanningTabs() {
        const toggleButtons = document.querySelectorAll('#screenPlanning [data-planning-section]');
        if (!toggleButtons.length) {
            return;
        }
        const stored = localStorage.getItem(PLANNING_SECTION_KEY);
        if (stored) {
            planningState.section = stored;
        }
        toggleButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const target = button.dataset.planningSection;
                setPlanningSection(target);
                void renderPlanningSection(target);
            });
        });
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
        refs.planningPlansList = document.getElementById('planningPlansList');
        refs.planningPlansSection = document.getElementById('planningPlansSection');
        refs.planningRoutinesSection = document.getElementById('planningRoutinesSection');
        refs.planningRoutinesList = document.getElementById('planningRoutinesList');
        refs.btnPlanEditBack = document.getElementById('btnPlanEditBack');
        refs.planEditName = document.getElementById('planEditName');
        refs.planEditComment = document.getElementById('planEditComment');
        refs.btnPlanApply = document.getElementById('btnPlanApply');
        refs.btnPlanDuplicate = document.getElementById('btnPlanDuplicate');
        refs.btnPlanEditCycle = document.getElementById('btnPlanEditCycle');
        refs.btnPlanEditMeso = document.getElementById('btnPlanEditMeso');
        refs.btnPlanEditProgression = document.getElementById('btnPlanEditProgression');
        refs.planEditCycleDetails = document.getElementById('planEditCycleDetails');
        refs.planEditMesoDetails = document.getElementById('planEditMesoDetails');
        refs.planEditProgressionDetails = document.getElementById('planEditProgressionDetails');
        refs.btnPlanCycleBack = document.getElementById('btnPlanCycleBack');
        refs.planningDaysList = document.getElementById('planningDaysList');
        refs.btnPlanningEditDays = document.getElementById('btnPlanningEditDays');
        refs.dlgPlanningDuration = document.getElementById('dlgPlanningDuration');
        refs.planningDurationTags = document.getElementById('planningDurationTags');
        refs.planningStartDay = document.getElementById('planningStartDay');
        refs.planningDurationCancel = document.getElementById('planningDurationCancel');
        refs.planningDurationSave = document.getElementById('planningDurationSave');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const {
            btnPlanEditBack,
            planEditName,
            planEditComment,
            btnPlanApply,
            btnPlanDuplicate,
            btnPlanEditCycle,
            btnPlanEditMeso,
            btnPlanEditProgression,
            btnPlanCycleBack,
            btnPlanningEditDays,
            planningStartDay,
            planningDurationCancel,
            planningDurationSave
        } = ensureRefs();

        btnPlanEditBack?.addEventListener('click', () => {
            void A.openPlanning({ section: planningState.returnSection || 'plans' });
        });

        planEditName?.addEventListener('input', (event) => {
            const value = event.target?.value || '';
            void persistPlanField('name', value.trim());
        });

        planEditComment?.addEventListener('input', (event) => {
            const value = event.target?.value || '';
            void persistPlanField('comment', value.trim());
        });

        btnPlanApply?.addEventListener('click', () => {
            void handleApplyPlan();
        });

        btnPlanDuplicate?.addEventListener('click', () => {
            void handleDuplicatePlan();
        });

        btnPlanEditCycle?.addEventListener('click', () => {
            void A.openPlanCycle();
        });

        btnPlanEditMeso?.addEventListener('click', () => {
            void A.openMeso?.();
        });

        btnPlanEditProgression?.addEventListener('click', () => {
            void A.openProgression?.();
        });

        btnPlanCycleBack?.addEventListener('click', () => {
            void A.openPlanEdit({ planId: planningState.planId, returnSection: planningState.returnSection });
        });

        btnPlanningEditDays?.addEventListener('click', () => {
            void handleEditDayCount();
        });

        planningStartDay?.addEventListener('change', (event) => {
            const value = event.target?.value;
            dialogState.startDay = clampStartDay(value);
            updatePlanningStartDaySelection();
        });

        planningDurationCancel?.addEventListener('click', () => {
            refs.dlgPlanningDuration?.close();
        });

        planningDurationSave?.addEventListener('click', () => {
            void savePlanningDuration();
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
