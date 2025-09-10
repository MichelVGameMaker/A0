// state.js — constantes, utilitaires, état global

window.App = {
  EMPHASIS: '#0f62fe', // couleur d’emphase (sélection)

  // Utils dates
  fmtUI(d) { return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'2-digit' }).replace('.', ''); },
  ymd(d)   { return d.toISOString().slice(0,10); },
  today()  { return new Date(new Date().toDateString()); }, // strip heure
  addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; },

  // DOM refs remplis dans init.js
  el: {},

  // État runtime
  activeDate: null,     // sélection courante (Date)
  currentAnchor: null,  // ancre semaine (Date)
  plannedRoutineName: null, // nom de la routine prévue du jour (plan actif)
  calendarMonth: null, // Date au 1er du mois affiché dans la modale
};
