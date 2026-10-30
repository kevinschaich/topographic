import { gpx, kml } from '@tmcw/togeojson'
import { strFromU8, unzipSync } from 'fflate'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { newMap, uid, type MapDoc, type MapFile } from './model'

// ---------- Reading files ----------

export type Parsed = { kind: 'layer'; name: string; data: FeatureCollection } | { kind: 'map'; map: MapDoc }

const xml = (text: string) => new DOMParser().parseFromString(text, 'text/xml')
const baseName = (n: string) => n.replace(/\.[^.]+$/, '')

/** GeoJSON (any of Feature, FeatureCollection or bare geometry) → FeatureCollection. */
export const asCollection = (j: unknown): FeatureCollection | null => {
    const o = j as { type?: string; features?: Feature[] }
    if (o?.type === 'FeatureCollection' && Array.isArray(o.features)) return o as FeatureCollection
    if (o?.type === 'Feature') return { type: 'FeatureCollection', features: [o as unknown as Feature] }
    if (o?.type && 'coordinates' in (o as object)) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: o as Geometry }] }
    if (o?.type === 'GeometryCollection') return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: o as unknown as Geometry }] }
    return null
}

/** A small CSV/TSV reader: quoted fields, escaped quotes, newlines inside quotes. */
export const parseCSV = (text: string): string[][] => {
    const delim = (text.split('\n')[0].match(/\t/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? '\t' : text.split('\n')[0].includes(';') && !text.split('\n')[0].includes(',') ? ';' : ','
    const rows: string[][] = []
    let row: string[] = []
    let f = ''
    let q = false
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (q) {
            if (c === '"' && text[i + 1] === '"') (f += '"'), i++
            else if (c === '"') q = false
            else f += c
        } else if (c === '"') q = true
        else if (c === delim) row.push(f), (f = '')
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++
            row.push(f)
            rows.push(row)
            row = []
            f = ''
        } else f += c
    }
    if (f || row.length) row.push(f), rows.push(row)
    return rows.filter((r) => r.some((x) => x.trim()))
}

const LAT = /^(lat|latitude|y|lat_dd|decimallatitude)$/i
const LON = /^(lon|lng|long|longitude|x|lon_dd|decimallongitude)$/i

export const csvToGeoJSON = (text: string): FeatureCollection => {
    const [head, ...rows] = parseCSV(text.replace(/^﻿/, ''))
    if (!head) throw new Error('That file is empty.')
    const names = head.map((h) => h.trim())
    const la = names.findIndex((h) => LAT.test(h))
    const lo = names.findIndex((h) => LON.test(h))
    if (la < 0 || lo < 0) throw new Error("Couldn't find latitude and longitude columns. Name them lat and lon.")
    const features: Feature[] = []
    for (const r of rows) {
        const lat = Number(r[la])
        const lon = Number(r[lo])
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
        const props: Record<string, unknown> = {}
        names.forEach((n, i) => {
            if (i === la || i === lo || !n) return
            const v = r[i]?.trim() ?? ''
            props[n] = v !== '' && Number.isFinite(Number(v)) && !/^0\d/.test(v) ? Number(v) : v
        })
        features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [lon, lat] } })
    }
    if (!features.length) throw new Error('No rows had a usable location.')
    return { type: 'FeatureCollection', features }
}

// togeojson leaves styling props (stroke, fill, styleUrl…) that mean nothing here.
const tidy = (fc: { features: { geometry: Geometry | null; properties: Record<string, unknown> | null; type: "Feature" }[] }): FeatureCollection => ({
    type: 'FeatureCollection',
    features: fc.features
        .filter((f): f is Feature => !!f.geometry)
        .map((f) => {
            const p = { ...(f.properties ?? {}) }
            for (const k of Object.keys(p)) if (/^(styleUrl|styleHash|styleMapHash|stroke.*|fill.*|icon.*|marker-.*|_gpxType|coordinateProperties|timespan|visibility)$/.test(k)) delete p[k]
            return { ...f, properties: p }
        }),
})

