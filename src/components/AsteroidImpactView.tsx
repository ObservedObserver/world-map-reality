import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Download, Flame, LocateFixed } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  COMPOSITIONS,
  buildSummary,
  compositionLabel,
  computeImpact,
  formatCount,
  formatDistance,
  formatEnergy,
  formatRecurrence,
} from '../utils/asteroidPhysics'
import type {
  AsteroidParams,
  CompositionId,
  EffectKind,
  EffectZone,
} from '../utils/asteroidPhysics'

const SATELLITE_SOURCE_ID = 'satellite-source'
const SATELLITE_LAYER_ID = 'satellite-layer'
const ZONES_SOURCE_ID = 'impact-zones'
const ZONES_FILL_LAYER_ID = 'impact-zones-fill'
const ZONES_LINE_LAYER_ID = 'impact-zones-line'
const WATERMARK_TEXT = 'runcell.dev/tool/true-size-map/asteroid-impact-simulator'

const MIN_DIAMETER = 1
const MAX_DIAMETER = 100000
const MIN_SPEED = 11
const MAX_SPEED = 72
const MIN_ANGLE = 5
const MAX_ANGLE = 90

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
  },
  layers: [
    {
      id: SATELLITE_LAYER_ID,
      type: 'raster',
      source: SATELLITE_SOURCE_ID,
      paint: { 'raster-resampling': 'linear' },
    },
  ],
}

// Warm danger palette over the cool satellite basemap.
const ZONE_COLORS: Record<string, string> = {
  crater: '#3b0a0a',
  fireball: '#ff7a18',
  'thermal-3rd': '#fb923c',
  'thermal-2nd': '#fbbf24',
  'thermal-1st': '#fde68a',
  'blast-20psi': '#ef4444',
  'blast-5psi': '#f87171',
  'blast-1psi': '#fca5a5',
}

const FILL_OPACITY: Record<EffectKind, number> = {
  crater: 0.85,
  fireball: 0.6,
  thermal: 0.16,
  blast: 0.14,
}

type DefaultLocation = { name: string; lng: number; lat: number }

const DEFAULT_LOCATIONS: DefaultLocation[] = [
  { name: 'New York City', lng: -73.9857, lat: 40.7484 },
  { name: 'London', lng: -0.1276, lat: 51.5072 },
  { name: 'Tokyo', lng: 139.6917, lat: 35.6895 },
  { name: 'Delhi', lng: 77.209, lat: 28.6139 },
]

type Preset = {
  id: string
  name: string
  blurb: string
  params: AsteroidParams
}

const PRESETS: Preset[] = [
  {
    id: 'chelyabinsk',
    name: 'Chelyabinsk',
    blurb: '2013 airburst over Russia',
    params: { diameterM: 19, speedKmS: 19, angleDeg: 18, composition: 'rock' },
  },
  {
    id: 'tunguska',
    name: 'Tunguska',
    blurb: '1908 Siberian airburst',
    params: { diameterM: 55, speedKmS: 27, angleDeg: 45, composition: 'porous' },
  },
  {
    id: 'barringer',
    name: 'Meteor Crater',
    blurb: 'Arizona iron impactor',
    params: { diameterM: 50, speedKmS: 13, angleDeg: 45, composition: 'iron' },
  },
  {
    id: 'apophis',
    name: 'Apophis',
    blurb: 'Hypothetical 99942 strike',
    params: { diameterM: 370, speedKmS: 13, angleDeg: 45, composition: 'rock' },
  },
  {
    id: 'chicxulub',
    name: 'Chicxulub',
    blurb: 'The dinosaur-killer',
    params: { diameterM: 10000, speedKmS: 20, angleDeg: 45, composition: 'rock' },
  },
]

const DENSITY_OPTIONS = [
  { id: 'rural', label: 'Rural (50/km²)', value: 50 },
  { id: 'suburban', label: 'Suburban (1,500/km²)', value: 1500 },
  { id: 'urban', label: 'Urban (6,000/km²)', value: 6000 },
  { id: 'dense', label: 'Dense city (15,000/km²)', value: 15000 },
] as const

