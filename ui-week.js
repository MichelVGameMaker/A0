// ui-week.js — barre semaine (7 jours)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const DAYS_PER_PAGE = 7;
    const HALF_WINDOW = Math.floor(DAYS_PER_PAGE / 2);
    const VIRTUAL_PAGE_COUNT = 3;
    const virtualState = {
        pages: [],
        adjusting: false,
        centerStart: null,
        sessionDates: new Set(),
        plan: null,
        today: null,
        bound: false
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', ensureRefs);

    /* ACTIONS */
    /**
     * Rend la barre des sept jours centrée sur l'ancre courante.
     * @returns {Promise<void>} Promesse résolue après mise à jour.
     */
    A.renderWeek = async function renderWeek() {
        const { weekStrip } = assertRefs();
        const pages = ensureVirtualStrip();

        const [sessionDates, plan] = await Promise.all([
            db.listSessionDates(),
            db.getActivePlan()
        ]);

        virtualState.sessionDates = new Set(sessionDates.map((item) => item.date));
        virtualState.plan = plan;
        virtualState.today = A.today();

        const anchor = A.currentAnchor || A.activeDate || virtualState.today || A.today();
        const centerStart = A.addDays(anchor, -HALF_WINDOW);
        virtualState.centerStart = centerStart;

        renderPage(pages[0], A.addDays(centerStart, -DAYS_PER_PAGE));
        renderPage(pages[1], centerStart);
        renderPage(pages[2], A.addDays(centerStart, DAYS_PER_PAGE));

        virtualState.adjusting = true;
        requestAnimationFrame(() => {
            weekStrip.scrollLeft = pages[1].offsetLeft;
            requestAnimationFrame(() => {
                virtualState.adjusting = false;
            });
        });
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

    function ensureVirtualStrip() {
        const { weekStrip } = assertRefs();
        if (!virtualState.pages.length) {
            weekStrip.innerHTML = '';
            for (let index = 0; index < VIRTUAL_PAGE_COUNT; index += 1) {
                const page = document.createElement('div');
                page.className = 'week-page';
                virtualState.pages.push(page);
                weekStrip.appendChild(page);
            }
        }
        if (!virtualState.bound) {
            weekStrip.addEventListener('scroll', handleScroll, { passive: true });
            virtualState.bound = true;
        }
        return virtualState.pages;
    }

    function renderPage(container, startDate) {
        if (!container) {
            return;
        }
        container.innerHTML = '';

        for (let index = 0; index < DAYS_PER_PAGE; index += 1) {
            const date = A.addDays(startDate, index);
            const key = A.ymd(date);
            const isSelected = A.activeDate && A.ymd(date) === A.ymd(A.activeDate);
            const hasSession = virtualState.sessionDates.has(key);
            const planned = isPlannedDate(date, virtualState.plan);
            const isFuture = virtualState.today && date >= virtualState.today;

            const button = document.createElement('button');
            button.type = 'button';
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
                A.currentAnchor = new Date(date);
                await A.populateRoutineSelect();
                await A.renderWeek();
                await A.renderSession();
            });

            container.appendChild(button);
        }
    }

    function handleScroll() {
        if (virtualState.adjusting) {
            return;
        }
        const { weekStrip } = assertRefs();
        const pages = virtualState.pages;
        if (pages.length < 3) {
            return;
        }

        const scrollLeft = weekStrip.scrollLeft;
        const tolerance = 4;
        const prevOffset = pages[0].offsetLeft;
        const nextOffset = pages[2].offsetLeft;

        if (scrollLeft <= prevOffset + tolerance) {
            shiftPages(-1);
            return;
        }
        if (nextOffset && scrollLeft >= nextOffset - tolerance) {
            shiftPages(1);
        }
    }

    function shiftPages(direction) {
        const { weekStrip } = assertRefs();
        if (direction === 0 || !weekStrip) {
            return;
        }

        virtualState.adjusting = true;

        const baseAnchor = A.currentAnchor || virtualState.centerStart || virtualState.today || A.today();

        if (direction > 0) {
            const [prev, center, next] = virtualState.pages;
            weekStrip.appendChild(prev);
            virtualState.pages = [center, next, prev];
            virtualState.centerStart = A.addDays(virtualState.centerStart || baseAnchor, DAYS_PER_PAGE);
            A.currentAnchor = A.addDays(baseAnchor, DAYS_PER_PAGE);
        } else {
            const [prev, center, next] = virtualState.pages;
            weekStrip.insertBefore(next, prev);
            virtualState.pages = [next, prev, center];
            virtualState.centerStart = A.addDays(virtualState.centerStart || baseAnchor, -DAYS_PER_PAGE);
            A.currentAnchor = A.addDays(baseAnchor, -DAYS_PER_PAGE);
        }

        renderPage(virtualState.pages[0], A.addDays(virtualState.centerStart, -DAYS_PER_PAGE));
        renderPage(virtualState.pages[1], virtualState.centerStart);
        renderPage(virtualState.pages[2], A.addDays(virtualState.centerStart, DAYS_PER_PAGE));

        requestAnimationFrame(() => {
            weekStrip.scrollLeft = virtualState.pages[1].offsetLeft;
            requestAnimationFrame(() => {
                virtualState.adjusting = false;
            });
        });
    }

    function isPlannedDate(date, plan) {
        if (!plan) {
            return false;
        }
        const weekday = (date.getDay() + 6) % 7 + 1;
        return Boolean(plan.days?.[String(weekday)]);
    }
})();
