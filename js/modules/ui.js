import { DATE_FORMAT, TIME_FORMAT } from './constants.js';

export class MapboxGLButtonControl {

    constructor(optionArray) {
        this._options = optionArray.map(options => ({
            className: options.className || '',
            title: options.title || '',
            eventHandler: options.eventHandler
        }));
    }

    onAdd(map) {
        const me = this;

        me._map = map;

        me._container = document.createElement('div');
        me._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        me._buttons = me._options.map(options => {
            const button = document.createElement('button'),
                icon = document.createElement('span'),
                { className, title, eventHandler } = options;

            button.className = className;
            button.type = 'button';
            button.title = title;
            button.setAttribute('aria-label', title);
            button.onclick = eventHandler;

            icon.className = 'mapboxgl-ctrl-icon';
            icon.setAttribute('aria-hidden', true);
            button.appendChild(icon);

            me._container.appendChild(button);

            return button;
        });

        return me._container;
    }

    onRemove() {
        const me = this;

        me._container.parentNode.removeChild(me._container);
        me._map = undefined;
    }

}

export function populateRecentList(quakes, eids, initialParams, container, onSelect) {
    for (const quake of quakes) {
        if (quake.ttl !== '震源・震度情報' && quake.ttl !== '遠地地震に関する情報') {
            continue;
        }
        if (eids[quake.eid]) {
            continue;
        }
        const options = {};
        const matches = quake.cod.match(/([+-][\d\.]+)([+-][\d\.]+)([+-]\d+)?/);
        options.e = quake.eid;
        options.lng = +matches[2];
        options.lat = +matches[1];
        if (matches[3] && matches[3] !== '') {
            options.d = Math.abs(+matches[3] / 1000);
        }
        options.l = quake.anm;
        options.t = quake.at;
        if (quake.mag !== 'Ｍ不明') {
            options.m = quake.mag;
        }
        if (quake.maxi !== '') {
            options.s = quake.maxi;
        }
        eids[quake.eid] = quake;

        const dateString = new Date(options.t).toLocaleDateString('ja-JP', DATE_FORMAT);
        const timeString = new Date(options.t).toLocaleTimeString('ja-JP', TIME_FORMAT);
        const intensityString = options.s ? '震度' + options.s.replace('-', '弱').replace('+', '強') : '';
        const magnitudeString = isNaN(options.m) ? '不明' : options.m;

        const listItem = document.createElement('div');
        Object.assign(listItem, {
            id: quake.eid,
            className: quake.eid === initialParams.eid ? 'menu-item active' : 'menu-item',
            innerHTML: `<div class="menu-check"></div><div class="menu-text">${dateString} ${timeString}<br>${options.l} M${magnitudeString} <span class="intensity-label-${options.s}">${intensityString}</span></div>`
        });
        listItem.addEventListener('click', () => {
            const activeListItem = container.querySelector('.menu-item.active');
            if (activeListItem) {
                if (activeListItem === listItem) {
                    return;
                }
                activeListItem.classList.remove('active');
            }
            listItem.classList.add('active');
            onSelect(options);
        });
        container.appendChild(listItem);
    }
}

export function populateHistoricalList(historicalEarthquakes, activeId, container, onSelect) {
    for (const item of historicalEarthquakes) {
        const dateString = new Date(item.t).toLocaleDateString('ja-JP', DATE_FORMAT);
        const timeString = new Date(item.t).toLocaleTimeString('ja-JP', TIME_FORMAT);
        const intensityString = item.s ? '震度' + item.s.replace('-', '弱').replace('+', '強') : '';

        const listItem = document.createElement('div');
        Object.assign(listItem, {
            id: item.id,
            className: item.id === activeId ? 'menu-item active' : 'menu-item',
            innerHTML: `<div class="menu-check"></div><div class="menu-text">${dateString} ${timeString}<br>${item.l} M${item.m} <span class="intensity-label-${item.s}">${intensityString}</span><br><span class="earthquake-name">${item.n}</span></div>`
        });
        listItem.addEventListener('click', () => {
            const activeListItem = container.querySelector('.menu-item.active');
            if (activeListItem) {
                if (activeListItem === listItem) {
                    return;
                }
                activeListItem.classList.remove('active');
            }
            listItem.classList.add('active');
            onSelect(item);
        });
        container.appendChild(listItem);
    }
}
