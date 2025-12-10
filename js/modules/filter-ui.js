export class FilterControl {
    constructor(options) {
        this._options = options || {};
        this._container = null;
        this._wrapper = null;
        this.onFilterChange = options.onFilterChange || (() => { });
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'filter-panel hidden';

        // Filter Header
        const header = document.createElement('div');
        header.className = 'filter-header';
        header.innerText = 'フィルター';
        this._container.appendChild(header);

        // Depth Slider
        this._createSlider('深さ (km)', 'depth', this._options.depthRange);

        // Intensity Checkbox
        this._createCheckbox('震度情報がある震源のみ表示', 'hasIntensity');

        // Close Button
        const closeBtn = document.createElement('div');
        closeBtn.className = 'close-button';
        closeBtn.onclick = () => {
            this._container.classList.add('hidden');
        };
        this._container.appendChild(closeBtn);

        // Append to map container (but absolute formatted)
        // Wait, mapbox controls are usually inside the map container but positioned by mapbox.
        // But for this panel, we probably want it to be like the info panel, an overlay.
        // However, map.addControl expects a specific structure.
        // If we want it to be a custom overlay managed by us, we can just append it to document body or map div separately.
        // But to be consistent with other panels (info-bg), let's make it a separate div outside mapbox controls if possible, 
        // OR make it a control that expands.
        // The implementation plan said "Filter button ... opens a filter panel".
        // The panel styles in CSS (like .info) suggest absolute positioning.
        // So this class might just manage the panel element, and we append it to map element manually?
        // Or we use a MapboxGLButtonControl to toggle it.

        // Let's create the panel element and return it? No, onAdd returns the control container.
        // If this is a Mapbox control, it will be in the top-right or wherever.
        // But we want a large panel.

        // Let's change strategy slightly:
        // FilterControl will be a simple manager that creates the DOM for the panel and appends it to the map container.
        // The "Button" to open it will be part of the standard MapboxGLButtonControl in ui.js.

        return this._container;
    }

    // Helper to create independent panel
    createPanel(mapElement) {
        this._wrapper = document.createElement('div');
        this._wrapper.className = 'bg filter-bg';
        this._wrapper.style.display = 'none';

        this._container = document.createElement('div');
        this._container.className = 'filter-panel';

        const header = document.createElement('div');
        header.className = 'filter-header';
        header.innerText = '絞り込み';
        this._container.appendChild(header);

        this._magContainer = null; // Removed
        this._depthContainer = this._createSlider(this._container, '深さ (km)', 'depth', this._options.depthRange);
        this._intensityContainer = this._createCheckbox(this._container, '震度情報がある震源のみ表示', 'hasIntensity');

        const closeBtn = document.createElement('div');
        closeBtn.className = 'close-button';
        closeBtn.addEventListener('click', () => {
            this.hide();
        });
        this._container.appendChild(closeBtn);

        this._wrapper.appendChild(this._container);

        // Click on background to close
        this._wrapper.addEventListener('click', (e) => {
            if (e.target === this._wrapper) {
                this.hide();
            }
        });

        mapElement.appendChild(this._wrapper);
        return this;
    }

    _createSlider(parent, label, id, range) {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-item';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'filter-label';
        labelDiv.innerText = `${label}: ${range.min} - ${range.max}`;
        wrapper.appendChild(labelDiv);

        const container = document.createElement('div');
        container.className = 'slider-container';

        // Simple range slider for now (min value)
        // For Mag: usually "Greater than X".
        // For Depth: usually range? Let's implement generalized Min/Max sliders if possible.
        // To keep it simple without external libs, let's use two inputs?
        // Let's stick to: 
        // Mag: Min slider.
        // Depth: Max slider.

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = range.min;
        slider.max = range.max;
        slider.step = id === 'mag' ? 0.1 : 10;
        slider.value = id === 'depth' ? range.max : range.min; // Default: show all (Min Mag = min, Max Depth = max)
        slider.className = 'filter-slider';

        slider.oninput = (e) => {
            const val = +e.target.value;
            if (id === 'mag') {
                labelDiv.innerText = `${label}: ${val} 以上`;
            } else {
                labelDiv.innerText = `${label}: ${val} 以下`;
            }
            this.onFilterChange({ [id]: val });
        };

        container.appendChild(slider);
        wrapper.appendChild(container);
        parent.appendChild(wrapper);

        // Set initial label text
        if (id === 'mag') {
            labelDiv.innerText = `${label}: ${slider.value} 以上`;
        } else {
            labelDiv.innerText = `${label}: ${slider.value} 以下`;
        }

        return wrapper;
    }

    _createCheckbox(parent, label, id) {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-item';

        const labelDiv = document.createElement('label');
        labelDiv.className = 'filter-label checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;
        checkbox.className = 'filter-checkbox';

        checkbox.onchange = (e) => {
            this.onFilterChange({ [id]: e.target.checked });
        };

        labelDiv.appendChild(checkbox);
        labelDiv.appendChild(document.createTextNode(` ${label}`));

        wrapper.appendChild(labelDiv);
        parent.appendChild(wrapper);

        return wrapper;
    }

    show() {
        if (this._wrapper) {
            this._wrapper.style.display = 'block';
        } else {
            this._container.classList.remove('hidden');
        }
    }

    hide() {
        if (this._wrapper) {
            this._wrapper.style.display = 'none';
        } else {
            this._container.classList.add('hidden');
        }
    }

    isVisible() {
        if (this._wrapper) {
            return this._wrapper.style.display !== 'none';
        }
        return !this._container.classList.contains('hidden');
    }
}
