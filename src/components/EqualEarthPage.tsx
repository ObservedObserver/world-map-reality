import { lazy, Suspense, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { NavLink } from 'react-router-dom'
import { ArrowUpRight, Compass, Globe2, Map, Orbit } from 'lucide-react'
import MapErrorBoundary from './MapErrorBoundary'
import seoMeta from '../seo-meta.json'
import './EqualEarth.css'

const EqualEarthView = lazy(() => import('./EqualEarthView'))
const faqs = [
  {
    question: 'What is the Equal Earth projection?',
    answer:
      'Equal Earth is an equal-area world map projection created in 2018 by Bojan Šavrič, Tom Patterson, and Bernhard Jenny. Countries and continents keep their relative geographic areas. Its curved outline resembles the Robinson projection, but Robinson does not preserve area.',
  },
  {
    question: 'How is Equal Earth different from Mercator?',
    answer:
      'Equal Earth preserves area ratios. Mercator preserves local angles on a sphere and shows constant compass bearings as straight lines, which makes it useful for navigation. Mercator enlarges regions farther from the equator. Equal Earth changes shapes and angles to keep area ratios correct.',
  },
  {
    question: 'Why does Greenland look so different next to Africa?',
    answer:
      'Greenland lies far north, where Mercator stretches area strongly. Most of Africa lies closer to the equator. Africa is roughly 14 times Greenland’s geographic area, a relationship that Equal Earth preserves. The exact ratio displayed here comes from the simplified outlines used in both maps.',
  },
  {
    question: 'Is Equal Earth the UN’s new world map? Did the UN ban Mercator?',
    answer:
      'The UN General Assembly adopted the “Correct the Map” resolution on September 4, 2026. It encourages Equal Earth and other equal-area maps when comparing continental areas matters. It does not ban Mercator or require a single projection for every purpose. Equal Earth itself dates to 2018.',
  },
  {
    question: 'Is Equal Earth free of distortion?',
    answer:
      'No flat world map can preserve everything. Equal Earth preserves area, but it distorts shapes, local angles, distances, and directions. It works well for world maps about population, land, or other geographic comparisons, rather than precise navigation.',
  },
  {
    question: 'What are EPSG:8857 and +proj=eqearth?',
    answer:
      'EPSG:8857 identifies WGS 84 / Equal Earth Greenwich, a projected coordinate reference system. PROJ uses +proj=eqearth. This browser tool uses D3’s spherical geoEqualEarth implementation and approximate outline areas; it is not an ellipsoidal GIS measurement service.',
  },
]

function InteractiveMap() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const loading = (
    <div className="ee-loading" role="status">
      <Globe2 size={36} aria-hidden="true" />
      <p>Loading Equal Earth and Mercator maps…</p>
      <span>Start with Greenland and Africa, then choose any country.</span>
    </div>
  )
  return ready ? (
    <MapErrorBoundary
      fallback={
        <div className="ee-loading" role="alert">
          The interactive maps could not load. Reload this page to try again.
          You can still read the projection guide below.
        </div>
      }
    >
      <Suspense fallback={loading}>
        <EqualEarthView />
      </Suspense>
    </MapErrorBoundary>
  ) : (
    loading
  )
}

