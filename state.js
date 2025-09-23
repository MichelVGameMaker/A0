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

    window.App = existing;
})();
