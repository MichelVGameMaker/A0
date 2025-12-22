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
        switchScreen('screenSettings');
    };

    A.openPreferences = function openPreferences() {
        ensureRefs();
        highlightSettingsTab();
        switchScreen('screenPreferences');
    };

    A.openData = function openData() {
        ensureRefs();
        highlightSettingsTab();
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
            btnPreferencesBack,
            btnDataBack
        } = ensureRefs();

        btnSettingsExercises?.addEventListener('click', () => {
            highlightSettingsTab();
            void A.openExercises({ callerScreen: 'screenSettings' });
        });
        btnSettingsRoutines?.addEventListener('click', () => {
            highlightSettingsTab();
            void A.openRoutineList();
        });
        btnSettingsPreferences?.addEventListener('click', () => {
            A.openPreferences();
        });
        btnSettingsData?.addEventListener('click', () => {
            A.openData();
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
