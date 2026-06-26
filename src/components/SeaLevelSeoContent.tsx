import { SEA_LEVEL_FAQS } from '../seo'

const SeaLevelSeoContent = () => {
  return (
    <section className="seo-content" aria-labelledby="sea-level-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">Sea Level Rise Map Guide</p>
        <h2 id="sea-level-seo-title">
          Visualize coastal flooding from rising sea levels
        </h2>
        <p>
          This interactive sea level rise simulator overlays a sea-level
          threshold you choose onto real terrain elevation and highlights every
          region that falls below it. Move the level up or down to preview how
          coastlines, river deltas, and low-lying cities change as the sea rises,
          on a flat 2D map or a 3D globe.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How the sea level simulator works</h3>
          <ol>
            <li>Pick a target sea level, from a small rise to several metres.</li>
            <li>
              The map shades every area whose elevation sits below that level.
            </li>
            <li>Switch between the 2D map and 3D globe to explore any coast.</li>
            <li>Export an image to share the flooded extent you found.</li>
          </ol>
        </section>
        <section>
          <h3>What the blue overlay means</h3>
          <p>
            The blue overlay marks land lower than the selected sea level, read
            from an open global digital elevation model. It is an elevation
            visualization, not a hydrological flood model: it does not account
            for tides, storm surge, drainage, or land subsidence, so use it to
            understand exposure and scale rather than as a forecast.
          </p>
        </section>
      </div>

      <section aria-labelledby="sea-level-tools-title">
        <h3 id="sea-level-tools-title">More interactive map tools</h3>
        <div className="seo-link-grid">
          <a href="/tool/true-size-map">True Size of Countries Map</a>
          <a href="/tool/true-size-map/country-size-on-planets">
            Country Size on Other Planets
          </a>
          <a href="/tool/true-size-map/custom-mercator-projection">
            Custom Mercator Projection
          </a>
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="sea-level-faq-title">
        <h3 id="sea-level-faq-title">FAQ</h3>
        {SEA_LEVEL_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}

export default SeaLevelSeoContent
