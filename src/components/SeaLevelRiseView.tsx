import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const DEFAULT_SEA_LEVEL_METERS = 0
const MIN_SEA_LEVEL_METERS = -5000
const MAX_SEA_LEVEL_METERS = 5000
const DEFAULT_MAP_VIEW_MODE = '2d'
const SEA_LEVEL_LAYER_ID = 'sea-level-overlay'
const SATELLITE_SOURCE_ID = 'satellite-source'
const TERRAIN_SOURCE_ID = 'terrain-source'
const SATELLITE_LAYER_ID = 'satellite-layer'

const PRESET_LEVELS = [0, 2, 10, 30, 70]
const GLOBE_PITCH_DEGREES = 52
const GLOBE_BEARING_DEGREES = -14
const MODE_TRANSITION_MS = 650

type MapViewMode = '2d' | '3d'

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    [SATELLITE_SOURCE_ID]: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution:
        'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxzoom: 18,
    },
    [TERRAIN_SOURCE_ID]: {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      encoding: 'terrarium',
      attribution: 'DEM © elevation-tiles-prod (Terrarium encoding)',
      minzoom: 0,
      maxzoom: 15,
    },
  },
  layers: [
    {
      id: SATELLITE_LAYER_ID,
      type: 'raster',
      source: SATELLITE_SOURCE_ID,
      paint: {
        'raster-resampling': 'linear',
      },
    },
  ],
}

function buildFloodExpression(
  seaLevel: number
): maplibregl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['elevation'],
    -12000,
    'rgba(28, 121, 255, 0.66)',
    seaLevel - 0.001,
    'rgba(28, 121, 255, 0.66)',
    seaLevel,
    'rgba(0, 0, 0, 0)',
    9000,
    'rgba(0, 0, 0, 0)',
  ] as maplibregl.ExpressionSpecification
}

function shouldIgnoreError(message: string | undefined): boolean {
  if (!message) {
    return false
  }
  const normalized = message.toLowerCase()
  return normalized.includes('signal is aborted') || normalized.includes('aborterror')
}

function sampleFloodCoverage(map: maplibregl.Map, seaLevel: number): number | null {
  const canvas = map.getCanvas()
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) {
    return null
  }

  const cols = 16
  const rows = 10
  let total = 0
  let flooded = 0
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      const x = ((cx + 0.5) / cols) * width
      const y = ((cy + 0.5) / rows) * height
      const lngLat = map.unproject([x, y])
      const elevation = map.queryTerrainElevation(lngLat)
      if (elevation === null) {
        continue
      }
      total += 1
      if (elevation < seaLevel) {
        flooded += 1
      }
    }
  }

  if (total === 0) {
    return null
  }
  return Math.round((flooded / total) * 1000) / 10
}

function applyMapViewMode(
  map: maplibregl.Map,
  mode: MapViewMode,
  animate = true
) {
  const duration = animate ? MODE_TRANSITION_MS : 0
  if (mode === '3d') {
    map.setProjection({ type: 'globe' })
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
    map.easeTo({
      pitch: GLOBE_PITCH_DEGREES,
      bearing: GLOBE_BEARING_DEGREES,
      duration,
    })
    return
  }

  map.setProjection({ type: 'mercator' })
  map.dragRotate.disable()
  map.touchZoomRotate.disableRotation()
  map.easeTo({
    pitch: 0,
    bearing: 0,
    duration,
  })
}

