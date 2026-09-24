import { useCallback, useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const DEFAULT_SEA_LEVEL_METERS = 0
const MIN_SEA_LEVEL_METERS = -5000
const MAX_SEA_LEVEL_METERS = 5000
const DEFAULT_MAP_VIEW_MODE = '2d'
const DEFAULT_DATA_VIEW = 'overview'
const OVERVIEW_MAX_ZOOM = 4
const SEA_LEVEL_LAYER_ID = 'sea-level-overlay'
const SATELLITE_SOURCE_ID = 'satellite-source'
const TERRAIN_SOURCE_ID = 'terrain-source'
const TERRAIN_MESH_SOURCE_ID = 'terrain-mesh-source'
const SATELLITE_LAYER_ID = 'satellite-layer'
const RELIEF_LAYER_ID = 'terrain-relief'
const WATERMARK_TEXT =
  'runcell.dev/tool/true-size-map/sea-level-rise-simulator'

const PRESET_LEVELS = [0, 2, 10, 30, 70]
const GLOBE_PITCH_DEGREES = 30
const GLOBE_BEARING_DEGREES = -14
const MODE_TRANSITION_MS = 650

type MapViewMode = '2d' | '3d'
type DataView = 'overview' | 'detail'
type Rgb = readonly [number, number, number]
// Distance in meters from the waterline, color, and alpha.
type ColorStop = readonly [number, Rgb, number]

const OVERVIEW_TILE_BASE = `${import.meta.env.BASE_URL}maps/sea-level-overview`

// Present-day sea, by depth. Tones follow the NASA Blue Marble bathymetry,
// so the overlay keeps the imagery's own seafloor detail visible.
const OCEAN_STOPS: ColorStop[] = [
  [0, [34, 82, 136], 0.9],
  [15, [32, 78, 132], 0.9],
  [60, [28, 71, 126], 0.9],
  [140, [26, 67, 122], 0.84],
  [220, [25, 64, 119], 0.6],
  [400, [22, 58, 112], 0.46],
  [1500, [16, 46, 98], 0.45],
  [4000, [12, 36, 82], 0.45],
  [11000, [10, 30, 72], 0.45],
]
// Newly flooded land, by water depth: bright shallows at the new shoreline.
const FLOOD_STOPS: ColorStop[] = [
  [0, [104, 184, 200], 0.66],
  [8, [78, 160, 188], 0.72],
  [40, [48, 122, 164], 0.8],
  [120, [34, 90, 144], 0.86],
]
// Seabed exposed by a lower sea, by height above the new waterline.
const SEABED_STOPS: ColorStop[] = [
  [0, [150, 132, 92], 0.86],
  [25, [132, 116, 76], 0.86],
  [150, [118, 106, 72], 0.86],
]

// Seeded so the star field behind the globe is the same on every visit.
const STAR_TILE_SIZE = 480
const STARS = (() => {
  let seed = 20260924
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 64 }, () => ({
    x: Math.round(random() * STAR_TILE_SIZE * 10) / 10,
    y: Math.round(random() * STAR_TILE_SIZE * 10) / 10,
    radius: Math.round((0.4 + random() ** 4 * 0.9) * 100) / 100,
    alpha: Math.round((0.2 + random() * 0.55) * 100) / 100,
  }))
})()

const createElevationSource = (view: DataView) => ({
  type: 'raster-dem' as const,
  tiles: view === 'overview'
    ? [`${OVERVIEW_TILE_BASE}/terrain/{z}/{x}/{y}.png`]
    : ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium' as const,
  attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Mapzen terrain &amp; contributors</a>',
  minzoom: 0,
  maxzoom: view === 'overview' ? OVERVIEW_MAX_ZOOM : 15,
})

