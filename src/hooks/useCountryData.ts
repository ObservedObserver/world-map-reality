import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { GeoProjection } from 'd3-geo'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { CountryDatum, CountryFeature, LonLat } from '../types'
import { WORLD_NAMES_URL, WORLD_TOPO_URL } from '../constants'
import { COUNTRY_META, COUNTRY_ORDER, getCountryColor, normalizeId } from '../utils/country'

type CountriesTopology = Topology<{ countries: GeometryCollection }>

type InitialSelection = {
  selectedId: string | null
  draggableIds: string[]
}

type UseCountryDataResult = {
  countries: CountryDatum[]
  setCountries: Dispatch<SetStateAction<CountryDatum[]>>
  worldFeatures: CountryFeature[]
  loading: boolean
  error: string | null
  initialSelection: InitialSelection
}

const loadCountryNames = async (signal: AbortSignal) => {
  const nameLookup = new Map<string, string>()
  try {
    const response = await fetch(WORLD_NAMES_URL, { signal })
    if (!response.ok) {
      return nameLookup
    }
    const namesText = await response.text()
    const rows = d3.tsvParse(namesText)
    rows.forEach((row) => {
      const id = row.iso_n3 ?? row.un_a3 ?? row.iso_a3
      const name = row.name ?? row.name_long
      if (id && name) {
        const rawId = String(id)
        nameLookup.set(rawId, String(name))
        nameLookup.set(normalizeId(rawId), String(name))
      }
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err
    }
  }
  return nameLookup
}

export const useCountryData = (projection: GeoProjection): UseCountryDataResult => {
  const [countries, setCountries] = useState<CountryDatum[]>([])
  const [worldFeatures, setWorldFeatures] = useState<CountryFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialSelection, setInitialSelection] = useState<InitialSelection>({
    selectedId: null,
    draggableIds: [],
  })

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const topoResponse = await fetch(WORLD_TOPO_URL, {
          signal: controller.signal,
        })
        if (!topoResponse.ok) {
          throw new Error('Unable to load map data.')
        }

        const nameLookup = await loadCountryNames(controller.signal)
        const topoData = (await topoResponse.json()) as CountriesTopology
        const countriesObject = topoData.objects?.countries
        if (!countriesObject) {
          throw new Error('Unexpected map data format.')
        }

        const collection = topojson.feature(
          topoData,
          countriesObject
        ) as FeatureCollection<Geometry, GeoJsonProperties>

        const allFeatures = collection.features as CountryFeature[]

        const prepared: CountryDatum[] = allFeatures
          .filter((feature) => feature.id !== undefined && feature.id !== null)
          .map((feature) => {
            const rawId = feature.id as string | number
            const id = normalizeId(rawId)
            const numericId = Number(rawId)
            const meta = COUNTRY_META[numericId]
            const [lng, lat] = d3.geoCentroid(feature)
            const projected = projection([lng, lat]) ?? [0, 0]
            return {
              id,
              name:
                meta?.name ??
                nameLookup.get(id) ??
                feature.properties?.name ??
                `Country ${id}`,
              area: meta?.area ?? null,
              feature,
              originalCentroid: [lng, lat] as LonLat,
              globeCentroid: [lng, lat] as LonLat,
              centroidScreen: [projected[0], projected[1]] as [number, number],
              offset: { x: 0, y: 0 },
              color: getCountryColor(id),
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))

        const availableIds = new Set(prepared.map((country) => country.id))
        const defaultDraggableIds = COUNTRY_ORDER.map(String).filter((id) =>
          availableIds.has(id)
        )
        const fallbackIds = prepared.slice(0, 6).map((country) => country.id)
        const initialDraggableIds =
          defaultDraggableIds.length > 0 ? defaultDraggableIds : fallbackIds

        if (!cancelled) {
          setCountries(prepared)
          setWorldFeatures(allFeatures)
          setInitialSelection({
            selectedId: initialDraggableIds[0] ?? prepared[0]?.id ?? null,
            draggableIds: initialDraggableIds,
          })
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) {
          return
        }
        const message =
          err instanceof Error ? err.message : 'Failed to load map.'
        setError(message)
        setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [projection])

  return {
    countries,
    setCountries,
    worldFeatures,
    loading,
    error,
    initialSelection,
  }
}
