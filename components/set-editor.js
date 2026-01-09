(() => {
    const A = (window.App = window.App || {});
    const components = (A.components = A.components || {});

    class SetEditor {
        static #refs = null;
        static #active = null;
        static #outsideHandler = null;

        static open(options = {}) {
            const refs = SetEditor.#ensureRefs();
            if (refs.dialog.open) {
                SetEditor.close();
            }
            return new Promise((resolve) => {
                SetEditor.#active = { resolve, options, lastAction: null };
                SetEditor.#applyOptions(options);
                window.setTimeout(() => {
                    refs.dialog.show();
                    SetEditor.#bindOutsideInteractions();
                    SetEditor.#focusField(options.focus);
                }, 0);
            });
        }

        static close() {
            const refs = SetEditor.#refs;
            if (refs?.dialog?.open) {
                SetEditor.#closeWith('close');
            }
        }

        static #ensureRefs() {
            if (SetEditor.#refs) {
                return SetEditor.#refs;
            }
            const dialog = document.getElementById('dlgSetEditor');
            if (!dialog) {
                throw new Error('SetEditor: élément #dlgSetEditor introuvable.');
            }
            const form = dialog.querySelector('[data-role="set-editor-form"]');
            const title = dialog.querySelector('[data-role="set-editor-title"]');
            const repsInput = dialog.querySelector('[data-role="reps"]');
            const weightInput = dialog.querySelector('[data-role="weight"]');
            const rpeInput = dialog.querySelector('[data-role="rpe"]');
            const minutesInput = dialog.querySelector('[data-role="minutes"]');
            const secondsInput = dialog.querySelector('[data-role="seconds"]');
            const closeButton = dialog.querySelector('[data-action="close"]');
            const actionsContainer = dialog.querySelector('[data-role="set-editor-actions"]');
            const secondaryActionsContainer = dialog.querySelector('[data-role="set-editor-actions-secondary"]');
            const orderContainer = dialog.querySelector('[data-role="set-editor-order"]');
            const orderNumber = dialog.querySelector('[data-role="set-editor-order-number"]');
            const refs = {
                dialog,
                form,
                title,
                repsInput,
                weightInput,
                rpeInput,
                minutesInput,
                secondsInput,
                closeButton,
                actionsContainer,
                secondaryActionsContainer,
                orderContainer,
                orderNumber
            };
            SetEditor.#refs = refs;
            SetEditor.#bindEvents();
            return refs;
        }

        static #bindEvents() {
            const refs = SetEditor.#refs;
            if (!refs) {
                return;
            }
            refs.form?.addEventListener('submit', (event) => {
                event.preventDefault();
                SetEditor.#closeWith('submit');
            });
            refs.closeButton?.addEventListener('click', (event) => {
                event.preventDefault();
                SetEditor.#closeWith('close');
            });
            refs.dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                SetEditor.#closeWith('cancel');
            });
            refs.dialog.addEventListener('close', () => {
                SetEditor.#handleClose();
            });
            refs.dialog.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    SetEditor.#closeWith('cancel');
                }
            });
            refs.form?.addEventListener('click', (event) => {
                const action = event.target?.dataset?.action;
                if (!action) {
                    return;
                }
                if (action === 'close') {
                    event.preventDefault();
                    SetEditor.#closeWith('close');
                    return;
                }
                if (SetEditor.#handleAction(action)) {
                    event.preventDefault();
                }
            });
            [
                refs.repsInput,
                refs.weightInput,
                refs.rpeInput,
                refs.minutesInput,
                refs.secondsInput
            ].forEach((input) => {
                if (!input) {
                    return;
                }
                input.addEventListener('focus', SetEditor.#selectOnFocus);
                input.addEventListener('input', () => SetEditor.#notifyChange());
            });
            const syncTime = () => {
                SetEditor.#sanitizeTimeInputs();
                SetEditor.#notifyChange();
            };
            refs.minutesInput?.addEventListener('change', syncTime);
            refs.minutesInput?.addEventListener('blur', syncTime);
            refs.secondsInput?.addEventListener('change', syncTime);
            refs.secondsInput?.addEventListener('blur', syncTime);
        }

        static #selectOnFocus(event) {
            const target = event.currentTarget;
            if (target?.select) {
                target.select();
            }
        }

        static #notifyChange() {
            const active = SetEditor.#active;
            const onChange = active?.options?.onChange;
            if (typeof onChange !== 'function') {
                return;
            }
            const values = SetEditor.#getCurrentValues();
            if (values) {
                onChange(values);
            }
        }

        static #handleAction(action) {
            switch (action) {
                case 'reps-plus':
                    SetEditor.#adjustReps(1);
                    return true;
                case 'reps-minus':
                    SetEditor.#adjustReps(-1);
                    return true;
                case 'weight-plus':
                    SetEditor.#adjustWeight(1);
                    return true;
                case 'weight-minus':
                    SetEditor.#adjustWeight(-1);
                    return true;
                case 'rpe-plus':
                    SetEditor.#adjustRpe(1);
                    return true;
                case 'rpe-minus':
                    SetEditor.#adjustRpe(-1);
                    return true;
                case 'minutes-plus':
                    SetEditor.#adjustMinutes(1);
                    return true;
                case 'minutes-minus':
                    SetEditor.#adjustMinutes(-1);
                    return true;
                case 'seconds-plus':
                    SetEditor.#adjustSeconds(10);
                    return true;
                case 'seconds-minus':
                    SetEditor.#adjustSeconds(-10);
                    return true;
                case 'move-up':
                    SetEditor.#handleMove('up');
                    return true;
                case 'move-down':
                    SetEditor.#handleMove('down');
                    return true;
                default:
                    return false;
            }
        }

        static #handleMove(direction) {
            const active = SetEditor.#active;
            const onMove = active?.options?.onMove;
            if (typeof onMove !== 'function') {
                return;
            }
            const result = onMove(direction);
            if (result && typeof result.then === 'function') {
                result.then((next) => {
                    SetEditor.#applyOrderUpdate(next);
                });
                return;
            }
            SetEditor.#applyOrderUpdate(result);
        }

        static #closeWith(action) {
            const refs = SetEditor.#refs;
            if (!refs?.dialog) {
                return;
            }
            if (SetEditor.#active) {
                SetEditor.#active.lastAction = action || '';
            }
            refs.dialog.close(action || '');
        }

        static #bindOutsideInteractions() {
            const refs = SetEditor.#refs;
            if (!refs?.dialog) {
                return;
            }
            const handler = (event) => {
                if (!refs.dialog?.open) {
                    return;
                }
                const target = event.target;
                if (refs.dialog.contains(target)) {
                    return;
                }
                SetEditor.#closeWith('cancel');
            };
            SetEditor.#unbindOutsideInteractions();
            document.addEventListener('pointerdown', handler);
            SetEditor.#outsideHandler = handler;
        }

        static #unbindOutsideInteractions() {
            if (SetEditor.#outsideHandler) {
                document.removeEventListener('pointerdown', SetEditor.#outsideHandler);
                SetEditor.#outsideHandler = null;
            }
        }

        static #adjustReps(delta) {
            const input = SetEditor.#refs?.repsInput;
            if (!input) {
                return;
            }
            const current = SetEditor.#parseInt(input.value, 0);
            const next = Math.max(0, current + delta);
            input.value = String(next);
            SetEditor.#notifyChange();
        }

        static #adjustWeight(delta) {
            const input = SetEditor.#refs?.weightInput;
            if (!input) {
                return;
            }
            const current = SetEditor.#parseFloat(input.value, 0);
            let next = current + delta;
            if (next < 0) {
                next = 0;
            }
            input.value = SetEditor.#formatDecimal(next);
            SetEditor.#notifyChange();
        }

        static #adjustRpe(delta) {
            const input = SetEditor.#refs?.rpeInput;
            if (!input) {
                return;
            }
            const current = SetEditor.#parseFloat(input.value, null);
            let base = current;
            if (!Number.isFinite(base)) {
                base = delta > 0 ? 5 : 10;
            } else {
                base += delta * 0.5;
            }
            const next = SetEditor.#clampRpe(base);
            if (next == null) {
                return;
            }
            input.value = SetEditor.#formatDecimal(next);
            SetEditor.#notifyChange();
        }

        static #adjustMinutes(delta) {
            const input = SetEditor.#refs?.minutesInput;
            if (!input) {
                return;
            }
            const current = SetEditor.#parseInt(input.value, 0);
            const next = Math.max(0, current + delta);
            input.value = String(next);
            SetEditor.#notifyChange();
        }

        static #adjustSeconds(delta) {
            const refs = SetEditor.#refs;
            if (!refs) {
                return;
            }
            let minutes = SetEditor.#parseInt(refs.minutesInput?.value, 0);
            let seconds = SetEditor.#parseInt(refs.secondsInput?.value, 0);
            seconds += delta;
            if (seconds >= 60) {
                minutes += Math.floor(seconds / 60);
                seconds %= 60;
            } else if (seconds < 0) {
                const borrow = Math.ceil(Math.abs(seconds) / 60);
                if (minutes >= borrow) {
                    minutes -= borrow;
                    seconds = (seconds % 60 + 60) % 60;
                } else {
                    minutes = 0;
                    seconds = 0;
                }
            }
            refs.minutesInput.value = String(Math.max(0, minutes));
            refs.secondsInput.value = String(Math.max(0, seconds));
            SetEditor.#notifyChange();
        }

        static #sanitizeTimeInputs() {
            const refs = SetEditor.#refs;
            if (!refs) {
                return;
            }
            let minutes = SetEditor.#parseInt(refs.minutesInput?.value, 0);
            let seconds = SetEditor.#parseInt(refs.secondsInput?.value, 0);
            if (minutes < 0) {
                minutes = 0;
            }
            if (seconds < 0) {
                seconds = 0;
            }
            if (seconds >= 60) {
                minutes += Math.floor(seconds / 60);
                seconds %= 60;
            }
            refs.minutesInput.value = String(minutes);
            refs.secondsInput.value = String(seconds);
        }

        static #parseInt(value, fallback) {
            const numeric = Number.parseInt(value, 10);
            return Number.isFinite(numeric) ? numeric : fallback;
        }

        static #parseFloat(value, fallback) {
            if (value == null || value === '') {
                return fallback;
            }
            const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
            const numeric = Number.parseFloat(normalized);
            return Number.isFinite(numeric) ? numeric : fallback;
        }

        static #clampRpe(value) {
            const numeric = Number.parseFloat(value);
            if (!Number.isFinite(numeric)) {
                return null;
            }
            const bounded = Math.min(10, Math.max(5, numeric));
            return Math.round(bounded * 2) / 2;
        }

        static #formatDecimal(value) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                return '0';
            }
            if (Number.isInteger(numeric)) {
                return String(numeric);
            }
            return numeric
                .toFixed(2)
                .replace(/\.0+$/, '')
                .replace(/(\.\d*?)0+$/, '$1');
        }

        static #normalizeOrder(order) {
            const position = Math.max(1, SetEditor.#parseInt(order?.position, 1));
            const total = Math.max(position, SetEditor.#parseInt(order?.total, position));
            return { position, total };
        }

        static #updateOrderControls() {
            const refs = SetEditor.#refs;
            const active = SetEditor.#active;
            if (!refs || !active) {
                return;
            }
            const order = active.options?.order;
            const moveHandler = typeof active.options?.onMove === 'function';
            const position = order?.position ?? 1;
            const total = order?.total ?? 1;
            if (refs.orderNumber) {
                refs.orderNumber.textContent = String(position);
            }
            const moveUp = refs.orderContainer?.querySelector('[data-action="move-up"]');
            const moveDown = refs.orderContainer?.querySelector('[data-action="move-down"]');
            if (moveUp) {
                moveUp.disabled = !moveHandler || position <= 1;
            }
            if (moveDown) {
                moveDown.disabled = !moveHandler || position >= total;
            }
        }

        static #applyOrderUpdate(nextOrder) {
            if (!SetEditor.#active?.options) {
                return;
            }
            if (nextOrder && typeof nextOrder === 'object') {
                const merged = { ...SetEditor.#active.options.order, ...nextOrder };
                SetEditor.#active.options.order = SetEditor.#normalizeOrder(merged);
                if (nextOrder.title && SetEditor.#refs?.title) {
                    SetEditor.#refs.title.textContent = nextOrder.title;
                }
            }
            SetEditor.#updateOrderControls();
        }

        static #applyOptions(options) {
            const refs = SetEditor.#refs;
            if (!refs) {
                return;
            }
            const { title = 'Série', values = {}, tone = 'black' } = options;
            if (refs.title) {
                refs.title.textContent = title;
                refs.title.hidden = !title;
            }
            if (refs.form) {
                refs.form.classList.remove('set-editor-tone-black', 'set-editor-tone-muted');
                const toneClass = tone === 'muted' ? 'set-editor-tone-muted' : 'set-editor-tone-black';
                refs.form.classList.add(toneClass);
            }
            const repsValue = SetEditor.#parseInt(values.reps, 0);
            refs.repsInput.value = String(Math.max(0, repsValue ?? 0));
            const hasWeight = values.weight != null && values.weight !== '';
            const weightValue = hasWeight ? Math.max(0, SetEditor.#parseFloat(values.weight, 0)) : null;
            refs.weightInput.value = weightValue == null ? '' : SetEditor.#formatDecimal(weightValue);
            const rpeValue = SetEditor.#clampRpe(values.rpe);
            refs.rpeInput.value = Number.isFinite(rpeValue) ? SetEditor.#formatDecimal(rpeValue) : '';
            refs.minutesInput.value = String(Math.max(0, SetEditor.#parseInt(values.minutes, 0)));
            refs.secondsInput.value = String(Math.max(0, SetEditor.#parseInt(values.seconds, 0)));
            SetEditor.#sanitizeTimeInputs();
            SetEditor.#active.options.order = SetEditor.#normalizeOrder(options.order || { position: 1, total: 1 });
            SetEditor.#updateOrderControls();
            SetEditor.#configureActions(options);
        }

        static #configureActions(options) {
            const refs = SetEditor.#refs;
            if (!refs?.actionsContainer) {
                return;
            }
            const layout = String(options.actionsLayout || '').toLowerCase();
            const mainActions = Array.isArray(options.actions) && options.actions.length ? options.actions : SetEditor.#defaultActions();
            const secondary = Array.isArray(options.secondaryActions) ? options.secondaryActions : [];
            SetEditor.#buildActions(refs.actionsContainer, mainActions, layout === 'vertical');
            SetEditor.#buildActions(refs.secondaryActionsContainer, secondary, layout === 'vertical');
        }

        static #buildActions(container, definitions, vertical) {
            if (!container) {
                return;
            }
            container.innerHTML = '';
            container.classList.toggle('set-editor-actions-vertical', Boolean(vertical));
            container.hidden = !definitions?.length;
            (definitions || []).forEach((definition) => {
                if (!definition) {
                    return;
                }
                const id = definition.id || 'submit';
                const label = definition.label ?? '';
                const variant = definition.variant || 'primary';
                const classes = ['btn'];
                if (variant) {
                    classes.push(variant);
                }
                if (definition.full) {
                    classes.push('full');
                }
                if (definition.extraClass) {
                    classes.push(definition.extraClass);
                }
                const button = document.createElement('button');
                button.type = 'button';
                button.className = classes.join(' ');
                button.textContent = label;
                if (definition.title) {
                    button.title = definition.title;
                }
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    if (typeof definition.onClick === 'function') {
                        definition.onClick(SetEditor.#getCurrentValues());
                    }
                    if (definition.preventClose) {
                        return;
                    }
                    SetEditor.#closeWith(id);
                });
                container.appendChild(button);
            });
        }

        static #defaultActions() {
            return [
                { id: 'close', label: 'Fermer', variant: 'ghost' },
                { id: 'submit', label: 'Valider', variant: 'primary' }
            ];
        }

        static #focusField(focusField) {
            const refs = SetEditor.#refs;
            if (!refs) {
                return;
            }
            const map = {
                reps: refs.repsInput,
                weight: refs.weightInput,
                rpe: refs.rpeInput,
                minutes: refs.minutesInput,
                seconds: refs.secondsInput
            };
            const target = map[focusField] || refs.repsInput;
            if (target) {
                window.requestAnimationFrame(() => {
                    target.focus();
                    if (target.select) {
                        target.select();
                    }
                });
            }
        }

        static #getCurrentValues() {
            const refs = SetEditor.#refs;
            if (!refs) {
                return null;
            }
            const reps = Math.max(0, SetEditor.#parseInt(refs.repsInput?.value, 0));
            const weightRaw = refs.weightInput?.value ?? '';
            const hasWeight = String(weightRaw).trim() !== '';
            const weight = hasWeight ? Math.max(0, SetEditor.#parseFloat(weightRaw, 0)) : null;
            const rpeRaw = refs.rpeInput?.value ?? '';
            const rpeValue = String(rpeRaw).trim() === '' ? null : SetEditor.#clampRpe(rpeRaw);
            const rpe = Number.isFinite(rpeValue) && rpeValue >= 5 && rpeValue <= 10 ? rpeValue : null;
            const minutes = Math.max(0, SetEditor.#parseInt(refs.minutesInput?.value, 0));
            const seconds = Math.max(0, SetEditor.#parseInt(refs.secondsInput?.value, 0));
            return { reps, weight, rpe, minutes, seconds };
        }

        static #collectValues() {
            const refs = SetEditor.#refs;
            if (!refs) {
                return null;
            }
            SetEditor.#sanitizeTimeInputs();
            return SetEditor.#getCurrentValues();
        }

        static #handleClose() {
            SetEditor.#unbindOutsideInteractions();
            const active = SetEditor.#active;
            if (!active) {
                return;
            }
            const { resolve } = active;
            SetEditor.#active = null;
            if (typeof resolve !== 'function') {
                return;
            }
            const refs = SetEditor.#refs;
            const action = active.lastAction || refs?.dialog?.returnValue || '';
            const values = SetEditor.#collectValues();
            if (!action || action === 'cancel' || action === 'close') {
                resolve(null);
                return;
            }
            resolve({ action, values });
        }
    }

    components.SetEditor = SetEditor;

    components.createInlineKeyboard = function createInlineKeyboard() {
        if (components.inlineKeyboard) {
            return components.inlineKeyboard;
        }

        let active = null;
        let currentLayout = 'default';
        let currentMode = 'input';

        const keyboard = document.createElement('div');
        keyboard.className = 'inline-keyboard';
        keyboard.hidden = true;

        const content = document.createElement('div');
        content.className = 'inline-keyboard-content';
        keyboard.appendChild(content);

        const grid = document.createElement('div');
        grid.className = 'inline-keyboard-grid';
        content.appendChild(grid);

        const actionsGrid = document.createElement('div');
        actionsGrid.className = 'inline-keyboard-actions';
        content.appendChild(actionsGrid);

        const layouts = {
            default: ['1',  '2',  '3',  '4',   '5', '6',   '7',    '8',   '9',     '.',   '0',  'del'],
            rpe:     ['5',  '5.5', '6', '6.5', '7', '7.5', '8',    '8.5', '9',     '9.5', '10', 'del'],
            time:    ['1',  '2',  '3',  '4',   '5', '6',   '7',    '8',   '9',     ':',   '0',  'del'],
            edit:    ['up', null, null, null,  null, null, 'down', null,  'trash', null,   null, null]
        };

        const resolveLayout = (layout, mode) => (mode === 'edit' ? 'edit' : layout || 'default');

        const renderKeys = (layout, mode) => {
            grid.innerHTML = '';
            const keys = layouts[layout] || layouts.default;
            keys.forEach((key) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'inline-keyboard-key';
                if (!key) {
                    button.disabled = true;
                    button.classList.add('inline-keyboard-key--empty');
                    button.setAttribute('aria-hidden', 'true');
                    grid.appendChild(button);
                    return;
                }
                const labelMap = {
                    del: '⌫',
                    up: '⬆️',
                    down: '⬇️',
                    trash: '🗑️'
                };
                button.textContent = labelMap[key] || key;
                button.dataset.key = key;
                if (key === 'up' || key === 'down') {
                    button.dataset.wide = 'true';
                    button.dataset.tall = 'true';
                }
                if (key === 'trash') {
                    button.dataset.tall = 'true';
                    button.classList.add('inline-keyboard-key--danger');
                }
                if (layout === 'rpe' && key !== 'del') {
                    button.dataset.rpe = key;
                }
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    handleInput(key);
                });
                grid.appendChild(button);
            });
        };

        const renderActions = (actions = []) => {
            actionsGrid.innerHTML = '';
            const list = Array.isArray(actions) ? actions : [];
            if (!list.length) {
                actionsGrid.hidden = true;
                actionsGrid.setAttribute('data-empty', 'true');
                return;
            }
            actionsGrid.hidden = false;
            actionsGrid.removeAttribute('data-empty');
            list.forEach((action) => {
                const button = document.createElement('button');
                button.type = 'button';
                const className = ['inline-keyboard-action', action?.className].filter(Boolean).join(' ');
                button.className = className;
                if (action?.label) {
                    button.textContent = action.label;
                } else if (action?.icon) {
                    button.textContent = action.icon;
                }
                if (action?.ariaLabel) {
                    button.setAttribute('aria-label', action.ariaLabel);
                }
                if (Number.isFinite(action?.span)) {
                    button.style.gridRow = `span ${action.span}`;
                }
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    if (typeof action?.onClick === 'function') {
                        await action.onClick();
                    }
                    if (action?.close !== false) {
                        handleClose();
                    }
                });
                actionsGrid.appendChild(button);
            });
        };

        renderKeys(currentLayout, currentMode);

        const handleClose = () => {
            keyboard.hidden = true;
            keyboard.removeAttribute('data-visible');
            document.removeEventListener('pointerdown', handleOutside, true);
            active?.onClose?.();
            active = null;
        };

        const handleOutside = (event) => {
            if (!active) {
                return;
            }
            if (active.closeOnOutside === false) {
                return;
            }
            const path = event.composedPath?.() || [];
            const target = event.target;
            const isInsideKeyboard = path.includes(keyboard) || keyboard.contains(target);
            const isInsideTarget = path.includes(active.target) || active.target?.contains?.(target);
            const isInsideInlineSetEditor = path.some((node) => node?.classList?.contains?.('inline-set-editor-row'));
            if (isInsideKeyboard || isInsideTarget || isInsideInlineSetEditor) {
                return;
            }
            handleClose();
        };

        const hasFullSelection = (value) => {
            if (!active?.target) {
                return false;
            }
            const target = active.target;
            const length = value?.length ?? 0;
            if (!length) {
                return false;
            }
            if (typeof target.selectionStart === 'number' && typeof target.selectionEnd === 'number') {
                return target.selectionStart === 0 && target.selectionEnd === length;
            }
            return false;
        };

        const selectTarget = (target = active?.target) => {
            if (!target || target !== active?.target) {
                return;
            }
            if (typeof target.focus === 'function') {
                target.focus({ preventScroll: true });
            }
            target.select?.();
            active.replaceOnInput = true;
        };

        const handleInput = (key) => {
            if (!active) {
                return;
            }
            if (active.mode === 'edit') {
                const edit = active.edit || {};
                if (key === 'up') {
                    edit.onMove?.('up');
                } else if (key === 'down') {
                    edit.onMove?.('down');
                } else if (key === 'trash') {
                    const result = edit.onDelete?.();
                    if (result && typeof result.then === 'function') {
                        result.then(() => handleClose()).catch(() => handleClose());
                    } else {
                        handleClose();
                    }
                }
                return;
            }
            const current = String(active.getValue?.() ?? '');
            const layout = active.layout || 'default';
            const shouldReplace = active.replaceOnInput || hasFullSelection(current);
            const base = shouldReplace ? '' : current;
            let next = base;
            if (key === 'del') {
                next = shouldReplace ? '' : current.slice(0, -1);
            } else if (layout === 'rpe') {
                next = key;
            } else if (layout === 'time' && key === ':') {
                if (!base.includes(':')) {
                    next = `${base || '0'}:`;
                }
            } else if (key === '.') {
                next = base.includes('.') ? base : `${base || '0'}.`;
            } else {
                next = base === '' || base === '0' ? key : `${base}${key}`;
            }
            active.replaceOnInput = false;
            active.onChange?.(next);
        };

        document.body.appendChild(keyboard);

        const contains = (target, path) => {
            if (!target) {
                return false;
            }
            const composed = Array.isArray(path) ? path : target.composedPath?.();
            if (Array.isArray(composed) && composed.includes(keyboard)) {
                return true;
            }
            return keyboard.contains(target);
        };

        const resolveActions = () => {
            if (!active) {
                return [];
            }
            if (typeof active.actions === 'function') {
                return active.actions(active.mode);
            }
            return active.actions || [];
        };

        const applyLayout = (layout, mode) => {
            const resolved = resolveLayout(layout, mode);
            if (resolved !== currentLayout || mode !== currentMode) {
                currentLayout = resolved;
                currentMode = mode;
                renderKeys(currentLayout, currentMode);
            }
        };

        const setMode = (mode) => {
            if (!active) {
                return;
            }
            const nextMode = mode || (active.mode === 'edit' ? 'input' : 'edit');
            if (active.mode === nextMode) {
                return;
            }
            active.mode = nextMode;
            applyLayout(active.layout, active.mode);
            renderActions(resolveActions());
            if (active.mode === 'input') {
                selectTarget(active.target);
            }
        };

        const attach = (target, handlers = {}) => {
            const layout = handlers.layout || 'default';
            const mode = handlers.mode || 'input';
            active = { target, ...handlers, layout, mode };
            applyLayout(layout, mode);
            renderActions(resolveActions());
            keyboard.hidden = false;
            keyboard.setAttribute('data-visible', 'true');
            document.addEventListener('pointerdown', handleOutside, true);
            selectTarget(target);
        };

        const api = {
            attach,
            detach: handleClose,
            isOpen: () => Boolean(active),
            contains,
            selectTarget,
            setMode,
            getMode: () => active?.mode || 'input'
        };
        components.inlineKeyboard = api;
        return api;
    };

    /**
     * Fabrique un éditeur en ligne (insère des steppers autour d'une ligne de série).
     * @param {HTMLElement} container
     * @returns {{ open(row:HTMLElement, options?:object):void, close():void, isOpen():boolean }}
     */
    components.createInlineSetEditor = function createInlineSetEditor(container) {
        if (!container) {
            return null;
        }

        let active = null;

        const parseIntSafe = (value, fallback) => {
            const numeric = Number.parseInt(value, 10);
            return Number.isFinite(numeric) ? numeric : fallback;
        };

        const parseFloatSafe = (value, fallback) => {
            if (value == null || value === '') {
                return fallback;
            }
            const numeric = Number.parseFloat(String(value).replace(',', '.'));
            return Number.isFinite(numeric) ? numeric : fallback;
        };

        const clampRpe = (value) => {
            const numeric = Number.parseFloat(value);
            if (!Number.isFinite(numeric)) {
                return null;
            }
            const bounded = Math.min(10, Math.max(5, numeric));
            return Math.round(bounded * 2) / 2;
        };

        const normalizeTime = (minutes, seconds) => {
            let min = Math.max(0, parseIntSafe(minutes, 0));
            let sec = Math.max(0, parseIntSafe(seconds, 0));
            if (sec >= 60) {
                min += Math.floor(sec / 60);
                sec %= 60;
            }
            return { minutes: min, seconds: sec };
        };

        const normalizeValues = (values = {}) => {
            const reps = Math.max(0, parseIntSafe(values.reps, 0));
            const hasWeight = values.weight != null && values.weight !== '';
            const weight = hasWeight ? Math.max(0, parseFloatSafe(values.weight, 0)) : null;
            const rpe = values.rpe != null && values.rpe !== '' ? clampRpe(values.rpe) : null;
            if (values.rest != null) {
                const total = Math.max(0, parseIntSafe(values.rest, 0));
                return { reps, weight, rpe, minutes: Math.floor(total / 60), seconds: total % 60 };
            }
            const { minutes, seconds } = normalizeTime(values.minutes, values.seconds);
            return { reps, weight, rpe, minutes, seconds };
        };

        const normalizeOrder = (order = {}) => {
            const position = Math.max(1, parseIntSafe(order.position, 1));
            const total = Math.max(position, parseIntSafe(order.total, position));
            return { position, total };
        };

        const buildPayload = (state) => {
            const minutes = Math.max(0, parseIntSafe(state.minutes, 0));
            const seconds = Math.max(0, parseIntSafe(state.seconds, 0));
            const rest = Math.max(0, minutes * 60 + seconds);
            return {
                reps: Math.max(0, parseIntSafe(state.reps, 0)),
                weight: state.weight == null ? null : Math.max(0, parseFloatSafe(state.weight, 0)),
                rpe: state.rpe != null && state.rpe !== '' ? clampRpe(state.rpe) : null,
                minutes,
                seconds,
                rest
            };
        };

        const emitChange = (config, state) => {
            if (typeof config.onChange === 'function') {
                config.onChange(buildPayload(state));
            }
        };

        const ACTIVE_CLASSES = ['routine-set-row-active', 'set-editor-highlight'];

        const close = () => {
            if (!active) {
                return;
            }
            const { row, nodes, config } = active;
            if (Array.isArray(nodes)) {
                nodes.forEach((node) => node?.remove?.());
            }
            if (row) {
                row.classList.remove(...ACTIVE_CLASSES);
            }
            document.removeEventListener('pointerdown', handleOutside);
            config?.onClose?.();
            active = null;
        };

        const inlineKeyboard = components.inlineKeyboard || components.createInlineKeyboard?.();

        const handleOutside = (event) => {
            if (!active) {
                return;
            }
            const target = event.target;
            const insideKeyboard = inlineKeyboard?.contains?.(target, event.composedPath?.());
            if (!container.contains(target) && !insideKeyboard) {
                close();
            }
        };

        const updateMoveButtons = () => {
            if (!active?.moveButtons) {
                return;
            }
            const { position, total } = active.order || { position: 1, total: 1 };
            active.moveButtons.forEach((button) => {
                if (button.dataset?.inlineMove === 'plus') {
                    button.disabled = position <= 1;
                }
                if (button.dataset?.inlineMove === 'minus') {
                    button.disabled = position >= total;
                }
            });
        };

        const detachNodes = () => {
            if (!active?.nodes) {
                return;
            }
            active.nodes.forEach((node) => node?.remove?.());
        };

        const attachNodes = () => {
            if (!active?.row || !active?.nodes || !container?.contains(active.row)) {
                return;
            }
            const [plusRow, minusRow, actionsRow] = active.nodes;
            if (plusRow) {
                container.insertBefore(plusRow, active.row);
            }
            if (minusRow) {
                if (active.row.nextSibling) {
                    container.insertBefore(minusRow, active.row.nextSibling);
                } else {
                    container.appendChild(minusRow);
                }
            }
            if (actionsRow) {
                const anchor = minusRow?.nextSibling ?? active.row.nextSibling;
                if (anchor) {
                    container.insertBefore(actionsRow, anchor);
                } else {
                    container.appendChild(actionsRow);
                }
            }
        };

        const updateActiveRow = (nextRow) => {
            if (!nextRow || nextRow === active?.row) {
                attachNodes();
                return;
            }
            if (active?.row) {
                active.row.classList.remove(...ACTIVE_CLASSES);
            }
            active.row = nextRow;
            active.row.classList.add(...ACTIVE_CLASSES);
            attachNodes();
        };

        const reposition = (row, order) => {
            if (!active) {
                return;
            }
            if (row instanceof HTMLElement) {
                updateActiveRow(row);
            } else {
                attachNodes();
            }
            if (order) {
                active.order = normalizeOrder({ ...(active.order || {}), ...order });
                updateMoveButtons();
            }
        };

        const handleMoveResult = (result, direction) => {
            if (!active) {
                return;
            }
            if (result?.row instanceof HTMLElement) {
                updateActiveRow(result.row);
            } else {
                attachNodes();
            }
            const baseOrder = active.order || { position: 1, total: 1 };
            const nextOrder = result?.order
                ? normalizeOrder({ ...baseOrder, ...result.order })
                : normalizeOrder({ ...baseOrder, position: baseOrder.position + (direction === 'up' ? -1 : 1) });
            active.order = nextOrder;
            updateMoveButtons();
        };

        const applyMove = async (direction) => {
            const onMove = active?.config?.onMove;
            if (typeof onMove !== 'function') {
                return;
            }
            detachNodes();
            try {
                const result = onMove(direction);
                if (result && typeof result.then === 'function') {
                    result
                        .then((payload) => handleMoveResult(payload, direction))
                        .catch((error) => {
                            close();
                            throw error;
                        });
                    return;
                }
                handleMoveResult(result, direction);
            } catch (error) {
                close();
                throw error;
            }
        };

        const adjustState = (state, field, delta, config) => {
            inlineKeyboard?.selectTarget?.();
            switch (field) {
                case 'reps': {
                    const current = Math.max(0, parseIntSafe(state.reps, 0));
                    state.reps = Math.max(0, current + delta);
                    break;
                }
                case 'weight': {
                    const current = Math.max(0, parseFloatSafe(state.weight, 0));
                    let next = current + delta;
                    if (next < 0) {
                        next = 0;
                    }
                    state.weight = Math.round(next * 100) / 100;
                    break;
                }
                case 'rpe': {
                    const base = state.rpe != null ? parseFloatSafe(state.rpe, null) : null;
                    const step = 0.5;
                    let next = base;
                    if (!Number.isFinite(next)) {
                        next = delta > 0 ? 5 : 10;
                    } else {
                        next += delta * step;
                    }
                    state.rpe = clampRpe(next);
                    break;
                }
                case 'minutes': {
                    const current = Math.max(0, parseIntSafe(state.minutes, 0));
                    state.minutes = Math.max(0, current + delta);
                    break;
                }
                case 'seconds': {
                    const currentMinutes = Math.max(0, parseIntSafe(state.minutes, 0));
                    const currentSeconds = Math.max(0, parseIntSafe(state.seconds, 0));
                    let total = currentMinutes * 60 + currentSeconds + delta;
                    if (total < 0) {
                        total = 0;
                    }
                    state.minutes = Math.floor(total / 60);
                    state.seconds = total % 60;
                    break;
                }
                default:
                    break;
            }
            emitChange(config, state);
        };

        const createStepperButton = (label, onClick, disabled = false, aria) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn ghost inline-set-editor-button';
            button.textContent = label;
            if (aria) {
                button.setAttribute('aria-label', aria);
            }
            button.disabled = Boolean(disabled);
            button.addEventListener('click', (event) => {
                event.preventDefault();
                onClick?.();
            });
            return button;
        };

        const buildStepperRow = (type, state, config, order, moveButtons) => {
            const row = document.createElement('div');
            row.className = `exec-grid routine-set-grid inline-set-editor-row inline-set-editor-${type}`;
            if (container?.closest?.('#screenExecEdit')) {
                row.classList.add('routine-set-grid--with-meta');
            }
            const delta = type === 'plus' ? 1 : -1;
            const secondsDelta = type === 'plus' ? 10 : -10;

            const repsBtn = createStepperButton(
                type === 'plus' ? '+1' : '−1',
                () => adjustState(state, 'reps', delta, config),
                false,
                `${type === 'plus' ? 'Augmenter' : 'Diminuer'} les répétitions`
            );
            repsBtn.classList.add('inline-set-editor-reps');
            const weightBtn = createStepperButton(
                type === 'plus' ? '+1' : '−1',
                () => adjustState(state, 'weight', delta, config),
                false,
                `${type === 'plus' ? 'Augmenter' : 'Diminuer'} le poids`
            );
            weightBtn.classList.add('inline-set-editor-weight');
            const rpeBtn = createStepperButton(
                type === 'plus' ? '+1' : '−1',
                () => adjustState(state, 'rpe', delta, config),
                false,
                `${type === 'plus' ? 'Augmenter' : 'Diminuer'} le RPE`
            );
            rpeBtn.classList.add('inline-set-editor-rpe');
            const secondsBtn = createStepperButton(
                type === 'plus' ? '+10s' : '−10s',
                () => adjustState(state, 'seconds', secondsDelta, config),
                false,
                `${type === 'plus' ? 'Augmenter' : 'Diminuer'} le repos (10 secondes)`
            );
            secondsBtn.classList.add('inline-set-editor-rest');
            row.append(repsBtn, weightBtn, rpeBtn, secondsBtn);
            return row;
        };

        const open = (row, options = {}) => {
            if (!row) {
                return;
            }
            close();
            const config = { ...options };
            const state = normalizeValues(config.values || {});
            const order = normalizeOrder(config.order || { position: 1, total: 1 });
            active = { row, config, state, order, nodes: [], moveButtons: [] };
            row.classList.add(...ACTIVE_CLASSES);
            config.onOpen?.();

            const plusRow = buildStepperRow('plus', state, config, order, active.moveButtons);
            const minusRow = buildStepperRow('minus', state, config, order, active.moveButtons);
            active.nodes = [plusRow, minusRow].filter(Boolean);
            attachNodes();
            updateMoveButtons();
            emitChange(config, state);
            document.addEventListener('pointerdown', handleOutside);
        };

        return { open, close, isOpen: () => Boolean(active), reposition };
    };
})();
