import { ASTEROID_FAQS } from '../seo'

const AsteroidSeoContent = () => {
  return (
    <section className="seo-content" aria-labelledby="asteroid-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">Asteroid Impact Simulator</p>
        <h2 id="asteroid-seo-title">
          Map the crater, fireball, and blast zones of an asteroid impact
        </h2>
        <p>
          This asteroid impact simulator lets you drop a meteor anywhere on an interactive map and
          watch the devastation spread as concentric effect zones. Choose the asteroid&apos;s
          diameter, speed, impact angle, and composition — ice, rock, or iron — and the tool models
          the impact energy, crater, fireball, thermal burns, air-blast overpressure, peak winds,
          and earthquake magnitude.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How to use the impact map</h3>
          <ol>
            <li>Tap the map (or pick a city) to set the impact point.</li>
            <li>Drag the diameter, speed, and angle sliders, or load a famous-impact preset.</li>
            <li>Choose a composition: ice, porous rock, dense rock, or iron.</li>
            <li>Read the crater, fireball, burn, and blast radii on the map and in the results.</li>
          </ol>
        </section>
        <section>
          <h3>How the impact effects are calculated</h3>
          <p>
            The simulator implements the Earth Impact Effects Program of Collins, Melosh, and Marcus
            (2005). It first models atmospheric entry to decide whether the asteroid reaches the
            ground or detonates as an airburst, then applies crater-scaling laws, a fireball thermal
            model, the Gutenberg–Richter energy relation for seismic magnitude, and nuclear-test
            blast data for the overpressure rings.
          </p>
        </section>
      </div>

      <section aria-labelledby="asteroid-zones-title">
        <h3 id="asteroid-zones-title">What the effect zones mean</h3>
        <p>
          The rings are drawn outward from the impact point. The crater and fireball sit at the
          center, surrounded by thermal-radiation zones (third-, second-, and first-degree burns)
          and air-blast overpressure rings: about 20 psi where reinforced and steel-framed buildings
          collapse, 5 psi where most homes and buildings collapse, and 1 psi where windows shatter
          and injuries become widespread.
        </p>
      </section>

      <section aria-labelledby="asteroid-related-title">
        <h3 id="asteroid-related-title">More interactive map tools</h3>
        <div className="seo-link-grid">
          <a href="/tool/true-size-map">True Size of Countries Map</a>
          <a href="/tool/true-size-map/sea-level-rise-simulator">Sea Level Rise Simulator</a>
          <a href="/tool/true-size-map/country-size-on-planets">Country Size on Other Planets</a>
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="asteroid-faq-title">
        <h3 id="asteroid-faq-title">FAQ</h3>
        {ASTEROID_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}

export default AsteroidSeoContent
