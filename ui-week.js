// ui-week.js — barre semaine (7 jours)
(function(){
  const A = window.App;

  A.renderWeek = async function renderWeek() {
    const wrap = A.el.weekStrip;
    if (!wrap) return;
    wrap.innerHTML = '';

    const start = A.addDays(A.currentAnchor, -3); // 7 jours centrés
    const sessDates = new Set((await db.listSessionDates()).map(x => x.date));
    const tdy = A.today();

    for (let i=0; i<7; i++) {
      const d = A.addDays(start, i);
      const key = A.ymd(d);
      const isSelected = A.ymd(d) === A.ymd(A.activeDate);
      const hasSession = sessDates.has(key);            // noir (passé ou futur)
      const planned = await isPlannedDate(d);           // gris si futur
      const isFuture = d >= tdy;

      const btn = document.createElement('button');
      btn.className = 'day';
      btn.textContent = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric' }).replace('.', '');

      if (hasSession) btn.classList.add('has-session');
      else if (planned && isFuture) btn.classList.add('planned');
      if (isSelected) btn.classList.add('selected');

      btn.addEventListener('click', async () => {
        A.activeDate = d;
        await A.refreshPlannedRoutineName();
        await A.renderWeek();
        await A.renderSession();
      });

      wrap.appendChild(btn);
    }

    // S'assurer que le jour sélectionné est visible
    const sel = wrap.querySelector('.day.selected');
    if (sel && typeof sel.scrollIntoView === 'function') {
      sel.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  };

  async function isPlannedDate(d){
    const plan = await db.getActivePlan();
    if (!plan) return false;
    const wd = (d.getDay() + 6) % 7 + 1; // 1=lun..7=dim
    return Boolean(plan.days[String(wd)]);
  }
})();
