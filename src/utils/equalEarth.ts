import {
  geoArea,
  geoBounds,
  geoCircle,
  geoEqualEarth,
  geoMercator,
  geoPath,
} from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

export const EARTH_RADIUS_KM = 6371.0088
export const MERCATOR_LIMIT = 85.0511287798066
export const MAP_SIZE = 560
// Both maps use the same unit-sphere scale. Independent fitSize calls would
// introduce an arbitrary area multiplier between the two panels.
export const MAP_SCALE = (MAP_SIZE - 36) / (2 * Math.PI)
export type Region = {
  id: string
  name: string
  geometry: Feature | FeatureCollection
  memberIds: string[]
}

const AFRICA_IDS = new Set(
  '12 24 72 108 120 132 140 148 174 178 180 204 226 231 232 262 266 270 288 324 384 404 426 430 434 450 454 466 478 480 504 508 516 562 566 624 638 646 678 686 690 694 706 710 716 728 729 732 748 768 788 800 818 834 854 894'.split(
    ' ',
  ),
)

export function prepareRegions(features: Feature<Geometry>[]): Region[] {
  const regions = features.map((feature, index) => ({
    id: feature.id == null ? `region-${index}` : String(Number(feature.id)),
    name:
      feature.properties?.name === 'United States of America'
        ? 'United States'
        : String(feature.properties?.name ?? 'Unnamed region'),
    geometry: feature,
    memberIds: [
      feature.id == null ? `region-${index}` : String(Number(feature.id)),
    ],
  }))
  const africa = regions.filter(
    (region) => AFRICA_IDS.has(region.id) || region.name === 'Somaliland',
  )
  return [
    {
      id: 'africa',
      name: 'Africa',
      geometry: {
        type: 'FeatureCollection',
        features: africa.map((region) => region.geometry as Feature),
      },
      memberIds: africa.map((region) => region.id),
    },
    ...regions.sort((a, b) => a.name.localeCompare(b.name, 'en')),
  ]
}

export function measureRegion(
  geometry: Geometry | Feature | FeatureCollection,
) {
  const steradians = geoArea(geometry)
  const bounds = geoBounds(geometry)
  const clipped =
    bounds[0][1] < -MERCATOR_LIMIT || bounds[1][1] > MERCATOR_LIMIT
  const equalEarthArea = geoPath(
    geoEqualEarth().scale(1).translate([0, 0]).precision(0.00001),
  ).area(geometry)
  const mercatorArea = geoPath(
    geoMercator().scale(1).translate([0, 0]).precision(0.00001),
  ).area(geometry)
  return {
    areaKm2: steradians * EARTH_RADIUS_KM ** 2,
    equalEarthArea,
    mercatorArea,
    // A whole-country multiplier is undefined when Mercator clips its outline.
    inflation: clipped || steradians <= 0 ? null : mercatorArea / steradians,
    clipped,
  }
}

export function createMapProjection(
  kind: 'equalEarth' | 'mercator',
  meridian = 0,
) {
  return (kind === 'equalEarth' ? geoEqualEarth() : geoMercator())
    .rotate([-meridian, 0])
    .scale(MAP_SCALE)
    .translate([MAP_SIZE / 2, MAP_SIZE / 2])
    .precision(0.15)
}

export function createAreaLens(latitude: number, longitude = 0) {
  return geoCircle()
    .center([longitude, Math.max(-75, Math.min(75, latitude))])
    .radius(4)
    .precision(1)()
}

export type ExplorerState = {
  country: string
  compare: string
  meridian: number
  latitude: number
  grid: boolean
  lens: boolean
}
export const DEFAULT_EXPLORER_STATE: ExplorerState = {
  country: '304',
  compare: 'africa',
  meridian: 0,
  latitude: 0,
  grid: true,
  lens: false,
}

export function parseExplorerState(
  search: string,
  ids: Set<string>,
): ExplorerState {
  const params = new URLSearchParams(search)
  const number = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key)
    const value = raw == null || raw.trim() === '' ? NaN : Number(raw)
    return Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback
  }
  const country = params.get('country') ?? DEFAULT_EXPLORER_STATE.country
  const compare = params.get('compare') ?? DEFAULT_EXPLORER_STATE.compare
  return {
    country: ids.has(country) ? country : DEFAULT_EXPLORER_STATE.country,
    compare: ids.has(compare) ? compare : DEFAULT_EXPLORER_STATE.compare,
    meridian: number('meridian', 0, -180, 180),
    latitude: number('latitude', 0, -75, 75),
    grid: params.get('grid') !== '0',
    lens: params.get('lens') === '1',
  }
}

export function explorerSearch(state: ExplorerState) {
  return new URLSearchParams({
    country: state.country,
    compare: state.compare,
    meridian: String(state.meridian),
    latitude: String(state.latitude),
    grid: state.grid ? '1' : '0',
    lens: state.lens ? '1' : '0',
  }).toString()
}
