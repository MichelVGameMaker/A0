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
            label: 'RPE moyen sur la séance',
            axisUnit: 'RPE',
            format: formatRpe
        },
        {
            key: 'tenrmReal',
            tagLabel: '10RM réel',
            label: '10RM réel (charge sur 10 répétitions)',
            axisUnit: 'kg',
            format: formatKilograms
        },
        {
            key: 'reps',
            tagLabel: 'Répétitions',
            label: 'Répétitions totales du jour',
            axisUnit: 'répétitions',
            format: formatRepetitions
        },
        {
            key: 'weight',
            tagLabel: 'Charge max',
            label: 'Charge maximale du jour',
            axisUnit: 'kg',
            format: formatKilograms
        },
        {
            key: 'setsWeek',
            tagLabel: 'Séries/sem.',
            label: 'Nombre de séries sur la semaine',
            axisUnit: 'séries',
            format: formatSeries
        }
    ];

    const METRIC_MAP = METRIC_DEFINITIONS.reduce((acc, item) => {
        acc[item.key] = item;
        return acc;
    }, {});

    const RANGE_OPTIONS = [
        { key: '1M', label: '1M', days: 30 },
        { key: '3M', label: '3M', days: 91 },
        { key: '6M', label: '6M', days: 182 },
        { key: '12M', label: '12M', days: 365 }
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
        switchScreen('screenStatsList');
    };

    A.openExerciseStats = async function openExerciseStats(exerciseId) {
        ensureRefs();
        highlightStatsTab();
        await loadData(true);
        const exercise = state.exercises.find((item) => item.id === exerciseId) || (await db.get('exercises', exerciseId));
        state.activeExercise = exercise || null;
        renderExerciseDetail();
        switchScreen('screenStatsDetail');
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
        refs.screenStatsList = document.getElementById('screenStatsList');
        refs.screenStatsDetail = document.getElementById('screenStatsDetail');
        refs.statsExerciseList = document.getElementById('statsExerciseList');
        refs.statsExerciseTitle = document.getElementById('statsExerciseTitle');
        refs.statsExerciseSubtitle = document.getElementById('statsExerciseSubtitle');
        refs.statsChart = document.getElementById('statsChart');
        refs.statsChartEmpty = document.getElementById('statsChartEmpty');
        refs.statsMetricTags = document.getElementById('statsMetricTags');
        refs.statsRangeTags = document.getElementById('statsRangeTags');
        refs.statsTimeline = document.getElementById('statsTimeline');
        refs.statsBack = document.getElementById('statsBack');
        refs.statsGoal = document.getElementById('statsGoal');
        refs.tabStats = document.getElementById('tabStats');
        refs.tabSessions = document.getElementById('tabSessions');
        refsResolved = true;
        return refs;
    }

    function assertStatsRefs() {
        ensureRefs();
        const required = [
            'screenStatsList',
            'statsExerciseList',
            'screenStatsDetail',
            'statsExerciseTitle',
            'statsExerciseSubtitle',
            'statsChart',
            'statsChartEmpty',
            'statsMetricTags',
            'statsRangeTags',
            'statsTimeline',
            'statsBack'
        ];
        const missing = required.filter((key) => !refs[key]);
        if (missing.length) {
            throw new Error(`ui-stats.js: références manquantes (${missing.join(', ')})`);
        }
        return refs;
    }

    function wireEvents() {
        const { statsBack, statsMetricTags, statsRangeTags } = assertStatsRefs();
        statsBack.addEventListener('click', () => {
            highlightStatsTab();
            state.activeExercise = null;
            renderExerciseList();
            switchScreen('screenStatsList');
        });
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
            const { date, exercises: executed } = session || {};
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
                const key = item?.exerciseId;
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
        const { statsExerciseTitle, statsExerciseSubtitle } = assertStatsRefs();
        const exercise = state.activeExercise;
        statsExerciseTitle.textContent = exercise?.name || 'Exercice';
        renderMetricTags();
        renderRangeTags();
        updateExerciseSummary(statsExerciseSubtitle);
        renderChart();
        renderTimeline();
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
        const last = usage[usage.length - 1];
        const weeklySets = state.activeMetric === 'setsWeek' ? computeWeeklySetCounts(usage) : null;
        const definition = METRIC_MAP[state.activeMetric] || METRIC_DEFINITIONS[0];
        const metricValue = getMetricValue(last, state.activeMetric, weeklySets);
        const metricText = formatMetricValue(metricValue, state.activeMetric);
        const count = usage.length;
        const sessionLabel = count > 1 ? 'séances' : 'séance';
        const lastLabel = last?.dateObj ? A.fmtUI(last.dateObj) : '—';
        element.textContent = `${count} ${sessionLabel} • Dernière : ${lastLabel} • ${definition.label} : ${metricText}`;
    }

    function getCssVariable(name, fallback) {
        if (!name) {
            return fallback;
        }
        const root = document.documentElement;
        if (!root || typeof window.getComputedStyle !== 'function') {
            return fallback;
        }
        const value = window.getComputedStyle(root).getPropertyValue(name);
        return value ? value.trim() : fallback;
    }

    function renderChart() {
        const { statsChart, statsChartEmpty } = assertStatsRefs();
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
        const data = aggregated.map((entry) => ({
            date: entry.date,
            value: entry.metrics[state.activeMetric] || 0
        }));
        const maxValue = Math.max(...data.map((item) => item.value), 0);
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

        const axisX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        axisX.setAttribute('x1', String(padding.left));
        axisX.setAttribute('y1', String(yAxisPosition));
        axisX.setAttribute('x2', String(width - padding.right));
        axisX.setAttribute('y2', String(yAxisPosition));
        axisX.setAttribute('stroke', getCssVariable('--darkGrayB', '#ccc'));
        axisX.setAttribute('stroke-width', '2');
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
        path.setAttribute('stroke', A.EMPHASIS || '#0f62fe');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);

        points.forEach((point) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x.toFixed(2));
            circle.setAttribute('cy', point.y.toFixed(2));
            circle.setAttribute('r', '5');
            circle.setAttribute('fill', '#ffffff');
            circle.setAttribute('stroke', A.EMPHASIS || '#0f62fe');
            circle.setAttribute('stroke-width', '2');
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

        item.append(date, value);
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
                        tenrmReal: 0,
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
            target.metrics.tenrmReal = Math.max(target.metrics.tenrmReal, metrics.tenrmReal || 0);
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
                        tenrmReal: 0,
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
            target.metrics.tenrmReal = Math.max(target.metrics.tenrmReal, metrics.tenrmReal || 0);
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
        let maxTenRmReal = 0;
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
                maxTenRmReal = Math.max(maxTenRmReal, weight);
                hasData = true;
            }
            if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) {
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
        const iso = `${key}T00:00:00`;
        const parsed = new Date(iso);
        if (Number.isNaN(parsed.getTime())) {
            return new Date();
        }
        return parsed;
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
            screenStatsList,
            screenStatsDetail
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
            screenStatsList,
            screenStatsDetail
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
