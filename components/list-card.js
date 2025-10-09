(() => {
    const A = (window.App = window.App || {});
    const components = (A.components = A.components || {});

    const CLASS_CARD = 'list-card';
    const CLASS_ROW = 'list-card__row';
    const CLASS_START = 'list-card__start';
    const CLASS_BODY = 'list-card__body';
    const CLASS_END = 'list-card__end';
    const CLASS_HANDLE = 'list-card__handle';
    const CLASS_GRIP = 'list-card__grip';
    const CLASS_GRIP_DOT = 'list-card__grip-dot';
    const CLASS_ICON = 'list-card__icon';

    function applyClassList(element, classes) {
        if (!element || !classes) {
            return;
        }
        if (Array.isArray(classes)) {
            classes.filter(Boolean).forEach((className) => element.classList.add(className));
            return;
        }
        if (typeof classes === 'string' && classes.trim()) {
            element.classList.add(...classes.trim().split(/\s+/));
        }
    }

    function createStructure(options = {}) {
        const {
            clickable = false,
            cardClass,
            rowClass,
            startClass,
            bodyClass,
            endClass,
            role,
            labelledBy,
            describedBy
        } = options;

        const card = document.createElement('article');
        card.className = 'exercise-card ' + CLASS_CARD;
        if (clickable) {
            card.classList.add('clickable');
        }
        applyClassList(card, cardClass);
        if (role) {
            card.setAttribute('role', role);
        }
        if (labelledBy) {
            card.setAttribute('aria-labelledby', labelledBy);
        }
        if (describedBy) {
            card.setAttribute('aria-describedby', describedBy);
        }

        const row = document.createElement('div');
        row.className = 'exercise-card-row ' + CLASS_ROW;
        applyClassList(row, rowClass);

        const start = document.createElement('div');
        start.className = 'exercise-card-left ' + CLASS_START;
        applyClassList(start, startClass);

        const body = document.createElement('div');
        body.className = 'exercise-card-text ' + CLASS_BODY;
        applyClassList(body, bodyClass);
        start.appendChild(body);

        const end = document.createElement('div');
        end.className = 'exercise-card-right ' + CLASS_END;
        applyClassList(end, endClass);

        row.append(start, end);
        card.appendChild(row);

        return { card, row, start, body, end };
    }

    function createHandle(options = {}) {
        const { interactive = false, ariaLabel, className } = options;
        const element = document.createElement(interactive ? 'button' : 'div');
        element.className = CLASS_HANDLE;
        applyClassList(element, className);
        if (interactive) {
            element.type = 'button';
            if (ariaLabel) {
                element.setAttribute('aria-label', ariaLabel);
            }
        } else {
            element.setAttribute('aria-hidden', 'true');
        }

        const grip = document.createElement('span');
        grip.className = CLASS_GRIP;
        for (let index = 0; index < 3; index += 1) {
            const dot = document.createElement('span');
            dot.className = CLASS_GRIP_DOT;
            grip.appendChild(dot);
        }
        element.appendChild(grip);
        return element;
    }

    function createIcon(symbol, options = {}) {
        const { ariaHidden = true, className } = options;
        const icon = document.createElement('span');
        icon.className = CLASS_ICON;
        applyClassList(icon, className);
        if (ariaHidden) {
            icon.setAttribute('aria-hidden', 'true');
        }
        icon.textContent = symbol;
        return icon;
    }

    components.listCard = {
        createStructure,
        createHandle,
        createIcon
    };
})();