export async function readFile(file: File): Promise<Parsed> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const name = baseName(file.name)
    if (ext === 'kmz') {
        const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
        const k = Object.keys(files).find((n) => n.toLowerCase().endsWith('.kml'))
        if (!k) throw new Error("That KMZ doesn't contain a map.")
        return { kind: 'layer', name, data: tidy(kml(xml(strFromU8(files[k])))) }
    }
    const text = await file.text()
    if (ext === 'kml') return { kind: 'layer', name, data: tidy(kml(xml(text))) }
    if (ext === 'gpx') return { kind: 'layer', name, data: tidy(gpx(xml(text))) }
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return { kind: 'layer', name, data: csvToGeoJSON(text) }
    let j: unknown
    try {
        j = JSON.parse(text)
    } catch {
        throw new Error("That file isn't GeoJSON, CSV, GPX, KML or a saved map.")
    }
    const m = j as MapFile
    if (m?.topographic && m.map?.layers) return { kind: 'map', map: m.map }
    const fc = asCollection(j)
    if (!fc) throw new Error("That file isn't GeoJSON, CSV, GPX, KML or a saved map.")
    return { kind: 'layer', name, data: fc }
}

// ---------- Saved maps (IndexedDB) ----------

const DB = 'topographic'
const STORE = 'maps'
let dbp: Promise<IDBDatabase | null> | null = null
const memory = new Map<string, MapDoc>()

// Private windows and blocked storage can make IndexedDB fail or hang: fall back to memory after 2 s.
const open = () =>
    (dbp ??= new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 2000)
        try {
            const r = indexedDB.open(DB, 1)
            r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
            r.onsuccess = () => (clearTimeout(t), resolve(r.result))
            r.onerror = () => (clearTimeout(t), resolve(null))
        } catch {
            clearTimeout(t)
            resolve(null)
        }
    }))

const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
    const db = await open()
    if (!db) return undefined
    return new Promise((resolve) => {
        try {
            const t = db.transaction(STORE, mode)
            const r = fn(t.objectStore(STORE))
            t.oncomplete = () => resolve(r ? r.result : undefined)
            t.onerror = t.onabort = () => resolve(undefined)
        } catch {
            resolve(undefined)
        }
    })
}

export const store = {
    async list(): Promise<MapDoc[]> {
        const all = ((await tx('readonly', (s) => s.getAll())) as MapDoc[] | undefined) ?? [...memory.values()]
        return all.sort((a, b) => b.updated - a.updated)
    },
    async put(map: MapDoc) {
        memory.set(map.id, map)
        await tx('readwrite', (s) => void s.put(map))
    },
    async remove(id: string) {
        memory.delete(id)
        await tx('readwrite', (s) => void s.delete(id))
    },
}

export const lastOpened = {
    get: () => {
        try {
            return localStorage.getItem('topographic:last')
        } catch {
            return null
        }
    },
    set: (id: string) => {
        try {
            localStorage.setItem('topographic:last', id)
        } catch {}
    },
}

// ---------- Examples ----------

export const EXAMPLES = [
    'cities',
    'world',
    'paris',
    'f1-circuits',
    'vancouver-blocks',
    'ski-runs',
    'time-zones',
    'buildings',
    'county-unemployment',
    'nyc-census',
    'dog-friendly-national-parks',
] as const
/** The map shown when nothing is saved yet. Not saved until it's edited. */
const DEFAULT_EXAMPLE = 'nyc-census'

export const fetchExample = async (slug: string): Promise<MapDoc> => {
    const r = await fetch(`examples/${slug}.json`)
    if (!r.ok) throw new Error('example')
    return ((await r.json()) as MapFile).map
}

/** A fresh copy with new ids, so it can be saved alongside the original. */
export const copyOf = (m: MapDoc, name = m.name): MapDoc => ({ ...structuredClone(m), id: uid(), name, updated: Date.now() })


/** The map shown when nothing is saved: the default example, as an unsaved copy. */
export const defaultMap = async () => {
    try {
        return copyOf(await fetchExample(DEFAULT_EXAMPLE))
    } catch {
        return newMap()
    }
}
