// ui-exercises.js — 3.1.1 Bibliothèque d’exercices (liste + filtres + lazy images)

(function(){
  const A = window.App;

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

  // ----- Rendu d'un item -----
  function renderItem(ex){
    const card = document.createElement('article');
    card.className = 'exercise-card';

    const row = document.createElement('div');
    row.className = 'row between';

    const left = document.createElement('div');
    left.style.display='flex'; left.style.alignItems='center';

    // image (lazy)
    const img = document.createElement('img');
    img.alt = ex.name || 'exercice';
    img.width = 40; img.height = 40;
    img.style.width='40px'; img.style.height='40px';
    img.style.borderRadius='8px'; img.style.objectFit='cover';
    img.style.background='#eee'; img.style.marginRight='10px';
    img.loading = 'lazy'; img.decoding = 'async';

    if (ex.image) {
      // ex.image est déjà soit ./data/media/<fname>.gif, soit l’URL d’origine
      // lazy: on met data-src et l’observer se chargera de remplir src
      img.setAttribute('data-src', ex.image);
      ensureLazyObserver().observe(img);
    } else {
      // fallback si pas d’image
      img.src = './icons/placeholder-64.png';
    }

    const txtWrap = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'element';
    name.textContent = ex.name || '—';

    const details = document.createElement('div');
    details.className = 'details';
    details.textContent = `${ex.muscleGroup3 || ex.muscle || '-'} • ${ex.equipmentGroup2 || ex.equipment || '-'}`;

    txtWrap.append(name, details);
    left.append(img, txtWrap);

    const btn = document.createElement('button');
    btn.className = 'btn'; btn.textContent = 'Modifier ✏️';
    btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); A.openExerciseEdit(ex.id); });

    row.append(left, btn);
    card.appendChild(row);
    card.addEventListener('click', ()=> btn.click()); // tout le bloc ouvre l’éditeur

    return card;
  }

  // ----- Chargement / filtrage -----
  A.refreshExerciseList = async function(){
    const q = (A.el.exSearch?.value || '').toLowerCase().trim();
    const g = (A.el.exFilterGroup?.value || '').trim(); // muscleGroup3
    const e = (A.el.exFilterEquip?.value || '').trim(); // equipmentGroup2

    let all = await db.getAll('exercises');

    const filtered = all.filter(x=>{
      if (q && !String(x.name||'').toLowerCase().includes(q)) return false;
      if (g && x.muscleGroup3 !== g) return false;
      if (e && x.equipmentGroup2 !== e) return false;
      return true;
    });
	const filtered = all.filter(x=>{
		// recherche par nom
		if (q && !String(x.name||'').toLowerCase().includes(q)) return false;
		// filtre muscle (appliquer seulement si la donnée existe)
		if (g) {
			const mg3 = x.muscleGroup3 || x.muscle || '';
			if (mg3 !== g) return false;
		}
		// filtre matériel (appliquer seulement si la donnée existe)
		if (e) {
			const eg2 = x.equipmentGroup2 || x.equipment || '';
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
      return;
    }

    for (const ex of filtered) list.appendChild(renderItem(ex));
  };

  // ----- Entrée dans l’écran liste -----
  A.openExercises = async function(){
    showScreen('screenExercises');

    // Remplir les filtres depuis CFG (Groupes calculés à partir de tes tables) (une seule fois)
	if (!filtersInited) {
+		if (A.el.exFilterGroup) fillSelect(A.el.exFilterGroup, CFG.musclesG3, 'Groupe musculaire');
		if (A.el.exFilterEquip) fillSelect(A.el.exFilterEquip, CFG.equipment, 'Matériel');
		filtersInited = true;
+	}
	// Toujours remettre les filtres à vide et la recherche à vide à chaque ouverture de l'écran
	if (A.el.exFilterGroup) A.el.exFilterGroup.value = '';
	if (A.el.exFilterEquip) A.el.exFilterEquip.value = '';
	if (A.el.exSearch)      A.el.exSearch.value      = '';

    await A.refreshExerciseList();
  };

  // ----- Handlers init -----
  document.addEventListener('DOMContentLoaded', ()=>{
    // refs
    A.el.exSearch      = document.getElementById('exSearch');
    A.el.exFilterGroup = document.getElementById('exFilterGroup');
    A.el.exFilterEquip = document.getElementById('exFilterEquip');
    A.el.exList        = document.getElementById('exList');

    // bouton ajouter (éditeur)
    const btnAdd = document.getElementById('btnExAdd');
    if (btnAdd) btnAdd.addEventListener('click', ()=> A.openExerciseEdit(null));

    // filtres
    A.el.exSearch?.addEventListener('input',  A.refreshExerciseList);
    A.el.exFilterGroup?.addEventListener('change', A.refreshExerciseList);
    A.el.exFilterEquip?.addEventListener('change', A.refreshExerciseList);
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
