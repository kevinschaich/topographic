import type { ColorBy, Basemap } from '@kevinschaich/components/map'
import type { Feature, FeatureCollection } from 'geojson'

export type ColorMode = 'single' | 'category' | 'ramp'

export type LayerStyle = {
    mode: ColorMode
    /** The single color, and the fallback for values a category/ramp doesn't cover. */
    color: string
    /** Property that drives the color in category/ramp mode. */
    by?: string
    categories?: Record<string, string>
    /** Low → high colors for ramp mode (two or more). */
    ramp?: string[]
    /** Point radius, line width or polygon outline width, in px. */
    size: number
    opacity: number
    /** Property shown as a label. */
    label?: string
}

export type MapLayer = { id: string; name: string; hidden?: boolean; style: LayerStyle; data: FeatureCollection }

export type MapDoc = {
    id: string
    name: string
    basemap: Basemap
    layers: MapLayer[]
    updated: number
    view?: { center: [number, number]; zoom: number }
}

/** A saved map file (also the example files). */
export type MapFile = { topographic: 1; map: MapDoc }

export const PALETTE = ['#f59e0b', '#38bdf8', '#f472b6', '#4ade80', '#a78bfa', '#f87171', '#2dd4bf', '#facc15', '#fb923c', '#818cf8', '#e879f9', '#a3e635']
/** Dark red → red → orange → yellow, readable on the dark basemap. */
export const FIRE = ['#5c0a0a', '#dc2626', '#f97316', '#fde047']
export const RAMPS: { label: string; colors: string[] }[] = [
    { label: 'Fire', colors: FIRE },
    { label: 'Ice to fire', colors: ['#38bdf8', '#f43f5e'] },
    { label: 'Sunrise', colors: ['#fde68a', '#dc2626'] },
    { label: 'Forest', colors: ['#d9f99d', '#15803d'] },
    { label: 'Ocean', colors: ['#bae6fd', '#1e3a8a'] },
    { label: 'Mono', colors: ['#3f3f46', '#fafafa'] },
]

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Every feature gets a stable `_id` so it can be selected and edited. */
export const withIds = (fc: FeatureCollection): FeatureCollection => ({
    type: 'FeatureCollection',
    features: fc.features.filter((f) => f && f.geometry).map((f) => ({ ...f, properties: { _id: uid(), ...(f.properties ?? {}) } })),
})

export const propertyNames = (fc: FeatureCollection) => {
    const seen = new Set<string>()
    for (const f of fc.features.slice(0, 2000)) for (const k of Object.keys(f.properties ?? {})) if (k !== '_id') seen.add(k)
    return [...seen]
}

export const values = (fc: FeatureCollection, prop: string) => fc.features.map((f) => f.properties?.[prop]).filter((v) => v !== undefined && v !== null && v !== '')

export const numericRange = (fc: FeatureCollection, prop: string): [number, number] | null => {
    const nums = values(fc, prop).map(Number).filter(Number.isFinite)
    if (!nums.length) return null
    return [Math.min(...nums), Math.max(...nums)]
}

export const isNumeric = (fc: FeatureCollection, prop: string) => {
    const v = values(fc, prop)
    return v.length > 0 && v.every((x) => x !== '' && Number.isFinite(Number(x)))
}

/** Up to 12 categories, most common first, with palette colors (keeping any already chosen). */
export const categoriesFor = (fc: FeatureCollection, prop: string, keep: Record<string, string> = {}) => {
    const counts = new Map<string, number>()
    for (const v of values(fc, prop)) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    return Object.fromEntries(top.map(([v], i) => [v, keep[v] ?? PALETTE[i % PALETTE.length]]))
}

const mix = (a: string, b: string) => {
    const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    const [x, y] = [p(a), p(b)]
    return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, '0')).join('')
}

export const colorBy = (s: LayerStyle, fc: FeatureCollection): ColorBy => {
    if (s.mode === 'category' && s.by && s.categories) return { property: s.by, colors: s.categories, fallback: s.color }
    if (s.mode === 'ramp' && s.by) {
        const colors = s.ramp?.length && s.ramp.length >= 2 ? s.ramp : RAMPS[0].colors
        const nums = values(fc, s.by).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
        if (!nums.length) return s.color
        // Two colors: the median gets the middle color, so a few huge values don't wash everything else out.
        // More colors: each sits at an even quantile.
        const ramp = colors.length === 2 ? [colors[0], mix(colors[0], colors[1]), colors[1]] : colors
        const stops: [number, string][] = []
        ramp.forEach((c, i) => {
            const v = nums[Math.round((i / (ramp.length - 1)) * (nums.length - 1))]
            if (!stops.length || v > stops[stops.length - 1][0]) stops.push([v, c])
        })
        return stops.length > 1 ? { property: s.by, stops, fallback: s.color } : s.color
    }
    return s.color
}

export type Kinds = { points: number; lines: number; polygons: number }
export const kinds = (fc: FeatureCollection): Kinds => {
    const k = { points: 0, lines: 0, polygons: 0 }
    for (const f of fc.features) {
        const t = f.geometry?.type ?? ''
        if (t.endsWith('Point')) k.points++
        else if (t.endsWith('LineString')) k.lines++
        else if (t.endsWith('Polygon')) k.polygons++
    }
    return k
}

export const newLayer = (name: string, data: FeatureCollection, index: number): MapLayer => {
    const k = kinds(data)
    const size = k.points >= k.lines && k.points >= k.polygons ? 6 : k.lines >= k.polygons ? 3 : 1.5
    const props = propertyNames(data)
    const label = props.find((p) => /^(name|title|label)$/i.test(p))
    return {
        id: uid(),
        name,
        style: { mode: 'single', color: PALETTE[index % PALETTE.length], size, opacity: k.polygons > k.points + k.lines ? 0.35 : 0.9, label },
        data: withIds(data),
    }
}

export const newMap = (name = 'Untitled map'): MapDoc => ({ id: uid(), name, basemap: 'dark', layers: [], updated: Date.now() })

export const exportGeoJSON = (layer: MapLayer): FeatureCollection => ({
    type: 'FeatureCollection',
    features: layer.data.features.map((f): Feature => {
        const { _id, ...rest } = f.properties ?? {}
        void _id
        return { ...f, properties: rest }
    }),
})

export const download = (name: string, text: string, type = 'application/json') => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fileName = (name: string) => name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'map'
