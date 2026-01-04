// ui-stats.js — écrans de statistiques des exercices
(() => {
    const A = window.App;
    const listCard = A?.components?.listCard;
    if (!listCard) {
        throw new Error('ui-stats: composant listCard manquant.');
    }

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        activeMetric: 'orm',
        activeRange: '3M',
        exercises: [],
        usageByExercise: new Map(),
        activeExercise: null
    };
    const goalDialog = {
        wired: false
    };

    const METRIC_DEFINITIONS = [
        {
            key: 'orm',
            tagLabel: '1RM est',
            label: '1RM estimé',
            axisUnit: 'kg',
            format: formatKilograms
        },
        {
            key: 'tenrm',
            tagLabel: '10RM est',
            label: '10RM estimé',
            axisUnit: 'kg',
            format: formatKilograms
        },
        {
            key: 'avgRpe',
            tagLabel: 'RPE moyen',
            label: 'RPE moyen',
            axisUnit: 'RPE',
            format: formatRpe
        },
        {
            key: 'tenrmReal',
            tagLabel: '10RM réel',
            label: '10RM réel',
            axisUnit: 'kg',
            format: formatKilograms
        },
        {
            key: 'reps',
            tagLabel: 'Répétitions',
            label: 'Répétitions totales',
            axisUnit: 'répétitions',
            format: formatRepetitions
        },
        {
            key: 'weight',
            tagLabel: 'Charge max',
            label: 'Charge maximale',
            axisUnit: 'kg',
            format: formatKilograms
        },
        {
            key: 'volume',
            tagLabel: 'Volume',
            label: 'Volume total',
            axisUnit: 'kg',
            format: formatVolume
        },
        {
            key: 'setsWeek',
            tagLabel: 'Séries/sem.',
            label: 'Série semaine',
            axisUnit: 'séries',
            format: formatSeries
        }
    ];

    const METRIC_MAP = METRIC_DEFINITIONS.reduce((acc, item) => {
        acc[item.key] = item;
        return acc;
    }, {});

    const RANGE_OPTIONS = [
        { key: '1M', label: '1 m.', days: 30 },
        { key: '3M', label: '3 m.', days: 91 },
        { key: '6M', label: '6 m.', days: 182 },
        { key: '12M', label: '12 m.', days: 365 }
    ];

    const RANGE_MAP = RANGE_OPTIONS.reduce((acc, item) => {
        acc[item.key] = item;
        return acc;
    }, {});

    const DAY_MS = 24 * 60 * 60 * 1000;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireEvents();
    });

    /* ACTIONS */
    A.openStatsList = async function openStatsList() {
        ensureRefs();
        highlightStatsTab();
        await loadData(true);
        state.activeExercise = null;
        renderExerciseList();
        switchScreen('screenStatExercises');
    };

    A.openExerciseStats = async function openExerciseStats(exerciseId) {
        ensureRefs();
        highlightStatsTab();
        await loadData(true);
        const exercise = state.exercises.find((item) => item.id === exerciseId) || (await db.get('exercises', exerciseId));
        state.activeExercise = exercise || null;
        renderExerciseDetail();
        switchScreen('screenStatExercisesDetail');
    };

    A.invalidateStatsCache = function invalidateStatsCache() {
        state.exercises = [];
        state.usageByExercise.clear();
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenSessions = document.getElementById('screenSessions');
        refs.screenExercises = document.getElementById('screenExercises');
        refs.screenExerciseEdit = document.getElementById('screenExerciseEdit');
        refs.screenExerciseRead = document.getElementById('screenExerciseRead');
        refs.screenExecEdit = document.getElementById('screenExecEdit');
        refs.screenRoutineList = document.getElementById('screenRoutineList');
        refs.screenRoutineEdit = document.getElementById('screenRoutineEdit');
        refs.screenRoutineMoveEdit = document.getElementById('screenRoutineMoveEdit');
        refs.screenStatExercises = document.getElementById('screenStatExercises');
        refs.screenStatExercisesDetail = document.getElementById('screenStatExercisesDetail');
        refs.screenSettings = document.getElementById('screenSettings');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.statsExerciseList = document.getElementById('statsExerciseList');
        refs.statsExerciseTitle = document.getElementById('statsExerciseTitle');
        refs.statsExerciseSubtitle = document.getElementById('statsExerciseSubtitle');
        refs.statsChart = document.getElementById('statsChart');
        refs.statsChartEmpty = document.getElementById('statsChartEmpty');
        refs.statsMetricTags = document.getElementById('statsMetricTags');
        refs.statsRangeTags = document.getElementById('statsRangeTags');
        refs.statsTimeline = document.getElementById('statsTimeline');
        refs.statsTimelineTitle = document.getElementById('statsTimelineTitle');
        refs.statsBack = document.getElementById('statsBack');
        refs.statsGoal = document.getElementById('statsGoal');
        refs.tabStats = document.getElementById('tabStats');
        refs.tabSessions = document.getElementById('tabSessions');
        refs.dlgStatsGoal = document.getElementById('dlgStatsGoal');
        refs.statsGoalCancel = document.getElementById('statsGoalCancel');
        refs.statsGoalSave = document.getElementById('statsGoalSave');
        refs.statsGoalSetsMin = document.getElementById('statsGoalSetsMin');
        refs.statsGoalSetsMax = document.getElementById('statsGoalSetsMax');
        refs.statsGoalVolumeMin = document.getElementById('statsGoalVolumeMin');
        refs.statsGoalVolumeMax = document.getElementById('statsGoalVolumeMax');
        refs.statsGoalRepsMin = document.getElementById('statsGoalRepsMin');
        refs.statsGoalRepsMax = document.getElementById('statsGoalRepsMax');
        refs.statsGoalOrmStart = document.getElementById('statsGoalOrmStart');
        refs.statsGoalOrmStartPick = document.getElementById('statsGoalOrmStartPick');
        refs.statsGoalOrmStartValue = document.getElementById('statsGoalOrmStartValue');
        refs.statsGoalOrmTargetDate = document.getElementById('statsGoalOrmTargetDate');
        refs.statsGoalOrmTargetDatePick = document.getElementById('statsGoalOrmTargetDatePick');
        refs.statsGoalOrmTargetValue = document.getElementById('statsGoalOrmTargetValue');
        refsResolved = true;
        return refs;
    }

    function assertStatsRefs() {
        ensureRefs();
        const required = [
            'screenStatExercises',
            'statsExerciseList',
            'screenStatExercisesDetail',
            'statsExerciseTitle',
            'statsExerciseSubtitle',
            'statsChart',
            'statsChartEmpty',
            'statsMetricTags',
            'statsRangeTags',
            'statsTimeline',
            'statsTimelineTitle',
            'statsBack',
            'statsGoal'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-stats.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireEvents() {
        const { statsBack, statsMetricTags, statsRangeTags, statsGoal } = assertStatsRefs();
        statsBack.addEventListener('click', () => {
            highlightStatsTab();
            state.activeExercise = null;
            renderExerciseList();
            switchScreen('screenStatExercises');
        });
        if (statsGoal) {
            statsGoal.addEventListener('click', () => {
                openGoalDialog();
            });
        }
        if (statsMetricTags) {
            statsMetricTags.addEventListener('click', (event) => {
                const target = event.target.closest('[data-metric]');
                if (!target) {
                    return;
                }
                const next = target.getAttribute('data-metric');
                if (!next || next === state.activeMetric || !METRIC_MAP[next]) {
                    return;
                }
                state.activeMetric = next;
                renderExerciseDetail();
            });
        }
        if (statsRangeTags) {
            statsRangeTags.addEventListener('click', (event) => {
                const target = event.target.closest('[data-range]');
                if (!target) {
                    return;
                }
                const next = target.getAttribute('data-range');
                if (!next || next === state.activeRange || !RANGE_MAP[next]) {
                    return;
                }
                state.activeRange = next;
                renderExerciseDetail();
            });
        }
        wireGoalDialogEvents();
    }

    async function loadData(force = false) {
        if (!force && state.exercises.length) {
            return;
        }
        const [exercisesRaw, sessionsRaw] = await Promise.all([db.getAll('exercises'), db.getAll('sessions')]);
        const exercises = Array.isArray(exercisesRaw) ? exercisesRaw : [];
        const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : [];

        const usageMap = new Map();
        sessions.forEach((session) => {
            const { exercises: executed } = session || {};
            const date = resolveSessionDate(session);
            if (!date || !Array.isArray(executed)) {
                return;
            }
            const dateObj = parseDate(date);
            executed.forEach((item) => {
                const sets = Array.isArray(item?.sets) ? item.sets : [];
                if (!sets.length) {
                    return;
                }
                const metrics = computeMetrics(sets);
                if (!metrics.hasData) {
                    return;
                }
                const entry = {
                    date,
                    dateObj,
                    metrics
                };
                const key = item?.exercise_id;
                if (!key) {
                    return;
                }
                if (!usageMap.has(key)) {
                    usageMap.set(key, []);
                }
                usageMap.get(key).push(entry);
            });
        });

        usageMap.forEach((list) => {
            list.sort((a, b) => a.date.localeCompare(b.date));
        });

        const enriched = exercises.map((exercise) => {
            const usage = usageMap.get(exercise.id) || [];
            const usageCount = usage.length;
            const latest = usageCount ? usage[usageCount - 1] : null;
            return {
                ...exercise,
                usageCount,
                latestDate: latest ? latest.dateObj : null,
                latestTimestamp: latest ? latest.dateObj.getTime() : 0
            };
        });

        enriched.sort((a, b) => {
            const aHas = a.usageCount > 0;
            const bHas = b.usageCount > 0;
            if (aHas !== bHas) {
                return aHas ? -1 : 1;
            }
            if (aHas && bHas && a.latestTimestamp !== b.latestTimestamp) {
                return b.latestTimestamp - a.latestTimestamp;
            }
            const nameA = (a?.name || '').toLocaleLowerCase('fr-FR');
            const nameB = (b?.name || '').toLocaleLowerCase('fr-FR');
            return nameA.localeCompare(nameB);
        });

        state.exercises = enriched;
        state.usageByExercise = usageMap;
    }

    function renderExerciseList() {
        const { statsExerciseList } = assertStatsRefs();
        statsExerciseList.innerHTML = '';
        if (!state.exercises.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Aucun exercice disponible.';
            statsExerciseList.appendChild(empty);
            return;
        }
        state.exercises.forEach((exercise) => {
            statsExerciseList.appendChild(renderExerciseCard(exercise));
        });
    }

    function renderExerciseCard(exercise) {
        const structure = listCard.createStructure({ clickable: true, role: 'button' });
        const { card, start, body, end } = structure;
        card.setAttribute('aria-label', `${exercise?.name || 'Exercice'} — voir les statistiques`);

        const handle = listCard.createHandle();
        start.insertBefore(handle, body);

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = exercise?.name || 'Exercice';

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = buildExerciseDetails(exercise);

        body.append(title, details);

        const chevron = listCard.createIcon('▶︎');
        end.appendChild(chevron);

        card.addEventListener('click', () => {
            A.openExerciseStats(exercise?.id);
        });

        return card;
    }

    function buildExerciseDetails(exercise) {
        if (!exercise?.usageCount) {
            return 'Jamais réalisé pour le moment.';
        }
        const count = exercise.usageCount;
        const usage = state.usageByExercise.get(exercise.id) || [];
        const last = usage[usage.length - 1];
        const sessionLabel = count > 1 ? 'séances' : 'séance';
        const lastLabel = last?.dateObj ? A.fmtUI(last.dateObj) : '—';
        return `${count} ${sessionLabel} • Dernière : ${lastLabel}`;
    }

    function renderExerciseDetail() {
        const { statsExerciseTitle, statsExerciseSubtitle, statsTimelineTitle } = assertStatsRefs();
        const exercise = state.activeExercise;
        statsExerciseTitle.textContent = exercise?.name || 'Exercice';
        renderMetricTags();
        renderRangeTags();
        updateExerciseSummary(statsExerciseSubtitle);
        updateExerciseHistoryTitle(statsTimelineTitle);
        renderChart();
        renderTimeline();
    }

    function wireGoalDialogEvents() {
        if (goalDialog.wired) {
            return;
        }
        const {
            dlgStatsGoal,
            statsGoalCancel,
            statsGoalSave,
            statsGoalOrmStartPick,
            statsGoalOrmTargetDatePick,
            statsGoalOrmStartValue
        } = ensureRefs();
        if (!dlgStatsGoal) {
            return;
        }
        goalDialog.wired = true;
        if (statsGoalCancel) {
            statsGoalCancel.addEventListener('click', () => {
                dlgStatsGoal.close();
            });
        }
        if (statsGoalSave) {
            statsGoalSave.addEventListener('click', () => {
                void saveGoalDialog();
            });
        }
        if (statsGoalOrmStartPick) {
            statsGoalOrmStartPick.addEventListener('click', () => {
                openGoalDatePicker(refs.statsGoalOrmStart, A.today(), (date) => {
                    updateGoalStartValueFromDate(date);
                });
            });
        }
        if (statsGoalOrmTargetDatePick) {
            statsGoalOrmTargetDatePick.addEventListener('click', () => {
                const fallback = addMonths(A.today(), 3);
                openGoalDatePicker(refs.statsGoalOrmTargetDate, fallback);
            });
        }
        if (statsGoalOrmStartValue) {
            statsGoalOrmStartValue.addEventListener('input', () => {
                if (!statsGoalOrmStartValue.value) {
                    delete statsGoalOrmStartValue.dataset.userEdited;
                    const startDate = getGoalDateInput(refs.statsGoalOrmStart);
                    updateGoalStartValueFromDate(startDate, { force: true });
                    return;
                }
                statsGoalOrmStartValue.dataset.userEdited = 'true';
            });
        }
    }

    function openGoalDialog() {
        const { dlgStatsGoal } = ensureRefs();
        const exercise = state.activeExercise;
        if (!dlgStatsGoal || !exercise) {
            return;
        }
        fillGoalDialog(exercise);
        dlgStatsGoal.showModal();
    }

    function fillGoalDialog(exercise) {
        const {
            statsGoalSetsMin,
            statsGoalSetsMax,
            statsGoalVolumeMin,
            statsGoalVolumeMax,
            statsGoalRepsMin,
            statsGoalRepsMax,
            statsGoalOrmStart,
            statsGoalOrmStartValue,
            statsGoalOrmTargetDate,
            statsGoalOrmTargetValue
        } = ensureRefs();
        const goals = normalizeGoalData(exercise);
        setGoalInputValue(statsGoalSetsMin, goals.setsWeek?.min);
        setGoalInputValue(statsGoalSetsMax, goals.setsWeek?.max);
        setGoalInputValue(statsGoalVolumeMin, goals.volume?.min);
        setGoalInputValue(statsGoalVolumeMax, goals.volume?.max);
        setGoalInputValue(statsGoalRepsMin, goals.reps?.min);
        setGoalInputValue(statsGoalRepsMax, goals.reps?.max);
        setGoalDateInput(statsGoalOrmStart, goals.orm?.startDate);
        setGoalInputValue(statsGoalOrmStartValue, goals.orm?.startValue);
        if (statsGoalOrmStartValue) {
            if (Number.isFinite(goals.orm?.startValue)) {
                statsGoalOrmStartValue.dataset.userEdited = 'true';
            } else {
                delete statsGoalOrmStartValue.dataset.userEdited;
                updateGoalStartValueFromDate(goals.orm?.startDate, { force: true });
            }
        }
        setGoalDateInput(statsGoalOrmTargetDate, goals.orm?.targetDate);
        setGoalInputValue(statsGoalOrmTargetValue, goals.orm?.targetValue);
    }

    async function saveGoalDialog() {
        const { dlgStatsGoal } = ensureRefs();
        const exercise = state.activeExercise;
        if (!dlgStatsGoal || !exercise) {
            return;
        }
        const goals = buildGoalDataFromInputs();
        const updated = {
            ...exercise,
            goals
        };
        await db.put('exercises', updated);
        state.activeExercise = updated;
        const index = state.exercises.findIndex((item) => item.id === updated.id);
        if (index >= 0) {
            state.exercises[index] = updated;
        }
        dlgStatsGoal.close();
        renderExerciseDetail();
    }

    function openGoalDatePicker(input, fallbackDate, onSelect) {
        if (!input) {
            return;
        }
        const selectedDate = getGoalDateInput(input) || fallbackDate || A.today();
        if (typeof A.openCalendarPicker === 'function') {
            void A.openCalendarPicker({
                selectedDate,
                resetMonth: true,
                onSelect: (date) => {
                    setGoalDateInput(input, date);
                    if (typeof onSelect === 'function') {
                        onSelect(date);
                    }
                }
            });
        }
    }

    function normalizeGoalData(exercise) {
        const goals = exercise?.goals || {};
        const today = A.today();
        const startDate = parseGoalDate(goals?.orm?.startDate) || today;
        const targetDate = parseGoalDate(goals?.orm?.targetDate) || addMonths(today, 3);
        return {
            setsWeek: normalizeGoalRange(goals.setsWeek),
            volume: normalizeGoalRange(goals.volume),
            reps: normalizeGoalRange(goals.reps),
            orm: {
                startDate,
                targetDate,
                startValue: normalizeGoalNumber(goals?.orm?.startValue),
                targetValue: normalizeGoalNumber(goals?.orm?.targetValue)
            }
        };
    }

    function normalizeGoalRange(range) {
        if (!range) {
            return { min: null, max: null };
        }
        return {
            min: normalizeGoalNumber(range.min),
            max: normalizeGoalNumber(range.max)
        };
    }

    function normalizeGoalNumber(value) {
        if (!Number.isFinite(value)) {
            return null;
        }
        return Math.round(value * 10) / 10;
    }

    function buildGoalDataFromInputs() {
        const {
            statsGoalSetsMin,
            statsGoalSetsMax,
            statsGoalVolumeMin,
            statsGoalVolumeMax,
            statsGoalRepsMin,
            statsGoalRepsMax,
            statsGoalOrmStart,
            statsGoalOrmStartValue,
            statsGoalOrmTargetDate,
            statsGoalOrmTargetValue
        } = ensureRefs();
        const ormStart = getGoalDateInput(statsGoalOrmStart);
        const ormTargetDate = getGoalDateInput(statsGoalOrmTargetDate);
        const ormStartValue = toGoalNumber(statsGoalOrmStartValue?.value);
        const ormTargetValue = toGoalNumber(statsGoalOrmTargetValue?.value);
        return {
            setsWeek: buildGoalRange(statsGoalSetsMin?.value, statsGoalSetsMax?.value),
            volume: buildGoalRange(statsGoalVolumeMin?.value, statsGoalVolumeMax?.value),
            reps: buildGoalRange(statsGoalRepsMin?.value, statsGoalRepsMax?.value),
            orm: {
                startDate: ormStart && typeof A.ymd === 'function' ? A.ymd(ormStart) : null,
                targetDate: ormTargetDate && typeof A.ymd === 'function' ? A.ymd(ormTargetDate) : null,
                startValue: Number.isFinite(ormStartValue) ? ormStartValue : null,
                targetValue: Number.isFinite(ormTargetValue) ? ormTargetValue : null
            }
        };
    }

    function buildGoalRange(minValue, maxValue) {
        const min = toGoalNumber(minValue);
        const max = toGoalNumber(maxValue);
        if (!Number.isFinite(min) && !Number.isFinite(max)) {
            return null;
        }
        return {
            min: Number.isFinite(min) ? min : null,
            max: Number.isFinite(max) ? max : null
        };
    }

    function toGoalNumber(value) {
        const number = parseNumber(value);
        return Number.isFinite(number) ? number : NaN;
    }

    function setGoalInputValue(input, value) {
        if (!input) {
            return;
        }
        if (!Number.isFinite(value)) {
            input.value = '';
            return;
        }
        const rounded = Math.round(value * 10) / 10;
        input.value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    function setGoalDateInput(input, dateObj) {
        if (!input) {
            return;
        }
        if (!(dateObj instanceof Date)) {
            input.value = '';
            delete input.dataset.date;
            return;
        }
        input.dataset.date = typeof A.ymd === 'function' ? A.ymd(dateObj) : '';
        input.value = typeof A.fmtUI === 'function' ? A.fmtUI(dateObj) : dateObj.toLocaleDateString('fr-FR');
    }

    function getGoalDateInput(input) {
        const key = input?.dataset?.date;
        if (!key) {
            return null;
        }
        return parseDate(key);
    }

    function updateGoalStartValueFromDate(startDate, options = {}) {
        const { statsGoalOrmStartValue } = ensureRefs();
        if (!statsGoalOrmStartValue) {
            return;
        }
        if (statsGoalOrmStartValue.dataset.userEdited === 'true' && !options.force) {
            return;
        }
        if (!(startDate instanceof Date)) {
            setGoalInputValue(statsGoalOrmStartValue, null);
            return;
        }
        const exercise = state.activeExercise;
        const usage = exercise ? state.usageByExercise.get(exercise.id) || [] : [];
        const entry = findGoalStartEntry(usage, startDate);
        const value = entry?.metrics?.orm;
        setGoalInputValue(statsGoalOrmStartValue, Number.isFinite(value) ? value : null);
    }

    function parseGoalDate(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }
        const iso = value.includes('T') ? value : `${value}T00:00:00`;
        const parsed = new Date(iso);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function addMonths(date, delta) {
        const base = date instanceof Date ? new Date(date) : A.today();
        base.setMonth(base.getMonth() + delta);
        return base;
    }

    function renderMetricTags() {
        const { statsMetricTags } = assertStatsRefs();
        if (!statsMetricTags) {
            return;
        }
        statsMetricTags.querySelectorAll('[data-metric]').forEach((button) => {
            const key = button.getAttribute('data-metric');
            const definition = key ? METRIC_MAP[key] : null;
            if (definition) {
                button.textContent = definition.tagLabel;
                button.setAttribute('aria-label', definition.label);
            }
            const isActive = key === state.activeMetric;
            button.classList.toggle('selected', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function renderRangeTags() {
        const { statsRangeTags } = assertStatsRefs();
        if (!statsRangeTags) {
            return;
        }
        statsRangeTags.querySelectorAll('[data-range]').forEach((button) => {
            const key = button.getAttribute('data-range');
            const definition = key ? RANGE_MAP[key] : null;
            if (definition) {
                button.textContent = definition.label;
                const { days } = definition;
                button.setAttribute('aria-label', `Afficher les ${days} derniers jours`);
            }
            const isActive = key === state.activeRange;
            button.classList.toggle('selected', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function updateExerciseSummary(element) {
        const exercise = state.activeExercise;
        if (!exercise) {
            element.textContent = '';
            return;
        }
        const usage = state.usageByExercise.get(exercise.id) || [];
        if (!usage.length) {
            element.textContent = 'Aucune séance enregistrée pour cet exercice.';
            return;
        }
        const last = getLatestEntryForMetric(usage, state.activeMetric);
        if (!last) {
            element.textContent = 'Aucune séance enregistrée pour cet exercice.';
            return;
        }
        const weeklySets = state.activeMetric === 'setsWeek' ? computeWeeklySetCounts(usage) : null;
        const definition = METRIC_MAP[state.activeMetric] || METRIC_DEFINITIONS[0];
        const metricValue = getMetricValue(last, state.activeMetric, weeklySets);
        element.textContent = buildSummaryText(definition, metricValue, last.dateObj);
    }

    function updateExerciseHistoryTitle(element) {
        if (!element) {
            return;
        }
        const exercise = state.activeExercise;
        if (!exercise) {
            element.textContent = 'Historique';
            return;
        }
        const usage = state.usageByExercise.get(exercise.id) || [];
        const count = usage.length;
        const sessionLabel = count > 1 ? 'séances' : 'séance';
        element.textContent = `${count} ${sessionLabel}`;
    }

    function renderChart() {
        const { statsChart, statsChartEmpty, statsExerciseSubtitle } = assertStatsRefs();
        statsChart.innerHTML = '';
        statsChart.removeAttribute('aria-label');
        const exercise = state.activeExercise;
        if (!exercise) {
            statsChartEmpty.hidden = false;
            statsChartEmpty.textContent = 'Aucune donnée enregistrée.';
            return;
        }
        const usage = state.usageByExercise.get(exercise.id) || [];
        if (!usage.length) {
            statsChartEmpty.hidden = false;
            statsChartEmpty.textContent = 'Aucune donnée enregistrée.';
            return;
        }
        const metricDefinition = METRIC_MAP[state.activeMetric] || METRIC_DEFINITIONS[0];
        const rangeDefinition = RANGE_MAP[state.activeRange] || RANGE_OPTIONS[0];
        const cutoff = computeRangeCutoff(rangeDefinition);
        const filtered = cutoff ? usage.filter((entry) => entry.dateObj >= cutoff) : [...usage];
        const aggregated =
            state.activeMetric === 'setsWeek' ? aggregateUsageByWeek(filtered) : aggregateUsageByDay(filtered);
        if (!aggregated.length) {
            statsChartEmpty.hidden = false;
            statsChartEmpty.textContent = 'Aucune donnée sur la période sélectionnée.';
            return;
        }
        statsChartEmpty.hidden = true;
        statsChartEmpty.textContent = 'Aucune donnée enregistrée.';
        const data = aggregated
            .map((entry) => ({
                date: entry.date,
                value: getChartMetricValue(entry, state.activeMetric)
            }))
            .filter((entry) => Number.isFinite(entry.value));
        if (!data.length) {
            statsChartEmpty.hidden = false;
            statsChartEmpty.textContent = 'Aucune donnée sur la période sélectionnée.';
            return;
        }
        statsChartEmpty.hidden = true;
        statsChartEmpty.textContent = 'Aucune donnée enregistrée.';
        const goalMarkers = buildGoalMarkers(state.activeMetric, exercise, usage);
        const goalValues = collectGoalValues(goalMarkers);
        const maxValue = Math.max(...data.map((item) => item.value), ...goalValues, 0);
        const yTicks = computeYAxisTicks(maxValue);
        const chartMax = yTicks[yTicks.length - 1] || maxValue || 1;
        const width = Math.max(statsChart.clientWidth || 0, 640);
        const height = 240;
        const padding = { top: 16, right: 16, bottom: 40, left: 56 };
        const innerWidth = Math.max(1, width - padding.left - padding.right);
        const innerHeight = Math.max(1, height - padding.top - padding.bottom);
        const firstDate = data[0].date;
        const lastDate = data[data.length - 1].date;
        const duration = Math.max(1, lastDate.getTime() - firstDate.getTime());
        const points = data.map((item) => {
            const ratioX = data.length === 1 ? 0.5 : (item.date.getTime() - firstDate.getTime()) / duration;
            const x = padding.left + ratioX * innerWidth;
            const ratioY = chartMax > 0 ? item.value / chartMax : 0;
            const y = padding.top + (1 - ratioY) * innerHeight;
            return { x, y, value: item.value, date: item.date };
        });
        const pathData = points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
            .join(' ');

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('role', 'presentation');
        svg.classList.add('stats-chart-svg');

        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const yAxisLabelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const yAxisPosition = height - padding.bottom;

        yTicks.forEach((tickValue) => {
            const ratio = chartMax > 0 ? tickValue / chartMax : 0;
            const y = padding.top + (1 - ratio) * innerHeight;
            if (tickValue > 0) {
                const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                gridLine.setAttribute('x1', String(padding.left));
                gridLine.setAttribute('x2', String(width - padding.right));
                gridLine.setAttribute('y1', y.toFixed(2));
                gridLine.setAttribute('y2', y.toFixed(2));
                gridLine.setAttribute('class', 'stats-grid-line');
                gridGroup.appendChild(gridLine);
            }

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.textContent = formatYAxisTick(tickValue, state.activeMetric);
            label.setAttribute('x', String(padding.left - 8));
            label.setAttribute('y', y.toFixed(2));
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('class', 'stats-axis-tick stats-axis-tick-y');
            yAxisLabelsGroup.appendChild(label);
        });

        svg.appendChild(gridGroup);
        appendGoalLines(svg, goalMarkers, {
            chartMax,
            chartMin: 0,
            padding,
            width,
            height,
            innerWidth,
            innerHeight,
            firstDate,
            lastDate,
            duration
        });

        const axisX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        axisX.setAttribute('x1', String(padding.left));
        axisX.setAttribute('y1', String(yAxisPosition));
        axisX.setAttribute('x2', String(width - padding.right));
        axisX.setAttribute('y2', String(yAxisPosition));
        axisX.setAttribute('class', 'stats-axis-line');
        svg.appendChild(axisX);

        svg.appendChild(yAxisLabelsGroup);

        const xTicks = computeXAxisTicks(firstDate, lastDate, padding, innerWidth);
        const xAxisLabelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        xTicks.forEach((tick) => {
            const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickLine.setAttribute('x1', tick.x.toFixed(2));
            tickLine.setAttribute('x2', tick.x.toFixed(2));
            tickLine.setAttribute('y1', yAxisPosition);
            tickLine.setAttribute('y2', (yAxisPosition + 6).toFixed(2));
            tickLine.setAttribute('class', 'stats-axis-tick-line');
            svg.appendChild(tickLine);

            const tickLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tickLabel.textContent = formatXAxisTick(tick.date, rangeDefinition);
            tickLabel.setAttribute('x', tick.x.toFixed(2));
            tickLabel.setAttribute('y', (yAxisPosition + 20).toFixed(2));
            tickLabel.setAttribute('text-anchor', 'middle');
            tickLabel.setAttribute('class', 'stats-axis-tick stats-axis-tick-x');
            xAxisLabelsGroup.appendChild(tickLabel);
        });

        svg.appendChild(xAxisLabelsGroup);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('class', 'stats-chart-line');
        svg.appendChild(path);

        const focusGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        focusGroup.setAttribute('class', 'stats-chart-focus');

        const focusLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        focusLine.setAttribute('class', 'stats-chart-focus-line');
        focusGroup.appendChild(focusLine);

        focusGroup.setAttribute('data-visible', 'false');
        svg.appendChild(focusGroup);

        const updateSubtitleForPoint = (point) => {
            if (!statsExerciseSubtitle) {
                return;
            }
            statsExerciseSubtitle.textContent = buildSummaryText(metricDefinition, point.value, point.date);
        };

        const updateFocusAtPoint = (point) => {
            if (!point) {
                return;
            }
            focusGroup.setAttribute('data-visible', 'true');
            focusLine.setAttribute('x1', point.x.toFixed(2));
            focusLine.setAttribute('x2', point.x.toFixed(2));
            focusLine.setAttribute('y1', padding.top.toFixed(2));
            focusLine.setAttribute('y2', yAxisPosition.toFixed(2));
            if (point.element) {
                points.forEach((item) => item.element?.classList.remove('is-active'));
                point.element.classList.add('is-active');
            }
            updateSubtitleForPoint(point);
        };

        const handlePointerDown = (event) => {
            if (!points.length) {
                return;
            }
            event.preventDefault();
            const rect = svg.getBoundingClientRect();
            if (!rect.width) {
                return;
            }
            const chartX = ((event.clientX - rect.left) / rect.width) * width;
            let closest = points[0];
            let minDistance = Math.abs(points[0].x - chartX);
            for (let i = 1; i < points.length; i += 1) {
                const candidate = points[i];
                const distance = Math.abs(candidate.x - chartX);
                if (distance < minDistance) {
                    minDistance = distance;
                    closest = candidate;
                }
            }
            updateFocusAtPoint(closest);
        };

        svg.addEventListener('pointerdown', handlePointerDown);

        points.forEach((point) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x.toFixed(2));
            circle.setAttribute('cy', point.y.toFixed(2));
            circle.setAttribute('r', '5');
            circle.setAttribute('class', 'stats-chart-point');
            point.element = circle;
            svg.appendChild(circle);
        });

        statsChart.setAttribute(
            'aria-label',
            `Évolution — ${metricDefinition.label} du ${A.fmtUI(firstDate)} au ${A.fmtUI(lastDate)} (${data.length} point${
                data.length > 1 ? 's' : ''
            })`
        );
        statsChart.appendChild(svg);
    }

    function buildGoalMarkers(metricKey, exercise, usage) {
        const markers = {
            horizontal: [],
            vertical: [],
            trends: []
        };
        const goals = exercise?.goals || {};
        if (metricKey === 'setsWeek') {
            const range = normalizeGoalRange(goals.setsWeek);
            if (Number.isFinite(range.min)) {
                markers.horizontal.push({ value: range.min, variant: 'min' });
            }
            if (Number.isFinite(range.max)) {
                markers.horizontal.push({ value: range.max, variant: 'max' });
            }
            return markers;
        }
        if (metricKey === 'volume' || metricKey === 'reps') {
            const range = normalizeGoalRange(goals[metricKey]);
            if (Number.isFinite(range.min)) {
                markers.horizontal.push({ value: range.min, variant: 'min' });
            }
            if (Number.isFinite(range.max)) {
                markers.horizontal.push({ value: range.max, variant: 'max' });
            }
            return markers;
        }
        if (metricKey === 'orm') {
            const trendLines = buildOrmGoalTrends(usage, goals.orm);
            markers.trends = trendLines;
        }
        return markers;
    }

    function buildOrmGoalTrends(usage, ormGoal) {
        if (!ormGoal) {
            return [];
        }
        const startDate = parseGoalDate(ormGoal.startDate);
        const targetDate = parseGoalDate(ormGoal.targetDate);
        const targetValue = normalizeGoalNumber(ormGoal.targetValue);
        const manualStartValue = normalizeGoalNumber(ormGoal.startValue);
        if (!(startDate instanceof Date) || !(targetDate instanceof Date) || !Number.isFinite(targetValue)) {
            return [];
        }
        const startEntry = findGoalStartEntry(usage, startDate);
        const startValue = Number.isFinite(manualStartValue) ? manualStartValue : startEntry?.metrics?.orm;
        if (!startEntry || !Number.isFinite(startValue) || startValue <= 0) {
            return [];
        }
        if (targetDate.getTime() <= startEntry.dateObj.getTime()) {
            return [];
        }
        const delta = targetValue - startValue;
        const lowerTarget = startValue + delta * 0.98;
        const upperTarget = startValue + delta * 1.02;
        return [
            {
                startDate: startEntry.dateObj,
                startValue,
                endDate: targetDate,
                endValue: lowerTarget,
                variant: 'min'
            },
            {
                startDate: startEntry.dateObj,
                startValue,
                endDate: targetDate,
                endValue: upperTarget,
                variant: 'max'
            }
        ];
    }

    function findGoalStartEntry(usage, startDate) {
        if (!Array.isArray(usage) || !usage.length) {
            return null;
        }
        const startTime = startDate.getTime();
        return usage.find((entry) => entry?.dateObj && entry.dateObj.getTime() >= startTime) || null;
    }

    function collectGoalValues(markers) {
        const values = [];
        markers.horizontal.forEach((line) => values.push(line.value));
        markers.vertical.forEach((line) => values.push(line.value));
        markers.trends.forEach((line) => {
            values.push(line.startValue, line.endValue);
        });
        return values.filter((value) => Number.isFinite(value));
    }

    function appendGoalLines(svg, markers, chart) {
        const { chartMax, padding, width, height, innerWidth, innerHeight, firstDate, lastDate, duration } = chart;
        if (!svg || !markers) {
            return;
        }
        const yAxisPosition = height - padding.bottom;
        const getYForValue = (value) => {
            const ratio = chartMax > 0 ? value / chartMax : 0;
            return padding.top + (1 - ratio) * innerHeight;
        };
        const clampY = (value) => Math.min(yAxisPosition, Math.max(padding.top, value));
        const getXForDate = (date) => {
            if (!(date instanceof Date)) {
                return padding.left;
            }
            const ratioX =
                duration === 0 ? 0.5 : (date.getTime() - firstDate.getTime()) / duration;
            return padding.left + ratioX * innerWidth;
        };

        const goalGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        goalGroup.setAttribute('class', 'stats-goal-lines');

        markers.horizontal.forEach((line) => {
            if (!Number.isFinite(line.value)) {
                return;
            }
            const y = clampY(getYForValue(line.value));
            if (line.variant === 'min') {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', String(padding.left));
                rect.setAttribute('y', y.toFixed(2));
                rect.setAttribute('width', String(innerWidth));
                rect.setAttribute('height', Math.max(0, yAxisPosition - y).toFixed(2));
                rect.setAttribute('class', 'stats-goal-zone stats-goal-zone-min');
                goalGroup.appendChild(rect);
            }
            if (line.variant === 'max') {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', String(padding.left));
                rect.setAttribute('y', String(padding.top));
                rect.setAttribute('width', String(innerWidth));
                rect.setAttribute('height', Math.max(0, y - padding.top).toFixed(2));
                rect.setAttribute('class', 'stats-goal-zone stats-goal-zone-max');
                goalGroup.appendChild(rect);
            }
            const goalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            goalLine.setAttribute('x1', String(padding.left));
            goalLine.setAttribute('x2', String(width - padding.right));
            goalLine.setAttribute('y1', y.toFixed(2));
            goalLine.setAttribute('y2', y.toFixed(2));
            goalLine.setAttribute('class', `stats-goal-line stats-goal-line-${line.variant}`);
            goalGroup.appendChild(goalLine);
        });

        markers.vertical.forEach((line) => {
            if (!Number.isFinite(line.value)) {
                return;
            }
            const ratio = chartMax > 0 ? line.value / chartMax : 0;
            const x = padding.left + ratio * innerWidth;
            const goalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            goalLine.setAttribute('x1', x.toFixed(2));
            goalLine.setAttribute('x2', x.toFixed(2));
            goalLine.setAttribute('y1', padding.top.toFixed(2));
            goalLine.setAttribute('y2', yAxisPosition.toFixed(2));
            goalLine.setAttribute('class', `stats-goal-line stats-goal-line-${line.variant}`);
            goalGroup.appendChild(goalLine);
        });

        markers.trends.forEach((trend) => {
            const segment = computeTrendSegment(trend, firstDate, lastDate);
            if (!segment) {
                return;
            }
            const x1 = getXForDate(segment.startDate);
            const x2 = getXForDate(segment.endDate);
            const y1 = getYForValue(segment.startValue);
            const y2 = getYForValue(segment.endValue);
            const trendLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            trendLine.setAttribute('x1', x1.toFixed(2));
            trendLine.setAttribute('x2', x2.toFixed(2));
            trendLine.setAttribute('y1', y1.toFixed(2));
            trendLine.setAttribute('y2', y2.toFixed(2));
            trendLine.setAttribute('class', `stats-goal-trend stats-goal-trend-${trend.variant}`);
            goalGroup.appendChild(trendLine);
        });

        if (goalGroup.childNodes.length) {
            svg.appendChild(goalGroup);
        }
    }

    function computeTrendSegment(trend, rangeStart, rangeEnd) {
        if (!trend?.startDate || !trend?.endDate) {
            return null;
        }
        const startTime = trend.startDate.getTime();
        const endTime = trend.endDate.getTime();
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
            return null;
        }
        const rangeStartTime = rangeStart.getTime();
        const rangeEndTime = rangeEnd.getTime();
        if (rangeEndTime < startTime || rangeStartTime > endTime) {
            return null;
        }
        const visibleStartTime = Math.max(startTime, rangeStartTime);
        const visibleEndTime = Math.min(endTime, rangeEndTime);
        const slope = (trend.endValue - trend.startValue) / (endTime - startTime);
        const startValue = trend.startValue + slope * (visibleStartTime - startTime);
        const endValue = trend.startValue + slope * (visibleEndTime - startTime);
        return {
            startDate: new Date(visibleStartTime),
            endDate: new Date(visibleEndTime),
            startValue,
            endValue
        };
    }

    function computeYAxisTicks(maxValue) {
        if (!Number.isFinite(maxValue) || maxValue <= 0) {
            return [0];
        }
        const tickCount = 5;
        const niceRange = niceNumber(maxValue, false);
        const step = niceNumber(niceRange / (tickCount - 1), true);
        const maxTick = Math.ceil(maxValue / step) * step;
        const ticks = [];
        for (let value = 0; value <= maxTick + step / 2; value += step) {
            const normalized = Math.round(value * 1000) / 1000;
            ticks.push(normalized);
        }
        if (!ticks.includes(maxTick)) {
            ticks.push(Math.round(maxTick * 1000) / 1000);
        }
        if (!ticks.includes(0)) {
            ticks.push(0);
        }
        return Array.from(new Set(ticks)).sort((a, b) => a - b);
    }

    function niceNumber(value, round) {
        if (!Number.isFinite(value) || value <= 0) {
            return 0;
        }
        const exponent = Math.floor(Math.log10(value));
        const fraction = value / 10 ** exponent;
        let niceFraction;
        if (round) {
            if (fraction < 1.5) {
                niceFraction = 1;
            } else if (fraction < 3) {
                niceFraction = 2;
            } else if (fraction < 7) {
                niceFraction = 5;
            } else {
                niceFraction = 10;
            }
        } else if (fraction <= 1) {
            niceFraction = 1;
        } else if (fraction <= 2) {
            niceFraction = 2;
        } else if (fraction <= 5) {
            niceFraction = 5;
        } else {
            niceFraction = 10;
        }
        return niceFraction * 10 ** exponent;
    }

    function formatYAxisTick(value, metric) {
        const normalized = Number.isFinite(value) ? value : 0;
        if (metric === 'volume') {
            return formatNumberWithSpaces(Math.round(normalized));
        }
        if (metric === 'reps') {
            return String(Math.round(normalized));
        }
        if (Math.abs(normalized) >= 100) {
            return String(Math.round(normalized));
        }
        const rounded = Math.round(normalized * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    function computeXAxisTicks(firstDate, lastDate, padding, innerWidth) {
        if (!(firstDate instanceof Date) || !(lastDate instanceof Date)) {
            return [];
        }
        const tickCount = 4;
        const firstTime = firstDate.getTime();
        const lastTime = Math.max(firstTime, lastDate.getTime());
        const duration = Math.max(0, lastTime - firstTime);
        const ticks = [];
        for (let index = 0; index < tickCount; index += 1) {
            const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
            const time = duration === 0 ? firstTime : firstTime + ratio * duration;
            const date = new Date(time);
            const x = padding.left + ratio * innerWidth;
            ticks.push({ x, date });
        }
        return ticks;
    }

    function formatXAxisTick(date, rangeDefinition) {
        if (!(date instanceof Date)) {
            return '';
        }
        const options = { day: 'numeric', month: 'short' };
        if (rangeDefinition?.days && rangeDefinition.days > 200) {
            options.year = '2-digit';
        }
        return date
            .toLocaleDateString('fr-FR', options)
            .replace(/\./g, '')
            .replace(/\u00a0/g, ' ');
    }

    function renderTimeline() {
        const { statsTimeline } = assertStatsRefs();
        statsTimeline.innerHTML = '';
        const exercise = state.activeExercise;
        if (!exercise) {
            statsTimeline.appendChild(buildTimelineEmpty());
            return;
        }
        const usage = state.usageByExercise.get(exercise.id) || [];
        if (!usage.length) {
            statsTimeline.appendChild(buildTimelineEmpty());
            return;
        }
        const rangeDefinition = RANGE_MAP[state.activeRange] || RANGE_OPTIONS[0];
        const cutoff = computeRangeCutoff(rangeDefinition);
        const filtered = cutoff ? usage.filter((entry) => entry.dateObj >= cutoff) : [...usage];
        if (!filtered.length) {
            const message = usage.length ? 'Aucune séance sur la période sélectionnée.' : 'Aucune séance enregistrée.';
            statsTimeline.appendChild(buildTimelineEmpty(message));
            return;
        }
        const ordered = filtered.sort((a, b) => b.date.localeCompare(a.date));
        const weeklySets = state.activeMetric === 'setsWeek' ? computeWeeklySetCounts(filtered) : null;
        ordered.forEach((entry) => {
            statsTimeline.appendChild(renderTimelineItem(entry, weeklySets));
        });
    }

    function buildTimelineEmpty(message = 'Aucune séance enregistrée.') {
        const empty = document.createElement('li');
        empty.className = 'stats-timeline-empty';
        empty.textContent = message;
        return empty;
    }

    function renderTimelineItem(entry, weeklySets) {
        const item = document.createElement('li');
        item.className = 'stats-timeline-item';

        const date = document.createElement('span');
        date.className = 'stats-timeline-date';
        date.textContent = entry?.dateObj ? A.fmtUI(entry.dateObj) : '—';

        const middle = document.createElement('span');
        middle.className = 'stats-timeline-middle';
        const middleMetric = state.activeMetric === 'setsWeek' ? 'volume' : 'setCount';
        const middleValue =
            middleMetric === 'volume' ? entry?.metrics?.volume || 0 : entry?.metrics?.setCount || 0;
        middle.textContent =
            middleMetric === 'volume' ? formatVolume(middleValue) : formatSeries(middleValue);

        const value = document.createElement('span');
        value.className = 'stats-timeline-value';
        const metricValue = getMetricValue(entry, state.activeMetric, weeklySets);
        value.textContent = formatMetricValue(metricValue, state.activeMetric);

        const goToSession = () => {
            void openSessionFromEntry(entry);
        };

        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.addEventListener('click', goToSession);
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                goToSession();
            }
        });

        item.append(date, middle, value);
        return item;
    }

    function aggregateUsageByDay(list) {
        const grouped = new Map();
        list.forEach((entry) => {
            const key = entry?.date;
            if (!key) {
                return;
            }
            if (!grouped.has(key)) {
                grouped.set(key, {
                    date: entry.dateObj,
                    metrics: {
                        reps: 0,
                        weight: 0,
                        orm: 0,
                        tenrm: 0,
                        tenrmReal: null,
                        volume: 0,
                        setCount: 0,
                        avgRpe: 0,
                        rpeSum: 0,
                        rpeCount: 0
                    }
                });
            }
            const target = grouped.get(key);
            const metrics = entry?.metrics || {};
            target.metrics.reps += metrics.reps || 0;
            target.metrics.weight = Math.max(target.metrics.weight, metrics.weight || 0);
            target.metrics.orm = Math.max(target.metrics.orm, metrics.orm || 0);
            target.metrics.tenrm = Math.max(target.metrics.tenrm, metrics.tenrm || 0);
            if (Number.isFinite(metrics.tenrmReal)) {
                target.metrics.tenrmReal = Number.isFinite(target.metrics.tenrmReal)
                    ? Math.max(target.metrics.tenrmReal, metrics.tenrmReal)
                    : metrics.tenrmReal;
            }
            target.metrics.volume += metrics.volume || 0;
            target.metrics.setCount += metrics.setCount || 0;
            target.metrics.rpeSum += metrics.rpeSum || 0;
            target.metrics.rpeCount += metrics.rpeCount || 0;
        });
        return Array.from(grouped.values())
            .map((item) => ({
                ...item,
                metrics: {
                    ...item.metrics,
                    avgRpe: item.metrics.rpeCount ? item.metrics.rpeSum / item.metrics.rpeCount : 0,
                    setsWeek: item.metrics.setCount
                }
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    function aggregateUsageByWeek(list) {
        const grouped = new Map();
        list.forEach((entry) => {
            const dateObj = entry?.dateObj;
            const key = getWeekKey(dateObj);
            if (!key) {
                return;
            }
            if (!grouped.has(key)) {
                grouped.set(key, {
                    date: getWeekStartDate(dateObj),
                    metrics: {
                        reps: 0,
                        weight: 0,
                        orm: 0,
                        tenrm: 0,
                        tenrmReal: null,
                        volume: 0,
                        setCount: 0,
                        avgRpe: 0,
                        rpeSum: 0,
                        rpeCount: 0
                    }
                });
            }
            const target = grouped.get(key);
            const metrics = entry?.metrics || {};
            target.metrics.reps += metrics.reps || 0;
            target.metrics.weight = Math.max(target.metrics.weight, metrics.weight || 0);
            target.metrics.orm = Math.max(target.metrics.orm, metrics.orm || 0);
            target.metrics.tenrm = Math.max(target.metrics.tenrm, metrics.tenrm || 0);
            if (Number.isFinite(metrics.tenrmReal)) {
                target.metrics.tenrmReal = Number.isFinite(target.metrics.tenrmReal)
                    ? Math.max(target.metrics.tenrmReal, metrics.tenrmReal)
                    : metrics.tenrmReal;
            }
            target.metrics.volume += metrics.volume || 0;
            target.metrics.setCount += metrics.setCount || 0;
            target.metrics.rpeSum += metrics.rpeSum || 0;
            target.metrics.rpeCount += metrics.rpeCount || 0;
        });
        return Array.from(grouped.values())
            .map((item) => ({
                ...item,
                metrics: {
                    ...item.metrics,
                    avgRpe: item.metrics.rpeCount ? item.metrics.rpeSum / item.metrics.rpeCount : 0,
                    setsWeek: item.metrics.setCount
                }
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    function computeWeeklySetCounts(list) {
        const grouped = new Map();
        list.forEach((entry) => {
            const key = getWeekKey(entry?.dateObj);
            if (!key) {
                return;
            }
            const current = grouped.get(key) || 0;
            grouped.set(key, current + (entry?.metrics?.setCount || 0));
        });
        return grouped;
    }

    function getMetricValue(entry, metricKey, weeklySets) {
        if (!entry) {
            return 0;
        }
        if (metricKey === 'setsWeek') {
            const key = getWeekKey(entry.dateObj);
            return weeklySets?.get(key) || 0;
        }
        if (metricKey === 'tenrmReal') {
            const tenrmReal = entry?.metrics?.tenrmReal;
            return Number.isFinite(tenrmReal) ? tenrmReal : null;
        }
        const metrics = entry?.metrics || {};
        return metrics[metricKey] || 0;
    }

    async function openSessionFromEntry(entry) {
        const date = entry?.dateObj || (entry?.date ? parseDate(entry.date) : null);
        if (!(date instanceof Date)) {
            return;
        }
        A.activeDate = date;
        if (typeof A.startOfWeek === 'function') {
            A.currentAnchor = A.startOfWeek(date);
        }
        if (typeof A.populateRoutineSelect === 'function') {
            await A.populateRoutineSelect();
        }
        if (typeof A.renderWeek === 'function') {
            await A.renderWeek();
        }
        if (typeof A.renderSession === 'function') {
            await A.renderSession();
        }
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        if (refs.tabSessions) {
            refs.tabSessions.classList.add('active');
        }
        switchScreen('screenSessions');
    }

    function computeRangeCutoff(range) {
        if (!range || !Number.isFinite(range.days)) {
            return null;
        }
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const cutoff = new Date(now.getTime() - (range.days - 1) * DAY_MS);
        return cutoff;
    }

    function computeMetrics(sets) {
        let totalReps = 0;
        let maxWeight = 0;
        let maxOrm = 0;
        let maxTenRm = 0;
        let maxTenRmReal = null;
        let totalVolume = 0;
        let setCount = 0;
        let rpeSum = 0;
        let rpeCount = 0;
        let hasData = false;
        sets.forEach((set) => {
            const reps = parseNumber(set?.reps);
            const weight = parseNumber(set?.weight);
            const rpe = parseNumber(set?.rpe);
            if (Number.isFinite(reps) || Number.isFinite(weight) || Number.isFinite(rpe)) {
                setCount += 1;
            }
            if (Number.isFinite(reps) && reps > 0) {
                totalReps += reps;
                hasData = true;
            }
            if (Number.isFinite(weight) && weight > maxWeight) {
                maxWeight = weight;
                hasData = true;
            }
            if (Number.isFinite(rpe) && rpe >= 5 && rpe <= 10) {
                rpeSum += rpe;
                rpeCount += 1;
                hasData = true;
            }
            if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps === 10) {
                maxTenRmReal = Number.isFinite(maxTenRmReal) ? Math.max(maxTenRmReal, weight) : weight;
                hasData = true;
            }
            if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) {
                totalVolume += reps * weight;
                const estimatedOrm = weight * (1 + reps / 30);
                if (estimatedOrm > maxOrm) {
                    maxOrm = estimatedOrm;
                }
                const estimatedTenRm = estimatedOrm / (1 + 10 / 30);
                if (estimatedTenRm > maxTenRm) {
                    maxTenRm = estimatedTenRm;
                }
                hasData = true;
            }
        });
        return {
            reps: totalReps,
            weight: maxWeight,
            orm: maxOrm,
            tenrm: maxTenRm,
            tenrmReal: maxTenRmReal,
            volume: totalVolume,
            setCount,
            avgRpe: rpeCount ? rpeSum / rpeCount : 0,
            rpeSum,
            rpeCount,
            hasData
        };
    }

    function parseNumber(value) {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) ? number : NaN;
    }

    function parseDate(key) {
        const iso = key.includes('T') ? key : `${key}T00:00:00`;
        const parsed = new Date(iso);
        if (Number.isNaN(parsed.getTime())) {
            return new Date();
        }
        return parsed;
    }

    function resolveSessionDate(session) {
        if (!session) {
            return null;
        }
        if (typeof session.date === 'string' && session.date.includes('T')) {
            return session.date;
        }
        if (typeof A.sessionDateKeyFromId === 'function' && typeof session.id === 'string') {
            return A.sessionDateKeyFromId(session.id);
        }
        if (typeof session.date === 'string') {
            return session.date;
        }
        return null;
    }

    function getWeekKey(dateObj) {
        if (!(dateObj instanceof Date) || typeof A.startOfWeek !== 'function' || typeof A.ymd !== 'function') {
            return null;
        }
        const start = A.startOfWeek(dateObj);
        return A.ymd(start);
    }

    function getWeekStartDate(dateObj) {
        if (!(dateObj instanceof Date) || typeof A.startOfWeek !== 'function') {
            return dateObj;
        }
        return A.startOfWeek(dateObj);
    }

    function formatMetricValue(value, metric) {
        if (!Number.isFinite(value)) {
            return '—';
        }
        const definition = METRIC_MAP[metric] || METRIC_DEFINITIONS[0];
        if (typeof definition.format === 'function') {
            return definition.format(Number.isFinite(value) ? value : 0);
        }
        return String(Number.isFinite(value) ? value : 0);
    }

    function formatKilograms(value) {
        const normalized = Number.isFinite(value) ? value : 0;
        const rounded = Math.round(normalized * 10) / 10;
        return `${rounded} kg`;
    }

    function formatVolume(value) {
        const normalized = Number.isFinite(value) ? value : 0;
        const rounded = Math.round(normalized);
        return `${formatNumberWithSpaces(rounded)} kg`;
    }

    function formatRepetitions(value) {
        const normalized = Number.isFinite(value) ? value : 0;
        const rounded = Math.round(normalized);
        return `${rounded} répétition${rounded > 1 ? 's' : ''}`;
    }

    function formatSeries(value) {
        const normalized = Number.isFinite(value) ? value : 0;
        const rounded = Math.round(normalized);
        return `${rounded} série${rounded > 1 ? 's' : ''}`;
    }

    function formatRpe(value) {
        const normalized = Number.isFinite(value) ? value : 0;
        const rounded = Math.round(normalized * 10) / 10;
        return `RPE ${rounded}`;
    }

    function formatNumberWithSpaces(value) {
        const normalized = Number.isFinite(value) ? value : 0;
        return new Intl.NumberFormat('fr-FR')
            .format(normalized)
            .replace(/\u202f/g, ' ')
            .replace(/\u00a0/g, ' ');
    }

    function formatSummaryDate(dateObj) {
        if (!(dateObj instanceof Date)) {
            return '—';
        }
        return dateObj
            .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
            .replace(/\./g, '')
            .replace(/\u00a0/g, ' ');
    }

    function buildSummaryText(definition, metricValue, dateObj) {
        const metricText = formatMetricValue(metricValue, state.activeMetric);
        const dateText = formatSummaryDate(dateObj);
        return `${definition.label} : ${metricText} - ${dateText}`;
    }

    function getLatestEntryForMetric(usage, metricKey) {
        if (!usage.length) {
            return null;
        }
        if (metricKey !== 'tenrmReal') {
            return usage[usage.length - 1];
        }
        for (let index = usage.length - 1; index >= 0; index -= 1) {
            const metrics = usage[index]?.metrics;
            if (Number.isFinite(metrics?.tenrmReal)) {
                return usage[index];
            }
        }
        return null;
    }

    function getChartMetricValue(entry, metricKey) {
        const metrics = entry?.metrics || {};
        if (metricKey === 'tenrmReal') {
            return Number.isFinite(metrics.tenrmReal) && metrics.tenrmReal > 0 ? metrics.tenrmReal : null;
        }
        const value = metrics[metricKey];
        return Number.isFinite(value) ? value : 0;
    }

    function highlightStatsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        if (refs.tabStats) {
            refs.tabStats.classList.add('active');
        }
    }

    function switchScreen(target) {
        const {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineList,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatExercises,
            screenStatExercisesDetail,
            screenSettings,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData
        } = ensureRefs();
        const map = {
            screenSessions,
            screenExercises,
            screenExerciseEdit,
            screenExerciseRead,
            screenExecEdit,
            screenRoutineList,
            screenRoutineEdit,
            screenRoutineMoveEdit,
            screenStatExercises,
            screenStatExercisesDetail,
            screenSettings,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
