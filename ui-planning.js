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

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
    });

    A.openPlanning = async function openPlanning() {
        ensureRefs();
        highlightSettingsTab();
        hideTimerForSettings();
        await renderPlanning();
        switchScreen('screenPlanning');
    };

    async function renderPlanning() {
        const { planningDaysList } = ensureRefs();
        if (!planningDaysList) {
            return;
        }

        const plan = await ensureActivePlan();
        const routines = await loadRoutines();
        const routineMap = new Map(routines.map((routine) => [routine.id, routine]));
        const dayCount = clampDayCount(plan.length);
        planningDaysList.innerHTML = '';

        for (let dayIndex = 1; dayIndex <= dayCount; dayIndex += 1) {
            const dayKey = String(dayIndex);
            const routineId = plan.days?.[dayKey] || null;
            const routine = routineId ? routineMap.get(routineId) : null;
            const routineName = routine?.name || 'Aucune routine';
            const label = getDayLabel(dayIndex);

            const structure = listCard.createStructure({ clickable: true, role: 'button' });
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
            onAdd: async (ids) => {
                const routineId = Array.isArray(ids) ? ids[0] : null;
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
        const current = clampDayCount(plan.length);
        const input = window.prompt('Nombre de jours dans le planning (1-7) :', String(current));
        if (input === null) {
            return;
        }
        const next = Number.parseInt(input, 10);
        if (!Number.isFinite(next) || next < 1 || next > 7) {
            alert('Veuillez entrer un nombre entre 1 et 7.');
            return;
        }

        if (next === current) {
            return;
        }

        plan.length = next;
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
    }

    async function ensureActivePlan() {
        let plan = await db.getActivePlan();
        if (!plan) {
            plan = {
                id: 'active',
                name: 'Planning actif',
                days: {},
                length: 7,
                active: true
            };
            await db.put('plans', plan);
        }
        if (!plan.days || typeof plan.days !== 'object') {
            plan.days = {};
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
        return Math.min(7, Math.max(1, numeric));
    }

    function getDayLabel(dayIndex) {
        return DAY_LABELS[dayIndex - 1] || `Jour ${dayIndex}`;
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
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.tabSettings = document.getElementById('tabSettings');
        refs.planningDaysList = document.getElementById('planningDaysList');
        refs.btnPlanningBack = document.getElementById('btnPlanningBack');
        refs.btnPlanningEditDays = document.getElementById('btnPlanningEditDays');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const { btnPlanningBack, btnPlanningEditDays } = ensureRefs();
        btnPlanningBack?.addEventListener('click', () => {
            A.openSettings?.();
        });
        btnPlanningEditDays?.addEventListener('click', () => {
            void handleEditDayCount();
        });
    }

    function highlightSettingsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        refs.tabSettings?.classList.add('active');
    }

    function hideTimerForSettings() {
        if (typeof A.setTimerVisibility === 'function') {
            A.setTimerVisibility({ forcedHidden: true, reason: 'settings' });
        }
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
            screenFitHeroMapping
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
