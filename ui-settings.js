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

    A.openApplication = function openApplication() {
        ensureRefs();
        highlightSettingsTab();
        hideTimerForSettings();
        switchScreen('screenApplication');
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
        refs.screenApplication = document.getElementById('screenApplication');
        refs.screenPlanning = document.getElementById('screenPlanning');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.tabSettings = document.getElementById('tabSettings');
        refs.btnSettingsExercises = document.getElementById('btnSettingsExercises');
        refs.btnSettingsRoutines = document.getElementById('btnSettingsRoutines');
        refs.btnSettingsPlanning = document.getElementById('btnSettingsPlanning');
        refs.btnSettingsPreferences = document.getElementById('btnSettingsPreferences');
        refs.btnSettingsData = document.getElementById('btnSettingsData');
        refs.btnSettingsApplication = document.getElementById('btnSettingsApplication');
        refs.btnSettingsUpdate = document.getElementById('btnSettingsUpdate');
        refs.btnSettingsReset = document.getElementById('btnSettingsReset');
        refs.btnPreferencesBack = document.getElementById('btnPreferencesBack');
        refs.btnDataBack = document.getElementById('btnDataBack');
        refs.btnApplicationBack = document.getElementById('btnApplicationBack');
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
            btnSettingsPlanning,
            btnSettingsPreferences,
            btnSettingsData,
            btnSettingsApplication,
            btnSettingsUpdate,
            btnSettingsReset,
            btnPreferencesBack,
            btnDataBack,
            btnApplicationBack,
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
        btnSettingsPlanning?.addEventListener('click', () => {
            highlightSettingsTab();
            hideTimerForSettings();
            A.openPlanning?.();
        });
        btnSettingsPreferences?.addEventListener('click', () => {
            A.openPreferences();
        });
        btnSettingsData?.addEventListener('click', () => {
            A.openData();
        });
        btnSettingsApplication?.addEventListener('click', () => {
            A.openApplication();
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
        btnApplicationBack?.addEventListener('click', () => {
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
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Update',
                message: 'Update : cette action recharge l’application sans effacer vos données. Continuer ?'
            })
            : window.confirm('Update : cette action recharge l’application sans effacer vos données. Continuer ?');
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
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Reset',
                message: 'Reset : cette action supprime toutes les données locales et le cache. Continuer ?'
            })
            : window.confirm('Reset : cette action supprime toutes les données locales et le cache. Continuer ?');
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
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import',
                    message: 'Le chargement des séances est indisponible.'
                });
            } else {
                alert('Le chargement des séances est indisponible.');
            }
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

            const confirmMessage = `Charger ${sessions.length} séance${sessions.length > 1 ? 's' : ''} et remplacer toutes les données actuelles ?`;
            const confirmed = A.components?.confirmDialog?.confirm
                ? await A.components.confirmDialog.confirm({
                    title: 'Import des séances',
                    message: confirmMessage
                })
                : window.confirm(confirmMessage);
            if (!confirmed) {
                return;
            }

            await clearAllSessions();

            for (const session of sessions) {
                await db.saveSession(session);
            }

            const label = sessions.length > 1 ? 'séances' : 'séance';
            const successMessage = `${sessions.length} ${label} chargée${sessions.length > 1 ? 's' : ''}.`;
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import terminé',
                    message: successMessage
                });
            } else {
                alert(successMessage);
            }

            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('Import séances échoué :', error);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import',
                    message: 'Le chargement des séances a échoué.'
                });
            } else {
                alert('Le chargement des séances a échoué.');
            }
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
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import FitHero',
                    message: 'Le chargement des séances est indisponible.'
                });
            } else {
                alert('Le chargement des séances est indisponible.');
            }
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const [payload, mapping, exercises, catalog] = await Promise.all([
                readJsonFile(file),
                loadFitHeroMapping(),
                db.getAll('exercises'),
                loadExercisesCatalog()
            ]);
            const workouts = payload?.workouts;
            if (!Array.isArray(workouts)) {
                throw new Error('Format FitHero invalide : workouts manquant.');
            }

            const mappingBySlug = buildFitHeroMapping(mapping);
            const exerciseById = new Map(
                (Array.isArray(exercises) ? exercises : []).map((exercise) => [exercise.id, exercise])
            );
            const userExerciseById = buildFitHeroUserExerciseIndex(payload?.exercises);
            const exerciseByExternalKey = buildExerciseByExternalKey(exercises);
            const catalogById = buildExerciseCatalogIndex(catalog);
            const missingExercises = new Set();
            const mappingStats = {
                official: 0,
                user: 0,
                missing: 0
            };

            const userExerciseIds = collectFitHeroUserExerciseIds(workouts);
            for (const rawId of userExerciseIds) {
                await ensureFitHeroUserExercise(rawId, {
                    userExerciseById,
                    exerciseById,
                    exerciseByExternalKey,
                    catalogById
                });
            }

            await clearAllSessions();

            let imported = 0;
            for (const workout of workouts) {
                const session = toFitHeroSession(workout, {
                    mappingBySlug,
                    exerciseById,
                    userExerciseById,
                    exerciseByExternalKey,
                    catalogById,
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
            const summaryMessage = `${imported} ${label} FitHero chargée${imported > 1 ? 's' : ''}.\n`
                + `Exercices : ${mappingStats.official} via mapping officiel, `
                + `${mappingStats.user} via mapping utilisateur, `
                + `${mappingStats.missing} non trouvé${mappingStats.missing > 1 ? 's' : ''}.`;
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import FitHero terminé',
                    message: summaryMessage
                });
            } else {
                alert(summaryMessage);
            }

            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('Import FitHero échoué :', error);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import FitHero',
                    message: 'Le chargement des séances FitHero a échoué.'
                });
            } else {
                alert('Le chargement des séances FitHero a échoué.');
            }
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

    async function loadExercisesCatalog() {
        try {
            const url = new URL('data/exercises.json', document.baseURI).href;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('exercises.json introuvable');
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.warn('Chargement catalogue exercices échoué :', error);
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

    function buildFitHeroUserExerciseIndex(exercises) {
        const entries = Array.isArray(exercises) ? exercises : [];
        return new Map(
            entries
                .filter((exercise) => typeof exercise?.id === 'string' && isFitHeroUserExerciseId(exercise.id))
                .map((exercise) => [exercise.id, exercise])
        );
    }

    function collectFitHeroUserExerciseIds(workouts) {
        const ids = new Set();
        const sessions = Array.isArray(workouts) ? workouts : [];
        sessions.forEach((workout) => {
            const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
            exercises.forEach((exercise) => {
                const slug = getFitHeroExerciseSlug(exercise);
                if (isFitHeroUserExerciseId(slug)) {
                    ids.add(slug);
                }
            });
        });
        return ids;
    }

    function buildExerciseByExternalKey(exercises) {
        const list = Array.isArray(exercises) ? exercises : [];
        const entries = list
            .map((exercise) => {
                const source = typeof exercise?.external_source === 'string' ? exercise.external_source : '';
                const externalId = typeof exercise?.external_exercise_id === 'string'
                    ? exercise.external_exercise_id
                    : '';
                if (!source || !externalId) {
                    return null;
                }
                return [buildExternalExerciseKey(source, externalId), exercise];
            })
            .filter(Boolean);
        return new Map(entries);
    }

    function buildExternalExerciseKey(source, id) {
        return `${source}::${id}`;
    }

    function buildFitHeroUserExerciseId(rawId) {
        return `fh_${rawId}`;
    }

    function buildFitHeroUserExerciseName(def, rawId, catalogById) {
        const catalogId = resolveFitHeroUserExerciseCatalogId(def, rawId);
        const catalogName = catalogId ? catalogById?.get(catalogId) : '';
        if (catalogName) {
            return `(user) ${catalogName}`;
        }
        const label = typeof def?.name === 'string' ? def.name.trim() : '';
        if (label) {
            return `(user) ${label}`;
        }
        return `(user) ${rawId}`;
    }

    function buildFitHeroUserExerciseTechnicalName(def, rawId) {
        const label = typeof def?.name === 'string' ? def.name.trim() : '';
        return label || rawId;
    }

    function resolveFitHeroUserExerciseCatalogId(def, rawId) {
        if (typeof def?.exerciseId === 'string' && def.exerciseId.trim()) {
            return def.exerciseId.trim();
        }
        if (typeof def?.exercise_id === 'string' && def.exercise_id.trim()) {
            return def.exercise_id.trim();
        }
        if (typeof def?.id === 'string' && def.id.trim() && !isFitHeroUserExerciseId(def.id)) {
            return def.id.trim();
        }
        if (typeof rawId === 'string') {
            const trimmed = rawId.trim();
            const prefix = 'user-exercise--';
            if (trimmed.startsWith(prefix)) {
                const remainder = trimmed.slice(prefix.length);
                if (remainder) {
                    const segment = remainder.split('--')[0].trim();
                    return segment || remainder;
                }
            }
        }
        return '';
    }

    function buildExerciseCatalogIndex(catalog) {
        const list = Array.isArray(catalog) ? catalog : [];
        const entries = list
            .map((exercise) => {
                const id = String(
                    exercise?.exerciseId
                        || exercise?.id
                        || exercise?._id
                        || exercise?.uuid
                        || ''
                ).trim();
                const name = typeof exercise?.name === 'string' ? exercise.name.trim() : '';
                if (!id || !name) {
                    return null;
                }
                return [id, name];
            })
            .filter(Boolean);
        return new Map(entries);
    }

    function resolveFitHeroUserExercise(rawId, context) {
        const key = buildExternalExerciseKey('FitHero', rawId);
        return context?.exerciseByExternalKey?.get(key) || null;
    }

    async function ensureFitHeroUserExercise(rawId, context) {
        if (!isFitHeroUserExerciseId(rawId)) {
            return null;
        }
        const key = buildExternalExerciseKey('FitHero', rawId);
        const existing = context?.exerciseByExternalKey?.get(key);
        if (existing) {
            return existing;
        }

        const def = context?.userExerciseById?.get(rawId) || null;
        if (!def) {
            console.warn(`Missing user exercise definition for id ${rawId}. See root.exercises in backup.`);
        }

        const resolvedName = buildFitHeroUserExerciseName(def, rawId, context?.catalogById);
        const technicalName = buildFitHeroUserExerciseTechnicalName(def, rawId);
        const idBase = buildFitHeroUserExerciseId(rawId);
        let id = idBase;
        if (context?.exerciseById?.has(id)) {
            let counter = 1;
            while (context.exerciseById.has(`${idBase}_${counter}`)) {
                counter += 1;
            }
            id = `${idBase}_${counter}`;
        }

        const exercise = {
            id,
            name: resolvedName,
            muscle: null,
            muscleGroup1: null,
            muscleGroup2: null,
            muscleGroup3: null,
            bodyPart: null,
            equipment: null,
            equipmentGroup1: null,
            equipmentGroup2: null,
            secondaryMuscles: Array.isArray(def?.secondary) ? def.secondary : [],
            instructions: [],
            image: null,
            source: 'FitHero',
            origin: 'user',
            external_source: 'FitHero',
            external_exercise_id: rawId,
            category: typeof def?.category === 'string' ? def.category : null,
            notes: typeof def?.notes === 'string' ? def.notes : null,
            primary: typeof def?.primary === 'string' ? def.primary : null,
            technical_name: technicalName
        };

        await db.put('exercises', exercise);
        context?.exerciseById?.set(exercise.id, exercise);
        context?.exerciseByExternalKey?.set(key, exercise);
        return exercise;
    }

    function getFitHeroExerciseSlug(exercise) {
        if (!exercise || typeof exercise !== 'object') {
            return '';
        }
        const rawExerciseId = typeof exercise.exercise_id === 'string' ? exercise.exercise_id.trim() : '';
        if (rawExerciseId) {
            return rawExerciseId;
        }
        const type = typeof exercise.type === 'string' ? exercise.type.trim() : '';
        if (type) {
            return type;
        }
        return typeof exercise.id === 'string' ? exercise.id.trim() : '';
    }

    function isFitHeroUserExerciseId(value) {
        return typeof value === 'string' && value.startsWith('user-exercise--');
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
        const sessionDateKey = getFitHeroSessionDateKey(workout);
        const rawDate = typeof workout.date === 'string' ? workout.date : '';
        const parsedDate = rawDate ? new Date(rawDate) : null;
        const isoDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
        const dateKey = sessionDateKey || (!isoDate && rawId && typeof A.sessionDateKeyFromId === 'function'
            ? A.sessionDateKeyFromId(rawId)
            : null);
        const derivedIso = !dateKey || sessionDateKey ? null : new Date(`${dateKey}T00:00:00`).toISOString();
        const sessionDate = sessionDateKey || isoDate || derivedIso;
        const sessionId = rawId
            || (dateKey ? dateKey.replace(/-/g, '') : '')
            || (sessionDate ? A.sessionId(new Date(sessionDate)) : '');

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

    function getFitHeroSessionDateKey(workout) {
        if (!workout || typeof workout !== 'object') {
            return null;
        }
        const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
        let earliest = null;
        exercises.forEach((exercise) => {
            const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
            sets.forEach((set) => {
                const raw = typeof set?.date === 'string' ? set.date : null;
                if (!raw) {
                    return;
                }
                const parsed = new Date(raw);
                if (Number.isNaN(parsed.getTime())) {
                    return;
                }
                const time = parsed.getTime();
                if (earliest == null || time < earliest) {
                    earliest = time;
                }
            });
        });
        if (earliest == null) {
            return null;
        }
        return formatParisDateKey(new Date(earliest));
    }

    function formatParisDateKey(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return null;
        }
        const formatter = new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Europe/Paris',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(date);
        const values = parts.reduce((acc, part) => {
            if (part.type !== 'literal') {
                acc[part.type] = part.value;
            }
            return acc;
        }, {});
        if (!values.year || !values.month || !values.day) {
            return null;
        }
        return `${values.year}-${values.month}-${values.day}`;
    }

    function toFitHeroExercise(exercise, context) {
        if (!exercise || typeof exercise !== 'object') {
            return null;
        }

        const sessionId = context?.sessionId || '';
        const sessionDate = context?.sessionDate || null;
        const slug = getFitHeroExerciseSlug(exercise);
        const isUserExercise = isFitHeroUserExerciseId(slug);
        const userExercise = isUserExercise ? resolveFitHeroUserExercise(slug, context) : null;
        const userDef = isUserExercise ? context?.userExerciseById?.get(slug) : null;
        const mapping = !isUserExercise && slug && context?.mappingBySlug ? context.mappingBySlug.get(slug) : null;
        const mappedId = mapping?.exerciseId || '';
        const mappedExercise = isUserExercise
            ? userExercise
            : mappedId && context?.exerciseById
                ? context.exerciseById.get(mappedId)
                : null;
        const fallbackUserId = isUserExercise ? buildFitHeroUserExerciseId(slug) : '';
        const exerciseId = mappedExercise?.id || mappedId || fallbackUserId || slug;
        const resolvedUserName = isUserExercise
            ? buildFitHeroUserExerciseName(userDef, slug, context?.catalogById)
            : '';
        const name = mappedExercise?.name
            || resolvedUserName
            || mapping?.name
            || (typeof exercise.name === 'string' ? exercise.name : '')
            || exerciseId
            || 'Exercice';
        const exerciseDate = typeof exercise.date === 'string' ? exercise.date : sessionDate;
        const sortValue = Number.isFinite(Number(exercise.sort))
            ? Number(exercise.sort)
            : context?.position || 1;

        if (slug && !isUserExercise) {
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
            rpe: normalizeFitHeroRpe(set.rpe),
            done: true
        };
    }

    function normalizeFitHeroRpe(value) {
        if (value == null || value === '') {
            return null;
        }
        const numeric = Number.parseFloat(String(value).replace(',', '.'));
        if (!Number.isFinite(numeric) || numeric === 0) {
            return null;
        }
        const allowed = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
        return allowed.reduce((closest, option) => {
            if (closest == null) {
                return option;
            }
            return Math.abs(option - numeric) < Math.abs(closest - numeric) ? option : closest;
        }, null);
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
