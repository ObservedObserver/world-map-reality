import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
const DIST_DIR = path.resolve(process.cwd(), 'dist')
const SITE_BASE_URL = 'https://www.runcell.dev/tool/true-size-map'
const SITE_IMAGE_URL = `${SITE_BASE_URL}/true-size-of-country.jpg`

const PAGE_META = {
  '/': {
    title: 'True Size of Countries — Mercator Map Playground',
    description:
      'Drag countries on a Mercator world map to see how latitude changes their true scale in real time.',
    canonical: SITE_BASE_URL,
  },
  '/country-size-on-planets': {
    title: 'Countries on a True Globe — Size on Planets',
    description:
      'Spin the orthographic globe to compare countries at true scale and drop them on other planets.',
    canonical: `${SITE_BASE_URL}/country-size-on-planets`,
  },
  '/custom-mercator-projection': {
    title: 'Equator Lab — Custom Mercator Projection',
    description:
      'Tilt the equator and explore how a custom Mercator projection reshapes countries and distortion.',
    canonical: `${SITE_BASE_URL}/custom-mercator-projection`,
  },
}

function toOutputFile(route) {
  if (route === '/') {
    return path.join(DIST_DIR, 'index.html')
  }
  const normalized = route.replace(/^\/+/, '')
  return path.join(DIST_DIR, normalized, 'index.html')
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function stripSeoTags(html) {
  const patterns = [
    /<link[^>]*rel=["']canonical["'][^>]*>\s*/gi,
    /<meta[^>]*name=["']description["'][^>]*>\s*/gi,
    /<meta[^>]*property=["']og:[^"']+["'][^>]*>\s*/gi,
    /<meta[^>]*name=["']twitter:[^"']+["'][^>]*>\s*/gi,
  ]
  return patterns.reduce((result, pattern) => result.replace(pattern, ''), html)
}

function renderRouteHtml(templateHtml, page) {
  let html = stripSeoTags(templateHtml)
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(page.title)}</title>`
  )
  const seoTags = [
    `<link rel="canonical" href="${escapeHtml(page.canonical)}">`,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
    `<meta property="og:url" content="${escapeHtml(page.canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(SITE_IMAGE_URL)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(page.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(SITE_IMAGE_URL)}">`,
  ].join('\n    ')
  return html.replace('</head>', `    ${seoTags}\n  </head>`)
}

async function run() {
  const templatePath = path.join(DIST_DIR, 'index.html')
  const templateHtml = await readFile(templatePath, 'utf8')

  for (const [route, pageMeta] of Object.entries(PAGE_META)) {
    const outputFile = toOutputFile(route)
    const html = renderRouteHtml(templateHtml, pageMeta)
    await mkdir(path.dirname(outputFile), { recursive: true })
    await writeFile(outputFile, html, 'utf8')
    console.log(`Prerendered ${route} -> ${path.relative(process.cwd(), outputFile)}`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
