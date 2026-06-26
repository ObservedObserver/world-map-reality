import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Download, LocateFixed, Radiation } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  buildSummary,
  computeBlast,
  formatCount,
  formatDistance,
  formatDistanceBoth,
  formatYield,
} from '../utils/nuclearBlastPhysics'
import type {
  BurstMode,
  EffectKind,
  EffectZone,
  NuclearParams,
} from '../utils/nuclearBlastPhysics'

const SATELLITE_SOURCE_ID = 'satellite-source'
const SATELLITE_LAYER_ID = 'satellite-layer'
const ZONES_SOURCE_ID = 'blast-zones'
const ZONES_FILL_LAYER_ID = 'blast-zones-fill'
const ZONES_LINE_LAYER_ID = 'blast-zones-line'
const WATERMARK_TEXT = 'runcell.dev/tool/true-size-map/nuclear-blast-radius-map'

const MIN_YIELD = 1 // kt
const MAX_YIELD = 100000 // kt (100 Mt — Tsar Bomba design ceiling)

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

// Distinct danger palette: hot yellow core, reds/oranges for blast & heat,
// green for radiation so it stands apart from the pressure rings.
const ZONE_COLORS: Record<string, string> = {
  fireball: '#fde047',
  'blast-20psi': '#dc2626',
  'thermal-3rd': '#fb923c',
  'radiation-500rem': '#65a30d',
  'blast-5psi': '#f87171',
  'blast-1psi': '#fcd34d',
}

const FILL_OPACITY: Record<EffectKind, number> = {
  fireball: 0.7,
  blast: 0.16,
  thermal: 0.16,
  radiation: 0.18,
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
  yieldKt: number
}

// Yields are the publicly documented approximate values for each weapon.
const PRESETS: Preset[] = [
  { id: 'hiroshima', name: 'Hiroshima', blurb: '"Little Boy", ~15 kt (1945)', yieldKt: 15 },
  { id: 'nagasaki', name: 'Nagasaki', blurb: '"Fat Man", ~21 kt (1945)', yieldKt: 21 },
  { id: 'tactical', name: 'Tactical', blurb: 'Modern tactical warhead, ~50 kt', yieldKt: 50 },
  { id: 'w87', name: 'W87', blurb: 'US ICBM warhead, ~300 kt', yieldKt: 300 },
  { id: 'b83', name: 'B83', blurb: 'Largest US bomb, ~1.2 Mt', yieldKt: 1200 },
  { id: 'tsar', name: 'Tsar Bomba', blurb: 'Largest ever tested, ~50 Mt', yieldKt: 50000 },
]

const DENSITY_OPTIONS = [
  { id: 'rural', label: 'Rural (50/km²)', value: 50 },
  { id: 'suburban', label: 'Suburban (1,500/km²)', value: 1500 },
  { id: 'urban', label: 'Urban (6,000/km²)', value: 6000 },
  { id: 'dense', label: 'Dense city (15,000/km²)', value: 15000 },
] as const

const DEFAULT_PARAMS: NuclearParams = {
  yieldKt: 300,
  burst: 'air',
}
const DEFAULT_PRESET = 'w87'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Map a 0..1 slider position to a logarithmic yield and back.
function sliderToYield(t: number): number {
  return Math.exp(Math.log(MIN_YIELD) + t * (Math.log(MAX_YIELD) - Math.log(MIN_YIELD)))
}
function yieldToSlider(value: number): number {
  return (
    (Math.log(value) - Math.log(MIN_YIELD)) /
    (Math.log(MAX_YIELD) - Math.log(MIN_YIELD))
  )
}

