import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Byline,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Input,
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
    Kbd,
    Label,
    NativeSelect,
    NativeSelectOption,
    Separator,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    Slider,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    ToggleGroup,
    ToggleGroupItem,
    toast,
} from '@kevinschaich/components'
import { BasemapTabs, MapPanel, PlaceSearch, fitToFeatures, useMap, type DrawMode, type SearchHit } from '@kevinschaich/components/map'
import {
    ChevronDown,
    ChevronUp,
    Copy,
    Download,
    Eye,
    EyeOff,
    FilePlus2,
    FolderOpen,
    Map as MapIcon,
    MapPin,
    MoreHorizontal,
    Pencil,
    Pentagon,
    Plus,
    Spline,
    Trash2,
    Upload,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { REPO } from './config'
import { featureTitle } from './FeaturePanel'
import { EXAMPLES, copyOf, defaultMap, fetchExample, store } from './io'
import { RAMPS, categoriesFor, download, exportGeoJSON, fileName, isNumeric, kinds, newMap, numericRange, propertyNames, type ColorMode, type MapDoc, type MapLayer } from './model'

const ACCEPT = '.geojson,.json,.csv,.tsv,.txt,.gpx,.kml,.kmz'

type Update = (fn: (d: MapDoc) => MapDoc) => void
type UpdateLayer = (id: string, fn: (l: MapLayer) => MapLayer) => void

/** The swatch for a layer: its single color, or a strip of its category/ramp colors. */
function Swatch({ layer, className = 'size-4' }: { layer: MapLayer; className?: string }) {
    const s = layer.style
    const colors = s.mode === 'category' && s.categories ? Object.values(s.categories).slice(0, 4) : s.mode === 'ramp' && s.ramp ? s.ramp : [s.color]
    const bg = colors.length > 1 ? `linear-gradient(135deg, ${colors.join(', ')})` : colors[0]
    return <span className={`inline-block shrink-0 rounded-full ring-1 ring-white/20 ${className}`} style={{ background: bg, opacity: layer.hidden ? 0.35 : 1 }} />
}

const json = (v: unknown) => JSON.stringify(v)

// ---------------------------------------------------------------- Edit panel

export function EditPanel({
    doc,
    maps,
    unsaved,
    active,
    setActive,
    draw,
    setDraw,
    update,
    updateLayer,
    addFiles,
    open,
    refresh,
}: {
    doc: MapDoc
    maps: MapDoc[]
    unsaved: boolean
    active: string | null
    setActive: (id: string | null) => void
    draw: DrawMode | null
    setDraw: (m: DrawMode | null) => void
    update: Update
    updateLayer: UpdateLayer
    addFiles: (f: FileList | File[]) => void
    open: (m: MapDoc, saved?: boolean) => void
    refresh: () => Promise<void>
}) {
    const { map } = useMap()
    const file = useRef<HTMLInputElement>(null)
    const [renaming, setRenaming] = useState(false)
    const [library, setLibrary] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const move = (id: string, by: number) =>
        update((d) => {
            const i = d.layers.findIndex((l) => l.id === id)
            const j = i + by
            if (i < 0 || j < 0 || j >= d.layers.length) return d
            const layers = [...d.layers]
            ;[layers[i], layers[j]] = [layers[j], layers[i]]
            return { ...d, layers }
        })

    const search = (q: string): SearchHit[] => {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean)
        const out: SearchHit[] = []
        for (const l of doc.layers)
            for (const f of l.data.features) {
                const title = featureTitle(f, '')
                if (!title || !words.every((w) => title.toLowerCase().includes(w))) continue
                out.push({ key: `${l.id}-${f.properties?._id}`, label: title, detail: l.name, onSelect: () => fitToFeatures(map, [f], { pointZoom: 14 }) })
                if (out.length >= 6) return out
            }
        return out
    }

    const duplicate = async (m: MapDoc) => {
        const c = copyOf(m, `${m.name} (copy)`)
        await store.put(c)
        await refresh()
        open(c)
        toast.add({ title: `Made a copy of "${m.name}"` })
    }
    const remove = async (m: MapDoc) => {
        await store.remove(m.id)
        const rest = maps.filter((x) => x.id !== m.id)
        await refresh()
        if (m.id === doc.id) {
            if (rest[0]) open(rest[0])
            else open(await defaultMap(), false)
        }
        toast.add({ title: `Deleted "${m.name}"` })
    }

    return (
        <MapPanel
            title={
                <button className="flex max-w-full items-center gap-2 text-left hover:opacity-80" onClick={() => setRenaming(true)} title="Rename map">
                    <span className="truncate">{doc.name}</span>
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
            }
            description="Drop GeoJSON, CSV, GPX or KML files on the map, or draw your own. Your maps stay in this browser."
        >
            <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setLibrary(true)}>
                    <FolderOpen /> My maps
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button variant="secondary" size="icon-sm" aria-label="More">
                                <MoreHorizontal />
                            </Button>
                        }
                    />
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setRenaming(true)}>
                            <Pencil /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate(doc)}>
                            <Copy /> Make a copy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => download(`${fileName(doc.name)}.topographic.json`, JSON.stringify({ topographic: 1, map: doc }))}>
                            <Download /> Download map file
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                            <Trash2 /> Delete map
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <PlaceSearch searchFeatures={search} featuresHeading="On this map" placeholder="Search this map or a place" />

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Layers</span>
                    <Button variant="ghost" size="sm" onClick={() => file.current?.click()}>
                        <Upload /> Add data
                    </Button>
                </div>
                <input
                    ref={file}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    hidden
                    onChange={(e) => {
                        if (e.target.files) addFiles(e.target.files)
                        e.target.value = ''
                    }}
                />
                {doc.layers.length === 0 && (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Add a file or draw something to start your map.</p>
                )}
                <ItemGroup className="gap-1">
                    {doc.layers.map((l, i) => (
                        <LayerRow
                            key={l.id}
                            layer={l}
                            open={active === l.id}
                            onToggleOpen={() => setActive(active === l.id ? null : l.id)}
                            first={i === 0}
                            last={i === doc.layers.length - 1}
                            onMove={(by) => move(l.id, by)}
                            update={(fn) => updateLayer(l.id, fn)}
                            onZoom={() => fitToFeatures(map, l.data.features, { padding: 60, maxZoom: 14 })}
                            onDelete={() => {
                                update((d) => ({ ...d, layers: d.layers.filter((x) => x.id !== l.id) }))
                                if (active === l.id) setActive(null)
                            }}
                        />
                    ))}
                </ItemGroup>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Draw</span>
                <ToggleGroup
                    variant="outline"
                    size="sm"
                    value={draw ? [draw] : []}
                    onValueChange={(v: unknown[]) => setDraw((v[0] as DrawMode | undefined) ?? null)}
                    className="w-full"
                >
                    <ToggleGroupItem value="point" className="flex-1" aria-label="Draw points">
                        <MapPin /> Point
                    </ToggleGroupItem>
                    <ToggleGroupItem value="line" className="flex-1" aria-label="Draw a line">
                        <Spline /> Line
                    </ToggleGroupItem>
                    <ToggleGroupItem value="polygon" className="flex-1" aria-label="Draw an area">
                        <Pentagon /> Area
                    </ToggleGroupItem>
                </ToggleGroup>
                {draw && (
                    <p className="text-xs text-muted-foreground">
                        Adds to {doc.layers.find((l) => l.id === active)?.name ?? doc.layers[0]?.name ?? 'a new layer'}. <Kbd>Esc</Kbd> to stop.
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Basemap</span>
                <BasemapTabs />
            </div>

            <Byline repo={REPO} />

            <RenameDialog open={renaming} onOpenChange={setRenaming} title="Rename map" value={doc.name} onSave={(name) => update((d) => ({ ...d, name }))} />
            <Library
                open={library}
                onOpenChange={setLibrary}
                doc={doc}
                maps={maps}
                unsaved={unsaved}
                onOpen={(m) => {
                    open(m)
                    setLibrary(false)
                }}
                onNew={async () => {
                    const m = newMap()
                    await store.put(m)
                    await refresh()
                    open(m)
                    setLibrary(false)
                }}
                onDuplicate={duplicate}
                onDelete={remove}
                onRename={async (m, name) => {
                    if (m.id === doc.id) update((d) => ({ ...d, name }))
                    else {
                        await store.put({ ...m, name })
                        await refresh()
                    }
                }}
                onExample={async (slug) => {
                    try {
                        const m = copyOf(await fetchExample(slug))
                        await store.put(m)
                        await refresh()
                        open(m)
                        setLibrary(false)
                    } catch {
                        toast.add({ title: "Couldn't open that example. Try again in a moment." })
                    }
                }}
                onFiles={(f) => {
                    addFiles(f)
                    setLibrary(false)
                }}
            />
            <Confirm
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={`Delete "${doc.name}"?`}
                description="It will be gone from this browser. Download the map file first if you want to keep it."
                onConfirm={() => remove(doc)}
            />
        </MapPanel>
    )
}

