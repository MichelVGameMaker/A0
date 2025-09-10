// ui-exercises.js — 3.1.1 Bibliothèque d’exercices (liste)

(function(){
  const A = window.App;

  // Navigation: montrer/masquer écrans
  function showScreen(id){
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    document.getElementById(id).hidden = false;
  }

  // Mapper Group3 -> Group2/Group1 (calcul à l’enregistrement)
  function mapGroups(g3){
    const upper = ['Pectoraux','Dos','Épaules','Biceps','Triceps'];
    const legs  = ['Quadriceps','Ischio','Mollets'];
    if (!g3) return { g2:'', g1:'' };
    if (upper.includes(g3)) return { g2: (g3==='Biceps'||g3==='Triceps')?'Bras':g3, g1:'Haut' };
    if (legs.includes(g3))  return { g2:'Jambes', g1:'Bas' };
    if (g3==='Abdos')       return { g2:'Abdos', g1:'Cardio' };
    if (g3==='Cardio')      return { g2:'Cardio', g1:'Cardio' };
    return { g2:'', g1:'' };
  }

  // Rendu d'un item
  function renderItem(ex){
    const card = document.createElement('article');
    card.className = 'exercise-card';

    const row = document.createElement('div');
    row.className = 'row between';

    const left = document.createElement('div');
    // petite “image” placeholder
    const img = document.createElement('div');
    img.style.width='40px'; img.style.height='40px'; img.style.borderRadius='8px';
    img.style.background='#eee'; img.style.marginRight='10px';
    const txtWrap = document.createElement('div');
    const name = document.createElement('div'); name.className='element'; name.textContent = ex.name;
    const details = document.createElement('div'); details.className='details'; details.textContent = ex.group3 || '';
    left.style.display='flex'; left.style.alignItems='center';
    left.append(img, (function(){ const w=document.createElement('div'); w.append(name,details); return w; })());

    const btn = document.createElement('button');
    btn.className = 'btn'; btn.textContent = 'Modifier ✏️';
    btn.addEventListener('click', ()=> A.openExerciseEdit(ex.id));

    row.append(left, btn);
    card.appendChild(row);
    card.addEventListener('click', ()=> btn.click());
    return card;
  }

  // Chargement / filtrage
  A.refreshExerciseList = async function(){
    const q = (A.el.exSearch.value || '').toLowerCase();
    const g = A.el.exFilterGroup.value || '';
    const e = A.el.exFilterEquip.value || '';

    const all = await db.getAll('exercises');
    const filtered = all.filter(x=>{
      const okQ = !q || x.name.toLowerCase().includes(q);
      const okG = !g || x.group3 === g;
      const okE = !e || x.equipment === e;
      return okQ && okG && okE;
    });

    const list = A.el.exList;
    list.innerHTML = '';
    // bouton + déjà au-dessus
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className='empty';
      empty.textContent = 'Aucun exercice.';
      list.appendChild(empty);
      return;
    }

    for (const ex of filtered) list.appendChild(renderItem(ex));
  };

  // Entrée dans l’écran liste
  A.openExercises = async function(){
    showScreen('screenExercises');
    await A.refreshExerciseList();
  };

  // Handlers init
  document.addEventListener('DOMContentLoaded', ()=>{
    // refs DOM
    A.el.exSearch      = document.getElementById('exSearch');
    A.el.exFilterGroup = document.getElementById('exFilterGroup');
    A.el.exFilterEquip = document.getElementById('exFilterEquip');
    A.el.exList        = document.getElementById('exList');

    document.getElementById('btnExAdd').addEventListener('click', ()=> A.openExerciseEdit(null));
    A.el.exSearch.addEventListener('input', A.refreshExerciseList);
    A.el.exFilterGroup.addEventListener('change', A.refreshExerciseList);
    A.el.exFilterEquip.addEventListener('change', A.refreshExerciseList);
  });

  // Exporte util pour l’éditeur (group mapping)
  A._mapGroups = mapGroups;

})();
