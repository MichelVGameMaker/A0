// ui-routines-list.js — liste des routines
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-routines-list: composant listCard manquant.');
    }

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        routines: [],
        active: false,
        callerScreen: 'screenSettings',
        listMode: 'view',
        selection: new Set(),
        onAddCallback: null,
        autoAdd: false,
        includeNone: false,
        filtersInited: false,
        filters: {
            search: '',
            group: '',
            type: ''
        }
    };
    const routineListScrollState = {
        top: 0,
        pendingRestore: false
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireCreateButton();
        wireBackButton();
        wireFilters();
        wireValueStates();
    });

    /* ACTIONS */
    A.openRoutineList = async function openRoutineList(options = {}) {
        const {
            callerScreen = 'screenSettings',
            mode = 'view',
            onAdd = null,
            autoAdd = false,
            includeNone = false,
            preselectedIds = []
        } = options;
        ensureRefs();
        state.listMode = mode === 'add' ? 'add' : 'view';
        state.onAddCallback = typeof onAdd === 'function' ? onAdd : null;
        state.autoAdd = Boolean(autoAdd);
        state.includeNone = Boolean(includeNone);
        state.selection.clear();
        const normalizedPreselected = Array.isArray(preselectedIds) ? preselectedIds.filter(Boolean) : [];
        state.callerScreen = callerScreen;
        highlightCallerTab(callerScreen);
        await loadRoutines(true);
        if (state.listMode === 'add' && !state.autoAdd && normalizedPreselected.length) {
            const available = new Set(state.routines.map((routine) => routine?.id).filter(Boolean));
            normalizedPreselected.forEach((id) => {
                if (available.has(id)) {
                    state.selection.add(id);
                }
            });
        }
        initializeFilters();
        applyFilterStateToInputs();
        await renderList();
        ensureSelectionBar();
        updateSelectionBar();
        switchScreen('screenRoutineList');
    };

    A.refreshRoutineList = async function refreshRoutineList() {
        ensureRefs();
        await loadRoutines(true);
        state.active = refs.screenRoutineList ? !refs.screenRoutineList.hidden : state.active;
        if (state.active) {
            await renderList();
        }
    };

    /* UTILS */
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
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.screenPlanning = document.getElementById('screenPlanning');
        refs.screenPlanningRoutines = document.getElementById('screenPlanningRoutines');
        refs.screenPlanEdit = document.getElementById('screenPlanEdit');
        refs.screenPlanCycle = document.getElementById('screenPlanCycle');
        refs.screenMeso = document.getElementById('screenMeso');
        refs.screenProgression = document.getElementById('screenProgression');
        refs.routineCatalog = document.getElementById('routineCatalog');
        refs.btnRoutineCreate = document.getElementById('btnRoutineCreate');
        refs.tabPlanning = document.getElementById('tabPlanning');
        refs.routineListBack = document.getElementById('routineListBack');
        refs.routineSearch = document.getElementById('routineSearch');
        refs.routineFilterGroup = document.getElementById('routineFilterGroup');
        refs.routineFilterType = document.getElementById('routineFilterType');
        refs.content = document.querySelector('#screenRoutineList .content');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = ['screenRoutineList', 'routineCatalog', 'routineListBack'];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routines-list.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function getRoutineListScrollContainer() {
        const { content, screenRoutineList } = ensureRefs();
        if (content) {
            return content;
        }
        const container = screenRoutineList?.querySelector('.content') || null;
        refs.content = container;
        return container;
    }

    function storeRoutineListScroll() {
        const container = getRoutineListScrollContainer();
        if (!container) {
            return;
        }
        routineListScrollState.top = container.scrollTop || 0;
        routineListScrollState.pendingRestore = true;
    }

    function restoreRoutineListScroll() {
        if (!routineListScrollState.pendingRestore) {
            return;
        }
        const container = getRoutineListScrollContainer();
        if (!container) {
            return;
        }
        container.scrollTop = routineListScrollState.top;
        routineListScrollState.pendingRestore = false;
    }

    A.storeRoutineListScroll = () => storeRoutineListScroll();
    A.restoreRoutineListScroll = () => restoreRoutineListScroll();

    function wireCreateButton() {
        const { btnRoutineCreate } = ensureRefs();
        if (!btnRoutineCreate) {
            return;
        }
        btnRoutineCreate.addEventListener('click', () => {
            const id = createRoutineId();
            highlightCallerTab(state.callerScreen);
            storeRoutineListScroll();
            A.openRoutineEdit({ routineId: id, callerScreen: state.callerScreen });
        });
    }

    function wireBackButton() {
        const { routineListBack } = assertRefs();
        routineListBack.addEventListener('click', () => {
            returnToCaller();
        });
    }

    async function loadRoutines(force = false) {
        if (!force && state.routines.length) {
            return state.routines;
        }
        const raw = await db.getAll('routines');
        state.routines = Array.isArray(raw) ? raw.slice() : [];
        return state.routines;
    }

    async function renderList() {
        const { routineCatalog } = assertRefs();
        routineCatalog.innerHTML = '';
        if (state.listMode === 'add' && state.includeNone) {
            routineCatalog.appendChild(renderNoneCard());
        }
        const filtered = await getFilteredRoutines();
        if (!filtered.length) {
            if (state.listMode === 'add' && state.includeNone) {
                updateSelectionBar();
                restoreRoutineListScroll();
                return;
            }
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune routine.';
            routineCatalog.appendChild(empty);
            restoreRoutineListScroll();
            return;
        }
        const sorted = [...filtered].sort((a, b) => {
            const nameA = (a?.name || '').toLocaleLowerCase('fr-FR');
            const nameB = (b?.name || '').toLocaleLowerCase('fr-FR');
            return nameA.localeCompare(nameB);
        });
        sorted.forEach((routine) => {
            routineCatalog.appendChild(renderRoutineCard(routine));
        });
        restoreRoutineListScroll();
        updateSelectionBar();
    }

    function initializeFilters() {
        if (state.filtersInited) {
            return;
        }
        const { routineFilterGroup, routineFilterType } = assertRefs();
        fillSelect(routineFilterGroup, CFG.musclesG2, 'Groupe musculaire');
        const trainingTypes = ['Hypertrophie', 'Force', 'Volume', 'Salle', 'Maison'];
        routineFilterType.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = "Type d'entraînement";
        routineFilterType.appendChild(placeholder);
        trainingTypes.forEach((label) => {
            const option = document.createElement('option');
            option.value = label.toLowerCase();
            option.textContent = label;
            routineFilterType.appendChild(option);
        });
        state.filtersInited = true;
    }

    function applyFilterStateToInputs() {
        const { routineSearch, routineFilterGroup, routineFilterType } = assertRefs();
        routineSearch.value = state.filters.search || '';
        routineFilterGroup.value = state.filters.group || '';
        routineFilterType.value = state.filters.type || '';
        A.updateValueState?.(routineSearch);
        A.updateValueState?.(routineFilterGroup);
        A.updateValueState?.(routineFilterType);
    }

    function wireFilters() {
        const { routineSearch, routineFilterGroup, routineFilterType } = assertRefs();
        routineSearch.addEventListener('input', () => {
            state.filters.search = routineSearch.value || '';
            void renderList();
        });
        routineFilterGroup.addEventListener('change', () => {
            state.filters.group = (routineFilterGroup.value || '').trim();
            void renderList();
        });
        routineFilterType.addEventListener('change', () => {
            state.filters.type = (routineFilterType.value || '').trim();
            void renderList();
        });
    }

    function wireValueStates() {
        const { routineSearch, routineFilterGroup, routineFilterType } = assertRefs();
        A.watchValueState?.([routineSearch, routineFilterGroup, routineFilterType]);
    }

    function normalizeSearchTerms(query) {
        return String(query || '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
    }

    function matchesRoutineSearch(routine, terms) {
        if (!terms.length) {
            return true;
        }
        const name = routine?.name || '';
        const details = routine?.instructions_routine_global || routine?.details || '';
        const moves = Array.isArray(routine?.moves) ? routine.moves : [];
        const moveNames = moves.map((move) => move?.exerciseName || '').filter(Boolean).join(' ');
        const haystack = `${name} ${details} ${moveNames}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
    }

    async function getFilteredRoutines() {
        const query = state.filters.search.toLowerCase().trim();
        const searchTerms = normalizeSearchTerms(query);
        const groupFilter = state.filters.group;

        let exerciseLookup = null;
        if (groupFilter) {
            const exercises = await db.getAll('exercises');
            exerciseLookup = new Map(
                (Array.isArray(exercises) ? exercises : []).map((exercise) => [
                    exercise?.id,
                    (exercise?.muscleGroup2 || '').toString().trim()
                ])
            );
        }

        return state.routines.filter((routine) => {
            if (query && !matchesRoutineSearch(routine, searchTerms)) {
                return false;
            }
            if (groupFilter) {
                const moves = Array.isArray(routine?.moves) ? routine.moves : [];
                const matchesGroup = moves.some((move) => {
                    const exerciseGroup = exerciseLookup?.get(move?.exerciseId);
                    return exerciseGroup && exerciseGroup === groupFilter;
                });
                if (!matchesGroup) {
                    return false;
                }
            }
            return true;
        });
    }

    function renderNoneCard() {
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, body, end } = structure;
        card.classList.add('is-neutral');
        card.setAttribute('aria-label', 'Repos — ajouter');

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = 'Repos';

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = 'Ne pas associer de routine.';

        body.append(title, details);

        const icon = listCard.createIcon('⦸');
        end.appendChild(icon);

        card.addEventListener('click', async () => {
            if (state.onAddCallback) {
                await state.onAddCallback([null]);
            }
            returnToCaller();
        });

        return card;
    }

    function renderRoutineCard(routine) {
        const selectable = state.listMode === 'add';
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, start, body, end } = structure;
        const routineName = routine?.name || 'Routine';
        const labelAction = selectable ? (state.autoAdd ? 'ajouter' : 'sélectionner') : 'éditer';
        card.setAttribute('aria-label', `${routineName} — ${labelAction}`);

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = routineName;

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = buildDetails(routine);

        body.append(title, details);

        if (selectable && state.autoAdd) {
            card.addEventListener('click', async () => {
                const routineId = routine?.id;
                if (!routineId) {
                    return;
                }
                if (state.onAddCallback) {
                    await state.onAddCallback([routineId]);
                }
                returnToCaller();
            });

            const plus = listCard.createIcon('+');
            end.appendChild(plus);
        } else if (selectable) {
            const isSelected = state.selection.has(routine?.id);
            if (isSelected) {
                card.classList.add('selected');
            }

            const syncSelection = (selected) => {
                const routineId = routine?.id;
                if (!routineId) {
                    return;
                }
                if (selected) {
                    state.selection.add(routineId);
                } else {
                    state.selection.delete(routineId);
                }
                const finalState = state.selection.has(routineId);
                card.classList.toggle('selected', finalState);
                checkbox.checked = finalState;
                updateSelectionBar();
            };

            card.addEventListener('click', async () => {
                const routineId = routine?.id;
                if (!routineId) {
                    return;
                }
                syncSelection(!state.selection.has(routineId));
            });

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'exercise-card-check app-check';
            checkbox.checked = isSelected;
            checkbox.addEventListener('click', (event) => {
                event.stopPropagation();
            });
            checkbox.addEventListener('change', (event) => {
                event.stopPropagation();
                const target = event.currentTarget;
                if (target instanceof HTMLInputElement) {
                    syncSelection(target.checked);
                } else {
                    syncSelection(checkbox.checked);
                }
            });
            end.appendChild(checkbox);
        } else {
            const pencil = listCard.createIcon('✏️');
            end.appendChild(pencil);

            card.addEventListener('click', () => {
                highlightCallerTab(state.callerScreen);
                storeRoutineListScroll();
                A.openRoutineEdit({ routineId: routine?.id, callerScreen: state.callerScreen });
            });
        }

        return card;
    }

    function fillSelect(select, items, placeholder) {
        select.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder;
        select.appendChild(option);
        items.forEach((value) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = value;
            select.appendChild(opt);
        });
    }

    function buildDetails(routine) {
        const moves = Array.isArray(routine?.moves) ? routine.moves : [];
        const exerciseCount = moves.length;
        const totals = moves.reduce(
            (acc, move) => {
                const sets = Array.isArray(move?.sets) ? move.sets : [];
                acc.sets += sets.length;
                acc.reps += sets.reduce((subtotal, set) => {
                    const repsValue = Number.parseInt(set?.reps, 10);
                    return Number.isFinite(repsValue) ? subtotal + repsValue : subtotal;
                }, 0);
                return acc;
            },
            { sets: 0, reps: 0 }
        );
        const series = totals.sets;
        const reps = totals.reps;
        const exerciseLabel = exerciseCount > 1 ? 'exercices' : 'exercice';
        const seriesLabel = series > 1 ? 'séries' : 'série';
        const repsLabel = reps > 1 ? 'reps' : 'rep';
        return `${exerciseCount} ${exerciseLabel} • ${series} ${seriesLabel} • ${reps} ${repsLabel}`;
    }

    function createRoutineId() {
        return `routine-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
    }

    function highlightCallerTab(callerScreen) {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        const map = {
            screenSessions: 'tabSessions',
            screenStatExercises: 'tabStats',
            screenStatMuscles: 'tabStats',
            screenStatMusclesDetail: 'tabStats',
            screenSettings: 'tabPlanning',
            screenPreferences: 'tabPlanning',
            screenData: 'tabPlanning',
            screenPlanning: 'tabPlanning',
            screenPlanningRoutines: 'tabPlanning',
            screenPlanEdit: 'tabPlanning',
            screenPlanCycle: 'tabPlanning',
            screenMeso: 'tabPlanning',
            screenProgression: 'tabPlanning'
        };
        const tabId = map[callerScreen];
        if (tabId) {
            document.getElementById(tabId)?.classList.add('active');
        }
    }

    function ensureSelectionBar() {
        const { content, routineCatalog } = refs;
        if (refs.routineSelectBar || !content || !routineCatalog) {
            return;
        }
        const bar = document.createElement('div');
        bar.id = 'routineSelectBar';
        bar.className = 'exercise-selection-bar hidden';

        const button = document.createElement('button');
        button.id = 'btnAddSelectedRoutines';
        button.className = 'btn cta full';
        button.type = 'button';
        button.disabled = true;
        button.textContent = 'Ajouter 0 routine(s)';
        button.addEventListener('click', async () => {
            if (!state.selection.size) {
                return;
            }
            const ids = Array.from(state.selection);
            if (state.onAddCallback) {
                await state.onAddCallback(ids);
            }
            returnToCaller();
        });

        bar.appendChild(button);
        content.insertBefore(bar, routineCatalog);
        refs.routineSelectBar = bar;
        refs.btnAddSelectedRoutines = button;
    }

    function updateSelectionBar() {
        if (!refs.routineSelectBar || !refs.btnAddSelectedRoutines) {
            return;
        }
        const isAddMode = state.listMode === 'add' && !state.autoAdd;
        refs.routineSelectBar.classList.toggle('hidden', !isAddMode);
        if (!isAddMode) {
            return;
        }
        const count = state.selection.size;
        refs.btnAddSelectedRoutines.disabled = count === 0;
        refs.btnAddSelectedRoutines.textContent = `Ajouter ${count} routine(s)`;
    }

    function returnToCaller() {
        const target = state.callerScreen || 'screenSettings';
        highlightCallerTab(target);
        switchScreen(target);
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
            screenSettings,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData,
            screenPlanning,
            screenPlanningRoutines,
            screenPlanEdit,
            screenPlanCycle,
            screenMeso,
            screenProgression
        } = assertRefs();
        const { screenStatExercises, screenStatExercisesDetail } = refs;
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
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData,
            screenPlanning,
            screenPlanningRoutines,
            screenPlanEdit,
            screenPlanCycle,
            screenMeso,
            screenProgression
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
        state.active = target === 'screenRoutineList';
    }
})();
