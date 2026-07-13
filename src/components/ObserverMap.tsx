import { useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import * as d3 from 'd3'
import type { CountryFeature, LonLat } from '../types'
import { formatCoordinate } from '../utils/sunAnalemma'

type ObserverMapProps = {
  worldFeatures: CountryFeature[]
  loading: boolean
  error: string | null
  location: LonLat
  onLocationChange: (location: LonLat) => void
}

const WIDTH = 820
const HEIGHT = 360

export function ObserverMap({
  worldFeatures,
  loading,
  error,
  location,
  onLocationChange,
}: ObserverMapProps) {
  const projection = useMemo(
    () =>
      d3
        .geoNaturalEarth1()
        .precision(0.2)
        .fitExtent(
          [
            [10, 10],
            [WIDTH - 10, HEIGHT - 10],
          ],
          { type: 'Sphere' }
        ),
    []
  )
  const path = useMemo(() => d3.geoPath(projection), [projection])
  const graticule = useMemo(() => d3.geoGraticule10(), [])
  const marker = projection(location)

  const updateLocation = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const point: [number, number] = [
      ((event.clientX - rect.left) / rect.width) * WIDTH,
      ((event.clientY - rect.top) / rect.height) * HEIGHT,
    ]
    const coordinates = projection.invert?.(point)
    if (!coordinates) return
    onLocationChange([
      Math.max(-180, Math.min(180, coordinates[0])),
      Math.max(-89.5, Math.min(89.5, coordinates[1])),
    ])
  }

  return (
    <div className="analemma-map-card">
      <div className="analemma-map-header">
        <div>
          <span className="analemma-control-kicker">Observer location</span>
          <strong>
            {formatCoordinate(location[1], 'lat')} · {formatCoordinate(location[0], 'lng')}
          </strong>
        </div>
        <span>Click or drag anywhere on Earth</span>
      </div>

      <div className="analemma-map-shell">
        <svg
          className="analemma-map"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="application"
          aria-label="World map for choosing the observer location"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            updateLocation(event)
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateLocation(event)
            }
          }}
        >
          <path className="analemma-map-sphere" d={path({ type: 'Sphere' }) ?? undefined} />
          <path className="analemma-map-graticule" d={path(graticule) ?? undefined} />
          {worldFeatures.map((feature, index) => (
            <path
              className="analemma-map-country"
              d={path(feature) ?? undefined}
              key={feature.id ?? index}
            />
          ))}
          {marker && (
            <g className="analemma-map-marker" transform={`translate(${marker[0]} ${marker[1]})`}>
              <circle className="analemma-map-marker-pulse" r="14" />
              <circle className="analemma-map-marker-ring" r="7" />
              <circle className="analemma-map-marker-core" r="2.5" />
            </g>
          )}
        </svg>
        {loading && <div className="analemma-map-status">Loading world map…</div>}
        {error && <div className="analemma-map-status">Map data unavailable. City presets and coordinates still work.</div>}
      </div>
    </div>
  )
}
