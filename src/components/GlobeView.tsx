import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GeoPermissibleObjects } from 'd3-geo'
import type {
  CountryDatum,
  CountryFeature,
  GlobeHighlightCountry,
} from '../types'
import { EARTH_DIAMETER_KM, PLANETS } from '../solar'
import type { Planet } from '../solar'

type GlobeViewProps = {
  loading: boolean
  error: string | null
  worldFeatures: CountryFeature[]
  globePathGenerator: (input: GeoPermissibleObjects) => string | null
  globeSphere: GeoPermissibleObjects
  globeGraticule: GeoPermissibleObjects
  planetPathGenerator: (input: GeoPermissibleObjects) => string | null
  planetSphere: GeoPermissibleObjects
  planetGraticule: GeoPermissibleObjects
  globeHighlightCountries: GlobeHighlightCountry[]
  globeActiveMode: 'rotate' | 'country'
  globeDragging: boolean
  planetDragging: boolean
  solarSystemEnabled: boolean
  isGlobeFullscreen: boolean
  activePlanet: Planet
  activePlanetId: Planet['id']
  planetRatio: number
  planetCountry: CountryDatum | null
  planetCountryFeature: CountryFeature | null
  areaFormatter: Intl.NumberFormat
  selectedCountry: CountryDatum | null
  draggableCountries: CountryDatum[]
  globeSize: number
  planetPreviewSize: number
  globeFrameRef: React.RefObject<HTMLDivElement>
  globeSvgRef: React.RefObject<SVGSVGElement>
  planetCanvasRef: React.RefObject<HTMLCanvasElement>
  planetSvgRef: React.RefObject<SVGSVGElement>
  onResetScene: () => void
  onCenterSelected: () => void
  onToggleFullscreen: () => void
  onSetGlobeDragMode: (mode: 'rotate' | 'country') => void
  onToggleSolarSystem: () => void
  onGlobePointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  onGlobeCountryPointerDown: (
    event: ReactPointerEvent<SVGPathElement>,
    country: CountryDatum
  ) => void
  onPlanetPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPlanetCountryPointerDown: (event: ReactPointerEvent<SVGPathElement>) => void
  onSelectPlanet: (id: Planet['id']) => void
  onFocusCountry: (country: CountryDatum) => void
  formatLatitude: (lat: number) => string
  formatLongitude: (lon: number) => string
  formatPlanetRatio: (ratio: number) => string
}