// Round a raw slider yield to a readable step.
function roundYield(kt: number): number {
  if (kt < 10) return Math.round(kt * 10) / 10
  if (kt < 100) return Math.round(kt)
  if (kt < 1000) return Math.round(kt / 10) * 10
  if (kt < 10000) return Math.round(kt / 100) * 100
  return Math.round(kt / 1000) * 1000
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
      color: ZONE_COLORS[zone.id] ?? '#fde047',
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

const NuclearBlastView = () => {
  const [params, setParams] = useState<NuclearParams>(DEFAULT_PARAMS)
  const [yieldDraft, setYieldDraft] = useState(String(DEFAULT_PARAMS.yieldKt))
  const [impactPoint, setImpactPoint] = useState({ lng: DEFAULT_LOCATIONS[0].lng, lat: DEFAULT_LOCATIONS[0].lat })
  const [locationName, setLocationName] = useState(DEFAULT_LOCATIONS[0].name)
  const [activePreset, setActivePreset] = useState<string | null>(DEFAULT_PRESET)
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

  const result = useMemo(() => computeBlast(params), [params])

  useEffect(() => {
    impactPointRef.current = impactPoint
  }, [impactPoint])

  // Suppress benign MapLibre tile-abort rejections (matches the sibling tools).
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
  // recomputed — so a preset / yield change always frames the new rings.
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
      element.className = 'nuclear-ground-zero-marker'
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

  // Keep the marker in sync with the target point.
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const current = marker.getLngLat()
    if (Math.abs(current.lng - impactPoint.lng) > 1e-9 || Math.abs(current.lat - impactPoint.lat) > 1e-9) {
      marker.setLngLat([impactPoint.lng, impactPoint.lat])
    }
  }, [impactPoint, mapReady])

  // Fit the map to the current scenario on first load and whenever a fit is
  // requested (preset / yield / city / geolocation).
  useEffect(() => {
    if (!mapReady) return
    fitMap(impactPoint, result.zones[0]?.radiusM ?? 5000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, fitRequest])

  const applyYield = useCallback(
    (kt: number, refit = false) => {
      const clamped = clamp(kt, MIN_YIELD, MAX_YIELD)
      setParams((prev) => ({ ...prev, yieldKt: clamped }))
      setYieldDraft(String(clamped))
      setActivePreset(null)
      if (refit) requestFit()
    },
    [requestFit]
  )

  const applyPreset = useCallback(
    (preset: Preset) => {
      setParams({ yieldKt: preset.yieldKt, burst: 'air' })
      setYieldDraft(String(preset.yieldKt))
      setActivePreset(preset.id)
      requestFit()
    },
    [requestFit]
  )

  const commitYieldDraft = useCallback(() => {
    const value = Number(yieldDraft)
    if (Number.isFinite(value) && value > 0) {
      applyYield(value, true)
    } else {
      setYieldDraft(String(params.yieldKt))
    }
  }, [yieldDraft, applyYield, params.yieldKt])

  const setBurst = useCallback((burst: BurstMode) => {
    setParams((prev) => ({ ...prev, burst }))
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

  const blast5 = result.zones.find((zone) => zone.id === 'blast-5psi')
  const blast1 = result.zones.find((zone) => zone.id === 'blast-1psi')
  const thermal = result.zones.find((zone) => zone.id === 'thermal-3rd')

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

    // Crosshair at ground zero (the DOM marker is not on the canvas).
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
    const burstNoun = params.burst === 'air' ? 'airburst' : 'surface burst'
    const caption = `${formatYield(result.yieldKt)} ${burstNoun}${
      blast5 ? ` → 5 psi blast ${formatDistance(blast5.radiusM)}` : ''
    }`
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
  }, [mapReady, impactPoint, params.burst, result.yieldKt, blast5])

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
    link.download = `nuclear-blast-${result.yieldKt}kt-${params.burst}.png`
    link.href = exportPreviewUrl
    link.click()
  }, [exportPreviewUrl, result.yieldKt, params.burst])

  useEffect(() => {
    if (!downloadModalOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseDownloadModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [downloadModalOpen, handleCloseDownloadModal])

  const outcomeBadge =
    params.burst === 'air'
      ? `Airburst${result.optimalBurstHeightM ? ` ~${formatDistance(result.optimalBurstHeightM)} up` : ''}`
      : 'Surface burst'

  return (
    <main className="asteroid-layout">
      <div className="asteroid-stage">
        <section className="asteroid-controls-card" aria-label="Weapon controls">
          <div className="asteroid-presets-group">
            <span className="asteroid-control-label">Weapon yield presets</span>
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
            <label htmlFor="nuclear-yield">
              Yield <strong>{formatYield(result.yieldKt)}</strong>
            </label>
            <input
              id="nuclear-yield"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(yieldToSlider(params.yieldKt) * 1000)}
              onChange={(event) =>
                applyYield(roundYield(sliderToYield(Number(event.target.value) / 1000)))
              }
            />
            <div className="nuclear-yield-field">
              <label htmlFor="nuclear-yield-input">Custom yield</label>
              <div className="nuclear-yield-input-row">
                <input
                  id="nuclear-yield-input"
                  className="nuclear-yield-input"
                  type="number"
                  min={MIN_YIELD}
                  max={MAX_YIELD}
                  step="any"
                  value={yieldDraft}
                  onChange={(event) => setYieldDraft(event.target.value)}
                  onBlur={commitYieldDraft}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                />
                <span className="nuclear-yield-unit">kt</span>
              </div>
            </div>
          </div>

          <div className="asteroid-control">
            <span className="asteroid-control-label">Burst type</span>
            <div className="nuclear-burst-toggle" role="group" aria-label="Burst type">
              <button
                type="button"
                className={`nuclear-burst-option ${params.burst === 'air' ? 'is-active' : ''}`}
                onClick={() => setBurst('air')}
                aria-pressed={params.burst === 'air'}
              >
                Airburst
              </button>
              <button
                type="button"
                className={`nuclear-burst-option ${params.burst === 'surface' ? 'is-active' : ''}`}
                onClick={() => setBurst('surface')}
                aria-pressed={params.burst === 'surface'}
              >
                Surface burst
              </button>
            </div>
            <span className="nuclear-burst-note">
              {params.burst === 'air'
                ? 'Detonates above the ground — maximizes blast area, minimal local fallout.'
                : 'Detonates at ground level — smaller blast rings, a crater, and heavy fallout.'}
            </span>
          </div>

          <div className="asteroid-location">
            <span className="asteroid-control-label">Target — tap the map or pick a city</span>
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
            Export blast map
          </button>
        </section>

        <div className="asteroid-map-shell">
          <div ref={mapContainerRef} className="asteroid-map" />
          <div className="asteroid-map-hint">
            <Crosshair size={13} aria-hidden="true" /> Tap anywhere to move ground zero
          </div>
          {mapError && <div className="asteroid-map-error">{mapError}</div>}
        </div>
      </div>

      <section className="asteroid-results" aria-label="Blast results">
        <div className="asteroid-headline">
          <div className="asteroid-headline-energy">
            <span className="asteroid-stat-kicker">Weapon yield</span>
            <strong>{formatYield(result.yieldKt)}</strong>
            <span className="asteroid-headline-sub">
              {result.hiroshimas >= 1
                ? `${formatCount(result.hiroshimas)}× the Hiroshima bomb`
                : `${Math.round(result.hiroshimas * 100)}% of the Hiroshima bomb`}
            </span>
          </div>
          <div className={`asteroid-outcome-badge ${params.burst === 'air' ? 'airburst' : 'crater'}`}>
            <Radiation size={14} aria-hidden="true" />
            {outcomeBadge}
          </div>
        </div>

        <div className="asteroid-stat-grid">
          <article className="asteroid-stat">
            <span className="asteroid-stat-label">Fireball radius</span>
            <strong>{formatDistance(result.fireballRadiusM)}</strong>
          </article>
          {blast5 && (
            <article className="asteroid-stat">
              <span className="asteroid-stat-label">Most buildings collapse</span>
              <strong>{formatDistance(blast5.radiusM)}</strong>
            </article>
          )}
          {thermal && (
            <article className="asteroid-stat">
              <span className="asteroid-stat-label">Third-degree burns</span>
              <strong>{formatDistance(thermal.radiusM)}</strong>
            </article>
          )}
          {blast1 && (
            <article className="asteroid-stat">
              <span className="asteroid-stat-label">Windows shatter</span>
              <strong>{formatDistance(blast1.radiusM)}</strong>
            </article>
          )}
        </div>

        <p className="asteroid-summary">{summary}</p>

        <div className="asteroid-legend" aria-label="Effect zones">
          <span className="asteroid-control-label">Effect rings (radius from ground zero)</span>
          {result.zones.length === 0 && (
            <p className="asteroid-legend-empty">No significant effects at this yield.</p>
          )}
          {result.zones.map((zone) => (
            <div className="asteroid-legend-row" key={zone.id}>
              <span
                className="asteroid-legend-swatch"
                style={{ backgroundColor: ZONE_COLORS[zone.id] ?? '#fde047' }}
                aria-hidden="true"
              />
              <span className="asteroid-legend-label">{zone.label}</span>
              <span className="asteroid-legend-radius">{formatDistanceBoth(zone.radiusM)}</span>
            </div>
          ))}
        </div>

        {casualtyZone && (
          <div className="asteroid-population">
            <p>
              Roughly <strong>{formatCount(estimatedPeople)}</strong> people live inside the{' '}
              {casualtyZone.id === 'blast-5psi' ? 'building-collapse' : casualtyZone.label.toLowerCase()}{' '}
              ring (≈{formatCount(casualtyAreaKm2)} km²) at{' '}
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
              Effect radii use the standard scaling laws from{' '}
              <strong>Glasstone &amp; Dolan, “The Effects of Nuclear Weapons” (1977)</strong> — the
              same public basis NUKEMAP uses. Air blast follows cube-root yield scaling; thermal and
              prompt-radiation radii follow the fitted power laws from the Nuclear Weapons FAQ.
            </li>
            <li>
              An <strong>airburst</strong> uses the optimum height that maximizes blast reach and
              produces little local fallout; a <strong>surface burst</strong> has a larger fireball,
              smaller blast rings, and heavy radioactive fallout, which is not drawn here.
            </li>
            <li>
              Prompt radiation matters mostly for smaller weapons; for large yields the blast and
              thermal rings extend well beyond it. Long-term fallout depends on weather and terrain.
            </li>
            <li>
              Results assume flat terrain and clear air and are order-of-magnitude estimates — use
              them for education, not planning.
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
                <div className="download-title">Export blast map</div>
                <p className="download-subtitle">
                  Preview includes the effect rings, ground-zero marker, and a caption.
                </p>
              </div>
            </div>
            <div className="download-preview sea-level-export-preview">
              {exportPreviewUrl ? (
                <img src={exportPreviewUrl} alt="Nuclear blast radius map export preview" />
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

export default NuclearBlastView
