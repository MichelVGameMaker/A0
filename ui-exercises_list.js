// ui-exercices_list.js — 3.1.1 Bibliothèque d’exercices (liste + filtres + lazy images)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        listMode: 'view',
        callerScreen: 'screenExercises',
        onAddCallback: null,
        filtersInited: false,
        filters: {
            search: '',
            group: '',
            equip: ''
        },
        selection: new Set(),
        lazyObserver: null
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        wireFilters();
    });

    /* ACTIONS */
    /**
     * Actualise la liste des exercices selon les filtres courants.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.refreshExerciseList = async function refreshExerciseList() {
        const { exSearch, exFilterGroup, exFilterEquip, exList } = assertRefs();

        state.filters.search = exSearch.value || '';
        state.filters.group = (exFilterGroup.value || '').trim();
        state.filters.equip = (exFilterEquip.value || '').trim();

        const query = state.filters.search.toLowerCase().trim();
        const groupFilter = state.filters.group;
        const equipFilter = state.filters.equip;

        const all = await db.getAll('exercises');
        const filtered = all.filter((exercise) => {
            if (query && !String(exercise.name || '').toLowerCase().includes(query)) {
                return false;
            }
            if (groupFilter) {
                const mg2 = (exercise.muscleGroup2 || '').toString().trim();
                if (mg2 !== groupFilter) {
                    return false;
                }
            }
            if (equipFilter) {
                const eg2 = (exercise.equipmentGroup2 || '').toString().trim();
                if (eg2 !== equipFilter) {
                    return false;
                }
            }
            return true;
        });

        exList.innerHTML = '';
        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucun exercice.';
            exList.appendChild(empty);
            updateSelectionBar();
            return;
        }

        filtered.forEach((exercise) => {
            exList.appendChild(renderItem(exercise));
        });
        updateSelectionBar();
    };

    /**
     * Ouvre la bibliothèque d'exercices.
     * @param {{mode?: 'add'|'view', callerScreen?: string, onAdd?: (ids: string[]) => void}} [options] Paramètres d'ouverture.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.openExercises = async function openExercises(options = {}) {
        const { mode = 'view', callerScreen = 'screenExercises', onAdd = null } = options;
        ensureRefs();
        assertRefs();

        const preserveContext = callerScreen === 'screenExerciseEdit' || callerScreen === 'screenExerciseRead';
        const modeProvided = Object.prototype.hasOwnProperty.call(options, 'mode');
        const onAddProvided = Object.prototype.hasOwnProperty.call(options, 'onAdd');

        const shouldKeepCaller = preserveContext && state.listMode === 'add' && Boolean(state.onAddCallback);
        if (!shouldKeepCaller) {
            state.callerScreen = callerScreen;
        } else if (!state.callerScreen) {
            state.callerScreen = callerScreen;
        }

        if (modeProvided) {
            state.listMode = mode === 'add' ? 'add' : 'view';
        } else if (!preserveContext) {
            state.listMode = 'view';
        }

        if (onAddProvided) {
            state.onAddCallback = typeof onAdd === 'function' ? onAdd : null;
        } else if (!preserveContext) {
            state.onAddCallback = null;
        }

        if (!preserveContext) {
            clearFilterState();
            state.selection.clear();
        }

        switchScreen('screenExercises');
        initializeFilters();
        applyFilterStateToInputs();
        ensureSelectionBar();
        updateSelectionBar();
        configureHeaderButtons();
        await A.refreshExerciseList();
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenExerciseEdit = document.getElementById('screenExerciseEdit');
        refs.screenExerciseRead = document.getElementById('screenExerciseRead');
        refs.screenSessions = document.getElementById('screenSessions');
        refs.screenExecEdit = document.getElementById('screenExecEdit');
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenStatsList = document.getElementById('screenStatsList');
        refs.screenStatsDetail = document.getElementById('screenStatsDetail');
        refs.content = document.querySelector('#screenExercises .content');
        refs.exSearch = document.getElementById('exSearch');
        refs.exFilterGroup = document.getElementById('exFilterGroup');
        refs.exFilterEquip = document.getElementById('exFilterEquip');
        refs.exList = document.getElementById('exList');
        refs.exBackList = document.getElementById('exBackList');
        refs.exOkList = document.getElementById('exOkList');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenExercises',
            'exSearch',
            'exFilterGroup',
            'exFilterEquip',
            'exList',
            'exBackList',
            'exOkList'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-exercises_list.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireFilters() {
        const { exSearch, exFilterGroup, exFilterEquip } = assertRefs();
        exSearch.addEventListener('input', () => {
            state.filters.search = exSearch.value || '';
            void A.refreshExerciseList();
        });
        exFilterGroup.addEventListener('change', () => {
            state.filters.group = (exFilterGroup.value || '').trim();
            void A.refreshExerciseList();
        });
        exFilterEquip.addEventListener('change', () => {
            state.filters.equip = (exFilterEquip.value || '').trim();
            void A.refreshExerciseList();
        });
    }

    function initializeFilters() {
        if (state.filtersInited) {
            return;
        }
        const { exFilterGroup, exFilterEquip } = assertRefs();
        fillSelect(exFilterGroup, CFG.musclesG2, 'Groupe musculaire');
        fillSelect(exFilterEquip, CFG.equipmentG2 || CFG.equipment, 'Matériel');
        state.filtersInited = true;
    }

    function applyFilterStateToInputs() {
        const { exFilterGroup, exFilterEquip, exSearch } = assertRefs();
        exFilterGroup.value = state.filters.group || '';
        exFilterEquip.value = state.filters.equip || '';
        exSearch.value = state.filters.search || '';
    }

    function clearFilterState() {
        state.filters.search = '';
        state.filters.group = '';
        state.filters.equip = '';
    }

    function ensureSelectionBar() {
        if (refs.exSelectBar) {
            return;
        }
        const bar = document.createElement('div');
        bar.id = 'exSelectBar';
        bar.className = 'exercise-selection-bar hidden';

        const button = document.createElement('button');
        button.id = 'btnAddSelected';
        button.className = 'btn full';
        button.disabled = true;
        button.textContent = 'Ajouter 0 exercice(s)';
        button.addEventListener('click', () => {
            if (!state.selection.size) {
                return;
            }
            const ids = Array.from(state.selection);
            if (state.onAddCallback) {
                state.onAddCallback(ids);
            }
            switchScreen(state.callerScreen || 'screenExercises');
        });

        bar.appendChild(button);
        refs.content?.insertBefore(bar, refs.exList);
        refs.exSelectBar = bar;
        refs.btnAddSelected = button;
    }

    function updateSelectionBar() {
        if (!refs.exSelectBar) {
            return;
        }
        const isAddMode = state.listMode === 'add';
        refs.exSelectBar.classList.toggle('hidden', !isAddMode);
        if (!isAddMode || !refs.btnAddSelected) {
            return;
        }

        const count = state.selection.size;
        refs.btnAddSelected.disabled = count === 0;
        refs.btnAddSelected.classList.toggle('primary', count > 0);
        refs.btnAddSelected.textContent = `Ajouter ${count} exercice(s)`;
    }

    function renderItem(exercise) {
        const card = document.createElement('article');
        card.className = 'exercise-card';
        card.setAttribute('role', 'button');

        const row = document.createElement('div');
        row.className = 'exercise-card-row';

        const left = document.createElement('div');
        left.className = 'exercise-card-left';
        const right = document.createElement('div');
        right.className = 'exercise-card-right';

        const image = document.createElement('img');
        image.alt = exercise.name || 'exercice';
        image.className = 'exercise-card-thumb';
        image.loading = 'lazy';
        image.decoding = 'async';
        if (exercise.image) {
            image.setAttribute('data-src', exercise.image);
            ensureLazyObserver().observe(image);
        } else {
            image.src = new URL('icons/placeholder-64.png', document.baseURI).href;
            image.classList.add('exercise-thumb-placeholder');
        }

        const textWrapper = document.createElement('div');
        textWrapper.className = 'exercise-card-text';
        const name = document.createElement('div');
        name.className = 'element';
        name.textContent = exercise.name || '—';
        const details = document.createElement('div');
        details.className = 'details';
        const equipmentDetails = (exercise.equipmentGroup2 || exercise.equipment || '-').toString().trim();
        const target = (exercise.muscle || exercise.muscleGroup2 || exercise.muscleGroup3 || '-').toString().trim();
        const secondary = Array.isArray(exercise.secondaryMuscles)
            ? exercise.secondaryMuscles.filter(Boolean)
            : [];
        const muscles = [target, ...secondary].filter(Boolean);
        details.textContent = `${equipmentDetails} • ${muscles.join(', ')}`;
        textWrapper.append(name, details);

        left.append(image, textWrapper);

        if (state.listMode === 'add') {
            let checkbox = null;
            const isSelected = state.selection.has(exercise.id);
            if (isSelected) {
                card.classList.add('selected');
            }
            card.classList.add('clickable');

            const syncSelection = (selected) => {
                if (selected) {
                    state.selection.add(exercise.id);
                } else {
                    state.selection.delete(exercise.id);
                }
                const finalState = state.selection.has(exercise.id);
                card.classList.toggle('selected', finalState);
                if (checkbox) {
                    checkbox.checked = finalState;
                }
                updateSelectionBar();
            };

            card.addEventListener('click', () => {
                syncSelection(!state.selection.has(exercise.id));
            });

            checkbox = document.createElement('input');
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
            right.appendChild(checkbox);

            image.classList.add('clickable');
            image.addEventListener('click', (event) => {
                event.stopPropagation();
                A.openExerciseRead({ currentId: exercise.id, callerScreen: 'screenExercises' });
            });
        } else {
            card.classList.add('clickable');
            card.addEventListener('click', () => {
                A.openExerciseRead({ currentId: exercise.id, callerScreen: 'screenExercises' });
            });

            const eyeButton = document.createElement('button');
            eyeButton.type = 'button';
            eyeButton.className = 'exercise-card-eye';
            eyeButton.setAttribute('aria-label', 'Voir l\'exercice');
            eyeButton.textContent = '👁';
            eyeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                A.openExerciseRead({ currentId: exercise.id, callerScreen: 'screenExercises' });
            });
            right.appendChild(eyeButton);
        }

        row.append(left, right);
        card.appendChild(row);
        return card;
    }

    function ensureLazyObserver() {
        if (state.lazyObserver) {
            return state.lazyObserver;
        }
        state.lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                    }
                    state.lazyObserver?.unobserve(img);
                }
            });
        }, { rootMargin: '200px' });
        return state.lazyObserver;
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

    function configureHeaderButtons() {
        const { exOkList, exBackList } = assertRefs();
        exOkList.textContent = 'Créer nouveau';
        exOkList.onclick = () => {
            A.openExerciseEdit({ callerScreen: 'screenExercises' });
        };
        exBackList.onclick = () => {
            switchScreen(state.callerScreen || 'screenSessions');
        };
    }

    function switchScreen(target) {
        const { screenExercises, screenExerciseEdit, screenExerciseRead, screenSessions, screenExecEdit } = assertRefs();
        const { screenRoutineEdit, screenRoutineMoveEdit, screenStatsList, screenStatsDetail } = refs;
        const map = {
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenSessions,
            screenExecEdit,
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
    }
})();
