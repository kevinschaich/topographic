// Builds the example maps into public/examples/ (not committed; runs before every build).
// World data is Natural Earth (public domain); "A day in Paris" is drawn by hand here; the rest are datasets in data/examples/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import type { MapDoc, MapFile } from '../src/model'

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
const get = async (name: string) => {
    const r = await fetch(NE + name + '.geojson')
    if (!r.ok) throw new Error(`${name}: ${r.status}`)
    return (await r.json()) as FeatureCollection
}

// Three decimals (~100 m) is plenty at world scale and keeps the files small.
const round = (c: unknown): unknown => (typeof (c as number[])[0] === 'number' ? (c as number[]).map((x) => Math.round(x * 1000) / 1000) : (c as unknown[]).map(round))
const trim = (g: Geometry): Geometry => ({ ...g, coordinates: round((g as { coordinates: Position }).coordinates) }) as Geometry

let n = 0
const fc = (features: Feature[]): FeatureCollection => ({
    type: 'FeatureCollection',
    features: features.map((f) => ({ ...f, properties: { _id: `f${++n}`, ...f.properties } })),
})
const pt = (name: string, lon: number, lat: number, props: Record<string, unknown>): Feature => ({
    type: 'Feature',
    properties: { name, ...props },
    geometry: { type: 'Point', coordinates: [lon, lat] },
})

const [places, countries, rivers] = await Promise.all([
    get('ne_110m_populated_places_simple'),
    get('ne_110m_admin_0_countries'),
    get('ne_110m_rivers_lake_centerlines'),
])

const cities: MapDoc = {
    id: 'example-cities',
    name: 'Big cities of the world',
    basemap: 'dark',
    updated: 0,
    view: { center: [10, 25], zoom: 1.4 },
    layers: [
        {
            id: 'cities',
            name: 'Cities',
            style: { mode: 'ramp', color: '#fafafa', by: 'population', ramp: ['#38bdf8', '#f43f5e'], size: 5, opacity: 0.9, label: 'name' },
            data: fc(
                places.features
                    .map((f) => {
                        const p = f.properties!
                        return {
                            type: 'Feature' as const,
                            properties: { name: p.name, country: p.adm0name, population: p.pop_max, capital: p.adm0cap ? 'Yes' : 'No' },
                            geometry: trim(f.geometry),
                        }
                    })
                    .sort((a, b) => b.properties.population - a.properties.population),
            ),
        },
    ],
}

const CONTINENTS: Record<string, string> = {
    Africa: '#f59e0b',
    Asia: '#ef4444',
    Europe: '#3b82f6',
    'North America': '#22c55e',
    'South America': '#a855f7',
    Oceania: '#14b8a6',
    Antarctica: '#a1a1aa',
    'Seven seas (open ocean)': '#71717a',
}
const world: MapDoc = {
    id: 'example-world',
    name: 'Continents and great rivers',
    basemap: 'none',
    updated: 0,
    view: { center: [10, 20], zoom: 1.2 },
    layers: [
        {
            id: 'rivers',
            name: 'Rivers',
            style: { mode: 'single', color: '#7dd3fc', size: 2, opacity: 0.9, label: 'name' },
            data: fc(rivers.features.map((f) => ({ type: 'Feature', properties: { name: f.properties!.name }, geometry: trim(f.geometry) }))),
        },
        {
            id: 'countries',
            name: 'Countries',
            style: { mode: 'category', color: '#a1a1aa', by: 'continent', categories: CONTINENTS, size: 1, opacity: 0.45 },
            data: fc(
                countries.features.map((f) => {
                    const p = f.properties!
                    return {
                        type: 'Feature',
                        properties: { name: p.NAME, continent: p.CONTINENT, population: p.POP_EST, economy: String(p.ECONOMY).replace(/^\d+\.\s*/, '') },
                        geometry: trim(f.geometry),
                    }
                }),
            ),
        },
    ],
}

