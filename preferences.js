(() => {
    const existing = window.App || {};

    /* STATE */
    const STORAGE_KEY = 'a0.preferences';
    const DEFAULTS = {
        restDefaultEnabled: true,
        restDefaultDuration: 80,
        lastRestDuration: 80,
        newSetValueSource: 'last_set',
        timerSize: 'full'
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
        if (stored.restDefaultDuration == null && stored.defaultTimerDuration != null) {
            stored.restDefaultDuration = stored.defaultTimerDuration;
        }
        cache = {
            ...DEFAULTS,
            ...stored
        };
        cache.restDefaultEnabled = typeof cache.restDefaultEnabled === 'boolean' ? cache.restDefaultEnabled : true;
        cache.restDefaultDuration = sanitizeDuration(cache.restDefaultDuration);
        cache.lastRestDuration = sanitizeDuration(cache.lastRestDuration, cache.restDefaultDuration);
        cache.newSetValueSource = normalizeNewSetValueSource(cache.newSetValueSource);
        cache.timerSize = normalizeTimerSize(cache.timerSize);
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

    function sanitizeDuration(value, fallback = DEFAULTS.restDefaultDuration) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
            return fallback;
        }
        return Math.round(number);
    }

    /* EXPORT */
    const preferences = existing.preferences || {};

    preferences.getAll = function getAll() {
        const data = ensureLoaded();
        return { ...data };
    };

    preferences.getRestDefaultEnabled = function getRestDefaultEnabled() {
        const data = ensureLoaded();
        return Boolean(data.restDefaultEnabled);
    };

    preferences.setRestDefaultEnabled = function setRestDefaultEnabled(enabled) {
        const data = ensureLoaded();
        data.restDefaultEnabled = Boolean(enabled);
        persist();
        return data.restDefaultEnabled;
    };

    preferences.getRestDefaultDuration = function getRestDefaultDuration() {
        const data = ensureLoaded();
        return sanitizeDuration(data.restDefaultDuration);
    };

    preferences.setRestDefaultDuration = function setRestDefaultDuration(seconds) {
        const data = ensureLoaded();
        const sanitized = sanitizeDuration(seconds);
        data.restDefaultDuration = sanitized;
        persist();
        return sanitized;
    };

    preferences.getLastRestDuration = function getLastRestDuration() {
        const data = ensureLoaded();
        return sanitizeDuration(data.lastRestDuration, data.restDefaultDuration);
    };

    preferences.setLastRestDuration = function setLastRestDuration(seconds) {
        const data = ensureLoaded();
        const sanitized = sanitizeDuration(seconds, data.restDefaultDuration);
        data.lastRestDuration = sanitized;
        persist();
        return sanitized;
    };

    preferences.getRestDurationForNewSet = function getRestDurationForNewSet() {
        const data = ensureLoaded();
        const source = data.restDefaultEnabled ? data.restDefaultDuration : data.lastRestDuration;
        return sanitizeDuration(source, data.restDefaultDuration);
    };

    preferences.getNewSetValueSource = function getNewSetValueSource() {
        const data = ensureLoaded();
        return normalizeNewSetValueSource(data.newSetValueSource);
    };

    preferences.setNewSetValueSource = function setNewSetValueSource(value) {
        const data = ensureLoaded();
        data.newSetValueSource = normalizeNewSetValueSource(value);
        persist();
        return data.newSetValueSource;
    };

    preferences.getTimerSize = function getTimerSize() {
        const data = ensureLoaded();
        return normalizeTimerSize(data.timerSize);
    };

    preferences.setTimerSize = function setTimerSize(value) {
        const data = ensureLoaded();
        data.timerSize = normalizeTimerSize(value);
        persist();
        return data.timerSize;
    };

    preferences.getDefaultTimerDuration = function getDefaultTimerDuration() {
        return preferences.getRestDefaultDuration();
    };

    preferences.setDefaultTimerDuration = function setDefaultTimerDuration(seconds) {
        return preferences.setRestDefaultDuration(seconds);
    };

    preferences.reset = function reset() {
        cache = { ...DEFAULTS };
        persist();
    };

    function normalizeNewSetValueSource(value) {
        return value === 'last_session' ? 'last_session' : 'last_set';
    }

    function normalizeTimerSize(value) {
        return value === 'reduced' ? 'reduced' : 'full';
    }

    existing.preferences = preferences;
    window.App = existing;
})();
