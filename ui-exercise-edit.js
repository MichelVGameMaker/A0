// ui-exercise-edit.js — 3.1.2 Ajouter / Modifier un exercice

(function(){
  const A = window.App;

  let currentId = null;       // null = ajout
  let callerScreen = null;    // mémorise l'écran d'origine

	/*	=======================================================
		================   SECTION DONNNES   ==================
		======================================================= */
	A.openExerciseEdit = async function(id, from){
		
		ensureRefs();
		if (!assertRefs()) return;
		currentId    = id || null;
		callerScreen = from || 'screenExercises'; // par défaut

		// entête
		document.getElementById('exEditTitle').textContent = currentId ? 'Modifier' : 'Ajouter';
		// bouton supprimer visible seulement en modification
		document.getElementById('exEditDelete').style.display = currentId ? 'inline-block' : 'none';

		// remplir depuis la base de données si modification
		if (currentId) {
			
			const ex = await db.get('exercises', currentId);
			if (!ex) return alert('Exercice introuvable.');
			
			// Champs simples
			A.el.exName.value          = ex.name || '';
			A.el.exTargetMuscle.value  = ex.muscle || '';
			A.el.exImage.value   = ex.image || '';
			A.el.exInstr.value   = Array.isArray(ex.instructions) ? ex.instructions.join('\n') : '';

			// Info groupes (g1•g2•g3)
			const mu = CFG.decodeMuscle(A.el.exTargetMuscle.value);
			if (A.el.exGroupInfo) A.el.exGroupInfo.textContent = [mu.g1, mu.g2, mu.g3].filter(Boolean).join(' • ');

		// Matériel (tags)
		unselectAllTags(A.el.exEquip);
		setSelectedTags(A.el.exEquip, ex.equipmentGroup2 || ex.equipment);

		// Muscles secondaires (tags)
		unselectAllTags(A.el.exSecMuscles);
		setSelectedTags(A.el.exSecMuscles, ex.secondaryMuscles);

	  
		} else {
			
			// Champs simples
			A.el.exName.value         = '';
			A.el.exTargetMuscle.value = '';
			A.el.exImage.value        = '';
			A.el.exInstr.value        = '';	
			
			// Matériel (checklist)
			unselectAllTags(A.el.exEquip);
			
			// Muscles secondaires (checklist)
			unselectAllTags(A.el.exSecMuscles);
			
			// Info groupes (g1•g2•g3)
			if (A.el.exGroupInfo) A.el.exGroupInfo.textContent = '';
			
		}

		showScreen('screenExerciseEdit');
	};

	/*	=======================================================
		==================   SECTION WIRE   ===================
		======================================================= */
	document.addEventListener('DOMContentLoaded', ()=>{
		// Références au DOMContentLoaded
		ensureRefs();

		// Remplir les listes depuis le fichier CFG
		const MUSCLE_KEYS = Object.keys(CFG.muscleTranscode).sort();
		fillTags(A.el.exEquip, CFG.equipment);
		fillSelect(A.el.exTargetMuscle, MUSCLE_KEYS, 'Choisir…');
		fillTags(A.el.exSecMuscles, MUSCLE_KEYS);

		// Mettre à jour les champs calculés en cas de modification
		A.el.exTargetMuscle.addEventListener('change', ()=>{
			const val = A.el.exTargetMuscle.value;
			const mu  = CFG.decodeMuscle(val);
			A.el.exGroupInfo.textContent = [mu.g1, mu.g2, mu.g3].filter(Boolean).join(' • ');
		});

		// Activer les boutons 
		document.getElementById('exEditBack')?.addEventListener('click', async ()=>{
			if (callerScreen === 'screenExerciseRead' && currentId){
				A.openExerciseRead(currentId);   // retour à la fiche
			} else {
				A.openExercises();               // retour à la liste
			}
		});
		document.getElementById('exEditOk').addEventListener('click', save);
		document.getElementById('exEditDelete').addEventListener('click', remove);
	});

	/*	=======================================================
		=================   SECTION ACTION   ==================
		======================================================= */
	function showScreen(id){
		for (const s of document.querySelectorAll('.screen')) s.hidden = true;
		document.getElementById(id).hidden = false;
	}	
	// Supprimer
	async function remove(){
		if (!currentId) return;
		if (!confirm('Supprimer cet exercice ?')) return;
		await db.del('exercises', currentId);
		await A.openExercises();
	}
	// Enregistrer (OK)
	async function save(){
		ensureRefs();
		if (!assertRefs()) return;

		const name      = A.el.exName.value.trim();
		const targetRaw = A.el.exTargetMuscle.value
		const eqList    = getSelectedTags(A.el.exEquip);
		
		if (!name || !targetRaw || eqList.length === 0) {
			alert('Les champs Nom, Muscle ciblé et Matériel sont requis.');
			return;
		}

		const secondary = getSelectedTags(A.el.exSecMuscles);
		const instructions = (A.el.exInstr.value || '')
		.split(/\r?\n/)
		.map(s=>s.trim())
		.filter(Boolean);
	
		const image = (A.el.exImage.value || '').trim() || null;
		
		const mu = CFG.muscleTranscode[String(targetRaw).trim().toLowerCase()] || {};
		const bodyPart = mu.g1 || null;   // <- pas de mapping externe : on prend g1
	
		const obj = {
			id: currentId || `ex_${Date.now()}`,
			name,
			// champ brut et calculs des groupes
			muscle      : targetRaw,
			muscleGroup1: mu.g1 || null,
			muscleGroup2: mu.g2 || null,
			muscleGroup3: mu.g3 || null,
			// champ brut et calculs des groupes
			equipment      : eqList,
			equipmentGroup2: eqList,
			// champ brut
			secondaryMuscles: secondary,
			instructions,
			image,
			bodyPart
		};

	  await db.put('exercises', obj);
		if (callerScreen === 'screenExerciseRead' && obj.id){
			await A.openExerciseRead(obj.id);   // revient à la fiche lecture
		} else {
			await A.openExercises();            // revient à la liste
		}
	}
	
	/*	=======================================================
		=================   SECTION UTILS   ===================
		======================================================= */
	// Valider les données
	function ensureRefs(){
	  // Si déjà branché, on sort
	  if (A.el && A.el.exName) return;
	  A.el                = A.el || {};
	  A.el.exName         = document.getElementById('exName');
	  A.el.exEquip        = document.getElementById('exEquip');
	  A.el.exTargetMuscle = document.getElementById('exTargetMuscle');   // Muscle ciblé
	  A.el.exGroupInfo    = document.getElementById('exGroupInfo')
	  A.el.exSecMuscles   = document.getElementById('exSecMuscles');
	  A.el.exImage        = document.getElementById('exImage');
	  A.el.exInstr        = document.getElementById('exInstr');
	}
	// Vérifier que tout est bien présent
	function assertRefs(){
		const must = ['exName','exTargetMuscle','exGroupInfo','exEquip','exSecMuscles','exImage','exInstr'];
		const missing = must.filter(k => !A.el[k]);
		if (missing.length){
			console.error('Champs manquants dans le DOM:', missing);
			alert('Formulaire incomplet dans le HTML. Manque: ' + missing.join(', '));
			return false;
		}
		return true;
	}
	// Remplir une liste déroulante
	function fillSelect(sel, items, placeholder){
		sel.innerHTML = '';
		if (placeholder && !sel.multiple) {
			const o0 = document.createElement('option');
			o0.value=''; o0.textContent = placeholder;
			sel.appendChild(o0);
		}
		for (const v of items){
			const o = document.createElement('option');
			o.value = v;
			o.textContent = v;
			sel.appendChild(o);
		}
	}
	// Remplir une liste de tags
	function fillTags(container, items){
		container.innerHTML = '';
		for (const v of items){
			const tag = document.createElement('span');
			tag.className = 'tag';
			tag.textContent = v;
			tag.dataset.value = v;
			tag.addEventListener('click', ()=>{
				tag.classList.toggle('selected');
			});
			container.appendChild(tag);
		}
	}
	// Tags
	function getSelectedTags(container){
		return Array.from(container.querySelectorAll('.tag.selected'))
					.map(el => el.dataset.value);
	}
	function unselectAllTags(container){
		container.querySelectorAll('.tag').forEach(el => el.classList.remove('selected'));
	}
	function setSelectedTags(container, values){
		if (!values) return;
		const arr = Array.isArray(values) ? values : [values];
		const set = new Set(arr);
		container.querySelectorAll('.tag').forEach(tag => {
			if (set.has(tag.dataset.value)) tag.classList.add('selected');
		});
	}

})();
