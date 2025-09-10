// ui-calendar.js — modale "Calendrier" (navigation mois + swipe)

(function () {
  const A = window.App;

  A.openCalendar = async function openCalendar() {
    const dlg = A.el.dlgCalendar;
    const big = A.el.bigCalendar;
    big.innerHTML = "";

    // Mois affiché (ancre)
    const base =
      A.calendarMonth ||
      new Date(A.activeDate.getFullYear(), A.activeDate.getMonth(), 1);
    const year = base.getFullYear();
    const month = base.getMonth();

    // Titre "mois année"
    const titleEl = document.getElementById("calTitle");
    if (titleEl) {
      titleEl.textContent = base.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
    }

    const tdy = A.today();
    const first = new Date(year, month, 1);
    const startIdx = (first.getDay() + 6) % 7; // lundi=0

    const sessDates = new Set((await db.listSessionDates()).map((x) => x.date));

    const grid = document.createElement("div");
    grid.className = "month-grid";

    // En-têtes
    ["L", "M", "M", "J", "V", "S", "D"].forEach((lbl) => {
      const h = document.createElement("div");
      h.className = "dow";
      h.textContent = lbl;
      grid.appendChild(h);
    });

    for (let i = 0; i < startIdx; i++) grid.appendChild(document.createElement("div"));

    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(year, month, d);
      const key = A.ymd(dt);
      const isSelected = A.ymd(dt) === A.ymd(A.activeDate);
      const hasSession = sessDates.has(key);
      const planned = await isPlannedDate(dt);
      const isFuture = dt >= tdy;

      const cell = document.createElement("button");
      cell.className = "day-cell";
      cell.textContent = d;

      if (hasSession) cell.classList.add("has-session");
      else if (planned && isFuture) cell.classList.add("planned");
      if (isSelected) cell.classList.add("selected");

      cell.addEventListener("click", async () => {
        A.activeDate = dt;
        A.currentAnchor = dt; // recale la barre semaine sur la date choisie
        await A.populateRoutineSelect();
        await A.renderWeek();
        await A.renderSession();
        dlg.close();
      });

      grid.appendChild(cell);
    }

    big.appendChild(grid);
    dlg.showModal();

    // Swipe gauche/droite pour changer de mois
    let x0 = null;
    big.ontouchstart = (e) => {
      x0 = e.touches[0].clientX;
    };
    big.ontouchend = async (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      A.calendarMonth = new Date(year, month + (dx < 0 ? +1 : -1), 1);
      await A.openCalendar();
    };
  };

  async function isPlannedDate(d) {
    const plan = await db.getActivePlan();
    if (!plan) return false;
    const wd = ((d.getDay() + 6) % 7) + 1; // 1=lundi..7=dimanche
    return Boolean(plan.days[String(wd)]);
  }
})();
