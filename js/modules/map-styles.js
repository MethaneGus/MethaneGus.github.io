import { SVGNS, DEGREE_TO_RADIAN } from './constants.js';

export class MapMarkers {
    constructor(map, mapElement) {
        this.map = map;
        this.mapElement = mapElement;
        this.svg = document.createElementNS(SVGNS, 'svg');
        this.svg.setAttributeNS(null, 'class', 'svg');
        this.mapElement.appendChild(this.svg);

        this.defs = document.createElementNS(SVGNS, 'defs');
        this.defs.innerHTML =
            '<filter id="hypocenter-filter" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" /></filter>' +
            '<filter id="epicenter-filter" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="20" /></filter>';
        this.svg.appendChild(this.defs);

        this.interactive = mapElement.dataset.interactive === 'true'; // Pass interactive via constructor or check elsewhere? 
        // Better to pass interactive flag.
    }

    initialize(interactive) {
        this.interactive = interactive;

        this.wave1 = document.createElementNS(SVGNS, 'circle');
        this.wave1.setAttributeNS(null, 'class', interactive ? 'wave' : 'wave-bright');
        this.wave1.setAttributeNS(null, 'visibility', 'hidden');
        this.svg.appendChild(this.wave1);

        this.wave2 = document.createElementNS(SVGNS, 'circle');
        this.wave2.setAttributeNS(null, 'class', interactive ? 'wave' : 'wave-bright');
        this.wave2.setAttributeNS(null, 'visibility', 'hidden');
        this.svg.appendChild(this.wave2);

        this.hypocenterCircle = document.createElementNS(SVGNS, 'circle');
        this.hypocenterCircle.setAttributeNS(null, 'class', 'hypocenter');
        this.hypocenterCircle.setAttributeNS(null, 'r', 15);
        this.hypocenterCircle.setAttributeNS(null, 'filter', 'url(#hypocenter-filter)');
        this.hypocenterCircle.setAttributeNS(null, 'visibility', 'hidden');
        this.svg.appendChild(this.hypocenterCircle);

        this.leader = document.createElementNS(SVGNS, 'line');
        this.leader.setAttributeNS(null, 'class', 'leader');
        this.leader.setAttributeNS(null, 'visibility', 'hidden');
        this.svg.appendChild(this.leader);

        this.epicenterGroup = document.createElementNS(SVGNS, 'g');
        this.svg.appendChild(this.epicenterGroup);

        this.epicenterCircle = document.createElementNS(SVGNS, 'circle');
        this.epicenterCircle.setAttributeNS(null, 'class', 'epicenter');
        this.epicenterCircle.setAttributeNS(null, 'r', 30);
        this.epicenterCircle.setAttributeNS(null, 'filter', 'url(#epicenter-filter)');
        this.epicenterCircle.setAttributeNS(null, 'visibility', 'hidden');
        this.epicenterGroup.appendChild(this.epicenterCircle);

        // Define color scale here or pass it?
        // Assuming d3 is global
        this.colorScale = d3.scaleSequential([0, -500000], d3.interpolateSpectral);

        this.tooltip = document.createElement('div');
        Object.assign(this.tooltip, {
            className: 'tooltip hidden'
        });
        this.mapElement.appendChild(this.tooltip);
    }

    update(info, auto, params) {
        const viewport = this.map.__deck.getViewports()[0];
        const [ex, ey] = auto ?
            viewport.project([params.lng, params.lat]) :
            info.viewport.project(info.object.position.slice(0, 2));
        const [hx, hy] = auto ?
            viewport.project([params.lng, params.lat, -(params.depth || 0) * 1000]) :
            [info.x, info.y];
        const depth = auto ? -(params.depth || 0) * 1000 : info.object.position[2];

        this.wave1.setAttributeNS(null, 'cx', hx);
        this.wave1.setAttributeNS(null, 'cy', hy);
        this.wave1.setAttributeNS(null, 'visibility', 'visible');

        this.wave2.setAttributeNS(null, 'cx', hx);
        this.wave2.setAttributeNS(null, 'cy', hy);
        this.wave2.setAttributeNS(null, 'visibility', 'visible');

        this.hypocenterCircle.setAttributeNS(null, 'cx', hx);
        this.hypocenterCircle.setAttributeNS(null, 'cy', hy);
        this.hypocenterCircle.setAttributeNS(null, 'fill', this.colorScale(depth));
        this.hypocenterCircle.setAttributeNS(null, 'visibility', 'visible');

        this.leader.setAttributeNS(null, 'x1', hx);
        this.leader.setAttributeNS(null, 'y1', hy);
        this.leader.setAttributeNS(null, 'x2', ex);
        this.leader.setAttributeNS(null, 'y2', ey);
        this.leader.setAttributeNS(null, 'visibility', 'visible');

        this.epicenterGroup.style.transform = `translate(${ex}px, ${ey}px)`;
        this.epicenterCircle.style.transform = `scale(1, ${Math.cos(this.map.getPitch() * DEGREE_TO_RADIAN)})`;
        this.epicenterCircle.setAttributeNS(null, 'visibility', 'visible');

        if (!auto) {
            this.tooltip.style.left = info.x + 4 + 'px';
            this.tooltip.style.top = info.y + 4 + 'px';
            this.tooltip.innerHTML = (-depth / 1000).toFixed(2) + 'km';
            this.tooltip.classList.remove('hidden');
        }
    }

    hide() {
        this.wave1.setAttributeNS(null, 'visibility', 'hidden');
        this.wave2.setAttributeNS(null, 'visibility', 'hidden');
        this.hypocenterCircle.setAttributeNS(null, 'visibility', 'hidden');
        this.leader.setAttributeNS(null, 'visibility', 'hidden');
        this.epicenterCircle.setAttributeNS(null, 'visibility', 'hidden');
        this.tooltip.classList.add('hidden');
    }

    animateWave(now) {
        this.wave1.setAttributeNS(null, 'r', now / 10 % 300);
        this.wave1.setAttributeNS(null, 'opacity', 1 - now / 3000 % 1);
        this.wave2.setAttributeNS(null, 'r', (now / 10 + 150) % 300);
        this.wave2.setAttributeNS(null, 'opacity', 1 - (now / 3000 + 0.5) % 1);
    }
}
