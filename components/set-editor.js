(() => {
    const A = (window.App = window.App || {});
    const components = (A.components = A.components || {});

    class SetEditor {
        static #refs = null;
        static #active = null;

        static open(options = {}) {
            const refs = SetEditor.#ensureRefs();
            if (refs.dialog.open) {
                SetEditor.close();
            }
            return new Promise((resolve) => {
                SetEditor.#active = { resolve, options };
                SetEditor.#applyOptions(options);
                window.setTimeout(() => {
                    refs.dialog.showModal();
                    SetEditor.#focusField(options.focus);
                }, 0);
            });
        }

        static close() {
            const refs = SetEditor.#refs;
            if (refs?.dialog?.open) {
                refs.dialog.close('close');
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
            const refs = {
                dialog,
                form,
                title,
                repsInput,
                weightInput,
                rpeInput,
                minutesInput,
                secondsInput,
                closeButton
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
                refs.dialog.close('submit');
            });
            refs.closeButton?.addEventListener('click', (event) => {
                event.preventDefault();
                refs.dialog.close('close');
            });
            refs.dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                refs.dialog.close('cancel');
            });
            refs.dialog.addEventListener('close', () => {
                SetEditor.#handleClose();
            });
            refs.form?.addEventListener('click', (event) => {
                const action = event.target?.dataset?.action;
                if (!action) {
                    return;
                }
                if (action === 'close') {
                    event.preventDefault();
                    refs.dialog.close('close');
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
                input?.addEventListener('focus', SetEditor.#selectOnFocus);
            });
            refs.minutesInput?.addEventListener('change', () => SetEditor.#sanitizeTimeInputs());
            refs.minutesInput?.addEventListener('blur', () => SetEditor.#sanitizeTimeInputs());
            refs.secondsInput?.addEventListener('change', () => SetEditor.#sanitizeTimeInputs());
            refs.secondsInput?.addEventListener('blur', () => SetEditor.#sanitizeTimeInputs());
        }

        static #selectOnFocus(event) {
            const target = event.currentTarget;
            if (target?.select) {
                target.select();
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
                default:
                    return false;
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
        }

        static #adjustMinutes(delta) {
            const input = SetEditor.#refs?.minutesInput;
            if (!input) {
                return;
            }
            const current = SetEditor.#parseInt(input.value, 0);
            const next = Math.max(0, current + delta);
            input.value = String(next);
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

        static #applyOptions(options) {
            const refs = SetEditor.#refs;
            if (!refs) {
                return;
            }
            const { title = 'Série', values = {} } = options;
            refs.title.textContent = title;
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

        static #collectValues() {
            const refs = SetEditor.#refs;
            if (!refs) {
                return null;
            }
            SetEditor.#sanitizeTimeInputs();
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

        static #handleClose() {
            if (!SetEditor.#active) {
                return;
            }
            const { resolve } = SetEditor.#active;
            SetEditor.#active = null;
            const values = SetEditor.#collectValues();
            resolve(values);
        }
    }

    components.SetEditor = SetEditor;
})();
