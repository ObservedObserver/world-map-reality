import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const SEO_META_PATH = path.resolve(process.cwd(), 'src/seo-meta.json')
const SERVER_ENTRY_PATH = path.resolve(process.cwd(), 'dist-ssr/entry-server.js')

function toOutputFiles(route) {
  if (route === '/') {
    return [path.join(DIST_DIR, 'index.html')]
  }
  // Emit only the directory-index form (dist/<route>/index.html). The clean URL
  // `/<route>` resolves to it via Vercel's filesystem handler. We deliberately do
  // NOT also write `dist/<route>.html`: that produced a second, directly
  // addressable URL (`/<route>.html`) serving byte-identical content — a
  // duplicate indexable URL outside the sitemap that wastes crawl budget.
  const normalized = route.replace(/^\/+/, '')
  return [path.join(DIST_DIR, normalized, 'index.html')]
}

function toRequestPath(route, basePath) {
  if (route === '/') {
    return basePath
  }
  return `${basePath}${route}`
}

function stripSeoTags(html) {
  const patterns = [
    /<title>[\s\S]*?<\/title>\s*/gi,
    /<link[^>]*rel=["']canonical["'][^>]*>\s*/gi,
    /<meta[^>]*name=["']description["'][^>]*>\s*/gi,
    /<meta[^>]*property=["']og:[^"']+["'][^>]*>\s*/gi,
    /<meta[^>]*name=["']twitter:[^"']+["'][^>]*>\s*/gi,
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi,
  ]
  return patterns.reduce((result, pattern) => result.replace(pattern, ''), html)
}

function renderRouteHtml(templateHtml, appHtml, headTags) {
  const htmlWithoutSeo = stripSeoTags(templateHtml)
  const htmlWithHead = htmlWithoutSeo.replace(
    '</head>',
    `    ${headTags}\n  </head>`
  )
  return htmlWithHead.replace(
    '<div id="root"></div>',
    `<div id="root">${appHtml}</div>`
  )
}

function resolveExpectedSeo(pageId, seoMeta) {
  if (pageId.startsWith('compare:')) {
    const slug = pageId.slice('compare:'.length)
    const meta = seoMeta.comparisons[slug]
    if (!meta) {
      throw new Error(
        `seo-meta has no comparison entry for "${slug}" (route pageId "${pageId}").`
      )
    }
    return { title: meta.title, canonical: meta.canonical }
  }
  const meta = seoMeta.pages[pageId]
  if (!meta) {
    throw new Error(`seo-meta has no page entry for pageId "${pageId}".`)
  }
  return { title: meta.title, canonical: meta.canonical }
}

function decodeBasicEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

// Fail the build if a route did not render its own SEO identity. This catches the
// "route silently falls back to the homepage/404 clone" failure mode (e.g. a route
// missing from the SSR router) before it ships as a duplicate indexable page.
function assertRouteSeo(route, headTags, expected) {
  const canonicalMatch = headTags.match(
    /<link[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i
  )
  const canonical = canonicalMatch ? decodeBasicEntities(canonicalMatch[1]) : undefined
  if (canonical !== expected.canonical) {
    throw new Error(
      `Prerender SEO check failed for route "${route}":\n` +
        `  expected canonical: ${expected.canonical}\n` +
        `  got canonical:      ${canonical ?? '(none)'}\n` +
        `The route did not render its own canonical — it is likely falling back to the ` +
        `homepage/404 clone. Check that the SSR router in entry-server matches this route.`
    )
  }
  const titleMatch = headTags.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeBasicEntities(titleMatch[1]).trim() : undefined
  if (title !== expected.title) {
    throw new Error(
      `Prerender SEO check failed for route "${route}":\n` +
        `  expected title: ${JSON.stringify(expected.title)}\n` +
        `  got title:      ${JSON.stringify(title ?? null)}`
    )
  }
}

// Emit a real 404 page (noindex) so unknown URLs return a 404 instead of cloning
// the homepage. Pairs with vercel.json routing unknown paths to /404.html with a
// 404 status. The page is static (scripts stripped) so it never hydrates into the
// SPA at the unknown URL.
async function write404(templateHtml, seoMeta) {
  const head = [
    '<title>Page not found — True Size Map</title>',
    '<meta name="robots" content="noindex">',
  ].join('\n    ')
  // Derive the tool links from seo-meta so the 404 page never drifts from the
  // real routes when a tool is added, renamed, or removed.
  const links = Object.values(seoMeta.pages)
    .map((page) => `<li><a href="${page.canonical}">${page.title}</a></li>`)
    .join('')
  const body =
    '<main style="max-width: 640px; margin: 0 auto; padding: 64px 24px;">' +
    '<h1>Page not found</h1>' +
    '<p>The page you are looking for does not exist. Try one of these tools:</p>' +
    `<ul>${links}</ul>` +
    '</main>'
  // Reuse renderRouteHtml so the strip + head/root injection stays identical to the
  // route pages, then strip scripts so the 404 stays static (it never hydrates the
  // SPA at the unknown URL).
  const html = renderRouteHtml(templateHtml, body, head).replace(
    /<script[^>]*>[\s\S]*?<\/script>\s*/gi,
    ''
  )
  if (!html.includes('<h1>Page not found</h1>')) {
    throw new Error(
      'write404: 404 body was not injected (root marker missing from template). ' +
        'Run a fresh `vite build` before prerender.'
    )
  }
  const outputFile = path.join(DIST_DIR, '404.html')
  await writeFile(outputFile, html, 'utf8')
  console.log(`Prerendered 404 -> ${path.relative(process.cwd(), outputFile)}`)
}

async function run() {
  const seoMetaRaw = await readFile(SEO_META_PATH, 'utf8')
  const seoMeta = JSON.parse(seoMetaRaw)
  const templatePath = path.join(DIST_DIR, 'index.html')
  const templateHtml = await readFile(templatePath, 'utf8')
  const basePath = new URL(seoMeta.siteBaseUrl).pathname.replace(/\/$/, '')
  const { render } = await import(pathToFileURL(SERVER_ENTRY_PATH).href)

  for (const [route, pageId] of Object.entries(seoMeta.routes)) {
    const requestPath = toRequestPath(route, basePath)
    const { appHtml, headTags } = render(requestPath)
    assertRouteSeo(route, headTags, resolveExpectedSeo(pageId, seoMeta))
    const outputFiles = toOutputFiles(route)
    const html = renderRouteHtml(templateHtml, appHtml, headTags)
    for (const outputFile of outputFiles) {
      await mkdir(path.dirname(outputFile), { recursive: true })
      await writeFile(outputFile, html, 'utf8')
    }
    console.log(
      `Prerendered ${route} -> ${outputFiles
        .map((outputFile) => path.relative(process.cwd(), outputFile))
        .join(', ')}`
    )
  }

  await write404(templateHtml, seoMeta)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
