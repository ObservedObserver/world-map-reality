import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GeoPermissibleObjects } from 'd3-geo'
import type {
  CountryDatum,
  CountryFeature,
  MapRenderedCountry,
  SelectedDetails,
} from '../types'

type MapLatLine = {
  lat: number
  path: string | null
  label: string
  labelX: number | null
  labelY: number | null
  isEquator: boolean
}

type MapViewProps = {
  loading: boolean
  error: string | null
  mapWidth: number
  mapHeight: number
  worldFeatures: CountryFeature[]
  pathGenerator: (input: GeoPermissibleObjects) => string | null
  latLines: MapLatLine[]
  renderedCountries: MapRenderedCountry[]
  draggableCountries: CountryDatum[]
  selectedCountry: CountryDatum | null
  selectedDetails: SelectedDetails | null
  selectedId: string | null
  countryFilter: string
  filteredCountries: CountryDatum[]
  draggableIds: string[]
  areaFormatter: Intl.NumberFormat
  formatLatitude: (lat: number) => string
  formatScale: (scale: number) => string
  onResetPositions: () => void
  onSelectCountry: (id: string) => void
  onCountryPointerDown: (
    event: ReactPointerEvent<SVGGElement>,
    country: CountryDatum
  ) => void
  onCountryFilterChange: (value: string) => void
  onToggleDraggable: (id: string) => void
}

const MapView = ({
  loading,
  error,
  mapWidth,
  mapHeight,
  worldFeatures,
  pathGenerator,
  latLines,
  renderedCountries,
  draggableCountries,
  selectedCountry,
  selectedDetails,
  selectedId,
  countryFilter,
  filteredCountries,
  draggableIds,
  areaFormatter,
  formatLatitude,
  formatScale,
  onResetPositions,
  onSelectCountry,
  onCountryPointerDown,
  onCountryFilterChange,
  onToggleDraggable,
}: MapViewProps) => (
  <main className="layout">
    <section className="map-shell">
      <div className="map-header">
        <h2>Move the comparison set</h2>
        <p>
          Drag any colored country anywhere on the map. The size updates based
          on its new latitude, just like Mercator does.
        </p>
        <div className="map-header-actions">
          <button className="reset-button" type="button" onClick={onResetPositions}>
            Reset positions
          </button>
          <a
            className="github-button"
            href="https://github.com/ObservedObserver/world-map-reality"
            target="_blank"
          >
            View on GitHub
          </a>
          <a
            className="github-button"
            href="https://www.runcell.dev"
            target="_blank"
          >
            Home
          </a>
        </div>
      </div>

      <div className="map-frame">
        {loading && <div className="map-loading">Loading map...</div>}
        {error && <div className="map-error">{error}</div>}
        {!loading && !error && (
          <svg
            className="map-svg"
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            role="img"
            aria-label="Mercator world map with draggable countries"
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

            <rect className="map-ocean" width={mapWidth} height={mapHeight} />

            <g className="world-base">
              {worldFeatures.map((feature, index) => (
                <path
                  key={`world-${feature.id ?? index}`}
                  d={pathGenerator(feature) ?? ''}
                />
              ))}
            </g>

            <g className="lat-lines">
              {latLines.map((latLine) => {
                if (!latLine.path) {
                  return null
                }
                return (
                  <path
                    key={`lat-${latLine.lat}`}
                    d={latLine.path}
                    className={`lat-line ${latLine.isEquator ? 'equator' : ''}`}
                  />
                )
              })}
            </g>

            <g className="lat-labels">
              {latLines.map((latLine) => {
                if (latLine.labelX === null || latLine.labelY === null) {
                  return null
                }
                return (
                  <text
                    key={`label-${latLine.lat}`}
                    x={latLine.labelX}
                    y={latLine.labelY}
                  >
                    {latLine.label}
                  </text>
                )
              })}
            </g>

            <g className="countries">
              {renderedCountries.map((item) => (
                <g
                  key={item.country.id}
                  className={`country-group ${
                    item.isSelected ? 'is-selected' : ''
                  } ${item.isDragging ? 'is-dragging' : ''} ${
                    item.isDraggable ? '' : 'is-disabled'
                  }`}
                  onPointerDown={(event) =>
                    onCountryPointerDown(event, item.country)
                  }
                  role="button"
                  aria-label={`Drag ${item.country.name}`}
                >
                  <path
                    className="country-shape"
                    d={pathGenerator(item.feature) ?? ''}
                    fill={item.country.color}
                  />
                </g>
              ))}
            </g>
          </svg>
        )}
      </div>

      <div className="map-footer">
        <div className="legend">
          {draggableCountries.length > 0 ? (
            draggableCountries.map((country) => (
              <button
                key={`legend-${country.id}`}
                className={`legend-item ${
                  selectedId === country.id ? 'is-active' : ''
                }`}
                type="button"
                onClick={() => onSelectCountry(country.id)}
              >
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: country.color }}
                  aria-hidden="true"
                />
                {country.name}
              </button>
            ))
          ) : (
            <div className="legend-empty">No countries selected yet.</div>
          )}
        </div>
        <p className="map-hint">
          Tip: Move Greenland down near DR Congo to compare the contrast.
        </p>
      </div>
    </section>

    <aside className="info-panel">
      <div className="panel-title">Selected country</div>
      {selectedCountry && selectedDetails ? (
        <div className="panel-content">
          <div className="country-title">
            <span
              className="color-dot"
              style={{ backgroundColor: selectedCountry.color }}
            />
            <h3>{selectedCountry.name}</h3>
          </div>
          <div className="panel-metric">
            <span className="metric-label">Original latitude</span>
            <span className="metric-value">
              {formatLatitude(selectedDetails.originalLat)}
            </span>
          </div>
          <div className="panel-metric">
            <span className="metric-label">Current latitude</span>
            <span className="metric-value">
              {formatLatitude(selectedDetails.currentLat)}
            </span>
          </div>
          <div className="panel-metric">
            <span className="metric-label">Mercator scale factor</span>
            <span className="metric-value">
              {formatScale(selectedDetails.currentScale)} of original size
            </span>
          </div>
          <div className="panel-metric">
            <span className="metric-label">Area</span>
            <span className="metric-value">
              {selectedCountry.area
                ? `${areaFormatter.format(selectedCountry.area)} km²`
                : 'Unknown'}
            </span>
          </div>
        </div>
      ) : (
        <div className="panel-empty">
          Select a country to inspect its latitude and scale.
        </div>
      )}
      <div className="panel-section">
        <div className="panel-subtitle">Draggable set</div>
        <div className="drag-search">
          <input
            type="search"
            placeholder="Search countries..."
            value={countryFilter}
            onChange={(event) => onCountryFilterChange(event.target.value)}
            aria-label="Search countries"
          />
        </div>
        <div className="drag-list">
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country) => {
              const isDraggable = draggableIds.includes(country.id)
              return (
                <label
                  key={`drag-${country.id}`}
                  className={`drag-item ${isDraggable ? 'is-on' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isDraggable}
                    onChange={() => onToggleDraggable(country.id)}
                  />
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: country.color }}
                    aria-hidden="true"
                  />
                  <span>{country.name}</span>
                </label>
              )
            })
          ) : (
            <div className="drag-empty">No matches.</div>
          )}
        </div>
      </div>
      <div className="panel-foot">
        Dragging shifts latitude, which updates the Mercator inflation in real
        time.
      </div>
    </aside>
  </main>
)

export default MapView
