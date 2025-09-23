// ui-week.js — barre semaine (7 jours)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', ensureRefs);

    /* ACTIONS */
    /**
     * Rend la barre des sept jours centrée sur l'ancre courante.
     * @returns {Promise<void>} Promesse résolue après mise à jour.
     */
    A.renderWeek = async function renderWeek() {
        const { weekStrip } = assertRefs();
        weekStrip.innerHTML = '';

        const start = A.addDays(A.currentAnchor, -3);
        const sessionDates = new Set((await db.listSessionDates()).map((item) => item.date));
        const today = A.today();

        for (let index = 0; index < 7; index += 1) {
            const date = A.addDays(start, index);
            const key = A.ymd(date);
            const isSelected = A.ymd(date) === A.ymd(A.activeDate);
            const hasSession = sessionDates.has(key);
            const planned = await isPlannedDate(date);
            const isFuture = date >= today;

            const button = document.createElement('button');
            button.className = 'day';
            button.textContent = date
                .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
                .replace('.', '');

            if (hasSession) {
                button.classList.add('has-session');
            } else if (planned && isFuture) {
                button.classList.add('planned');
            }
            if (isSelected) {
                button.classList.add('selected');
            }

            button.addEventListener('click', async () => {
                A.activeDate = date;
                await A.populateRoutineSelect();
                await A.renderWeek();
                await A.renderSession();
            });

            weekStrip.appendChild(button);
        }

        const selected = weekStrip.querySelector('.day.selected');
        if (selected && typeof selected.scrollIntoView === 'function') {
            selected.scrollIntoView({ inline: 'center', block: 'nearest' });
        }
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.weekStrip = document.getElementById('weekStrip');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        if (!refs.weekStrip) {
            throw new Error('ui-week.js: référence weekStrip manquante');
        }
        return refs;
    }

    async function isPlannedDate(date) {
        const plan = await db.getActivePlan();
        if (!plan) {
            return false;
        }
        const weekday = (date.getDay() + 6) % 7 + 1;
        return Boolean(plan.days[String(weekday)]);
    }
})();
