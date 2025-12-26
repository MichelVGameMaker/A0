/* db.js — IndexedDB helpers (stores: exercises, routines, plans, sessions) */
const db = (() => {
    /* STATE */
    const DB_NAME = 'A0-db';
    const DB_VER = 2;
    let handle;
    let memoryMode = false;
    const memoryStores = {
        exercises: new Map(),
        routines: new Map(),
        plans: new Map(),
        sessions: new Map()
    };

    /* WIRE */

    /* ACTIONS */
    /**
     * Initialise la connexion IndexedDB et mémorise l'instance.
     * @returns {Promise<void>} Promesse résolue lorsque la connexion est prête.
     */
    async function init() {
        try {
            handle = await open();
            memoryMode = false;
        } catch (error) {
            console.warn('IndexedDB indisponible, bascule en mémoire.', error);
            handle = null;
            memoryMode = true;
        }
    }

    /**
     * Retourne une valeur depuis un store.
     * @param {string} store Nom du store cible.
     * @param {IDBValidKey} key Clé recherchée.
     * @returns {Promise<unknown>} Valeur trouvée ou `null`.
     */
    async function get(store, key) {
        if (memoryMode) {
            return memoryGet(store, key);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store).get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Écrit une valeur dans un store.
     * @param {string} store Nom du store cible.
     * @param {unknown} value Donnée à persister.
     * @returns {Promise<boolean>} `true` une fois l'opération terminée.
     */
    async function put(store, value) {
        if (memoryMode) {
            return memoryPut(store, value);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store, 'readwrite').put(value);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Liste toutes les valeurs d'un store.
     * @param {string} store Nom du store cible.
     * @returns {Promise<unknown[]>} Valeurs présentes.
     */
    async function getAll(store) {
        if (memoryMode) {
            return memoryGetAll(store);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store).getAll();
            request.onsuccess = () => {
                const result = request.result || [];
                if (store === 'sessions') {
                    resolve(result.map((session) => ensureSession(session)));
                    return;
                }
                resolve(result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Compte les enregistrements d'un store.
     * @param {string} store Nom du store cible.
     * @returns {Promise<number>} Nombre d'entrées.
     */
    async function count(store) {
        if (memoryMode) {
            return memoryCount(store);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store).count();
            request.onsuccess = () => resolve(request.result || 0);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Supprime une entrée depuis un store.
     * @param {string} store Nom du store cible.
     * @param {IDBValidKey} key Clé à supprimer.
     * @returns {Promise<boolean>} `true` une fois l'opération réalisée.
     */
    async function del(store, key) {
        if (memoryMode) {
            return memoryDelete(store, key);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store, 'readwrite').delete(key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Récupère une séance via sa date.
     * @param {string} dateKey Clé de date (YYYY-MM-DD) ou identifiant YYYYMMDD.
     * @returns {Promise<unknown>} Séance ou `null`.
     */
    async function getSession(dateKey) {
        const sessionId = normalizeSessionId(dateKey);
        if (!sessionId) {
            return null;
        }
        const session = await get('sessions', sessionId);
        return ensureSession(session);
    }

    /**
     * Sauvegarde une séance.
     * @param {object} session Objet séance à persister.
     * @returns {Promise<boolean>} Confirmation d'écriture.
     */
    async function saveSession(session) {
        const hydrated = ensureSession(session);
        return put('sessions', hydrated);
    }

    /**
     * Liste les dates disposant d'une séance.
     * @returns {Promise<Array<{date: string}>>} Dates recensées.
     */
    async function listSessionDates() {
        const all = await getAll('sessions');
        return all
            .map((session) => ({ date: normalizeDateKey(session?.id || session?.date) }))
            .filter((entry) => entry.date);
    }

    /**
     * Retourne le plan actif.
     * @returns {Promise<object|null>} Plan actif ou `null`.
     */
    async function getActivePlan() {
        const all = await getAll('plans');
        return all.find((plan) => plan.active) || null;
    }

    /**
     * Importe les exercices externes la première fois.
     * @returns {Promise<void>} Promesse résolue une fois l'import terminé ou ignoré.
     */
    async function importExternalExercisesIfNeeded(options = {}) {
        const { force = false } = options;
        const currentCount = await countStore('exercises');
        if (!force && currentCount > 0) {
            return;
        }

        try {
            const url = new URL('data/exercises.json', document.baseURI).href;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('data/exercises.json introuvable');
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                console.warn('exercises.json pas un tableau, import ignoré.');
                return;
            }

            const BATCH = 200;
            for (let index = 0; index < data.length; index += BATCH) {
                const slice = data.slice(index, index + BATCH);
                const rows = await Promise.all(slice.map(normalizeExercise));
                for (const row of rows) {
                    if (row) {
                        await put('exercises', row);
                    }
                }
            }
            console.log('Import exercises terminé.');
        } catch (error) {
            console.warn('Import externe sauté :', error.message);
        }
    }

    async function reset() {
        if (handle) {
            handle.close();
            handle = null;
        }

        if (memoryMode) {
            Object.values(memoryStores).forEach((store) => store.clear());
        }

        memoryMode = false;

        if (!('indexedDB' in window)) {
            return true;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
            request.onblocked = () => resolve(false);
        });
    }

    /* UTILS */
    function transaction(store, mode = 'readonly') {
        if (!handle) {
            throw new Error('IndexedDB non initialisé.');
        }
        return handle.transaction(store, mode).objectStore(store);
    }

    function open() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                reject(new Error('IndexedDB non disponible dans ce contexte.'));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VER);
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains('exercises')) {
                    database.createObjectStore('exercises', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('routines')) {
                    database.createObjectStore('routines', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('plans')) {
                    database.createObjectStore('plans', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('sessions')) {
                    database.createObjectStore('sessions', { keyPath: 'id' });
                } else {
                    const store = event.target.transaction.objectStore('sessions');
                    if (store.keyPath !== 'id') {
                        const existingRequest = store.getAll();
                        existingRequest.onsuccess = () => {
                            const legacySessions = existingRequest.result || [];
                            database.deleteObjectStore('sessions');
                            const newStore = database.createObjectStore('sessions', { keyPath: 'id' });
                            legacySessions.forEach((legacy) => {
                                const migrated = ensureSession(legacy);
                                if (migrated?.id) {
                                    newStore.put(migrated);
                                }
                            });
                        };
                    }
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function fileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    async function normalizeExercise(exercise) {
        const id = String(exercise.exerciseId || exercise.id || exercise._id || exercise.uuid || '').trim();
        if (!id) {
            return null;
        }

        const rawEquipment = Array.isArray(exercise.equipments) && exercise.equipments.length
            ? exercise.equipments[0]
            : exercise.equipment;
        const equipment = CFG.decodeEquipment(rawEquipment);

        const rawTarget = Array.isArray(exercise.targetMuscles) && exercise.targetMuscles.length
            ? exercise.targetMuscles[0]
            : exercise.target;
        const rawBody = Array.isArray(exercise.bodyParts) && exercise.bodyParts.length
            ? exercise.bodyParts[0]
            : exercise.bodyPart;
        const muscle = CFG.muscleTranscode[String(rawTarget || '').toLowerCase()] || {};

        let image = exercise.gifUrl || exercise.image || null;
        if (image) {
            try {
                const fileName = image.split('/').pop();
                const localPath = new URL(`data/media/${fileName}`, document.baseURI).href;
                if (await fileExists(localPath)) {
                    image = localPath;
                }
            } catch {
                /* ignore */
            }
        }

        return {
            id,
            name: exercise.name || exercise.exercise || id,
            equipment: rawEquipment || null,
            equipmentGroup1: equipment.g1 || null,
            equipmentGroup2: equipment.g2 || null,
            muscle: rawTarget || null,
            muscleGroup1: muscle.g1 || null,
            muscleGroup2: muscle.g2 || null,
            muscleGroup3: muscle.g3 || null,
            bodyPart: muscle.g1 || rawBody || null,
            image,
            secondaryMuscles: exercise.secondaryMuscles || [],
            instructions: exercise.instructions || []
        };
    }

    async function countStore(store) {
        return count(store);
    }

    function memoryStore(store) {
        const map = memoryStores[store];
        if (!map) {
            throw new Error(`Store mémoire inconnu: ${store}`);
        }
        return map;
    }

    function memoryGet(store, key) {
        const map = memoryStore(store);
        return Promise.resolve(map.get(key) || null);
    }

    function memoryPut(store, value) {
        const map = memoryStore(store);
        const key =
            store === 'sessions'
                ? value?.id
                : store === 'plans' || store === 'routines' || store === 'exercises'
                    ? value?.id
                    : null;
        if (!key) {
            console.warn(`Impossible d'insérer dans ${store}: clé manquante.`);
            return Promise.resolve(false);
        }
        map.set(key, value);
        return Promise.resolve(true);
    }

    function memoryGetAll(store) {
        const map = memoryStore(store);
        const values = Array.from(map.values());
        if (store === 'sessions') {
            return Promise.resolve(values.map((session) => ensureSession(session)));
        }
        return Promise.resolve(values);
    }

    function memoryCount(store) {
        const map = memoryStore(store);
        return Promise.resolve(map.size);
    }

    function memoryDelete(store, key) {
        const map = memoryStore(store);
        return Promise.resolve(map.delete(key));
    }

    function normalizeSessionId(value) {
        if (!value) {
            return null;
        }
        const raw = String(value);
        if (/^\d{8}$/.test(raw)) {
            return raw;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw.replace(/-/g, '');
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed.toISOString().slice(0, 10).replace(/-/g, '');
    }

    function normalizeDateKey(value) {
        if (!value) {
            return null;
        }
        const raw = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw;
        }
        if (/^\d{8}$/.test(raw)) {
            return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed.toISOString().slice(0, 10);
    }

    function isoFromDateKey(dateKey) {
        if (!dateKey) {
            return null;
        }
        const parsed = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed.toISOString();
    }

    function normalizeOptionalText(value) {
        if (typeof value !== 'string') {
            return null;
        }
        return value.trim().length ? value : null;
    }

    function ensureSession(session) {
        if (!session || typeof session !== 'object') {
            return session;
        }
        const dateKey = normalizeDateKey(session.date || session.id);
        const sessionId = normalizeSessionId(session.id || session.date);
        if (sessionId) {
            session.id = sessionId;
        }
        if (!session.date || /^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
            const normalizedDateKey = normalizeDateKey(session.date) || dateKey;
            const iso = isoFromDateKey(normalizedDateKey);
            if (iso) {
                session.date = iso;
            }
        }
        session.comments = normalizeOptionalText(session.comments);
        if (Array.isArray(session.exercises)) {
            session.exercises = normalizeSessionExercises(session);
        }
        return session;
    }

    function normalizeSessionExercises(session) {
        const sessionId = normalizeSessionId(session?.id || session?.date);
        return (session.exercises || [])
            .map((exercise, index) => normalizeSessionExercise(exercise, { sessionId, index, date: session.date }))
            .filter(Boolean);
    }

    function normalizeSessionExercise(exercise, context) {
        if (!exercise || typeof exercise !== 'object') {
            return null;
        }
        const exerciseId = String(exercise.exercise_id || exercise.exerciseId || exercise.type || '').trim();
        const exerciseName = String(
            exercise.exercise_name || exercise.exerciseName || exercise.name || exerciseId || 'Exercice'
        ).trim();
        const sessionId = context?.sessionId || '';
        const date = typeof exercise.date === 'string' ? exercise.date : context?.date || null;
        const sortValue = safeInt(exercise.sort ?? exercise.pos, context?.index != null ? context.index + 1 : 1);
        const id = typeof exercise.id === 'string' && exercise.id.length
            ? exercise.id
            : buildSessionExerciseId(sessionId, exerciseName || exerciseId);

        const routineInstructions = typeof exercise.routine_instructions === 'string'
            ? exercise.routine_instructions
            : typeof exercise.routineInstructions === 'string'
                ? exercise.routineInstructions
                : null;
        const exerciseNote = typeof exercise.exercise_note === 'string'
            ? exercise.exercise_note
            : typeof exercise.note === 'string'
                ? exercise.note
                : null;

        const normalized = {
            ...exercise,
            id,
            sort: sortValue,
            exercise_id: exerciseId,
            exercise_name: exerciseName,
            routine_instructions: normalizeOptionalText(routineInstructions),
            exercise_note: normalizeOptionalText(exerciseNote),
            date,
            type: typeof exercise.type === 'string' && exercise.type.length ? exercise.type : exerciseId,
            category: typeof exercise.category === 'string' && exercise.category.length ? exercise.category : 'weight_reps',
            weight_unit: typeof exercise.weight_unit === 'string' && exercise.weight_unit.length ? exercise.weight_unit : 'metric',
            distance_unit: typeof exercise.distance_unit === 'string' && exercise.distance_unit.length ? exercise.distance_unit : 'metric'
        };

        normalized.sets = normalizeSessionExerciseSets(normalized.sets, {
            sessionId,
            exerciseId,
            exerciseName,
            date,
            category: normalized.category
        });

        delete normalized.exerciseId;
        delete normalized.exerciseName;
        delete normalized.routineInstructions;
        delete normalized.note;
        delete normalized.pos;

        return normalized;
    }

    function normalizeSessionExerciseSets(sets, context = {}) {
        const list = Array.isArray(sets) ? sets : [];
        const sessionId = context.sessionId || '';
        const exerciseId = context.exerciseId || '';
        const exerciseName = context.exerciseName || exerciseId || 'exercice';
        const dateFallback = context.date || null;
        return list.map((set, index) => {
            const pos = safeInt(set?.pos ?? set?.position, index + 1);
            const id = buildSessionSetId(sessionId, exerciseName, pos);
            const date = normalizeSetDate(
                set?.date || set?.updatedAt || set?.updated_at || set?.createdAt || set?.created_at,
                dateFallback
            );
            const time = normalizeSetMetric(set?.time ?? set?.duration ?? set?.seconds);
            const distance = normalizeSetMetric(set?.distance ?? set?.meters ?? set?.kilometers);
            return {
                ...set,
                id,
                pos,
                date,
                type: exerciseId || set?.type || null,
                time,
                distance,
                setType: null,
                done: set?.done === true
            };
        });
    }

    function buildSessionExerciseId(sessionId, rawName) {
        const base = slugifyExerciseName(rawName || 'exercice');
        if (!sessionId) {
            return base;
        }
        return `${sessionId}_${base}`;
    }

    function buildSessionSetId(sessionId, rawName, position) {
        const base = slugifyExerciseName(rawName || 'exercice');
        const pos = String(safeInt(position, 1)).padStart(3, '0');
        const datePrefix = normalizeSessionId(sessionId);
        if (!datePrefix) {
            return `${base}_${pos}`;
        }
        return `${datePrefix}_${base}_${pos}`;
    }

    function slugifyExerciseName(value) {
        return String(value || '')
            .trim()
            .replace(/['’\s]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'exercice';
    }

    function safeInt(value, fallback = 0) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function normalizeSetDate(value, fallback) {
        const raw = value ?? fallback;
        if (!raw) {
            return new Date().toISOString();
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            return new Date().toISOString();
        }
        return parsed.toISOString();
    }

    function normalizeSetMetric(value) {
        if (value == null || value === '') {
            return null;
        }
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    return {
        init,
        get,
        put,
        getAll,
        count,
        del,
        getSession,
        saveSession,
        listSessionDates,
        getActivePlan,
        importExternalExercisesIfNeeded,
        reset
    };
})();
