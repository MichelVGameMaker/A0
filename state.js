(() => {
    const existing = window.App || {};

    /* STATE */
    existing.EMPHASIS = '#0f62fe';
    existing.el = existing.el || {};
    existing.activeDate = null;
    existing.currentAnchor = null;
    existing.plannedRoutineName = null;
    existing.calendarMonth = null;

    /* WIRE */

    /* ACTIONS */

    /* UTILS */
    /**
     * Formatte une date pour l'interface utilisateur.
     * @param {Date} date Date à afficher.
     * @returns {string} Représentation localisée.
     */
    existing.fmtUI = function fmtUI(date) {
        return date
            .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
            .replace('.', '');
    };

    /**
     * Retourne la clé ISO YYYY-MM-DD.
     * @param {Date} date Date source.
     * @returns {string} Clé normalisée.
     */
    existing.ymd = function ymd(date) {
        return date.toISOString().slice(0, 10);
    };

    /**
     * Retourne la date du jour sans composante horaire.
     * @returns {Date} Date du jour.
     */
    existing.today = function today() {
        return new Date(new Date().toDateString());
    };

    /**
     * Ajoute un nombre de jours à une date.
     * @param {Date} date Date de base.
     * @param {number} delta Nombre de jours à ajouter.
     * @returns {Date} Nouvelle date.
     */
    existing.addDays = function addDays(date, delta) {
        const next = new Date(date);
        next.setDate(next.getDate() + delta);
        return next;
    };

    /**
     * Retourne le lundi de la semaine contenant la date fournie.
     * @param {Date} date Date de base.
     * @returns {Date} Lundi correspondant.
     */
    existing.startOfWeek = function startOfWeek(date) {
        const base = new Date(date);
        const day = base.getDay();
        const diff = (day + 6) % 7;
        base.setDate(base.getDate() - diff);
        return new Date(base.toDateString());
    };

    const VALUE_STATE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

    function resolveDefaultValue(element) {
        if (!element) {
            return '';
        }
        if (element.dataset.defaultValue !== undefined) {
            return element.dataset.defaultValue;
        }
        if (element instanceof HTMLSelectElement) {
            const explicitDefault = Array.from(element.options).find((option) => option.defaultSelected);
            if (explicitDefault) {
                return explicitDefault.value;
            }
        }
        if ('defaultValue' in element) {
            return element.defaultValue ?? '';
        }
        return '';
    }

    function normalizeValue(value) {
        if (value == null) {
            return '';
        }
        return String(value);
    }

    /**
     * Met à jour les classes .has-value / .is-default d'un champ.
     * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|null} element Champ cible.
     * @returns {void}
     */
    existing.updateValueState = function updateValueState(element) {
        if (!element || !VALUE_STATE_TAGS.has(element.tagName)) {
            return;
        }
        const defaultValue = normalizeValue(resolveDefaultValue(element));
        element.dataset.defaultValue = defaultValue;
        const currentValue = normalizeValue(element.value);
        const hasUserValue = currentValue.trim().length > 0 && currentValue !== defaultValue;
        const isDefault = !hasUserValue;

        element.classList.toggle('has-value', hasUserValue);
        element.classList.toggle('is-default', isDefault);
    };

    /**
     * Ajoute les écouteurs pour suivre le contenu d'un ou plusieurs champs et ajuster les classes.
     * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|Array<HTMLElement|null>} targets Champs à suivre.
     * @param {{defaultValue?: string}} [options] Options (valeur par défaut explicite).
     * @returns {void}
     */
    existing.watchValueState = function watchValueState(targets, options = {}) {
        const elements = Array.isArray(targets) ? targets : [targets];
        elements.forEach((element) => {
            if (!element || !VALUE_STATE_TAGS.has(element.tagName)) {
                return;
            }
            const defaultValue =
                options.defaultValue !== undefined
                    ? normalizeValue(options.defaultValue)
                    : normalizeValue(resolveDefaultValue(element));
            element.dataset.defaultValue = defaultValue;
            const handler = () => existing.updateValueState(element);
            const eventName = element instanceof HTMLSelectElement ? 'change' : 'input';
            if (!element.dataset.valueStateWired) {
                element.addEventListener(eventName, handler);
                element.dataset.valueStateWired = '1';
            }
            handler();
        });
    };

    window.App = existing;
})();
