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
     * Retourne la clé compacte YYYYMMDD pour une séance.
     * @param {Date} date Date source.
     * @returns {string} Clé compacte.
     */
    existing.sessionId = function sessionId(date) {
        return date.toISOString().slice(0, 10).replace(/-/g, '');
    };

    /**
     * Retourne la date ISO complète d'une séance.
     * @param {Date} date Date source.
     * @returns {string} Date ISO 8601.
     */
    existing.sessionISO = function sessionISO(date) {
        return date.toISOString();
    };

    /**
     * Reconstitue une clé YYYY-MM-DD depuis un identifiant compact.
     * @param {string} id Identifiant YYYYMMDD.
     * @returns {string|null} Clé ISO ou `null`.
     */
    existing.sessionDateKeyFromId = function sessionDateKeyFromId(id) {
        if (!id || typeof id !== 'string' || id.length !== 8) {
            return null;
        }
        return `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;
    };

    /**
     * Calcule un 1RM estimé à partir du poids et des répétitions.
     * @param {number} weight Charge utilisée.
     * @param {number} reps Répétitions réalisées.
     * @returns {number|null} 1RM estimé ou `null`.
     */
    existing.calculateOrm = function calculateOrm(weight, reps) {
        const load = Number(weight);
        const count = Number(reps);
        if (!Number.isFinite(load) || !Number.isFinite(count) || count <= 0) {
            return null;
        }
        return load * (1 + count / 30);
    };

    /**
     * Calcule un 1RM estimé en tenant compte du RPE.
     * @param {number} weight Charge utilisée.
     * @param {number} reps Répétitions réalisées.
     * @param {number} rpe RPE enregistré.
     * @returns {number|null} 1RM estimé ou `null`.
     */
    existing.calculateOrmWithRpe = function calculateOrmWithRpe(weight, reps, rpe) {
        const load = Number(weight);
        const count = Number(reps);
        if (!Number.isFinite(load) || !Number.isFinite(count) || count <= 0) {
            return null;
        }
        const rawRpe = Number.isFinite(Number(rpe)) ? Number(rpe) : 10;
        const normalizedRpe = Math.min(10, Math.max(0, rawRpe));
        const repsInReserve = Math.max(0, 9.5 - normalizedRpe);
        return existing.calculateOrm(load, count + repsInReserve);
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

    /**
     * Calcule l'index de jour dans le planning (1..N) pour une date donnée.
     * @param {Date} date Date ciblée.
     * @param {{length?: number, startDate?: string}|null} plan Plan actif.
     * @returns {number|null} Index du jour (1..N) ou `null` si indéterminé.
     */
    existing.getPlanDayIndex = function getPlanDayIndex(date, plan) {
        if (!plan || !(date instanceof Date)) {
            return null;
        }
        const length = Number.parseInt(plan.length, 10);
        if (!Number.isFinite(length) || length < 1) {
            return null;
        }
        const cappedLength = Math.min(28, Math.max(1, length));
        const startDate = plan.startDate
            ? new Date(`${plan.startDate}T00:00:00`)
            : existing.today();
        const start = new Date(startDate.toDateString());
        const target = new Date(date.toDateString());
        const diffMs = target.getTime() - start.getTime();
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const offset = ((diffDays % cappedLength) + cappedLength) % cappedLength;
        return offset + 1;
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
