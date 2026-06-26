import { EQUATOR_FAQS } from '../seo'

const EquatorSeoContent = () => {
  return (
    <section className="seo-content" aria-labelledby="equator-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">Custom Mercator Projection Guide</p>
        <h2 id="equator-seo-title">
          Move the equator and reshape the Mercator projection
        </h2>
        <p>
          The Mercator projection distorts area based on distance from the
          equator. This lab lets you redefine where that line of least
          distortion sits, then watch the same projection stretch the world from
          a new center in real time.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How the projection lab works</h3>
          <ol>
            <li>Tilt or move the equator line across the globe.</li>
            <li>Watch countries near the new equator shrink toward true scale.</li>
            <li>See how places far from it stretch and inflate.</li>
          </ol>
        </section>
        <section>
          <h3>Why Mercator distorts the world</h3>
          <p>
            Mercator preserves angles and shapes for navigation, but it cannot
            keep area on a flat sheet. The scale factor grows toward the poles,
            so land far from the equator looks far larger than it really is.
          </p>
        </section>
      </div>

      <section aria-labelledby="equator-tools-title">
        <h3 id="equator-tools-title">More interactive map tools</h3>
        <div className="seo-link-grid">
          <a href="/tool/true-size-map">True Size of Countries Map</a>
          <a href="/tool/true-size-map/country-size-on-planets">
            Country Size on Other Planets
          </a>
          <a href="/tool/true-size-map/sea-level-rise-simulator">
            Sea Level Rise Simulator
          </a>
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="equator-faq-title">
        <h3 id="equator-faq-title">FAQ</h3>
        {EQUATOR_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}

export default EquatorSeoContent
