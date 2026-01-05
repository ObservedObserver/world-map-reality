import type { Feature, GeoJsonProperties, Geometry } from 'geojson'

export type LonLat = [number, number]
export type Vec3 = [number, number, number]

export type CountryFeature = Feature<Geometry, GeoJsonProperties> & {
  id?: number | string
}

export type CountryDatum = {
  id: string
  name: string
  area: number | null
  feature: CountryFeature
  originalCentroid: LonLat
  globeCentroid: LonLat
  centroidScreen: [number, number]
  offset: { x: number; y: number }
  color: string
}

export type SelectedDetails = {
  originalLat: number
  currentLat: number
  currentScale: number
}

export type MapRenderedCountry = {
  country: CountryDatum
  feature: CountryFeature
  isDraggable: boolean
  isSelected: boolean
  isDragging: boolean
}

export type GlobeHighlightCountry = {
  country: CountryDatum
  feature: CountryFeature
}

export type PlanetPlacement = {
  id: string
  centroid: LonLat
}