const STOPS: Record<string, string> = { Landmark: '#f59e0b', Museum: '#38bdf8', Church: '#f472b6' }
const paris: MapDoc = {
    id: 'example-paris',
    name: 'A day in Paris',
    basemap: 'streets',
    updated: 0,
    view: { center: [2.322, 48.862], zoom: 12.6 },
    layers: [
        {
            id: 'stops',
            name: 'Places to see',
            style: { mode: 'category', color: '#fafafa', by: 'kind', categories: STOPS, size: 7, opacity: 1, label: 'name' },
            data: fc([
                pt('Eiffel Tower', 2.2945, 48.8584, { kind: 'Landmark', when: 'Morning' }),
                pt('Arc de Triomphe', 2.295, 48.8738, { kind: 'Landmark', when: 'Late morning' }),
                pt('Musée du Louvre', 2.3376, 48.8606, { kind: 'Museum', when: 'Afternoon' }),
                pt("Musée d'Orsay", 2.3266, 48.86, { kind: 'Museum', when: 'Rainy day' }),
                pt('Notre-Dame', 2.3499, 48.853, { kind: 'Church', when: 'Evening' }),
                pt('Sainte-Chapelle', 2.345, 48.8554, { kind: 'Church', when: 'Evening' }),
                pt('Sacré-Cœur', 2.3431, 48.8867, { kind: 'Church', when: 'Sunset' }),
                pt('Centre Pompidou', 2.3522, 48.8606, { kind: 'Museum', when: 'Rainy day' }),
                pt('Panthéon', 2.3464, 48.8462, { kind: 'Landmark', when: 'Afternoon' }),
            ]),
        },
        {
            id: 'walk',
            name: 'Afternoon walk',
            style: { mode: 'single', color: '#fafafa', size: 4, opacity: 0.9 },
            data: fc([
                {
                    type: 'Feature',
                    properties: { name: 'Arc de Triomphe to Notre-Dame', distance: 'About 5 km' },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [2.295, 48.8738],
                            [2.3022, 48.8698],
                            [2.3095, 48.8676],
                            [2.3212, 48.8656],
                            [2.3275, 48.8635],
                            [2.3364, 48.8611],
                            [2.3413, 48.8572],
                            [2.3465, 48.8541],
                            [2.3499, 48.853],
                        ],
                    },
                },
            ]),
        },
        {
            id: 'parks',
            name: 'Gardens',
            style: { mode: 'single', color: '#4ade80', size: 1.5, opacity: 0.35, label: 'name' },
            data: fc([
                {
                    type: 'Feature',
                    properties: { name: 'Jardin du Luxembourg' },
                    geometry: { type: 'Polygon', coordinates: [[[2.332, 48.8487], [2.3405, 48.8483], [2.3412, 48.8445], [2.336, 48.8432], [2.3318, 48.8452], [2.332, 48.8487]]] },
                },
                {
                    type: 'Feature',
                    properties: { name: 'Jardin des Tuileries' },
                    geometry: { type: 'Polygon', coordinates: [[[2.3218, 48.8657], [2.3329, 48.8622], [2.3317, 48.8605], [2.3207, 48.8641], [2.3218, 48.8657]]] },
                },
                {
                    type: 'Feature',
                    properties: { name: 'Champ de Mars' },
                    geometry: { type: 'Polygon', coordinates: [[[2.2946, 48.8578], [2.3009, 48.8537], [2.3036, 48.8556], [2.2973, 48.8597], [2.2946, 48.8578]]] },
                },
            ]),
        },
    ],
}

