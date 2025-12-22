import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import './App.css'

const WORLD_TOPO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const WORLD_NAMES_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.tsv'

const MAP_WIDTH = 1100
const MAP_HEIGHT = 650
const MAP_PADDING = 40

const COUNTRY_ORDER = [304, 643, 124, 840, 76, 356, 180, 36, 392]

const COUNTRY_META: Record<number, { name: string; area: number }> = {
  304: { name: 'Greenland', area: 2166086 },
  643: { name: 'Russia', area: 17098246 },
  124: { name: 'Canada', area: 9984670 },
  840: { name: 'United States', area: 9833520 },
  76: { name: 'Brazil', area: 8515767 },
  356: { name: 'India', area: 3287263 },
  180: { name: 'DR Congo', area: 2344858 },
  36: { name: 'Australia', area: 7692024 },
  392: { name: 'Japan', area: 377975 },
}

const COLOR_PALETTE = [
  '#ef6f5a',
  '#f6c453',
  '#6ad0c4',
  '#9bd0ff',
  '#f49cbb',
  '#b5e48c',
  '#ffb870',
  '#86b6ff',
  '#f08a5d',
  '#7ed7c1',
  '#ffd166',
  '#06d6a0',
  '#118ab2',
  '#ef476f',
  '#ffd6a5',
  '#7f5af0',
  '#72efdd',
  '#e07a5f',
  '#f2cc8f',
  '#84a59d',
  '#f28482',
  '#a3cef1',
  '#ffcad4',
  '#cdb4db',
]

const normalizeId = (value: string | number) => {
  const raw = String(value)
  const stripped = raw.replace(/^0+/, '')
  return stripped === '' ? '0' : stripped
}

type CountryFeature = Feature<Geometry, GeoJsonProperties> & {
  id?: number | string
}

type CountriesTopology = Topology<{ countries: GeometryCollection }>

type CountryDatum = {
  id: string
  name: string
  area: number | null
  feature: CountryFeature
  originalCentroid: [number, number]
  centroidScreen: [number, number]
  offset: { x: number; y: number }
  color: string
}

type DragState = {
  id: string
  start: { x: number; y: number }
  origin: { x: number; y: number }
  centroid: [number, number]
}

const formatLatitude = (lat: number) => {
  const absolute = Math.abs(lat)
  if (absolute < 0.05) {
    return `${absolute.toFixed(1)}deg`
  }
  const direction = lat >= 0 ? 'N' : 'S'
  return `${absolute.toFixed(1)}deg${direction}`
}

const formatScale = (scale: number) => `${Math.round(scale * 100)}%`

const getMercatorScale = (originalLat: number, currentLat: number) =>
  Math.cos((originalLat * Math.PI) / 180) /
  Math.cos((currentLat * Math.PI) / 180)

