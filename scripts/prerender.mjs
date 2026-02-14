import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
const DIST_DIR = path.resolve(process.cwd(), 'dist')
const SEO_META_PATH = path.resolve(process.cwd(), 'src/seo-meta.json')

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

function renderRouteHtml(templateHtml, page, siteImageUrl) {
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
    `<meta property="og:image" content="${escapeHtml(siteImageUrl)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(page.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(siteImageUrl)}">`,
  ].join('\n    ')
  return html.replace('</head>', `    ${seoTags}\n  </head>`)
}

async function run() {
  const seoMetaRaw = await readFile(SEO_META_PATH, 'utf8')
  const seoMeta = JSON.parse(seoMetaRaw)
  const templatePath = path.join(DIST_DIR, 'index.html')
  const templateHtml = await readFile(templatePath, 'utf8')

  for (const [route, pageId] of Object.entries(seoMeta.routes)) {
    const pageMeta = seoMeta.pages[pageId]
    const outputFile = toOutputFile(route)
    const html = renderRouteHtml(templateHtml, pageMeta, seoMeta.siteImageUrl)
    await mkdir(path.dirname(outputFile), { recursive: true })
    await writeFile(outputFile, html, 'utf8')
    console.log(`Prerendered ${route} -> ${path.relative(process.cwd(), outputFile)}`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
