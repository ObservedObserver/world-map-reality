import { useId, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import * as d3 from 'd3'
import type { AnalemmaPoint } from '../utils/sunAnalemma'
import { MONTH_LABELS } from '../utils/sunAnalemma'

type AnalemmaChartProps = {
  selectedPoints: AnalemmaPoint[]
  backgroundTracks: AnalemmaPoint[][]
  latitude: number
  selectedDay: number
  sampleStep: number
  onSelectDay: (dayIndex: number) => void
}

const WIDTH = 920
const HEIGHT = 460
const MARGIN = { top: 24, right: 28, bottom: 54, left: 56 }
const MONTH_COLORS = [
  '#ff6b57',
  '#ff9f43',
  '#f6c453',
  '#a3e635',
  '#34d399',
  '#22d3ee',
  '#38bdf8',
  '#5b8def',
  '#8b5cf6',
  '#d946ef',
  '#f472b6',
  '#fb7185',
]

function toDisplayAzimuth(azimuth: number, latitude: number) {
  return latitude >= 0 ? azimuth : ((azimuth + 180) % 360) - 180
}

export function AnalemmaChart({
  selectedPoints,
  backgroundTracks,
  latitude,
  selectedDay,
  sampleStep,
  onSelectDay,
}: AnalemmaChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const clipId = `${gradientId}-clip`
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const visibleSelected = useMemo(
    () => selectedPoints.filter((point) => point.altitudeDeg >= 0),
    [selectedPoints]
  )
  const plottedPoints = useMemo(
    () =>
      visibleSelected.filter(
        (point) =>
          point.dayIndex % sampleStep === 0 || point.dayIndex === selectedDay
      ),
    [sampleStep, selectedDay, visibleSelected]
  )
  const xDomain = useMemo<[number, number]>(() => {
    if (visibleSelected.length === 0) {
      return latitude >= 0 ? [0, 360] : [-180, 180]
    }
    const values = visibleSelected.map((point) =>
      toDisplayAzimuth(point.azimuthDeg, latitude)
    )
    const extent = d3.extent(values)
    const minimum = extent[0] ?? 0
    const maximum = extent[1] ?? 0
    const center = (minimum + maximum) / 2
    const halfWidth = Math.max(18, (maximum - minimum) / 2 + 8)
    return [center - halfWidth, center + halfWidth]
  }, [latitude, visibleSelected])
  const x = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(xDomain)
        .range([MARGIN.left, WIDTH - MARGIN.right]),
    [xDomain]
  )
  const y = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, 90])
        .range([HEIGHT - MARGIN.bottom, MARGIN.top]),
    []
  )
  const line = d3
    .line<AnalemmaPoint>()
    .defined((point) => point.altitudeDeg >= 0)
    .x((point) => x(toDisplayAzimuth(point.azimuthDeg, latitude)))
    .y((point) => y(point.altitudeDeg))
    .curve(d3.curveCatmullRom.alpha(0.35))
  const selectedPoint = selectedPoints.find(
    (point) => point.dayIndex === selectedDay
  )
  const hoveredPoint =
    hoveredDay === null
      ? null
      : selectedPoints.find((point) => point.dayIndex === hoveredDay) ?? null
  const activePoint = hoveredPoint ?? selectedPoint
  const activeVisible = activePoint && activePoint.altitudeDeg >= 0
  const xTicks = x.ticks(5)

  return (
    <div className="analemma-chart-wrap">
      <svg
        className="analemma-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Annual Sun analemma chart showing solar altitude by azimuth"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1">
            {MONTH_COLORS.map((color, index) => (
              <stop
                key={color}
                offset={`${(index / (MONTH_COLORS.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </linearGradient>
          <clipPath id={clipId}>
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={WIDTH - MARGIN.left - MARGIN.right}
              height={HEIGHT - MARGIN.top - MARGIN.bottom}
            />
          </clipPath>
        </defs>

        {[0, 15, 30, 45, 60, 75, 90].map((tick) => (
          <g key={tick}>
            <line
              className={tick === 0 ? 'analemma-horizon' : 'analemma-grid-line'}
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="analemma-axis-label" x={MARGIN.left - 12} y={y(tick) + 4} textAnchor="end">
              {tick}°
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <g key={tick}>
            <line
              className="analemma-grid-line analemma-grid-line-vertical"
              x1={x(tick)}
              x2={x(tick)}
              y1={MARGIN.top}
              y2={HEIGHT - MARGIN.bottom}
            />
            <text className="analemma-compass-label" x={x(tick)} y={HEIGHT - 24} textAnchor="middle">
              {Math.round(((tick % 360) + 360) % 360)}°
            </text>
          </g>
        ))}

        <text className="analemma-axis-title" x={MARGIN.left} y={16}>Solar altitude</text>
        <text className="analemma-axis-title" x={WIDTH - MARGIN.right} y={HEIGHT - 8} textAnchor="end">
          Compass azimuth →
        </text>

        <g className="analemma-background-tracks" aria-hidden="true" clipPath={`url(#${clipId})`}>
          {backgroundTracks.map((track, index) => (
            <path key={index} d={line(track) ?? undefined} />
          ))}
        </g>

        <path
          className="analemma-selected-path analemma-selected-path-glow"
          d={line(selectedPoints) ?? undefined}
          stroke={`url(#${gradientId})`}
          clipPath={`url(#${clipId})`}
        />
        <path
          className="analemma-selected-path"
          d={line(selectedPoints) ?? undefined}
          stroke={`url(#${gradientId})`}
          clipPath={`url(#${clipId})`}
        />

        <g className="analemma-points">
          {plottedPoints.map((point) => (
            <circle
              key={point.dayIndex}
              cx={x(toDisplayAzimuth(point.azimuthDeg, latitude))}
              cy={y(point.altitudeDeg)}
              r={point.dayIndex % 7 === 0 ? 3.2 : 2.2}
              fill={MONTH_COLORS[point.month]}
              tabIndex={point.dayIndex % Math.max(7, sampleStep) === 0 ? 0 : -1}
              aria-label={`${point.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}: altitude ${point.altitudeDeg.toFixed(1)} degrees, azimuth ${point.azimuthDeg.toFixed(1)} degrees`}
              onMouseEnter={() => setHoveredDay(point.dayIndex)}
              onMouseLeave={() => setHoveredDay(null)}
              onFocus={() => setHoveredDay(point.dayIndex)}
              onBlur={() => setHoveredDay(null)}
              onClick={() => onSelectDay(point.dayIndex)}
            />
          ))}
        </g>

        {activeVisible && (
          <g
            className="analemma-active-point"
            transform={`translate(${x(toDisplayAzimuth(activePoint.azimuthDeg, latitude))} ${y(activePoint.altitudeDeg)})`}
            pointerEvents="none"
          >
            <circle r="8" />
            <circle r="3" />
            <g className="analemma-tooltip" transform="translate(12 -48)">
              <rect width="164" height="40" rx="8" />
              <text x="10" y="16">
                {MONTH_LABELS[activePoint.month]} {activePoint.date.getUTCDate()}
              </text>
              <text x="10" y="31">
                {activePoint.altitudeDeg.toFixed(1)}° high · {activePoint.azimuthDeg.toFixed(1)}° azimuth
              </text>
            </g>
          </g>
        )}
      </svg>

      {visibleSelected.length === 0 && (
        <div className="analemma-chart-empty">
          The Sun stays below the horizon at this UTC time. Move the time slider to reveal the annual path.
        </div>
      )}

      <div className="analemma-month-key" aria-label="Month color legend">
        {MONTH_LABELS.map((month, index) => (
          <span key={month} style={{ '--month-color': MONTH_COLORS[index] } as CSSProperties}>
            {month}
          </span>
        ))}
      </div>
    </div>
  )
}
