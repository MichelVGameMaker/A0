// ui-calendar.js — modale "Calendrier" (navigation mois + swipe)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', ensureRefs);

    /* ACTIONS */
    /**
     * Ouvre la modale calendrier et rend les jours du mois courant.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.openCalendar = async function openCalendar() {
        const { dlgCalendar, bigCalendar, calTitle } = assertRefs();
        bigCalendar.innerHTML = '';

        const base =
            A.calendarMonth || new Date(A.activeDate.getFullYear(), A.activeDate.getMonth(), 1);
        const year = base.getFullYear();
        const month = base.getMonth();

        if (calTitle) {
            calTitle.textContent = base.toLocaleDateString('fr-FR', {
                month: 'long',
                year: 'numeric'
            });
        }

        const today = A.today();
        const first = new Date(year, month, 1);
        const startIndex = (first.getDay() + 6) % 7;
        const sessionDates = new Set((await db.listSessionDates()).map((item) => item.date));

        const grid = document.createElement('div');
        grid.className = 'month-grid';

        ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((label) => {
            const header = document.createElement('div');
            header.className = 'dow';
            header.textContent = label;
            grid.appendChild(header);
        });

        for (let index = 0; index < startIndex; index += 1) {
            grid.appendChild(document.createElement('div'));
        }

        const lastDay = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= lastDay; day += 1) {
            const date = new Date(year, month, day);
            const key = A.ymd(date);
            const isSelected = A.ymd(date) === A.ymd(A.activeDate);
            const hasSession = sessionDates.has(key);
            const planned = await isPlannedDate(date);
            const isFuture = date >= today;

            const cell = document.createElement('button');
            cell.className = 'day-cell';
            cell.textContent = String(day);

            if (hasSession) {
                cell.classList.add('has-session');
            } else if (planned && isFuture) {
                cell.classList.add('planned');
            }
            if (isSelected) {
                cell.classList.add('selected');
            }

            cell.addEventListener('click', async () => {
                A.activeDate = date;
                A.currentAnchor = date;
                await A.populateRoutineSelect();
                await A.renderWeek();
                await A.renderSession();
                dlgCalendar.close();
            });

            grid.appendChild(cell);
        }

        bigCalendar.appendChild(grid);
        dlgCalendar.showModal();

        let touchStartX = null;
        bigCalendar.ontouchstart = (event) => {
            touchStartX = event.touches[0].clientX;
        };
        bigCalendar.ontouchend = async (event) => {
            if (touchStartX == null) {
                return;
            }
            const delta = event.changedTouches[0].clientX - touchStartX;
            touchStartX = null;
            if (Math.abs(delta) < 40) {
                return;
            }
            A.calendarMonth = new Date(year, month + (delta < 0 ? 1 : -1), 1);
            await A.openCalendar();
        };
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.dlgCalendar = document.getElementById('dlgCalendar');
        refs.bigCalendar = document.getElementById('bigCalendar');
        refs.calTitle = document.getElementById('calTitle');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = ['dlgCalendar', 'bigCalendar'];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-calendar.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    async function isPlannedDate(date) {
        const plan = await db.getActivePlan();
        if (!plan) {
            return false;
        }
        const weekday = ((date.getDay() + 6) % 7) + 1;
        return Boolean(plan.days[String(weekday)]);
    }
})();
