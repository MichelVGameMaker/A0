// ui-admin.js — écran Admin pour outils avancés
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

    A.openAdmin = function openAdmin() {
        ensureRefs();
        highlightSettingsTab();
        hideTimerForSettings();
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
        refs.screenStatsList = document.getElementById('screenStatsList');
        refs.screenStatsDetail = document.getElementById('screenStatsDetail');
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenAdmin = document.getElementById('screenAdmin');
        refs.screenVolume = document.getElementById('screenVolume');
        refs.screenVolumeMuscle = document.getElementById('screenVolumeMuscle');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.btnSettingsAdmin = document.getElementById('btnSettingsAdmin');
        refs.btnAdminBack = document.getElementById('btnAdminBack');
        refs.btnAdminUpdateFitHeroMapping = document.getElementById('btnAdminUpdateFitHeroMapping');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const { btnSettingsAdmin, btnAdminBack, btnAdminUpdateFitHeroMapping } = ensureRefs();

        btnSettingsAdmin?.addEventListener('click', () => {
            A.openAdmin();
        });

        btnAdminBack?.addEventListener('click', () => {
            A.openSettings?.();
        });

        btnAdminUpdateFitHeroMapping?.addEventListener('click', () => {
            void generateFitHeroMappingFile(btnAdminUpdateFitHeroMapping);
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
            screenStatsList,
            screenStatsDetail,
            screenSettings,
            screenAdmin,
            screenVolume,
            screenVolumeMuscle,
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
            screenStatsList,
            screenStatsDetail,
            screenSettings,
            screenAdmin,
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
            alert('Fichier de mapping FitHero généré.');
        } catch (error) {
            console.warn('Génération mapping FitHero échouée :', error);
            alert('La génération du mapping FitHero a échoué.');
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
        const rawMissing = localStorage.getItem(FIT_HERO_MISSING_STORAGE_KEY);
        const userMappings = parseMappings(rawUserMapping);
        const missingSlugs = new Set(parseMissing(rawMissing));
        return userMappings.filter((entry) => entry?.slug && (!missingSlugs.size || missingSlugs.has(entry.slug)));
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

    function parseMissing(raw) {
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (error) {
            console.warn('Slugs FitHero inconnus invalides :', error);
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
})();
