export const isMobile = (mapElement) => mapElement.clientWidth < 640;

export const parseUrlParams = () => {
    const options = {};
    for (const key of ['e', 'lng', 'lat', 'd', 't', 'l', 's', 'm', 'id', 'static']) {
        const regex = new RegExp(`(?:\\?|&)${key}=(.*?)(?:&|$)`);
        const match = location.search.match(regex);
        options[key] = match ? decodeURIComponent(match[1]) : undefined;
    }
    return options;
};

export const getParams = (options) => ({
    eid: options.e,
    lng: +options.lng,
    lat: +options.lat,
    depth: isNaN(options.d) ? undefined : +options.d,
    time: options.t,
    location: options.l,
    intensity: options.s,
    magnitude: isNaN(options.m) ? undefined : +options.m,
    id: options.id
});
