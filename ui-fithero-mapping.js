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
        const { mappingList, mappingEmpty } = ensureRefs();
        if (!mappingList) {
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

        mappingList.innerHTML = '';

        if (!slugs.length) {
            mappingEmpty?.removeAttribute('hidden');
            mappingList?.setAttribute('hidden', 'true');
            return;
        }

        mappingEmpty?.setAttribute('hidden', 'true');
        mappingList?.removeAttribute('hidden');

        const allExercises = await db.getAll('exercises');
        const exercises = Array.isArray(allExercises) ? allExercises : [];
        const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
        const exerciseByExternalId = new Map(
            exercises
                .filter((exercise) => exercise?.external_source === 'FitHero' && typeof exercise?.external_exercise_id === 'string')
                .map((exercise) => [exercise.external_exercise_id, exercise])
        );
        const fitHeroExerciseBySlug = exerciseByExternalId;

        const listCard = A.components?.listCard;
        slugs.forEach((slug) => {
            const mapping = mappingBySlug.get(slug);
            const mappedExercise = mapping?.exerciseId ? exerciseById.get(mapping.exerciseId) : null;
            const missingEntry = missingBySlug.get(slug) || null;
            const exerciseName = mappedExercise?.name || mapping?.name || missingEntry?.name || '—';
            const externalExercise = isFitHeroUserExerciseId(slug) ? exerciseByExternalId.get(slug) : null;
            const slugLabel = externalExercise?.name || missingEntry?.name || slug;
            const sourceExercise = fitHeroExerciseBySlug.get(slug) || null;

            const { card, body } = listCard?.createStructure({ cardClass: 'mapping-card' }) || {};
            if (!card || !body) {
                return;
            }

            const slugLine = document.createElement('div');
            slugLine.className = 'element mapping-card__slug';
            slugLine.textContent = slugLabel;
            slugLine.title = slug;

            const detailLine = document.createElement('div');
            detailLine.className = 'details mapping-card__details';
            detailLine.textContent = `vers ${exerciseName}`;
            detailLine.title = exerciseName;

            const actionRow = document.createElement('div');
            actionRow.className = 'mapping-card__actions';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'btn';
            editButton.textContent = 'Modifier';
            editButton.addEventListener('click', () => {
                openExercisePicker(slug);
            });
            actionRow.appendChild(editButton);

            if (sourceExercise && mappedExercise) {
                const applyButton = document.createElement('button');
                applyButton.type = 'button';
                applyButton.className = 'btn danger';
                applyButton.textContent = 'Appliquer';
                applyButton.addEventListener('click', () => {
                    void applyFitHeroMapping({
                        slug,
                        sourceExercise,
                        targetExercise: mappedExercise
                    });
                });
                actionRow.appendChild(applyButton);
            }

            body.append(slugLine, detailLine, actionRow);
            mappingList.appendChild(card);
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

    async function applyFitHeroMapping({ slug, sourceExercise, targetExercise }) {
        if (!slug || !sourceExercise || !targetExercise) {
            return;
        }
        if (sourceExercise.id === targetExercise.id) {
            return;
        }
        const message = `Remplacer l’exercice ${slug} par ${targetExercise.name || '—'} `
            + `dans toutes les séances et supprimer ${slug} de la bibliothèque d’exercices ?`;
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Appliquer mapping FitHero',
                message,
                variant: 'danger'
            })
            : confirm(message);
        if (!confirmed) {
            return;
        }

        await replaceFitHeroExerciseReferences({
            sourceExercise,
            targetExercise
        });
        await db.del('exercises', sourceExercise.id);
        await renderMappingList();
    }

    async function replaceFitHeroExerciseReferences({ sourceExercise, targetExercise }) {
        const sourceId = sourceExercise?.id;
        const targetId = targetExercise?.id;
        if (!sourceId || !targetId || sourceId === targetId) {
            return;
        }

        const [sessions, routines] = await Promise.all([
            db.getAll('sessions'),
            db.getAll('routines')
        ]);

        if (Array.isArray(sessions)) {
            for (const session of sessions) {
                const { changed, updated } = replaceSessionExercise(session, sourceId, targetExercise);
                if (changed) {
                    await db.put('sessions', updated);
                }
            }
        }

        if (Array.isArray(routines)) {
            for (const routine of routines) {
                const { changed, updated } = replaceRoutineExercise(routine, sourceId, targetExercise);
                if (changed) {
                    await db.put('routines', updated);
                }
            }
        }

        const mergedExercise = mergeExerciseGoals(targetExercise, sourceExercise);
        if (mergedExercise !== targetExercise) {
            await db.put('exercises', mergedExercise);
        }
    }

    function replaceSessionExercise(session, sourceId, targetExercise) {
        if (!session || !Array.isArray(session.exercises)) {
            return { changed: false, updated: session };
        }
        const targetId = targetExercise.id;
        let changed = false;
        let targetEntry = null;
        const updatedExercises = [];

        session.exercises.forEach((exercise) => {
            if (!exercise) {
                return;
            }
            const exerciseId = exercise.exercise_id || exercise.type;
            if (exerciseId === targetId) {
                targetEntry = exercise;
                if (targetExercise.name) {
                    exercise.exercise_name = targetExercise.name;
                }
                exercise.exercise_id = targetId;
                exercise.type = targetId;
                updatedExercises.push(exercise);
                return;
            }
            if (exerciseId === sourceId) {
                changed = true;
                if (!targetEntry) {
                    const next = {
                        ...exercise,
                        exercise_id: targetId,
                        exercise_name: targetExercise.name || exercise.exercise_name,
                        type: targetId
                    };
                    next.sets = normalizeSessionSets(next.sets, targetId);
                    targetEntry = next;
                    updatedExercises.push(next);
                } else {
                    mergeSessionEntries(targetEntry, exercise, targetId);
                }
                return;
            }
            updatedExercises.push(exercise);
        });

        if (changed) {
            session.exercises = updatedExercises;
        }
        return { changed, updated: session };
    }

    function normalizeSessionSets(sets, targetId) {
        const list = Array.isArray(sets) ? sets.slice() : [];
        return list.map((set) => ({
            ...set,
            type: targetId
        }));
    }

    function mergeSessionEntries(target, source, targetId) {
        if (!target.exercise_name && source.exercise_name) {
            target.exercise_name = source.exercise_name;
        }
        if (!target.routine_instructions && source.routine_instructions) {
            target.routine_instructions = source.routine_instructions;
        }
        if (!target.exercise_note && source.exercise_note) {
            target.exercise_note = source.exercise_note;
        }
        const targetSets = Array.isArray(target.sets) ? target.sets : [];
        const sourceSets = Array.isArray(source.sets) ? source.sets : [];
        sourceSets.forEach((set) => {
            const nextPos = targetSets.length + 1;
            const mergedSet = {
                ...set,
                type: targetId,
                pos: nextPos,
                position: nextPos
            };
            targetSets.push(mergedSet);
        });
        target.sets = targetSets;
    }

    function replaceRoutineExercise(routine, sourceId, targetExercise) {
        if (!routine || !Array.isArray(routine.moves)) {
            return { changed: false, updated: routine };
        }
        const targetId = targetExercise.id;
        let changed = false;
        let targetMove = null;
        const updatedMoves = [];

        routine.moves.forEach((move) => {
            if (!move) {
                return;
            }
            if (move.exerciseId === targetId) {
                targetMove = move;
                if (targetExercise.name) {
                    move.exerciseName = targetExercise.name;
                }
                updatedMoves.push(move);
                return;
            }
            if (move.exerciseId === sourceId) {
                changed = true;
                if (!targetMove) {
                    const next = {
                        ...move,
                        exerciseId: targetId,
                        exerciseName: targetExercise.name || move.exerciseName
                    };
                    next.sets = normalizeRoutineSets(next.sets);
                    targetMove = next;
                    updatedMoves.push(next);
                } else {
                    mergeRoutineMoves(targetMove, move);
                }
                return;
            }
            updatedMoves.push(move);
        });

        if (changed) {
            updatedMoves.forEach((move, index) => {
                move.pos = index + 1;
            });
            routine.moves = updatedMoves;
        }

        return { changed, updated: routine };
    }

    function normalizeRoutineSets(sets) {
        const list = Array.isArray(sets) ? sets.slice() : [];
        return list.map((set, index) => ({
            ...set,
            pos: Number.isFinite(set.pos) ? set.pos : index + 1
        }));
    }

    function mergeRoutineMoves(target, source) {
        if (!target.instructions && source.instructions) {
            target.instructions = source.instructions;
        }
        const targetSets = Array.isArray(target.sets) ? target.sets : [];
        const sourceSets = Array.isArray(source.sets) ? source.sets : [];
        sourceSets.forEach((set) => {
            const nextPos = targetSets.length + 1;
            targetSets.push({
                ...set,
                pos: nextPos
            });
        });
        target.sets = targetSets;
    }

    function mergeExerciseGoals(targetExercise, sourceExercise) {
        const sourceGoals = sourceExercise?.goals;
        if (!sourceGoals || typeof sourceGoals !== 'object') {
            return targetExercise;
        }
        const targetGoals = targetExercise?.goals && typeof targetExercise.goals === 'object'
            ? { ...targetExercise.goals }
            : {};
        const merged = {
            ...targetGoals,
            setsWeek: mergeGoalRange(targetGoals.setsWeek, sourceGoals.setsWeek),
            volume: mergeGoalRange(targetGoals.volume, sourceGoals.volume),
            reps: mergeGoalRange(targetGoals.reps, sourceGoals.reps),
            orm: mergeGoalOrm(targetGoals.orm, sourceGoals.orm)
        };

        const mergedExercise = {
            ...targetExercise,
            goals: merged
        };
        return mergedExercise;
    }

    function mergeGoalRange(targetRange, sourceRange) {
        if (!sourceRange || typeof sourceRange !== 'object') {
            return targetRange;
        }
        const merged = { ...(targetRange || {}) };
        if (!hasGoalValue(merged.min) && hasGoalValue(sourceRange.min)) {
            merged.min = sourceRange.min;
        }
        if (!hasGoalValue(merged.max) && hasGoalValue(sourceRange.max)) {
            merged.max = sourceRange.max;
        }
        return merged;
    }

    function mergeGoalOrm(targetOrm, sourceOrm) {
        if (!sourceOrm || typeof sourceOrm !== 'object') {
            return targetOrm;
        }
        const merged = { ...(targetOrm || {}) };
        if (!hasGoalValue(merged.startDate) && hasGoalValue(sourceOrm.startDate)) {
            merged.startDate = sourceOrm.startDate;
        }
        if (!hasGoalValue(merged.targetDate) && hasGoalValue(sourceOrm.targetDate)) {
            merged.targetDate = sourceOrm.targetDate;
        }
        if (!hasGoalValue(merged.startValue) && hasGoalValue(sourceOrm.startValue)) {
            merged.startValue = sourceOrm.startValue;
        }
        if (!hasGoalValue(merged.targetValue) && hasGoalValue(sourceOrm.targetValue)) {
            merged.targetValue = sourceOrm.targetValue;
        }
        return merged;
    }

    function hasGoalValue(value) {
        return value !== null && value !== undefined && value !== '';
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
        refs.mappingList = document.getElementById('fitHeroMappingList');
        refs.mappingEmpty = document.getElementById('fitHeroMappingEmpty');
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
