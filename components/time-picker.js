(() => {
    const existing = window.App || {};
    const components = existing.components || {};

    class TimePicker {
        constructor(options = {}) {
            this.value = this.#sanitize(options.value ?? null);
            this.onChange = typeof options.onChange === 'function' ? options.onChange : null;
            this.label = options.label || 'Durée';
            this.maxMinutes = Number.isFinite(options.maxMinutes) ? Math.max(0, Math.floor(options.maxMinutes)) : 59;
            this.defaultValue = this.#sanitize(
                options.defaultValue ?? existing.preferences?.getDefaultTimerDuration?.() ?? 0
            );
            this.container = document.createElement('div');
            this.container.className = 'time-picker';
            this.button = document.createElement('button');
            this.button.type = 'button';
            this.button.className = 'input time-picker-input';
            this.button.setAttribute('aria-haspopup', 'dialog');
            this.button.addEventListener('click', () => this.open());
            this.container.appendChild(this.button);
            this.dialog = null;
            this.dialogRefs = null;
            this.#updateDisplay();
        }

        get element() {
            return this.container;
        }

        get valueSeconds() {
            return this.value;
        }

        setValue(seconds, notify = false) {
            this.value = this.#sanitize(seconds);
            this.#updateDisplay();
            if (notify && this.onChange) {
                this.onChange(this.value);
            }
        }

        open() {
            const shared = this.#ensureDialog();
            if (!shared?.dialog) {
                return;
            }

            const totalSeconds = this.value ?? this.defaultValue ?? 0;
            const currentMinutes = Math.floor(totalSeconds / 60);
            const currentSeconds = Math.max(0, Math.round(totalSeconds - currentMinutes * 60));
            const minutesValue = Math.min(currentMinutes, this.maxMinutes);
            const secondsValue = Math.min(currentSeconds, 59);

            if (shared.label) {
                shared.label.textContent = this.label;
            }
            if (shared.minutesInput) {
                shared.minutesInput.value = String(minutesValue);
                shared.minutesInput.setAttribute('max', String(this.maxMinutes));
            }
            if (shared.secondsInput) {
                shared.secondsInput.value = String(secondsValue);
                shared.secondsInput.setAttribute('max', '59');
            }

            TimePicker.#sanitizeInputValue(shared.minutesInput, this.maxMinutes);
            TimePicker.#sanitizeInputValue(shared.secondsInput, 59);

            TimePicker.#activeInstance = this;
            shared.dialog.returnValue = '';
            shared.dialog.showModal();

            window.requestAnimationFrame(() => {
                shared.minutesInput?.focus();
                shared.minutesInput?.select?.();
            });
        }

        #ensureDialog() {
            if (this.dialogRefs) {
                return this.dialogRefs;
            }
            const refs = TimePicker.#ensureSharedDialog();
            this.dialog = refs.dialog;
            this.dialogRefs = refs;
            return refs;
        }

        #applySelection() {
            const refs = this.dialogRefs || TimePicker.#ensureSharedDialog();
            const minutes = TimePicker.#sanitizeInputValue(refs.minutesInput, this.maxMinutes);
            const seconds = TimePicker.#sanitizeInputValue(refs.secondsInput, 59);
            const total = minutes * 60 + seconds;
            this.setValue(total, true);
        }

        #sanitize(value) {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const number = Number(value);
            if (!Number.isFinite(number) || number < 0) {
                return null;
            }
            return Math.round(number);
        }

        #updateDisplay() {
            const value = this.value;
            const hasValue = Number.isFinite(value) && value !== null;
            const displayValue = hasValue ? TimePicker.format(value) : '--:--';
            this.button.textContent = displayValue;
            if (hasValue) {
                this.button.classList.add('has-value');
            } else {
                this.button.classList.remove('has-value');
            }
        }

        static format(totalSeconds) {
            const seconds = Math.max(0, Number.isFinite(totalSeconds) ? Math.round(totalSeconds) : 0);
            const minutesPart = Math.floor(seconds / 60)
                .toString()
                .padStart(2, '0');
            const secondsPart = (seconds % 60).toString().padStart(2, '0');
            return `${minutesPart}:${secondsPart}`;
        }

        static #ensureSharedDialog() {
            if (this.#sharedDialog) {
                return this.#sharedDialog;
            }

            const dialog = document.getElementById('dlgTimePicker');
            if (!dialog) {
                throw new Error('TimePicker: élément #dlgTimePicker introuvable.');
            }

            const refs = {
                dialog,
                form: dialog.querySelector('[data-role="timepicker-form"]') || dialog.querySelector('form'),
                label: dialog.querySelector('[data-role="timepicker-label"]'),
                minutesInput: dialog.querySelector('[data-role="minutes"]'),
                secondsInput: dialog.querySelector('[data-role="seconds"]'),
                minutesPlus: dialog.querySelector('[data-action="minutes-plus"]'),
                minutesMinus: dialog.querySelector('[data-action="minutes-minus"]'),
                secondsPlus: dialog.querySelector('[data-action="seconds-plus"]'),
                secondsMinus: dialog.querySelector('[data-action="seconds-minus"]'),
                cancelButton: dialog.querySelector('[data-action="cancel"]'),
                confirmButton: dialog.querySelector('[data-action="confirm"]')
            };

            refs.form?.addEventListener('submit', (event) => {
                event.preventDefault();
                refs.dialog.close('confirm');
            });

            refs.cancelButton?.addEventListener('click', (event) => {
                event.preventDefault();
                refs.dialog.close('cancel');
            });

            refs.confirmButton?.addEventListener('click', (event) => {
                event.preventDefault();
                refs.dialog.close('confirm');
            });

            refs.dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                refs.dialog.close('cancel');
            });

            refs.dialog.addEventListener('close', () => {
                const active = TimePicker.#activeInstance;
                if (!active) {
                    return;
                }
                if (refs.dialog.returnValue === 'confirm') {
                    active.#applySelection();
                }
                window.requestAnimationFrame(() => {
                    active.button?.focus();
                });
                TimePicker.#activeInstance = null;
            });

            refs.minutesPlus?.addEventListener('click', () => {
                const max = TimePicker.#activeInstance?.maxMinutes ?? 59;
                TimePicker.#adjustInput(refs.minutesInput, 1, max);
            });
            refs.minutesMinus?.addEventListener('click', () => {
                const max = TimePicker.#activeInstance?.maxMinutes ?? 59;
                TimePicker.#adjustInput(refs.minutesInput, -1, max);
            });
            refs.secondsPlus?.addEventListener('click', () => {
                TimePicker.#adjustInput(refs.secondsInput, 10, 59);
            });
            refs.secondsMinus?.addEventListener('click', () => {
                TimePicker.#adjustInput(refs.secondsInput, -10, 59);
            });

            refs.minutesInput?.addEventListener('input', () => {
                const max = TimePicker.#activeInstance?.maxMinutes ?? 59;
                TimePicker.#sanitizeInputValue(refs.minutesInput, max);
            });
            refs.secondsInput?.addEventListener('input', () => {
                TimePicker.#sanitizeInputValue(refs.secondsInput, 59);
            });

            refs.minutesInput?.addEventListener('focus', TimePicker.#selectInputOnFocus);
            refs.secondsInput?.addEventListener('focus', TimePicker.#selectInputOnFocus);

            this.#sharedDialog = refs;
            return refs;
        }

        static #sanitizeInputValue(input, max) {
            if (!input) {
                return 0;
            }
            const numeric = Number.parseInt(input.value ?? '0', 10);
            const safe = Number.isFinite(numeric) ? numeric : 0;
            const clamped = Math.max(0, Math.min(max, safe));
            if (String(clamped) !== input.value) {
                input.value = String(clamped);
            }
            return clamped;
        }

        static #adjustInput(input, delta, max) {
            if (!input) {
                return 0;
            }
            const numeric = Number.parseInt(input.value ?? '0', 10);
            const safe = Number.isFinite(numeric) ? numeric : 0;
            const next = Math.max(0, Math.min(max, safe + delta));
            input.value = String(next);
            return next;
        }

        static #selectInputOnFocus(event) {
            const target = event?.target;
            if (!target?.select) {
                return;
            }
            window.requestAnimationFrame(() => {
                target.select();
            });
        }

        static #sharedDialog = null;
        static #activeInstance = null;
    }

    components.TimePicker = TimePicker;
    existing.components = components;
    window.App = existing;
})();
