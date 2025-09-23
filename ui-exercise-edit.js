// ui-exercise-edit.js — 3.1.2 Ajouter / Modifier un exercice
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = { currentId: null, callerScreen: 'screenExercises', returnTo: null };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        populateSelectors();
        wireForm();
    });

    /* ACTIONS */
    /**
     * Ouvre l'écran d'édition d'exercice.
     * @param {{currentId?: string|null, callerScreen?: string}} [options] Contexte d'ouverture.
     * @returns {Promise<void>} Promesse résolue après affichage.
     */
    A.openExerciseEdit = async function openExerciseEdit(options = {}) {
        const { currentId = null, callerScreen = 'screenExercises', returnTo = null } = options;
        ensureRefs();
        assertRefs();

        state.currentId = currentId;
        state.callerScreen = callerScreen;
        state.returnTo = returnTo;

        A.showExerciseBaseScreen?.(callerScreen);

        refs.exEditTitle.textContent = currentId ? 'Modifier' : 'Ajouter';
        refs.exEditDelete.hidden = !currentId;

        if (currentId) {
            const exercise = await db.get('exercises', currentId);
            if (!exercise) {
                alert('Exercice introuvable.');
                return;
            }
            refs.exName.value = exercise.name || '';
            refs.exTargetMuscle.value = exercise.muscle || '';
            refs.exImage.value = exercise.image || '';
            refs.exInstr.value = Array.isArray(exercise.instructions)
                ? exercise.instructions.join('\n')
                : '';
            updateGroupInfo();
            unselectAllTags(refs.exEquip);
            setSelectedTags(refs.exEquip, exercise.equipmentGroup2 || exercise.equipment);
            unselectAllTags(refs.exSecMuscles);
            setSelectedTags(refs.exSecMuscles, exercise.secondaryMuscles);
        } else {
            refs.exName.value = '';
            refs.exTargetMuscle.value = '';
            refs.exImage.value = '';
            refs.exInstr.value = '';
            unselectAllTags(refs.exEquip);
            unselectAllTags(refs.exSecMuscles);
            refs.exGroupInfo.textContent = '';
        }

        A.showExerciseModal?.('edit');
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenExerciseRead = document.getElementById('screenExerciseRead');
        refs.screenExerciseEdit = document.getElementById('screenExerciseEdit');
        refs.screenSessions = document.getElementById('screenSessions');
        refs.screenExecEdit = document.getElementById('screenExecEdit');
        refs.exEditTitle = document.getElementById('exEditTitle');
        refs.exEditDelete = document.getElementById('exEditDelete');
        refs.exEditBack = document.getElementById('exEditBack');
        refs.exEditOk = document.getElementById('exEditOk');
        refs.exName = document.getElementById('exName');
        refs.exTargetMuscle = document.getElementById('exTargetMuscle');
        refs.exGroupInfo = document.getElementById('exGroupInfo');
        refs.exEquip = document.getElementById('exEquip');
        refs.exSecMuscles = document.getElementById('exSecMuscles');
        refs.exImage = document.getElementById('exImage');
        refs.exInstr = document.getElementById('exInstr');
        refsResolved = true;
        return refs;
    }

    function assertRefs() {
        ensureRefs();
        const required = [
            'screenExercises',
            'screenExerciseEdit',
            'exEditTitle',
            'exEditDelete',
            'exEditBack',
            'exEditOk',
            'exName',
            'exTargetMuscle',
            'exGroupInfo',
            'exEquip',
            'exSecMuscles',
            'exImage',
            'exInstr'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-exercise-edit.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function populateSelectors() {
        const muscleKeys = Object.keys(CFG.muscleTranscode).sort();
        fillTags(refs.exEquip, CFG.equipment);
        fillSelect(refs.exTargetMuscle, muscleKeys, 'Choisir…');
        fillTags(refs.exSecMuscles, muscleKeys);
    }

    function wireForm() {
        refs.exTargetMuscle.addEventListener('change', updateGroupInfo);
        refs.exEditBack?.addEventListener('click', async () => {
            if (state.returnTo === 'read' && state.currentId) {
                await A.openExerciseRead({
                    currentId: state.currentId,
                    callerScreen: state.callerScreen || 'screenExercises'
                });
            } else {
                A.hideExerciseModal?.();
                A.showExerciseBaseScreen?.(state.callerScreen || 'screenExercises');
                state.currentId = null;
                state.returnTo = null;
            }
        });
        refs.exEditOk?.addEventListener('click', () => {
            void save();
        });
        refs.exEditDelete?.addEventListener('click', () => {
            void removeExercise();
        });
    }

    async function removeExercise() {
        if (!state.currentId) {
            return;
        }
        if (!confirm('Supprimer cet exercice ?')) {
            return;
        }
        await db.del('exercises', state.currentId);
        A.removeExerciseFromSelection?.(state.currentId);
        await A.refreshExerciseList?.();
        A.hideExerciseModal?.();
        A.showExerciseBaseScreen?.(state.callerScreen || 'screenExercises');
        state.currentId = null;
        state.returnTo = null;
    }

    async function save() {
        assertRefs();
        const name = refs.exName.value.trim();
        const targetRaw = refs.exTargetMuscle.value;
        const eqList = getSelectedTags(refs.exEquip);
        if (!name || !targetRaw || eqList.length === 0) {
            alert('Les champs Nom, Muscle ciblé et Matériel sont requis.');
            return;
        }

        const secondary = getSelectedTags(refs.exSecMuscles);
        const instructions = (refs.exInstr.value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const image = (refs.exImage.value || '').trim() || null;

        const muscle = CFG.muscleTranscode[String(targetRaw).trim().toLowerCase()] || {};
        const exercise = {
            id: state.currentId || `ex_${Date.now()}`,
            name,
            muscle: targetRaw,
            muscleGroup1: muscle.g1 || null,
            muscleGroup2: muscle.g2 || null,
            muscleGroup3: muscle.g3 || null,
            equipment: eqList,
            equipmentGroup2: eqList,
            secondaryMuscles: secondary,
            instructions,
            image,
            bodyPart: muscle.g1 || null
        };

        await db.put('exercises', exercise);
        if (state.returnTo === 'read' && exercise.id) {
            await A.openExerciseRead({
                currentId: exercise.id,
                callerScreen: state.callerScreen || 'screenExercises'
            });
        } else {
            await A.refreshExerciseList?.();
            A.hideExerciseModal?.();
            A.showExerciseBaseScreen?.(state.callerScreen || 'screenExercises');
            state.currentId = null;
            state.returnTo = null;
        }
    }

    function updateGroupInfo() {
        const value = refs.exTargetMuscle.value;
        const muscle = CFG.decodeMuscle(value);
        refs.exGroupInfo.textContent = [muscle.g1, muscle.g2, muscle.g3].filter(Boolean).join(' • ');
    }

    function fillSelect(select, items, placeholder) {
        select.innerHTML = '';
        if (placeholder && !select.multiple) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = placeholder;
            select.appendChild(option);
        }
        items.forEach((value) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function fillTags(container, items) {
        container.innerHTML = '';
        items.forEach((value) => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = value;
            tag.dataset.value = value;
            tag.addEventListener('click', () => {
                tag.classList.toggle('selected');
            });
            container.appendChild(tag);
        });
    }

    function getSelectedTags(container) {
        return Array.from(container.querySelectorAll('.tag.selected')).map((element) => element.dataset.value);
    }

    function unselectAllTags(container) {
        container.querySelectorAll('.tag').forEach((element) => element.classList.remove('selected'));
    }

    function setSelectedTags(container, values) {
        if (!values) {
            return;
        }
        const arr = Array.isArray(values) ? values : [values];
        const set = new Set(arr);
        container.querySelectorAll('.tag').forEach((tag) => {
            if (set.has(tag.dataset.value)) {
                tag.classList.add('selected');
            }
        });
    }

})();
