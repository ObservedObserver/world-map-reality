import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react'
import type { LineString } from 'geojson'
import type { GeoPermissibleObjects } from 'd3-geo'
import * as d3 from 'd3'
import { Download, RotateCcw, X } from 'lucide-react'
import type { CountryDatum, CountryFeature, LonLat, Vec3 } from '../types'
import {
  GLOBE_DEFAULT_ROTATION,
  GLOBE_DRAG_SENSITIVITY,
  GLOBE_PADDING,
  GLOBE_SIZE,
  MAP_HEIGHT,
  MAP_PADDING,
  MAP_WIDTH,
  MAX_GLOBE_TILT,
} from '../constants'
import { clamp, createSphericalRotation, rotateGeometry } from '../utils/geo'
import { formatLatitude, formatLongitude } from '../utils/formatters'

type EquatorShiftViewProps = {
  loading: boolean
  error: string | null
  countries: CountryDatum[]
  setCountries: Dispatch<SetStateAction<CountryDatum[]>>
  worldFeatures: CountryFeature[]
  draggableIds: string[]
  selectedId: string | null
  onSelectCountry: (id: string) => void
}

type GlobeDragState = {
  pointerId: number
  start: { x: number; y: number }
  rotation: Vec3
}

type DragState = {
  id: string
  pointerId: number
  start: { x: number; y: number }
  origin: { x: number; y: number }
  centroid: [number, number]
}

type EquatorRenderedCountry = {
  country: CountryDatum
  feature: CountryFeature
  isSelected: boolean
  isDragging: boolean
}

const EQUATOR_HANDLE_RADIUS = 7
const EQUATOR_TILT_LIMIT = 85
const WATERMARK_URL =
  'https://www.runcell.dev/tool/true-size-map/custom-mercator-projection'
const WATERMARK_HEIGHT = 32
const COMBO_GAP = 24
const COMBO_GLOBE_SCALE = 0.85

