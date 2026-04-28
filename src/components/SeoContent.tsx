import seoMeta from '../seo-meta.json'
import {
  MAIN_FAQS,
  POPULAR_COMPARISON_LINKS,
  formatSeoArea,
} from '../seo'

type ComparisonMeta =
  (typeof seoMeta.comparisons)[keyof typeof seoMeta.comparisons]

type SeoContentProps = {
  comparison: ComparisonMeta | null
}

const SeoContent = ({ comparison }: SeoContentProps) => {
  if (comparison) {
    const ratio = comparison.secondaryAreaKm2 / comparison.primaryAreaKm2
    const ratioText =
      ratio >= 1
        ? `${comparison.secondaryName} is about ${ratio.toFixed(1)} times larger than ${comparison.primaryName}.`
        : `${comparison.primaryName} is about ${(1 / ratio).toFixed(1)} times larger than ${comparison.secondaryName}.`

    return (
      <section className="seo-content" aria-labelledby="comparison-seo-title">
        <div className="seo-section-header">
          <p className="seo-kicker">True Size Comparison</p>
          <h2 id="comparison-seo-title">
            Compare {comparison.primaryName} and {comparison.secondaryName} at
            true scale
          </h2>
          <p>{comparison.intro}</p>
        </div>

        <div className="seo-stat-grid">
          <article className="seo-stat">
            <span className="seo-stat-label">{comparison.primaryName}</span>
            <strong>{formatSeoArea(comparison.primaryAreaKm2)} km2</strong>
          </article>
          <article className="seo-stat">
            <span className="seo-stat-label">
              {comparison.secondaryName}
              {comparison.secondaryType === 'continent' ? ' continent' : ''}
            </span>
            <strong>{formatSeoArea(comparison.secondaryAreaKm2)} km2</strong>
          </article>
          <article className="seo-stat seo-stat-wide">
            <span className="seo-stat-label">Key takeaway</span>
            <strong>{ratioText}</strong>
          </article>
        </div>

        <p className="seo-callout">{comparison.takeaway}</p>

        <div className="seo-two-column">
          <section>
            <h3>How the map helps</h3>
            <p>
              Use the interactive Mercator map above to move countries away
              from their original latitude. The shape is repositioned on the
              same projection so you can see how apparent scale changes in real
              time.
            </p>
          </section>
          <section>
            <h3>Why the result can be surprising</h3>
            <p>
              Traditional world maps often exaggerate high-latitude countries.
              A true size comparison makes the area relationship clearer than a
              static Mercator map.
            </p>
          </section>
        </div>

        <section className="seo-faq" aria-labelledby="comparison-faq-title">
          <h3 id="comparison-faq-title">FAQ</h3>
          {comparison.faq.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
      </section>
    )
  }

  return (
    <section className="seo-content" aria-labelledby="true-size-map-seo-title">
      <div className="seo-section-header">
        <p className="seo-kicker">True Size Map Guide</p>
        <h2 id="true-size-map-seo-title">
          Compare the real size of countries on an interactive world map
        </h2>
        <p>
          This true size of countries map lets you drag countries across a
          Mercator world map and compare their real geographic area. It is built
          for searches like true size map, real size map, and country size
          comparison.
        </p>
      </div>

      <div className="seo-two-column">
        <section>
          <h3>How to use the true size map</h3>
          <ol>
            <li>Choose one or more countries in the comparison set.</li>
            <li>Drag a colored country shape north or south on the map.</li>
            <li>Read the area, latitude, and Mercator scale factor.</li>
            <li>Compare places such as Greenland, Russia, Canada, Brazil, India, and the United States.</li>
          </ol>
        </section>
        <section>
          <h3>Why Mercator maps distort country size</h3>
          <p>
            Mercator projection is useful for navigation because it preserves
            local angles, but it cannot preserve true area on a flat map.
            Distance from the equator increases the scale factor, so countries
            near the poles look much larger than they really are.
          </p>
        </section>
      </div>

      <section aria-labelledby="popular-comparisons-title">
        <h3 id="popular-comparisons-title">Popular country size comparisons</h3>
        <div className="seo-link-grid">
          {POPULAR_COMPARISON_LINKS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.title}
            </a>
          ))}
        </div>
      </section>

      <section className="seo-faq" aria-labelledby="main-faq-title">
        <h3 id="main-faq-title">FAQ</h3>
        {MAIN_FAQS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </section>
  )
}

export default SeoContent
