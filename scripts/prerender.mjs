import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const ROUTES = ['/', '/country-size-on-planets', '/custom-mercator-projection']
const PORT = Number(process.env.SSG_PORT ?? 4173)
const DIST_DIR = path.resolve(process.cwd(), 'dist')
const BASE_PATH = normalizeBasePath(process.env.SSG_BASE_PATH ?? '/tool/true-size-map/')

function normalizeBasePath(input) {
  if (input === '/') {
    return '/'
  }
  const trimmed = input.replace(/^\/+|\/+$/g, '')
  return `/${trimmed}/`
}

function toUrlPath(route) {
  if (route === '/') {
    return BASE_PATH
  }
  const normalized = route.replace(/^\/+/, '')
  return `${BASE_PATH}${normalized}`
}

function toOutputFile(route) {
  if (route === '/') {
    return path.join(DIST_DIR, 'index.html')
  }
  const normalized = route.replace(/^\/+/, '')
  return path.join(DIST_DIR, normalized, 'index.html')
}

async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.status < 500) {
        return
      }
    } catch {
      // Ignore while server is booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for preview server: ${url}`)
}

async function run() {
  const preview = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--strictPort', '--port', String(PORT)],
    { stdio: 'inherit' }
  )

  try {
    await waitForServer(`http://127.0.0.1:${PORT}${BASE_PATH}`)

    const browser = await puppeteer.launch({ headless: true })
    try {
      const page = await browser.newPage()
      for (const route of ROUTES) {
        const url = `http://127.0.0.1:${PORT}${toUrlPath(route)}`
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('#root .app', { timeout: 15000 })
        await page.waitForFunction(
          () =>
            document.title.length > 0 &&
            Boolean(document.querySelector('meta[name="description"]')?.getAttribute('content')),
          { timeout: 15000 }
        )
        await new Promise((resolve) => setTimeout(resolve, 300))

        const html = `<!doctype html>\n${await page.content()}`
        const outputFile = toOutputFile(route)
        await mkdir(path.dirname(outputFile), { recursive: true })
        await writeFile(outputFile, html, 'utf8')
        console.log(`Prerendered ${route} -> ${path.relative(process.cwd(), outputFile)}`)
      }
    } finally {
      await browser.close()
    }
  } finally {
    preview.kill('SIGTERM')
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
