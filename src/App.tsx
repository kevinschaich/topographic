import { toast } from '@kevinschaich/components'
import { DrawTool, LineLayer, MapView, PointLayer, PolygonLayer, fitToFeatures, useMap, type DrawMode } from '@kevinschaich/components/map'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { FilterSpecification } from 'maplibre-gl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SOURCES } from './config'
import { FeaturePanel } from './FeaturePanel'
import { copyOf, defaultMap, lastOpened, readFile, store } from './io'
import { colorBy, newLayer, uid, type MapDoc, type MapLayer } from './model'
import { EditPanel } from './Panel'

export type Selected = { layer: string; id: string } | null

const GEOM: Record<'p' | 'l' | 'a', FilterSpecification> = {
    p: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
    l: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
    a: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
}

// What to open: the last map, or the default example. Memoized, since StrictMode runs effects twice in dev.
let booting: Promise<{ doc: MapDoc; saved: boolean; list: MapDoc[] }> | null = null
const boot = () =>
    (booting ??= (async () => {
        const list = await store.list()
        if (!list.length) return { doc: await defaultMap(), saved: false, list }
        return { doc: list.find((m) => m.id === lastOpened.get()) ?? list[0], saved: true, list }
    })())

export function App() {
    const [doc, setDoc] = useState<MapDoc | null>(null)
    // The default map isn't saved until it's edited.
    const [unsaved, setUnsaved] = useState(false)
    const [maps, setMaps] = useState<MapDoc[]>([])
    const [selected, setSelected] = useState<Selected>(null)
    const [active, setActive] = useState<string | null>(null)
    const [draw, setDraw] = useState<DrawMode | null>(null)
    const [dragging, setDragging] = useState(false)

    const refresh = useCallback(async () => setMaps(await store.list()), [])

    // Open the last map, or the default one.
    useEffect(() => {
        let live = true
        boot().then(({ doc, saved, list }) => {
            if (!live) return
            setUnsaved(!saved)
            setMaps(list)
            setDoc(doc)
        })
        return () => void (live = false)
    }, [])

    // Save edits (debounced).
    useEffect(() => {
        if (!doc || unsaved) return
        lastOpened.set(doc.id)
        const t = setTimeout(() => store.put(doc).then(refresh), 400)
        return () => clearTimeout(t)
    }, [doc, unsaved, refresh])

    const update = useCallback((fn: (d: MapDoc) => MapDoc) => {
        setUnsaved(false)
        setDoc((d) => (d ? { ...fn(d), updated: Date.now() } : d))
    }, [])
    const updateLayer = useCallback((id: string, fn: (l: MapLayer) => MapLayer) => update((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? fn(l) : l)) })), [update])

    const open = (m: MapDoc, saved = true) => {
        setSelected(null)
        setDraw(null)
        setActive(null)
        setUnsaved(!saved)
        setDoc(m)
    }

    const addFiles = async (files: FileList | File[]) => {
        if (!doc) return
        for (const file of Array.from(files)) {
            try {
                const parsed = await readFile(file)
                if (parsed.kind === 'map') {
                    const m = copyOf(parsed.map)
                    await store.put(m)
                    await refresh()
                    open(m)
                    toast.add({ title: `Opened "${m.name}"` })
                    continue
                }
                if (!parsed.data.features.length) throw new Error('That file has nothing to put on a map.')
                let made: MapLayer | null = null
                update((d) => {
                    made = newLayer(parsed.name, parsed.data, d.layers.length)
                    return { ...d, layers: [made, ...d.layers] }
                })
                setTimeout(() => made && setActive(made.id))
                pendingFit.current = parsed.data.features
                toast.add({ title: `Added "${parsed.name}"` })
            } catch (e) {
                toast.add({ title: `Couldn't add ${file.name}`, description: (e as Error).message })
            }
        }
    }
    const pendingFit = useRef<Feature[] | null>(null)

    // Drop files anywhere.
    useEffect(() => {
        const over = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return
            e.preventDefault()
            setDragging(true)
        }
        const leave = (e: DragEvent) => !e.relatedTarget && setDragging(false)
        const drop = (e: DragEvent) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
        }
        window.addEventListener('dragover', over)
        window.addEventListener('dragleave', leave)
        window.addEventListener('drop', drop)
        return () => {
            window.removeEventListener('dragover', over)
            window.removeEventListener('dragleave', leave)
            window.removeEventListener('drop', drop)
        }
    })

    const onDraw = (g: Geometry) => {
        if (!doc) return
        const fid = uid()
        const f: Feature = { type: 'Feature', properties: { _id: fid, name: '' }, geometry: g }
        const target = doc.layers.find((l) => l.id === active) ?? doc.layers[0]
        if (target) {
            updateLayer(target.id, (l) => ({ ...l, data: { ...l.data, features: [...l.data.features, f] } }))
            setSelected({ layer: target.id, id: fid })
        } else {
            const l = newLayer('My drawings', { type: 'FeatureCollection', features: [] }, 0)
            l.data.features.push(f)
            l.style.label = 'name'
            update((d) => ({ ...d, layers: [l, ...d.layers] }))
            setActive(l.id)
            setSelected({ layer: l.id, id: fid })
        }
        if (g.type !== 'Point') setDraw(null)
    }

    if (!doc) return null
    const selLayer = selected ? doc.layers.find((l) => l.id === selected.layer) : undefined
    const selFeature = selLayer?.data.features.find((f) => f.properties?._id === selected?.id)

    return (
        <MapView
            key={doc.id}
            center={doc.view?.center ?? [0, 20]}
            zoom={doc.view?.zoom ?? 1.5}
            hash={false}
            basemap={doc.basemap}
            onBasemapChange={(b) => update((d) => ({ ...d, basemap: b }))}
            sources={SOURCES}
            onBackgroundClick={() => setSelected(null)}
        >
            <Layers doc={doc} selected={selected} onSelect={setSelected} />
            <ViewSync
                doc={doc}
                pendingFit={pendingFit}
                onView={(view) => setDoc((d) => (d ? { ...d, view } : d))}
            />
            <DrawTool mode={draw} onCreate={onDraw} onCancel={() => setDraw(null)} />
            <EditPanel
                doc={doc}
                maps={maps}
                unsaved={unsaved}
                active={active}
                setActive={setActive}
                draw={draw}
                setDraw={setDraw}
                update={update}
                updateLayer={updateLayer}
                addFiles={addFiles}
                open={open}
                refresh={refresh}
            />
            {selLayer && selFeature && (
                <FeaturePanel
                    key={selected!.id}
                    layer={selLayer}
                    feature={selFeature}
                    onClose={() => setSelected(null)}
                    onChange={(props) =>
                        updateLayer(selLayer.id, (l) => ({
                            ...l,
                            data: { ...l.data, features: l.data.features.map((f) => (f.properties?._id === selected!.id ? { ...f, properties: { ...props, _id: selected!.id } } : f)) },
                        }))
                    }
                    onDelete={() => {
                        updateLayer(selLayer.id, (l) => ({ ...l, data: { ...l.data, features: l.data.features.filter((f) => f.properties?._id !== selected!.id) } }))
                        setSelected(null)
                    }}
                />
            )}
            {dragging && (
                <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm">
                    <p className="rounded-lg border border-dashed px-6 py-4 text-lg font-medium">Drop to add to the map</p>
                </div>
            )}
        </MapView>
    )
}

