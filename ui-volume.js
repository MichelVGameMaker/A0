// ui-volume.js — écran Volume et réglages associés
(() => {
    const A = window.App;
    const CFG = window.CFG || {};

    const STORAGE_KEY = 'volumeSettings';
    const RANGE_OPTIONS = [
        { label: 'sem', type: 'week' },
        { label: '7 j', days: 7 },
        { label: '1 m.', days: 28 },
        { label: '3 m.', days: 91 },
        { label: '6 m.', days: 182 },
        { label: '1 an', days: 365 }
    ];
    const RANGE_BY_LABEL = new Map(RANGE_OPTIONS.map((option) => [option.label, option]));
    const DEFAULT_RANGE_LABEL = 'sem';
    const DEFAULT_SELECTED_MUSCLES = [
        'biceps',
        'triceps',
        'back',
        'chest',
        'delts',
        'glutes',
        'hamstrings',
        'quads',
        'calves'
    ];
    const DEFAULT_SESSIONS = 2;
    const DEFAULT_SETS = 10;
    const DEFAULT_SETS_BOOST = new Set(['back', 'chest', 'delts']);
    const DEFAULT_VOLUME_ITEMS = DEFAULT_SELECTED_MUSCLES.reduce((items, muscle) => {
        items[muscle] = {
            selected: true,
            targetSessions: DEFAULT_SESSIONS,
            targetSets: DEFAULT_SETS_BOOST.has(muscle) ? 15 : DEFAULT_SETS
        };
        return items;
    }, {});

    /* STATE */
    const refs = {};
    let refsResolved = false;
    let allVolumeItems = null;
    let rangeTagGroup = null;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireEvents();
        renderVolumeScreen();
    });

    /* ACTIONS */
    A.renderVolumeScreen = async function renderVolumeScreen() {
        ensureRefs();
        ensureRangeTags();
        await renderVolumeTable();
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenVolume = document.getElementById('screenVolume');
        refs.btnVolumeBack = document.getElementById('btnVolumeBack');
        refs.btnVolumeEdit = document.getElementById('btnVolumeEdit');
        refs.volumeRangeTags = document.getElementById('volumeRangeTags');
        refs.volumeTable = document.getElementById('volumeTable');
        refs.volumeTableBody = document.getElementById('volumeTableBody');
        refs.volumeEmpty = document.getElementById('volumeEmpty');
        refs.dlgVolumeEdit = document.getElementById('dlgVolumeEdit');
        refs.volumeEditList = document.getElementById('volumeEditList');
        refs.volumeEditSave = document.getElementById('volumeEditSave');
        refsResolved = true;
        return refs;
    }

    function wireEvents() {
        const { btnVolumeBack, btnVolumeEdit, volumeEditSave } = ensureRefs();

        btnVolumeBack?.addEventListener('click', () => {
            A.openSettings();
        });

        btnVolumeEdit?.addEventListener('click', () => {
            openEditDialog();
        });

        volumeEditSave?.addEventListener('click', () => {
            saveEditDialog();
        });
    }

    function ensureRangeTags() {
        const { volumeRangeTags } = ensureRefs();
        if (!volumeRangeTags || !A.TagGroup) {
            return null;
        }
        if (!rangeTagGroup) {
            rangeTagGroup = new A.TagGroup(volumeRangeTags, {
                mode: 'mono',
                columns: 3,
                onChange: (values) => {
                    const nextLabel = values?.[0] || DEFAULT_RANGE_LABEL;
                    const settings = loadSettings();
                    settings.range = getRangeLabel(nextLabel);
                    saveSettings(settings);
                    void renderVolumeTable();
                }
            });
            rangeTagGroup.setItems(RANGE_OPTIONS.map((option) => option.label));
        }
        return rangeTagGroup;
    }

    function getAllVolumeItems() {
        if (allVolumeItems) {
            return allVolumeItems;
        }
        const transcode = CFG.muscleTranscode || {};
        const items = new Set();
        Object.keys(transcode).forEach((key) => items.add(key));
        Object.values(transcode).forEach((entry) => {
            if (!entry) {
                return;
            }
            [entry.muscle, entry.g1, entry.g2, entry.g3].forEach((value) => {
                if (value) {
                    items.add(value);
                }
            });
        });
        allVolumeItems = Array.from(items)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        return allVolumeItems;
    }

    function loadSettings() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { items: DEFAULT_VOLUME_ITEMS, range: DEFAULT_RANGE_LABEL };
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.items && typeof parsed.items === 'object') {
                return {
                    ...parsed,
                    range: getRangeLabel(parsed.range)
                };
            }
        } catch (error) {
            console.warn('Volume: données locales invalides.', error);
        }
        return { items: {}, range: DEFAULT_RANGE_LABEL };
    }

    function saveSettings(settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    async function renderVolumeTable() {
        const { volumeTableBody, volumeEmpty, volumeTable } = ensureRefs();
        if (!volumeTableBody || !volumeEmpty || !volumeTable) {
            return;
        }
        const settings = loadSettings();
        const selectedRange = getRangeLabel(settings.range);
        const tagGroup = ensureRangeTags();
        if (tagGroup) {
            tagGroup.setSelection(selectedRange);
        }
        const tracked = Object.entries(settings.items || {})
            .filter(([, item]) => item && item.selected)
            .map(([key, item]) => ({
                key,
                targetSessions: toNumber(item.targetSessions),
                targetSets: toNumber(item.targetSets)
            }));

        volumeTableBody.innerHTML = '';
        if (tracked.length === 0) {
            volumeEmpty.hidden = false;
            volumeTable.hidden = true;
            return;
        }

        volumeEmpty.hidden = true;
        volumeTable.hidden = false;

        const statsByKey = await computeVolumeStats(tracked, selectedRange);
        const rangeConfig = RANGE_BY_LABEL.get(selectedRange) || RANGE_BY_LABEL.get(DEFAULT_RANGE_LABEL);
        const shouldScaleToWeek = rangeConfig?.type !== 'week';
        const weeklyScale = shouldScaleToWeek ? 7 / (rangeConfig?.days || 7) : 1;

        tracked.forEach((entry) => {
            const normalizedKey = normalizeKey(entry.key);
            const stats = statsByKey.get(normalizedKey) || { sessions: 0, sets: 0 };
            const scaledSessions = shouldScaleToWeek ? Math.round(stats.sessions * weeklyScale) : stats.sessions;
            const scaledSets = shouldScaleToWeek ? Math.round(stats.sets * weeklyScale) : stats.sets;
            const scaledTargetSessions = entry.targetSessions > 0 ? entry.targetSessions : 0;
            const scaledTargetSets = entry.targetSets > 0 ? entry.targetSets : 0;
            const row = document.createElement('tr');
            const muscleCell = document.createElement('td');
            muscleCell.textContent = formatLabel(entry.key);
            row.appendChild(muscleCell);
            row.appendChild(createGaugeCell(scaledSessions, scaledTargetSessions, 'séances'));
            row.appendChild(createGaugeCell(scaledSets, scaledTargetSets, 'séries'));
            volumeTableBody.appendChild(row);
        });
    }

    function createGaugeCell(current, target, label) {
        const cell = document.createElement('td');
        const gauge = document.createElement('div');
        gauge.className = 'volume-gauge';
        gauge.setAttribute('aria-label', label);

        const fill = document.createElement('div');
        fill.className = 'volume-gauge-fill';
        const ratio = target > 0 ? Math.min(current / target, 1) : 0;
        fill.style.width = `${Math.round(ratio * 100)}%`;

        const text = document.createElement('div');
        text.className = 'volume-gauge-label';
        text.textContent = target > 0 ? `${current}/${target}` : `${current}/—`;

        gauge.appendChild(fill);
        gauge.appendChild(text);
        cell.appendChild(gauge);
        return cell;
    }

    function openEditDialog() {
        const { dlgVolumeEdit, volumeEditList } = ensureRefs();
        if (!dlgVolumeEdit || !volumeEditList) {
            return;
        }
        const settings = loadSettings();
        const items = getAllVolumeItems();
        volumeEditList.innerHTML = '';

        items.forEach((key) => {
            const row = document.createElement('div');
            row.className = 'volume-edit-row';
            row.dataset.key = key;

            const label = document.createElement('label');
            label.className = 'volume-edit-label';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'volume-edit-check';
            checkbox.checked = Boolean(settings.items?.[key]?.selected);

            const labelText = document.createElement('span');
            labelText.textContent = formatLabel(key);

            label.appendChild(checkbox);
            label.appendChild(labelText);

            const sessionsInput = document.createElement('input');
            sessionsInput.type = 'number';
            sessionsInput.min = '0';
            sessionsInput.step = '1';
            sessionsInput.inputMode = 'numeric';
            sessionsInput.className = 'input volume-edit-input';
            sessionsInput.value = toNumber(settings.items?.[key]?.targetSessions, '');
            sessionsInput.setAttribute('aria-label', `Objectif séances/sem pour ${formatLabel(key)}`);
            sessionsInput.dataset.field = 'sessions';

            const setsInput = document.createElement('input');
            setsInput.type = 'number';
            setsInput.min = '0';
            setsInput.step = '1';
            setsInput.inputMode = 'numeric';
            setsInput.className = 'input volume-edit-input';
            setsInput.value = toNumber(settings.items?.[key]?.targetSets, '');
            setsInput.setAttribute('aria-label', `Objectif séries/sem pour ${formatLabel(key)}`);
            setsInput.dataset.field = 'sets';

            row.appendChild(label);
            row.appendChild(sessionsInput);
            row.appendChild(setsInput);
            volumeEditList.appendChild(row);
        });

        dlgVolumeEdit.showModal();
    }

    function saveEditDialog() {
        const { dlgVolumeEdit, volumeEditList } = ensureRefs();
        if (!dlgVolumeEdit || !volumeEditList) {
            return;
        }

        const rows = Array.from(volumeEditList.querySelectorAll('.volume-edit-row'));
        const settings = loadSettings();
        const nextSettings = { items: {}, range: settings.range };
        rows.forEach((row) => {
            const key = row.dataset.key;
            const checkbox = row.querySelector('.volume-edit-check');
            const sessionsInput = row.querySelector('input[data-field="sessions"]');
            const setsInput = row.querySelector('input[data-field="sets"]');
            if (!key || !checkbox || !sessionsInput || !setsInput) {
                return;
            }
            const targetSessions = toNumber(sessionsInput.value);
            const targetSets = toNumber(setsInput.value);
            const selected = checkbox.checked;
            if (selected || targetSessions > 0 || targetSets > 0) {
                nextSettings.items[key] = {
                    selected,
                    targetSessions,
                    targetSets
                };
            }
        });

        saveSettings(nextSettings);
        dlgVolumeEdit.close();
        void renderVolumeTable();
    }

    function toNumber(value, fallback = 0) {
        const number = Number.parseInt(value, 10);
        if (Number.isNaN(number)) {
            return fallback;
        }
        return number;
    }

    function formatLabel(value) {
        if (!value) {
            return '';
        }
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function getRangeLabel(value) {
        const label = value ? String(value) : '';
        if (RANGE_BY_LABEL.has(label)) {
            return label;
        }
        return DEFAULT_RANGE_LABEL;
    }

    function getRangeDays(rangeLabel) {
        const today = A.today();
        const config = RANGE_BY_LABEL.get(getRangeLabel(rangeLabel)) || RANGE_BY_LABEL.get(DEFAULT_RANGE_LABEL);
        if (!config) {
            return 7;
        }
        if (config.type === 'week') {
            const start = A.startOfWeek(today);
            return Math.max(1, daysBetween(start, today));
        }
        return config.days || 7;
    }

    function daysBetween(start, end) {
        const msPerDay = 24 * 60 * 60 * 1000;
        const diff = Math.floor((end.getTime() - start.getTime()) / msPerDay);
        return diff + 1;
    }

    function normalizeKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function parseDateKey(dateKey) {
        if (!dateKey) {
            return null;
        }
        const iso = dateKey.includes('T') ? dateKey : `${dateKey}T00:00:00`;
        const parsed = new Date(iso);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed;
    }

    function resolveSessionDateKey(session) {
        if (!session) {
            return null;
        }
        if (typeof A.sessionDateKeyFromId === 'function' && typeof session.id === 'string') {
            return A.sessionDateKeyFromId(session.id);
        }
        if (typeof session.date === 'string') {
            return session.date;
        }
        return null;
    }

    function getExerciseMuscleKeys(exercise) {
        if (!exercise) {
            return [];
        }
        const keys = [
            exercise.muscle,
            exercise.muscleGroup1,
            exercise.muscleGroup2,
            exercise.muscleGroup3
        ]
            .filter(Boolean)
            .map(normalizeKey);
        return Array.from(new Set(keys));
    }

    async function computeVolumeStats(tracked, rangeLabel) {
        const trackedKeys = tracked.map((entry) => normalizeKey(entry.key));
        const statsByKey = new Map(trackedKeys.map((key) => [key, { sessions: 0, sets: 0 }]));
        if (!statsByKey.size) {
            return statsByKey;
        }

        const config = RANGE_BY_LABEL.get(getRangeLabel(rangeLabel)) || RANGE_BY_LABEL.get(DEFAULT_RANGE_LABEL);
        const today = A.today();
        const start = config?.type === 'week'
            ? A.startOfWeek(today)
            : A.addDays(today, -((config?.days || 7) - 1));
        const end = today;

        const [sessions, exercises] = await Promise.all([
            db.getAll('sessions'),
            db.getAll('exercises')
        ]);
        const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

        sessions.forEach((session) => {
            const sessionDateKey = resolveSessionDateKey(session);
            const sessionDate = parseDateKey(sessionDateKey);
            if (!sessionDate || sessionDate < start || sessionDate > end) {
                return;
            }

            const sessionMuscles = new Set();
            const sessionExercises = Array.isArray(session.exercises) ? session.exercises : [];
            sessionExercises.forEach((sessionExercise) => {
                const exercise = exerciseById.get(sessionExercise.exercise_id);
                if (!exercise) {
                    return;
                }
                const muscles = getExerciseMuscleKeys(exercise);
                const primaryMuscle = normalizeKey(exercise.muscle);
                if (!muscles.length && !primaryMuscle) {
                    return;
                }
                const sets = Array.isArray(sessionExercise.sets) ? sessionExercise.sets : [];
                const doneSets = sets.reduce((total, set) => total + (set?.done === true ? 1 : 0), 0);
                if (doneSets === 0) {
                    return;
                }
                muscles.forEach((muscleKey) => {
                    if (!statsByKey.has(muscleKey)) {
                        return;
                    }
                    sessionMuscles.add(muscleKey);
                });
                if (primaryMuscle && statsByKey.has(primaryMuscle)) {
                    statsByKey.get(primaryMuscle).sets += doneSets;
                }
            });

            sessionMuscles.forEach((muscleKey) => {
                const stats = statsByKey.get(muscleKey);
                if (stats) {
                    stats.sessions += 1;
                }
            });
        });

        return statsByKey;
    }
})();
