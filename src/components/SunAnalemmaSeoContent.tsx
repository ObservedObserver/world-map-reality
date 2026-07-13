import { SUN_ANALEMMA_FAQS } from '../seo'

export default function SunAnalemmaSeoContent() {
  return (
    <section className="seo-content" aria-labelledby="analemma-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">Interactive Sun Analemma Calculator</p>
        <h2 id="analemma-seo-title">
          Plot the Sun&apos;s figure-eight path for any location on Earth
        </h2>
        <p>
          A solar analemma is the lopsided figure eight traced by the Sun when
          you record its position at the same clock time every day for a year.
          This interactive analemma calculator plots solar altitude against
          compass azimuth, then lets you change the observation time and move
          the observer anywhere on the world map.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How to use the Sun analemma explorer</h3>
          <ol>
            <li>Set a UTC observation time with the first slider.</li>
            <li>Drag the date slider or select a plotted point to inspect it.</li>
            <li>Choose a city preset, or click and drag on the world map.</li>
            <li>Compare daily, weekly, and monthly samples of the same path.</li>
          </ol>
        </section>
        <section>
          <h3>Why does the analemma look like a figure eight?</h3>
          <p>
            Earth&apos;s axis is tilted by about 23.4 degrees, moving the Sun north
            and south through the seasons. Earth also travels around the Sun in
            a slightly elliptical orbit, so apparent solar time runs a little
            fast or slow during different parts of the year. Those two motions
            combine to create the asymmetric loop.
          </p>
        </section>
      </div>

      <section aria-labelledby="analemma-chart-title">
        <h3 id="analemma-chart-title">How to read an analemma diagram</h3>
        <p>
          The vertical axis is solar altitude: 0 degrees is the horizon and 90
          degrees is directly overhead. The horizontal axis is azimuth, the
          compass direction measured clockwise from north. Dot color identifies
          the month, and the highlighted dot reports the Sun&apos;s position for the
          selected date. Faint background loops show the analemmas produced by
          other hours of the day.
        </p>
      </section>

      <section aria-labelledby="analemma-related-title">
        <h3 id="analemma-related-title">More interactive science tools</h3>
        <div className="seo-link-grid">
          <a href="/tool/true-size-map/custom-mercator-projection">Custom Mercator Projection Lab</a>
          <a href="/tool/true-size-map/sea-level-rise-simulator">Sea Level Rise Simulator</a>
          <a href="/tool/true-size-map/asteroid-impact-simulator">Asteroid Impact Simulator</a>
          <a href="/tool/true-size-map/country-size-on-planets">Country Size on Other Planets</a>
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="analemma-faq-title">
        <h3 id="analemma-faq-title">Sun analemma FAQ</h3>
        {SUN_ANALEMMA_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}

