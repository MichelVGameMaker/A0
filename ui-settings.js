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
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.tabSettings = document.getElementById('tabSettings');
        refs.btnSettingsExercises = document.getElementById('btnSettingsExercises');
        refs.btnSettingsRoutines = document.getElementById('btnSettingsRoutines');
        refs.btnSettingsPreferences = document.getElementById('btnSettingsPreferences');
        refs.btnSettingsData = document.getElementById('btnSettingsData');
        refs.btnSettingsUpdate = document.getElementById('btnSettingsUpdate');
        refs.btnPreferencesBack = document.getElementById('btnPreferencesBack');
        refs.btnDataBack = document.getElementById('btnDataBack');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const {
            btnSettingsExercises,
            btnSettingsRoutines,
            btnSettingsPreferences,
            btnSettingsData,
            btnSettingsUpdate,
            btnPreferencesBack,
            btnDataBack
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
