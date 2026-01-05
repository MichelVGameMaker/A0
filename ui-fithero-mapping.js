// ui-fithero-mapping.js — gestion du mapping FitHero utilisateur
(() => {
    const A = window.App;

    const refs = {};
    let refsResolved = false;

    const FIT_HERO_MISSING_STORAGE_KEY = A.fitHeroMissingStorageKey || 'fithero_missing_exercises';
    const FIT_HERO_USER_MAPPING_KEY = A.fitHeroUserMappingKey || 'fithero_user_mapping';
    A.fitHeroMissingStorageKey = FIT_HERO_MISSING_STORAGE_KEY;
    A.fitHeroUserMappingKey = FIT_HERO_USER_MAPPING_KEY;

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
    });

    A.openFitHeroMapping = async function openFitHeroMapping() {
        ensureRefs();
        highlightSettingsTab();
        hideTimerForSettings();
        switchScreen('screenFitHeroMapping');
        await renderMappingList();
    };

    async function renderMappingList() {
        const { mappingBody, mappingEmpty, mappingTable } = ensureRefs();
        if (!mappingBody) {
            return;
        }

        const missingEntries = loadMissingEntries();
        const userMappings = loadUserMappings();
        const mappingBySlug = new Map(userMappings.map((entry) => [entry.slug, entry]));
        const missingBySlug = new Map(
            missingEntries.filter((entry) => entry?.slug).map((entry) => [entry.slug, entry])
        );
        const slugs = [...missingBySlug.keys()];
        userMappings.forEach((entry) => {
            if (entry?.slug && !slugs.includes(entry.slug)) {
                slugs.push(entry.slug);
            }
        });

        mappingBody.innerHTML = '';

        if (!slugs.length) {
            mappingEmpty?.removeAttribute('hidden');
            mappingTable?.setAttribute('hidden', 'true');
            return;
        }

        mappingEmpty?.setAttribute('hidden', 'true');
        mappingTable?.removeAttribute('hidden');

        const allExercises = await db.getAll('exercises');
        const exercises = Array.isArray(allExercises) ? allExercises : [];
        const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
        const exerciseByExternalId = new Map(
            exercises
                .filter((exercise) => exercise?.external_source === 'FitHero' && typeof exercise?.external_exercise_id === 'string')
                .map((exercise) => [exercise.external_exercise_id, exercise])
        );

        slugs.forEach((slug) => {
            const mapping = mappingBySlug.get(slug);
            const mappedExercise = mapping?.exerciseId ? exerciseById.get(mapping.exerciseId) : null;
            const missingEntry = missingBySlug.get(slug) || null;
            const exerciseName = mappedExercise?.name || mapping?.name || missingEntry?.name || '—';
            const externalExercise = isFitHeroUserExerciseId(slug) ? exerciseByExternalId.get(slug) : null;
            const slugLabel = externalExercise?.name || missingEntry?.name || slug;

            const row = document.createElement('tr');

            const slugCell = document.createElement('td');
            slugCell.textContent = slugLabel;
            slugCell.title = slug;

            const nameCell = document.createElement('td');
            nameCell.textContent = exerciseName;

            const actionCell = document.createElement('td');
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'btn';
            editButton.textContent = 'Modifier';
            editButton.addEventListener('click', () => {
                openExercisePicker(slug);
            });
            actionCell.appendChild(editButton);

            row.append(slugCell, nameCell, actionCell);
            mappingBody.appendChild(row);
        });
    }

    function isFitHeroUserExerciseId(value) {
        return typeof value === 'string' && value.startsWith('user-exercise--');
    }

    function openExercisePicker(slug) {
        if (!slug) {
            return;
        }
        A.openExercises?.({
            mode: 'add',
            callerScreen: 'screenFitHeroMapping',
            fromSettings: true,
            selectionLimit: 1,
            onAdd: (ids) => {
                const exerciseId = Array.isArray(ids) ? ids[0] : null;
                if (!exerciseId) {
                    return;
                }
                void saveUserMapping(slug, exerciseId).then(() => {
                    void A.openFitHeroMapping?.();
                });
            }
        });
    }

    async function saveUserMapping(slug, exerciseId) {
        const mappings = loadUserMappings();
        const index = mappings.findIndex((entry) => entry?.slug === slug);
        const exercise = exerciseId ? await db.get('exercises', exerciseId) : null;
        const entry = {
            slug,
            exerciseId,
            name: exercise?.name || '',
            source: 'user'
        };
        if (index >= 0) {
            mappings[index] = entry;
        } else {
            mappings.push(entry);
        }
        localStorage.setItem(FIT_HERO_USER_MAPPING_KEY, JSON.stringify(mappings));
        updateMissingEntry(slug, exerciseId, exercise?.name || '');
    }

    function loadMissingEntries() {
        const raw = localStorage.getItem(FIT_HERO_MISSING_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .map((entry) => {
                    if (typeof entry === 'string') {
                        return { slug: entry, exerciseId: null };
                    }
                    return entry;
                })
                .filter((entry) => entry?.slug);
        } catch (error) {
            console.warn('Slugs FitHero inconnus invalides :', error);
            return [];
        }
    }

    function loadUserMappings() {
        const raw = localStorage.getItem(FIT_HERO_USER_MAPPING_KEY);
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((entry) => entry?.slug) : [];
        } catch (error) {
            console.warn('Mapping FitHero utilisateur invalide :', error);
            return [];
        }
    }

    function updateMissingEntry(slug, exerciseId, name) {
        if (!slug) {
            return;
        }
        const entries = loadMissingEntries();
        const index = entries.findIndex((entry) => entry?.slug === slug);
        if (index === -1) {
            return;
        }
        entries[index] = {
            ...entries[index],
            exerciseId,
            name: name || entries[index].name || null
        };
        localStorage.setItem(FIT_HERO_MISSING_STORAGE_KEY, JSON.stringify(entries));
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
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.btnFitHeroMappingBack = document.getElementById('btnFitHeroMappingBack');
        refs.mappingBody = document.getElementById('fitHeroMappingBody');
        refs.mappingEmpty = document.getElementById('fitHeroMappingEmpty');
        refs.mappingTable = document.querySelector('#screenFitHeroMapping .mapping-table');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const { btnFitHeroMappingBack } = ensureRefs();
        btnFitHeroMappingBack?.addEventListener('click', () => {
            A.openData?.();
        });
    }

    function highlightSettingsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        const tabSettings = document.getElementById('tabSettings');
        if (tabSettings) {
            tabSettings.classList.add('active');
        }
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
            screenFitHeroMapping
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
