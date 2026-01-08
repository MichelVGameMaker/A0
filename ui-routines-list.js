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
        includeNone: false
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireCreateButton();
        wireBackButton();
    });

    /* ACTIONS */
    A.openRoutineList = async function openRoutineList(options = {}) {
        const {
            callerScreen = 'screenSettings',
            mode = 'view',
            onAdd = null,
            autoAdd = false,
            includeNone = false
        } = options;
        ensureRefs();
        state.listMode = mode === 'add' ? 'add' : 'view';
        state.onAddCallback = typeof onAdd === 'function' ? onAdd : null;
        state.autoAdd = Boolean(autoAdd);
        state.includeNone = Boolean(includeNone);
        state.selection.clear();
        state.callerScreen = callerScreen;
        highlightCallerTab(callerScreen);
        await loadRoutines(true);
        renderList();
        ensureSelectionBar();
        updateSelectionBar();
        switchScreen('screenRoutineList');
    };

    A.refreshRoutineList = async function refreshRoutineList() {
        ensureRefs();
        await loadRoutines(true);
        state.active = refs.screenRoutineList ? !refs.screenRoutineList.hidden : state.active;
        if (state.active) {
            renderList();
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
        refs.routineCatalog = document.getElementById('routineCatalog');
        refs.btnRoutineCreate = document.getElementById('btnRoutineCreate');
        refs.tabSettings = document.getElementById('tabSettings');
        refs.routineListBack = document.getElementById('routineListBack');
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

    function wireCreateButton() {
        const { btnRoutineCreate } = ensureRefs();
        if (!btnRoutineCreate) {
            return;
        }
        btnRoutineCreate.addEventListener('click', () => {
            const id = createRoutineId();
            highlightCallerTab(state.callerScreen);
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

    function renderList() {
        const { routineCatalog } = assertRefs();
        routineCatalog.innerHTML = '';
        if (state.listMode === 'add' && state.includeNone) {
            routineCatalog.appendChild(renderNoneCard());
        }
        if (!state.routines.length) {
            if (state.listMode === 'add' && state.includeNone) {
                updateSelectionBar();
                return;
            }
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucune routine enregistrée.';
            routineCatalog.appendChild(empty);
            return;
        }
        const sorted = [...state.routines].sort((a, b) => {
            const nameA = (a?.name || '').toLocaleLowerCase('fr-FR');
            const nameB = (b?.name || '').toLocaleLowerCase('fr-FR');
            return nameA.localeCompare(nameB);
        });
        sorted.forEach((routine) => {
            routineCatalog.appendChild(renderRoutineCard(routine));
        });
        updateSelectionBar();
    }

    function renderNoneCard() {
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, body, end } = structure;
        card.classList.add('is-neutral');
        card.setAttribute('aria-label', 'Aucune routine — ajouter');

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = 'Aucune routine';

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
            checkbox.className = 'exercise-card-check';
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
                A.openRoutineEdit({ routineId: routine?.id, callerScreen: state.callerScreen });
            });
        }

        return card;
    }

    function buildDetails(routine) {
        const moves = Array.isArray(routine?.moves) ? routine.moves : [];
        const exerciseCount = moves.length;
        const reps = moves.reduce((total, move) => {
            const sets = Array.isArray(move?.sets) ? move.sets : [];
            return (
                total +
                sets.reduce((subtotal, set) => {
                    const repsValue = Number.parseInt(set?.reps, 10);
                    return Number.isFinite(repsValue) ? subtotal + repsValue : subtotal;
                }, 0)
            );
        }, 0);
        const exerciseLabel = exerciseCount > 1 ? 'exercices' : 'exercice';
        const repsLabel = reps > 1 ? 'répétitions' : 'répétition';
        return `${exerciseCount} ${exerciseLabel} • ${reps} ${repsLabel}`;
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
            screenSettings: 'tabSettings',
            screenPreferences: 'tabSettings',
            screenData: 'tabSettings',
            screenPlanning: 'tabSettings'
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
        button.className = 'btn full';
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
        refs.btnAddSelectedRoutines.classList.toggle('primary', count > 0);
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
            screenPlanning
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
            screenPlanning
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
        state.active = target === 'screenRoutineList';
    }
})();
