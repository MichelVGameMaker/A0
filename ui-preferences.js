// ui-preferences.js — préférences écran
(() => {
    const A = window.App;

    const refs = {};
    let refsResolved = false;

    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireEvents();
        renderRestSummary();
        renderNewSetSummary();
    });

    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.btnPreferencesRest = document.getElementById('btnPreferencesRest');
        refs.prefRestSummary = document.getElementById('prefRestSummary');
        refs.dlgPreferencesRest = document.getElementById('dlgPreferencesRest');
        refs.prefRestEnabled = document.getElementById('prefRestEnabled');
        refs.prefRestMinutes = document.getElementById('prefRestMinutes');
        refs.prefRestSeconds = document.getElementById('prefRestSeconds');
        refs.prefRestSave = document.getElementById('prefRestSave');
        refs.prefRestCancel = document.getElementById('prefRestCancel');
        refs.btnPreferencesNewSet = document.getElementById('btnPreferencesNewSet');
        refs.prefNewSetSummary = document.getElementById('prefNewSetSummary');
        refs.dlgPreferencesNewSet = document.getElementById('dlgPreferencesNewSet');
        refs.prefNewSetLastSet = document.getElementById('prefNewSetLastSet');
        refs.prefNewSetLastSession = document.getElementById('prefNewSetLastSession');
        refs.prefNewSetSave = document.getElementById('prefNewSetSave');
        refs.prefNewSetCancel = document.getElementById('prefNewSetCancel');
        refsResolved = true;
        return refs;
    }

    function wireEvents() {
        const {
            btnPreferencesRest,
            dlgPreferencesRest,
            prefRestSave,
            prefRestCancel,
            btnPreferencesNewSet,
            dlgPreferencesNewSet,
            prefNewSetSave,
            prefNewSetCancel
        } = ensureRefs();

        btnPreferencesRest?.addEventListener('click', () => {
            openRestDialog();
        });

        prefRestSave?.addEventListener('click', (event) => {
            event.preventDefault();
            saveRestPreferences();
            dlgPreferencesRest?.close();
        });

        prefRestCancel?.addEventListener('click', (event) => {
            event.preventDefault();
            dlgPreferencesRest?.close();
        });

        dlgPreferencesRest?.addEventListener('close', () => {
            renderRestSummary();
        });

        btnPreferencesNewSet?.addEventListener('click', () => {
            openNewSetDialog();
        });

        prefNewSetSave?.addEventListener('click', (event) => {
            event.preventDefault();
            saveNewSetPreferences();
            dlgPreferencesNewSet?.close();
        });

        prefNewSetCancel?.addEventListener('click', (event) => {
            event.preventDefault();
            dlgPreferencesNewSet?.close();
        });

        dlgPreferencesNewSet?.addEventListener('close', () => {
            renderNewSetSummary();
        });

    }

    function openRestDialog() {
        const { dlgPreferencesRest, prefRestEnabled, prefRestMinutes, prefRestSeconds } = ensureRefs();
        if (!dlgPreferencesRest || !prefRestEnabled || !prefRestMinutes || !prefRestSeconds) {
            return;
        }
        const restEnabled = A.preferences?.getRestDefaultEnabled?.() !== false;
        const restDuration = A.preferences?.getRestDefaultDuration?.() ?? 80;
        const { minutes, seconds } = splitDuration(restDuration);
        prefRestEnabled.checked = restEnabled;
        prefRestMinutes.value = String(minutes);
        prefRestSeconds.value = String(seconds).padStart(2, '0');
        if (typeof dlgPreferencesRest.showModal === 'function') {
            dlgPreferencesRest.showModal();
        }
    }

    function saveRestPreferences() {
        const { prefRestEnabled, prefRestMinutes, prefRestSeconds } = ensureRefs();
        if (!prefRestEnabled || !prefRestMinutes || !prefRestSeconds) {
            return;
        }
        const nextEnabled = prefRestEnabled.checked;
        const duration = parseDuration(prefRestMinutes.value, prefRestSeconds.value);
        const fallback = A.preferences?.getRestDefaultDuration?.() ?? 80;
        const nextDuration = duration > 0 ? duration : fallback;
        A.preferences?.setRestDefaultEnabled?.(nextEnabled);
        A.preferences?.setRestDefaultDuration?.(nextDuration);
    }

    function renderRestSummary() {
        const { prefRestSummary } = ensureRefs();
        if (!prefRestSummary) {
            return;
        }
        const restEnabled = A.preferences?.getRestDefaultEnabled?.() !== false;
        const defaultDuration = A.preferences?.getRestDefaultDuration?.() ?? 80;
        const lastDuration = A.preferences?.getLastRestDuration?.() ?? defaultDuration;
        const activeDuration = restEnabled ? defaultDuration : lastDuration;
        const statusLabel = restEnabled ? 'Activée' : 'Désactivée';
        const durationLabel = formatDuration(activeDuration);
        prefRestSummary.textContent = `${statusLabel} — ${durationLabel}`;
    }

    function openNewSetDialog() {
        const { dlgPreferencesNewSet, prefNewSetLastSet, prefNewSetLastSession } = ensureRefs();
        if (!dlgPreferencesNewSet || !prefNewSetLastSet || !prefNewSetLastSession) {
            return;
        }
        const source = A.preferences?.getNewSetValueSource?.() ?? 'last_set';
        prefNewSetLastSet.checked = source !== 'last_session';
        prefNewSetLastSession.checked = source === 'last_session';
        if (typeof dlgPreferencesNewSet.showModal === 'function') {
            dlgPreferencesNewSet.showModal();
        }
    }

    function saveNewSetPreferences() {
        const { prefNewSetLastSet, prefNewSetLastSession } = ensureRefs();
        if (!prefNewSetLastSet || !prefNewSetLastSession) {
            return;
        }
        const next = prefNewSetLastSession.checked ? 'last_session' : 'last_set';
        A.preferences?.setNewSetValueSource?.(next);
    }

    function renderNewSetSummary() {
        const { prefNewSetSummary } = ensureRefs();
        if (!prefNewSetSummary) {
            return;
        }
        const source = A.preferences?.getNewSetValueSource?.() ?? 'last_set';
        const label = source === 'last_session' ? 'Dernière séance' : 'Dernière série';
        prefNewSetSummary.textContent = label;
    }

    function splitDuration(totalSeconds) {
        const secondsSafe = Math.max(0, safeInt(totalSeconds, 0));
        const minutes = Math.floor(secondsSafe / 60);
        const seconds = secondsSafe % 60;
        return { minutes, seconds };
    }

    function parseDuration(minutesValue, secondsValue) {
        const minutes = Math.max(0, safeInt(minutesValue, 0));
        const secondsRaw = Math.max(0, safeInt(secondsValue, 0));
        const seconds = Math.min(59, secondsRaw);
        return minutes * 60 + seconds;
    }

    function formatDuration(totalSeconds) {
        const { minutes, seconds } = splitDuration(totalSeconds);
        return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
    }

    function safeInt(value, fallback = 0) {
        const number = Number.parseInt(value, 10);
        return Number.isFinite(number) ? number : fallback;
    }

})();
