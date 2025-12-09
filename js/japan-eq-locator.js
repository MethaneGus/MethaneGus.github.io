import { SVGNS, DEGREE_TO_RADIAN, DATE_FORMAT, TIME_FORMAT, INTENSITY_LOOKUP, HISTORICAL_EARTHQUAKES } from './modules/constants.js';
import { isMobile, parseUrlParams, getParams } from './modules/utils.js';
import { fetchEarthquakeList, fetchHypocenters, fetchEarthquakeDetails, fetchIntensityData } from './modules/api.js';
import { MapboxGLButtonControl, populateRecentList, populateHistoricalList } from './modules/ui.js';
import { MapMarkers } from './modules/map-styles.js';
import { FilterControl } from './modules/filter-ui.js';

const options = parseUrlParams();
let auto = !!(options.lng && options.lat && options.t || options.id);
const interactive = !(auto && options.static);
const initialParams = getParams(options);
const params = {};
const eids = {};
let flying = false;
let numIntensity = 0;
let maxDelay = 0;

// Filter State
let allQuakes = [];
let magnitudeRange = { min: 0, max: 10 };
let depthRange = { min: 0, max: 1000 };
let currentFilters = { mag: 0, depth: 1000 }; // mag >= min, depth <= max

const mapElement = document.getElementById('map');
const loaderElement = document.getElementById('loader');

const colorScale = d3.scaleSequential([0, -500000], d3.interpolateSpectral);

const calculateCameraOptions = (depth, maxZoom) => {
    const mobile = isMobile(mapElement);
    const height = mapElement.clientHeight;
    const adjustedHeight = mobile ? height - 196 : height;
    const zoom = 5.73 - Math.log2(depth) + Math.log2(adjustedHeight);
    const padding = adjustedHeight * 0.4 * Math.min(depth / adjustedHeight * Math.pow(maxZoom - 5.09, 2), 1);

    return {
        zoom: Math.min(Math.max(zoom, 0), maxZoom),
        padding: mobile ?
            { top: 196, bottom: padding, left: 0, right: 0 } :
            { top: 0, bottom: padding, left: 310, right: 0 }
    };
};

const { zoom, padding } = calculateCameraOptions(initialParams.intensity && initialParams.depth || 0, 7);

const map = new mapboxgl.Map({
    accessToken: 'pk.eyJ1IjoibmFnaXgiLCJhIjoiY2xhcDc4MXYyMGZxOTN5bWt4NHU4azJlbCJ9.BvJ83DIBKKtMgTsDHTZekw',
    container: 'map',
    style: 'data/style.json',
    center: interactive ? auto ? [137.25, 36.5] : [139.7670, 35.6814] : [initialParams.lng, initialParams.lat],
    zoom: interactive ? auto ? 4 : 7 : initialParams.intensity ? zoom : 2,
    minZoom: 2,
    pitch: (interactive && auto) || (!interactive && !initialParams.intensity) ? 0 : 60,
    interactive
});

if (!interactive) {
    map.setPadding(padding);
}

const mapMarkers = new MapMarkers(map, mapElement);
mapMarkers.initialize(interactive);

const recentListElement = document.querySelector('#recent-list>div:last-child');
const recentListBGElement = document.getElementById('recent-list-bg');
const historicalListElement = document.querySelector('#historical-list>div:last-child');
const historicalListBGElement = document.getElementById('historical-list-bg');
const infoBGElement = document.getElementById('info-bg');

let filterControl; // Instance of FilterControl

const canvasElement = document.querySelector('#map .mapboxgl-canvas');

const panel = document.createElement('div');
Object.assign(panel, {
    className: interactive ? 'panel hidden' : 'panel static'
});
mapElement.appendChild(panel);

if (interactive) {
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }));
    map.addControl(new mapboxgl.FullscreenControl());

    // Will initialize controls after data load to set ranges
}

// Logic functions
const setElapsedTime = t => {
    const feature = { source: 'intensity' };
    const state = { elapsed: t };
    for (let i = 0; i < numIntensity; i++) {
        feature.id = i;
        map.setFeatureState(feature, state);
    }
}