const DEFAULT_PARAMS: AsteroidParams = {
  diameterM: 120,
  speedKmS: 17,
  angleDeg: 45,
  composition: 'rock',
}

// Map a 0..1 slider position to a logarithmic diameter and back.
function sliderToDiameter(t: number): number {
  const value = Math.exp(Math.log(MIN_DIAMETER) + t * (Math.log(MAX_DIAMETER) - Math.log(MIN_DIAMETER)))
  return Math.round(value)
}
function diameterToSlider(diameter: number): number {
  return (
    (Math.log(diameter) - Math.log(MIN_DIAMETER)) /
    (Math.log(MAX_DIAMETER) - Math.log(MIN_DIAMETER))
  )
}

function circlePolygon(
  center: { lng: number; lat: number },
  radiusM: number,
  zone: EffectZone,
  steps = 128
): Feature<Polygon> {
  const earthRadius = 6371000
  const latR = (center.lat * Math.PI) / 180
  const lngR = (center.lng * Math.PI) / 180
  const angular = radiusM / earthRadius
  const ring: number[][] = []
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps
    const lat2 = Math.asin(
      Math.sin(latR) * Math.cos(angular) + Math.cos(latR) * Math.sin(angular) * Math.cos(bearing)
    )
    const lng2 =
      lngR +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latR),
        Math.cos(angular) - Math.sin(latR) * Math.sin(lat2)
      )
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }
  return {
    type: 'Feature',
    properties: {
      id: zone.id,
      color: ZONE_COLORS[zone.id] ?? '#ff7a18',
      fillOpacity: FILL_OPACITY[zone.kind],
    },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

function shouldIgnoreError(message: string | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes('signal is aborted') || normalized.includes('aborterror')
}

const AsteroidImpactView = () => {
  const [params, setParams] = useState<AsteroidParams>(DEFAULT_PARAMS)
  const [impactPoint, setImpactPoint] = useState({ lng: DEFAULT_LOCATIONS[0].lng, lat: DEFAULT_LOCATIONS[0].lat })
  const [locationName, setLocationName] = useState(DEFAULT_LOCATIONS[0].name)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [densityId, setDensityId] = useState<(typeof DENSITY_OPTIONS)[number]['id']>('urban')

  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const impactPointRef = useRef(impactPoint)

  const result = useMemo(() => computeImpact(params), [params])

  useEffect(() => {
    impactPointRef.current = impactPoint
  }, [impactPoint])

  // Suppress benign MapLibre tile-abort rejections (matches the sea-level tool).
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string; stack?: string } | undefined
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
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  const zoneCollection = useMemo<FeatureCollection<Polygon>>(
    () => ({
      type: 'FeatureCollection',
      features: result.zones.map((zone) => circlePolygon(impactPoint, zone.radiusM, zone)),
    }),
    [result.zones, impactPoint]
  )

  const fitMap = useCallback(
    (center: { lng: number; lat: number }, outerRadiusM: number) => {
      const map = mapRef.current
      if (!map) return
      const outer = outerRadiusM || 5000
      const bounds = new maplibregl.LngLatBounds()
      const earthRadius = 6371000
      const latR = (center.lat * Math.PI) / 180
      const lngR = (center.lng * Math.PI) / 180
      const angular = (outer * 1.15) / earthRadius
      for (let i = 0; i < 32; i += 1) {
        const bearing = (2 * Math.PI * i) / 32
        const lat2 = Math.asin(
          Math.sin(latR) * Math.cos(angular) + Math.cos(latR) * Math.sin(angular) * Math.cos(bearing)
        )
        const lng2 =
          lngR +
          Math.atan2(
            Math.sin(bearing) * Math.sin(angular) * Math.cos(latR),
            Math.cos(angular) - Math.sin(latR) * Math.sin(lat2)
          )
        bounds.extend([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
      }
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 700 })
    },
    []
  )

  // Bumping this triggers a re-fit on the next render, after `result` has been
  // recomputed — so a preset switch always frames the new impact, not the old one.
  const [fitRequest, setFitRequest] = useState(0)
  const requestFit = useCallback(() => setFitRequest((value) => value + 1), [])

  // Create the map once.
  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [impactPointRef.current.lng, impactPointRef.current.lat],
      zoom: 9,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    mapRef.current = map
    setMapReady(false)
    setMapError(null)

    const handleLoad = () => {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

      map.addSource(ZONES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: ZONES_FILL_LAYER_ID,
        type: 'fill',
        source: ZONES_SOURCE_ID,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['get', 'fillOpacity'],
        },
      })
      map.addLayer({
        id: ZONES_LINE_LAYER_ID,
        type: 'line',
        source: ZONES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.5,
          'line-opacity': 0.9,
        },
      })

      const element = document.createElement('div')
      element.className = 'asteroid-impact-marker'
      element.setAttribute('aria-hidden', 'true')
      const marker = new maplibregl.Marker({ element, draggable: true, anchor: 'center' })
        .setLngLat([impactPointRef.current.lng, impactPointRef.current.lat])
        .addTo(map)
      marker.on('dragend', () => {
        const next = marker.getLngLat()
        setImpactPoint({ lng: next.lng, lat: next.lat })
        setLocationName('')
      })
      markerRef.current = marker

      setMapReady(true)
    }

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      setImpactPoint({ lng: event.lngLat.lng, lat: event.lngLat.lat })
      setLocationName('')
    }

    const handleError = (event: maplibregl.ErrorEvent) => {
      const message = event.error?.message
      if (shouldIgnoreError(message)) return
      setMapError(message ?? 'Failed to load map resources.')
    }

    map.on('load', handleLoad)
    map.on('click', handleClick)
    map.on('error', handleError)

    return () => {
      map.off('load', handleLoad)
      map.off('click', handleClick)
      map.off('error', handleError)
      markerRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  // Push effect zones to the map whenever they change.
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    const source = map.getSource(ZONES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(zoneCollection)
  }, [mapReady, zoneCollection])

  // Keep the marker in sync with the impact point.
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const current = marker.getLngLat()
    if (Math.abs(current.lng - impactPoint.lng) > 1e-9 || Math.abs(current.lat - impactPoint.lat) > 1e-9) {
      marker.setLngLat([impactPoint.lng, impactPoint.lat])
    }
  }, [impactPoint, mapReady])

  // Fit the map to the current impact on first load and whenever a fit is
  // requested (preset / city / geolocation). Reads the freshly recomputed
  // `result`, so the framing always matches the active scenario.
  useEffect(() => {
    if (!mapReady) return
    fitMap(impactPoint, result.zones[0]?.radiusM ?? 5000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, fitRequest])

  const applyPreset = useCallback(
    (preset: Preset) => {
      setParams(preset.params)
      setActivePreset(preset.id)
      requestFit()
    },
    [requestFit]
  )

  const updateParam = useCallback(<K extends keyof AsteroidParams>(key: K, value: AsteroidParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }))
    setActivePreset(null)
  }, [])

  const selectLocation = useCallback(
    (location: DefaultLocation) => {
      setImpactPoint({ lng: location.lng, lat: location.lat })
      setLocationName(location.name)
      requestFit()
    },
    [requestFit]
  )

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lng: position.coords.longitude, lat: position.coords.latitude }
        setImpactPoint(next)
        setLocationName('your location')
        setLocating(false)
        requestFit()
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }, [requestFit])

  const summary = useMemo(
    () => buildSummary(params, result, locationName),
    [params, result, locationName]
  )

  const density = DENSITY_OPTIONS.find((option) => option.id === densityId) ?? DENSITY_OPTIONS[2]
  const casualtyZone =
    result.zones.find((zone) => zone.id === 'blast-5psi') ??
    result.zones.find((zone) => zone.kind === 'blast') ??
    result.zones.find((zone) => zone.id === 'fireball')
  const casualtyAreaKm2 = casualtyZone
    ? Math.PI * (casualtyZone.radiusM / 1000) ** 2
    : 0
  const estimatedPeople = casualtyAreaKm2 * density.value

  // ---- Image export (share card) ----
  const createExportImage = useCallback(async () => {
    const map = mapRef.current
    if (!mapReady || !map) return null

    await new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      map.once('render', finish)
      map.triggerRepaint()
      window.setTimeout(finish, 320)
    })

    const mapCanvas = map.getCanvas()
    if (!mapCanvas.width || !mapCanvas.height) return null

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = mapCanvas.width
    exportCanvas.height = mapCanvas.height
    const context = exportCanvas.getContext('2d')
    if (!context) return null
    context.drawImage(mapCanvas, 0, 0)

    // Crosshair at the impact point (the DOM marker is not on the canvas).
    // project() returns CSS pixels; the canvas is at device resolution, so
    // scale by the device-pixel ratio to land it on the impact center.
    const ratio = mapCanvas.clientWidth ? mapCanvas.width / mapCanvas.clientWidth : 1
    const point = map.project([impactPoint.lng, impactPoint.lat])
    const cx = point.x * ratio
    const cy = point.y * ratio
    const ring = 10 * ratio
    const arm = 16 * ratio
    context.strokeStyle = 'rgba(255, 255, 255, 0.92)'
    context.lineWidth = 2 * ratio
    context.beginPath()
    context.arc(cx, cy, ring, 0, Math.PI * 2)
    context.moveTo(cx - arm, cy)
    context.lineTo(cx + arm, cy)
    context.moveTo(cx, cy - arm)
    context.lineTo(cx, cy + arm)
    context.stroke()

    // Headline caption.
    const caption = `${formatDistance(params.diameterM)} ${compositionLabel(params.composition)} @ ${params.speedKmS} km/s → ${formatEnergy(result.megatons)}`
    const fontSize = Math.max(15, Math.round(exportCanvas.width * 0.02))
    context.font = `600 ${fontSize}px "Space Grotesk", "Segoe UI", sans-serif`
    const captionWidth = Math.ceil(context.measureText(caption).width)

    const watermarkFont = Math.max(12, Math.round(exportCanvas.width * 0.014))
    context.font = `${watermarkFont}px "IBM Plex Sans", "Segoe UI", sans-serif`
    const watermarkWidth = Math.ceil(context.measureText(WATERMARK_TEXT).width)

    const padX = Math.round(fontSize * 0.9)
    const padY = Math.round(fontSize * 0.7)
    const boxWidth = Math.max(captionWidth, watermarkWidth) + padX * 2
    const lineGap = Math.round(fontSize * 0.5)
    const boxHeight = fontSize + watermarkFont + lineGap + padY * 2
    const boxX = (exportCanvas.width - boxWidth) / 2
    const boxY = exportCanvas.height - boxHeight - Math.round(exportCanvas.height * 0.03)

    context.fillStyle = 'rgba(8, 14, 26, 0.72)'
    context.fillRect(boxX, boxY, boxWidth, boxHeight)
    context.strokeStyle = 'rgba(110, 231, 249, 0.4)'
    context.lineWidth = 1
    context.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1)

    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.fillStyle = 'rgba(248, 245, 239, 0.97)'
    context.font = `600 ${fontSize}px "Space Grotesk", "Segoe UI", sans-serif`
    context.fillText(caption, exportCanvas.width / 2, boxY + padY)
    context.fillStyle = 'rgba(110, 231, 249, 0.85)'
    context.font = `${watermarkFont}px "IBM Plex Sans", "Segoe UI", sans-serif`
    context.fillText(WATERMARK_TEXT, exportCanvas.width / 2, boxY + padY + fontSize + lineGap)

    return exportCanvas.toDataURL('image/png')
  }, [mapReady, impactPoint, params, result.megatons])

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
      setExportError('Image export failed. Please try again after the map finishes rendering.')
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
    if (!exportPreviewUrl) return
    const link = document.createElement('a')
    link.download = `asteroid-impact-${params.diameterM}m-${params.speedKmS}kms.png`
    link.href = exportPreviewUrl
    link.click()
  }, [exportPreviewUrl, params.diameterM, params.speedKmS])

  useEffect(() => {
    if (!downloadModalOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseDownloadModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [downloadModalOpen, handleCloseDownloadModal])

  const energyText = formatEnergy(result.megatons)
  const outcomeBadge =
    result.outcome === 'airburst'
      ? `Airburst ${result.burstAltitudeM !== null ? `at ${formatDistance(result.burstAltitudeM)}` : ''}`
      : result.craterType === 'complex'
        ? 'Complex crater'
        : 'Simple crater'

  return (
    <main className="asteroid-layout">
      <div className="asteroid-stage">
        <section className="asteroid-controls-card" aria-label="Impact controls">
          <div className="asteroid-presets-group">
            <span className="asteroid-control-label">Famous impacts</span>
            <div className="asteroid-presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`asteroid-preset ${activePreset === preset.id ? 'is-active' : ''}`}
                  onClick={() => applyPreset(preset)}
                  title={preset.blurb}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="asteroid-control">
            <label htmlFor="asteroid-diameter">
              Diameter <strong>{formatDistance(params.diameterM)}</strong>
            </label>
            <input
              id="asteroid-diameter"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(diameterToSlider(params.diameterM) * 1000)}
              onChange={(event) =>
                updateParam('diameterM', sliderToDiameter(Number(event.target.value) / 1000))
              }
            />
          </div>

          <div className="asteroid-control">
            <label htmlFor="asteroid-speed">
              Speed <strong>{params.speedKmS} km/s</strong>
            </label>
            <input
              id="asteroid-speed"
              type="range"
              min={MIN_SPEED}
              max={MAX_SPEED}
              step={1}
              value={params.speedKmS}
              onChange={(event) => updateParam('speedKmS', Number(event.target.value))}
            />
          </div>

          <div className="asteroid-control">
            <label htmlFor="asteroid-angle">
              Impact angle <strong>{params.angleDeg}°</strong>
            </label>
            <input
              id="asteroid-angle"
              type="range"
              min={MIN_ANGLE}
              max={MAX_ANGLE}
              step={1}
              value={params.angleDeg}
              onChange={(event) => updateParam('angleDeg', Number(event.target.value))}
            />
          </div>

          <div className="asteroid-control">
            <span className="asteroid-control-label">Composition</span>
            <div className="asteroid-composition">
              {COMPOSITIONS.map((composition) => (
                <button
                  key={composition.id}
                  type="button"
                  className={`asteroid-composition-button ${
                    params.composition === composition.id ? 'is-active' : ''
                  }`}
                  onClick={() => updateParam('composition', composition.id as CompositionId)}
                >
                  {composition.label}
                </button>
              ))}
            </div>
          </div>

          <div className="asteroid-location">
            <span className="asteroid-control-label">Impact site — tap the map or pick a city</span>
            <div className="asteroid-location-row">
              {DEFAULT_LOCATIONS.map((location) => (
                <button
                  key={location.name}
                  type="button"
                  className={`asteroid-city ${locationName === location.name ? 'is-active' : ''}`}
                  onClick={() => selectLocation(location)}
                >
                  {location.name}
                </button>
              ))}
              <button
                type="button"
                className="asteroid-city asteroid-city-locate"
                onClick={useMyLocation}
                disabled={locating}
              >
                <LocateFixed size={13} aria-hidden="true" />
                {locating ? 'Locating…' : 'My location'}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="github-button button-with-icon asteroid-export-button"
            onClick={handleOpenDownloadModal}
            disabled={!mapReady || Boolean(mapError)}
          >
            <Download size={15} aria-hidden="true" />
            Export impact image
          </button>
        </section>

        <div className="asteroid-map-shell">
          <div ref={mapContainerRef} className="asteroid-map" />
          <div className="asteroid-map-hint">
            <Crosshair size={13} aria-hidden="true" /> Tap anywhere to move the impact point
          </div>
          {mapError && <div className="asteroid-map-error">{mapError}</div>}
        </div>
      </div>

      <section className="asteroid-results" aria-label="Impact results">
        <div className="asteroid-headline">
          <div className="asteroid-headline-energy">
            <span className="asteroid-stat-kicker">Impact energy</span>
            <strong>{energyText}</strong>
            <span className="asteroid-headline-sub">
              {result.hiroshimas >= 1
                ? `${formatCount(result.hiroshimas)}× the Hiroshima bomb`
                : `${(result.megatons * 1e6).toFixed(0)} tons of TNT`}
            </span>
          </div>
          <div className={`asteroid-outcome-badge ${result.outcome}`}>
            <Flame size={14} aria-hidden="true" />
            {outcomeBadge}
          </div>
        </div>

        <div className="asteroid-stat-grid">
          {result.craterDiameterM !== null && (
            <article className="asteroid-stat">
              <span className="asteroid-stat-label">Crater width</span>
              <strong>{formatDistance(result.craterDiameterM)}</strong>
            </article>
          )}
          <article className="asteroid-stat">
            <span className="asteroid-stat-label">Fireball radius</span>
            <strong>{formatDistance(result.fireballRadiusM)}</strong>
          </article>
          <article className="asteroid-stat">
            <span className="asteroid-stat-label">Seismic magnitude</span>
            <strong>{result.seismicMagnitude.toFixed(1)}</strong>
          </article>
          <article className="asteroid-stat">
            <span className="asteroid-stat-label">Recurrence</span>
            <strong>~1 / {formatRecurrence(result.recurrenceYears)}</strong>
          </article>
        </div>

        <p className="asteroid-summary">{summary}</p>

        <div className="asteroid-legend" aria-label="Effect zones">
          <span className="asteroid-control-label">Effect zones (radius from impact)</span>
          {result.zones.length === 0 && (
            <p className="asteroid-legend-empty">No significant ground effects at this size.</p>
          )}
          {result.zones.map((zone) => (
            <div className="asteroid-legend-row" key={zone.id}>
              <span
                className="asteroid-legend-swatch"
                style={{ backgroundColor: ZONE_COLORS[zone.id] ?? '#ff7a18' }}
                aria-hidden="true"
              />
              <span className="asteroid-legend-label">{zone.label}</span>
              <span className="asteroid-legend-radius">{formatDistance(zone.radiusM)}</span>
            </div>
          ))}
        </div>

        {casualtyZone && (
          <div className="asteroid-population">
            <p>
              Roughly <strong>{formatCount(estimatedPeople)}</strong> people live inside the{' '}
              {casualtyZone.kind === 'blast' ? 'building-collapse' : casualtyZone.label.toLowerCase()}{' '}
              zone (≈{formatCount(casualtyAreaKm2)} km²) at{' '}
              <select
                className="asteroid-density-select"
                value={densityId}
                onChange={(event) =>
                  setDensityId(event.target.value as (typeof DENSITY_OPTIONS)[number]['id'])
                }
              >
                {DENSITY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              .
            </p>
            <span className="asteroid-population-note">
              Rough estimate — assumes uniform population density, not real census data.
            </span>
          </div>
        )}

        <details className="asteroid-methodology">
          <summary>Model &amp; assumptions</summary>
          <ul>
            <li>
              Effects use the <strong>Earth Impact Effects Program</strong> (Collins, Melosh &amp;
              Marcus, 2005): atmospheric entry and break-up, crater scaling, fireball thermal
              radiation, seismic magnitude, and air-blast overpressure.
            </li>
            <li>
              Small or weak impactors disrupt in the atmosphere as an <strong>airburst</strong> and
              form no crater; larger or denser bodies reach the ground and excavate a crater.
            </li>
            <li>
              The target is assumed to be land (sedimentary rock). Ocean impacts, tsunamis, ejecta,
              and global climate effects are not modeled.
            </li>
            <li>
              Results are order-of-magnitude estimates with large uncertainties, especially for
              airburst blast and very large impacts — use them for education, not planning.
            </li>
          </ul>
        </details>
      </section>

      {downloadModalOpen && (
        <div className="download-modal" role="dialog" aria-modal="true">
          <div className="download-backdrop" onClick={handleCloseDownloadModal} aria-hidden="true" />
          <div className="download-dialog sea-level-export-dialog" role="document">
            <div className="download-header">
              <div>
                <div className="download-title">Export impact image</div>
                <p className="download-subtitle">
                  Preview includes the effect zones, impact marker, and a caption.
                </p>
              </div>
            </div>
            <div className="download-preview sea-level-export-preview">
              {exportPreviewUrl ? (
                <img src={exportPreviewUrl} alt="Asteroid impact map export preview" />
              ) : (
                <div className="download-preview-placeholder">
                  {previewLoading ? 'Generating preview…' : 'No preview'}
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
              <button type="button" className="reset-button" onClick={handleCloseDownloadModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default AsteroidImpactView
