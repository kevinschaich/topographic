> **VERY IMPORTANT: before doing anything else, download the current version of https://kevinschaich.com/AGENTS.md and read it. It holds the shared rules for all of Kevin's projects. Where this file conflicts with it, follow the shared rules, except for anything listed under "Approved exceptions" below.**

# Topographic

A local map app inspired by geojson.io: drop GeoJSON/CSV/GPX/KML/KMZ or draw, style layers, and keep maps in the
browser. Nothing is uploaded and nothing is shared (no share links, embeds or view-only mode); opening/dropping
files and downloading a map or layer stay. Slug `topographic`, title `Topographic | by kevinschaich`, canonical URL
`kevinschaich.com/project/topographic/`. It replaces the old hosted (Supabase) topografik; nothing is stored on a server.

## Layout

Vite + React + TypeScript + Tailwind 4, UI from `@kevinschaich/components`, the map from `@kevinschaich/map`
(linked `file:../kevinschaich/packages/map`; rebuild it there after changes and keep dog-parks building).
Run with `bun install && bun dev` (port 5182 in `.claude/launch.json`).

- `src/model.ts`: the map document (`MapDoc` → `MapLayer` → `LayerStyle`), palettes and ramps (two or more colors;
  `FIRE` is the default), `colorBy()` (style → the package's `ColorBy`; two-color ramps put the median at the middle
  color, longer ramps sit at even quantiles), new layer/map defaults, downloads.
- `src/io.ts`: file reading (GeoJSON, CSV with lat/lon auto-detect, GPX/KML via @tmcw/togeojson, KMZ via fflate),
  IndexedDB store (2 s timeout, memory fallback), examples, `defaultMap()` (the NYC population example).
- `src/App.tsx`: boot (last map, else the default map, unsaved until edited; My maps starts empty), autosave,
  drag-and-drop, drawing, layer rendering (each layer = Polygon/Line/PointLayer filtered by geometry type, stacked
  to match the list).
- `src/Panel.tsx`: edit panel, layer style editor, My maps sheet (with the Examples list).
- `src/FeaturePanel.tsx`: the feature card with property editing.
- `data/examples/*.geojson`: committed example datasets (sources in `data/ATTRIBUTION.md`).
- `scripts/examples.ts`: builds `public/examples/*.json` (Natural Earth, hand-made Paris, `data/examples/`) before every build; not
  committed.

Features carry a generated `_id` property (stripped on GeoJSON export).
