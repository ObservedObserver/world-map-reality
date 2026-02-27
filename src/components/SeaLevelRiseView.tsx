import { useCallback, useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
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
const WATERMARK_TEXT =
  'runcell.dev/tool/true-size-map/sea-level-rise-simulator'

const PRESET_LEVELS = [0, 2, 10, 30, 70]
const GLOBE_PITCH_DEGREES = 30
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
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapViewModeRef = useRef<MapViewMode>(DEFAULT_MAP_VIEW_MODE)

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
      canvasContextAttributes: {
        preserveDrawingBuffer: true,
      },
    })
    mapRef.current = map
    setMapReady(false)
    setMapError(null)

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
      map.off('load', handleLoad)
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
  }, [mapReady, seaLevel])

  const createExportImage = useCallback(async () => {
    const map = mapRef.current
    if (!mapReady || !map) {
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

    context.drawImage(mapCanvas, 0, 0)

    const fontSize = Math.max(14, Math.round(exportCanvas.width * 0.018))
    const marginBottom = Math.max(18, Math.round(exportCanvas.height * 0.03))
    const paddingX = Math.max(16, Math.round(fontSize * 0.8))
    const paddingY = Math.max(8, Math.round(fontSize * 0.5))
    context.font = `${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
    const textWidth = Math.ceil(context.measureText(WATERMARK_TEXT).width)
    const boxWidth = textWidth + paddingX * 2
    const boxHeight = fontSize + paddingY * 2
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
    context.fillText(
      WATERMARK_TEXT,
      exportCanvas.width / 2,
      boxY + boxHeight / 2
    )

    return exportCanvas.toDataURL('image/png')
  }, [mapReady])

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
              <strong>DEM resolution.</strong> The elevation data has limited
              resolution (~30–90 m per pixel). Narrow waterways, channels, and
              small islands may not be captured accurately — nearby pixels
              average land and water, making some features appear at higher
              elevations than they really are.
            </li>
            <li>
              <strong>Not a scientific projection.</strong> Real-world flooding
              depends on tides, storm surges, land subsidence, ice dynamics, and
              drainage — none of which are modeled here. Use this as an
              educational visualization, not a planning tool.
            </li>
          </ul>
        </details>
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
