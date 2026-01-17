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
    const dialogState = {
        plan: null,
        selected: null,
        startDay: null
    };

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
        wirePlanningToggle();
    });

    A.openPlanning = async function openPlanning() {
        ensureRefs();
        highlightPlanningTab();
        setPlanningToggleActive('cycle');
        await renderPlanning();
        switchScreen('screenPlanning');
    };

    async function renderPlanning() {
        const { planningDaysList } = ensureRefs();
        if (!planningDaysList) {
            return;
        }

        const plan = await ensureActivePlan();
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

            const structure = listCard.createStructure({
                clickable: true,
                role: 'button',
                cardClass: 'planning-day-card'
            });
            const { card, body, end } = structure;
            card.dataset.day = dayKey;
            card.setAttribute('aria-label', `${label} — ${routineName}`);

            const title = document.createElement('div');
            title.className = 'element';
            title.textContent = label;

            const details = document.createElement('div');
            details.className = 'details';
            details.textContent = routineName;

            body.append(title, details);
            end.appendChild(listCard.createIcon('›'));

            card.addEventListener('click', () => {
                void selectRoutineForDay(dayIndex);
            });

            planningDaysList.appendChild(card);
        }
    }

    async function selectRoutineForDay(dayIndex) {
        if (typeof A.openRoutineList !== 'function') {
            return;
        }
        await A.openRoutineList({
            callerScreen: 'screenPlanning',
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
        const plan = await ensureActivePlan();
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
        await renderPlanning();
        await A.populateRoutineSelect?.();
    }

    async function handleEditDayCount() {
        const plan = await ensureActivePlan();
        dialogState.plan = plan;
        dialogState.selected = clampDayCount(plan.length);
        dialogState.startDay = clampStartDay(plan.startDay);
        renderPlanningStartDayOptions();
        updatePlanningStartDaySelection();
        renderPlanningDurationTags();
        refs.dlgPlanningDuration?.showModal();
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
        const plan = dialogState.plan || (await ensureActivePlan());
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
        await renderPlanning();
        await A.populateRoutineSelect?.();
        refs.dlgPlanningDuration?.close();
    }

    function getDayLabel(dayIndex, startDay) {
        const offset = clampStartDay(startDay) - 1;
        const labelIndex = (offset + dayIndex - 1) % DAY_LABELS.length;
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
        refs.screenProgression = document.getElementById('screenProgression');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.tabPlanning = document.getElementById('tabPlanning');
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
            btnPlanningEditDays,
            planningStartDay,
            planningDurationCancel,
            planningDurationSave
        } = ensureRefs();
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

    function wirePlanningToggle() {
        const toggleButtons = document.querySelectorAll('#screenPlanning [data-planning-target]');
        toggleButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const target = button.dataset.planningTarget;
                if (target === 'progression') {
                    void A.openProgression?.();
                    return;
                }
                if (target === 'cycle') {
                    void A.openPlanning?.();
                }
            });
        });
    }

    function setPlanningToggleActive(target) {
        const toggleButtons = document.querySelectorAll('#screenPlanning [data-planning-target]');
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
