(() => {
    const A = (window.App = window.App || {});

    class TagGroup {
        /**
         * @param {HTMLElement} container
         * @param {{ mode?: 'mono'|'multi', columns?: number, items?: string[]|Iterable<string>, onChange?: (values: string[]) => void }} [options]
         */
        constructor(container, options = {}) {
            if (!container) {
                throw new Error('TagGroup requires a valid container element');
            }
            this.container = container;
            this.mode = options.mode === 'mono' ? 'mono' : 'multi';
            this.columns = Math.max(1, Number.parseInt(options.columns ?? 1, 10) || 1);
            this.onChange = typeof options.onChange === 'function' ? options.onChange : null;
            this.items = [];
            this.tagElements = new Map();
            this.selection = new Set();

            this.handleClick = this.handleClick.bind(this);
            this.container.addEventListener('click', this.handleClick);
            this.container.classList.add('tags');
            this.container.dataset.tagMode = this.mode;
            this.setColumns(this.columns);

            if (options.items) {
                this.setItems(options.items);
            }
        }

        /**
         * Définit les éléments du groupe.
         * @param {Iterable<string>} items
         */
        setItems(items) {
            this.items = Array.from(items || []).map((value) => String(value));
            this.render();
        }

        /**
         * Met à jour le nombre de colonnes.
         * @param {number} columns
         */
        setColumns(columns) {
            const value = Math.max(1, Number.parseInt(columns, 10) || 1);
            this.columns = value;
            this.container.style.setProperty('--tag-columns', String(value));
        }

        /**
         * Sélectionne les valeurs données.
         * @param {string|string[]|null|undefined} values
         */
        setSelection(values) {
            this.selection.clear();
            if (values == null) {
                this.updateSelectionState();
                return;
            }
            const arr = Array.isArray(values) ? values : [values];
            arr.forEach((value) => {
                const key = String(value);
                if (this.items.includes(key)) {
                    this.selection.add(key);
                }
            });
            if (this.mode === 'mono' && this.selection.size > 1) {
                const first = this.selection.values().next().value;
                this.selection.clear();
                if (first != null) {
                    this.selection.add(first);
                }
            }
            this.updateSelectionState();
        }

        clearSelection() {
            this.selection.clear();
            this.updateSelectionState();
        }

        /**
         * Retourne la sélection courante.
         * @returns {string[]}
         */
        getSelection() {
            return Array.from(this.selection);
        }

        render() {
            const validItems = new Set(this.items);
            this.selection.forEach((value) => {
                if (!validItems.has(value)) {
                    this.selection.delete(value);
                }
            });
            this.container.innerHTML = '';
            this.container.dataset.tagMode = this.mode;
            this.container.style.setProperty('--tag-columns', String(this.columns));
            this.tagElements.clear();
            this.items.forEach((value) => {
                const key = String(value);
                const tag = document.createElement('button');
                tag.type = 'button';
                tag.className = 'tag';
                tag.textContent = key;
                tag.title = key;
                tag.dataset.value = key;
                tag.setAttribute('aria-pressed', this.selection.has(key) ? 'true' : 'false');
                this.container.appendChild(tag);
                this.tagElements.set(key, tag);
            });
            this.updateSelectionState();
        }

        handleClick(event) {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) {
                return;
            }
            const tag = target.closest('.tag');
            if (!tag || !this.container.contains(tag)) {
                return;
            }
            const value = tag.dataset.value;
            if (!value) {
                return;
            }
            if (this.mode === 'mono') {
                if (this.selection.has(value)) {
                    this.selection.delete(value);
                } else {
                    this.selection.clear();
                    this.selection.add(value);
                }
            } else if (this.selection.has(value)) {
                this.selection.delete(value);
            } else {
                this.selection.add(value);
            }
            this.updateSelectionState();
            if (this.onChange) {
                this.onChange(this.getSelection());
            }
        }

        updateSelectionState() {
            this.tagElements.forEach((element, value) => {
                const isSelected = this.selection.has(value);
                element.classList.toggle('selected', isSelected);
                element.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            });
        }
    }

    A.TagGroup = TagGroup;
})();
