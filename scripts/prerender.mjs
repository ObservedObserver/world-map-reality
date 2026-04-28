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
  const normalized = route.replace(/^\/+/, '')
  return [
    path.join(DIST_DIR, normalized, 'index.html'),
    path.join(DIST_DIR, `${normalized}.html`),
  ]
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

async function run() {
  const seoMetaRaw = await readFile(SEO_META_PATH, 'utf8')
  const seoMeta = JSON.parse(seoMetaRaw)
  const templatePath = path.join(DIST_DIR, 'index.html')
  const templateHtml = await readFile(templatePath, 'utf8')
  const basePath = new URL(seoMeta.siteBaseUrl).pathname.replace(/\/$/, '')
  const { render } = await import(pathToFileURL(SERVER_ENTRY_PATH).href)

  for (const route of Object.keys(seoMeta.routes)) {
    const requestPath = toRequestPath(route, basePath)
    const { appHtml, headTags } = render(requestPath)
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
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
