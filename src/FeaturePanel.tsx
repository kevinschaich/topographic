import { Button, Input } from '@kevinschaich/components'
import { FeatureCard } from '@kevinschaich/components/map'
import type { Feature } from 'geojson'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { MapLayer } from './model'

type Row = { key: string; value: string }

const show = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))
const parse = (s: string): unknown => (s.trim() !== '' && Number.isFinite(Number(s)) && !/^0\d/.test(s.trim()) ? Number(s) : s)
const isLink = (s: string) => /^https?:\/\/\S+$/.test(s)

export const featureTitle = (f: Feature, fallback: string) => {
    const p = f.properties ?? {}
    const k = Object.keys(p).find((k) => /^(name|title|label)$/i.test(k) && show(p[k]).trim())
    return k ? show(p[k]) : fallback
}

const kindOf = (f: Feature) => {
    const t = f.geometry?.type ?? ''
    return t.endsWith('Point') ? 'Point' : t.endsWith('LineString') ? 'Line' : t.endsWith('Polygon') ? 'Area' : 'Shape'
}

/** The selected feature's properties, editable in place. */
export function FeaturePanel({
    layer,
    feature,
    onClose,
    onChange,
    onDelete,
}: {
    layer: MapLayer
    feature: Feature
    onClose: () => void
    onChange: (props: Record<string, unknown>) => void
    onDelete: () => void
}) {
    const props = Object.entries(feature.properties ?? {}).filter(([k]) => k !== '_id')
    // A brand-new drawing starts in edit mode so it can be named right away.
    const fresh = props.length === 1 && props[0][0] === 'name' && props[0][1] === ''
    const [editing, setEditing] = useState<Row[] | null>(fresh ? [{ key: 'name', value: '' }] : null)

    const save = () => {
        if (!editing) return
        const out: Record<string, unknown> = {}
        for (const r of editing) if (r.key.trim()) out[r.key.trim()] = parse(r.value)
        onChange(out)
        setEditing(null)
    }
    const set = (i: number, patch: Partial<Row>) => setEditing(editing!.map((r, j) => (j === i ? { ...r, ...patch } : r)))

    return (
        <FeatureCard
            title={featureTitle(feature, kindOf(feature))}
            subtitle={layer.name}
            onClose={onClose}
            footer={
                editing ? (
                    <div className="flex gap-2 border-t pt-3">
                        <Button size="sm" onClick={save}>
                            <Check /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex gap-2 border-t pt-3">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(props.map(([key, v]) => ({ key, value: show(v) })))}>
                            <Pencil /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                            <Trash2 /> Delete
                        </Button>
                    </div>
                )
            }
        >
            {editing ? (
                <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                        e.preventDefault()
                        save()
                    }}
                >
                    {editing.map((r, i) => (
                        <div key={i} className="grid grid-cols-[2fr_3fr_auto] gap-1.5">
                            <Input aria-label="Field" placeholder="Field" value={r.key} onChange={(e) => set(i, { key: e.target.value })} />
                            <Input aria-label="Value" placeholder="Value" value={r.value} autoFocus={fresh && i === 0} onChange={(e) => set(i, { value: e.target.value })} />
                            <Button type="button" variant="ghost" size="icon" aria-label="Remove field" onClick={() => setEditing(editing.filter((_, j) => j !== i))}>
                                <X />
                            </Button>
                        </div>
                    ))}
                    <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setEditing([...editing, { key: '', value: '' }])}>
                        <Plus /> Add a field
                    </Button>
                    <button type="submit" hidden />
                </form>
            ) : props.length ? (
                <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5 text-sm">
                    {props.map(([k, v]) => (
                        <div key={k} className="contents">
                            <dt className="truncate text-muted-foreground" title={k}>
                                {k}
                            </dt>
                            <dd className="break-words">
                                {isLink(show(v)) ? (
                                    <a href={show(v)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                                        {show(v).replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                                    </a>
                                ) : (
                                    show(v) || <span className="text-muted-foreground">–</span>
                                )}
                            </dd>
                        </div>
                    ))}
                </dl>
            ) : (
                <p className="text-sm text-muted-foreground">No details yet. Press Edit to add some.</p>
            )}
        </FeatureCard>
    )
}