const EquatorShiftView = ({
  loading,
  error,
  countries,
  setCountries,
  worldFeatures,
  draggableIds,
  selectedId,
  onSelectCountry,
}: EquatorShiftViewProps) => {
  const [equatorRotation, setEquatorRotation] = useState<Vec3>([0, 0, 0])
  const [globeRotation, setGlobeRotation] = useState<Vec3>(
    GLOBE_DEFAULT_ROTATION
  )
  const [equatorDragging, setEquatorDragging] = useState(false)
  const [globeDragging, setGlobeDragging] = useState(false)
  const [mapDragging, setMapDragging] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null)
  const [comboPreviewUrl, setComboPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const globeSvgRef = useRef<SVGSVGElement | null>(null)
  const mapSvgRef = useRef<SVGSVGElement | null>(null)
  const equatorDragState = useRef<{ pointerId: number } | null>(null)
  const globeDragState = useRef<GlobeDragState | null>(null)
  const mapDragState = useRef<DragState | null>(null)

  const equatorProjection = useMemo(
    () =>
      d3
        .geoMercator()
        .scale(175)
        .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2 + 10])
        .rotate(equatorRotation),
    [equatorRotation]
  )

  const mapPathGenerator = useMemo(
    () => d3.geoPath(equatorProjection),
    [equatorProjection]
  )

  const globeProjection = useMemo(
    () =>
      d3
        .geoOrthographic()
        .scale(GLOBE_SIZE / 2 - GLOBE_PADDING)
        .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
        .clipAngle(90)
        .precision(0.3)
        .rotate(globeRotation),
    [globeRotation]
  )

  const globePathGenerator = useMemo(
    () => d3.geoPath(globeProjection),
    [globeProjection]
  )

  const globeSphere = useMemo(
    () => ({ type: 'Sphere' } as unknown as GeoPermissibleObjects),
    []
  )
  const globeGraticule = useMemo(() => d3.geoGraticule10(), [])

  const equatorRotationFn = useMemo(
    () => d3.geoRotation(equatorRotation),
    [equatorRotation]
  )

  const equatorLine = useMemo<LineString>(() => {
    const points: LonLat[] = d3.range(-180, 181, 2).map((lon) => {
      const rotated: LonLat = [lon, 0]
      const unrotated = equatorRotationFn.invert(rotated) as LonLat
      return [unrotated[0], unrotated[1]]
    })
    return { type: 'LineString', coordinates: points }
  }, [equatorRotationFn])

  const equatorHandle = useMemo(
    () => equatorRotationFn.invert([0, 0]) as LonLat,
    [equatorRotationFn]
  )

  const equatorPole = useMemo(
    () => equatorRotationFn.invert([0, 90]) as LonLat,
    [equatorRotationFn]
  )

  const equatorHandlePoint = useMemo(
    () => globeProjection(equatorHandle),
    [globeProjection, equatorHandle]
  )

  const equatorHandleVisible = useMemo(() => {
    const center: LonLat = [-globeRotation[0], -globeRotation[1]]
    return d3.geoDistance(equatorHandle, center) <= Math.PI / 2 - 0.02
  }, [equatorHandle, globeRotation])

  const getGlobeLonLatFromClient = useCallback(
    (clientX: number, clientY: number): LonLat | null => {
      const svg = globeSvgRef.current
      if (!svg) {
        return null
      }
      const rect = svg.getBoundingClientRect()
      if (!rect.width || !rect.height) {
        return null
      }
      const x = ((clientX - rect.left) / rect.width) * GLOBE_SIZE
      const y = ((clientY - rect.top) / rect.height) * GLOBE_SIZE
      const radius = GLOBE_SIZE / 2 - GLOBE_PADDING
      const dx = x - GLOBE_SIZE / 2
      const dy = y - GLOBE_SIZE / 2
      if (dx * dx + dy * dy > radius * radius) {
        return null
      }
      const inverted = globeProjection.invert?.([x, y])
      if (!inverted) {
        return null
      }
      return [inverted[0], inverted[1]]
    },
    [globeProjection]
  )

  const getEquatorCentroid = useCallback(
    (country: CountryDatum) =>
      equatorProjection(country.originalCentroid) ?? [0, 0],
    [equatorProjection]
  )

  const getCurrentCoordinates = useCallback(
    (country: CountryDatum): LonLat => {
      const [cx, cy] = getEquatorCentroid(country)
      const currentPoint: [number, number] = [
        cx + country.offset.x,
        cy + country.offset.y,
      ]
      const inverted = equatorProjection.invert?.(currentPoint)
      if (!inverted) {
        return country.originalCentroid
      }
      return [inverted[0], inverted[1]]
    },
    [equatorProjection, getEquatorCentroid]
  )

  const draggableCountries = useMemo(
    () => countries.filter((country) => draggableIds.includes(country.id)),
    [countries, draggableIds]
  )

  const orderedCountries = useMemo(() => {
    const items = [...draggableCountries]
    const score = (id: string) =>
      id === draggingId ? 2 : id === selectedId ? 1 : 0
    items.sort((a, b) => score(a.id) - score(b.id))
    return items
  }, [draggableCountries, draggingId, selectedId])

  const renderedCountries = useMemo<EquatorRenderedCountry[]>(
    () =>
      orderedCountries.map((country) => {
        const currentCoordinates = getCurrentCoordinates(country)
        const rotation = createSphericalRotation(
          country.originalCentroid,
          currentCoordinates
        )
        const rotatedGeometry = country.feature.geometry
          ? rotateGeometry(country.feature.geometry, rotation)
          : country.feature.geometry
        const rotatedFeature: CountryFeature = {
          ...country.feature,
          geometry: rotatedGeometry,
        }
        return {
          country,
          feature: rotatedFeature,
          isSelected: selectedId === country.id,
          isDragging: draggingId === country.id,
        }
      }),
    [orderedCountries, getCurrentCoordinates, selectedId, draggingId]
  )

  const handleGlobePointerDown = (
    event: ReactPointerEvent<SVGSVGElement>
  ) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    equatorDragState.current = null
    setEquatorDragging(false)
    globeDragState.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      rotation: globeRotation,
    }
    setGlobeDragging(true)
  }

  const handleCountryPointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    country: CountryDatum
  ) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    const centroid = getEquatorCentroid(country)
    mapDragState.current = {
      id: country.id,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: country.offset.x, y: country.offset.y },
      centroid,
    }
    setDraggingId(country.id)
    setMapDragging(true)
    onSelectCountry(country.id)
  }

  const handleEquatorPointerDown = (
    event: ReactPointerEvent<SVGCircleElement>
  ) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    equatorDragState.current = { pointerId: event.pointerId }
    setEquatorDragging(true)
  }

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (
        mapDragState.current &&
        mapDragState.current.pointerId === event.pointerId
      ) {
        const dx = event.clientX - mapDragState.current.start.x
        const dy = event.clientY - mapDragState.current.start.y
        const nextOffset = {
          x: mapDragState.current.origin.x + dx,
          y: mapDragState.current.origin.y + dy,
        }

        const centroidX = mapDragState.current.centroid[0]
        const centroidY = mapDragState.current.centroid[1]
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
          prev.map((entry) =>
            entry.id === mapDragState.current?.id
              ? { ...entry, offset: clampedOffset }
              : entry
          )
        )
        return
      }
      if (
        equatorDragState.current &&
        equatorDragState.current.pointerId === event.pointerId
      ) {
        const nextLonLat = getGlobeLonLatFromClient(
          event.clientX,
          event.clientY
        )
        if (!nextLonLat) {
          return
        }
        const clampedLat = clamp(
          nextLonLat[1],
          -EQUATOR_TILT_LIMIT,
          EQUATOR_TILT_LIMIT
        )
        setEquatorRotation([-nextLonLat[0], -clampedLat, 0])
        return
      }
      if (
        globeDragState.current &&
        globeDragState.current.pointerId === event.pointerId
      ) {
        const dx = event.clientX - globeDragState.current.start.x
        const dy = event.clientY - globeDragState.current.start.y
        const nextRotation: Vec3 = [
          globeDragState.current.rotation[0] + dx * GLOBE_DRAG_SENSITIVITY,
          clamp(
            globeDragState.current.rotation[1] - dy * GLOBE_DRAG_SENSITIVITY,
            -MAX_GLOBE_TILT,
            MAX_GLOBE_TILT
          ),
          0,
        ]
        setGlobeRotation(nextRotation)
      }
    },
    [getGlobeLonLatFromClient, setCountries]
  )

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (
      mapDragState.current &&
      mapDragState.current.pointerId === event.pointerId
    ) {
      mapDragState.current = null
      setDraggingId(null)
      setMapDragging(false)
    }
    if (
      equatorDragState.current &&
      equatorDragState.current.pointerId === event.pointerId
    ) {
      equatorDragState.current = null
      setEquatorDragging(false)
    }
    if (
      globeDragState.current &&
      globeDragState.current.pointerId === event.pointerId
    ) {
      globeDragState.current = null
      setGlobeDragging(false)
    }
  }, [])

  useEffect(() => {
    if (!equatorDragging && !globeDragging && !mapDragging) {
      return
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [equatorDragging, globeDragging, mapDragging, handlePointerMove, handlePointerUp])

  const handleResetEquator = () => {
    setEquatorRotation([0, 0, 0])
  }

  const handleResetView = () => {
    setGlobeRotation(GLOBE_DEFAULT_ROTATION)
  }

  const mapExportStyles = useMemo(
    () => `
      .map-ocean { fill: rgba(12, 26, 48, 0.9); }
      .world-base path {
        fill: rgba(248, 245, 239, 0.08);
        stroke: rgba(248, 245, 239, 0.18);
        stroke-width: 0.6;
      }
      .country-shape {
        stroke: rgba(255, 255, 255, 0.4);
        stroke-width: 0.8;
      }
      .country-group.is-selected .country-shape {
        stroke: #fff6de;
        stroke-width: 2;
      }
      .country-group.is-dragging {
        filter: url(#countryShadow);
      }
      .equator-line {
        fill: none;
        stroke: #ff5a5f;
        stroke-width: 2.2;
        stroke-linecap: round;
      }
    `,
    []
  )

  const globeExportStyles = useMemo(
    () => `
      .globe-sphere {
        stroke: rgba(248, 245, 239, 0.25);
        stroke-width: 1;
      }
      .globe-graticule path {
        fill: none;
        stroke: rgba(248, 245, 239, 0.2);
        stroke-width: 0.6;
        stroke-dasharray: 4 6;
      }
      .globe-world path {
        fill: rgba(248, 245, 239, 0.12);
        stroke: rgba(248, 245, 239, 0.22);
        stroke-width: 0.6;
      }
      .equator-line {
        fill: none;
        stroke: #ff5a5f;
        stroke-width: 2.2;
        stroke-linecap: round;
      }
      .equator-handle {
        fill: #ff5a5f;
        stroke: rgba(255, 255, 255, 0.85);
        stroke-width: 1.6;
      }
    `,
    []
  )

  const createSvgImage = useCallback(
    (svg: SVGSVGElement, styleText: string, width: number, height: number) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const svgClone = svg.cloneNode(true) as SVGSVGElement
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        svgClone.setAttribute('width', `${width}`)
        svgClone.setAttribute('height', `${height}`)

        const defs =
          svgClone.querySelector('defs') ??
          (() => {
            const nextDefs = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'defs'
            )
            svgClone.insertBefore(nextDefs, svgClone.firstChild)
            return nextDefs
          })()
        const style = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'style'
        )
        style.textContent = styleText
        defs.appendChild(style)

        const serializer = new XMLSerializer()
        const svgText = serializer.serializeToString(svgClone)
        const blob = new Blob([svgText], {
          type: 'image/svg+xml;charset=utf-8',
        })
        const url = URL.createObjectURL(blob)
        const image = new Image()
        image.decoding = 'async'
        image.onload = () => {
          URL.revokeObjectURL(url)
          resolve(image)
        }
        image.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to load SVG image.'))
        }
        image.src = url
      }),
    []
  )

  const drawWatermark = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = 'rgba(248, 245, 239, 0.65)'
    ctx.font = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(WATERMARK_URL, width / 2, height - WATERMARK_HEIGHT / 2)
  }, [])

  const createMapPng = useCallback(async () => {
    if (!mapSvgRef.current) {
      return null
    }
    const image = await createSvgImage(
      mapSvgRef.current,
      mapExportStyles,
      MAP_WIDTH,
      MAP_HEIGHT
    )
    const scale = Math.max(1, window.devicePixelRatio || 1)
    const height = MAP_HEIGHT + WATERMARK_HEIGHT
    const canvas = document.createElement('canvas')
    canvas.width = MAP_WIDTH * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }
    ctx.scale(scale, scale)
    ctx.fillStyle = '#0c1a30'
    ctx.fillRect(0, 0, MAP_WIDTH, height)
    ctx.drawImage(image, 0, 0, MAP_WIDTH, MAP_HEIGHT)
    drawWatermark(ctx, MAP_WIDTH, height)
    return canvas.toDataURL('image/png')
  }, [createSvgImage, drawWatermark, mapExportStyles])

  const createComboPng = useCallback(async () => {
    if (!mapSvgRef.current || !globeSvgRef.current) {
      return null
    }
    const [mapImage, globeImage] = await Promise.all([
      createSvgImage(
        mapSvgRef.current,
        mapExportStyles,
        MAP_WIDTH,
        MAP_HEIGHT
      ),
      createSvgImage(
        globeSvgRef.current,
        globeExportStyles,
        GLOBE_SIZE,
        GLOBE_SIZE
      ),
    ])

    const globeSize = Math.round(GLOBE_SIZE * COMBO_GLOBE_SCALE)
    const contentHeight = Math.max(MAP_HEIGHT, globeSize)
    const contentWidth = MAP_WIDTH + COMBO_GAP + globeSize
    const height = contentHeight + WATERMARK_HEIGHT
    const scale = Math.max(1, window.devicePixelRatio || 1)
    const canvas = document.createElement('canvas')
    canvas.width = contentWidth * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }
    ctx.scale(scale, scale)
    ctx.fillStyle = '#0c1a30'
    ctx.fillRect(0, 0, contentWidth, height)

    const mapY = (contentHeight - MAP_HEIGHT) / 2
    const globeY = (contentHeight - globeSize) / 2
    ctx.drawImage(mapImage, 0, mapY, MAP_WIDTH, MAP_HEIGHT)
    ctx.drawImage(
      globeImage,
      MAP_WIDTH + COMBO_GAP,
      globeY,
      globeSize,
      globeSize
    )
    drawWatermark(ctx, contentWidth, height)
    return canvas.toDataURL('image/png')
  }, [createSvgImage, drawWatermark, mapExportStyles, globeExportStyles])

  const generatePreviews = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const results = await Promise.allSettled([createMapPng(), createComboPng()])
      const mapUrl = results[0].status === 'fulfilled' ? results[0].value : null
      const comboUrl =
        results[1].status === 'fulfilled' ? results[1].value : null
      setMapPreviewUrl(mapUrl ?? null)
      setComboPreviewUrl(comboUrl ?? null)
    } finally {
      setPreviewLoading(false)
    }
  }, [createMapPng, createComboPng])

  const handleOpenDownloadModal = useCallback(() => {
    setMapPreviewUrl(null)
    setComboPreviewUrl(null)
    setDownloadModalOpen(true)
    void generatePreviews()
  }, [generatePreviews])

  const handleCloseDownloadModal = useCallback(() => {
    setDownloadModalOpen(false)
    setMapPreviewUrl(null)
    setComboPreviewUrl(null)
  }, [])

  const handleDownload = useCallback((dataUrl: string | null, filename: string) => {
    if (!dataUrl) {
      return
    }
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }, [])

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
    <main className="equator-layout">
      <section className="equator-panel">
        <div className="equator-panel-header">
          <div>
            <h2>Mercator projection</h2>
            <p>
              The map recalculates the moment the equator tilts. Watch how the
              same world stretches in new directions.
            </p>
          </div>
          <div className="equator-panel-actions">
            <button
              className="github-button icon-button"
              type="button"
              onClick={handleOpenDownloadModal}
              disabled={loading || Boolean(error)}
              aria-label="Download map image"
              title="Download map image"
            >
              <Download size={16} aria-hidden="true" />
            </button>
            <button
              className="reset-button icon-button"
              type="button"
              onClick={handleResetEquator}
              aria-label="Reset equator"
              title="Reset equator"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="map-frame equator-map-frame">
          {loading && <div className="map-loading">Loading map...</div>}
          {error && <div className="map-error">{error}</div>}
          {!loading && !error && (
            <svg
              className="map-svg equator-map"
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              role="img"
              aria-label="Mercator projection with a custom equator"
              ref={mapSvgRef}
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
              <rect className="map-ocean" width={MAP_WIDTH} height={MAP_HEIGHT} />
              <g className="world-base">
                {worldFeatures.map((feature, index) => (
                  <path
                    key={`equator-map-${feature.id ?? index}`}
                    d={mapPathGenerator(feature) ?? ''}
                  />
                ))}
              </g>
              <g className="countries">
                {renderedCountries.map((item) => (
                  <g
                    key={`equator-country-${item.country.id}`}
                    className={`country-group ${
                      item.isSelected ? 'is-selected' : ''
                    } ${item.isDragging ? 'is-dragging' : ''}`}
                    onPointerDown={(event) =>
                      handleCountryPointerDown(event, item.country)
                    }
                    role="button"
                    aria-label={`Drag ${item.country.name}`}
                  >
                    <path
                      className="country-shape"
                      d={mapPathGenerator(item.feature) ?? ''}
                      fill={item.country.color}
                    />
                  </g>
                ))}
              </g>
              <path
                className="equator-line"
                d={mapPathGenerator(equatorLine) ?? ''}
              />
            </svg>
          )}
        </div>
      </section>

      <section className="equator-panel">
        <div className="equator-panel-header">
          <div>
            <h2>3D Earth</h2>
            <p>Drag the red handle to tilt the equator. Drag the globe to spin.</p>
          </div>
          <div className="equator-panel-actions">
            <button
              className="github-button icon-button"
              type="button"
              onClick={handleResetView}
              aria-label="Reset view"
              title="Reset view"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="globe-frame equator-globe-frame">
          {loading && <div className="map-loading">Loading globe...</div>}
          {error && <div className="map-error">{error}</div>}
          {!loading && !error && (
            <svg
              className={`globe-svg equator-globe ${
                globeDragging ? 'is-dragging' : ''
              }`}
              viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`}
              role="img"
              aria-label="3D Earth with adjustable equator"
              onPointerDown={handleGlobePointerDown}
              ref={globeSvgRef}
            >
              <defs>
                <radialGradient id="equatorGlobeHighlight" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(119, 212, 255, 0.35)" />
                  <stop offset="55%" stopColor="rgba(10, 24, 44, 0.9)" />
                  <stop offset="100%" stopColor="rgba(7, 15, 28, 0.98)" />
                </radialGradient>
              </defs>
              <path
                className="globe-sphere"
                d={globePathGenerator(globeSphere) ?? ''}
                fill="url(#equatorGlobeHighlight)"
              />
              <g className="globe-graticule">
                <path d={globePathGenerator(globeGraticule) ?? ''} />
              </g>
              <g className="globe-world">
                {worldFeatures.map((feature, index) => (
                  <path
                    key={`equator-globe-${feature.id ?? index}`}
                    d={globePathGenerator(feature) ?? ''}
                  />
                ))}
              </g>
              <path
                className="equator-line"
                d={globePathGenerator(equatorLine) ?? ''}
              />
              {equatorHandlePoint && equatorHandleVisible ? (
                <circle
                  className={`equator-handle ${
                    equatorDragging ? 'is-dragging' : ''
                  }`}
                  cx={equatorHandlePoint[0]}
                  cy={equatorHandlePoint[1]}
                  r={EQUATOR_HANDLE_RADIUS}
                  onPointerDown={handleEquatorPointerDown}
                />
              ) : null}
            </svg>
          )}
        </div>
        <div className="equator-metrics">
          <div className="equator-metric">
            <span className="equator-label">Equator handle</span>
            <span className="equator-value">
              {formatLongitude(equatorHandle[0])} /{' '}
              {formatLatitude(equatorHandle[1])}
            </span>
          </div>
          <div className="equator-metric">
            <span className="equator-label">New north pole</span>
            <span className="equator-value">
              {formatLongitude(equatorPole[0])} /{' '}
              {formatLatitude(equatorPole[1])}
            </span>
          </div>
        </div>
      </section>
      {downloadModalOpen && (
        <div className="download-modal" role="dialog" aria-modal="true">
          <div
            className="download-backdrop"
            onClick={handleCloseDownloadModal}
            aria-hidden="true"
          />
          <div className="download-dialog" role="document">
            <div className="download-header">
              <div>
                <div className="download-title">Download image</div>
                <p className="download-subtitle">
                  Choose a layout and save the PNG with watermark.
                </p>
              </div>
              <button
                className="github-button icon-button"
                type="button"
                onClick={handleCloseDownloadModal}
                aria-label="Close download modal"
                title="Close"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="download-options">
              <button
                className="download-option"
                type="button"
                onClick={() =>
                  handleDownload(mapPreviewUrl, 'custom-mercator-map.png')
                }
                disabled={!mapPreviewUrl || previewLoading}
              >
                <div className="download-preview">
                  {mapPreviewUrl ? (
                    <img src={mapPreviewUrl} alt="2D map preview" />
                  ) : (
                    <div className="download-preview-placeholder">
                      {previewLoading ? 'Generating preview...' : 'No preview'}
                    </div>
                  )}
                </div>
                <div className="download-option-meta">
                  <span className="download-option-title">2D map only</span>
                  <span className="download-option-action">Download PNG</span>
                </div>
              </button>
              <button
                className="download-option"
                type="button"
                onClick={() =>
                  handleDownload(comboPreviewUrl, 'custom-mercator-combo.png')
                }
                disabled={!comboPreviewUrl || previewLoading}
              >
                <div className="download-preview">
                  {comboPreviewUrl ? (
                    <img src={comboPreviewUrl} alt="2D map and 3D globe preview" />
                  ) : (
                    <div className="download-preview-placeholder">
                      {previewLoading ? 'Generating preview...' : 'No preview'}
                    </div>
                  )}
                </div>
                <div className="download-option-meta">
                  <span className="download-option-title">2D + 3D combo</span>
                  <span className="download-option-action">Download PNG</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default EquatorShiftView