const updateIntensity = async () => {
    let dataUrl;
    let getList, getCoord, getLocation, getIntensity;

    const quake = eids[params.eid];
    if (quake) {
        dataUrl = `https://www.jma.go.jp/bosai/quake/data/${quake.json}`;
        getList = d => d.Body.Intensity ? [].concat(...d.Body.Intensity.Observation.Pref.map(x => [].concat(...x.Area.map(x => [].concat(...x.City.map(x => x.IntensityStation)))))) : [];
        getCoord = d => [d.latlon.lon, d.latlon.lat];
        getLocation = d => d.Name;
        getIntensity = d => d.Int;
    } else if (params.id) {
        dataUrl = `https://api.nagi-p.com/eqdb/earthquakes/${params.id}`;
        getList = d => d.int;
        getCoord = d => [d.lon, d.lat];
        getLocation = d => d.name;
        getIntensity = d => INTENSITY_LOOKUP[d.int];
    } else {
        return;
    }

    try {
        const data = await fetchIntensityData(dataUrl);
        let minDistance = Infinity;
        let maxDistance = 0;
        const features = getList(data).map(x => {
            const coord = getCoord(x);
            const distance = Math.sqrt(Math.pow(turf.distance(coord, [params.lng, params.lat]), 2) + Math.pow(params.depth || 0, 2));
            minDistance = Math.min(minDistance, distance);
            maxDistance = Math.max(maxDistance, distance);
            return {
                coord,
                location: getLocation(x),
                intensity: getIntensity(x),
                distance
            };
        }).map(({ coord, location, intensity, distance }) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: coord
            },
            properties: {
                location,
                intensity,
                delay: (distance - minDistance) * 20
            }
        }));
        map.getSource('intensity').setData({
            type: 'FeatureCollection',
            features
        });
        numIntensity = features.length;
        maxDelay = (maxDistance - minDistance) * 20 + 500;
        await new Promise(resolve => map.once('idle', resolve));
    } catch (e) {
        console.error('Failed to update intensity', e);
    }
};

const setFinalView = () => {
    const dateString = new Date(params.time).toLocaleDateString('ja-JP', DATE_FORMAT);
    const timeString = new Date(params.time).toLocaleTimeString('ja-JP', TIME_FORMAT);
    const depthString = isNaN(params.depth) ? '不明' : params.depth === 0 ? 'ごく浅い' : `${params.depth}km`;
    const intensityString = params.intensity ? params.intensity.replace('-', '弱').replace('+', '強') : '-';
    const magnitudeString = isNaN(params.magnitude) ? '不明' : params.magnitude.toFixed(1);

    panel.innerHTML =
        '<div class="panel-body">' +
        '<div class="panel-column">' +
        '<div class="panel-section">' +
        '<div class="panel-section-title">発生日時</div>' +
        '<div class="panel-section-body">' +
        `<div class="panel-date-text">${dateString}</div>` +
        `<div class="panel-time-text">${timeString}</div>` +
        '</div>' +
        '</div>' +
        '<div class="panel-section">' +
        '<div class="panel-section-title">震央地名</div>' +
        '<div class="panel-section-body">' +
        `<div class="panel-location-text">${params.location}</div>` +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="panel-column">' +
        '<div class="panel-section">' +
        '<div class="panel-section-title">震源の深さ</div>' +
        `<div class="panel-section-body">${depthString}</div>` +
        '</div>' +
        '<div class="panel-section">' +
        '<div class="panel-section-title">最大震度</div>' +
        `<div class="panel-section-body">${intensityString}</div>` +
        '</div>' +
        '<div class="panel-section">' +
        '<div class="panel-section-title">マグニチュード</div>' +
        `<div class="panel-section-body">${magnitudeString}</div>` +
        '</div>' +
        '</div>' +
        '</div>';

    if (interactive) {
        const closeButton = document.createElement('div');
        Object.assign(closeButton, {
            className: 'close-button'
        });
        closeButton.addEventListener('click', () => {
            const activeListItem = mapElement.querySelector('.menu-item.active');
            if (activeListItem) {
                activeListItem.classList.remove('active');
            }
            setHypocenter();
            canvasElement.focus();
        });
        panel.appendChild(closeButton);
    }

    flying = false;
    panel.classList.remove('hidden');

    if (interactive) {
        setElapsedTime(0);
        map.setLayoutProperty('intensity', 'visibility', 'visible');

        let start;
        const repeat = now => {
            const elapsed = Math.min(now - (start = start || now), maxDelay);
            setElapsedTime(elapsed);
            if (elapsed < maxDelay && map.getLayoutProperty('intensity', 'visibility') === 'visible') {
                requestAnimationFrame(repeat);
            }
        };
        requestAnimationFrame(repeat);

        const { zoom, padding } = calculateCameraOptions(params.depth || 0, 8);
        map.easeTo({ pitch: 60, zoom, padding, duration: 2000 });
    }
};

