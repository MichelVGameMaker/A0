// ui-week.js — barre semaine (7 jours) + swipe

(async function(){
  const A = window.App;

  A.renderWeek = async function renderWeek() {
    const wrap = A.el.weekStrip;
    wrap.innerHTML = '';

    const start = A.addDays(A.currentAnchor, -3); // 7 jours centrés
    const sessDates = new Set((await db.listSessionDates()).map(x => x.date));
    const tdy = A.today();
    
    // boucle qui crée les 7 boutons
    for (let i=0; i<7; i++) {
      const d = A.addDays(start, i);
      const key = A.ymd(d);
      const isSelected = A.ymd(d) === A.ymd(A.activeDate);
      const hasSession = sessDates.has(key);            // ⚫️ passé ou futur = noir
      const planned = await isPlannedDate(d);           // 🩶 prévu par plan
      const isFuture = d >= tdy;

      const btn = document.createElement('button');
      btn.className = 'day';
      btn.textContent = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric' }).replace('.', '');

      // Ordre logique: session (noir) ou planned (gris futur)
      if (hasSession) btn.classList.add('has-session');
      else if (planned && isFuture) btn.classList.add('planned');

      // Sélection (emphase) — DOIT prendre le dessus visuellement
      if (isSelected) btn.classList.add('selected');

      btn.addEventListener('click', async () => {
        A.activeDate = d;
        await A.refreshPlannedRoutineName();
        await A.renderWeek();
        await A.renderSession();
      });

      wrap.appendChild(btn);
    }
    
  // Assure que le jour sélectionné est visible
  const sel = wrap.querySelector('.day.selected');
  if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });    
  };

  // Helper : la date a-t-elle une routine prévue dans le plan actif ?
  async function isPlannedDate(d){
    const plan = await db.getActivePlan();
    if (!plan) return false;
    const wd = (d.getDay() + 6) % 7 + 1; // 1=lun..7=dim
    return Boolean(plan.days[String(wd)]);
  }

  // Gestes swipe (avance/recul d’une semaine)
  let x0 = null;
  document.addEventListener('DOMContentLoaded', () => {
    const el = A.el.weekStrip;
    el.addEventListener('touchstart', (e)=>{ x0 = e.touches[0].clientX; }, {passive:true});
    el.addEventListener('touchend',   (e)=>{
      if (x0==null) return; const dx = e.changedTouches[0].clientX - x0; x0=null;
      if (Math.abs(dx) < 40) return;
      A.currentAnchor = A.addDays(A.currentAnchor, dx<0 ? +7 : -7);
      A.renderWeek();
    });
  });

})();
