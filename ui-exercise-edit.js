// ui-exercise-edit.js — 3.1.2 Ajouter / Modifier un exercice
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = { currentId: null, callerScreen: 'screenExercises', originType: null };
    const tagGroups = { equipment: null, secondary: null };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        assertRefs();
        populateSelectors();
        wireForm();
        wireValueStates();
    });

    /* ACTIONS */
    /**
     * Ouvre l'écran d'édition d'exercice.
     * @param {{currentId?: string|null, callerScreen?: string}} [options] Contexte d'ouverture.
     * @returns {Promise<void>} Promesse résolue après affichage.
     */
    A.openExerciseEdit = async function openExerciseEdit(options = {}) {
        const { currentId = null, callerScreen = 'screenExercises' } = options;
        ensureRefs();
        assertRefs();
        ensureTagGroups();

        state.currentId = currentId;
        state.callerScreen = callerScreen;
        state.originType = null;

        refs.exEditTitle.textContent = currentId ? 'Modifier' : 'Ajouter';
        refs.exEditDelete.hidden = !currentId;

        if (currentId) {
            const meta = await db.getExerciseWithMeta(currentId);
            const exercise = meta.exercise;
            if (!exercise) {
                alert('Exercice introuvable.');
                return;
            }
            state.originType = meta.originType;
            refs.exName.value = exercise.name || '';
            refs.exTargetMuscle.value = exercise.muscle || '';
            refs.exImage.value = exercise.image || '';
            refs.exInstr.value = Array.isArray(exercise.instructions)
                ? exercise.instructions.join('\n')
                : '';
            updateGroupInfo();
            tagGroups.equipment?.setSelection(exercise.equipmentGroup2 || exercise.equipment);
            tagGroups.secondary?.setSelection(exercise.secondaryMuscles);
        } else {
            refs.exName.value = '';
            refs.exTargetMuscle.value = '';
            refs.exImage.value = '';
            refs.exInstr.value = '';
            tagGroups.equipment?.clearSelection();
            tagGroups.secondary?.clearSelection();
            refs.exGroupInfo.textContent = '';
        }

        refreshValueStates();
        switchScreen('screenExerciseEdit');
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
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenStatExercises = document.getElementById('screenStatExercises');
        refs.screenStatExercisesDetail = document.getElementById('screenStatExercisesDetail');
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
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
        ensureTagGroups();
        tagGroups.equipment.setItems(CFG.equipment);
        fillSelect(refs.exTargetMuscle, muscleKeys, 'Choisir…');
        tagGroups.secondary.setItems(muscleKeys);
    }

    function wireForm() {
        refs.exTargetMuscle.addEventListener('change', updateGroupInfo);
        refs.exEditBack?.addEventListener('click', async () => {
            if (state.callerScreen === 'screenExerciseRead' && state.currentId) {
                await A.openExerciseRead({ currentId: state.currentId, callerScreen: 'screenExercises' });
            } else {
                await A.openExercises({ callerScreen: 'screenExerciseEdit' });
            }
        });
        refs.exEditOk?.addEventListener('click', () => {
            void save();
        });
        refs.exEditDelete?.addEventListener('click', () => {
            void removeExercise();
        });
    }

    function wireValueStates() {
        const { exName, exTargetMuscle, exImage, exInstr } = assertRefs();
        A.watchValueState?.([exName, exTargetMuscle, exImage, exInstr]);
    }

    async function removeExercise() {
        if (!state.currentId) {
            return;
        }
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Supprimer un exercice',
                message: 'Supprimer cet exercice ?'
            })
            : confirm('Supprimer cet exercice ?');
        if (!confirmed) {
            return;
        }
        if (state.originType === 'native') {
            await db.deleteExerciseOverride(state.currentId);
        } else {
            await db.deleteCustomExercise(state.currentId);
        }
        await A.openExercises({ callerScreen: 'screenExerciseEdit' });
    }

    async function save() {
        assertRefs();
        const name = refs.exName.value.trim();
        const targetRaw = refs.exTargetMuscle.value;
        const eqList = tagGroups.equipment ? tagGroups.equipment.getSelection() : [];
        if (!name || !targetRaw || eqList.length === 0) {
            alert('Les champs Nom, Muscle ciblé et Matériel sont requis.');
            return;
        }

        const secondary = tagGroups.secondary ? tagGroups.secondary.getSelection() : [];
        const instructions = (refs.exInstr.value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const image = (refs.exImage.value || '').trim() || null;

        const existingMeta = state.currentId ? await db.getExerciseWithMeta(state.currentId) : null;
        const existing = existingMeta?.exercise || null;
        const { originType, ...existingBase } = existing || {};
        const muscle = CFG.muscleTranscode[String(targetRaw).trim().toLowerCase()] || {};
        const exercise = {
            ...(existingBase || {}),
            id: state.currentId || buildUserExerciseId(),
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

        if (state.currentId && existingMeta?.originType === 'native') {
            await db.saveExerciseOverride(state.currentId, exercise);
        } else if (state.currentId && existingMeta?.originType === 'imported') {
            await db.saveCustomExercise(exercise, 'import');
        } else {
            await db.saveCustomExercise(exercise, 'user');
        }
        if (state.callerScreen === 'screenExerciseRead' && exercise.id) {
            await A.openExerciseRead({ currentId: exercise.id, callerScreen: 'screenExercises' });
        } else {
            await A.openExercises({ callerScreen: 'screenExerciseEdit' });
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

    function ensureTagGroups() {
        if (!tagGroups.equipment) {
            tagGroups.equipment = new A.TagGroup(refs.exEquip, { mode: 'mono', columns: 2 });
        }
        if (!tagGroups.secondary) {
            tagGroups.secondary = new A.TagGroup(refs.exSecMuscles, { mode: 'multi', columns: 4 });
        }
    }

    function switchScreen(target) {
        const { screenExercises, screenExerciseEdit, screenSessions, screenExecEdit } = assertRefs();
        const map = {
            screenExercises,
            screenExerciseEdit,
            screenSessions,
            screenExecEdit,
            screenExerciseRead: refs.screenExerciseRead,
            screenRoutineEdit: refs.screenRoutineEdit,
            screenRoutineMoveEdit: refs.screenRoutineMoveEdit,
            screenStatExercises: refs.screenStatExercises,
            screenStatExercisesDetail: refs.screenStatExercisesDetail,
            screenSettings: refs.screenSettings,
            screenStatMuscles: refs.screenStatMuscles,
            screenStatMusclesDetail: refs.screenStatMusclesDetail,
            screenPreferences: refs.screenPreferences,
            screenData: refs.screenData
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }

    function refreshValueStates() {
        A.updateValueState?.(refs.exName);
        A.updateValueState?.(refs.exTargetMuscle);
        A.updateValueState?.(refs.exImage);
        A.updateValueState?.(refs.exInstr);
    }

    function buildUserExerciseId() {
        return `user-exercise--${Date.now()}`;
    }
})();
