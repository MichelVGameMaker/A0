// ui-settings.js — navigation pour l'écran Réglages
(() => {
    const A = window.App;

    /* STATE */
    const refs = {};
    let refsResolved = false;
    const shareDialogState = {
        dates: [],
        selected: new Set(),
        years: [],
        yearFilter: null
    };

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireButtons();
    });

    /* ACTIONS */
    A.openSettings = async function openSettings() {
        ensureRefs();
        highlightSettingsTab();
        switchScreen('screenSettings');
    };

    A.openPreferences = function openPreferences() {
        ensureRefs();
        highlightSettingsTab();
        switchScreen('screenPreferences');
    };

    A.openData = function openData() {
        ensureRefs();
        highlightSettingsTab();
        switchScreen('screenData');
    };

    A.openApplication = function openApplication() {
        ensureRefs();
        highlightSettingsTab();
        switchScreen('screenApplication');
    };

    A.openVolume = function openVolume() {
        ensureRefs();
        highlightStatsTab();
        A.setStatsSection?.('volume');
        A.renderVolumeScreen?.();
        switchScreen('screenStatMuscles');
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
        refs.screenAdmin = document.getElementById('screenAdmin');
        refs.screenStatMuscles = document.getElementById('screenStatMuscles');
        refs.screenStatMusclesDetail = document.getElementById('screenStatMusclesDetail');
        refs.screenPreferences = document.getElementById('screenPreferences');
        refs.screenData = document.getElementById('screenData');
        refs.screenApplication = document.getElementById('screenApplication');
        refs.screenPlanning = document.getElementById('screenPlanning');
        refs.screenFitHeroMapping = document.getElementById('screenFitHeroMapping');
        refs.tabPlanning = document.getElementById('tabPlanning');
        refs.btnSettingsExercises = document.getElementById('btnSettingsExercises');
        refs.btnSettingsRoutines = document.getElementById('btnSettingsRoutines');
        refs.btnSettingsPreferences = document.getElementById('btnSettingsPreferences');
        refs.btnSettingsData = document.getElementById('btnSettingsData');
        refs.btnSettingsShare = document.getElementById('btnSettingsShare');
        refs.btnSettingsApplication = document.getElementById('btnSettingsApplication');
        refs.btnSettingsUpdate = document.getElementById('btnSettingsUpdate');
        refs.btnSettingsReset = document.getElementById('btnSettingsReset');
        refs.btnPreferencesBack = document.getElementById('btnPreferencesBack');
        refs.btnDataBack = document.getElementById('btnDataBack');
        refs.btnApplicationBack = document.getElementById('btnApplicationBack');
        refs.btnDataReloadExercises = document.getElementById('btnDataReloadExercises');
        refs.btnDataImportFitHero = document.getElementById('btnDataImportFitHero');
        refs.btnDataExportSessions = document.getElementById('btnDataExportSessions');
        refs.btnDataImportSessions = document.getElementById('btnDataImportSessions');
        refs.btnDataFitHeroMapping = document.getElementById('btnDataFitHeroMapping');
        refs.inputDataImportFitHero = document.getElementById('inputDataImportFitHero');
        refs.inputDataImportSessions = document.getElementById('inputDataImportSessions');
        refs.dlgShareSessions = document.getElementById('dlgShareSessions');
        refs.shareSessionsYearFilters = document.getElementById('shareSessionsYearFilters');
        refs.shareSessionsList = document.getElementById('shareSessionsList');
        refs.shareSessionsEmpty = document.getElementById('shareSessionsEmpty');
        refs.shareSessionsClose = document.getElementById('shareSessionsClose');
        refs.shareSessionsCancel = document.getElementById('shareSessionsCancel');
        refs.shareSessionsConfirm = document.getElementById('shareSessionsConfirm');
        refsResolved = true;
        return refs;
    }

    function wireButtons() {
        const {
            btnSettingsExercises,
            btnSettingsRoutines,
            btnSettingsPreferences,
            btnSettingsData,
            btnSettingsShare,
            btnSettingsApplication,
            btnSettingsUpdate,
            btnSettingsReset,
            btnPreferencesBack,
            btnDataBack,
            btnApplicationBack,
            btnDataReloadExercises,
            btnDataImportFitHero,
            btnDataExportSessions,
            btnDataImportSessions,
            btnDataFitHeroMapping,
            inputDataImportFitHero,
            inputDataImportSessions,
            shareSessionsClose,
            shareSessionsCancel,
            shareSessionsConfirm
        } = ensureRefs();

        btnSettingsExercises?.addEventListener('click', () => {
            highlightSettingsTab();
            void A.openExercises({ callerScreen: 'screenSettings' });
        });
        btnSettingsRoutines?.addEventListener('click', () => {
            highlightSettingsTab();
            void A.openRoutineList();
        });
        btnSettingsPreferences?.addEventListener('click', () => {
            A.openPreferences();
        });
        btnSettingsData?.addEventListener('click', () => {
            A.openData();
        });
        btnSettingsShare?.addEventListener('click', () => {
            void openShareSessionsDialog();
        });
        btnSettingsApplication?.addEventListener('click', () => {
            A.openApplication();
        });
        btnSettingsUpdate?.addEventListener('click', () => {
            void handleUpdateRefresh();
        });
        btnSettingsReset?.addEventListener('click', () => {
            void handleReset();
        });
        btnPreferencesBack?.addEventListener('click', () => {
            A.openSettings();
        });
        btnDataBack?.addEventListener('click', () => {
            A.openSettings();
        });
        btnApplicationBack?.addEventListener('click', () => {
            A.openSettings();
        });
        btnDataReloadExercises?.addEventListener('click', () => {
            void reloadExerciseLibrary(btnDataReloadExercises);
        });
        btnDataImportFitHero?.addEventListener('click', () => {
            inputDataImportFitHero?.click();
        });
        btnDataExportSessions?.addEventListener('click', () => {
            void exportSessions(btnDataExportSessions);
        });
        btnDataImportSessions?.addEventListener('click', () => {
            inputDataImportSessions?.click();
        });
        btnDataFitHeroMapping?.addEventListener('click', () => {
            A.openFitHeroMapping?.();
        });
        inputDataImportFitHero?.addEventListener('change', () => {
            void importFitHeroSessions({
                input: inputDataImportFitHero,
                button: btnDataImportFitHero
            });
        });
        inputDataImportSessions?.addEventListener('change', () => {
            void importAppSessions({
                input: inputDataImportSessions,
                button: btnDataImportSessions
            });
        });
        shareSessionsClose?.addEventListener('click', () => {
            closeShareSessionsDialog();
        });
        shareSessionsCancel?.addEventListener('click', () => {
            closeShareSessionsDialog();
        });
        shareSessionsConfirm?.addEventListener('click', () => {
            void confirmShareSessions();
        });
    }

    function highlightSettingsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        if (refs.tabPlanning) {
            refs.tabPlanning.classList.add('active');
        }
    }

    function highlightStatsTab() {
        document.querySelectorAll('.tabbar .tab').forEach((button) => button.classList.remove('active'));
        document.getElementById('tabStats')?.classList.add('active');
    }

    async function openShareSessionsDialog() {
        const { dlgShareSessions } = ensureRefs();
        if (!dlgShareSessions) {
            return;
        }
        if (dlgShareSessions.open) {
            return;
        }

        const dates = await getShareSessionDates();
        shareDialogState.dates = dates;
        shareDialogState.years = getShareSessionYears(dates);
        if (!shareDialogState.yearFilter || !shareDialogState.years.includes(shareDialogState.yearFilter)) {
            shareDialogState.yearFilter = null;
        }
        shareDialogState.selected = new Set();
        const todayKey = A.ymd(A.today());
        if (dates.includes(todayKey)) {
            shareDialogState.selected.add(todayKey);
        }
        renderShareSessionYearFilters();
        await renderShareSessionList();
        dlgShareSessions.showModal();
    }

    function closeShareSessionsDialog() {
        const { dlgShareSessions } = ensureRefs();
        if (dlgShareSessions?.open) {
            dlgShareSessions.close('cancel');
        }
    }

    async function confirmShareSessions() {
        const { shareSessionsConfirm } = ensureRefs();
        const selectedDates = Array.from(shareDialogState.selected);
        if (!selectedDates.length) {
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Partager',
                    message: 'Sélectionnez au moins une séance.',
                    variant: 'info'
                });
            } else {
                alert('Sélectionnez au moins une séance.');
            }
            return;
        }

        if (shareSessionsConfirm) {
            shareSessionsConfirm.disabled = true;
        }
        try {
            const text = await buildShareSessionsText(selectedDates);
            await shareSessionText(text);
            closeShareSessionsDialog();
        } catch (error) {
            if (error?.name === 'AbortError') {
                return;
            }
            console.warn('Partage des séances échoué :', error);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Partager',
                    message: 'Le partage des séances a échoué.',
                    variant: 'error'
                });
            } else {
                alert('Le partage des séances a échoué.');
            }
        } finally {
            if (shareSessionsConfirm) {
                shareSessionsConfirm.disabled = false;
            }
        }
    }

    async function getShareSessionDates() {
        if (typeof db?.listSessionDatesWithActivity === 'function') {
            const entries = await db.listSessionDatesWithActivity();
            return entries.map((entry) => entry.date).filter(Boolean).sort().reverse();
        }
        if (typeof db?.listSessionDates === 'function') {
            const entries = await db.listSessionDates();
            return entries.map((entry) => entry.date).filter(Boolean).sort().reverse();
        }
        if (typeof db?.getAll !== 'function') {
            return [];
        }
        const sessions = await db.getAll('sessions');
        return (Array.isArray(sessions) ? sessions : [])
            .map((session) => A.sessionDateKeyFromId?.(session?.id) || session?.date?.slice(0, 10))
            .filter(Boolean)
            .sort()
            .reverse();
    }

    async function renderShareSessionList() {
        const { shareSessionsList, shareSessionsEmpty, shareSessionsConfirm } = ensureRefs();
        if (!shareSessionsList) {
            return;
        }
        shareSessionsList.innerHTML = '';
        const filteredDates = filterShareSessionDates();
        if (!filteredDates.length) {
            shareSessionsEmpty?.removeAttribute('hidden');
            if (shareSessionsConfirm) {
                shareSessionsConfirm.disabled = true;
            }
            return;
        }
        shareSessionsEmpty?.setAttribute('hidden', '');
        if (shareSessionsConfirm) {
            shareSessionsConfirm.disabled = false;
        }
        const labels = await Promise.all(
            filteredDates.map(async (dateKey) => {
                if (!db?.getSession) {
                    const fallbackDate = parseShareSessionDate(dateKey);
                    return {
                        dateKey,
                        label: formatShareDateLabel(dateKey),
                        monthKey: getShareSessionMonthKey(fallbackDate, dateKey),
                        monthLabel: formatShareMonthLabel(fallbackDate, dateKey)
                    };
                }
                try {
                    const session = await db.getSession(dateKey);
                    const sessionDate = parseShareSessionDate(dateKey, session);
                    return {
                        dateKey,
                        label: formatShareDateLabelFromSession(dateKey, session),
                        monthKey: getShareSessionMonthKey(sessionDate, dateKey),
                        monthLabel: formatShareMonthLabel(sessionDate, dateKey)
                    };
                } catch (error) {
                    console.warn('Chargement de séance pour partage échoué :', error);
                    const fallbackDate = parseShareSessionDate(dateKey);
                    return {
                        dateKey,
                        label: formatShareDateLabel(dateKey),
                        monthKey: getShareSessionMonthKey(fallbackDate, dateKey),
                        monthLabel: formatShareMonthLabel(fallbackDate, dateKey)
                    };
                }
            })
        );
        const monthOrder = [];
        const monthGroups = new Map();
        labels.forEach(({ dateKey, label: labelText, monthKey, monthLabel }) => {
            const key = monthKey || 'unknown';
            if (!monthGroups.has(key)) {
                monthGroups.set(key, { label: monthLabel || 'Mois inconnu', items: [] });
                monthOrder.push(key);
            }
            monthGroups.get(key).items.push({ dateKey, labelText });
        });

        const updateMonthCheckboxState = (monthCheckbox, dayCheckboxes) => {
            const total = dayCheckboxes.length;
            const checkedCount = dayCheckboxes.filter((checkbox) => checkbox.checked).length;
            monthCheckbox.checked = total > 0 && checkedCount === total;
            monthCheckbox.indeterminate = checkedCount > 0 && checkedCount < total;
        };

        monthOrder.forEach((monthKey) => {
            const group = monthGroups.get(monthKey);
            if (!group) {
                return;
            }
            const monthContainer = document.createElement('div');
            monthContainer.className = 'share-session-month';

            const monthHeader = document.createElement('label');
            monthHeader.className = 'share-session-month-header';

            const monthCheckbox = document.createElement('input');
            monthCheckbox.type = 'checkbox';
            monthCheckbox.className = 'app-check';

            const monthText = document.createElement('span');
            monthText.textContent = group.label;

            monthHeader.appendChild(monthCheckbox);
            monthHeader.appendChild(monthText);
            monthContainer.appendChild(monthHeader);

            const dayCheckboxes = [];
            group.items.forEach(({ dateKey, labelText }) => {
                const label = document.createElement('label');
                label.className = 'share-session-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'app-check';
                checkbox.value = dateKey;
                checkbox.checked = shareDialogState.selected.has(dateKey);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        shareDialogState.selected.add(dateKey);
                    } else {
                        shareDialogState.selected.delete(dateKey);
                    }
                    updateMonthCheckboxState(monthCheckbox, dayCheckboxes);
                });

                const text = document.createElement('span');
                text.textContent = labelText;

                label.appendChild(checkbox);
                label.appendChild(text);
                monthContainer.appendChild(label);
                dayCheckboxes.push(checkbox);
            });

            updateMonthCheckboxState(monthCheckbox, dayCheckboxes);
            monthCheckbox.addEventListener('change', () => {
                const nextChecked = monthCheckbox.checked;
                monthCheckbox.indeterminate = false;
                dayCheckboxes.forEach((checkbox) => {
                    checkbox.checked = nextChecked;
                    if (nextChecked) {
                        shareDialogState.selected.add(checkbox.value);
                    } else {
                        shareDialogState.selected.delete(checkbox.value);
                    }
                });
            });

            shareSessionsList.appendChild(monthContainer);
        });
    }

    function getShareSessionYears(dates) {
        const yearSet = new Set();
        (dates || []).forEach((dateKey) => {
            if (typeof dateKey === 'string' && dateKey.length >= 4) {
                yearSet.add(dateKey.slice(0, 4));
            }
        });
        return Array.from(yearSet).sort().reverse();
    }

    function filterShareSessionDates() {
        if (!shareDialogState.yearFilter) {
            return shareDialogState.dates;
        }
        return shareDialogState.dates.filter((dateKey) => dateKey?.startsWith(shareDialogState.yearFilter));
    }

    function renderShareSessionYearFilters() {
        const { shareSessionsYearFilters } = ensureRefs();
        if (!shareSessionsYearFilters) {
            return;
        }
        shareSessionsYearFilters.innerHTML = '';
        const years = shareDialogState.years;
        if (!years.length) {
            shareSessionsYearFilters.setAttribute('hidden', '');
            return;
        }
        shareSessionsYearFilters.removeAttribute('hidden');
        shareSessionsYearFilters.style.setProperty('--tag-columns', String(years.length + 1));
        const allButton = document.createElement('button');
        allButton.type = 'button';
        allButton.className = `tag${shareDialogState.yearFilter ? '' : ' is-active'}`;
        allButton.textContent = 'Toutes';
        allButton.addEventListener('click', () => {
            shareDialogState.yearFilter = null;
            renderShareSessionYearFilters();
            renderShareSessionList();
        });
        shareSessionsYearFilters.appendChild(allButton);
        years.forEach((year) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `tag${shareDialogState.yearFilter === year ? ' is-active' : ''}`;
            button.textContent = year;
            button.addEventListener('click', () => {
                shareDialogState.yearFilter = year;
                renderShareSessionYearFilters();
                renderShareSessionList();
            });
            shareSessionsYearFilters.appendChild(button);
        });
    }

    function formatShareDateLabel(dateKey, options = {}) {
        if (!dateKey || typeof dateKey !== 'string') {
            return '';
        }
        const date = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return dateKey;
        }
        return formatShareDateLabelFromDate(date, options);
    }

    function parseShareSessionDate(dateKey, session) {
        if (session?.date) {
            const parsed = new Date(session.date);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        if (!dateKey || typeof dateKey !== 'string') {
            return null;
        }
        const parsed = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed;
    }

    function getShareSessionMonthKey(date, dateKey) {
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        if (typeof dateKey === 'string' && dateKey.length >= 7) {
            return dateKey.slice(0, 7);
        }
        return null;
    }

    function formatShareMonthLabel(date, dateKey) {
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
            return date.toLocaleDateString('fr-FR', {
                month: 'long',
                year: 'numeric'
            });
        }
        return typeof dateKey === 'string' ? dateKey.slice(0, 7) : '';
    }

    function formatShareDateLabelFromDate(date, options = {}) {
        if (!(date instanceof Date)) {
            return '';
        }
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const label = date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        return options.uppercase ? label.toUpperCase() : label;
    }

    function formatShareDateLabelFromSession(dateKey, session, options = {}) {
        if (session?.date) {
            const parsed = new Date(session.date);
            if (!Number.isNaN(parsed.getTime())) {
                return formatShareDateLabelFromDate(parsed, options);
            }
        }
        return formatShareDateLabel(dateKey, options);
    }

    function formatShareNumber(value, options = {}) {
        if (value == null || value === '') {
            return '';
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return String(value).trim();
        }
        return numeric.toLocaleString('fr-FR', {
            maximumFractionDigits: options.maximumFractionDigits ?? 2
        });
    }

    function formatShareInteger(value) {
        if (value == null || value === '') {
            return '';
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return String(value).trim();
        }
        return String(Math.round(numeric));
    }

    function formatShareSetLine(set, index, exercise) {
        const weightValue = formatShareNumber(set?.weight, { maximumFractionDigits: 2 });
        const repsValue = formatShareInteger(set?.reps);
        const rpeValue = formatShareNumber(set?.rpe, { maximumFractionDigits: 1 });
        const unit = exercise?.weight_unit === 'imperial' ? 'lb' : 'kg';
        let label = '';
        if (weightValue && repsValue) {
            label = `${weightValue} ${unit} x ${repsValue} reps`;
        } else if (weightValue) {
            label = `${weightValue} ${unit}`;
        } else if (repsValue) {
            label = `${repsValue} reps`;
        } else if (rpeValue) {
            label = 'Série';
        }
        if (!label) {
            return null;
        }
        if (rpeValue) {
            label = `${label} @ rpe ${rpeValue}`;
        }
        return `${index}. ${label}`;
    }

    async function buildShareSessionsText(dateKeys) {
        const lines = ['Séance/s de musculation:', ''];
        for (const dateKey of dateKeys) {
            const session = await db.getSession(dateKey);
            lines.push(`> SÉANCE DU ${formatShareDateLabelFromSession(dateKey, session, { uppercase: true })}`);
            lines.push('');
            const exercises = Array.isArray(session?.exercises) ? [...session.exercises] : [];
            exercises.sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0));
            if (!exercises.length) {
                lines.push('Aucun exercice.');
                lines.push('');
                lines.push('');
                continue;
            }
            for (const exercise of exercises) {
                const name = exercise?.exercise_name || exercise?.name || exercise?.exercise_id || 'Exercice';
                lines.push(name);
                const sets = Array.isArray(exercise?.sets) ? [...exercise.sets] : [];
                sets.sort((a, b) => (a?.pos ?? 0) - (b?.pos ?? 0));
                const setLines = sets
                    .map((set, idx) => formatShareSetLine(set, idx + 1, exercise))
                    .filter(Boolean);
                if (setLines.length) {
                    lines.push(...setLines);
                } else {
                    lines.push('Aucune série.');
                }
                lines.push('');
            }
            lines.push('');
        }
        while (lines.length && lines[lines.length - 1] === '') {
            lines.pop();
        }
        return lines.join('\n');
    }

    async function shareSessionText(text) {
        if (!text) {
            return;
        }
        if (navigator.share) {
            await navigator.share({ text, title: 'Séances de musculation' });
            return;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Partager',
                    message: 'Texte copié dans le presse-papiers.',
                    variant: 'info'
                });
            } else {
                alert('Texte copié dans le presse-papiers.');
            }
            return;
        }
        window.prompt('Copiez ce texte pour le partager :', text);
    }

    async function handleUpdateRefresh() {
        const { btnSettingsUpdate } = ensureRefs();
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Update',
                message: 'Recharger l’application sans effacer vos données ?',
                variant: 'danger'
            })
            : window.confirm('Recharger l’application sans effacer vos données ?');
        if (!confirmed) {
            return;
        }

        if (btnSettingsUpdate) {
            btnSettingsUpdate.disabled = true;
        }

        try {
            await clearAppCache();
        } catch (error) {
            console.warn('Update échoué :', error);
        } finally {
            window.location.reload();
        }
    }

    async function handleReset() {
        const { btnSettingsReset } = ensureRefs();
        const confirmed = A.components?.confirmDialog?.confirm
            ? await A.components.confirmDialog.confirm({
                title: 'Reset',
                message: 'Cette action supprime toutes les données locales et le cache !',
                variant: 'danger'
            })
            : window.confirm('Cette action supprime toutes les données locales et le cache !');
        if (!confirmed) {
            return;
        }

        if (btnSettingsReset) {
            btnSettingsReset.disabled = true;
        }

        try {
            await resetAppStorage();
        } catch (error) {
            console.warn('Reset échoué :', error);
        } finally {
            window.location.reload();
        }
    }

    async function resetAppStorage() {
        localStorage.clear();
        sessionStorage.clear();

        if (typeof db !== 'undefined' && typeof db.reset === 'function') {
            await db.reset();
        }

        await clearAppCache();
    }

    async function clearAppCache() {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        }

        if (navigator.serviceWorker?.getRegistrations) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        }
    }

    async function reloadExerciseLibrary(button) {
        if (!db?.importExternalExercisesIfNeeded) {
            alert('Le chargement des exercices est indisponible.');
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            await db.importExternalExercisesIfNeeded({ force: true });
            alert('Bibliothèque d’exercices rechargée.');
        } catch (error) {
            console.warn('Recharge des exercices échouée :', error);
            alert('Le chargement des exercices a échoué.');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function exportSessions(button) {
        if (!db?.getAll) {
            alert('La sauvegarde des séances est indisponible.');
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const sessions = await db.getAll('sessions');
            const payload = {
                format: 'a0-sessions',
                exportedAt: new Date().toISOString(),
                sessions: Array.isArray(sessions) ? sessions : []
            };
            downloadJson('a0_seances.json', payload);
            alert('Sauvegarde des séances générée.');
        } catch (error) {
            console.warn('Sauvegarde des séances échouée :', error);
            alert('La sauvegarde des séances a échoué.');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function importAppSessions({ input, button } = {}) {
        const file = input?.files?.[0];
        if (!file) {
            return;
        }

        if (input) {
            input.value = '';
        }

        if (!db?.getAll || !db?.del || !db?.saveSession) {
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import',
                    message: 'Le chargement des séances est indisponible.',
                    variant: 'error'
                });
            } else {
                alert('Le chargement des séances est indisponible.');
            }
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const payload = await readJsonFile(file);
            const sessions = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.sessions)
                    ? payload.sessions
                    : null;
            if (!sessions) {
                throw new Error('Format invalide : sessions manquant.');
            }

            const invalidIndex = sessions.findIndex((session) => !isSessionPayloadValid(session));
            if (invalidIndex !== -1) {
                throw new Error(`Format invalide : séance ${invalidIndex + 1} incorrecte.`);
            }

            const confirmMessage = `Charger ${sessions.length} séance${sessions.length > 1 ? 's' : ''} et remplacer toutes les données actuelles ?`;
            const confirmed = A.components?.confirmDialog?.confirm
                ? await A.components.confirmDialog.confirm({
                    title: 'Import des séances',
                    message: confirmMessage,
                    variant: 'danger'
                })
                : window.confirm(confirmMessage);
            if (!confirmed) {
                return;
            }

            await clearAllSessions();

            for (const session of sessions) {
                await db.saveSession(session);
            }

            const label = sessions.length > 1 ? 'séances' : 'séance';
            const successMessage = `${sessions.length} ${label} chargée${sessions.length > 1 ? 's' : ''}.`;
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import terminé',
                    message: successMessage,
                    variant: 'info'
                });
            } else {
                alert(successMessage);
            }

            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('Import séances échoué :', error);
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import',
                    message: 'Le chargement des séances a échoué.',
                    variant: 'error'
                });
            } else {
                alert('Le chargement des séances a échoué.');
            }
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function isSessionPayloadValid(session) {
        if (!session || typeof session !== 'object') {
            return false;
        }
        const id = typeof session.id === 'string' ? session.id.trim() : '';
        const date = typeof session.date === 'string' ? session.date.trim() : '';
        return Boolean(id || date);
    }

    function downloadJson(filename, data) {
        const payload = JSON.stringify(data, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    const FIT_HERO_MISSING_STORAGE_KEY = A.fitHeroMissingStorageKey || 'fithero_missing_exercises';
    const FIT_HERO_USER_MAPPING_KEY = A.fitHeroUserMappingKey || 'fithero_user_mapping';
    A.fitHeroMissingStorageKey = FIT_HERO_MISSING_STORAGE_KEY;
    A.fitHeroUserMappingKey = FIT_HERO_USER_MAPPING_KEY;

    async function importFitHeroSessions({ input, button } = {}) {
        const file = input?.files?.[0];
        if (!file) {
            return;
        }

        if (input) {
            input.value = '';
        }

        if (!db?.getAll || !db?.del || !db?.saveSession) {
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import FitHero',
                    message: 'Le chargement des séances est indisponible.',
                    variant: 'error'
                });
            } else {
                alert('Le chargement des séances est indisponible.');
            }
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const [payload, mapping, exercises, catalog] = await Promise.all([
                readJsonFile(file),
                loadFitHeroMapping(),
                db.getAll('exercises'),
                loadExercisesCatalog()
            ]);
            const workouts = payload?.workouts;
            if (!Array.isArray(workouts)) {
                throw new Error('Format FitHero invalide : workouts manquant.');
            }

            const mappingBySlug = buildFitHeroMapping(mapping);
            const exerciseList = Array.isArray(exercises) ? exercises : [];
            const exerciseById = new Map(exerciseList.map((exercise) => [exercise.id, exercise]));
            const fitHeroExercisesById = buildFitHeroExerciseDefinitionIndex(payload?.exercises);
            const exerciseByExternalKey = buildExerciseByExternalKey(exercises);
            const nativeExercisesByName = buildExerciseNameIndex(exerciseList, ['native', 'modified']);
            const userExercisesByName = buildExerciseNameIndex(exerciseList, ['user']);
            const catalogById = buildExerciseCatalogIndex(catalog);
            const missingEntries = [];
            const mappingStats = {
                mapping: 0,
                native: 0,
                user: 0,
                created: 0,
                unique: new Set(),
                uniqueBySource: {
                    mapping: new Set(),
                    native: new Set(),
                    user: new Set(),
                    created: new Set()
                }
            };

            await clearAllSessions();

            let imported = 0;
            for (const workout of workouts) {
                const session = await toFitHeroSession(workout, {
                    mappingBySlug,
                    exerciseById,
                    fitHeroExercisesById,
                    exerciseByExternalKey,
                    catalogById,
                    missingEntries,
                    mappingStats,
                    nativeExercisesByName,
                    userExercisesByName
                });
                if (!session) {
                    continue;
                }
                await db.saveSession(session);
                imported += 1;
            }

            updateMissingFitHeroExercises(missingEntries);

            const label = imported > 1 ? 'séances' : 'séance';
            const uniqueExercises = mappingStats.unique?.size ?? 0;
            const exerciseLabel = uniqueExercises > 1 ? 'exercices' : 'exercice';
            const summaryMessage = `${imported} ${label} et ${uniqueExercises} ${exerciseLabel} :\n`
                + `- ${mappingStats.native} trouvé/s dans la liste native\n`
                + `- ${mappingStats.mapping} trouvé/s dans le mapping\n`
                + `- ${mappingStats.user} trouvé/s dans les créations\n`
                + `- ${mappingStats.created} non trouvés`;
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import FitHero terminé',
                    message: summaryMessage,
                    variant: 'info'
                });
            } else {
                alert(summaryMessage);
            }

            if (typeof A.renderWeek === 'function') {
                await A.renderWeek();
            }
            if (typeof A.renderSession === 'function') {
                await A.renderSession();
            }
        } catch (error) {
            console.warn('Import FitHero échoué :', error);
            if (error?.code === 'FIT_HERO_INVALID_VALUE') {
                const details = error.details || {};
                const message = `Exercice : ${details.exercise || '—'}\n`
                    + `Variable : ${details.field || '—'}\n`
                    + `Valeur : ${details.value || '—'}`;
                if (A.components?.confirmDialog?.alert) {
                    await A.components.confirmDialog.alert({
                        title: 'Import FitHero',
                        message,
                        variant: 'error'
                    });
                } else {
                    alert(message);
                }
                return;
            }
            if (A.components?.confirmDialog?.alert) {
                await A.components.confirmDialog.alert({
                    title: 'Import FitHero',
                    message: 'Le chargement des séances FitHero a échoué.',
                    variant: 'error'
                });
            } else {
                alert('Le chargement des séances FitHero a échoué.');
            }
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function readJsonFile(file) {
        const text = await file.text();
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error('JSON invalide.');
        }
    }

    async function loadFitHeroMapping() {
        const [official, user] = await Promise.all([
            loadFitHeroOfficialMapping(),
            loadUserFitHeroMapping()
        ]);
        return {
            official,
            user,
            combined: official.concat(user)
        };
    }

    async function loadFitHeroOfficialMapping() {
        try {
            const url = new URL('data/mapping_fithero', document.baseURI).href;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('mapping_fithero introuvable');
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                return [];
            }
            return data;
        } catch (error) {
            console.warn('Chargement mapping FitHero échoué :', error);
            return [];
        }
    }

    async function loadExercisesCatalog() {
        try {
            const url = new URL('data/exercises.json', document.baseURI).href;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('exercises.json introuvable');
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.warn('Chargement catalogue exercices échoué :', error);
            return [];
        }
    }

    function loadUserFitHeroMapping() {
        const raw = localStorage.getItem(FIT_HERO_USER_MAPPING_KEY);
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Mapping FitHero utilisateur invalide :', error);
            return [];
        }
    }

    function buildFitHeroMapping(mapping) {
        const official = Array.isArray(mapping?.official) ? mapping.official : [];
        const user = Array.isArray(mapping?.user) ? mapping.user : [];
        const entries = [
            ...official.map((entry) => ({ ...entry, source: 'official' })),
            ...user.map((entry) => ({ ...entry, source: 'user' }))
        ];
        return new Map(
            entries
                .filter((entry) => entry && typeof entry.slug === 'string')
                .map((entry) => [entry.slug.trim(), entry])
        );
    }

    function buildFitHeroExerciseDefinitionIndex(exercises) {
        const entries = Array.isArray(exercises) ? exercises : [];
        return new Map(
            entries
                .filter((exercise) => typeof exercise?.id === 'string')
                .map((exercise) => [exercise.id, exercise])
        );
    }

    function buildExerciseNameIndex(exercises, allowedOrigins) {
        const allowed = new Set(Array.isArray(allowedOrigins) ? allowedOrigins : []);
        const map = new Map();
        (Array.isArray(exercises) ? exercises : []).forEach((exercise) => {
            const origin = exercise?.origin || 'user';
            if (allowed.size && !allowed.has(origin)) {
                return;
            }
            const normalized = normalizeExerciseName(exercise?.name);
            if (!normalized || map.has(normalized)) {
                return;
            }
            map.set(normalized, exercise);
        });
        return map;
    }

    function normalizeExerciseName(value) {
        return String(value || '').trim().toLowerCase();
    }

    function buildExerciseByExternalKey(exercises) {
        const list = Array.isArray(exercises) ? exercises : [];
        const entries = list
            .map((exercise) => {
                const source = typeof exercise?.external_source === 'string' ? exercise.external_source : '';
                const externalId = typeof exercise?.external_exercise_id === 'string'
                    ? exercise.external_exercise_id
                    : '';
                if (!source || !externalId) {
                    return null;
                }
                return [buildExternalExerciseKey(source, externalId), exercise];
            })
            .filter(Boolean);
        return new Map(entries);
    }

    function buildExternalExerciseKey(source, id) {
        return `${source}::${id}`;
    }

    function buildFitHeroDisplayName(def, rawId, catalogById) {
        const catalogId = resolveFitHeroUserExerciseCatalogId(def, rawId);
        const catalogEntry = catalogId ? catalogById?.get(catalogId) : null;
        const catalogName = catalogEntry?.name || '';
        if (catalogName) {
            return catalogName;
        }
        const label = typeof def?.name === 'string' ? def.name.trim() : '';
        if (label) {
            return label;
        }
        return rawId || 'Exercice';
    }

    function resolveFitHeroUserExerciseCatalogId(def, rawId) {
        if (typeof def?.exerciseId === 'string' && def.exerciseId.trim()) {
            return def.exerciseId.trim();
        }
        if (typeof def?.exercise_id === 'string' && def.exercise_id.trim()) {
            return def.exercise_id.trim();
        }
        if (typeof def?.id === 'string' && def.id.trim() && !isFitHeroUserExerciseId(def.id)) {
            return def.id.trim();
        }
        if (typeof rawId === 'string') {
            const trimmed = rawId.trim();
            const prefix = 'user-exercise--';
            if (trimmed.startsWith(prefix)) {
                const remainder = trimmed.slice(prefix.length);
                if (remainder) {
                    const segment = remainder.split('--')[0].trim();
                    return segment || remainder;
                }
            }
        }
        return '';
    }

    function buildExerciseCatalogIndex(catalog) {
        const list = Array.isArray(catalog) ? catalog : [];
        const entries = list
            .map((exercise) => {
                const id = String(
                    exercise?.exerciseId
                        || exercise?.id
                        || exercise?._id
                        || exercise?.uuid
                        || ''
                ).trim();
                const name = getCatalogName(exercise);
                if (!id || !name) {
                    return null;
                }
                return [id, {
                    id,
                    name,
                    primary: getCatalogPrimary(exercise),
                    secondary: getCatalogSecondary(exercise),
                    category: getCatalogCategory(exercise),
                    notes: getCatalogInstructions(exercise)
                }];
            })
            .filter(Boolean);
        return new Map(entries);
    }

    function normalizeCatalogList(value) {
        if (Array.isArray(value)) {
            return value
                .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry).trim()))
                .filter(Boolean);
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed ? [trimmed] : [];
        }
        return [];
    }

    function normalizeCatalogInstructions(value) {
        if (Array.isArray(value)) {
            return value
                .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry).trim()))
                .filter(Boolean);
        }
        if (typeof value === 'string') {
            return value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
        }
        return [];
    }

    function getCatalogName(entry) {
        const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
        if (name) {
            return name;
        }
        const alt = typeof entry?.Name === 'string' ? entry.Name.trim() : '';
        if (alt) {
            return alt;
        }
        const label = typeof entry?.exerciseName === 'string' ? entry.exerciseName.trim() : '';
        return label || '';
    }

    function getCatalogPrimary(entry) {
        return normalizeCatalogList(entry?.primary ?? entry?.Primary ?? entry?.targetMuscles);
    }

    function getCatalogSecondary(entry) {
        return normalizeCatalogList(entry?.secondary ?? entry?.Secondary ?? entry?.secondaryMuscles);
    }

    function getCatalogCategory(entry) {
        return normalizeCatalogList(entry?.category ?? entry?.Category ?? entry?.equipments ?? entry?.equipment);
    }

    function getCatalogInstructions(entry) {
        return normalizeCatalogInstructions(entry?.Notes ?? entry?.notes ?? entry?.instructions);
    }

    async function ensureFitHeroImportExercise(rawId, context) {
        if (!rawId) {
            return null;
        }
        const key = buildExternalExerciseKey('FitHero', rawId);
        const existing = context?.exerciseByExternalKey?.get(key);
        if (existing) {
            return existing;
        }

        const def = context?.fitHeroExercisesById?.get(rawId) || null;
        const isUserExercise = isFitHeroUserExerciseId(rawId);
        if (isUserExercise && !def) {
            console.warn(`Missing user exercise definition for id ${rawId}. See root.exercises in backup.`);
        }

        const catalogId = resolveFitHeroUserExerciseCatalogId(def, rawId) || rawId;
        const catalogEntry = catalogId ? context?.catalogById?.get(catalogId) : null;
        const name = catalogEntry?.name || buildFitHeroDisplayName(def, rawId, context?.catalogById);
        const primaryRaw = Array.isArray(catalogEntry?.primary) ? catalogEntry.primary[0] : def?.primary;
        const secondaryRaw = Array.isArray(catalogEntry?.secondary) ? catalogEntry.secondary : def?.secondary;
        const category = Array.isArray(catalogEntry?.category)
            ? catalogEntry.category[0]
            : typeof def?.category === 'string'
                ? def.category
                : null;
        const instructions = Array.isArray(catalogEntry?.notes)
            ? catalogEntry.notes
            : normalizeCatalogInstructions(def?.notes);

        let primaryMuscle = null;
        let secondaryMuscles = [];
        if (primaryRaw) {
            primaryMuscle = normalizeMuscleValue(primaryRaw, { exerciseName: name, field: 'primary' });
        } else {
            primaryMuscle = 'biceps';
        }
        if (secondaryRaw) {
            secondaryMuscles = normalizeMuscleList(secondaryRaw, { exerciseName: name, field: 'secondary' });
        }
        const muscleGroups = CFG.decodeMuscle(primaryMuscle);
        const equipment = deriveEquipmentFromName(name, { exerciseName: name });
        const equipmentGroups = CFG.decodeEquipment(equipment);
        const idBase = buildFitHeroImportExerciseId(rawId);
        let id = idBase;
        if (context?.exerciseById?.has(id)) {
            let counter = 1;
            while (context.exerciseById.has(`${idBase}-${counter}`)) {
                counter += 1;
            }
            id = `${idBase}-${counter}`;
        }

        const exercise = {
            id,
            name,
            muscle: primaryMuscle,
            muscleGroup1: muscleGroups?.g1 || null,
            muscleGroup2: muscleGroups?.g2 || null,
            muscleGroup3: muscleGroups?.g3 || null,
            bodyPart: muscleGroups?.g1 || null,
            equipment,
            equipmentGroup1: equipmentGroups.g1 || null,
            equipmentGroup2: equipmentGroups.g2 || null,
            secondaryMuscles,
            instructions,
            image: null,
            source: 'FitHero',
            origin: 'import',
            importedAt: new Date().toISOString(),
            external_source: 'FitHero',
            external_exercise_id: rawId,
            category,
            notes: Array.isArray(catalogEntry?.notes) ? catalogEntry.notes.join('\n') : null,
            primary: primaryMuscle
        };

        await db.put('exercises', exercise);
        context?.exerciseById?.set(exercise.id, exercise);
        context?.exerciseByExternalKey?.set(key, exercise);
        context?.missingEntries?.push({
            slug: rawId,
            sourceExerciseId: exercise.id,
            name: exercise.name,
            exerciseId: null
        });
        return exercise;
    }

    function getFitHeroExerciseSlug(exercise) {
        if (!exercise || typeof exercise !== 'object') {
            return '';
        }
        const rawExerciseId = typeof exercise.exercise_id === 'string' ? exercise.exercise_id.trim() : '';
        if (rawExerciseId) {
            return rawExerciseId;
        }
        const type = typeof exercise.type === 'string' ? exercise.type.trim() : '';
        if (type) {
            return type;
        }
        return typeof exercise.id === 'string' ? exercise.id.trim() : '';
    }

    function isFitHeroUserExerciseId(value) {
        return typeof value === 'string' && value.startsWith('user-exercise--');
    }

    function updateMissingFitHeroExercises(entries) {
        const list = Array.isArray(entries) ? entries : [];
        if (!list.length) {
            return;
        }
        const raw = localStorage.getItem(FIT_HERO_MISSING_STORAGE_KEY);
        const merged = new Map();
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach((entry) => {
                        if (typeof entry === 'string') {
                            merged.set(entry, { slug: entry, exerciseId: null });
                        } else if (entry?.slug) {
                            merged.set(entry.slug, entry);
                        }
                    });
                }
            } catch {
                merged.clear();
            }
        }
        list.forEach((entry) => {
            if (!entry?.slug) {
                return;
            }
            merged.set(entry.slug, {
                slug: entry.slug,
                sourceExerciseId: entry.sourceExerciseId || null,
                name: entry.name || null,
                exerciseId: entry.exerciseId ?? null
            });
        });
        localStorage.setItem(FIT_HERO_MISSING_STORAGE_KEY, JSON.stringify(Array.from(merged.values())));
    }

    function buildFitHeroImportExerciseId(rawId) {
        const clean = String(rawId || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'exercise';
        return `import--fithero--${clean}`;
    }

    function deriveEquipmentFromName(name, context) {
        const raw = String(name || '').toLowerCase();
        const rules = [
            { key: 'body weight', value: 'body weight' },
            { key: 'weighted', value: 'weighted' },
            { key: 'band', value: 'band' },
            { key: 'cable', value: 'cable' },
            { key: 'lever', value: 'leverage machine' },
            { key: 'machine', value: 'leverage machine' },
            { key: 'barbell', value: 'barbell' },
            { key: 'bar', value: 'barbell' },
            { key: 'dumbbell', value: 'dumbbell' },
            { key: 'kettlebell', value: 'kettlebell' },
            { key: 'ball', value: 'medicine ball' },
            { key: 'assisted', value: 'assisted' }
        ];
        const matched = rules.find((rule) => raw.includes(rule.key));
        if (!matched) {
            return 'barbell';
        }
        if (!CFG?.equipmentTranscode?.[matched.value]) {
            throwFitHeroValueError(context?.exerciseName || name, 'equipment', matched.value);
        }
        return matched.value;
    }

    function normalizeMuscleValue(value, context) {
        if (!value) {
            throwFitHeroValueError(context?.exerciseName, context?.field || 'muscle', value);
        }
        const raw = String(value).trim().toLowerCase();
        const normalized = raw === 'core' ? 'abs' : raw === 'back' ? 'upper back' : raw;
        if (!CFG?.muscleTranscode?.[normalized]) {
            throwFitHeroValueError(context?.exerciseName, context?.field || 'muscle', value);
        }
        const decoded = CFG.decodeMuscle(normalized);
        return decoded.muscle;
    }

    function normalizeMuscleList(values, context) {
        const list = Array.isArray(values) ? values : typeof values === 'string' ? [values] : [];
        return list.map((value) => normalizeMuscleValue(value, context));
    }

    function throwFitHeroValueError(exerciseName, field, value) {
        const error = new Error('Valeur non gérée');
        error.code = 'FIT_HERO_INVALID_VALUE';
        error.details = {
            exercise: exerciseName,
            field,
            value
        };
        throw error;
    }

    async function clearAllSessions() {
        const sessions = await db.getAll('sessions');
        if (!Array.isArray(sessions) || !sessions.length) {
            return;
        }
        await Promise.all(
            sessions.map((session) => (session?.id ? db.del('sessions', session.id) : Promise.resolve(false)))
        );
    }

    async function toFitHeroSession(workout, context = {}) {
        if (!workout || typeof workout !== 'object') {
            return null;
        }

        const rawId = typeof workout.id === 'string' ? workout.id.trim() : '';
        const rawDate = typeof workout.date === 'string' ? workout.date.trim() : '';
        const parsedDate = parseWorkoutDate(rawDate);
        const dateKey = parsedDate
            ? getFitHeroWorkoutDateKey(parsedDate)
            : (rawId && typeof A.sessionDateKeyFromId === 'function'
                ? A.sessionDateKeyFromId(rawId)
                : null);
        const sessionDate = parsedDate && typeof A.sessionISO === 'function'
            ? A.sessionISO(parsedDate)
            : dateKey || null;
        const sessionId = parsedDate && typeof A.sessionId === 'function'
            ? A.sessionId(parsedDate)
            : rawId
                || (dateKey ? dateKey.replace(/-/g, '') : '')
                || '';

        if (!sessionId || !sessionDate) {
            return null;
        }

        let exercises = [];
        if (Array.isArray(workout.exercises)) {
            const mapped = await Promise.all(
                workout.exercises.map((exercise, index) => toFitHeroExercise(exercise, {
                    sessionId,
                    sessionDate,
                    position: index + 1,
                    mappingBySlug: context.mappingBySlug,
                    exerciseById: context.exerciseById,
                    fitHeroExercisesById: context.fitHeroExercisesById,
                    exerciseByExternalKey: context.exerciseByExternalKey,
                    catalogById: context.catalogById,
                    missingEntries: context.missingEntries,
                    mappingStats: context.mappingStats,
                    nativeExercisesByName: context.nativeExercisesByName,
                    userExercisesByName: context.userExercisesByName
                }))
            );
            exercises = mapped.filter(Boolean);
        }

        return {
            id: sessionId,
            date: sessionDate,
            comments: typeof workout.comments === 'string' ? workout.comments : '',
            exercises
        };
    }

    function getFitHeroWorkoutDateKey(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return null;
        }
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseWorkoutDate(isoUtc) {
        if (!isoUtc) {
            return null;
        }
        const d = new Date(isoUtc);
        if (Number.isNaN(d.getTime())) {
            return null;
        }
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    async function toFitHeroExercise(exercise, context) {
        if (!exercise || typeof exercise !== 'object') {
            return null;
        }

        const sessionId = context?.sessionId || '';
        const sessionDate = context?.sessionDate || null;
        const slug = getFitHeroExerciseSlug(exercise);
        const isUserExercise = isFitHeroUserExerciseId(slug);
        const mapping = slug && context?.mappingBySlug ? context.mappingBySlug.get(slug) : null;
        const mappedId = mapping?.exerciseId || '';
        const mappedExercise = mappedId && context?.exerciseById ? context.exerciseById.get(mappedId) : null;
        const def = isUserExercise ? context?.fitHeroExercisesById?.get(slug) : null;
        const catalogName = context?.catalogById?.get(slug)?.name || '';
        const importName = buildFitHeroDisplayName(def, slug, context?.catalogById);
        const rawName = typeof exercise.name === 'string' ? exercise.name : '';
        const candidateName = mappedExercise?.name || mapping?.name || importName || catalogName || rawName || slug || '';
        let resolvedExercise = null;
        let matchSource = null;

        if (mappedExercise) {
            resolvedExercise = mappedExercise;
            matchSource = 'mapping';
        } else if (!mapping?.exerciseId) {
            const normalizedName = normalizeExerciseName(candidateName);
            if (normalizedName) {
                resolvedExercise = context?.nativeExercisesByName?.get(normalizedName) || null;
                if (resolvedExercise) {
                    matchSource = 'native';
                } else {
                    resolvedExercise = context?.userExercisesByName?.get(normalizedName) || null;
                    if (resolvedExercise) {
                        matchSource = 'user';
                    }
                }
            }
        }

        if (!resolvedExercise) {
            resolvedExercise = await ensureFitHeroImportExercise(slug, {
                fitHeroExercisesById: context?.fitHeroExercisesById,
                exerciseById: context?.exerciseById,
                exerciseByExternalKey: context?.exerciseByExternalKey,
                catalogById: context?.catalogById,
                missingEntries: context?.missingEntries
            });
            matchSource = resolvedExercise ? 'created' : matchSource;
        }

        const exerciseId = resolvedExercise?.id || mappedId || slug;
        const name = resolvedExercise?.name || candidateName || exerciseId || 'Exercice';
        const exerciseDate = typeof exercise.date === 'string' ? exercise.date : sessionDate;
        const sortValue = Number.isFinite(Number(exercise.sort))
            ? Number(exercise.sort)
            : context?.position || 1;

        const stats = context?.mappingStats;
        if (stats?.unique && stats?.uniqueBySource && matchSource && stats.uniqueBySource[matchSource] && exerciseId) {
            stats.unique.add(exerciseId);
            const sourceSet = stats.uniqueBySource[matchSource];
            sourceSet.add(exerciseId);
            stats[matchSource] = sourceSet.size;
        }

        const sets = Array.isArray(exercise.sets)
            ? exercise.sets.map((set, index) => toFitHeroSet(set, {
                type: exerciseId,
                position: index + 1,
                date: exerciseDate
            })).filter(Boolean)
            : [];

        return {
            id: typeof exercise.id === 'string' && exercise.id.length
                ? exercise.id
                : `${sessionId}_${name}`,
            exercise_id: exerciseId,
            exercise_name: name,
            date: exerciseDate,
            type: exerciseId,
            sets,
            sort: sortValue,
            category: 'weight_reps',
            weight_unit: 'metric',
            distance_unit: 'metric',
            comments: typeof exercise.comments === 'string' ? exercise.comments : null,
            exercise_note: typeof exercise.comments === 'string' ? exercise.comments : ''
        };
    }

    function toFitHeroSet(set, context) {
        if (!set || typeof set !== 'object') {
            return null;
        }

        const rawDate = typeof set.date === 'string' ? set.date : context?.date;
        const parsed = rawDate ? new Date(rawDate) : null;
        const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
        const pos = context?.position || 1;
        return {
            id: typeof set.id === 'string' ? set.id : '',
            pos,
            date,
            type: context?.type || null,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            time: set.time ?? null,
            distance: set.distance ?? null,
            setType: set.setType ?? null,
            rpe: normalizeFitHeroRpe(set.rpe),
            done: true
        };
    }

    function normalizeFitHeroRpe(value) {
        if (value == null || value === '') {
            return null;
        }
        const numeric = Number.parseFloat(String(value).replace(',', '.'));
        if (!Number.isFinite(numeric) || numeric === 0) {
            return null;
        }
        const allowed = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
        return allowed.reduce((closest, option) => {
            if (closest == null) {
                return option;
            }
            return Math.abs(option - numeric) < Math.abs(closest - numeric) ? option : closest;
        }, null);
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
            screenAdmin,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData,
            screenApplication,
            screenPlanning,
            screenFitHeroMapping
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
            screenAdmin,
            screenStatMuscles,
            screenStatMusclesDetail,
            screenPreferences,
            screenData,
            screenApplication,
            screenPlanning,
            screenFitHeroMapping
        };
        Object.entries(map).forEach(([key, element]) => {
            if (element) {
                element.hidden = key !== target;
            }
        });
    }
})();
