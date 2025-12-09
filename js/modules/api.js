export async function fetchEarthquakeList(interactive) {
    const url = 'https://www.jma.go.jp/bosai/quake/data/list.json' + (interactive ? '' : `?t=${Date.now()}`);
    const res = await fetch(url);
    return res.json();
}

export async function fetchHypocenters() {
    const res = await fetch('data/hypocenters.json');
    return res.json();
}

export async function fetchEarthquakeDetails(id) {
    const res = await fetch(`https://api.nagi-p.com/eqdb/earthquakes/${id}`);
    return res.json();
}

export async function fetchIntensityData(url) {
    const res = await fetch(url);
    return res.json();
}
