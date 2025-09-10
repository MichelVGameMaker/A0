// ui-calendar.js — modale "Navigation rapide" (mois courant)

(async function(){
  const A = window.App;

  A.openCalendar = async function openCalendar(){
    const dlg = A.el.dlgCalendar;
    const big = A.el.bigCalendar;
    big.innerHTML = '';

    const tdy = A.today();
    const year = tdy.getFullYear();
    const month = tdy.getMonth();

    const first = new Date(year, month, 1);
    const startIdx = (first.getDay() + 6) % 7; // lundi=0

    const sessDates = new Set((await db.listSessionDates()).map(x => x.date));

    const grid = document.createElement('div');
    grid.className = 'month-grid';

    // entêtes
    ['L','M','M','J','V','S','D'].forEach(lbl=>{
      const h = document.createElement('div'); h.className='dow'; h.textContent=lbl; grid.appendChild(h);
    });

    for (let i=0;i<startIdx;i++) grid.appendChild(document.createElement('div'));

    const lastDay = new Date(year, month+1, 0).getDate();
    for (let d=1; d<=lastDay; d++) {
      const dt  = new Date(year, month, d);
      const key = A.ymd(dt);
      const isSelected = A.ymd(dt) === A.ymd(A.activeDate);
      const hasSession = sessDates.has(key);
      const planned = await isPlannedDate(dt);
      const isFuture = dt >= tdy;

      const cell = document.createElement('button');
      cell.className = 'day-cell';
      cell.textContent = d;

      if (hasSession) cell.classList.add('has-session');
      else if (planned && isFuture) cell.classList.add('planned');
      if (isSelected) cell.classList.add('selected');

      cell.addEventListener('click', async ()=>{
        A.activeDate = dt;
        dlg.close();
        await A.refreshPlannedRoutineName();
        await A.renderWeek();
        await A.renderSession();
      });

      grid.appendChild(cell);
    }

    big.appendChild(grid);
    dlg.showModal();
  };

  async function isPlannedDate(d){
    const plan = await db.getActivePlan();
    if (!plan) return false;
    const wd = (d.getDay() + 6) % 7 + 1;
    return Boolean(plan.days[String(wd)]);
  }

})();