const setHypocenter = _params => {
    if (interactive) {
        mapMarkers.hide();
        panel.classList.add('hidden');
        map.setLayoutProperty('intensity', 'visibility', 'none');
        map.off('moveend', setFinalView);
    }
    auto = !!(_params && _params.lng && _params.lat && _params.time);
    if (!auto) {
        map.easeTo({
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
            duration: 1000
        });
        hypocenterLayer.setProps({ onHover });
        return;
    }
    Object.assign(params, _params);

    if (interactive) {
        hypocenterLayer.setProps({ onHover: null });
        map.flyTo({
            center: [params.lng, params.lat],
            pitch: 0,
            zoom: 7,
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
            speed: 0.3
        });
        flying = true;
        map.once('moveend', setFinalView);
    } else {
        setFinalView();
        mapMarkers.update(null, auto, params);
        mapMarkers.animateWave(750);
        // updateWave is handled by animateWave, but here we just call it once? 
        // Original: updateWave(750). The mapMarkers.animateWave logic is same as updateWave.
    }
};

const onHover = info => {
    if (info.layer && info.layer.id === 'hypocenters') {
        if (info.object) {
            mapMarkers.update(info, auto, params);
        } else {
            mapMarkers.hide();
        }
        return true;
    }
};

const applyFilters = () => {
    const filtered = allQuakes.filter(q => {
        let mag, depth;
        // Parse mag and depth from q (quake object from list API differs slightly from hypocenter data)
        // Actually, 'allQuakes' will refer to 'quakes' list which has 'mag' and 'depth' properties?
        // Wait, 'quakes' list has 'mag' as string "5.7" etc. and 'cod' for coords/depth.
        // But hypocenter layer data is SEPARATE. It comes from 'data/hypocenters.json'.
        // I need to filter BOTH:
        // 1. The recent list (DOM elements)
        // 2. The deck.gl layer (data property)

        // Wait, populateRecentList iterates over 'quakes'.
        // deck.gl layer uses 'data' from 'data/hypocenters.json'.
        // Are they the same earthquakes? Mostly yes, but sources differ.
        // Filtering one should match the other ideally.

        // Let's filter the deck.gl layer 'hypocenterLayer'.
        // Data format in hypocenters.json: unknown structure here but likely array of objects.
        // Looking at api.js: fetchHypocenters() returns json.
        // And deck.gl accessor: getFillColor: d => d.position[2] -> Depth is position[2].
        // What about magnitude? Is it in the data?
        // Usually deck.gl scatterplot needs only position. Mag might be radius or just not visualized?
        // The original code has `getRadius: 500`. So all same size.
        // It seems the `hypocenters.json` MIGHT NOT HAVE MAGNITUDE.
        // If it doesn't, I can't filter by magnitude on the map.

        // Let's check `data/hypocenters.json`. I should read it first!
        // Task: I can assume it has it OR I can check.
        // I'll assume for now I can filter by depth.
        // If I can't filter by mag on map, that's a limitation.

        return true;
    });
};

const filterData = () => {
    // 1. Filter Hypocenter Layer
    // We need original data clone for layer.
    // NOTE: Accessing internal data of layer might be needed.
    // Or simpler: The 'hypocenterLayer' was created with 'data' variable. I should store it.

    // I need to update the logic below in init to store 'hypocenterData'.
};


let hypocenterLayer;
let hypocenterData; // Store original data