// Every layer is in the initial style: adding one to a loaded elevation
// source later makes MapLibre request all of its tiles again.
const createMapStyle = (
  view: DataView,
  seaLevel: number
): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    [SATELLITE_SOURCE_ID]: {
      type: 'raster',
      tiles: view === 'overview'
        ? [`${OVERVIEW_TILE_BASE}/imagery/{z}/{x}/{y}.jpg`]
        : ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      // On high-density screens, request the next zoom level of the small
      // self-hosted set so the default view is not upscaled.
      tileSize: view === 'overview' && window.devicePixelRatio > 1 ? 128 : 256,
      attribution: view === 'overview'
        ? '<a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noopener noreferrer">NASA Earth Observatory</a>'
        : 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxzoom: view === 'overview' ? OVERVIEW_MAX_ZOOM : 18,
    },
    [TERRAIN_SOURCE_ID]: createElevationSource(view),
    // Separate copy for the 3D mesh, so turning it on does not reload the
    // tiles the relief and water layers already use.
    [TERRAIN_MESH_SOURCE_ID]: createElevationSource(view),
  },
  // A thin lit atmosphere rim around the 3D globe. The dark sky colors only
  // show on steeply tilted close-ups.
  sky: {
    'sky-color': '#07111f',
    'horizon-color': '#12243c',
    'fog-color': '#07111f',
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 4, 0.55, 6, 0],
  },
  light: {
    anchor: 'viewport',
    position: [1.5, 330, 30],
  },
  layers: [
    {
      id: SATELLITE_LAYER_ID,
      type: 'raster',
      source: SATELLITE_SOURCE_ID,
      paint: view === 'overview'
        ? {
            'raster-resampling': 'linear',
            'raster-saturation': 0.12,
            'raster-contrast': 0.06,
          }
        : {
            'raster-resampling': 'linear',
          },
    },
    {
      id: RELIEF_LAYER_ID,
      type: 'hillshade',
      source: TERRAIN_SOURCE_ID,
      paint: {
        'hillshade-method': 'multidirectional',
        'hillshade-illumination-direction': [315, 270],
        'hillshade-illumination-altitude': [35, 50],
        'hillshade-shadow-color': ['rgba(6, 12, 28, 0.8)', 'rgba(6, 12, 28, 0.5)'],
        'hillshade-highlight-color': [
          'rgba(255, 246, 224, 0.26)',
          'rgba(255, 246, 224, 0.1)',
        ],
        // Satellite photos carry their own shadows once zoomed in.
        'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 4, 1, 6, 0.6, 10, 0.35],
      },
    },
    {
      id: SEA_LEVEL_LAYER_ID,
      type: 'color-relief',
      source: TERRAIN_SOURCE_ID,
      paint: {
        'color-relief-color': buildFloodExpression(seaLevel),
        'color-relief-opacity': 1,
      },
    },
  ],
})

function sampleColorStops(stops: ColorStop[], distance: number): [Rgb, number] {
  const next = stops.findIndex(([stopDistance]) => stopDistance >= distance)
  if (next <= 0) {
    const [, color, alpha] = stops[next === 0 ? 0 : stops.length - 1]
    return [color, alpha]
  }
  const [fromDistance, fromColor, fromAlpha] = stops[next - 1]
  const [toDistance, toColor, toAlpha] = stops[next]
  const t = (distance - fromDistance) / (toDistance - fromDistance)
  const channel = (index: number) =>
    Math.round(fromColor[index] + (toColor[index] - fromColor[index]) * t)
  return [
    [channel(0), channel(1), channel(2)],
    Math.round((fromAlpha + (toAlpha - fromAlpha) * t) * 1000) / 1000,
  ]
}

