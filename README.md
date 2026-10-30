[![Topographic by kevinschaich](https://kevinschaich.com/og/topographic.png)](https://kevinschaich.com/project/topographic/)

# Topographic

Make beautiful maps from your data, all locally

**[Try it →](https://kevinschaich.com/project/topographic/)**

## How it works

- Drop or open GeoJSON, CSV (latitude/longitude columns are found automatically), GPX, KML or KMZ files, or draw
  points, lines and areas on the map. Each file becomes a layer.
- Style each layer with one color, a color per category, or a color ramp over a number; set size, opacity and labels;
  reorder, hide or delete layers; pick a basemap. Click any feature to see and edit its details.
- Your maps live in your browser. Nothing is uploaded and nothing is shared: the only requests are basemap tiles and
  place search. Download a map file or a layer as GeoJSON from My maps to keep a copy or move it elsewhere.
- A first visit opens New York City's population by census tract. Your own maps show up in My maps once you edit
  something; the other examples are in My maps → Examples.
- Inspired by [geojson.io](https://geojson.io/).

## Data sources

- Example maps (cities, countries, rivers): [Natural Earth](https://www.naturalearthdata.com), public domain
- Example: Formula 1 circuits: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), MIT
- Examples: Vancouver land value, Zermatt ski runs, time zones, Prague buildings: [vis.gl deck.gl-data](https://github.com/visgl/deck.gl-data), MIT (ski runs from [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL)
- Examples: US unemployment, New York City population: [kepler.gl-data](https://github.com/uber-web/kepler.gl-data), Apache-2.0 (license copy in `data/LICENSE-Apache-2.0.txt`)
- Example: dog-friendly national parks: [Barkcountry](https://github.com/kevinschaich/barkcountry), MIT
- Exact files, commits and licenses: [`data/ATTRIBUTION.md`](data/ATTRIBUTION.md)
- Dark and Streets basemaps: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL
- Satellite basemap: [USGS The National Map](https://www.usgs.gov/programs/national-geospatial-program/national-map), public domain
- Place search: [Photon by Komoot](https://photon.komoot.io), OSM data, ODbL

## Run locally

```sh
bun install && bun dev
```