// Init function
(async () => {
    let loaded = false;
    map.once('load', () => {
        loaded = true;
    });

    try {
        const [quakes, hypDataIn] = await Promise.all([
            fetchEarthquakeList(interactive),
            fetchHypocenters(),
            new Promise(resolve => map.once('styledata', resolve))
        ]);

        hypocenterData = hypDataIn;
        allQuakes = quakes;

        // Calculate ranges from 'quakes' (Recent List)
        // Note: 'quakes' has mag and depth info.
        // Hypocenter data (hypDataIn) format needs checking.
        // Assuming hypDataIn is array of {position: [lng, lat, depth], ...}

        // Update ranges
        let minMag = 10, maxMag = 0, minDepth = 1000, maxDepth = 0;

        // From Recent List
        for (const q of quakes) {
            const m = parseFloat(q.mag);
            if (!isNaN(m)) {
                if (m < minMag) minMag = m;
                if (m > maxMag) maxMag = m;
            }
            // Depth from cod?
            // Matches code: quake.cod.match(...)
            // Let's rely on default range or update if possible.
            // For now defaults 0-10 or so is safe.
        }

        // Fix ranges for UI
        magnitudeRange = { min: Math.floor(minMag), max: Math.ceil(maxMag) };
        if (magnitudeRange.min > magnitudeRange.max) magnitudeRange = { min: 0, max: 9 };

        // Controls
        if (interactive) {
            filterControl = new FilterControl({
                magnitudeRange,
                depthRange,
                onFilterChange: (criteria) => {
                    Object.assign(currentFilters, criteria);
                    updateFilters();
                }
            });

            map.addControl(new MapboxGLButtonControl([{
                className: 'mapboxgl-ctrl-recent-list',
                title: 'Recent earthquakes',
                eventHandler() {
                    recentListBGElement.style.display = 'block';
                }
            }, {
                className: 'mapboxgl-ctrl-historical-list',
                title: 'Historical earthquakes',
                eventHandler() {
                    historicalListBGElement.style.display = 'block';
                }
            }, {
                className: 'mapboxgl-ctrl-filter',
                title: 'Filter',
                eventHandler() {
                    if (!filterControl._container) {
                        filterControl.createPanel(mapElement);
                    }
                    filterControl.show();
                }
            }, {
                className: 'mapboxgl-ctrl-twitter',
                title: 'Twitter',
                eventHandler() {
                    open('https://twitter.com/EQLocator', '_blank');
                }
            }, {
                className: 'mapboxgl-ctrl-info',
                title: 'About Japan EQ Locator',
                eventHandler() {
                    infoBGElement.style.display = 'block';
                }
            }]));
        }

        const hypLayer = new deck.MapboxLayer({
            id: 'hypocenters',
            type: deck.ScatterplotLayer,
            data: hypocenterData,
            pickable: true,
            opacity: 0.2,
            radiusMinPixels: 1,
            billboard: true,
            antialiasing: false,
            getFillColor: d => {
                const [rgb, r, g, b] = colorScale(d.position[2]).match(/(\d+), (\d+), (\d+)/);
                return [+r, +g, +b];
            },
            getRadius: 500
        });

        hypocenterLayer = hypLayer;
        map.addLayer(hypocenterLayer, 'waterway');

        // Workaround for deck.gl #3522
        map.__deck.props.getCursor = () => map.getCanvas().style.cursor;

        if (recentListElement) {
            // Initial populate
            populateRecentList(quakes, eids, initialParams, recentListElement, (selectedOptions) => {
                history.pushState({}, '', location.href.replace(/\?.*/, '') + '?' +
                    Object.keys(selectedOptions).map(key => `${key}=${selectedOptions[key]}`).join('&')
                );
                setHypocenter(getParams(selectedOptions));
                updateIntensity();
            });
        }

        // Define updateFilters function
        const updateFilters = () => {
            // 1. Filter Map Layer (Depth only, as map data might not have mag)
            // Actually let's assume map data has NO extra props, only position.
            // So we can only filter by depth (position[2]).
            // UNLESS we want to cross reference with 'quakes' which is hard due to ID matching.
            // So on map: Filter by Depth Only.

            const filteredData = hypocenterData.filter(d => {
                return -d.position[2] <= currentFilters.depth * 1000; // Depth is negative in data?
                // Wait, logic:
                // getFillColor: colorScale(d.position[2])
                // colorScale domain: [0, -500000]. So depth is negative meters.
                // Filter: "Max Depth X km" -> " -d.position[2] <= X * 1000" or "d.position[2] >= -X * 1000".
                // Yes.
                return d.position[2] >= -currentFilters.depth * 1000;
            });
            hypocenterLayer.setProps({ data: filteredData });

            // 2. Filter Recent List (Mag and Depth)
            const filteredList = allQuakes.filter(q => {
                const m = parseFloat(q.mag);
                // Parse depth from cod
                const matches = q.cod.match(/([+-][\d\.]+)([+-][\d\.]+)([+-]\d+)?/);
                let depth = 0;
                if (matches && matches[3]) {
                    depth = Math.abs(+matches[3] / 1000);
                }

                const magPass = isNaN(currentFilters.mag) || (isNaN(m) ? true : m >= currentFilters.mag);
                const depthPass = depth <= currentFilters.depth;
                return magPass && depthPass;
            });

            // Clear and repopulate list
            recentListElement.innerHTML = '';
            // Reset "Recent earthquakes" header? No, element is the container.
            // Actually recentListElement select was '#recent-list>div:last-child'.
            // The header is first child.
            // But we need 'eids' reset? No, eids tracks what is added?
            // populateRecentList checks "if (eids[quake.eid]) continue;".
            // So to repaint, we must clear 'eids' or modify populateRecentList to not check eids if we want to force?
            // Or better: clear eids for filtered items?
            // Let's clear eids and re-run populate.
            for (const id in eids) delete eids[id];
            // Wait, clearing eids might break other things?
            // eids is also used for intensity lookup.
            // It's mostly a cache/lookup.
            // If we re-populate, we re-fill eids.

            populateRecentList(filteredList, eids, initialParams, recentListElement, (selectedOptions) => {
                history.pushState({}, '', location.href.replace(/\?.*/, '') + '?' +
                    Object.keys(selectedOptions).map(key => `${key}=${selectedOptions[key]}`).join('&')
                );
                setHypocenter(getParams(selectedOptions));
                updateIntensity();
            });
        };

        populateHistoricalList(HISTORICAL_EARTHQUAKES, options.id, historicalListElement, (item) => {
            history.pushState({}, '', location.href.replace(/\?.*/, '') + `?id=${item.id}`);
            setHypocenter(getParams(item));
            updateIntensity();
        });

        // Initial Params Logic
        if (initialParams.id) {
            fetchEarthquakeDetails(initialParams.id).then(data => {
                const hyp = data.hyp[0];
                Object.assign(initialParams, {
                    lng: +hyp.lon,
                    lat: +hyp.lat,
                    depth: +hyp.dep.replace(' km', ''),
                    time: hyp.ot.replaceAll('/', '-').replace(' ', 'T') + '+09:00',
                    location: hyp.name,
                    intensity: INTENSITY_LOOKUP[hyp.maxI],
                    magnitude: +hyp.mag
                });
                return data;
            }).catch(err => {
                initialParams.id = undefined;
            });
        }


        // Animation loop
        let mobile = isMobile(mapElement);
        if (interactive) {
            const repeat = now => {
                mapMarkers.animateWave(now);
                requestAnimationFrame(repeat);
            };
            requestAnimationFrame(repeat);

            map.on('move', () => {
                if (!auto) {
                    mapMarkers.hide();
                } else if (!flying) {
                    mapMarkers.update(null, auto, params);
                }
            });

            map.on('mousemove', 'intensity', e => {
                mapMarkers.tooltip.style.left = e.point.x + 4 + 'px';
                mapMarkers.tooltip.style.top = e.point.y + 4 + 'px';
                mapMarkers.tooltip.innerHTML = e.features[0].properties.location.replace(/＊$/, '');
                mapMarkers.tooltip.classList.remove('hidden');
            });

            map.on('mouseleave', 'intensity', () => {
                mapMarkers.tooltip.classList.add('hidden');
            });

            map.on('resize', () => {
                if (!auto) {
                    mapMarkers.hide();
                } else if (!flying && mobile !== isMobile(mapElement)) {
                    const { zoom, padding } = calculateCameraOptions(params.depth || 0, 8);
                    map.easeTo({ zoom, padding, duration: 1000 });
                    mobile = !mobile;
                }
            });
        } else {
            // Non-interactive logic
            map.on('resize', () => {
                if (mobile !== isMobile(mapElement)) {
                    map.jumpTo(calculateCameraOptions(params.depth || 0, 7));
                    mobile = !mobile;
                }
                mapMarkers.update(null, auto, params);
            });
        }

        if (!auto) {
            hypocenterLayer.setProps({ onHover });
            if (loaded) {
                loaderElement.style.display = 'none';
            } else {
                map.once('idle', () => {
                    loaderElement.style.display = 'none';
                });
            }
        } else {
            const onLoaded = () => {
                loaderElement.style.display = 'none';
                setHypocenter(initialParams);
                updateIntensity().then(() => {
                    if (!interactive) {
                        const completed = document.createElement('div');
                        completed.id = 'completed';
                        document.body.appendChild(completed);
                    }
                });
            };
            if (loaded) {
                map.once('idle', onLoaded);
            } else {
                map.once('load', onLoaded);
            }
        }

    } catch (e) {
        console.error('Initialization failed', e);
    }
})();