export default function EqualEarthPage() {
  const meta = seoMeta.pages.equalEarth
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${meta.canonical}#tool`,
        name: 'Equal Earth Projection: Interactive Map & Mercator Comparison',
        description: meta.description,
        url: meta.canonical,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'True size map',
            item: seoMeta.siteBaseUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Equal Earth projection',
            item: meta.canonical,
          },
        ],
      },
    ],
  }
  return (
    <>
      <Helmet prioritizeSeoTags>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={meta.canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={meta.canonical} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className="app ee-page">
        <nav className="page-tabs" aria-label="Map projection tools">
          <a
            className="page-tabs-brand"
            href="https://www.runcell.dev"
            data-analytics-location="tool_nav_brand"
          >
            <span className="page-tabs-brand-mark" aria-hidden="true">
              <Orbit size={19} />
            </span>
            <span className="page-tabs-brand-copy">
              <strong>Runcell</strong>
              <small>Science tools</small>
            </span>
          </a>
          <div className="page-tabs-list">
            <NavLink to="/" end className="page-tab">
              <Map size={16} aria-hidden="true" />
              True size
            </NavLink>
            <NavLink
              to="/equal-earth-projection"
              className="page-tab is-active"
            >
              <Globe2 size={16} aria-hidden="true" />
              Equal Earth
            </NavLink>
            <NavLink to="/custom-mercator-projection" className="page-tab">
              <Compass size={16} aria-hidden="true" />
              Equator lab
            </NavLink>
          </div>
        </nav>
        <main>
          <header className="ee-header">
            <div>
              <p className="ee-kicker">Interactive world map</p>
              <h1>Equal Earth projection</h1>
              <p>
                Compare the same countries on two maps, then see how much
                Mercator inflates their area.
              </p>
            </div>
            <a className="ee-guide-link" href="#ee-guide">
              Why this map? <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </header>
          <InteractiveMap />
          <section
            className="seo-content ee-guide"
            id="ee-guide"
            aria-labelledby="ee-guide-title"
          >
            <div className="seo-section-header">
              <p className="seo-kicker">About the projection</p>
              <h2 id="ee-guide-title">
                A world map that keeps area in proportion
              </h2>
              <p>
                The Equal Earth projection gives a region the same share of map
                area as its share of Earth’s surface. A country twice the area
                of another takes up twice as much space on the map. Move north
                on Mercator and that relationship changes, because the map
                stretches higher latitudes.
              </p>
              <p>
                Bojan Šavrič, Tom Patterson, and Bernhard Jenny introduced Equal
                Earth in 2018. Their{' '}
                <a
                  href="https://doi.org/10.1080/13658816.2018.1504949"
                  target="_blank"
                  rel="noreferrer"
                >
                  original paper
                </a>{' '}
                explains how they combined an equal-area projection with a
                curved, Robinson-like outline.
              </p>
            </div>
            <div className="seo-two-column">
              <section>
                <h3>How to compare countries</h3>
                <ol>
                  <li>
                    Choose a country and a comparison region, or try a preset.
                  </li>
                  <li>
                    Find the same colored outlines on both maps. The two maps
                    share a common area scale at the equator.
                  </li>
                  <li>
                    Read the geographic area ratio and the Mercator apparent
                    area ratio below the maps.
                  </li>
                  <li>
                    Move the white circle with the latitude slider to isolate
                    the effect of latitude.
                  </li>
                </ol>
                <p>
                  The country selectors work with a keyboard and support typing
                  to jump to a name. Share comparison copies a link with your
                  countries, map center, grid, and circle settings.
                </p>
              </section>
              <section>
                <h3>Mercator vs Equal Earth</h3>
                <p>
                  Mercator keeps local angles on a sphere, which is useful when
                  working with compass bearings. The price is area distortion.
                  At 60° latitude, a tiny patch takes up four times the area of
                  an equal-sized patch at the equator.
                </p>
                <p>
                  Equal Earth keeps areas in proportion everywhere. It gives up
                  local shape, angle, distance, and direction accuracy to do
                  that. A flat world map always involves a trade-off.
                </p>
              </section>
            </div>
            <section className="ee-news" aria-labelledby="ee-news-title">
              <p className="seo-kicker">Correct the Map · September 2026</p>
              <h3 id="ee-news-title">What did the United Nations change?</h3>
              <p>
                On September 4, 2026, the UN General Assembly adopted the{' '}
                <a
                  href="https://docs.un.org/A/RES/80/307"
                  target="_blank"
                  rel="noreferrer"
                >
                  “Correct the Map” resolution, A/RES/80/307
                </a>
                . It encourages Equal Earth and other equal-area projections for
                uses where comparing continental areas matters. It does not
                prohibit Mercator or make every map use the same projection.
              </p>
              <p>
                The{' '}
                <a
                  href="https://au.int/en/pressreleases/20260904/communique-auc-chairperson-adoption-correct-map-resolution"
                  target="_blank"
                  rel="noreferrer"
                >
                  African Union’s announcement
                </a>{' '}
                describes the initiative to represent Africa’s area more
                accurately. The resolution is new; the Equal Earth algorithm has
                been available since 2018.
              </p>
            </section>
            <section className="seo-faq" aria-labelledby="ee-faq-title">
              <h3 id="ee-faq-title">Equal Earth projection FAQ</h3>
              {faqs.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
            <section className="ee-method" aria-labelledby="ee-method-title">
              <h3 id="ee-method-title">How the numbers are calculated</h3>
              <p>
                Geographic area is the spherical area of each complete outline,
                using an Earth radius of 6,371.0088 km. The Mercator multiplier
                divides the projected polygon area by that spherical area at a
                common unit-sphere scale. It uses the whole outline, including
                islands and holes, rather than the latitude of a country’s
                center.
              </p>
              <p>
                Both maps have the same projection scale, so a square unit has
                the same area meaning at the equator. Equal Earth preserves that
                scale across the map; Mercator does not. Re-centering moves the
                map’s cut line without changing the area ratios. The maps clip
                Mercator at ±85.0511°. When a region crosses that limit, its
                full Mercator multiplier and comparison ratio are withheld.
              </p>
              <p>
                The white circle has a fixed angular radius of 4°, so its
                geographic area stays constant. Its Mercator result measures the
                whole circle. That differs slightly from the tiny-patch formula,
                1 / cos²(latitude).
              </p>
              <p>
                Outlines are{' '}
                <a
                  href="https://github.com/topojson/world-atlas/tree/v2.0.2"
                  target="_blank"
                  rel="noreferrer"
                >
                  world-atlas 2.0.2
                </a>
                , derived from Natural Earth 4.1.0 at 1:110 million scale,
                bundled on September 6, 2026. Approximate map areas can differ
                from published national totals because the coastline, lakes,
                islands, and boundaries are simplified. Africa is the combined
                African country and territory outlines available in this
                dataset.
              </p>
              <p>
                <a
                  href="https://www.naturalearthdata.com/about/terms-of-use/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Natural Earth data is public domain
                </a>
                . Boundaries follow that dataset’s de facto representation,
                including separately drawn disputed regions. They are retained
                as supplied and do not imply endorsement by Runcell or the UN.
              </p>
              <p>
                Projection references:{' '}
                <a
                  href="https://d3js.org/d3-geo/cylindrical#geoEqualEarth"
                  target="_blank"
                  rel="noreferrer"
                >
                  D3 geoEqualEarth
                </a>{' '}
                and{' '}
                <a
                  href="https://proj.org/en/stable/operations/projections/eqearth.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  PROJ Equal Earth
                </a>
                . For GIS work, use an appropriate coordinate reference system
                such as WGS 84 / Equal Earth Greenwich, EPSG:8857.
              </p>
            </section>
            <section>
              <h3>Keep exploring country sizes</h3>
              <div className="seo-link-grid">
                <NavLink to="/">Drag countries on the true size map</NavLink>
                <NavLink to="/compare/greenland-vs-africa">
                  Greenland vs Africa
                </NavLink>
                <NavLink to="/custom-mercator-projection">
                  Move the equator on a Mercator map
                </NavLink>
                <NavLink to="/country-size-on-planets">
                  Compare countries on a globe
                </NavLink>
              </div>
            </section>
          </section>
        </main>
        <footer className="ee-footer">
          <span>
            A map experiment by{' '}
            <a href="https://x.com/ob12er" target="_blank" rel="noreferrer">
              Elwynn
            </a>
          </span>
          <a
            href="https://www.runcell.dev"
            data-analytics-location="tool_footer_credit"
          >
            More tools from Runcell{' '}
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </footer>
      </div>
    </>
  )
}
