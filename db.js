/* db.js — IndexedDB helpers (stores: exercises_native, exercises_user, exercises_import, exercises_overrides, routines, plans, sessions) */
const db = (() => {
    /* STATE */
    const DB_NAME = 'A0-db';
    const DB_VER = 3;
    let handle;
    let memoryMode = false;
    const memoryStores = {
        exercises_native: new Map(),
        exercises_overrides: new Map(),
        exercises_user: new Map(),
        exercises_import: new Map(),
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
        if (store === 'exercises') {
            return getExercise(key);
        }
        return rawGet(store, key);
    }

    /**
     * Écrit une valeur dans un store.
     * @param {string} store Nom du store cible.
     * @param {unknown} value Donnée à persister.
     * @returns {Promise<boolean>} `true` une fois l'opération terminée.
     */
    async function put(store, value) {
        if (store === 'exercises') {
            return putExercise(value);
        }
        return rawPut(store, value);
    }

    /**
     * Liste toutes les valeurs d'un store.
     * @param {string} store Nom du store cible.
     * @returns {Promise<unknown[]>} Valeurs présentes.
     */
    async function getAll(store) {
        if (store === 'exercises') {
            return getAllExercises();
        }
        return rawGetAll(store);
    }

    /**
     * Compte les enregistrements d'un store.
     * @param {string} store Nom du store cible.
     * @returns {Promise<number>} Nombre d'entrées.
     */
    async function count(store) {
        if (store === 'exercises') {
            return countExercises();
        }
        return rawCount(store);
    }

    /**
     * Supprime une entrée depuis un store.
     * @param {string} store Nom du store cible.
     * @param {IDBValidKey} key Clé à supprimer.
     * @returns {Promise<boolean>} `true` une fois l'opération réalisée.
     */
    async function del(store, key) {
        if (store === 'exercises') {
            return deleteExercise(key);
        }
        return rawDelete(store, key);
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
            .filter((session) => hasDoneSet(session))
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
        const currentCount = await rawCount('exercises_native');
        if (!force && currentCount > 0) {
            return;
        }

        try {
            const url = new URL('data/exercises.json', document.baseURI).href;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('data/exercises.json introuvable');
            }
            const raw = await response.text();
            let data;
            try {
                data = JSON.parse(raw);
            } catch (parseError) {
                data = parseLooseExercises(raw);
            }
            if (!Array.isArray(data)) {
                console.warn('exercises.json pas un tableau, import ignoré.');
                return;
            }

            if (force) {
                await rawClear('exercises_native');
            }

            const BATCH = 200;
            for (let index = 0; index < data.length; index += BATCH) {
                const slice = data.slice(index, index + BATCH);
                const rows = await Promise.all(slice.map(normalizeExercise));
                for (const row of rows) {
                    if (row) {
                        await rawPut('exercises_native', row);
                    }
                }
            }
            console.log('Import exercises terminé.');
        } catch (error) {
            console.warn('Import externe sauté :', error.message);
        }
    }

    function parseLooseExercises(raw) {
        const lines = String(raw || '').split(/\r?\n/);
        const exercises = [];
        let current = null;
        let listKey = null;

        function pushCurrent() {
            if (current && Object.keys(current).length) {
                exercises.push(current);
            }
            current = null;
            listKey = null;
        }

        function parseValue(line) {
            const rawValue = line.split(':').slice(1).join(':').trim().replace(/,$/, '');
            try {
                return JSON.parse(rawValue);
            } catch {
                return rawValue.replace(/^"|"$/g, '');
            }
        }

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            if (trimmed.startsWith('"gifUrl"')) {
                if (current) {
                    pushCurrent();
                }
                current = { gifUrl: parseValue(trimmed) };
                continue;
            }
            if (!current) {
                continue;
            }
            if (trimmed.startsWith('"targetMuscles"')) {
                listKey = 'targetMuscles';
                current[listKey] = [];
                continue;
            }
            if (trimmed.startsWith('"bodyParts"')) {
                listKey = 'bodyParts';
                current[listKey] = [];
                continue;
            }
            if (trimmed.startsWith('"equipments"')) {
                listKey = 'equipments';
                current[listKey] = [];
                continue;
            }
            if (trimmed.startsWith('"secondaryMuscles"')) {
                listKey = 'secondaryMuscles';
                current[listKey] = [];
                continue;
            }
            if (listKey) {
                if (trimmed.startsWith(']')) {
                    listKey = null;
                    continue;
                }
                const item = trimmed.replace(/,$/, '');
                if (item) {
                    current[listKey].push(item.replace(/^"|"$/g, ''));
                }
            }
        }

        if (current) {
            pushCurrent();
        }

        return exercises;
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
                if (!database.objectStoreNames.contains('exercises_native')) {
                    database.createObjectStore('exercises_native', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('exercises_overrides')) {
                    database.createObjectStore('exercises_overrides', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('exercises_user')) {
                    database.createObjectStore('exercises_user', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('exercises_import')) {
                    database.createObjectStore('exercises_import', { keyPath: 'id' });
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

                if (database.objectStoreNames.contains('exercises')) {
                    const legacyStore = event.target.transaction.objectStore('exercises');
                    const userStore = event.target.transaction.objectStore('exercises_user');
                    const existingRequest = legacyStore.getAll();
                    existingRequest.onsuccess = () => {
                        const legacyExercises = existingRequest.result || [];
                        legacyExercises.forEach((exercise) => {
                            if (exercise?.id) {
                                const migrated = { ...exercise, origin: exercise.origin || 'user' };
                                userStore.put(migrated);
                            }
                        });
                    };
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function rawGet(store, key) {
        if (memoryMode) {
            return memoryGet(store, key);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store).get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async function rawPut(store, value) {
        if (memoryMode) {
            return memoryPut(store, value);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store, 'readwrite').put(value);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function rawGetAll(store) {
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

    async function rawCount(store) {
        if (memoryMode) {
            return memoryCount(store);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store).count();
            request.onsuccess = () => resolve(request.result || 0);
            request.onerror = () => reject(request.error);
        });
    }

    async function rawDelete(store, key) {
        if (memoryMode) {
            return memoryDelete(store, key);
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store, 'readwrite').delete(key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function rawClear(store) {
        if (memoryMode) {
            const map = memoryStore(store);
            map.clear();
            return true;
        }
        return new Promise((resolve, reject) => {
            const request = transaction(store, 'readwrite').clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function getExercise(id) {
        if (!id) {
            return null;
        }
        const native = await rawGet('exercises_native', id);
        if (native) {
            const override = await rawGet('exercises_overrides', id);
            return mergeExercise(native, override);
        }
        const user = await rawGet('exercises_user', id);
        if (user) {
            return normalizeStoredExercise(user, user.origin || 'user');
        }
        const imported = await rawGet('exercises_import', id);
        if (imported) {
            return normalizeStoredExercise(imported, imported.origin || 'import');
        }
        return null;
    }

    async function getAllExercises() {
        const [native, overrides, user, imported] = await Promise.all([
            rawGetAll('exercises_native'),
            rawGetAll('exercises_overrides'),
            rawGetAll('exercises_user'),
            rawGetAll('exercises_import')
        ]);
        const overridesById = new Map(overrides.map((entry) => [entry.id, entry]));
        const mergedNative = native.map((exercise) => mergeExercise(exercise, overridesById.get(exercise.id)));
        const mergedUser = user.map((exercise) => normalizeStoredExercise(exercise, exercise.origin || 'user'));
        const mergedImport = imported.map((exercise) => normalizeStoredExercise(exercise, exercise.origin || 'import'));
        return [...mergedNative, ...mergedUser, ...mergedImport];
    }

    async function countExercises() {
        const [nativeCount, userCount, importCount] = await Promise.all([
            rawCount('exercises_native'),
            rawCount('exercises_user'),
            rawCount('exercises_import')
        ]);
        return nativeCount + userCount + importCount;
    }

    async function putExercise(exercise) {
        if (!exercise || typeof exercise !== 'object') {
            return false;
        }
        const origin = exercise.origin;
        if (origin === 'native') {
            return rawPut('exercises_native', exercise);
        }
        if (origin === 'import') {
            return rawPut('exercises_import', exercise);
        }
        if (origin === 'user') {
            return rawPut('exercises_user', exercise);
        }

        const id = exercise.id;
        const isUser = isUserExerciseId(id);
        const isImport = isImportExerciseId(id);
        if (isUser) {
            return rawPut('exercises_user', { ...exercise, origin: 'user' });
        }
        if (isImport) {
            return rawPut('exercises_import', { ...exercise, origin: 'import' });
        }
        const native = await rawGet('exercises_native', id);
        if (native) {
            const sanitized = { ...exercise };
            delete sanitized.origin;
            delete sanitized.native_id;
            return rawPut('exercises_overrides', sanitized);
        }
        return rawPut('exercises_user', { ...exercise, origin: exercise.origin || 'user' });
    }

    async function deleteExercise(id) {
        if (!id) {
            return false;
        }
        const native = await rawGet('exercises_native', id);
        if (native) {
            return rawDelete('exercises_overrides', id);
        }
        if (isImportExerciseId(id)) {
            return rawDelete('exercises_import', id);
        }
        if (isUserExerciseId(id)) {
            return rawDelete('exercises_user', id);
        }
        const storedUser = await rawGet('exercises_user', id);
        if (storedUser) {
            return rawDelete('exercises_user', id);
        }
        return rawDelete('exercises_import', id);
    }

    function mergeExercise(native, override) {
        const base = { ...native, origin: 'native', native_id: native.id };
        if (!override) {
            return base;
        }
        return {
            ...base,
            ...override,
            id: native.id,
            origin: 'modified',
            native_id: native.id
        };
    }

    function normalizeStoredExercise(exercise, fallbackOrigin) {
        if (!exercise || typeof exercise !== 'object') {
            return exercise;
        }
        return {
            ...exercise,
            origin: exercise.origin || fallbackOrigin || null
        };
    }

    function isUserExerciseId(id) {
        return typeof id === 'string' && id.startsWith('user--');
    }

    function isImportExerciseId(id) {
        return typeof id === 'string' && id.startsWith('import--');
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
        const inferredId = inferExerciseId(exercise);
        const id = String(exercise.exerciseId || exercise.id || exercise._id || exercise.uuid || inferredId || '').trim();
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
            instructions: exercise.instructions || [],
            origin: 'native'
        };
    }

    function inferExerciseId(exercise) {
        const source = exercise?.gifUrl || exercise?.image || '';
        if (!source) {
            return '';
        }
        const file = String(source).split('/').pop() || '';
        const clean = file.split('?')[0].split('#')[0];
        return clean.replace(/\.[^/.]+$/, '');
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
                : store === 'plans'
                    || store === 'routines'
                    || store === 'exercises_native'
                    || store === 'exercises_overrides'
                    || store === 'exercises_user'
                    || store === 'exercises_import'
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

    function hasDoneSet(session) {
        if (!session || !Array.isArray(session.exercises)) {
            return false;
        }
        return session.exercises.some((exercise) => {
            const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
            return sets.some((set) => set?.done === true);
        });
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