function buildFloodExpression(
  seaLevel: number
): maplibregl.ExpressionSpecification {
  const stops: Array<number | string> = []
  const addStop = (elevation: number, [[r, g, b], alpha]: readonly [Rgb, number]) => {
    stops.push(elevation, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  }
  const clear = [[0, 0, 0], 0] as const
  // A rising sea keeps today's seafloor colors; a falling sea shifts them down.
  const waterline = Math.min(seaLevel, 0)

  for (const [depth, color, alpha] of [...OCEAN_STOPS].reverse()) {
    addStop(waterline - Math.max(depth, 0.001), [color, alpha])
  }

  if (seaLevel > 0) {
    addStop(0, sampleColorStops(FLOOD_STOPS, seaLevel))
    for (const [depth, color, alpha] of [...FLOOD_STOPS].reverse()) {
      const elevation = seaLevel - depth
      if (elevation > 0 && elevation < seaLevel - 0.001) {
        addStop(elevation, [color, alpha])
      }
    }
    addStop(seaLevel - 0.001, sampleColorStops(FLOOD_STOPS, 0))
    addStop(seaLevel, clear)
  } else if (seaLevel < 0) {
    addStop(seaLevel, sampleColorStops(SEABED_STOPS, 0))
    for (const [height, color, alpha] of SEABED_STOPS) {
      const elevation = seaLevel + height
      if (elevation > seaLevel && elevation < -0.001) {
        addStop(elevation, [color, alpha])
      }
    }
    addStop(-0.001, sampleColorStops(SEABED_STOPS, -seaLevel))
    addStop(0, clear)
  } else {
    addStop(0, clear)
  }
  addStop(9000, clear)

  return ['interpolate', ['linear'], ['elevation'], ...stops] as maplibregl.ExpressionSpecification
}

function paintSpaceBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number
) {
  context.fillStyle = '#03070e'
  context.fillRect(0, 0, width, height)
  // Matches the map shell's CSS gradient (farthest corner, 62%).
  const glow = context.createRadialGradient(
    width / 2,
    height * 0.55,
    0,
    width / 2,
    height * 0.55,
    Math.hypot(width / 2, height * 0.55) * 0.62
  )
  glow.addColorStop(0, 'rgba(38, 76, 140, 0.24)')
  glow.addColorStop(1, 'rgba(38, 76, 140, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)

  const tile = STAR_TILE_SIZE * scale
  for (let offsetY = 0; offsetY < height; offsetY += tile) {
    for (let offsetX = 0; offsetX < width; offsetX += tile) {
      for (const star of STARS) {
        context.fillStyle = `rgba(255, 255, 255, ${star.alpha})`
        context.beginPath()
        context.arc(
          offsetX + star.x * scale,
          offsetY + star.y * scale,
          star.radius * scale,
          0,
          Math.PI * 2
        )
        context.fill()
      }
    }
  }
}

function shouldIgnoreError(message: string | undefined): boolean {
  if (!message) {
    return false
  }
  const normalized = message.toLowerCase()
  return normalized.includes('signal is aborted') || normalized.includes('aborterror')
}

function applyMapViewMode(
  map: maplibregl.Map,
  mode: MapViewMode,
  view: DataView,
  animate = true
) {
  const duration = animate ? MODE_TRANSITION_MS : 0
  // 3D terrain drapes every layer through an offscreen texture, which softens
  // the imagery. Keep it for tilted close-ups, where the relief is visible.
  const wantsTerrain = mode === '3d' && view === 'detail'
  if (wantsTerrain !== Boolean(map.getTerrain())) {
    map.setTerrain(wantsTerrain ? { source: TERRAIN_MESH_SOURCE_ID, exaggeration: 1 } : null)
  }
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
  const [dataView, setDataView] = useState<DataView>(DEFAULT_DATA_VIEW)
  const [readyMap, setReadyMap] = useState<{
    map: maplibregl.Map
    view: DataView
  } | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapViewModeRef = useRef<MapViewMode>(DEFAULT_MAP_VIEW_MODE)
  const cameraRef = useRef({ center: [8, 20] as [number, number], zoom: 1.55 })
  const seaLevelRef = useRef(DEFAULT_SEA_LEVEL_METERS)
  // Readiness belongs to the loaded map instance, not just the selected view.
  const mapReady = readyMap?.map === mapRef.current && readyMap.view === dataView

  useEffect(() => {
    mapViewModeRef.current = mapViewMode
  }, [mapViewMode])

  useEffect(() => {
    seaLevelRef.current = seaLevel
  }, [seaLevel])

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
      style: createMapStyle(dataView, seaLevelRef.current),
      center: cameraRef.current.center,
      zoom: Math.min(cameraRef.current.zoom, dataView === 'overview' ? OVERVIEW_MAX_ZOOM : 18),
      maxZoom: dataView === 'overview' ? OVERVIEW_MAX_ZOOM : 18,
      pitch: 0,
      bearing: 0,
      attributionControl: {},
      canvasContextAttributes: {
        preserveDrawingBuffer: true,
      },
    })
    mapRef.current = map
    setReadyMap(null)
    setMapError(null)

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const handleLoad = () => {
      applyMapViewMode(map, mapViewModeRef.current, dataView, false)
      setReadyMap({ map, view: dataView })
    }

    const handleError = (event: maplibregl.ErrorEvent) => {
      const message = event.error?.message
      if (shouldIgnoreError(message)) {
        return
      }
      setMapError(message ?? 'Failed to load map resources.')
    }

    map.on('load', handleLoad)
    map.on('error', handleError)

    return () => {
      const center = map.getCenter()
      cameraRef.current = {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      }
      map.off('load', handleLoad)
      map.off('error', handleError)
      map.remove()
      mapRef.current = null
      setReadyMap(null)
    }
  }, [dataView])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || readyMap?.map !== map) {
      return
    }
    // Raster tiles can still be loading when the style already accepts updates.
    applyMapViewMode(map, mapViewMode, dataView)
  }, [dataView, mapReady, mapViewMode, readyMap])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || readyMap?.map !== map || !map.getLayer(SEA_LEVEL_LAYER_ID)) {
      return
    }
    map.setPaintProperty(
      SEA_LEVEL_LAYER_ID,
      'color-relief-color',
      buildFloodExpression(seaLevel) as maplibregl.ExpressionSpecification
    )
  }, [dataView, mapReady, readyMap, seaLevel])

  const createExportImage = useCallback(async () => {
    const map = mapRef.current
    if (!mapReady || readyMap?.map !== map || !map.getLayer(SEA_LEVEL_LAYER_ID)) {
      return null
    }

    await new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) {
          return
        }
        done = true
        resolve()
      }
      map.once('render', finish)
      map.triggerRepaint()
      window.setTimeout(finish, 280)
    })

    const mapCanvas = map.getCanvas()
    if (!mapCanvas.width || !mapCanvas.height) {
      return null
    }

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = mapCanvas.width
    exportCanvas.height = mapCanvas.height
    const context = exportCanvas.getContext('2d')
    if (!context) {
      return null
    }

    // The globe view leaves the canvas transparent around the planet.
    paintSpaceBackdrop(
      context,
      exportCanvas.width,
      exportCanvas.height,
      mapCanvas.width / (mapCanvas.clientWidth || mapCanvas.width)
    )
    context.drawImage(mapCanvas, 0, 0)

    const fontSize = Math.max(14, Math.round(exportCanvas.width * 0.018))
    const marginBottom = Math.max(18, Math.round(exportCanvas.height * 0.03))
    const paddingX = Math.max(16, Math.round(fontSize * 0.8))
    const paddingY = Math.max(8, Math.round(fontSize * 0.5))
    context.font = `${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
    const watermarkLines = context.measureText(WATERMARK_TEXT).width + paddingX * 2 > exportCanvas.width - 24
      ? ['runcell.dev/tool/true-size-map/', 'sea-level-rise-simulator']
      : [WATERMARK_TEXT]
    const textWidth = Math.ceil(Math.max(...watermarkLines.map((line) => context.measureText(line).width)))
    const boxWidth = textWidth + paddingX * 2
    const boxHeight = fontSize * watermarkLines.length + paddingY * 2
    const boxX = (exportCanvas.width - boxWidth) / 2
    const boxY = exportCanvas.height - boxHeight - marginBottom

    context.fillStyle = 'rgba(6, 14, 26, 0.58)'
    context.fillRect(boxX, boxY, boxWidth, boxHeight)
    context.strokeStyle = 'rgba(248, 245, 239, 0.35)'
    context.lineWidth = 1
    context.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1)

    context.fillStyle = 'rgba(248, 245, 239, 0.9)'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    watermarkLines.forEach((line, index) => {
      context.fillText(
        line,
        exportCanvas.width / 2,
        boxY + paddingY + fontSize * (index + 0.5)
      )
    })

    const credits = dataView === 'overview'
      ? ['Imagery: NASA Earth Observatory', 'Terrain: Mapzen and data contributors']
      : [
          'Imagery: Esri, Maxar, Earthstar Geographics',
          'GIS User Community; terrain: Mapzen and data contributors',
        ]
    const creditFontSize = Math.max(10, Math.round(fontSize * 0.65))
    context.font = `${creditFontSize}px "IBM Plex Sans", sans-serif`
    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillStyle = 'rgba(248, 245, 239, 0.95)'
    // Keeps the credits legible over ice and desert.
    context.shadowColor = 'rgba(0, 0, 0, 0.65)'
    context.shadowBlur = Math.round(creditFontSize * 0.3)
    credits.forEach((credit, index) => {
      context.fillText(
        credit,
        12,
        12 + index * Math.round(creditFontSize * 1.3),
        exportCanvas.width - 24
      )
    })

    return exportCanvas.toDataURL('image/png')
  }, [dataView, mapReady, readyMap])

  const generatePreview = useCallback(async () => {
    setPreviewLoading(true)
    setExportError(null)
    try {
      const dataUrl = await createExportImage()
      if (!dataUrl) {
        setExportPreviewUrl(null)
        setExportError('Unable to generate image preview right now.')
        return
      }
      setExportPreviewUrl(dataUrl)
    } catch {
      setExportPreviewUrl(null)
      setExportError(
        'Image export failed. Please try again after the map finishes rendering.'
      )
    } finally {
      setPreviewLoading(false)
    }
  }, [createExportImage])

  const handleOpenDownloadModal = useCallback(() => {
    setDownloadModalOpen(true)
    setExportPreviewUrl(null)
    setExportError(null)
    void generatePreview()
  }, [generatePreview])

  const handleCloseDownloadModal = useCallback(() => {
    setDownloadModalOpen(false)
    setExportPreviewUrl(null)
    setPreviewLoading(false)
    setExportError(null)
  }, [])

  const handleDownload = useCallback(() => {
    if (!exportPreviewUrl) {
      return
    }
    const levelTag =
      seaLevel >= 0 ? `${seaLevel}m` : `minus-${Math.abs(seaLevel)}m`
    const link = document.createElement('a')
    link.download = `sea-level-${mapViewMode}-${levelTag}.png`
    link.href = exportPreviewUrl
    link.click()
  }, [exportPreviewUrl, mapViewMode, seaLevel])

  useEffect(() => {
    if (!downloadModalOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseDownloadModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [downloadModalOpen, handleCloseDownloadModal])

  return (
    <main className="sea-level-layout">
      <section className="sea-level-panel">
        <div className="sea-level-header">
          <h2>Sea Level Rise Simulator</h2>
          <p>
            Interactive Sea Level Rise Simulator online. MapLibre GL + open data DEM. Areas below the selected sea level are
            highlighted in blue.
          </p>
        </div>

        <div className="sea-level-controls">
          <div className="sea-level-data-switch" role="group" aria-label="Map detail level">
            <button
              type="button"
              className={`sea-level-data-button ${dataView === 'overview' ? 'is-active' : ''}`}
              aria-pressed={dataView === 'overview'}
              disabled={!mapReady && !mapError}
              onClick={() => setDataView('overview')}
            >
              Global overview
            </button>
            <button
              type="button"
              className={`sea-level-data-button ${dataView === 'detail' ? 'is-active' : ''}`}
              aria-pressed={dataView === 'detail'}
              disabled={!mapReady && !mapError}
              onClick={() => setDataView('detail')}
            >
              Satellite detail
            </button>
          </div>
          <p className="sea-level-mode-note">
            {dataView === 'overview'
              ? 'Global preview uses map data hosted on this site. Select satellite detail to zoom in farther.'
              : 'Satellite detail loads Esri imagery and higher-resolution terrain tiles as you explore.'}
          </p>
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
          <div className="sea-level-presets-row">
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
            <div className="sea-level-actions">
              <button
                type="button"
                className="github-button button-with-icon"
                onClick={handleOpenDownloadModal}
                disabled={!mapReady || Boolean(mapError)}
              >
                <Download size={15} aria-hidden="true" />
                Export image
              </button>
            </div>
          </div>
        </div>

        <div className="sea-level-map-shell">
          <svg className="sea-level-starfield" aria-hidden="true" focusable="false">
            <defs>
              <pattern
                id="sea-level-stars"
                width={STAR_TILE_SIZE}
                height={STAR_TILE_SIZE}
                patternUnits="userSpaceOnUse"
              >
                {STARS.map((star, index) => (
                  <circle
                    key={index}
                    cx={star.x}
                    cy={star.y}
                    r={star.radius}
                    fill="#fff"
                    fillOpacity={star.alpha}
                  />
                ))}
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#sea-level-stars)" />
          </svg>
          <div ref={mapContainerRef} className="sea-level-map" />
          {mapError && <div className="sea-level-map-error">{mapError}</div>}
        </div>

        <details className="sea-level-disclaimer">
          <summary>About accuracy &amp; limitations</summary>
          <ul>
            <li>
              <strong>Elevation-based only.</strong> This tool highlights all
              areas below the selected elevation, not a true flood simulation.
              Inland depressions (e.g. Lake Eyre, Death Valley) may appear
              flooded even though no connected waterway exists from the ocean.
            </li>
            <li>
              <strong>DEM resolution.</strong> The default global overview uses
              terrain tiles through zoom level 4, so it shows broad regions,
              not individual streets or small sea-level changes. Satellite
              detail loads finer terrain data, though narrow channels, sea
              walls, and small islands may still be averaged out.
            </li>
            <li>
              <strong>Not a scientific projection.</strong> Real-world flooding
              depends on tides, storm surges, land subsidence, ice dynamics, and
              drainage — none of which are modeled here. Use this as an
              educational visualization, not a planning tool.
            </li>
          </ul>
          <p>
            Overview imagery: NASA Earth Observatory Blue Marble Next Generation.
            Terrain: Mapzen terrain tiles and their{' '}
            <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">
              data contributors
            </a>.
          </p>
        </details>

        <a
          className="sea-level-mars-recommendation"
          href="https://tinytovast.com/mars-sea-level-simulator"
        >
          <img
            src={`${import.meta.env.BASE_URL}mars-sea-level-simulator.jpg`}
            alt="Mars globe with a hypothetical blue ocean across its lowlands"
            width="1727"
            height="911"
            loading="lazy"
          />
          <span className="sea-level-mars-recommendation-copy">
            <span className="sea-level-mars-recommendation-eyebrow">Explore another world</span>
            <strong>Mars Sea Level Simulator</strong>
            <span>Give Mars a waterline and see which landscapes turn blue.</span>
            <span className="sea-level-mars-recommendation-cta">Try the Mars tool →</span>
          </span>
        </a>

        <p className="sea-level-related">
          More map tools:{' '}
          <a href="/tool/true-size-map/asteroid-impact-simulator">
            Asteroid Impact Simulator
          </a>{' '}
          ·{' '}
          <a href="/tool/true-size-map">True Size of Countries Map</a>
        </p>
      </section>
      {downloadModalOpen && (
        <div className="download-modal" role="dialog" aria-modal="true">
          <div
            className="download-backdrop"
            onClick={handleCloseDownloadModal}
            aria-hidden="true"
          />
          <div className="download-dialog sea-level-export-dialog" role="document">
            <div className="download-header">
              <div>
                <div className="download-title">Export image</div>
                <p className="download-subtitle">
                  Preview includes current sea-level effect and watermark.
                </p>
              </div>
            </div>
            <div className="download-preview sea-level-export-preview">
              {exportPreviewUrl ? (
                <img src={exportPreviewUrl} alt="Sea level map export preview" />
              ) : (
                <div className="download-preview-placeholder">
                  {previewLoading ? 'Generating preview...' : 'No preview'}
                </div>
              )}
            </div>
            {exportError && <p className="sea-level-export-error">{exportError}</p>}
            <div className="sea-level-export-actions">
              <button
                type="button"
                className="github-button button-with-icon"
                onClick={handleDownload}
                disabled={!exportPreviewUrl || previewLoading}
              >
                <Download size={15} aria-hidden="true" />
                Download
              </button>
              <button
                type="button"
                className="reset-button"
                onClick={handleCloseDownloadModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}

export default SeaLevelRiseView
