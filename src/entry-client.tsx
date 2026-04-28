import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'

const routerBasename =
  import.meta.env.BASE_URL === '/'
    ? '/'
    : import.meta.env.BASE_URL.replace(/\/$/, '')

const app = (
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </HelmetProvider>
    <Analytics />
  </StrictMode>
)

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found.')
}

if (root.hasChildNodes()) {
  hydrateRoot(root, app)
} else {
  createRoot(root).render(app)
}
