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
            const current = SetEditor.#parseInt(input.value, null);
            let base = current;
            if (!Number.isFinite(base)) {
                base = delta > 0 ? 5 : 10;
            } else {
                base += delta;
            }
            const next = Math.max(5, Math.min(10, base));
            input.value = String(next);
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
            const rpeValue = SetEditor.#parseInt(values.rpe, null);
            refs.rpeInput.value = Number.isFinite(rpeValue) ? String(Math.max(5, Math.min(10, rpeValue))) : '';
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
            const rpeValue = String(rpeRaw).trim() === '' ? null : SetEditor.#parseInt(rpeRaw, null);
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
})();