const GlobeView = ({
  loading,
  error,
  worldFeatures,
  globePathGenerator,
  globeSphere,
  globeGraticule,
  planetPathGenerator,
  planetSphere,
  planetGraticule,
  globeHighlightCountries,
  globeActiveMode,
  globeDragging,
  planetDragging,
  solarSystemEnabled,
  isGlobeFullscreen,
  activePlanet,
  activePlanetId,
  planetRatio,
  planetCountry,
  planetCountryFeature,
  areaFormatter,
  selectedCountry,
  draggableCountries,
  globeSize,
  planetPreviewSize,
  globeFrameRef,
  globeSvgRef,
  planetCanvasRef,
  planetSvgRef,
  onResetScene,
  onCenterSelected,
  onToggleFullscreen,
  onSetGlobeDragMode,
  onToggleSolarSystem,
  onGlobePointerDown,
  onGlobeCountryPointerDown,
  onPlanetPointerDown,
  onPlanetCountryPointerDown,
  onSelectPlanet,
  onFocusCountry,
  formatLatitude,
  formatLongitude,
  formatPlanetRatio,
}: GlobeViewProps) => (
  <main className="layout globe-layout">
    <section className="globe-shell">
      <div className="globe-header">
        <h2>True-size globe view</h2>
        <p>
          {globeActiveMode === 'rotate'
            ? 'Drag to rotate the Earth. Use the comparison set to center a country.'
            : 'Drag a highlighted country to reposition it on the globe.'}
        </p>
        <div className="globe-controls">
          <div className="globe-actions">
            <button className="reset-button" type="button" onClick={onResetScene}>
              Reset scene
            </button>
            <button
              className="github-button"
              type="button"
              onClick={() => (selectedCountry ? onCenterSelected() : null)}
              disabled={!selectedCountry}
            >
              Center selected
            </button>
            <button
              className="github-button"
              type="button"
              onClick={onToggleFullscreen}
            >
              {isGlobeFullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
          <div className="globe-controls-secondary">
            <div className="globe-toggle" role="group" aria-label="Globe drag mode">
              <button
                className={`globe-toggle-button ${
                  globeActiveMode === 'rotate' ? 'is-active' : ''
                }`}
                type="button"
                aria-pressed={globeActiveMode === 'rotate'}
                onClick={() => onSetGlobeDragMode('rotate')}
              >
                Drag Earth
              </button>
              <button
                className={`globe-toggle-button ${
                  globeActiveMode === 'country' ? 'is-active' : ''
                }`}
                type="button"
                aria-pressed={globeActiveMode === 'country'}
                onClick={() => onSetGlobeDragMode('country')}
              >
                Drag Country
              </button>
            </div>
            <button
              className={`solar-toggle ${solarSystemEnabled ? 'is-on' : ''}`}
              type="button"
              aria-pressed={solarSystemEnabled}
              onClick={onToggleSolarSystem}
            >
              Solar system {solarSystemEnabled ? 'on' : 'off'}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`globe-frame ${isGlobeFullscreen ? 'is-fullscreen' : ''}`}
        ref={globeFrameRef}
      >
        {loading && <div className="map-loading">Loading globe...</div>}
        {error && <div className="map-error">{error}</div>}
        {!loading && !error && (
          <div className="globe-canvas">
            <svg
              className={`globe-svg ${globeDragging ? 'is-dragging' : ''} ${
                globeActiveMode === 'country' ? 'is-country-mode' : ''
              }`}
              viewBox={`0 0 ${globeSize} ${globeSize}`}
              role="img"
              aria-label="Orthographic globe with countries"
              onPointerDown={onGlobePointerDown}
              ref={globeSvgRef}
            >
              <defs>
                <radialGradient id="globeHighlight" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(119, 212, 255, 0.35)" />
                  <stop offset="55%" stopColor="rgba(10, 24, 44, 0.9)" />
                  <stop offset="100%" stopColor="rgba(7, 15, 28, 0.98)" />
                </radialGradient>
              </defs>
              <path
                className="globe-sphere"
                d={globePathGenerator(globeSphere) ?? ''}
                fill="url(#globeHighlight)"
              />
              <g className="globe-graticule">
                <path d={globePathGenerator(globeGraticule) ?? ''} />
              </g>
              <g className="globe-world">
                {worldFeatures.map((feature, index) => (
                  <path
                    key={`globe-world-${feature.id ?? index}`}
                    d={globePathGenerator(feature) ?? ''}
                  />
                ))}
              </g>
              <g
                className={`globe-highlight ${
                  globeActiveMode === 'country' ? 'is-draggable' : ''
                }`}
              >
                {globeHighlightCountries.map(({ country, feature }) => (
                  <path
                    key={`globe-country-${country.id}`}
                    d={globePathGenerator(feature) ?? ''}
                    fill={country.color}
                    onPointerDown={(event) =>
                      onGlobeCountryPointerDown(event, country)
                    }
                  />
                ))}
              </g>
            </svg>
          </div>
        )}
        {!loading && !error && solarSystemEnabled && (
          <div
            className={`planet-inset ${
              globeActiveMode === 'country' ? 'is-active' : ''
            } ${isGlobeFullscreen ? 'is-large' : ''}`}
          >
            <div className="planet-inset-header">
              <span className="planet-label">Planet preview</span>
              <span className="planet-title">{activePlanet.name}</span>
            </div>
            <div className="planet-visual">
              <canvas
                className="planet-canvas"
                width={planetPreviewSize}
                height={planetPreviewSize}
                ref={planetCanvasRef}
                aria-hidden="true"
              />
              <svg
                className={`planet-svg ${
                  globeActiveMode === 'rotate' ? 'is-rotatable' : ''
                } ${planetDragging ? 'is-dragging' : ''}`}
                viewBox={`0 0 ${planetPreviewSize} ${planetPreviewSize}`}
                role="img"
                aria-label={`Planet preview of ${activePlanet.name}`}
                ref={planetSvgRef}
                onPointerDown={onPlanetPointerDown}
              >
                <defs>
                  <radialGradient id="planetHighlight" cx="32%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="rgba(124, 196, 255, 0.3)" />
                    <stop offset="60%" stopColor="rgba(8, 20, 36, 0.9)" />
                    <stop offset="100%" stopColor="rgba(6, 12, 22, 0.98)" />
                  </radialGradient>
                </defs>
                <path
                  className="planet-sphere"
                  d={planetPathGenerator(planetSphere) ?? ''}
                />
                <g className="planet-graticule">
                  <path d={planetPathGenerator(planetGraticule) ?? ''} />
                </g>
                <path
                  className="planet-shade"
                  d={planetPathGenerator(planetSphere) ?? ''}
                  fill="url(#planetHighlight)"
                />
                {planetCountryFeature && planetCountry ? (
                  <path
                    className="planet-country"
                    d={planetPathGenerator(planetCountryFeature) ?? ''}
                    fill={planetCountry.color}
                    onPointerDown={onPlanetCountryPointerDown}
                  />
                ) : (
                  <text
                    className="planet-placeholder"
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    Drop a country
                  </text>
                )}
              </svg>
            </div>
            <div className="planet-inset-meta">
              {areaFormatter.format(activePlanet.diameterKm)} km ·{' '}
              {formatPlanetRatio(planetRatio)}
            </div>
          </div>
        )}
        {isGlobeFullscreen && (
          <button
            className="fullscreen-exit"
            type="button"
            onClick={onToggleFullscreen}
          >
            Exit full screen
          </button>
        )}
      </div>

      <p className="globe-hint">
        {globeActiveMode === 'rotate'
          ? 'Drag to spin the globe. The comparison set stays at true scale. Hold Cmd/Ctrl to drag countries.'
          : solarSystemEnabled
            ? 'Drag a highlighted country to move it across the globe or drop it on the planet preview.'
            : 'Drag a highlighted country to move it across the globe.'}
      </p>
    </section>

    <aside className="info-panel globe-panel">
      <div className="panel-title">Selected country</div>
      {selectedCountry ? (
        <div className="panel-content">
          <div className="country-title">
            <span
              className="color-dot"
              style={{ backgroundColor: selectedCountry.color }}
            />
            <h3>{selectedCountry.name}</h3>
          </div>
          <div className="panel-metric">
            <span className="metric-label">Centroid longitude</span>
            <span className="metric-value">
              {formatLongitude(selectedCountry.globeCentroid[0])}
            </span>
          </div>
          <div className="panel-metric">
            <span className="metric-label">Centroid latitude</span>
            <span className="metric-value">
              {formatLatitude(selectedCountry.globeCentroid[1])}
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
        <div className="panel-empty">Pick a country from the comparison set.</div>
      )}
      {solarSystemEnabled && (
        <div className="panel-section planet-section">
          <div className="panel-subtitle">Planet scale</div>
          <div className="planet-list">
            {PLANETS.map((planet) => {
              const ratio = planet.diameterKm / EARTH_DIAMETER_KM
              return (
                <button
                  key={planet.id}
                  className={`planet-item ${
                    activePlanetId === planet.id ? 'is-active' : ''
                  }`}
                  type="button"
                  aria-pressed={activePlanetId === planet.id}
                  onClick={() => onSelectPlanet(planet.id)}
                >
                  <span className="planet-name">{planet.name}</span>
                  <span className="planet-meta">
                    {areaFormatter.format(planet.diameterKm)} km ·{' '}
                    {formatPlanetRatio(ratio)}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="planet-hint">
            Drag a highlighted country onto the planet preview.
          </div>
        </div>
      )}
      <div className="panel-section">
        <div className="panel-subtitle">Comparison set</div>
        <div className="legend">
          {draggableCountries.length > 0 ? (
            draggableCountries.map((country) => (
              <button
                key={`globe-legend-${country.id}`}
                className={`legend-item ${
                  selectedCountry?.id === country.id ? 'is-active' : ''
                }`}
                type="button"
                onClick={() => onFocusCountry(country)}
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
      </div>
      <div className="panel-foot">
        Switch to the Mercator tab to change the comparison set.
      </div>
    </aside>
  </main>
)

export default GlobeView
