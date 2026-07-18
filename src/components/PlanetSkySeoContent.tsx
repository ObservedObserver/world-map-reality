import { MOON_PLANETS_FAQS } from '../seo'

const ANGULAR_SIZE_ROWS = [
  { body: 'Moon (actual)', diameter: '3,475 km', angular: '0.52°', vsMoon: '1×' },
  { body: 'Mercury', diameter: '4,879 km', angular: '0.73°', vsMoon: '1.4×' },
  { body: 'Mars', diameter: '6,779 km', angular: '1.0°', vsMoon: '2×' },
  { body: 'Venus', diameter: '12,104 km', angular: '1.8°', vsMoon: '3.5×' },
  { body: 'Earth', diameter: '12,742 km', angular: '1.9°', vsMoon: '3.7×' },
  { body: 'Neptune', diameter: '49,528 km', angular: '7.4°', vsMoon: '14×' },
  { body: 'Uranus', diameter: '51,118 km', angular: '7.6°', vsMoon: '15×' },
  {
    body: 'Saturn (rings)',
    diameter: '120,536 km (280,440 km)',
    angular: '18.0° (rings 40.1° face-on)',
    vsMoon: '35× (77×)',
  },
  { body: 'Jupiter', diameter: '142,984 km', angular: '21.4°', vsMoon: '41×' },
  {
    body: 'Sun',
    diameter: '1,391,400 km',
    angular: 'Earth would be inside it',
    vsMoon: '—',
  },
]

export default function PlanetSkySeoContent() {
  return (
    <section className="seo-content" aria-labelledby="planet-sky-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">If the Moon Were Replaced by Planets</p>
        <h2 id="planet-sky-seo-title">
          What would other planets look like in the Moon&apos;s place?
        </h2>
        <p>
          The full Moon covers only half a degree of sky, yet it dominates the
          night. This simulator swaps the Moon for Mercury, Venus, Earth, Mars,
          Jupiter, Saturn, Uranus, Neptune, or the Sun at the Moon&apos;s
          distance of 384,400 km, rendering each one at its true angular size
          over a night landscape. Drag to look around, change the phase, and
          pull the planet closer or farther to see how the view changes.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How to use the night sky simulator</h3>
          <ol>
            <li>Pick a body — the scene starts with the real Moon for scale.</li>
            <li>Drag inside the view to look around; scroll or pinch to zoom.</li>
            <li>Adjust the phase slider to light the planet like a waxing or waning Moon.</li>
            <li>Move the distance slider from 0.25× to 16× the Moon&apos;s distance.</li>
          </ol>
        </section>
        <section>
          <h3>Why do planets look like dots in the real sky?</h3>
          <p>
            Angular size falls with distance. Jupiter is 40 times wider than the
            Moon, but it orbits about 1,600 times farther away, so it shrinks to
            under an arcminute — a bright point. Placed at the Moon&apos;s
            distance instead, the same planet would stretch across 21 degrees of
            sky, more than forty full Moons side by side.
          </p>
        </section>
      </div>

      <section aria-labelledby="planet-sky-table-title">
        <h3 id="planet-sky-table-title">
          Angular size of each planet at the Moon&apos;s distance
        </h3>
        <div className="planet-sky-table-wrap">
          <table className="planet-sky-table">
            <thead>
              <tr>
                <th scope="col">Body</th>
                <th scope="col">Diameter</th>
                <th scope="col">Apparent size in the sky</th>
                <th scope="col">Vs full Moon</th>
              </tr>
            </thead>
            <tbody>
              {ANGULAR_SIZE_ROWS.map((row) => (
                <tr key={row.body}>
                  <th scope="row">{row.body}</th>
                  <td>{row.diameter}</td>
                  <td>{row.angular}</td>
                  <td>{row.vsMoon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Apparent size is the full angular diameter of the sphere&apos;s limb,
          2·asin(radius ÷ 384,400 km). The ring figure is the face-on
          reference span, 2·atan(radius ÷ distance) — tilt the rings and
          perspective stretches the widest chord slightly, to about 42° at
          this simulator&apos;s default pose; the 3D scene handles that
          naturally. For comparison, your fist at arm&apos;s length covers
          about 10
          degrees — Jupiter in the Moon&apos;s place would be two fists wide,
          and Saturn&apos;s rings would span four.
        </p>
      </section>

      <section aria-labelledby="planet-sky-physics-title">
        <h3 id="planet-sky-physics-title">
          A visual thought experiment, not a survivable one
        </h3>
        <p>
          This tool answers only what your eyes would see. Gravity is another
          story: a gas giant at 384,400 km would raise ocean tides hundreds of
          times stronger than the Moon&apos;s, stress Earth&apos;s crust, and in
          Jupiter&apos;s case place Earth inside its Roche limit and radiation
          belts. The Sun is the extreme case — its radius of 696,000 km is
          nearly twice the Moon&apos;s distance, so Earth would simply be inside
          it. The simulator flags that scenario when you select the Sun.
        </p>
      </section>

      <section aria-labelledby="planet-sky-related-title">
        <h3 id="planet-sky-related-title">More interactive science tools</h3>
        <div className="seo-link-grid">
          <a href="/tool/true-size-map/country-size-on-planets">Country Size on Other Planets</a>
          <a href="/tool/true-size-map/sun-analemma-calculator">Sun Analemma Calculator</a>
          <a href="/tool/true-size-map/asteroid-impact-simulator">Asteroid Impact Simulator</a>
          <a href="/tool/true-size-map/sea-level-rise-simulator">Sea Level Rise Simulator</a>
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="planet-sky-faq-title">
        <h3 id="planet-sky-faq-title">Planets in place of the Moon FAQ</h3>
        {MOON_PLANETS_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}
