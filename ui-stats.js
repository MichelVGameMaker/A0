// ui-stats.js — écrans de statistiques des exercices
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const state = {
        activeMetric: 'reps',
        exercises: [],
        usageByExercise: new Map(),
        activeExercise: null
    };

    const METRIC_LABELS = {
        reps: 'Répétitions totales',
        weight: 'Poids maximum',
        orm: '1RM estimé'
    };

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
        refs.statsMetricSelector = document.getElementById('statsMetricSelector');
        refs.statsTimeline = document.getElementById('statsTimeline');
        refs.statsBack = document.getElementById('statsBack');
        refs.tabStats = document.getElementById('tabStats');
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
            'statsMetricSelector',
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
        const { statsBack, statsMetricSelector } = assertStatsRefs();
        statsBack.addEventListener('click', () => {
            highlightStatsTab();
            state.activeExercise = null;
            renderExerciseList();
            switchScreen('screenStatsList');
        });
        statsMetricSelector.addEventListener('change', () => {
            state.activeMetric = statsMetricSelector.value;
            renderExerciseDetail();
        });
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
        const card = document.createElement('article');
        card.className = 'exercise-card clickable';
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${exercise?.name || 'Exercice'} — voir les statistiques`);

        const row = document.createElement('div');
        row.className = 'exercise-card-row';

        const left = document.createElement('div');
        left.className = 'exercise-card-left';
        left.appendChild(renderGrip());

        const textWrapper = document.createElement('div');
        textWrapper.className = 'exercise-card-text';

        const title = document.createElement('div');
        title.className = 'element';
        title.textContent = exercise?.name || 'Exercice';

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = buildExerciseDetails(exercise);

        textWrapper.append(title, details);
        left.appendChild(textWrapper);

        const right = document.createElement('div');
        right.className = 'exercise-card-right';
        const chevron = document.createElement('span');
        chevron.className = 'session-card-pencil';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '▶︎';
        right.appendChild(chevron);

        row.append(left, right);
        card.appendChild(row);

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
        const { statsExerciseTitle, statsExerciseSubtitle, statsMetricSelector } = assertStatsRefs();
        const exercise = state.activeExercise;
        statsExerciseTitle.textContent = exercise?.name || 'Exercice';
        statsMetricSelector.value = state.activeMetric;
        updateExerciseSummary(statsExerciseSubtitle);
        renderChart();
        renderTimeline();
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
        const metricValue = last?.metrics ? last.metrics[state.activeMetric] || 0 : 0;
        const metricText = formatMetricValue(metricValue, state.activeMetric);
        const count = usage.length;
        const sessionLabel = count > 1 ? 'séances' : 'séance';
        const lastLabel = last?.dateObj ? A.fmtUI(last.dateObj) : '—';
        element.textContent = `${count} ${sessionLabel} • Dernière : ${lastLabel} • ${metricText}`;
    }

    function renderChart() {
        const { statsChart, statsChartEmpty } = assertStatsRefs();
        statsChart.innerHTML = '';
        statsChart.removeAttribute('aria-label');
        const exercise = state.activeExercise;
        if (!exercise) {
            statsChartEmpty.hidden = false;
            return;
        }
        const usage = state.usageByExercise.get(exercise.id) || [];
        if (!usage.length) {
            statsChartEmpty.hidden = false;
            return;
        }
        statsChartEmpty.hidden = true;
        const data = usage.map((entry) => ({
            date: entry.dateObj,
            value: entry.metrics[state.activeMetric] || 0
        }));
        const maxValue = Math.max(...data.map((item) => item.value), 0);
        const width = 320;
        const height = 200;
        const padding = 16;
        const points = data.map((item, index) => {
            const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * (width - padding * 2) + padding;
            const ratio = maxValue > 0 ? item.value / maxValue : 0;
            const y = height - padding - ratio * (height - padding * 2);
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

        const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        axis.setAttribute('x1', String(padding));
        axis.setAttribute('y1', String(height - padding));
        axis.setAttribute('x2', String(width - padding));
        axis.setAttribute('y2', String(height - padding));
        axis.setAttribute('stroke', '#d4d4d4');
        axis.setAttribute('stroke-width', '2');
        svg.appendChild(axis);

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
            `Évolution — ${METRIC_LABELS[state.activeMetric] || 'Statistique'} sur ${data.length} point${data.length > 1 ? 's' : ''}`
        );
        statsChart.appendChild(svg);
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
        const ordered = [...usage].sort((a, b) => b.date.localeCompare(a.date));
        ordered.forEach((entry) => {
            statsTimeline.appendChild(renderTimelineItem(entry));
        });
    }

    function buildTimelineEmpty() {
        const empty = document.createElement('li');
        empty.className = 'stats-timeline-empty';
        empty.textContent = 'Aucune séance enregistrée.';
        return empty;
    }

    function renderTimelineItem(entry) {
        const item = document.createElement('li');
        item.className = 'stats-timeline-item';

        const date = document.createElement('span');
        date.className = 'stats-timeline-date';
        date.textContent = entry?.dateObj ? A.fmtUI(entry.dateObj) : '—';

        const value = document.createElement('span');
        value.className = 'stats-timeline-value';
        const metricValue = entry?.metrics ? entry.metrics[state.activeMetric] || 0 : 0;
        value.textContent = formatMetricValue(metricValue, state.activeMetric);

        item.append(date, value);
        return item;
    }

    function renderGrip() {
        const wrapper = document.createElement('div');
        wrapper.className = 'session-card-handle';
        wrapper.setAttribute('aria-hidden', 'true');
        const grip = document.createElement('span');
        grip.className = 'session-card-grip';
        for (let index = 0; index < 3; index += 1) {
            const dot = document.createElement('span');
            dot.className = 'session-card-grip-dot';
            grip.appendChild(dot);
        }
        wrapper.appendChild(grip);
        return wrapper;
    }

    function computeMetrics(sets) {
        let totalReps = 0;
        let maxWeight = 0;
        let maxOrm = 0;
        let hasData = false;
        sets.forEach((set) => {
            const reps = parseNumber(set?.reps);
            const weight = parseNumber(set?.weight);
            if (Number.isFinite(reps) && reps > 0) {
                totalReps += reps;
                hasData = true;
            }
            if (Number.isFinite(weight) && weight > maxWeight) {
                maxWeight = weight;
                hasData = true;
            }
            if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) {
                const estimated = weight * (1 + reps / 30);
                if (estimated > maxOrm) {
                    maxOrm = estimated;
                }
                hasData = true;
            }
        });
        return {
            reps: totalReps,
            weight: maxWeight,
            orm: maxOrm,
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

    function formatMetricValue(value, metric) {
        const rounded = metric === 'reps' ? Math.round(value) : Math.round(value * 10) / 10;
        if (metric === 'reps') {
            return `${rounded} répétition${rounded > 1 ? 's' : ''}`;
        }
        return `${rounded} kg`;
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