function LayerRow({
    layer,
    open,
    onToggleOpen,
    first,
    last,
    onMove,
    update,
    onZoom,
    onDelete,
}: {
    layer: MapLayer
    open: boolean
    onToggleOpen: () => void
    first: boolean
    last: boolean
    onMove: (by: number) => void
    update: (fn: (l: MapLayer) => MapLayer) => void
    onZoom: () => void
    onDelete: () => void
}) {
    const [renaming, setRenaming] = useState(false)
    return (
        <div className={`rounded-lg ${open ? 'bg-muted/50' : ''}`}>
            <Item size="xs" className="cursor-pointer px-2 hover:bg-muted/50" onClick={onToggleOpen}>
                <ItemMedia>
                    <Swatch layer={layer} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                    <ItemTitle className={`truncate ${layer.hidden ? 'text-muted-foreground' : ''}`}>{layer.name}</ItemTitle>
                </ItemContent>
                <ItemActions className="gap-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={layer.hidden ? 'Show layer' : 'Hide layer'}
                        title={layer.hidden ? 'Show layer' : 'Hide layer'}
                        onClick={() => update((l) => ({ ...l, hidden: !l.hidden }))}
                    >
                        {layer.hidden ? <EyeOff /> : <Eye />}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button variant="ghost" size="icon-sm" aria-label="Layer options">
                                    <MoreHorizontal />
                                </Button>
                            }
                        />
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={onZoom}>
                                <MapIcon /> Zoom to layer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRenaming(true)}>
                                <Pencil /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={first} onClick={() => onMove(-1)}>
                                <ChevronUp /> Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={last} onClick={() => onMove(1)}>
                                <ChevronDown /> Move down
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => download(`${fileName(layer.name)}.geojson`, JSON.stringify(exportGeoJSON(layer)), 'application/geo+json')}>
                                <Download /> Download GeoJSON
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={onDelete}>
                                <Trash2 /> Delete layer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </ItemActions>
            </Item>
            {open && <StyleEditor layer={layer} update={update} />}
            <RenameDialog open={renaming} onOpenChange={setRenaming} title="Rename layer" value={layer.name} onSave={(name) => update((l) => ({ ...l, name }))} />
        </div>
    )
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {children}
        </div>
    )
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
    return (
        <Input
            type="color"
            aria-label={label}
            title={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-9 shrink-0 cursor-pointer p-0.5"
        />
    )
}

