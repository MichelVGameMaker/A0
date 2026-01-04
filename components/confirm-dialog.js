(() => {
    const A = (window.App = window.App || {});
    const components = (A.components = A.components || {});

    const refs = {
        dialog: null,
        title: null,
        message: null,
        confirmActions: null,
        okActions: null
    };
    let refsResolved = false;
    let currentMode = 'confirm';

    function ensureRefs() {
        if (refsResolved) {
            return refs;
        }
        refs.dialog = document.getElementById('dlgConfirm');
        if (!refs.dialog) {
            throw new Error('confirmDialog: élément #dlgConfirm introuvable.');
        }
        refs.title = refs.dialog.querySelector('[data-role="confirm-title"]');
        refs.message = refs.dialog.querySelector('[data-role="confirm-message"]');
        refs.confirmActions = refs.dialog.querySelector('[data-role="confirm-actions"]');
        refs.okActions = refs.dialog.querySelector('[data-role="ok-actions"]');
        refs.dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            closeWith('cancel');
        });
        refs.dialog.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeWith('cancel');
            }
        });
        refs.dialog.addEventListener('click', (event) => {
            const action = event.target?.dataset?.action;
            if (!action) {
                return;
            }
            event.preventDefault();
            closeWith(action);
        });
        refsResolved = true;
        return refs;
    }

    function closeWith(action) {
        if (!refs.dialog?.open) {
            return;
        }
        if (currentMode === 'ok') {
            refs.dialog.close('ok');
            return;
        }
        if (action === 'confirm') {
            refs.dialog.close('confirm');
            return;
        }
        refs.dialog.close('cancel');
    }

    function setMode(mode) {
        currentMode = mode === 'ok' ? 'ok' : 'confirm';
        if (refs.confirmActions) {
            refs.confirmActions.hidden = currentMode !== 'confirm';
        }
        if (refs.okActions) {
            refs.okActions.hidden = currentMode !== 'ok';
        }
    }

    function updateContent({ title, message }) {
        if (refs.title) {
            refs.title.textContent = title || 'Confirmation';
        }
        if (refs.message) {
            refs.message.textContent = message || '';
        }
    }

    function updateLabels({ confirmLabel, cancelLabel, okLabel }) {
        const confirmButton = refs.confirmActions?.querySelector('[data-action="confirm"]');
        const cancelButton = refs.confirmActions?.querySelector('[data-action="cancel"]');
        const okButton = refs.okActions?.querySelector('[data-action="ok"]');
        if (confirmButton) {
            confirmButton.textContent = confirmLabel || 'confirmer';
        }
        if (cancelButton) {
            cancelButton.textContent = cancelLabel || 'annuler';
        }
        if (okButton) {
            okButton.textContent = okLabel || 'ok';
        }
    }

    function openDialog(options = {}) {
        ensureRefs();
        const {
            title,
            message,
            mode,
            confirmLabel,
            cancelLabel,
            okLabel
        } = options;
        if (refs.dialog.open) {
            refs.dialog.close('cancel');
        }
        setMode(mode);
        updateContent({ title, message });
        updateLabels({ confirmLabel, cancelLabel, okLabel });
        return new Promise((resolve) => {
            const onClose = () => {
                refs.dialog.removeEventListener('close', onClose);
                resolve(refs.dialog.returnValue || 'cancel');
            };
            refs.dialog.addEventListener('close', onClose);
            refs.dialog.showModal();
        });
    }

    async function confirm(options = {}) {
        const result = await openDialog({ ...options, mode: 'confirm' });
        return result === 'confirm';
    }

    async function alert(options = {}) {
        await openDialog({ ...options, mode: 'ok' });
        return true;
    }

    components.confirmDialog = {
        confirm,
        alert
    };
})();
