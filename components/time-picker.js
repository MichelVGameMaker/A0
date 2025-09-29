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
            const dialog = this.#ensureDialog();
            const totalSeconds = this.value ?? this.defaultValue ?? 0;
            const currentMinutes = Math.floor(totalSeconds / 60);
            const currentSeconds = Math.max(0, Math.round(totalSeconds - currentMinutes * 60));
            this.minuteSelect.value = String(Math.min(currentMinutes, this.maxMinutes));
            this.secondSelect.value = String(Math.min(currentSeconds, 59));
            dialog.showModal();
        }

        #ensureDialog() {
            if (this.dialog) {
                return this.dialog;
            }
            const dialog = document.createElement('dialog');
            dialog.className = 'time-picker-dialog';

            const form = document.createElement('form');
            form.method = 'dialog';
            form.className = 'time-picker-form';

            const title = document.createElement('div');
            title.className = 'time-picker-title';
            title.textContent = this.label;
            form.appendChild(title);

            const wheels = document.createElement('div');
            wheels.className = 'time-picker-wheels';

            const minutesWrap = document.createElement('label');
            minutesWrap.className = 'time-picker-wheel';
            minutesWrap.textContent = 'Minutes';
            const minuteSelect = document.createElement('select');
            minuteSelect.size = 5;
            minuteSelect.className = 'time-picker-select';
            for (let minute = 0; minute <= this.maxMinutes; minute += 1) {
                const option = document.createElement('option');
                option.value = String(minute);
                option.textContent = minute.toString().padStart(2, '0');
                minuteSelect.appendChild(option);
            }
            minutesWrap.appendChild(minuteSelect);

            const secondsWrap = document.createElement('label');
            secondsWrap.className = 'time-picker-wheel';
            secondsWrap.textContent = 'Secondes';
            const secondSelect = document.createElement('select');
            secondSelect.size = 5;
            secondSelect.className = 'time-picker-select';
            for (let second = 0; second < 60; second += 1) {
                const option = document.createElement('option');
                option.value = String(second);
                option.textContent = second.toString().padStart(2, '0');
                secondSelect.appendChild(option);
            }
            secondsWrap.appendChild(secondSelect);

            wheels.append(minutesWrap, secondsWrap);
            form.appendChild(wheels);

            const actions = document.createElement('div');
            actions.className = 'time-picker-actions';
            const cancelButton = document.createElement('button');
            cancelButton.type = 'submit';
            cancelButton.value = 'cancel';
            cancelButton.className = 'btn ghost';
            cancelButton.textContent = 'Annuler';
            const okButton = document.createElement('button');
            okButton.type = 'submit';
            okButton.value = 'confirm';
            okButton.className = 'btn primary';
            okButton.textContent = 'Valider';
            actions.append(cancelButton, okButton);
            form.appendChild(actions);

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const submitter = event.submitter;
                if (submitter?.value === 'confirm') {
                    dialog.close('confirm');
                } else {
                    dialog.close('cancel');
                }
            });

            dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                dialog.close('cancel');
            });

            dialog.addEventListener('close', () => {
                if (dialog.returnValue === 'confirm') {
                    const selectedMinutes = Number.parseInt(this.minuteSelect.value, 10) || 0;
                    const selectedSeconds = Number.parseInt(this.secondSelect.value, 10) || 0;
                    const total = selectedMinutes * 60 + selectedSeconds;
                    this.setValue(total, true);
                }
                this.button.focus();
            });

            document.body.appendChild(dialog);
            this.dialog = dialog;
            this.minuteSelect = minuteSelect;
            this.secondSelect = secondSelect;
            return dialog;
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
    }

    components.TimePicker = TimePicker;
    existing.components = components;
    window.App = existing;
})();
