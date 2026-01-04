// ui-month-calendar.js — modale "Calendrier" (navigation mois + swipe)
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    let pickerMonth = null;
    let pickerOptions = null;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', ensureRefs);

    /* ACTIONS */
    /**
     * Ouvre la modale calendrier et rend les jours du mois courant.
     * @returns {Promise<void>} Promesse résolue après rendu.
     */
    A.openCalendar = async function openCalendar() {
        const base =
            A.calendarMonth || new Date(A.activeDate.getFullYear(), A.activeDate.getMonth(), 1);
        await renderCalendar({
            base,
            selectedDate: A.activeDate,
            onSelect: async (date) => {
                A.activeDate = date;
                A.currentAnchor = A.startOfWeek(date);
                await A.populateRoutineSelect();
                await A.renderWeek();
                await A.renderSession();
            },
            onMonthChange: async (nextMonth) => {
                A.calendarMonth = nextMonth;
                await A.openCalendar();
            }
        });
    };

    A.openCalendarPicker = async function openCalendarPicker(options = {}) {
        pickerOptions = { ...options };
        const selectedDate = normalizeDate(options.selectedDate || options.date || A.today());
        if (!pickerMonth || options.resetMonth) {
            pickerMonth = options.baseDate || new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        }
        await renderCalendar({
            base: pickerMonth,
            selectedDate,
            onSelect: async (date) => {
                pickerMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                if (typeof pickerOptions.onSelect === 'function') {
                    await pickerOptions.onSelect(date);
                }
            },
            onMonthChange: async (nextMonth) => {
                pickerMonth = nextMonth;
                await A.openCalendarPicker(pickerOptions || {});
            }
        });
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

    async function renderCalendar({ base, selectedDate, onSelect, onMonthChange }) {
        const { dlgCalendar, bigCalendar, calTitle } = assertRefs();
        bigCalendar.innerHTML = '';

        const baseDate = normalizeDate(base);
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();

        if (calTitle) {
            calTitle.textContent = baseDate.toLocaleDateString('fr-FR', {
                month: 'long',
                year: 'numeric'
            });
        }

        const today = A.today();
        const first = new Date(year, month, 1);
        const startIndex = (first.getDay() + 6) % 7;
        const sessionDates = new Set((await db.listSessionDates()).map((item) => item.date));
        const selectedKey =
            selectedDate instanceof Date && typeof A.ymd === 'function' ? A.ymd(selectedDate) : null;

        const grid = document.createElement('div');
        grid.className = 'month-grid';

        ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((label) => {
            const header = document.createElement('div');
            header.className   = 'details centered';
            header.textContent = label;
            grid.appendChild(header);
        });

        for (let index = 0; index < startIndex; index += 1) {
            const filler = document.createElement('div');
            filler.className = 'day-cell placeholder';
            filler.setAttribute('aria-hidden', 'true');
            grid.appendChild(filler);
        }

        const lastDay = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= lastDay; day += 1) {
            const date = new Date(year, month, day);
            const key = A.ymd(date);
            const isSelected = selectedKey ? A.ymd(date) === selectedKey : false;
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
                if (typeof onSelect === 'function') {
                    await onSelect(date);
                }
                dlgCalendar.close();
            });

            grid.appendChild(cell);
        }

        const totalRendered = startIndex + lastDay;
        const totalCells = 42;
        for (let index = totalRendered; index < totalCells; index += 1) {
            const filler = document.createElement('div');
            filler.className = 'day-cell placeholder';
            filler.setAttribute('aria-hidden', 'true');
            grid.appendChild(filler);
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
            const nextMonth = new Date(year, month + (delta < 0 ? 1 : -1), 1);
            if (typeof onMonthChange === 'function') {
                await onMonthChange(nextMonth);
            }
        };
    }

    function normalizeDate(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value;
        }
        if (typeof value === 'string' && value) {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return A.today();
    }

    function assertRefs() {
        ensureRefs();
        const required = ['dlgCalendar', 'bigCalendar'];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-month-calendar.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    async function isPlannedDate(date) {
        const plan = await db.getActivePlan();
        if (!plan) {
            return false;
        }
        if (!plan.startDate) {
            plan.startDate = A.ymd(A.today());
            await db.put('plans', plan);
        }
        const dayIndex = A.getPlanDayIndex?.(date, plan);
        if (!dayIndex) {
            return false;
        }
        return Boolean(plan.days[String(dayIndex)]);
    }
})();
