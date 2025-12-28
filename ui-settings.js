// ui-settings.js — navigation pour l'écran Réglages
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
    });

    /* ACTIONS */
    A.openSettings = async function openSettings() {
        ensureRefs();
        highlightSettingsTab();
        hideTimerForSettings();
        switchScreen('screenSettings');
    };

    A.openPreferences = function openPreferences() {
        ensureRefs();
        highlightSettingsTab();
        hideTimerForSettings();
        switchScreen('screenPreferences');
    };

    A.openData = function openData() {
        ensureRefs();
        highlightSettingsTab();
        hideTimerForSettings();
        switchScreen('screenData');
    };

    A.openVolume = function openVolume() {
        ensureRefs();
        highlightStatsTab();
        showTimerForStats();
        A.renderVolumeScreen?.();
        switchScreen('screenStatMuscles');
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
        refs.screenAdmin = document.getElementById('screenAdmin');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.tabSettings = document.getElementById('tabSettings');
        refs.btnSettingsExercises = document.getElementById('btnSettingsExercises');
        refs.btnSettingsRoutines = document.getElementById('btnSettingsRoutines');
        refs.btnSettingsPreferences = document.getElementById('btnSettingsPreferences');
        refs.btnSettingsVolume = document.getElementById('btnSettingsVolume');
        refs.btnSettingsData = document.getElementById('btnSettingsData');
        refs.btnSettingsUpdate = document.getElementById('btnSettingsUpdate');
        refs.btnSettingsReset = document.getElementById('btnSettingsReset');
        refs.btnPreferencesBack = document.getElementById('btnPreferencesBack');
        refs.btnDataBack = document.getElementById('btnDataBack');
        refs.btnDataReloadExercises = document.getElementById('btnDataReloadExercises');
        refs.btnDataImportFitHero = document.getElementById('btnDataImportFitHero');
        refs.btnDataExportSessions = document.getElementById('btnDataExportSessions');
        refs.btnDataImportSessions = document.getElementById('btnDataImportSessions');
        refs.btnDataFitHeroMapping = document.getElementById('btnDataFitHeroMapping');
        refs.inputDataImportFitHero = document.getElementById('inputDataImportFitHero');
        refs.inputDataImportSessions = document.getElementById('inputDataImportSessions');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const {
            btnSettingsExercises,
            btnSettingsRoutines,
            btnSettingsPreferences,
            btnSettingsVolume,
            btnSettingsData,
            btnSettingsUpdate,
            btnSettingsReset,
            btnPreferencesBack,
            btnDataBack,
            btnDataReloadExercises,
            btnDataImportFitHero,
            btnDataExportSessions,
            btnDataImportSessions,
            btnDataFitHeroMapping,
            inputDataImportFitHero,
            inputDataImportSessions
        } = ensureRefs();

        btnSettingsExercises?.addEventListener('click', () => {
            highlightSettingsTab();
            hideTimerForSettings();
            void A.openExercises({ callerScreen: 'screenSettings' });
        });
        btnSettingsRoutines?.addEventListener('click', () => {
            highlightSettingsTab();
            hideTimerForSettings();
            void A.openRoutineList();
        });
        btnSettingsPreferences?.addEventListener('click', () => {
            A.openPreferences();
        });
        btnSettingsVolume?.addEventListener('click', () => {
            A.openVolume();
        });
        btnSettingsData?.addEventListener('click', () => {
            A.openData();
        });
        btnSettingsUpdate?.addEventListener('click', () => {
            void handleUpdateRefresh();
        });
        btnSettingsReset?.addEventListener('click', () => {
            void handleReset();
        });
        btnPreferencesBack?.addEventListener('click', () => {
            A.openSettings();
        });
        btnDataBack?.addEventListener('click', () => {
            A.openSettings();
        });
        btnDataReloadExercises?.addEventListener('click', () => {
            void reloadExerciseLibrary(btnDataReloadExercises);
        });
        btnDataImportFitHero?.addEventListener('click', () => {
            inputDataImportFitHero?.click();
        });
        btnDataExportSessions?.addEventListener('click', () => {
            void exportSessions(btnDataExportSessions);
        });
        btnDataImportSessions?.addEventListener('click', () => {
            inputDataImportSessions?.click();
        });
        btnDataFitHeroMapping?.addEventListener('click', () => {
            A.openFitHeroMapping?.();
        });
        inputDataImportFitHero?.addEventListener('change', () => {
            void importFitHeroSessions({
                input: inputDataImportFitHero,
                button: btnDataImportFitHero
            });
        });
        inputDataImportSessions?.addEventListener('change', () => {
            void importAppSessions({
                input: inputDataImportSessions,
                button: btnDataImportSessions
            });
        });
    }

    function highlightSettingsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        if (refs.tabSettings) {
            refs.tabSettings.classList.add('active');
        }
    }

    function highlightStatsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        document.getElementById('tabStats')?.classList.add('active');
    }

    function hideTimerForSettings() {
        if (typeof A.setTimerVisibility === 'function') {
            A.setTimerVisibility({ forcedHidden: true, reason: 'settings' });
        }
    }

    function showTimerForStats() {
        if (typeof A.setTimerVisibility === 'function') {
            A.setTimerVisibility({ forcedHidden: false, reason: null });
        }
    }

    async function handleUpdateRefresh() {
        const { btnSettingsUpdate } = ensureRefs();
        const confirmed = window.confirm(
            'Update : cette action recharge l’application sans effacer vos données. Continuer ?'
        );
        if (!confirmed) {
            return;
        }

        if (btnSettingsUpdate) {
            btnSettingsUpdate.disabled = true;
        }

        try {
            await clearAppCache();
        } catch (error) {
            console.warn('Update échoué :', error);
        } finally {
            window.location.reload();
        }
    }

    async function handleReset() {
        const { btnSettingsReset } = ensureRefs();
        const confirmed = window.confirm(
            'Reset : cette action supprime toutes les données locales et le cache. Continuer ?'
        );
        if (!confirmed) {
            return;
        }

        if (btnSettingsReset) {
            btnSettingsReset.disabled = true;
        }

        try {
            await resetAppStorage();
        } catch (error) {
            console.warn('Reset échoué :', error);
        } finally {
            window.location.reload();
        }
    }

    async function resetAppStorage() {
        localStorage.clear();
        sessionStorage.clear();

        if (typeof db !== 'undefined' && typeof db.reset === 'function') {
            await db.reset();
        }

        await clearAppCache();
    }

    async function clearAppCache() {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        }

        if (navigator.serviceWorker?.getRegistrations) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        }
    }

    async function reloadExerciseLibrary(button) {
        if (!db?.importExternalExercisesIfNeeded) {
            alert('Le chargement des exercices est indisponible.');
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            await db.importExternalExercisesIfNeeded({ force: true });
            alert('Bibliothèque d’exercices rechargée.');
        } catch (error) {
            console.warn('Recharge des exercices échouée :', error);
            alert('Le chargement des exercices a échoué.');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function exportSessions(button) {
        if (!db?.getAll) {
            alert('La sauvegarde des séances est indisponible.');
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const sessions = await db.getAll('sessions');
            const payload = {
                format: 'a0-sessions',
                exportedAt: new Date().toISOString(),
                sessions: Array.isArray(sessions) ? sessions : []
            };
            downloadJson('a0_seances.json', payload);
            alert('Sauvegarde des séances générée.');
        } catch (error) {
            console.warn('Sauvegarde des séances échouée :', error);
            alert('La sauvegarde des séances a échoué.');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function importAppSessions({ input, button } = {}) {
        const file = input?.files?.[0];
        if (!file) {
            return;
        }

        if (input) {
            input.value = '';
        }

        if (!db?.getAll || !db?.del || !db?.saveSession) {
            alert('Le chargement des séances est indisponible.');
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const payload = await readJsonFile(file);
            const sessions = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.sessions)
                    ? payload.sessions
                    : null;
            if (!sessions) {
                throw new Error('Format invalide : sessions manquant.');
            }

            const invalidIndex = sessions.findIndex((session) => !isSessionPayloadValid(session));
            if (invalidIndex !== -1) {
                throw new Error(`Format invalide : séance ${invalidIndex + 1} incorrecte.`);
            }

            const confirmed = window.confirm(
                `Charger ${sessions.length} séance${sessions.length > 1 ? 's' : ''} et remplacer toutes les données actuelles ?`
            );
            if (!confirmed) {
                return;
            }

            await clearAllSessions();

            for (const session of sessions) {
                await db.saveSession(session);
            }

            const label = sessions.length > 1 ? 'séances' : 'séance';
            alert(`${sessions.length} ${label} chargée${sessions.length > 1 ? 's' : ''}.`);

            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('Import séances échoué :', error);
            alert('Le chargement des séances a échoué.');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function isSessionPayloadValid(session) {
        if (!session || typeof session !== 'object') {
            return false;
        }
        const id = typeof session.id === 'string' ? session.id.trim() : '';
        const date = typeof session.date === 'string' ? session.date.trim() : '';
        return Boolean(id || date);
    }

    function downloadJson(filename, data) {
        const payload = JSON.stringify(data, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    const FIT_HERO_MISSING_STORAGE_KEY = A.fitHeroMissingStorageKey || 'fithero_missing_exercises';
    const FIT_HERO_USER_MAPPING_KEY = A.fitHeroUserMappingKey || 'fithero_user_mapping';
    A.fitHeroMissingStorageKey = FIT_HERO_MISSING_STORAGE_KEY;
    A.fitHeroUserMappingKey = FIT_HERO_USER_MAPPING_KEY;

    async function importFitHeroSessions({ input, button } = {}) {
        const file = input?.files?.[0];
        if (!file) {
            return;
        }

        if (input) {
            input.value = '';
        }

        if (!db?.getAll || !db?.del || !db?.saveSession) {
            alert('Le chargement des séances est indisponible.');
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const [payload, mapping, exercises] = await Promise.all([
                readJsonFile(file),
                loadFitHeroMapping(),
                db.getAll('exercises')
            ]);
            const workouts = payload?.workouts;
            if (!Array.isArray(workouts)) {
                throw new Error('Format FitHero invalide : workouts manquant.');
            }

            const mappingBySlug = buildFitHeroMapping(mapping);
            const exerciseById = new Map(
                (Array.isArray(exercises) ? exercises : []).map((exercise) => [exercise.id, exercise])
            );
            const missingExercises = new Set();
            const mappingStats = {
                official: 0,
                user: 0,
                missing: 0
            };

            await clearAllSessions();

            let imported = 0;
            for (const workout of workouts) {
                const session = toFitHeroSession(workout, {
                    mappingBySlug,
                    exerciseById,
                    missingExercises,
                    mappingStats
                });
                if (!session) {
                    continue;
                }
                await db.saveSession(session);
                imported += 1;
            }

            updateMissingFitHeroExercises(missingExercises);

            const label = imported > 1 ? 'séances' : 'séance';
            alert(`${imported} ${label} FitHero chargée${imported > 1 ? 's' : ''}.\n`
                + `Exercices : ${mappingStats.official} via mapping officiel, `
                + `${mappingStats.user} via mapping utilisateur, `
                + `${mappingStats.missing} non trouvé${mappingStats.missing > 1 ? 's' : ''}.`);

            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('Import FitHero échoué :', error);
            alert('Le chargement des séances FitHero a échoué.');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function readJsonFile(file) {
        const text = await file.text();
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error('JSON invalide.');
        }
    }

    async function loadFitHeroMapping() {
        const [official, user] = await Promise.all([
            loadFitHeroOfficialMapping(),
            loadUserFitHeroMapping()
        ]);
        return {
            official,
            user,
            combined: official.concat(user)
        };
    }

    async function loadFitHeroOfficialMapping() {
        try {
            const url = new URL('data/mapping_fithero', document.baseURI).href;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('mapping_fithero introuvable');
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                return [];
            }
            return data;
        } catch (error) {
            console.warn('Chargement mapping FitHero échoué :', error);
            return [];
        }
    }

    function loadUserFitHeroMapping() {
        const raw = localStorage.getItem(FIT_HERO_USER_MAPPING_KEY);
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Mapping FitHero utilisateur invalide :', error);
            return [];
        }
    }

    function buildFitHeroMapping(mapping) {
        const official = Array.isArray(mapping?.official) ? mapping.official : [];
        const user = Array.isArray(mapping?.user) ? mapping.user : [];
        const entries = [
            ...official.map((entry) => ({ ...entry, source: 'official' })),
            ...user.map((entry) => ({ ...entry, source: 'user' }))
        ];
        return new Map(
            entries
                .filter((entry) => entry && typeof entry.slug === 'string')
                .map((entry) => [entry.slug.trim(), entry])
        );
    }

    function updateMissingFitHeroExercises(missingExercises) {
        if (!missingExercises || missingExercises.size === 0) {
            return;
        }
        const raw = localStorage.getItem(FIT_HERO_MISSING_STORAGE_KEY);
        let existing = [];
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    existing = parsed;
                }
            } catch {
                existing = [];
            }
        }
        const merged = new Set(existing);
        missingExercises.forEach((slug) => merged.add(slug));
        localStorage.setItem(FIT_HERO_MISSING_STORAGE_KEY, JSON.stringify(Array.from(merged)));
    }

    async function clearAllSessions() {
        const sessions = await db.getAll('sessions');
        if (!Array.isArray(sessions) || !sessions.length) {
            return;
        }
        await Promise.all(
            sessions.map((session) => (session?.id ? db.del('sessions', session.id) : Promise.resolve(false)))
        );
    }

    function toFitHeroSession(workout, context = {}) {
        if (!workout || typeof workout !== 'object') {
            return null;
        }

        const rawId = typeof workout.id === 'string' ? workout.id.trim() : '';
        const rawDate = typeof workout.date === 'string' ? workout.date : '';
        const parsedDate = rawDate ? new Date(rawDate) : null;
        const isoDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
        const dateKey = !isoDate && rawId && typeof A.sessionDateKeyFromId === 'function'
            ? A.sessionDateKeyFromId(rawId)
            : null;
        const derivedIso = dateKey ? new Date(`${dateKey}T00:00:00`).toISOString() : null;
        const sessionDate = isoDate || derivedIso;
        const sessionId = rawId || (sessionDate ? A.sessionId(new Date(sessionDate)) : '');

        if (!sessionId || !sessionDate) {
            return null;
        }

        const exercises = Array.isArray(workout.exercises)
            ? workout.exercises
                .map((exercise, index) => toFitHeroExercise(exercise, {
                    sessionId,
                    sessionDate,
                    position: index + 1,
                    mappingBySlug: context.mappingBySlug,
                    exerciseById: context.exerciseById,
                    missingExercises: context.missingExercises
                }))
                .filter(Boolean)
            : [];

        return {
            id: sessionId,
            date: sessionDate,
            comments: typeof workout.comments === 'string' ? workout.comments : '',
            exercises
        };
    }

    function toFitHeroExercise(exercise, context) {
        if (!exercise || typeof exercise !== 'object') {
            return null;
        }

        const sessionId = context?.sessionId || '';
        const sessionDate = context?.sessionDate || null;
        const type = typeof exercise.type === 'string' ? exercise.type.trim() : '';
        const fallbackId = typeof exercise.id === 'string' ? exercise.id.trim() : '';
        const slug = type || fallbackId;
        const mapping = slug && context?.mappingBySlug ? context.mappingBySlug.get(slug) : null;
        const mappedId = mapping?.exerciseId || '';
        const mappedExercise = mappedId && context?.exerciseById
            ? context.exerciseById.get(mappedId)
            : null;
        const exerciseId = mappedExercise?.id || mappedId || slug;
        const name = mappedExercise?.name
            || mapping?.name
            || (typeof exercise.name === 'string' ? exercise.name : '')
            || exerciseId
            || 'Exercice';
        const exerciseDate = typeof exercise.date === 'string' ? exercise.date : sessionDate;
        const sortValue = Number.isFinite(Number(exercise.sort))
            ? Number(exercise.sort)
            : context?.position || 1;

        if (slug) {
            if (mapping?.exerciseId) {
                if (mapping.source === 'user') {
                    context?.mappingStats && (context.mappingStats.user += 1);
                } else if (mapping.source === 'official') {
                    context?.mappingStats && (context.mappingStats.official += 1);
                }
            } else {
                context?.missingExercises?.add(slug);
                context?.mappingStats && (context.mappingStats.missing += 1);
            }
        }

        const sets = Array.isArray(exercise.sets)
            ? exercise.sets.map((set, index) => toFitHeroSet(set, {
                type: exerciseId,
                position: index + 1,
                date: exerciseDate
            })).filter(Boolean)
            : [];

        return {
            id: typeof exercise.id === 'string' && exercise.id.length
                ? exercise.id
                : `${sessionId}_${name}`,
            exercise_id: exerciseId,
            exercise_name: name,
            date: exerciseDate,
            type: exerciseId,
            sets,
            sort: sortValue,
            category: 'weight_reps',
            weight_unit: 'metric',
            distance_unit: 'metric',
            comments: typeof exercise.comments === 'string' ? exercise.comments : null,
            exercise_note: typeof exercise.comments === 'string' ? exercise.comments : ''
        };
    }

    function toFitHeroSet(set, context) {
        if (!set || typeof set !== 'object') {
            return null;
        }

        const rawDate = typeof set.date === 'string' ? set.date : context?.date;
        const parsed = rawDate ? new Date(rawDate) : null;
        const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
        const pos = context?.position || 1;
        return {
            id: typeof set.id === 'string' ? set.id : '',
            pos,
            date,
            type: context?.type || null,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            time: set.time ?? null,
            distance: set.distance ?? null,
            setType: set.setType ?? null,
            rpe: set.rpe ?? null,
            done: true
        };
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
