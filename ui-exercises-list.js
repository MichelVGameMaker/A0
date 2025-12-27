// ui-exercises-list.js — 3.1.1 Bibliothèque d’exercices (liste + filtres + lazy images)
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-exercises-list: composant listCard manquant.');
    }

    const SEARCH_SYNONYM_GROUPS = [
        ['bicep', 'biceps'],
        ['delt', 'delts', 'deltoids', 'deltoid', 'shoulder', 'shoulders']
    ];
    const SEARCH_SYNONYMS = buildSynonymMap(SEARCH_SYNONYM_GROUPS);

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        listMode: 'view',
        callerScreen: 'screenExercises',
        fromSettings: false,
        onAddCallback: null,
        selectionLimit: null,
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
        wireValueStates();
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
        const searchTerms = normalizeSearchTerms(query);
        const groupFilter = state.filters.group;
        const equipFilter = state.filters.equip;

        const all = await db.getAll('exercises');
        const filtered = all.filter((exercise) => {
            if (query && !matchesSearch(String(exercise.name || ''), searchTerms)) {
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
        const { mode = 'view', callerScreen = 'screenExercises', onAdd = null, selectionLimit = null } = options;
        ensureRefs();
        assertRefs();

        const preserveContext = callerScreen === 'screenExerciseEdit' || callerScreen === 'screenExerciseRead';
        const explicitFromSettings = options.fromSettings;
        const modeProvided = Object.prototype.hasOwnProperty.call(options, 'mode');
        const onAddProvided = Object.prototype.hasOwnProperty.call(options, 'onAdd');
        const derivedFromSettings =
            typeof explicitFromSettings === 'boolean'
                ? explicitFromSettings
                : isSettingsScreen(callerScreen) || (preserveContext && state.fromSettings);

        const shouldKeepCaller = preserveContext && state.listMode === 'add' && Boolean(state.onAddCallback);
        if (!shouldKeepCaller) {
            state.callerScreen = callerScreen;
        } else if (!state.callerScreen) {
            state.callerScreen = callerScreen;
        }
        state.fromSettings = derivedFromSettings;
        applyTimerVisibilityForCaller(state.callerScreen, state.fromSettings);

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

        if (Object.prototype.hasOwnProperty.call(options, 'selectionLimit')) {
            const normalized = Number(selectionLimit);
            state.selectionLimit = Number.isFinite(normalized) && normalized > 0 ? normalized : null;
        } else if (!preserveContext) {
            state.selectionLimit = null;
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

    function normalizeSearchTerms(query) {
        return String(query || '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
    }

    function matchesSearch(haystack, terms) {
        if (!terms.length) {
            return true;
        }
        const normalized = String(haystack || '').toLowerCase();
        return terms.every((term) => {
            const synonyms = SEARCH_SYNONYMS.get(term) || [term];
            return synonyms.some((synonym) => normalized.includes(synonym));
        });
    }

    function buildSynonymMap(groups) {
        const map = new Map();
        groups.forEach((group) => {
            const normalized = group.map((term) => String(term || '').toLowerCase()).filter(Boolean);
            normalized.forEach((term) => {
                map.set(term, normalized);
            });
        });
        return map;
    }

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
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenVolume = document.getElementById('screenVolume');
        refs.screenVolumeMuscle = document.getElementById('screenVolumeMuscle');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
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

    function applyTimerVisibilityForCaller(callerScreen, fromSettings) {
        const hideForSettings = fromSettings || isSettingsScreen(callerScreen);
        if (typeof A.setTimerVisibility === 'function') {
            A.setTimerVisibility({ forcedHidden: hideForSettings, reason: hideForSettings ? 'settings' : null });
        }
    }

    function isSettingsScreen(name) {
        return name === 'screenSettings' || name === 'screenPreferences' || name === 'screenData';
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
            throw new Error(`ui-exercises-list.js: références manquantes (${missing.join(', ')})`);
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

    function wireValueStates() {
        const { exSearch, exFilterGroup, exFilterEquip } = assertRefs();
        A.watchValueState?.([exSearch, exFilterGroup, exFilterEquip]);
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
        refreshValueStates();
    }

    function clearFilterState() {
        state.filters.search = '';
        state.filters.group = '';
        state.filters.equip = '';
    }

    function refreshValueStates() {
        A.updateValueState?.(refs.exSearch);
        A.updateValueState?.(refs.exFilterGroup);
        A.updateValueState?.(refs.exFilterEquip);
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
        const structure = listCard.createStructure();
        const { card, start, body, end } = structure;
        card.setAttribute('role', 'button');
        card.dataset.exerciseId = exercise.id;

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

        const name = document.createElement('div');
        name.className = 'element exercise-card-name';
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

        start.insertBefore(image, body);
        body.append(name, details);

        if (state.listMode === 'add') {
            let checkbox = null;
            const isSelected = state.selection.has(exercise.id);
            if (isSelected) {
                card.classList.add('selected');
            }
            card.classList.add('clickable');

            const syncSelection = (selected) => {
                if (selected) {
                    if (state.selectionLimit === 1 && !state.selection.has(exercise.id)) {
                        clearSelectionUI(exercise.id);
                        state.selection.clear();
                    }
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
            end.appendChild(checkbox);

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
            end.appendChild(eyeButton);
        }

        return card;
    }

    function clearSelectionUI(exceptId) {
        if (!refs.exList) {
            return;
        }
        refs.exList.querySelectorAll('.exercise-card.selected').forEach((card) => {
            if (card.dataset.exerciseId === exceptId) {
                return;
            }
            card.classList.remove('selected');
            const checkbox = card.querySelector('.exercise-card-check');
            if (checkbox instanceof HTMLInputElement) {
                checkbox.checked = false;
            }
        });
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
        const {
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatsList,
            screenStatsDetail,
            screenSettings,
            screenVolume,
            screenVolumeMuscle,
            screenPreferences,
            screenData,
            screenFitHeroMapping
        } = refs;
        const map = {
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenSessions,
            screenExecEdit,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatsList,
            screenStatsDetail,
            screenSettings,
            screenVolume,
            screenVolumeMuscle,
            screenPreferences,
            screenData,
            screenFitHeroMapping
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