function StyleEditor({ layer, update }: { layer: MapLayer; update: (fn: (l: MapLayer) => MapLayer) => void }) {
    const s = layer.style
    const props = propertyNames(layer.data)
    const numeric = props.filter((p) => isNumeric(layer.data, p))
    const k = kinds(layer.data)
    const sizeLabel = k.points >= k.lines && k.points >= k.polygons ? 'Point size' : k.lines >= k.polygons ? 'Line width' : 'Outline width'
    const setStyle = (patch: Partial<MapLayer['style']>) => update((l) => ({ ...l, style: { ...l.style, ...patch } }))

    const setMode = (mode: ColorMode) => {
        if (mode === 'category') {
            const by = s.by && props.includes(s.by) ? s.by : props[0]
            setStyle({ mode, by, categories: by ? categoriesFor(layer.data, by, s.categories) : {} })
        } else if (mode === 'ramp') setStyle({ mode, by: s.by && numeric.includes(s.by) ? s.by : numeric[0], ramp: s.ramp ?? RAMPS[0].colors })
        else setStyle({ mode })
    }
    const range = s.mode === 'ramp' && s.by ? numericRange(layer.data, s.by) : null
    const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

    return (
        <div className="flex flex-col gap-3 px-2 pt-1 pb-3">
            <Tabs value={s.mode} onValueChange={(v) => setMode(v as ColorMode)}>
                <TabsList className="w-full">
                    <TabsTrigger value="single">One color</TabsTrigger>
                    <TabsTrigger value="category" disabled={!props.length}>
                        By type
                    </TabsTrigger>
                    <TabsTrigger value="ramp" disabled={!numeric.length}>
                        By number
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="flex items-center gap-2 pt-2">
                    <ColorInput label="Color" value={s.color} onChange={(color) => setStyle({ color })} />
                    <span className="font-mono text-xs text-muted-foreground">{s.color}</span>
                </TabsContent>
                <TabsContent value="category" className="flex flex-col gap-2 pt-2">
                    <Field label="Color by">
                        <NativeSelect size="sm" value={s.by ?? ''} onChange={(e) => setStyle({ by: e.target.value, categories: categoriesFor(layer.data, e.target.value) })}>
                            {props.map((p) => (
                                <NativeSelectOption key={p} value={p}>
                                    {p}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </Field>
                    <div className="flex flex-col gap-1">
                        {Object.entries(s.categories ?? {}).map(([v, c]) => (
                            <div key={v} className="flex items-center gap-2 text-sm">
                                <ColorInput label={`Color for ${v}`} value={c} onChange={(nc) => setStyle({ categories: { ...s.categories, [v]: nc } })} />
                                <span className="truncate">{v}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ColorInput label="Color for everything else" value={s.color} onChange={(color) => setStyle({ color })} />
                            Everything else
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="ramp" className="flex flex-col gap-2 pt-2">
                    <Field label="Color by">
                        <NativeSelect size="sm" value={s.by ?? ''} onChange={(e) => setStyle({ by: e.target.value })}>
                            {numeric.map((p) => (
                                <NativeSelectOption key={p} value={p}>
                                    {p}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </Field>
                    <ToggleGroup
                        size="sm"
                        variant="outline"
                        value={[json(s.ramp)]}
                        onValueChange={(v: unknown[]) => v[0] && setStyle({ ramp: JSON.parse(v[0] as string) })}
                        className="w-full"
                    >
                        {RAMPS.map((r) => (
                            <ToggleGroupItem key={r.label} value={json(r.colors)} aria-label={r.label} title={r.label} className="flex-1 px-1">
                                <span className="h-3 w-full rounded-sm" style={{ background: `linear-gradient(90deg, ${r.colors.join(', ')})` }} />
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <div className="flex items-center gap-2">
                        <ColorInput label="Low color" value={s.ramp?.[0] ?? RAMPS[0].colors[0]} onChange={(c) => setStyle({ ramp: [c, ...(s.ramp ?? RAMPS[0].colors).slice(1)] })} />
                        <span className="h-3 flex-1 rounded-sm" style={{ background: `linear-gradient(90deg, ${(s.ramp ?? RAMPS[0].colors).join(', ')})` }} />
                        <ColorInput label="High color" value={(s.ramp ?? RAMPS[0].colors).at(-1)!} onChange={(c) => setStyle({ ramp: [...(s.ramp ?? RAMPS[0].colors).slice(0, -1), c] })} />
                    </div>
                    {range && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{fmt(range[0])}</span>
                            <span>{fmt(range[1])}</span>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
            <Field label={sizeLabel}>
                <Slider min={1} max={k.points >= k.lines && k.points >= k.polygons ? 16 : 10} step={0.5} value={[s.size]} onValueChange={(v) => setStyle({ size: Array.isArray(v) ? v[0] : v })} />
            </Field>
            <Field label="Opacity">
                <Slider min={0.05} max={1} step={0.05} value={[s.opacity]} onValueChange={(v) => setStyle({ opacity: Array.isArray(v) ? v[0] : v })} />
            </Field>
            <Field label="Labels">
                <NativeSelect size="sm" value={s.label ?? ''} onChange={(e) => setStyle({ label: e.target.value || undefined })}>
                    <NativeSelectOption value="">None</NativeSelectOption>
                    {props.map((p) => (
                        <NativeSelectOption key={p} value={p}>
                            {p}
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
            </Field>
        </div>
    )
}

// ---------------------------------------------------------------- Dialogs

function RenameDialog({ open, onOpenChange, title, value, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; value: string; onSave: (v: string) => void }) {
    const [text, setText] = useState(value)
    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (o) setText(value)
                onOpenChange(o)
            }}
        >
            <DialogContent className="sm:max-w-sm">
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (text.trim()) onSave(text.trim())
                        onOpenChange(false)
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} onFocus={(e) => e.target.select()} aria-label="Name" />
                    <DialogFooter>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function Confirm({ open, onOpenChange, title, description, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; onConfirm: () => void }) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                            onConfirm()
                            onOpenChange(false)
                        }}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

const EXAMPLE_INFO: Record<(typeof EXAMPLES)[number], { name: string; detail: string }> = {
    cities: { name: 'Big cities of the world', detail: 'Points colored by population' },
    world: { name: 'Continents and great rivers', detail: 'Areas and lines in two layers' },
    paris: { name: 'A day in Paris', detail: 'Places, a walk and gardens' },
    'f1-circuits': { name: 'Formula 1 circuits', detail: 'Tracks colored by their first Grand Prix' },
    'vancouver-blocks': { name: 'Vancouver land value', detail: 'City blocks colored by value per square meter' },
    'ski-runs': { name: 'Ski runs around Zermatt', detail: 'Runs colored by difficulty' },
    'time-zones': { name: 'Time zones of the world', detail: 'Zones colored by UTC offset' },
    buildings: { name: 'Prague buildings and trees', detail: 'Buildings colored by how far the nearest tree is' },
    'county-unemployment': { name: 'US unemployment by county', detail: 'Counties colored by unemployment rate' },
    'nyc-census': { name: 'New York City population', detail: 'Census tracts colored by population' },
    'dog-friendly-national-parks': { name: 'Dog-friendly national parks', detail: 'Parks colored by where dogs can go' },
}

function Library({
    open,
    onOpenChange,
    doc,
    maps,
    unsaved,
    onOpen,
    onNew,
    onDuplicate,
    onDelete,
    onRename,
    onExample,
    onFiles,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    doc: MapDoc
    maps: MapDoc[]
    unsaved: boolean
    onOpen: (m: MapDoc) => void
    onNew: () => void
    onDuplicate: (m: MapDoc) => void
    onDelete: (m: MapDoc) => void
    onRename: (m: MapDoc, name: string) => void
    onExample: (slug: (typeof EXAMPLES)[number]) => void
    onFiles: (f: FileList) => void
}) {
    const [renaming, setRenaming] = useState<MapDoc | null>(null)
    const [deleting, setDeleting] = useState<MapDoc | null>(null)
    const file = useRef<HTMLInputElement>(null)
    // The open map's latest edits may not have reached the list yet.
    const list = maps.some((m) => m.id === doc.id) ? maps.map((m) => (m.id === doc.id ? doc : m)) : unsaved ? maps : [doc, ...maps]
    const when = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="w-full gap-0 overflow-auto sm:max-w-sm">
                <SheetHeader>
                    <SheetTitle>My maps</SheetTitle>
                    <SheetDescription>Saved in this browser only. Nothing is uploaded.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-5 px-4 pb-6">
                    <div className="flex gap-2">
                        <Button className="flex-1" onClick={onNew}>
                            <Plus /> New map
                        </Button>
                        <Button variant="secondary" className="flex-1" onClick={() => file.current?.click()}>
                            <FilePlus2 /> Open a file
                        </Button>
                        <input ref={file} type="file" accept={ACCEPT} hidden multiple onChange={(e) => e.target.files && onFiles(e.target.files)} />
                    </div>
                    {!list.length && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Maps you make or edit show up here.</p>}
                    <ItemGroup className="gap-1">
                        {list.map((m) => (
                            <Item key={m.id} size="sm" variant={m.id === doc.id ? 'muted' : 'default'} className="cursor-pointer" onClick={() => onOpen(m)}>
                                <ItemMedia variant="icon">
                                    <MapIcon />
                                </ItemMedia>
                                <ItemContent className="min-w-0">
                                    <ItemTitle className="truncate">{m.name}</ItemTitle>
                                    <ItemDescription>Edited {when(m.updated)}</ItemDescription>
                                </ItemContent>
                                <ItemActions onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            render={
                                                <Button variant="ghost" size="icon-sm" aria-label={`Options for ${m.name}`}>
                                                    <MoreHorizontal />
                                                </Button>
                                            }
                                        />
                                        <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuItem onClick={() => setRenaming(m)}>
                                                <Pencil /> Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onDuplicate(m)}>
                                                <Copy /> Make a copy
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => download(`${fileName(m.name)}.topographic.json`, JSON.stringify({ topographic: 1, map: m }))}>
                                                <Download /> Download
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(m)}>
                                                <Trash2 /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </ItemActions>
                            </Item>
                        ))}
                    </ItemGroup>
                    <Separator />
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Examples</span>
                        <ItemGroup className="gap-1">
                            {EXAMPLES.map((slug) => (
                                <Item key={slug} size="sm" variant="outline" className="cursor-pointer" onClick={() => onExample(slug)}>
                                    <ItemContent>
                                        <ItemTitle>{EXAMPLE_INFO[slug].name}</ItemTitle>
                                        <ItemDescription>{EXAMPLE_INFO[slug].detail}</ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <Plus className="size-4 text-muted-foreground" />
                                    </ItemActions>
                                </Item>
                            ))}
                        </ItemGroup>
                    </div>
                </div>
                {renaming && (
                    <RenameDialog
                        open
                        onOpenChange={(o) => !o && setRenaming(null)}
                        title="Rename map"
                        value={renaming.name}
                        onSave={(name) => onRename(renaming, name)}
                    />
                )}
                <Confirm
                    open={!!deleting}
                    onOpenChange={(o) => !o && setDeleting(null)}
                    title={`Delete "${deleting?.name}"?`}
                    description="It will be gone from this browser. Download it first if you want to keep it."
                    onConfirm={() => deleting && onDelete(deleting)}
                />
            </SheetContent>
        </Sheet>
    )
}
