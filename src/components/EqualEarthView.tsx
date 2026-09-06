import { useEffect, useMemo, useState } from 'react'
import { geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry } from 'geojson'
import { ArrowLeftRight, Check, Copy, RotateCcw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createAreaLens,
  createMapProjection,
  DEFAULT_EXPLORER_STATE,
  explorerSearch,
  MAP_SIZE,
  measureRegion,
  parseExplorerState,
  prepareRegions,
} from '../utils/equalEarth'
import type { ExplorerState, Region } from '../utils/equalEarth'

const multiplier = (value: number) =>
  `${value > 0 && value < 0.01 ? new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(value) : value.toFixed(2)}×`
const area = (value: number) =>
  `${new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(value)} km²`
const PRESETS = [
  { label: 'Greenland & Africa', country: '304', compare: 'africa' },
  { label: 'Canada & United States', country: '124', compare: '840' },
  { label: 'Russia & Africa', country: '643', compare: 'africa' },
  { label: 'Greenland & Australia', country: '304', compare: '36' },
]

function ProjectionMap({
  kind,
  regions,
  selected,
  reference,
  state,
  onSelect,
}: {
  kind: 'equalEarth' | 'mercator'
  regions: Region[]
  selected: Region
  reference: Region
  state: ExplorerState
  onSelect: (id: string) => void
}) {
  const projection = useMemo(
    () => createMapProjection(kind, state.meridian),
    [kind, state.meridian],
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const paths = useMemo(
    () =>
      regions
        .filter((region) => region.id !== 'africa')
        .map((region) => ({ ...region, d: path(region.geometry) ?? '' })),
    [regions, path],
  )
  const selectedIds = new Set(selected.memberIds)
  const referenceIds = new Set(reference.memberIds)
  return (
    <svg
      className="ee-world"
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
      aria-label={`${kind === 'equalEarth' ? 'Equal Earth' : 'Mercator'} world map. Select a country, or use the country controls above.`}
    >
      <path d={path({ type: 'Sphere' }) ?? ''} className="ee-ocean" />
      {state.grid && (
        <path d={path(geoGraticule10()) ?? ''} className="ee-graticule" />
      )}
      <path
        d={
          path({
            type: 'LineString',
            coordinates: [
              [-180, 0],
              [-90, 0],
              [0, 0],
              [90, 0],
              [180, 0],
            ],
          }) ?? ''
        }
        className="ee-equator"
      />
      {paths.map((region) => (
        <path
          key={region.id}
          d={region.d}
          className={`ee-country${selectedIds.has(region.id) ? ' ee-primary' : referenceIds.has(region.id) ? ' ee-reference' : ''}`}
          onClick={() => onSelect(region.id)}
        >
          <title>
            {region.name}
            {selectedIds.has(region.id)
              ? ', selected country'
              : referenceIds.has(region.id)
                ? ', comparison region'
                : ''}
          </title>
        </path>
      ))}
      {state.lens && (
        <path
          d={path(createAreaLens(state.latitude, state.meridian)) ?? ''}
          className="ee-lens"
        />
      )}
    </svg>
  )
}

export default function EqualEarthView() {
  const [regions, setRegions] = useState<Region[]>([])
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [copyMessage, setCopyMessage] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch(`${import.meta.env.BASE_URL}maps/countries-110m.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Map unavailable')
        return response.json()
      })
      .then((topology: Topology<{ countries: GeometryCollection }>) => {
        const collection = feature(
          topology,
          topology.objects.countries,
        ) as FeatureCollection<Geometry>
        if (!collection.features?.length) throw new Error('Empty map')
        if (!controller.signal.aborted)
          setRegions(prepareRegions(collection.features))
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [retry])
  const ids = useMemo(
    () => new Set(regions.map((region) => region.id)),
    [regions],
  )
  const state = useMemo(
    () => parseExplorerState(location.search, ids),
    [location.search, ids],
  )
  const measurements = useMemo(
    () =>
      new Map(
        regions.map((region) => [region.id, measureRegion(region.geometry)]),
      ),
    [regions],
  )
  const lensMeasurements = useMemo(
    () => measureRegion(createAreaLens(state.latitude)),
    [state.latitude],
  )
  const setState = (patch: Partial<ExplorerState>) => {
    setCopyMessage('')
    // Replace controls in place, so the Back button returns to the previous page.
    navigate(
      {
        pathname: location.pathname,
        search: explorerSearch({ ...state, ...patch }),
      },
      { replace: true, preventScrollReset: true },
    )
  }
  if (error)
    return (
      <div className="ee-loading" role="alert">
        <p>The world map could not load. Please try again.</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Reload map
        </button>
      </div>
    )
  const selected = regions.find((region) => region.id === state.country)
  const reference = regions.find((region) => region.id === state.compare)
  const primary = measurements.get(state.country)
  const secondary = measurements.get(state.compare)
  if (!selected || !reference || !primary || !secondary)
    return (
      <div className="ee-loading" role="status">
        Loading country outlines for both projections…
      </div>
    )
  const trueRatio = primary.areaKm2 / secondary.areaKm2
  const mercatorRatio =
    primary.clipped || secondary.clipped
      ? null
      : primary.mercatorArea / secondary.mercatorArea
  const sameRegion = state.country === state.compare
  const copyLink = async () => {
    const url = new URL(window.location.href)
    url.search = explorerSearch(state)
    try {
      await navigator.clipboard.writeText(url.href)
      setCopyMessage('Link copied')
    } catch {
      setCopyMessage('Copy the comparison URL from your address bar.')
    }
  }

  return (
    <div className="ee-explorer">
      <div className="ee-presets" aria-label="Suggested comparisons">
        <span>Try a comparison</span>
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.label}
            aria-pressed={
              state.country === preset.country &&
              state.compare === preset.compare
            }
            onClick={() => setState(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="ee-toolbar">
        <label className="ee-picker ee-picker-primary">
          Selected country or region
          <select
            value={state.country}
            onChange={(event) => setState({ country: event.target.value })}
          >
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ee-icon-button"
          onClick={() =>
            setState({ country: state.compare, compare: state.country })
          }
          aria-label="Swap selected and comparison regions"
        >
          <ArrowLeftRight size={18} />
        </button>
        <label className="ee-picker ee-picker-reference">
          Compare with
          <select
            value={state.compare}
            onChange={(event) => setState({ compare: event.target.value })}
          >
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <div className="ee-actions">
          <button type="button" onClick={copyLink}>
            {copyMessage === 'Link copied' ? (
              <Check size={16} />
            ) : (
              <Copy size={16} />
            )}{' '}
            Share comparison
          </button>
          <button
            type="button"
            className="ee-icon-button"
            aria-label="Reset comparison"
            onClick={() => setState(DEFAULT_EXPLORER_STATE)}
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
      {copyMessage && (
        <p role="status" className="ee-copy-status">
          {copyMessage}
        </p>
      )}
      <div className="ee-map-options">
        <p>
          <span className="ee-dot ee-primary-dot" />
          {selected.name}
          <span className="ee-dot ee-reference-dot" />
          {reference.name}
        </p>
        <label>
          Map center
          <select
            value={state.meridian}
            onChange={(event) =>
              setState({ meridian: Number(event.target.value) })
            }
          >
            <option value={0}>Greenwich</option>
            <option value={-100}>Americas</option>
            <option value={120}>Asia-Pacific</option>
            {![0, -100, 120].includes(state.meridian) && (
              <option value={state.meridian}>{state.meridian}°</option>
            )}
          </select>
        </label>
        <label className="ee-check">
          <input
            type="checkbox"
            checked={state.grid}
            onChange={(event) => setState({ grid: event.target.checked })}
          />
          Show grid
        </label>
      </div>
      <div className="ee-maps">
        {(['equalEarth', 'mercator'] as const).map((kind) => (
          <section
            className={`ee-map-panel ee-${kind}-panel`}
            key={kind}
            aria-labelledby={`ee-${kind}-heading`}
          >
            <div className="ee-map-heading">
              <div>
                <span className="ee-kicker">
                  {kind === 'equalEarth'
                    ? 'Preserves area'
                    : 'Preserves local angles'}
                </span>
                <h2 id={`ee-${kind}-heading`}>
                  {kind === 'equalEarth' ? 'Equal Earth' : 'Mercator'}
                </h2>
              </div>
              <div className="ee-heading-stat">
                <span>{selected.name} area</span>
                <strong>
                  {kind === 'equalEarth'
                    ? '1.00×'
                    : primary.inflation == null
                      ? 'Clipped'
                      : multiplier(primary.inflation)}
                </strong>
              </div>
            </div>
            <ProjectionMap
              kind={kind}
              regions={regions}
              selected={selected}
              reference={reference}
              state={state}
              onSelect={(country) => setState({ country })}
            />
            <div className="ee-panel-stat">
              <span>
                {kind === 'equalEarth'
                  ? 'Equal area at every latitude'
                  : 'Area grows toward the poles'}
              </span>
              <small>
                {kind === 'equalEarth'
                  ? 'The outline keeps its share of Earth’s area.'
                  : primary.clipped
                    ? 'Part of this region lies beyond 85.05° latitude.'
                    : 'Apparent area relative to the same area at the equator.'}
              </small>
            </div>
          </section>
        ))}
      </div>
      <p className="ee-scale-note">
        Both maps use the same area scale at the equator. Click an outline to
        select it. Mercator ends at 85.05° north and south.
      </p>
      <section
        className="ee-results"
        aria-labelledby="ee-results-title"
        aria-live="polite"
      >
        <div className="ee-result-intro">
          <span className="ee-kicker">Same places. Different impression.</span>
          <h2 id="ee-results-title">
            {selected.name} vs {reference.name}
          </h2>
          <p>Approximate geographic area from the map outlines</p>
          <dl>
            <div>
              <dt>
                <span className="ee-dot ee-primary-dot" />
                {selected.name}
              </dt>
              <dd>{area(primary.areaKm2)}</dd>
            </div>
            <div>
              <dt>
                <span className="ee-dot ee-reference-dot" />
                {reference.name}
              </dt>
              <dd>{area(secondary.areaKm2)}</dd>
            </div>
          </dl>
        </div>
        <div className="ee-ratios">
          {[
            { label: 'Equal Earth · geographic area ratio', value: trueRatio },
            { label: 'Mercator · apparent area ratio', value: mercatorRatio },
          ].map((row) => (
            <div className="ee-ratio" key={row.label}>
              <div>
                <span>{row.label}</span>
                <strong>
                  {row.value == null ? 'Not comparable' : multiplier(row.value)}
                </strong>
              </div>
              <div className="ee-ratio-track" aria-hidden="true">
                <span
                  style={{
                    width: `${row.value == null ? 0 : (row.value / (row.value + 1)) * 100}%`,
                  }}
                />
              </div>
              <small>
                {row.value == null
                  ? 'A polar outline is clipped, so a full-area ratio is unavailable.'
                  : `${selected.name} / ${reference.name}`}
              </small>
            </div>
          ))}
          <p className="ee-takeaway">
            {sameRegion
              ? 'Choose a different comparison region to explore relative sizes.'
              : mercatorRatio == null
                ? 'Equal Earth can show both poles; Mercator cannot.'
                : trueRatio < 1
                  ? `${reference.name} is about ${multiplier(1 / trueRatio)} the geographic area of ${selected.name}. On Mercator, that ratio looks like ${multiplier(1 / mercatorRatio)}.`
                  : `${selected.name} is about ${multiplier(trueRatio)} the geographic area of ${reference.name}. On Mercator, it looks like ${multiplier(mercatorRatio)}.`}
          </p>
        </div>
      </section>
      <section className="ee-latitude-lab" aria-labelledby="ee-latitude-title">
        <div>
          <span className="ee-kicker">Try it yourself</span>
          <h2 id="ee-latitude-title">Move the same patch of Earth</h2>
          <p>
            Slide a circle toward the poles. Its geographic area stays fixed;
            watch what happens to its outline on each map.
          </p>
          <label className="ee-check">
            <input
              type="checkbox"
              checked={state.lens}
              onChange={(event) => setState({ lens: event.target.checked })}
            />
            Show the white circle on both maps
          </label>
        </div>
        <div className="ee-latitude-controls">
          <label htmlFor="ee-latitude">
            Circle latitude{' '}
            <output>
              {Math.abs(state.latitude)}°
              {state.latitude > 0 ? ' N' : state.latitude < 0 ? ' S' : ''}
            </output>
          </label>
          <input
            id="ee-latitude"
            type="range"
            min={-75}
            max={75}
            step={1}
            value={state.latitude}
            onChange={(event) =>
              setState({ latitude: Number(event.target.value), lens: true })
            }
          />
          <div className="ee-range-labels">
            <span>75° S</span>
            <span>Equator</span>
            <span>75° N</span>
          </div>
          <div className="ee-lens-stats">
            <div>
              <span>Equal Earth</span>
              <strong>1.00×</strong>
            </div>
            <div>
              <span>Mercator</span>
              <strong>{multiplier(lensMeasurements.inflation ?? 1)}</strong>
            </div>
          </div>
          <small>
            Whole-circle area multipliers. For a tiny patch, Mercator follows 1
            / cos²(latitude), exactly 4× at 60°.
          </small>
        </div>
      </section>
    </div>
  )
}