/** The map's layers, top of the list drawn on top. */
function Layers({ doc, selected, onSelect }: { doc: MapDoc; selected: Selected; onSelect: (s: Selected) => void }) {
    const { map } = useMap()
    // Keep MapLibre's stacking in step with the list: areas under lines under points within each layer.
    useEffect(() => {
        const ids = map.getStyle().layers.map((l) => l.id)
        for (const l of [...doc.layers].reverse())
            for (const k of ['a', 'l', 'p'])
                for (const id of ids)
                    if (id === `${l.id}-${k}` || (id.startsWith(`${l.id}-${k}-`) && !id.endsWith('-label'))) map.moveLayer(id)
        for (const l of [...doc.layers].reverse()) for (const k of ['a', 'l', 'p']) if (map.getLayer(`${l.id}-${k}-label`)) map.moveLayer(`${l.id}-${k}-label`)
        for (const id of ['ks-draw-fill', 'ks-draw-line', 'ks-draw-pts']) if (map.getLayer(id)) map.moveLayer(id)
    })
    return (
        <>
            {doc.layers.map((l) => {
                const color = colorBy(l.style, l.data)
                const common = {
                    data: l.data,
                    color,
                    featureId: '_id',
                    hidden: l.hidden,
                    label: l.style.label,
                    labelMinZoom: 0,
                    selectedId: selected?.layer === l.id ? selected.id : null,
                    onSelect: (f: { properties: Record<string, unknown> }) => onSelect({ layer: l.id, id: String(f.properties._id) }),
                }
                return (
                    <LayerGroup key={l.id}>
                        <PolygonLayer id={`${l.id}-a`} filter={GEOM.a} opacity={l.style.opacity} outlineWidth={l.style.size} {...common} />
                        <LineLayer id={`${l.id}-l`} filter={GEOM.l} opacity={l.style.opacity} width={l.style.size} {...common} />
                        <PointLayer id={`${l.id}-p`} filter={GEOM.p} opacity={l.style.opacity} radius={l.style.size} {...common} />
                    </LayerGroup>
                )
            })}
        </>
    )
}
const LayerGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>

/** Jump to a map's saved view (or fit its data) when it opens; remember the view as it moves. */
function ViewSync({ doc, onView, pendingFit }: { doc: MapDoc; onView: (v: MapDoc['view']) => void; pendingFit: React.RefObject<Feature[] | null> }) {
    const { map } = useMap()
    if (import.meta.env.DEV) (window as unknown as { map: unknown }).map = map
    const cb = useRef(onView)
    cb.current = onView
    const all = useMemo(() => doc.layers.flatMap((l) => l.data.features), [doc.layers])
    useEffect(() => {
        if (!doc.view && all.length) fitToFeatures(map, all, { padding: 60, maxZoom: 14 })
        const end = () => {
            const c = map.getCenter()
            cb.current({ center: [c.lng, c.lat], zoom: map.getZoom() })
        }
        map.on('moveend', end)
        return () => void map.off('moveend', end)
        // Once per opened map.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map])
    // Newly added files: show them.
    useEffect(() => {
        if (!pendingFit.current) return
        fitToFeatures(map, pendingFit.current as Feature[], { padding: 60, maxZoom: 14 })
        pendingFit.current = null
    })
    return null
}

export type { FeatureCollection }
