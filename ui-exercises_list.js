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
        const query = (exSearch.value || '').toLowerCase().trim();
        const groupFilter = (exFilterGroup.value || '').trim();
        const equipFilter = (exFilterEquip.value || '').trim();

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

        state.listMode = mode === 'add' ? 'add' : 'view';
        state.callerScreen = callerScreen;
        state.onAddCallback = typeof onAdd === 'function' ? onAdd : null;

        switchScreen('screenExercises');
        initializeFilters();
        resetFilters();
        ensureSelectionBar();
        state.selection.clear();
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
            void A.refreshExerciseList();
        });
        exFilterGroup.addEventListener('change', () => {
            void A.refreshExerciseList();
        });
        exFilterEquip.addEventListener('change', () => {
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

    function resetFilters() {
        const { exFilterGroup, exFilterEquip, exSearch } = assertRefs();
        exFilterGroup.value = '';
        exFilterEquip.value = '';
        exSearch.value = '';
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

        const image = document.createElement('img');
        image.alt = exercise.name || 'exercice';
        image.width = 40;
        image.height = 40;
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
            if (state.selection.has(exercise.id)) {
                card.classList.add('selected');
            }
            card.addEventListener('click', () => {
                if (state.selection.has(exercise.id)) {
                    state.selection.delete(exercise.id);
                } else {
                    state.selection.add(exercise.id);
                }
                card.classList.toggle('selected');
                updateSelectionBar();
            });
            row.append(left);
        } else {
            card.classList.add('clickable');
            card.addEventListener('click', () => {
                A.openExerciseRead({ currentId: exercise.id, callerScreen: 'screenExercises' });
            });
            row.append(left);
        }

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
        const map = {
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenSessions,
            screenExecEdit
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