const getCountryColor = (id: string) => {
  const numericId = Number(id)
  const index = Number.isFinite(numericId)
    ? Math.abs(numericId) % COLOR_PALETTE.length
    : id
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

function App() {
  const [countries, setCountries] = useState<CountryDatum[]>([])
  const [worldFeatures, setWorldFeatures] = useState<CountryFeature[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggableIds, setDraggableIds] = useState<string[]>([])
  const [countryFilter, setCountryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dragState = useRef<DragState | null>(null)
  const areaFormatter = useMemo(
    () => new Intl.NumberFormat('en-US'),
    []
  )

  const projection = useMemo(
    () =>
      d3
        .geoMercator()
        .scale(175)
        .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2 + 10]),
    []
  )

  const pathGenerator = useMemo(
    () => d3.geoPath(projection),
    [projection]
  )

  const latLines = useMemo(() => d3.range(-80, 81, 20), [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadData = async () => {
      try {
        setLoading(true)
        const [topoResult, namesResult] = await Promise.allSettled([
          fetch(WORLD_TOPO_URL, { signal: controller.signal }),
          fetch(WORLD_NAMES_URL, { signal: controller.signal }),
        ])

        if (topoResult.status !== 'fulfilled' || !topoResult.value.ok) {
          throw new Error('Unable to load map data.')
        }

        const nameLookup = new Map<string, string>()
        if (namesResult.status === 'fulfilled' && namesResult.value.ok) {
          const namesText = await namesResult.value.text()
          const rows = d3.tsvParse(namesText)
          rows.forEach((row) => {
            const id = row.id
            const name = row.name
            if (id && name) {
              const rawId = String(id)
              nameLookup.set(rawId, String(name))
              nameLookup.set(normalizeId(rawId), String(name))
            }
          })
        }

        const topoData = (await topoResult.value.json()) as CountriesTopology
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
              originalCentroid: [lng, lat],
              centroidScreen: [projected[0], projected[1]],
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
          setSelectedId(initialDraggableIds[0] ?? prepared[0]?.id ?? null)
          setDraggableIds(initialDraggableIds)
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

  const draggableCountries = useMemo(
    () => countries.filter((country) => draggableIds.includes(country.id)),
    [countries, draggableIds]
  )

  const filteredCountries = useMemo(() => {
    const query = countryFilter.trim().toLowerCase()
    const base = query
      ? countries.filter((country) =>
          country.name.toLowerCase().includes(query)
        )
      : countries
    const selectedSet = new Set(draggableIds)
    return [...base].sort((a, b) => {
      const aSelected = selectedSet.has(a.id) ? 0 : 1
      const bSelected = selectedSet.has(b.id) ? 0 : 1
      if (aSelected !== bSelected) {
        return aSelected - bSelected
      }
      return a.name.localeCompare(b.name)
    })
  }, [countries, countryFilter, draggableIds])

  const orderedCountries = useMemo(() => {
    const items = [...draggableCountries]
    const score = (id: string) =>
      id === draggingId ? 2 : id === selectedId ? 1 : 0
    items.sort((a, b) => score(a.id) - score(b.id))
    return items
  }, [draggableCountries, draggingId, selectedId])

  const selectedCountry =
    countries.find((country) => country.id === selectedId) ?? null

  const toggleDraggable = (id: string) => {
    setDraggableIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((entry) => entry !== id)
        : [...prev, id]
      if (!next.includes(id) && dragState.current?.id === id) {
        dragState.current = null
        setDraggingId(null)
      }
      return next
    })
  }

  const resetPositions = () => {
    dragState.current = null
    setDraggingId(null)
    setCountries((prev) =>
      prev.map((country) => ({ ...country, offset: { x: 0, y: 0 } }))
    )
  }

  const handlePointerDown = (
    event: PointerEvent<SVGGElement>,
    country: CountryDatum
  ) => {
    event.preventDefault()
    if (!draggableIds.includes(country.id)) {
      setSelectedId(country.id)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = {
      id: country.id,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: country.offset.x, y: country.offset.y },
      centroid: country.centroidScreen,
    }
    setSelectedId(country.id)
    setDraggingId(country.id)
  }

  const handlePointerMove = (
    event: PointerEvent<SVGGElement>,
    id: string
  ) => {
    if (!dragState.current || dragState.current.id !== id) {
      return
    }
    const dx = event.clientX - dragState.current.start.x
    const dy = event.clientY - dragState.current.start.y
    const nextOffset = {
      x: dragState.current.origin.x + dx,
      y: dragState.current.origin.y + dy,
    }

    const centroidX = dragState.current.centroid[0]
    const centroidY = dragState.current.centroid[1]
    const clampedCentroidX = Math.min(
      Math.max(centroidX + nextOffset.x, MAP_PADDING),
      MAP_WIDTH - MAP_PADDING
    )
    const clampedCentroidY = Math.min(
      Math.max(centroidY + nextOffset.y, MAP_PADDING),
      MAP_HEIGHT - MAP_PADDING
    )
    const clampedOffset = {
      x: clampedCentroidX - centroidX,
      y: clampedCentroidY - centroidY,
    }

    setCountries((prev) =>
      prev.map((country) =>
        country.id === id ? { ...country, offset: clampedOffset } : country
      )
    )
  }

  const handlePointerUp = (
    event: PointerEvent<SVGGElement>,
    id: string
  ) => {
    if (dragState.current?.id !== id) {
      return
    }
    dragState.current = null
    setDraggingId(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const getCurrentLat = (country: CountryDatum) => {
    const [cx, cy] = country.centroidScreen
    const currentPoint: [number, number] = [
      cx + country.offset.x,
      cy + country.offset.y,
    ]
    const inverted = projection.invert(currentPoint)
    return inverted ? inverted[1] : country.originalCentroid[1]
  }

  const selectedDetails = selectedCountry
    ? (() => {
        const currentLat = getCurrentLat(selectedCountry)
        const originalLat = selectedCountry.originalCentroid[1]
        return {
          originalLat,
          currentLat,
          currentScale: getMercatorScale(originalLat, currentLat),
        }
      })()
    : null

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">Mercator True Size Demo</p>
          <h1>Drag countries to compare Mercator sizes by latitude.</h1>
          <p className="subhead">
            Mercator inflates shapes near the poles. Drag a country to a new
            latitude and it resizes as if it belonged there.
          </p>
        </div>
        <div className="math-card">
          <div className="math-label">Mercator distortion</div>
          <div className="math-formula">1 / cos(latitude)</div>
          <div className="math-detail">
            Drag scale = cos(original lat) / cos(current lat)
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="map-shell">
          <div className="map-header">
            <h2>Move the comparison set</h2>
            <p>
              Drag any colored country anywhere on the map. The size updates
              based on its new latitude, just like Mercator does.
            </p>
            <button
              className="reset-button"
              type="button"
              onClick={resetPositions}
            >
              Reset positions
            </button>
          </div>

          <div className="map-frame">
            {loading && <div className="map-loading">Loading map...</div>}
            {error && <div className="map-error">{error}</div>}
            {!loading && !error && (
              <svg
                className="map-svg"
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                role="img"
                aria-label="Mercator world map with draggable countries"
              >
                <defs>
                  <filter
                    id="countryShadow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="10"
                      stdDeviation="8"
                      floodColor="rgba(6, 12, 22, 0.7)"
                    />
                  </filter>
                </defs>

                <rect
                  className="map-ocean"
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                />

                <g className="world-base">
                  {worldFeatures.map((feature, index) => (
                    <path
                      key={`world-${feature.id ?? index}`}
                      d={pathGenerator(feature) ?? ''}
                    />
                  ))}
                </g>

                <g className="lat-lines">
                  {latLines.map((lat) => {
                    const line = {
                      type: 'LineString',
                      coordinates: [
                        [-180, lat],
                        [180, lat],
                      ],
                    } as const
                    const path = pathGenerator(line)
                    if (!path) {
                      return null
                    }
                    return (
                      <path
                        key={`lat-${lat}`}
                        d={path}
                        className={`lat-line ${lat === 0 ? 'equator' : ''}`}
                      />
                    )
                  })}
                </g>

                <g className="lat-labels">
                  {latLines.map((lat) => {
                    const labelPoint = projection([-168, lat])
                    if (!labelPoint) {
                      return null
                    }
                    const label =
                      lat === 0
                        ? 'Equator'
                        : `${Math.abs(lat)}deg${lat > 0 ? 'N' : 'S'}`
                    return (
                      <text
                        key={`label-${lat}`}
                        x={labelPoint[0]}
                        y={labelPoint[1] - 6}
                      >
                        {label}
                      </text>
                    )
                  })}
                </g>

                <g className="countries">
                  {orderedCountries.map((country) => {
                    const [cx, cy] = country.centroidScreen
                    const currentLat = getCurrentLat(country)
                    const currentScale = getMercatorScale(
                      country.originalCentroid[1],
                      currentLat
                    )
                    const isDraggable = draggableIds.includes(country.id)
                    const transform = `translate(${country.offset.x}, ${
                      country.offset.y
                    }) translate(${cx}, ${cy}) scale(${
                      currentScale
                    }) translate(${-cx}, ${-cy})`
                    return (
                      <g
                        key={country.id}
                        className={`country-group ${
                          selectedId === country.id ? 'is-selected' : ''
                        } ${draggingId === country.id ? 'is-dragging' : ''} ${
                          isDraggable ? '' : 'is-disabled'
                        }`}
                        transform={transform}
                        onPointerDown={(event) =>
                          handlePointerDown(event, country)
                        }
                        onPointerMove={(event) =>
                          handlePointerMove(event, country.id)
                        }
                        onPointerUp={(event) =>
                          handlePointerUp(event, country.id)
                        }
                        onPointerCancel={(event) =>
                          handlePointerUp(event, country.id)
                        }
                        role="button"
                        aria-label={`Drag ${country.name}`}
                      >
                        <path
                          className="country-shape"
                          d={pathGenerator(country.feature) ?? ''}
                          fill={country.color}
                        />
                      </g>
                    )
                  })}
                </g>
              </svg>
            )}
          </div>

          <div className="map-footer">
            <div className="legend">
              {draggableCountries.length > 0 ? (
                draggableCountries.map((country) => (
                  <button
                    key={`legend-${country.id}`}
                    className={`legend-item ${
                      selectedId === country.id ? 'is-active' : ''
                    }`}
                    type="button"
                    onClick={() => setSelectedId(country.id)}
                  >
                    <span
                      className="legend-swatch"
                      style={{ backgroundColor: country.color }}
                      aria-hidden="true"
                    />
                    {country.name}
                  </button>
                ))
              ) : (
                <div className="legend-empty">No countries selected yet.</div>
              )}
            </div>
            <p className="map-hint">
              Tip: Move Greenland down near DR Congo to compare the contrast.
            </p>
          </div>
        </section>

        <aside className="info-panel">
          <div className="panel-title">Selected country</div>
          {selectedCountry && selectedDetails ? (
            <div className="panel-content">
              <div className="country-title">
                <span
                  className="color-dot"
                  style={{ backgroundColor: selectedCountry.color }}
                />
                <h3>{selectedCountry.name}</h3>
              </div>
              <div className="panel-metric">
                <span className="metric-label">Original latitude</span>
                <span className="metric-value">
                  {formatLatitude(selectedDetails.originalLat)}
                </span>
              </div>
              <div className="panel-metric">
                <span className="metric-label">Current latitude</span>
                <span className="metric-value">
                  {formatLatitude(selectedDetails.currentLat)}
                </span>
              </div>
              <div className="panel-metric">
                <span className="metric-label">Mercator scale factor</span>
                <span className="metric-value">
                  {formatScale(selectedDetails.currentScale)} of original size
                </span>
              </div>
              <div className="panel-metric">
                <span className="metric-label">Area</span>
                <span className="metric-value">
                  {selectedCountry.area
                    ? `${areaFormatter.format(selectedCountry.area)} km²`
                    : 'Unknown'}
                </span>
              </div>
            </div>
          ) : (
            <div className="panel-empty">
              Select a country to inspect its latitude and scale.
            </div>
          )}
          <div className="panel-section">
            <div className="panel-subtitle">Draggable set</div>
            <div className="drag-search">
              <input
                type="search"
                placeholder="Search countries..."
                value={countryFilter}
                onChange={(event) => setCountryFilter(event.target.value)}
                aria-label="Search countries"
              />
            </div>
            <div className="drag-list">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => {
                const isDraggable = draggableIds.includes(country.id)
                return (
                  <label
                    key={`drag-${country.id}`}
                    className={`drag-item ${
                      isDraggable ? 'is-on' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isDraggable}
                      onChange={() => toggleDraggable(country.id)}
                    />
                    <span
                      className="legend-swatch"
                      style={{ backgroundColor: country.color }}
                      aria-hidden="true"
                    />
                    <span>{country.name}</span>
                  </label>
                )
              })
              ) : (
                <div className="drag-empty">No matches.</div>
              )}
            </div>
          </div>
          <div className="panel-foot">
            Dragging shifts latitude, which updates the Mercator inflation in
            real time.
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
