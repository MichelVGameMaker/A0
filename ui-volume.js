// ui-volume.js — écran Volume et réglages associés
(() => {
    const A = window.App;
    const CFG = window.CFG || {};

    const STORAGE_KEY = 'volumeSettings';

    /* STATE */
    const refs = {};
    let refsResolved = false;
    let allVolumeItems = null;

    /* WIRE */
    document.addEventListener('DOMContentLoaded', () => {
        ensureRefs();
        wireEvents();
        renderVolumeScreen();
    });

    /* ACTIONS */
    A.renderVolumeScreen = function renderVolumeScreen() {
        ensureRefs();
        renderVolumeTable();
    };

    /* UTILS */
    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.screenVolume = document.getElementById('screenVolume');
        refs.btnVolumeBack = document.getElementById('btnVolumeBack');
        refs.btnVolumeEdit = document.getElementById('btnVolumeEdit');
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
            return { items: {} };
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.items && typeof parsed.items === 'object') {
                return parsed;
            }
        } catch (error) {
            console.warn('Volume: données locales invalides.', error);
        }
        return { items: {} };
    }

    function saveSettings(settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function renderVolumeTable() {
        const { volumeTableBody, volumeEmpty, volumeTable } = ensureRefs();
        if (!volumeTableBody || !volumeEmpty || !volumeTable) {
            return;
        }
        const settings = loadSettings();
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

        tracked.forEach((entry) => {
            const row = document.createElement('tr');
            const muscleCell = document.createElement('td');
            muscleCell.textContent = formatLabel(entry.key);
            row.appendChild(muscleCell);
            row.appendChild(createGaugeCell(0, entry.targetSessions, 'séances/sem'));
            row.appendChild(createGaugeCell(0, entry.targetSets, 'séries/sem'));
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
        const nextSettings = { items: {} };
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
        renderVolumeTable();
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
})();
