import type { DataSource } from '@kevinschaich/components'
import { BASEMAP_SOURCES, PHOTON_SOURCE } from '@kevinschaich/components/map'

export const NAME = 'Topographic'
export const REPO = 'kevinschaich/topographic'

// Keep in step with the README.
export const SOURCES: DataSource[] = [
    { what: 'Example maps: cities, countries and rivers', from: 'Natural Earth', href: 'https://www.naturalearthdata.com', license: 'Public domain' },
    { what: 'Example: Formula 1 circuits', from: 'bacinger/f1-circuits', href: 'https://github.com/bacinger/f1-circuits', license: 'MIT' },
    { what: 'Examples: Vancouver land value, Zermatt ski runs, time zones, Prague buildings', from: 'vis.gl deck.gl-data', href: 'https://github.com/visgl/deck.gl-data', license: 'MIT' },
    { what: 'Zermatt ski runs (within deck.gl-data)', from: 'OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright', license: 'ODbL' },
    { what: 'Examples: US unemployment, New York City population', from: 'kepler.gl-data', href: 'https://github.com/uber-web/kepler.gl-data', license: 'Apache-2.0' },
    { what: 'Example: dog-friendly national parks', from: 'Barkcountry', href: 'https://github.com/kevinschaich/barkcountry', license: 'MIT' },
    ...BASEMAP_SOURCES,
    PHOTON_SOURCE,
]
