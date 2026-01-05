(() => {
    const A = (window.App = window.App || {});
    const components = (A.components = A.components || {});

    const refs = {
        dialog: null,
        title: null,
        message: null,
        status: null,
        confirmActions: null,
        confirmButton: null,
        cancelButton: null
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
        refs.status = refs.dialog.querySelector('[data-role="confirm-status"]');
        refs.confirmActions = refs.dialog.querySelector('[data-role="confirm-actions"]');
        refs.confirmButton = refs.confirmActions?.querySelector('[data-action="confirm"]');
        refs.cancelButton = refs.confirmActions?.querySelector('[data-action="cancel"]');
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
        if (action === 'confirm') {
            refs.dialog.close('confirm');
            return;
        }
        refs.dialog.close('cancel');
    }

    function setMode(mode) {
        currentMode = mode === 'confirm-only' ? 'confirm-only' : 'confirm';
        if (refs.cancelButton) {
            refs.cancelButton.hidden = currentMode === 'confirm-only';
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

    function updateLabels({ confirmLabel, cancelLabel }) {
        if (refs.confirmButton) {
            refs.confirmButton.textContent = confirmLabel || 'confirmer';
        }
        if (refs.cancelButton) {
            refs.cancelButton.textContent = cancelLabel || 'annuler';
        }
    }

    function updateVariant(variant) {
        const allowed = ['info', 'alert', 'error'];
        const safeVariant = allowed.includes(variant) ? variant : 'info';
        refs.dialog?.classList.remove('confirm-dialog--info', 'confirm-dialog--alert', 'confirm-dialog--error');
        refs.dialog?.classList.add(`confirm-dialog--${safeVariant}`);
        if (!refs.status) {
            return;
        }
        if (safeVariant === 'alert') {
            refs.status.textContent = 'Alerte';
            refs.status.hidden = false;
        } else if (safeVariant === 'error') {
            refs.status.textContent = 'Erreur';
            refs.status.hidden = false;
        } else {
            refs.status.textContent = '';
            refs.status.hidden = true;
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
            variant
        } = options;
        if (refs.dialog.open) {
            refs.dialog.close('cancel');
        }
        setMode(mode);
        updateContent({ title, message });
        updateLabels({ confirmLabel, cancelLabel });
        updateVariant(variant);
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
        await openDialog({ ...options, mode: 'confirm-only' });
        return true;
    }

    components.confirmDialog = {
        confirm,
        alert
    };
})();
