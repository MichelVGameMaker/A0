// ui-volume.js — écran Volume et réglages associés
(() => {
    const A = window.App;
    const CFG = window.CFG || {};

    const STORAGE_KEY = 'volumeSettings';
    const RANGE_OPTIONS = [
        { label: 'Sem', type: 'week' },
        { label: 'Mois', type: 'month' },
        { label: '1 m.', days: 28 },
        { label: '3 m.', days: 91 },
        { label: '6 m.', days: 182 },
        { label: '12 m.', days: 365 }
    ];
    const RANGE_BY_LABEL = new Map(RANGE_OPTIONS.map((option) => [option.label, option]));
    const DEFAULT_RANGE_LABEL = 'Sem';
    const RANGE_LABEL_ALIASES = new Map([
        ['sem', 'Sem'],
        ['semaine', 'Sem'],
        ['7j', 'Sem'],
        ['mois', 'Mois'],
        ['1m', '1 m.'],
        ['3m', '3 m.'],
        ['6m', '6 m.'],
        ['12m', '12 m.'],
        ['1an', '12 m.']
    ]);
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
    let rangeMuscleTagGroup = null;
    let currentMuscleKey = '';

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireEvents();
        void A.renderVolumeScreen();
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
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.btnVolumeEdit = document.getElementById('btnVolumeEdit');
        refs.volumeRangeTags = document.getElementById('volumeRangeTags');
        refs.volumeTable = document.getElementById('volumeTable');
        refs.volumeTableBody = document.getElementById('volumeTableBody');
        refs.volumeEmpty = document.getElementById('volumeEmpty');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.btnVolumeMuscleBack = document.getElementById('btnVolumeMuscleBack');
        refs.volumeMuscleTitle = document.getElementById('volumeMuscleTitle');
        refs.volumeMuscleRangeTags = document.getElementById('volumeMuscleRangeTags');
        refs.volumeMuscleTable = document.getElementById('volumeMuscleTable');
        refs.volumeMuscleTableBody = document.getElementById('volumeMuscleTableBody');
        refs.volumeMuscleEmpty = document.getElementById('volumeMuscleEmpty');
        refs.dlgVolumeEdit = document.getElementById('dlgVolumeEdit');
        refs.volumeEditList = document.getElementById('volumeEditList');
        refs.volumeEditSave = document.getElementById('volumeEditSave');
        refs.volumeEditCancel = document.getElementById('volumeEditCancel');
        refsResolved = true;
        return refs;
    }

    function wireEvents() {
        const { btnVolumeEdit, btnVolumeMuscleBack, volumeEditSave, volumeEditCancel } = ensureRefs();

        btnVolumeEdit?.addEventListener('click', () => {
            openEditDialog();
        });

        btnVolumeMuscleBack?.addEventListener('click', () => {
            A.openVolume();
        });

        volumeEditSave?.addEventListener('click', () => {
            saveEditDialog();
        });

        volumeEditCancel?.addEventListener('click', () => {
            const { dlgVolumeEdit } = ensureRefs();
            dlgVolumeEdit?.close();
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
                columns: 4,
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

    function ensureMuscleRangeTags() {
        const { volumeMuscleRangeTags } = ensureRefs();
        if (!volumeMuscleRangeTags || !A.TagGroup) {
            return null;
        }
        if (!rangeMuscleTagGroup) {
            rangeMuscleTagGroup = new A.TagGroup(volumeMuscleRangeTags, {
                mode: 'mono',
                columns: 4,
                onChange: (values) => {
                    const nextLabel = values?.[0] || DEFAULT_RANGE_LABEL;
                    const settings = loadSettings();
                    settings.range = getRangeLabel(nextLabel);
                    saveSettings(settings);
                    void renderVolumeMuscleTable();
                }
            });
            rangeMuscleTagGroup.setItems(RANGE_OPTIONS.map((option) => option.label));
        }
        return rangeMuscleTagGroup;
    }

    A.openVolumeMuscle = async function openVolumeMuscle(muscleKey) {
        ensureRefs();
        currentMuscleKey = normalizeKey(muscleKey);
        if (!currentMuscleKey) {
            return;
        }
        await renderVolumeMuscleScreen();
        showVolumeMuscleScreen();
    };

    async function renderVolumeMuscleScreen() {
        ensureRefs();
        ensureMuscleRangeTags();
        await renderVolumeMuscleTable();
    }

    function showVolumeMuscleScreen() {
        const { screenStatMuscles, screenStatMusclesDetail } = ensureRefs();
        if (screenStatMuscles) {
            screenStatMuscles.hidden = true;
        }
        if (screenStatMusclesDetail) {
            screenStatMusclesDetail.hidden = false;
        }
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
        const { config: rangeConfig, monthLength } = getRangeWindow(selectedRange);
        const isMonthRange = rangeConfig?.type === 'month';
        const shouldScaleToWeek = rangeConfig?.type !== 'week' && !isMonthRange;
        const isDayRange = Boolean(rangeConfig?.days) && !isMonthRange;
        const weeksInRange = isDayRange ? (rangeConfig?.days || 7) / 7 : 1;
        const weeklyScale = shouldScaleToWeek ? 7 / (rangeConfig?.days || 7) : 1;
        const monthScale = isMonthRange ? monthLength / 7 : 1;

        tracked.forEach((entry) => {
            const normalizedKey = normalizeKey(entry.key);
            const stats = statsByKey.get(normalizedKey) || { sessions: 0, sets: 0 };
            const scaledSessions = shouldScaleToWeek ? stats.sessions * weeklyScale : stats.sessions;
            const scaledSets = shouldScaleToWeek ? stats.sets * weeklyScale : stats.sets;
            const scaledTargetSessions = entry.targetSessions > 0
                ? (isMonthRange ? entry.targetSessions * monthScale : entry.targetSessions)
                : 0;
            const scaledTargetSets = entry.targetSets > 0
                ? (isMonthRange ? entry.targetSets * monthScale : entry.targetSets)
                : 0;
            const totals = isDayRange
                ? {
                    sessions: {
                        current: stats.sessions,
                        target: entry.targetSessions * weeksInRange
                    },
                    sets: {
                        current: stats.sets,
                        target: entry.targetSets * weeksInRange
                    }
                }
                : null;
            const row = document.createElement('tr');
            makeRowClickable(row, () => {
                void A.openVolumeMuscle?.(entry.key);
            });
            const muscleCell = document.createElement('td');
            muscleCell.textContent = formatLabel(entry.key);
            row.appendChild(muscleCell);
            row.appendChild(createGaugeCell(scaledSessions, scaledTargetSessions, 'séances', {
                totals: totals?.sessions || null
            }));
            row.appendChild(createGaugeCell(scaledSets, scaledTargetSets, 'séries', {
                totals: totals?.sets || null
            }));
            volumeTableBody.appendChild(row);
        });
    }

    async function renderVolumeMuscleTable() {
        const {
            volumeMuscleTableBody,
            volumeMuscleEmpty,
            volumeMuscleTable,
            volumeMuscleTitle
        } = ensureRefs();
        if (!volumeMuscleTableBody || !volumeMuscleEmpty || !volumeMuscleTable || !volumeMuscleTitle) {
            return;
        }

        if (!currentMuscleKey) {
            volumeMuscleTitle.textContent = 'Volume';
            volumeMuscleEmpty.hidden = false;
            volumeMuscleTable.hidden = true;
            return;
        }

        const settings = loadSettings();
        const selectedRange = getRangeLabel(settings.range);
        const tagGroup = ensureMuscleRangeTags();
        if (tagGroup) {
            tagGroup.setSelection(selectedRange);
        }

        volumeMuscleTitle.textContent = formatLabel(currentMuscleKey);

        const [sessions, exercises] = await Promise.all([
            db.getAll('sessions'),
            db.getAll('exercises')
        ]);

        const normalizedMuscle = normalizeKey(currentMuscleKey);
        const primaryExercises = [];
        const secondaryExercises = [];
        exercises.forEach((exercise) => {
            if (!exercise) {
                return;
            }
            const primaryKey = normalizeKey(exercise.muscle);
            const secondaryKeys = [
                exercise.muscleGroup1,
                exercise.muscleGroup2,
                exercise.muscleGroup3
            ]
                .filter(Boolean)
                .map(normalizeKey);

            if (primaryKey && primaryKey === normalizedMuscle) {
                primaryExercises.push(exercise);
            } else if (secondaryKeys.includes(normalizedMuscle)) {
                secondaryExercises.push(exercise);
            }
        });

        const allExercises = [...primaryExercises, ...secondaryExercises];
        const statsByExercise = new Map(allExercises.map((exercise) => [exercise.id, { sessions: 0, sets: 0 }]));

        const { config: rangeConfig, start, end, monthLength } = getRangeWindow(selectedRange);

        sessions.forEach((session) => {
            const sessionDateKey = resolveSessionDateKey(session);
            const sessionDate = parseDateKey(sessionDateKey);
            if (!sessionDate || sessionDate < start || sessionDate > end) {
                return;
            }

            const countedExercises = new Set();
            const sessionExercises = Array.isArray(session.exercises) ? session.exercises : [];
            sessionExercises.forEach((sessionExercise) => {
                const exerciseId = sessionExercise?.exercise_id;
                const stats = statsByExercise.get(exerciseId);
                if (!stats) {
                    return;
                }
                const sets = Array.isArray(sessionExercise.sets) ? sessionExercise.sets : [];
                const doneSets = sets.reduce((total, set) => total + (set?.done === true ? 1 : 0), 0);
                if (doneSets === 0) {
                    return;
                }
                stats.sets += doneSets;
                if (!countedExercises.has(exerciseId)) {
                    stats.sessions += 1;
                    countedExercises.add(exerciseId);
                }
            });
        });

        const isMonthRange = rangeConfig?.type === 'month';
        const shouldScaleToWeek = rangeConfig?.type !== 'week' && !isMonthRange;
        const isDayRange = Boolean(rangeConfig?.days) && !isMonthRange;
        const weeksInRange = isDayRange ? (rangeConfig?.days || 7) / 7 : 1;
        const weeklyScale = shouldScaleToWeek ? 7 / (rangeConfig?.days || 7) : 1;
        const monthScale = isMonthRange ? monthLength / 7 : 1;

        volumeMuscleTableBody.innerHTML = '';

        const muscleStats = computeMuscleStats(
            sessions,
            exercises,
            normalizedMuscle,
            start,
            end
        );

        const filteredPrimary = primaryExercises.filter((exercise) => hasExerciseStats(statsByExercise, exercise.id));
        const filteredSecondary = secondaryExercises.filter((exercise) => hasExerciseStats(statsByExercise, exercise.id));
        const hasExercises = filteredPrimary.length > 0 || filteredSecondary.length > 0;
        if (!hasExercises) {
            volumeMuscleEmpty.hidden = false;
            volumeMuscleTable.hidden = true;
            return;
        }

        volumeMuscleEmpty.hidden = true;
        volumeMuscleTable.hidden = false;

        const targetSettings = settings.items?.[normalizedMuscle] || {};
        const targetSessions = toNumber(targetSettings.targetSessions);
        const targetSets = toNumber(targetSettings.targetSets);
        const scaledTargetSessions = isMonthRange ? targetSessions * monthScale : targetSessions;
        const scaledTargetSets = isMonthRange ? targetSets * monthScale : targetSets;

        appendMuscleRow(
            volumeMuscleTableBody,
            formatLabel(currentMuscleKey),
            muscleStats,
            shouldScaleToWeek,
            weeklyScale,
            scaledTargetSessions,
            scaledTargetSets,
            isDayRange ? weeksInRange : null,
            targetSessions,
            targetSets
        );

        appendExerciseSection(
            volumeMuscleTableBody,
            'Principal',
            filteredPrimary,
            statsByExercise,
            shouldScaleToWeek,
            weeklyScale,
            isDayRange ? weeksInRange : null
        );

        appendExerciseSection(
            volumeMuscleTableBody,
            'Secondaire',
            filteredSecondary,
            statsByExercise,
            shouldScaleToWeek,
            weeklyScale,
            isDayRange ? weeksInRange : null
        );
    }

    function appendMuscleRow(
        tableBody,
        label,
        stats,
        shouldScaleToWeek,
        weeklyScale,
        targetSessions,
        targetSets,
        weeksInRange,
        weeklyTargetSessions,
        weeklyTargetSets
    ) {
        const row = document.createElement('tr');
        row.className = 'volume-muscle-row';
        const nameCell = document.createElement('td');
        nameCell.textContent = label;
        row.appendChild(nameCell);
        const scaledSessions = shouldScaleToWeek ? stats.sessions * weeklyScale : stats.sessions;
        const scaledSets = shouldScaleToWeek ? stats.sets * weeklyScale : stats.sets;
        const totals = weeksInRange
            ? {
                sessions: {
                    current: stats.sessions,
                    target: weeklyTargetSessions * weeksInRange
                },
                sets: {
                    current: stats.sets,
                    target: weeklyTargetSets * weeksInRange
                }
            }
            : null;
        row.appendChild(createGaugeCell(scaledSessions, targetSessions, 'séances', {
            totals: totals?.sessions || null
        }));
        row.appendChild(createGaugeCell(scaledSets, targetSets, 'séries', {
            totals: totals?.sets || null
        }));
        tableBody.appendChild(row);
    }

    function appendExerciseSection(
        tableBody,
        label,
        exercises,
        statsByExercise,
        shouldScaleToWeek,
        weeklyScale,
        weeksInRange
    ) {
        const headerRow = document.createElement('tr');
        headerRow.className = 'volume-section-row';
        const headerCell = document.createElement('td');
        headerCell.colSpan = 3;
        headerCell.textContent = label;
        headerRow.appendChild(headerCell);
        tableBody.appendChild(headerRow);

        const sorted = [...exercises].sort((a, b) => {
            const statsA = statsByExercise.get(a.id) || { sessions: 0, sets: 0 };
            const statsB = statsByExercise.get(b.id) || { sessions: 0, sets: 0 };
            if (statsB.sets !== statsA.sets) {
                return statsB.sets - statsA.sets;
            }
            return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
        });

        if (sorted.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'volume-section-empty';
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 3;
            emptyCell.textContent = '—';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }

        sorted.forEach((exercise) => {
            const stats = statsByExercise.get(exercise.id) || { sessions: 0, sets: 0 };
            const scaledSessions = shouldScaleToWeek ? stats.sessions * weeklyScale : stats.sessions;
            const scaledSets = shouldScaleToWeek ? stats.sets * weeklyScale : stats.sets;
            const totals = weeksInRange
                ? {
                    sessions: {
                        current: stats.sessions
                    },
                    sets: {
                        current: stats.sets
                    }
                }
                : null;
            const row = document.createElement('tr');
            row.className = 'volume-exercise-row';
            makeRowClickable(row, () => {
                A.openExerciseStats?.(exercise.id);
            });
            const nameCell = document.createElement('td');
            nameCell.textContent = exercise.name || '—';
            row.appendChild(nameCell);
            row.appendChild(createGaugeCell(scaledSessions, 0, 'séances', {
                showTarget: false,
                totals: totals?.sessions || null
            }));
            row.appendChild(createGaugeCell(scaledSets, 0, 'séries', {
                showTarget: false,
                totals: totals?.sets || null
            }));
            tableBody.appendChild(row);
        });
    }

    function hasExerciseStats(statsByExercise, exerciseId) {
        const stats = statsByExercise.get(exerciseId);
        if (!stats) {
            return false;
        }
        return stats.sessions > 0 || stats.sets > 0;
    }

    function createGaugeCell(current, target, label, options = {}) {
        const { showTarget = true, totals = null } = options;
        const cell = document.createElement('td');
        const gauge = document.createElement('div');
        gauge.className = 'volume-gauge';
        gauge.setAttribute('aria-label', label);

        const fill = document.createElement('div');
        fill.className = 'volume-gauge-fill';
        const safeCurrent = Number.isFinite(current) ? current : 0;
        const safeTarget = Number.isFinite(target) ? target : 0;
        const ratio = showTarget && safeTarget > 0 ? Math.min(safeCurrent / safeTarget, 1) : 0;
        fill.style.width = `${Math.round(ratio * 100)}%`;

        const text = document.createElement('div');
        text.className = 'volume-gauge-label';
        const formattedCurrent = formatVolumeValue(safeCurrent);
        if (totals && typeof totals === 'object') {
            const totalCurrent = formatTotalValue(totals.current);
            if (showTarget) {
                const totalTarget = totals.target > 0 ? formatTotalValue(totals.target) : '—';
                text.textContent = `${formattedCurrent} - ${totalCurrent} / ${totalTarget}`;
            } else {
                text.textContent = `${formattedCurrent} - ${totalCurrent}`;
            }
        } else if (showTarget) {
            text.textContent = safeTarget > 0 ? `${formattedCurrent}/${formatVolumeValue(safeTarget)}` : `${formattedCurrent}/—`;
        } else {
            text.textContent = formattedCurrent;
        }

        gauge.appendChild(fill);
        gauge.appendChild(text);
        cell.appendChild(gauge);
        return cell;
    }

    function makeRowClickable(row, onClick) {
        if (!row) {
            return;
        }
        row.classList.add('volume-row-clickable');
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.addEventListener('click', onClick);
        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
            }
        });
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

    function formatVolumeValue(value) {
        const rounded = Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;
        return rounded.toFixed(1);
    }

    function formatTotalValue(value) {
        const rounded = Math.round(Number.isFinite(value) ? value : 0);
        return String(rounded);
    }

    function getRangeLabel(value) {
        const label = value ? String(value) : '';
        if (RANGE_BY_LABEL.has(label)) {
            return label;
        }
        const normalized = label.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
        const alias = RANGE_LABEL_ALIASES.get(normalized);
        if (alias && RANGE_BY_LABEL.has(alias)) {
            return alias;
        }
        return DEFAULT_RANGE_LABEL;
    }

    function getRangeDays(rangeLabel) {
        const today = A.today();
        const { config } = getRangeWindow(rangeLabel, today);
        if (!config) {
            return 7;
        }
        if (config.type === 'month') {
            return getMonthLength(today);
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

    function getMonthLength(date) {
        if (!(date instanceof Date)) {
            return 30;
        }
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    function getRangeWindow(rangeLabel, referenceDate = null) {
        const config = RANGE_BY_LABEL.get(getRangeLabel(rangeLabel)) || RANGE_BY_LABEL.get(DEFAULT_RANGE_LABEL);
        const today = referenceDate instanceof Date ? referenceDate : A.today();
        let start = today;
        let end = today;
        if (config?.type === 'week') {
            start = A.startOfWeek(today);
        } else if (config?.type === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
        } else {
            start = A.addDays(today, -((config?.days || 7) - 1));
        }
        return {
            config,
            start,
            end,
            today,
            monthLength: getMonthLength(today)
        };
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

    function computeMuscleStats(sessions, exercises, muscleKey, start, end) {
        const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
        const stats = { sessions: 0, sets: 0 };

        sessions.forEach((session) => {
            const sessionDateKey = resolveSessionDateKey(session);
            const sessionDate = parseDateKey(sessionDateKey);
            if (!sessionDate || sessionDate < start || sessionDate > end) {
                return;
            }

            let sessionCounted = false;
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

                if (primaryMuscle && primaryMuscle === muscleKey) {
                    stats.sets += doneSets;
                }
                if (!sessionCounted && muscles.includes(muscleKey)) {
                    stats.sessions += 1;
                    sessionCounted = true;
                }
            });
        });

        return stats;
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

        const { start, end } = getRangeWindow(rangeLabel);

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
