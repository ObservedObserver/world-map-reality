import { GLOBE_FAQS } from '../seo'

const GlobeSeoContent = () => {
  return (
    <section className="seo-content" aria-labelledby="globe-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">True Globe Guide</p>
        <h2 id="globe-seo-title">Compare country sizes on a true globe</h2>
        <p>
          Spin an orthographic globe to compare countries at their real scale,
          free of the Mercator distortion that inflates places near the poles.
          Then drop a country onto the Moon, Mars, or another planet to see how
          it measures up against other worlds.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How to use the globe</h3>
          <ol>
            <li>Pick a country from the list.</li>
            <li>Drag to spin the globe and view it from any angle.</li>
            <li>Switch on a planet to compare the country against that world.</li>
          </ol>
        </section>
        <section>
          <h3>Why a globe beats a flat map</h3>
          <p>
            A flat Mercator map stretches land toward the poles, so Greenland
            and Russia look far larger than they are. A globe keeps relative
            areas honest, which is why country comparisons look so different
            here.
          </p>
        </section>
      </div>

      <section aria-labelledby="globe-tools-title">
        <h3 id="globe-tools-title">More interactive map tools</h3>
        <div className="seo-link-grid">
          <a href="/tool/true-size-map">True Size of Countries Map</a>
          <a href="/tool/true-size-map/custom-mercator-projection">
            Custom Mercator Projection
          </a>
          <a href="/tool/true-size-map/sea-level-rise-simulator">
            Sea Level Rise Simulator
          </a>
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="globe-faq-title">
        <h3 id="globe-faq-title">FAQ</h3>
        {GLOBE_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}

export default GlobeSeoContent
