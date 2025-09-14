// ui-exercices_list.js — 3.1.1 Bibliothèque d’exercices (liste + filtres + lazy images)
(function(){
  const A = window.App || (window.App = {});
  A.el = A.el || {};

  let currentId = null;       // null = ajout
  let callerScreen = null;    // mémorise l'écran d'origine
  let listMode = 'view';      // 'add' | 'view'
  let onAddCallback = null;   // callback(ids: string[]) quand on confirme en mode add
  let filtersInited = false;
  let selection = new Set();  // ids sélectionnés en mode 'add'

  // ----- Navigation: montrer/masquer écrans -----
  function showScreen(id){
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    document.getElementById(id).hidden = false;
  }

  // ----- Lazy loading des images -----
  let lazyObserver = null;
  function ensureLazyObserver(){
    if (lazyObserver) return lazyObserver;
    lazyObserver = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if (entry.isIntersecting){
          const img = entry.target;
          const src = img.getAttribute('data-src');
          if (src){
            img.src = src;
            img.removeAttribute('data-src');
          }
          lazyObserver.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    return lazyObserver;
  }

  // ----- Barre sticky “Ajouter les exercices (N)” (mode add) -----
  function ensureSelectionBar(){
    if (!A.el.exSelectBar){
      const bar = document.createElement('div');
      bar.id = 'exSelectBar';
      bar.style.position = 'sticky';
      bar.style.top = '0';
      bar.style.zIndex = '10';
      bar.style.padding = '8px 0';
      bar.style.background = 'var(--white)';
      bar.style.display = 'none';

      const btn = document.createElement('button');
      btn.id = 'btnAddSelected';
      btn.className = 'btn primary full';
      btn.textContent = 'Ajouter les exercices';
      btn.addEventListener('click', ()=>{
        if (!selection.size) return;
        const ids = Array.from(selection);
        if (typeof onAddCallback === 'function') onAddCallback(ids);
        // retour à l'écran appelant si connu
        if (callerScreen && document.getElementById(callerScreen)){
          for (const s of document.querySelectorAll('.screen')) s.hidden = true;
          document.getElementById(callerScreen).hidden = false;
        }
      });

      bar.appendChild(btn);
      const content = document.querySelector('#screenExercises .content');
      content?.insertBefore(bar, document.getElementById('exList'));
      A.el.exSelectBar = bar;
      A.el.btnAddSelected = btn;
    }
  }

  function updateSelectionBar(){
    if (listMode !== 'add'){ A.el.exSelectBar && (A.el.exSelectBar.style.display='none'); return; }
    ensureSelectionBar();
    const has = selection.size > 0;
    A.el.exSelectBar.style.display = has ? 'block' : 'none';
    if (A.el.btnAddSelected){
      A.el.btnAddSelected.textContent = has
        ? `Ajouter les exercices (${selection.size})`
        : 'Ajouter les exercices';
    }
  }

  // ----- Rendu d'un item -----
  function renderItem(ex){
    const card = document.createElement('article');
    card.className = 'exercise-card';
    card.setAttribute('role', 'button');

    const row = document.createElement('div');
    row.className = 'row between';

    const left = document.createElement('div');
    left.style.display='flex';
    left.style.alignItems='center';
    left.style.gap='10px';

    // image (lazy)
    const img = document.createElement('img');
    img.alt = ex.name || 'exercice';
    img.width = 40; img.height = 40;
    img.style.width='40px'; img.style.height='40px';
    img.style.borderRadius='8px'; img.style.objectFit='cover';
    img.style.background='#eee'; img.style.marginRight='10px';
    img.loading = 'lazy'; img.decoding = 'async';

    if (ex.image) {
      img.setAttribute('data-src', ex.image);   // ./data/media/<fname>.gif ou URL d’origine
      ensureLazyObserver().observe(img);
    } else {
      img.src = './icons/placeholder-64.png';
    }

    const txtWrap    = document.createElement('div');
    const name       = document.createElement('div');
    name.className   = 'element';
    name.textContent = ex.name || '—';

    // Détails : Équipement (fin) • Muscle ciblé, muscles secondaires
    const details = document.createElement('div');
    details.className = 'details';

    const eq_details = (ex.equipmentGroup2 || ex.equipment || '-').toString().trim();
    const target     = (ex.muscle || ex.muscleGroup2 || ex.muscleGroup3 || '-').toString().trim();
    const secondary  = Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles.filter(Boolean) : [];
    const mu_details = [target, ...secondary].filter(Boolean);

    details.textContent = `${eq_details} • ${mu_details.join(', ')}`;

    txtWrap.append(name, details);
    left.append(img, txtWrap);

    // Comportement selon le mode
    if (listMode === 'add'){
      if (selection.has(ex.id)) card.classList.add('selected');
      card.addEventListener('click', ()=>{
        if (selection.has(ex.id)) selection.delete(ex.id);
        else selection.add(ex.id);
        card.classList.toggle('selected');
        updateSelectionBar();
      });
      row.append(left); // pas de bouton à droite
    } else {
      card.addEventListener('click', ()=> A.openExerciseRead(ex.id, 'screenExercises'));
      row.append(left);
    }

    card.appendChild(row);
    return card;
  }

  // ----- Chargement / filtrage -----
  A.refreshExerciseList = async function(){
    const q = (A.el.exSearch?.value || '').toLowerCase().trim();
    const g = (A.el.exFilterGroup?.value || '').trim(); // muscleGroup2
    const e = (A.el.exFilterEquip?.value || '').trim(); // equipmentGroup2

    const all = await db.getAll('exercises');

    // Filtrage STRICT sur G2
    const filtered = all.filter(x=>{
      if (q && !String(x.name||'').toLowerCase().includes(q)) return false;
      if (g) {
        const mg2 = (x.muscleGroup2 || '').toString().trim();
        if (mg2 !== g) return false;
      }
      if (e) {
        const eg2 = (x.equipmentGroup2 || '').toString().trim();
        if (eg2 !== e) return false;
      }
      return true;
    });

    const list = A.el.exList;
    list.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className='empty';
      empty.textContent = 'Aucun exercice.';
      list.appendChild(empty);
      updateSelectionBar();
      return;
    }

    for (const ex of filtered) list.appendChild(renderItem(ex));
    updateSelectionBar();
  };

  /**
   * Ouvrir la bibliothèque d’exercices
   * @param {Object} opts
   *   - mode: 'add' | 'view'
   *   - from: id de l'écran appelant (ex: 'screenSessions', 'screenRoutine'…)
   *   - onAdd: function(ids: string[])  // callback quand on confirme en mode add
   */
  A.openExercises = async function(opts = {}){
    listMode = opts.mode === 'add' ? 'add' : 'view';
    callerScreen = opts.from || 'screenExercises';
    onAddCallback = typeof opts.onAdd === 'function' ? opts.onAdd : null;

    showScreen('screenExercises');

    // Remplir les filtres depuis CFG (G2) une seule fois
    if (!filtersInited) {
      if (A.el.exFilterGroup) fillSelect(A.el.exFilterGroup, CFG.musclesG2, 'Groupe musculaire');
      if (A.el.exFilterEquip) fillSelect(A.el.exFilterEquip, CFG.equipmentG2 || CFG.equipment, 'Matériel');
      // handlers de filtres + recherche
      A.el.exSearch?.addEventListener('input',  A.refreshExerciseList);
      A.el.exFilterGroup?.addEventListener('change', A.refreshExerciseList);
      A.el.exFilterEquip?.addEventListener('change', A.refreshExerciseList);
      filtersInited = true;
    }

    // Réinitialiser filtres et recherche à chaque ouverture
    if (A.el.exFilterGroup) A.el.exFilterGroup.value = '';
    if (A.el.exFilterEquip) A.el.exFilterEquip.value = '';
    if (A.el.exSearch)      A.el.exSearch.value      = '';

    // Prépare barre de sélection + vide la sélection (mode add)
    ensureSelectionBar();
    selection.clear();
    updateSelectionBar();

    // En-tête : bouton droit “Ajouter” → création d’un exercice
    if (!A.el.exOkList)   A.el.exOkList   = document.getElementById('exOkList');
    if (!A.el.exBackList) A.el.exBackList = document.getElementById('exBackList');

    if (A.el.exOkList){
      A.el.exOkList.textContent = 'Créer nouveau';
      A.el.exOkList.onclick = ()=> A.openExerciseEdit(null, 'screenExercises');
    }

    // Retour : en mode add → ne rien ajouter, revenir à l’appelant si connu
    if (A.el.exBackList){
      A.el.exBackList.onclick = ()=>{
        if (listMode === 'add' && callerScreen && document.getElementById(callerScreen)){
          for (const s of document.querySelectorAll('.screen')) s.hidden = true;
          document.getElementById(callerScreen).hidden = false;
        } else {
          // fallback
          showScreen('screenSessions');
        }
      };
    }

    await A.refreshExerciseList();
  };

  // ----- Handlers init -----
  document.addEventListener('DOMContentLoaded', ()=>{
    // refs
    A.el.exSearch      = document.getElementById('exSearch');
    A.el.exFilterGroup = document.getElementById('exFilterGroup');
    A.el.exFilterEquip = document.getElementById('exFilterEquip');
    A.el.exList        = document.getElementById('exList');
    A.el.exBackList    = document.getElementById('exBackList');
    A.el.exOkList      = document.getElementById('exOkList');
  });

  function fillSelect(sel, items, placeholder){
    if (!sel) return;
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = ''; opt0.textContent = placeholder; sel.appendChild(opt0);
    for (const v of items) {
      const o = document.createElement('option');
      o.value = v; o.textContent = v; sel.appendChild(o);
    }
  }
})();