// Datasets from the old hosted topografik, committed as GeoJSON in data/examples/ (sources in data/ATTRIBUTION.md).
// Each keeps its saved style: a ramp over a number, or a color per category.
const local = (slug: string) => JSON.parse(readFileSync(`data/examples/${slug}.geojson`, 'utf8')) as FeatureCollection
const dataset = (slug: string, name: string, layer: string, style: MapDoc['layers'][number]['style'], basemap: MapDoc['basemap'] = 'dark', data = local(slug), view?: MapDoc['view']): MapDoc => ({
    id: `example-${slug}`,
    name,
    basemap,
    view,
    updated: 0,
    // Some datasets cross the antimeridian (Alaska's Aleutians), so they get a view instead of a fit.
    layers: [{ id: slug, name: layer, style, data: fc(data.features.filter((f) => f.geometry)) }],
})
const ramp = (by: string, colors: string[], size: number, opacity: number, label?: string) => ({ mode: 'ramp' as const, color: '#a1a1aa', by, ramp: colors, size, opacity, label })
// Nearest two-color versions of the saved palettes (low → high).
const INFERNO: [string, string] = ['#b73779', '#fcffa4']
const GREENS: [string, string] = ['#e5f5e0', '#00441b']
const CIVIDIS: [string, string] = ['#00224e', '#fee838']
const REDS: [string, string] = ['#fee0d2', '#a50f15']
const FIRE = ['#5c0a0a', '#dc2626', '#f97316', '#fde047']

const zones = local('time-zones')
const offsets = [...new Set(zones.features.map((f) => String(f.properties?.utc_name)))].sort((a, b) => {
    const n = (s: string) => { const m = s.match(/([+-])(\d+):(\d+)/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] + +m[3] / 60) : 0 }
    return n(a) - n(b)
})
const RAINBOW = ['#6e40aa', '#bf3caf', '#fe4b83', '#ff7847', '#e2b72f', '#aff05b', '#52f667', '#1ddfa3', '#23abd8', '#4c6edb']

const parks = local('dog-friendly-national-parks')
const datasets: MapDoc[] = [
    dataset('f1-circuits', 'Formula 1 circuits', 'Circuits', ramp('firstgp', INFERNO, 3, 1, 'Name')),
    dataset('vancouver-blocks', 'Vancouver land value', 'City blocks', ramp('valuePerSqm', GREENS, 0.5, 0.75)),
    dataset('ski-runs', 'Ski runs around Zermatt', 'Runs', { mode: 'category', color: '#a1a1aa', by: 'difficulty', categories: { easy: '#6e40aa', intermediate: '#23abd8', advanced: '#aff05b' }, size: 2.5, opacity: 1, label: 'name' }, 'satellite'),
    dataset('time-zones', 'Time zones of the world', 'Time zones', { mode: 'category', color: '#a1a1aa', by: 'utc_name', categories: Object.fromEntries(offsets.map((o, i) => [o, RAINBOW[i % RAINBOW.length]])), size: 1, opacity: 0.45, label: 'utc_name' }, 'dark', zones),
    dataset('buildings', 'Prague buildings and trees', 'Buildings', ramp('distance_to_nearest_tree', CIVIDIS, 0.5, 0.85)),
    dataset('county-unemployment', 'US unemployment by county', 'Counties', ramp('unemployment_rate', REDS, 0.5, 0.8, 'NAME'), 'dark', undefined, { center: [-96, 38], zoom: 3.3 }),
    dataset('nyc-census', 'New York City population', 'Census tracts', ramp('Population', FIRE, 0.5, 0.8, 'ntaname')),
    dataset('dog-friendly-national-parks', 'Dog-friendly national parks', 'Parks', { mode: 'category', color: '#A1A1AA', by: 'policy', categories: { everywhere: '#7CB342', trails: '#0288D1', roads: '#F9A825', none: '#E65100', unverified: '#A1A1AA' }, size: 6, opacity: 1, label: 'name' }, 'dark', parks, { center: [-100, 47], zoom: 2.4 }),
]

mkdirSync('public/examples', { recursive: true })
for (const map of [cities, world, paris, ...datasets]) {
    const file: MapFile = { topographic: 1, map }
    writeFileSync(`public/examples/${map.id.replace('example-', '')}.json`, JSON.stringify(file))
}
console.log('examples written')
