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
        highlightSettingsTab();
        hideTimerForSettings();
        A.renderVolumeScreen?.();
        switchScreen('screenVolume');
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
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenVolume = document.getElementById('screenVolume');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.tabSettings = document.getElementById('tabSettings');
        refs.btnSettingsExercises = document.getElementById('btnSettingsExercises');
        refs.btnSettingsRoutines = document.getElementById('btnSettingsRoutines');
        refs.btnSettingsPreferences = document.getElementById('btnSettingsPreferences');
        refs.btnSettingsVolume = document.getElementById('btnSettingsVolume');
        refs.btnSettingsData = document.getElementById('btnSettingsData');
        refs.btnSettingsUpdate = document.getElementById('btnSettingsUpdate');
        refs.btnPreferencesBack = document.getElementById('btnPreferencesBack');
        refs.btnDataBack = document.getElementById('btnDataBack');
        refs.btnDataReloadExercises = document.getElementById('btnDataReloadExercises');
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
            btnPreferencesBack,
            btnDataBack,
            btnDataReloadExercises
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
            void handleUpdateReset();
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
    }

    function highlightSettingsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        if (refs.tabSettings) {
            refs.tabSettings.classList.add('active');
        }
    }

    function hideTimerForSettings() {
        if (typeof A.setTimerVisibility === 'function') {
            A.setTimerVisibility({ forcedHidden: true, reason: 'settings' });
        }
    }

    async function handleUpdateReset() {
        const { btnSettingsUpdate } = ensureRefs();
        const confirmed = window.confirm(
            'Update : cette action supprime les données locales, le cache et le storage. Continuer ?'
        );
        if (!confirmed) {
            return;
        }

        if (btnSettingsUpdate) {
            btnSettingsUpdate.disabled = true;
        }

        try {
            await resetAppStorage();
        } catch (error) {
            console.warn('Reset Update échoué :', error);
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
            screenVolume,
            screenPreferences,
            screenData
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
            screenVolume,
            screenPreferences,
            screenData
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
