import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { LineString } from 'geojson'
import type { GeoPermissibleObjects } from 'd3-geo'
import * as d3 from 'd3'
import type { CountryFeature, LonLat, Vec3 } from '../types'
import {
  GLOBE_DEFAULT_ROTATION,
  GLOBE_DRAG_SENSITIVITY,
  GLOBE_PADDING,
  GLOBE_SIZE,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_GLOBE_TILT,
} from '../constants'
import { clamp } from '../utils/geo'
import { formatLatitude, formatLongitude } from '../utils/formatters'

type EquatorShiftViewProps = {
  loading: boolean
  error: string | null
  worldFeatures: CountryFeature[]
}

type GlobeDragState = {
  pointerId: number
  start: { x: number; y: number }
  rotation: Vec3
}

const EQUATOR_HANDLE_RADIUS = 7
const EQUATOR_TILT_LIMIT = 85

const EquatorShiftView = ({
  loading,
  error,
  worldFeatures,
}: EquatorShiftViewProps) => {
  const [equatorRotation, setEquatorRotation] = useState<Vec3>([0, 0, 0])
  const [globeRotation, setGlobeRotation] = useState<Vec3>(
    GLOBE_DEFAULT_ROTATION
  )
  const [equatorDragging, setEquatorDragging] = useState(false)
  const [globeDragging, setGlobeDragging] = useState(false)
  const globeSvgRef = useRef<SVGSVGElement | null>(null)
  const equatorDragState = useRef<{ pointerId: number } | null>(null)
  const globeDragState = useRef<GlobeDragState | null>(null)

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
    [getGlobeLonLatFromClient]
  )

  const handlePointerUp = useCallback((event: PointerEvent) => {
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
    if (!equatorDragging && !globeDragging) {
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
  }, [equatorDragging, globeDragging, handlePointerMove, handlePointerUp])

  const handleResetEquator = () => {
    setEquatorRotation([0, 0, 0])
  }

  const handleResetView = () => {
    setGlobeRotation(GLOBE_DEFAULT_ROTATION)
  }

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
              className="reset-button"
              type="button"
              onClick={handleResetEquator}
            >
              Reset equator
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
            >
              <rect className="map-ocean" width={MAP_WIDTH} height={MAP_HEIGHT} />
              <g className="world-base">
                {worldFeatures.map((feature, index) => (
                  <path
                    key={`equator-map-${feature.id ?? index}`}
                    d={mapPathGenerator(feature) ?? ''}
                  />
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
              className="github-button"
              type="button"
              onClick={handleResetView}
            >
              Reset view
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
    </main>
  )
}

export default EquatorShiftView
