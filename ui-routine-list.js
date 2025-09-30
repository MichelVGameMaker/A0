// ui-routine-list.js — liste des routines
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        routines: [],
        active: false
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireCreateButton();
    });

    /* ACTIONS */
    A.openRoutineList = async function openRoutineList() {
        ensureRefs();
        highlightStatsTab();
        await loadRoutines(true);
        renderList();
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
        refs.screenStatsList = document.getElementById('screenStatsList');
        refs.screenStatsDetail = document.getElementById('screenStatsDetail');
        refs.routineCatalog = document.getElementById('routineCatalog');
        refs.btnRoutineCreate = document.getElementById('btnRoutineCreate');
        refs.tabStats = document.getElementById('tabStats');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = ['screenRoutineList', 'routineCatalog'];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-routine-list.js: références manquantes (${missing.join(', ')})`);
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
            highlightStatsTab();
            A.openRoutineEdit({ routineId: id });
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
        if (!state.routines.length) {
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
    }

    function renderRoutineCard(routine) {
        const card = document.createElement('article');
        card.className = 'exercise-card clickable';
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${routine?.name || 'Routine'} — éditer`);

        const row = document.createElement('div');
        row.className = 'exercise-card-row';

        const left = document.createElement('div');
        left.className = 'exercise-card-left';
        left.appendChild(renderGrip());

        const textWrapper = document.createElement('div');
        textWrapper.className = 'exercise-card-text';
        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = routine?.name || 'Routine';

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = buildDetails(routine);

        textWrapper.append(title, details);
        left.appendChild(textWrapper);

        const right = document.createElement('div');
        right.className = 'exercise-card-right';
        const pencil = document.createElement('span');
        pencil.className = 'session-card-pencil';
        pencil.setAttribute('aria-hidden', 'true');
        pencil.textContent = '✏️';
        right.appendChild(pencil);

        row.append(left, right);
        card.appendChild(row);

        card.addEventListener('click', () => {
            highlightStatsTab();
            A.openRoutineEdit({ routineId: routine?.id });
        });

        return card;
    }

    function renderGrip() {
        const gripWrapper = document.createElement('div');
        gripWrapper.className = 'session-card-handle';
        gripWrapper.setAttribute('aria-hidden', 'true');
        const grip = document.createElement('span');
        grip.className = 'session-card-grip';
        for (let index = 0; index < 3; index += 1) {
            const dot = document.createElement('span');
            dot.className = 'session-card-grip-dot';
            grip.appendChild(dot);
        }
        gripWrapper.appendChild(grip);
        return gripWrapper;
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

    function highlightStatsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        if (refs.tabStats) {
            refs.tabStats.classList.add('active');
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
            screenRoutineMoveEdit
        } = assertRefs();
        const { screenStatsList, screenStatsDetail } = refs;
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineList,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatsList,
            screenStatsDetail
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
        state.active = target === 'screenRoutineList';
    }
})();
