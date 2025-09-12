// ui-exercise-edit.js — 3.1.2 Ajouter / Modifier un exercice

(function(){
  const A = window.App;

  let currentId = null; // null = ajout

  function showScreen(id){
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    document.getElementById(id).hidden = false;
  }

  // Ouvrir l’éditeur
  A.openExerciseEdit = async function(id){
    currentId = id || null;

    // entête
    document.getElementById('exEditTitle').textContent = currentId ? 'Modifier' : 'Ajouter';
    // bouton supprimer visible seulement en modification
    document.getElementById('exEditDelete').style.display = currentId ? 'inline-block' : 'none';

    // remplir si modification
    if (currentId) {
      const ex = await db.get('exercises', currentId);
      if (!ex) return alert('Exercice introuvable.');
      A.el.exName.value  = ex.name || '';
      A.el.exGroup3.value= ex.group3 || '';
      A.el.exEquip.value = ex.equipment || '';
      A.el.exDesc.value  = ex.description || '';
    } else {
      A.el.exName.value  = '';
      A.el.exGroup3.value= '';
      A.el.exEquip.value = '';
      A.el.exDesc.value  = '';
    }

    showScreen('screenExerciseEdit');
  };

  // Validation des champs requis
  function validate(){
    const name = A.el.exName.value.trim();
    const g3   = A.el.exGroup3.value;
    const eq   = A.el.exEquip.value;
    if (!name || !g3 || !eq) {
      alert('Nom, Groupe musculaire et Matériel sont requis.');
      return null;
    }
    return { name, g3, eq, desc: A.el.exDesc.value.trim() };
  }

  // Enregistrer (OK)
  async function save(){
    const v = validate();
    if (!v) return;

    // calcul Group1 + Group2
    const { g2, g1 } = A.cfg.mapGroups(v.g3);

    const obj = {
      id: currentId || `ex_${Date.now()}`,
      name: v.name,
      group1: g1,         // calculé
      group2: g2,         // calculé
      group3: v.g3,       // saisi
      equipment: v.eq,    // saisi
      description: v.desc
    };

    await db.put('exercises', obj);
    // retour à la liste
    await A.openExercises();
  }

  // Supprimer
  async function remove(){
    if (!currentId) return;
    if (!confirm('Supprimer cet exercice ?')) return;
    await db.del('exercises', currentId);
    await A.openExercises();
  }

  // Wire
  document.addEventListener('DOMContentLoaded', ()=>{
    A.el.exName = document.getElementById('exName');
    A.el.exGroup3 = document.getElementById('exGroup3');
    A.el.exEquip = document.getElementById('exEquip');
    A.el.exDesc = document.getElementById('exDesc');
    // Remplir les listes depuis le fichier cfg
    fillSelect(A.el.exGroup3, A.cfg.musclesG3, 'Choisir…');
    fillSelect(A.el.exEquip,  A.cfg.equipment, 'Choisir…');
    // Activer les boutons 
    document.getElementById('exEditBack').addEventListener('click', ()=> A.openExercises());
    document.getElementById('exEditOk').addEventListener('click', save);
    document.getElementById('exEditDelete').addEventListener('click', remove);
  });


  function fillSelect(sel, items, placeholder) {
    sel.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value=''; o0.textContent = placeholder; sel.appendChild(o0);
    for (const v of items){
      const o = document.createElement('option');
      o.value = v; o.textContent = v; sel.appendChild(o);
    }
  }
  
})();
