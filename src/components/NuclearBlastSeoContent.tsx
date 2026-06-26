import { NUCLEAR_FAQS } from '../seo'

const NuclearBlastSeoContent = () => {
  return (
    <section className="seo-content" aria-labelledby="nuclear-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">Nuclear Blast Radius Map</p>
        <h2 id="nuclear-seo-title">
          Map the blast, thermal, and radiation rings of a nuclear bomb
        </h2>
        <p>
          This nuclear blast radius map lets you place a detonation anywhere on an interactive map
          and see the effects spread as concentric rings. Choose a weapon yield — from the
          15-kiloton Hiroshima bomb to the 50-megaton Tsar Bomba, or any custom value — toggle
          between an airburst and a surface burst, and the tool models the fireball, the air-blast
          overpressure zones where buildings collapse and windows break, the thermal radiation that
          causes burns, and the prompt-radiation radius for smaller weapons.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How to use the nuclear bomb map</h3>
          <ol>
            <li>Tap the map (or pick a city) to set the target — ground zero.</li>
            <li>Choose a preset bomb or drag the yield slider, then enter a custom yield if you like.</li>
            <li>Switch between an airburst and a surface burst to compare the effects.</li>
            <li>Read the fireball, blast, thermal, and radiation radii on the map and in the results.</li>
          </ol>
        </section>
        <section>
          <h3>How the blast radius is calculated</h3>
          <p>
            The map uses the standard scaling laws from Glasstone and Dolan&apos;s{' '}
            <em>The Effects of Nuclear Weapons</em>, the same public reference behind NUKEMAP. Air
            blast follows cube-root yield scaling, so each overpressure ring grows with the cube root
            of the yield. Thermal radiation is modeled from the fireball&apos;s heat output and the
            distance it travels through clear air, and prompt ionizing radiation is attenuated
            exponentially by the atmosphere.
          </p>
        </section>
      </div>

      <section aria-labelledby="nuclear-zones-title">
        <h3 id="nuclear-zones-title">What the effect rings mean</h3>
        <p>
          The rings are drawn outward from ground zero. At the center is the fireball, followed by
          the heavy blast ring (about 20 psi, where even reinforced concrete buildings are
          destroyed), the moderate blast ring (about 5 psi, where most residential buildings collapse
          and fatalities are widespread), and the light blast ring (about 1 psi, where windows
          shatter and flying glass causes injuries). A thermal-radiation ring marks where the heat
          flash is intense enough to cause third-degree burns, and for smaller weapons a
          prompt-radiation ring shows where the immediate dose is around 500 rem.
        </p>
      </section>

      <section aria-labelledby="nuclear-related-title">
        <h3 id="nuclear-related-title">More interactive map tools</h3>
        <div className="seo-link-grid">
          <a href="/tool/true-size-map/asteroid-impact-simulator">Asteroid Impact Simulator</a>
          <a href="/tool/true-size-map/sea-level-rise-simulator">Sea Level Rise Simulator</a>
          <a href="/tool/true-size-map">True Size of Countries Map</a>
          <a href="/tool/true-size-map/country-size-on-planets">Country Size on Other Planets</a>
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="nuclear-faq-title">
        <h3 id="nuclear-faq-title">FAQ</h3>
        {NUCLEAR_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}

export default NuclearBlastSeoContent
