(() => {
    const existing = window.App || {};

    /* STATE */
    const STORAGE_KEY = 'a0.preferences';
    const DEFAULTS = {
        defaultTimerDuration: 90
    };
    let cache = null;

    /* ACTIONS */
    function ensureLoaded() {
        if (cache) {
            return cache;
        }
        let stored = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            stored = raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Préférences illisibles, réinitialisation.', error);
        }
        if (!stored || typeof stored !== 'object') {
            stored = {};
        }
        cache = {
            ...DEFAULTS,
            ...stored
        };
        cache.defaultTimerDuration = sanitizeDuration(cache.defaultTimerDuration);
        return cache;
    }

    function persist() {
        if (!cache) {
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.warn('Impossible de sauvegarder les préférences.', error);
        }
    }

    function sanitizeDuration(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
            return DEFAULTS.defaultTimerDuration;
        }
        return Math.round(number);
    }

    /* EXPORT */
    const preferences = existing.preferences || {};

    preferences.getAll = function getAll() {
        const data = ensureLoaded();
        return { ...data };
    };

    preferences.getDefaultTimerDuration = function getDefaultTimerDuration() {
        const data = ensureLoaded();
        return sanitizeDuration(data.defaultTimerDuration);
    };

    preferences.setDefaultTimerDuration = function setDefaultTimerDuration(seconds) {
        const data = ensureLoaded();
        const sanitized = sanitizeDuration(seconds);
        data.defaultTimerDuration = sanitized;
        persist();
        return sanitized;
    };

    preferences.reset = function reset() {
        cache = { ...DEFAULTS };
        persist();
    };

    existing.preferences = preferences;
    window.App = existing;
})();
