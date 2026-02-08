// ui-admin.js — écran Admin pour outils avancés
(() => {
    const A = window.App;

    const refs = {};
    let refsResolved = false;

    const FIT_HERO_USER_MAPPING_KEY = A.fitHeroUserMappingKey || 'fithero_user_mapping';
    A.fitHeroUserMappingKey = FIT_HERO_USER_MAPPING_KEY;

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
    });

    A.openAdmin = function openAdmin() {
        ensureRefs();
        highlightSettingsTab();
        switchScreen('screenAdmin');
    };

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
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.btnSettingsAdmin = document.getElementById('btnSettingsAdmin');
        refs.btnAdminBack = document.getElementById('btnAdminBack');
        refs.btnAdminUpdateFitHeroMapping = document.getElementById('btnAdminUpdateFitHeroMapping');
        refs.btnAdminExportExercisesText = document.getElementById('btnAdminExportExercisesText');
        refs.btnAdminExportRoutines = document.getElementById('btnAdminExportRoutines');
        refs.btnAdminImportRoutines = document.getElementById('btnAdminImportRoutines');
        refs.inputAdminImportRoutines = document.getElementById('inputAdminImportRoutines');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const {
            btnSettingsAdmin,
            btnAdminBack,
            btnAdminUpdateFitHeroMapping,
            btnAdminExportExercisesText,
            btnAdminExportRoutines,
            btnAdminImportRoutines,
            inputAdminImportRoutines
        } = ensureRefs();

        btnSettingsAdmin?.addEventListener('click', () => {
            A.openAdmin();
        });

        btnAdminBack?.addEventListener('click', () => {
            A.openApplication?.();
        });

        btnAdminUpdateFitHeroMapping?.addEventListener('click', () => {
            void generateFitHeroMappingFile(btnAdminUpdateFitHeroMapping);
        });

        btnAdminExportExercisesText?.addEventListener('click', () => {
            void exportExerciseLibraryText(btnAdminExportExercisesText);
        });

        btnAdminExportRoutines?.addEventListener('click', () => {
            void exportRoutines(btnAdminExportRoutines);
        });

        btnAdminImportRoutines?.addEventListener('click', () => {
            inputAdminImportRoutines?.click();
        });

        inputAdminImportRoutines?.addEventListener('change', () => {
            void importRoutines({ input: inputAdminImportRoutines, button: btnAdminImportRoutines });
        });
    }

    function highlightSettingsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        const tabPlanning = document.getElementById('tabPlanning');
        if (tabPlanning) {
            tabPlanning.classList.add('active');
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
            screenApplication,
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
            screenFitHeroMapping
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }

    async function generateFitHeroMappingFile(button) {
        if (button) {
            button.disabled = true;
        }

        try {
            const [baseMapping, customMapping] = await Promise.all([
                fetchBaseFitHeroMapping(),
                loadCustomFitHeroMappings()
            ]);
            const merged = mergeMappings(baseMapping, customMapping);
            downloadMapping(merged);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Mapping FitHero',
                    message: 'Fichier de mapping FitHero généré.',
                    variant: 'info'
                });
            } else {
                alert('Fichier de mapping FitHero généré.');
            }
        } catch (error) {
            console.warn('Génération mapping FitHero échouée :', error);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Mapping FitHero',
                    message: 'La génération du mapping FitHero a échoué.',
                    variant: 'error'
                });
            } else {
                alert('La génération du mapping FitHero a échoué.');
            }
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function fetchBaseFitHeroMapping() {
        const baseUrl = 'https://raw.githubusercontent.com/MichelVGameMaker/A0/main/data/mapping_fithero';
        const response = await fetch(baseUrl);
        if (!response.ok) {
            throw new Error('Impossible de charger le mapping FitHero en ligne.');
        }
        const text = await response.text();
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            throw new Error('Mapping FitHero en ligne invalide.');
        }
    }

    function loadCustomFitHeroMappings() {
        const rawUserMapping = localStorage.getItem(FIT_HERO_USER_MAPPING_KEY);
        const userMappings = parseMappings(rawUserMapping);
        return userMappings.filter((entry) => entry?.slug);
    }

    function parseMappings(raw) {
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

    function mergeMappings(baseMapping, customMapping) {
        const mergedBySlug = new Map();
        (Array.isArray(baseMapping) ? baseMapping : []).forEach((entry) => {
            if (!entry?.slug) {
                return;
            }
            if (!hasMappingValue(entry)) {
                return;
            }
            mergedBySlug.set(entry.slug, {
                slug: entry.slug,
                exerciseId: entry.exerciseId ?? null,
                name: entry.name ?? null
            });
        });
        (Array.isArray(customMapping) ? customMapping : []).forEach((entry) => {
            if (!entry?.slug) {
                return;
            }
            if (!hasMappingValue(entry)) {
                return;
            }
            mergedBySlug.set(entry.slug, {
                slug: entry.slug,
                exerciseId: entry.exerciseId ?? null,
                name: entry.name ?? null
            });
        });
        return Array.from(mergedBySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
    }

    function hasMappingValue(entry) {
        return Boolean(entry?.exerciseId || entry?.name);
    }

    function downloadMapping(mapping) {
        const payload = JSON.stringify(mapping, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mapping_fithero.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    async function exportExerciseLibraryText(button) {
        if (!db?.getAll) {
            void showAlert({
                title: 'Export exercices',
                message: 'L’export en texte est indisponible.',
                variant: 'error'
            });
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const exercises = await db.getAll('exercises');
            const entries = Array.isArray(exercises)
                ? exercises
                    .map((exercise) => {
                        const name = (exercise?.name || exercise?.exercise || exercise?.exerciseId || exercise?.id || '').trim();
                        const exerciseId = String(exercise?.id || exercise?.exerciseId || '').trim();
                        if (!name || !exerciseId) {
                            return null;
                        }
                        return { name, exerciseId };
                    })
                    .filter(Boolean)
                : [];
            entries.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

            const text = buildExercisesShareText(entries);
            downloadText('ListeExercices.txt', text);

            const copied = await tryCopyToClipboard(text);
            const message = copied
                ? 'Texte des exercices copié et fichier exporté.'
                : 'Fichier texte des exercices exporté.';

            void showAlert({
                title: 'Export exercices',
                message,
                variant: 'info'
            });
        } catch (error) {
            console.warn('Export texte des exercices échoué :', error);
            void showAlert({
                title: 'Export exercices',
                message: 'L’export texte des exercices a échoué.',
                variant: 'error'
            });
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function buildExercisesShareText(entries) {
        if (!Array.isArray(entries) || !entries.length) {
            return 'Liste des exercices\n\nAucun exercice disponible.';
        }
        const header = `Liste des exercices (${entries.length})`;
        const lines = entries.map((entry, index) => `${index + 1}. ${entry.name} — ${entry.exerciseId}`);
        return `${header}\n\n${lines.join('\n')}`;
    }

    async function exportRoutines(button) {
        if (!db?.getAll) {
            void showAlert({
                title: 'Export routines',
                message: 'L’export des routines est indisponible.',
                variant: 'error'
            });
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const routines = await db.getAll('routines');
            const payload = {
                format: 'a0-routines',
                exportedAt: new Date().toISOString(),
                routines: Array.isArray(routines) ? routines : []
            };
            downloadJson('routines.json', payload);
            void showAlert({
                title: 'Export routines',
                message: 'Export des routines généré.',
                variant: 'info'
            });
        } catch (error) {
            console.warn('Export routines échoué :', error);
            void showAlert({
                title: 'Export routines',
                message: 'L’export des routines a échoué.',
                variant: 'error'
            });
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function importRoutines({ input, button } = {}) {
        const file = input?.files?.[0];
        if (!file) {
            return;
        }

        if (input) {
            input.value = '';
        }

        if (!db?.getAll || !db?.put) {
            void showAlert({
                title: 'Import routines',
                message: 'L’import des routines est indisponible.',
                variant: 'error'
            });
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const rawText = await file.text();
            const parsed = JSON.parse(rawText);
            const routines = extractRoutinesFromPayload(parsed);
            if (!routines.length) {
                void showAlert({
                    title: 'Import routines',
                    message: 'Aucune routine valide trouvée.',
                    variant: 'error'
                });
                return;
            }

            const existing = await db.getAll('routines');
            const nameSet = new Set(
                Array.isArray(existing)
                    ? existing.map((routine) => (routine?.name || '').trim()).filter(Boolean)
                    : []
            );
            const idSet = new Set(
                Array.isArray(existing)
                    ? existing.map((routine) => routine?.id).filter(Boolean)
                    : []
            );

            let importedCount = 0;
            for (let index = 0; index < routines.length; index += 1) {
                const normalized = normalizeImportedRoutine(routines[index], index);
                if (!normalized) {
                    continue;
                }
                if (idSet.has(normalized.id)) {
                    normalized.id = uid('routine');
                }
                normalized.name = ensureUniqueRoutineName(normalized.name, nameSet);
                nameSet.add(normalized.name);
                idSet.add(normalized.id);
                await db.put('routines', normalized);
                importedCount += 1;
            }

            const message = importedCount
                ? `${importedCount} routine(s) importée(s).`
                : 'Aucune routine importée.';
            void showAlert({
                title: 'Import routines',
                message,
                variant: importedCount ? 'info' : 'error'
            });
        } catch (error) {
            console.warn('Import routines échoué :', error);
            void showAlert({
                title: 'Import routines',
                message: 'L’import des routines a échoué.',
                variant: 'error'
            });
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function extractRoutinesFromPayload(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }
        if (payload && typeof payload === 'object' && Array.isArray(payload.routines)) {
            return payload.routines;
        }
        return [];
    }

    function normalizeImportedRoutine(routine, index) {
        if (!routine || typeof routine !== 'object') {
            return null;
        }
        const name = typeof routine.name === 'string' && routine.name.trim()
            ? routine.name.trim()
            : `Routine ${index + 1}`;
        const normalizedMoves = Array.isArray(routine.moves)
            ? routine.moves.map((move, moveIndex) => normalizeImportedMove(move, moveIndex))
            : [];
        return {
            id: typeof routine.id === 'string' && routine.id.trim() ? routine.id.trim() : uid('routine'),
            name,
            icon: typeof routine.icon === 'string' && routine.icon.trim() ? routine.icon.trim() : '🏋️',
            details: typeof routine.details === 'string' ? routine.details : '',
            moves: normalizedMoves.filter(Boolean)
        };
    }

    function normalizeImportedMove(move, index) {
        if (!move || typeof move !== 'object') {
            return null;
        }
        return {
            id: typeof move.id === 'string' && move.id.trim() ? move.id.trim() : uid('move'),
            pos: safeInt(move.pos, index + 1),
            exerciseId: typeof move.exerciseId === 'string' ? move.exerciseId : '',
            exerciseName: typeof move.exerciseName === 'string' ? move.exerciseName : '',
            instructions: typeof move.instructions === 'string' ? move.instructions : '',
            details: typeof move.details === 'string' ? move.details : '',
            sets: Array.isArray(move.sets)
                ? move.sets.map((set, setIndex) => ({
                    pos: safeInt(set?.pos, setIndex + 1),
                    reps: safeIntOrNull(set?.reps),
                    weight: safeFloatOrNull(set?.weight),
                    rpe: safeFloatOrNull(set?.rpe),
                    rest: safeIntOrNull(set?.rest)
                }))
                : []
        };
    }

    function ensureUniqueRoutineName(name, existingNames) {
        const base = name.trim() || 'Routine';
        if (!existingNames.has(base)) {
            return base;
        }
        let suffix = 1;
        let candidate = `${base} (import)`;
        while (existingNames.has(candidate)) {
            suffix += 1;
            candidate = `${base} (import ${suffix})`;
        }
        return candidate;
    }

    function safeInt(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
        return fallback;
    }

    function safeIntOrNull(value) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function safeFloatOrNull(value) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
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

    function downloadText(filename, data) {
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function tryCopyToClipboard(text) {
        if (!navigator?.clipboard?.writeText) {
            return false;
        }
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn('Copie presse-papier impossible :', error);
            return false;
        }
    }

    async function showAlert({ title, message, variant }) {
        if (A.components?.confirmDialog?.alert) {
            await A.components.confirmDialog.alert({
                title,
                message,
                variant
            });
        } else {
            alert(message);
        }
    }
})();