const SeaLevelRiseView = () => {
  const [seaLevel, setSeaLevel] = useState(DEFAULT_SEA_LEVEL_METERS)
  const [mapViewMode, setMapViewMode] =
    useState<MapViewMode>(DEFAULT_MAP_VIEW_MODE)
  const [hoverElevation, setHoverElevation] = useState<number | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<number | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const seaLevelRef = useRef(DEFAULT_SEA_LEVEL_METERS)
  const mapViewModeRef = useRef<MapViewMode>(DEFAULT_MAP_VIEW_MODE)

  useEffect(() => {
    seaLevelRef.current = seaLevel
  }, [seaLevel])

  useEffect(() => {
    mapViewModeRef.current = mapViewMode
  }, [mapViewMode])

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as
        | { name?: string; message?: string; stack?: string }
        | undefined
      const message = reason?.message ?? ''
      const stack = reason?.stack ?? ''
      const isMaplibreAbort =
        (reason?.name === 'AbortError' || message.includes('signal is aborted')) &&
        stack.includes('maplibre-gl')
      if (isMaplibreAbort) {
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [8, 20],
      zoom: 1.55,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })
    mapRef.current = map
    setMapReady(false)
    setMapError(null)

    const refreshCoverage = () =>
      setCoverage(sampleFloodCoverage(map, seaLevelRef.current))

    const handleLoad = () => {
      map.addControl(new maplibregl.NavigationControl(), 'top-right')
      map.setTerrain({
        source: TERRAIN_SOURCE_ID,
        exaggeration: 1,
      })
      applyMapViewMode(map, mapViewModeRef.current, false)

      map.addLayer({
        id: SEA_LEVEL_LAYER_ID,
        type: 'color-relief',
        source: TERRAIN_SOURCE_ID,
        paint: {
          'color-relief-color': buildFloodExpression(DEFAULT_SEA_LEVEL_METERS),
          'color-relief-opacity': 1,
        },
      })

      setMapReady(true)
      refreshCoverage()
    }

    const handleMove = (event: maplibregl.MapMouseEvent) => {
      const elevation = map.queryTerrainElevation(event.lngLat)
      setHoverElevation(elevation ?? null)
    }

    const handleError = (event: maplibregl.ErrorEvent) => {
      const message = event.error?.message
      if (shouldIgnoreError(message)) {
        return
      }
      setMapError(message ?? 'Failed to load map resources.')
    }

    map.on('load', handleLoad)
    map.on('mousemove', handleMove)
    map.on('moveend', refreshCoverage)
    map.on('zoomend', refreshCoverage)
    map.on('pitchend', refreshCoverage)
    map.on('rotateend', refreshCoverage)
    map.on('error', handleError)

    return () => {
      map.off('load', handleLoad)
      map.off('mousemove', handleMove)
      map.off('moveend', refreshCoverage)
      map.off('zoomend', refreshCoverage)
      map.off('pitchend', refreshCoverage)
      map.off('rotateend', refreshCoverage)
      map.off('error', handleError)
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) {
      return
    }
    applyMapViewMode(map, mapViewMode)
    setCoverage(sampleFloodCoverage(map, seaLevelRef.current))
  }, [mapReady, mapViewMode])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !map.getLayer(SEA_LEVEL_LAYER_ID)) {
      return
    }
    map.setPaintProperty(
      SEA_LEVEL_LAYER_ID,
      'color-relief-color',
      buildFloodExpression(seaLevel) as maplibregl.ExpressionSpecification
    )
    setCoverage(sampleFloodCoverage(map, seaLevel))
  }, [mapReady, seaLevel])

  return (
    <main className="sea-level-layout">
      <section className="sea-level-panel">
        <div className="sea-level-header">
          <h2>Sea Level Rise Simulator</h2>
          <p>
            MapLibre GL + open data DEM. Areas below the selected sea level are
            highlighted in blue.
          </p>
        </div>

        <div className="sea-level-controls">
          <div className="sea-level-mode-switch" role="group" aria-label="Sea level map mode">
            <button
              type="button"
              className={`sea-level-mode-button ${
                mapViewMode === '2d' ? 'is-active' : ''
              }`}
              aria-pressed={mapViewMode === '2d'}
              onClick={() => setMapViewMode('2d')}
            >
              2D map
            </button>
            <button
              type="button"
              className={`sea-level-mode-button ${
                mapViewMode === '3d' ? 'is-active' : ''
              }`}
              aria-pressed={mapViewMode === '3d'}
              onClick={() => setMapViewMode('3d')}
            >
              3D globe
            </button>
          </div>
          <p className="sea-level-mode-note">
            {mapViewMode === '3d'
              ? '3D mode enabled. Drag to rotate the globe.'
              : '2D mode enabled. Flat Mercator map view.'}
          </p>
          <label htmlFor="sea-level-slider">
            Sea level target: <strong>{seaLevel}m</strong>
          </label>
          <input
            id="sea-level-slider"
            type="range"
            min={MIN_SEA_LEVEL_METERS}
            max={MAX_SEA_LEVEL_METERS}
            step={1}
            value={seaLevel}
            disabled={!mapReady}
            onChange={(event) => setSeaLevel(Number(event.target.value))}
          />
          <div className="sea-level-presets">
            {PRESET_LEVELS.map((level) => (
              <button
                key={`preset-${level}`}
                type="button"
                className={`sea-level-preset ${
                  seaLevel === level ? 'is-active' : ''
                }`}
                disabled={!mapReady}
                onClick={() => setSeaLevel(level)}
              >
                +{level}m
              </button>
            ))}
          </div>
        </div>

        <div className="sea-level-map-shell">
          <div ref={mapContainerRef} className="sea-level-map" />
          {mapError && <div className="sea-level-map-error">{mapError}</div>}
        </div>
      </section>

      <aside className="sea-level-info-card">
        <div className="panel-title">Flood Signal</div>
        <div className="panel-metric">
          <span className="metric-label">Hover elevation</span>
          <span className="metric-value">
            {hoverElevation === null ? '--' : `${Math.round(hoverElevation)} m`}
          </span>
        </div>
        <div className="panel-metric">
          <span className="metric-label">Sampled flooded area</span>
          <span className="metric-value">
            {coverage === null ? '--' : `${coverage}%`}
          </span>
        </div>
        <div className="panel-metric">
          <span className="metric-label">Render mode</span>
          <span className="metric-value">
            {mapViewMode === '3d'
              ? 'color-relief + globe projection'
              : 'color-relief + mercator projection'}
          </span>
        </div>
      </aside>
    </main>
  )
}

export default SeaLevelRiseView
