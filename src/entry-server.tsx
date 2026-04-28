import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { HelmetProvider } from 'react-helmet-async'
import type { HelmetServerState } from 'react-helmet-async'
import App from './App'
import './index.css'

type HelmetContext = {
  helmet?: HelmetServerState
}

const routerBasename =
  import.meta.env.BASE_URL === '/'
    ? '/'
    : import.meta.env.BASE_URL.replace(/\/$/, '')

export function render(url: string) {
  const helmetContext: HelmetContext = {}
  const appHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url} basename={routerBasename}>
        <App />
      </StaticRouter>
    </HelmetProvider>
  )

  const helmet = helmetContext.helmet
  const headTags = helmet
    ? [
        helmet.title.toString(),
        helmet.priority.toString(),
        helmet.meta.toString(),
        helmet.link.toString(),
        helmet.script.toString(),
      ]
        .filter(Boolean)
        .join('\n    ')
    : ''

  return {
    appHtml,
    headTags,
  }
}
