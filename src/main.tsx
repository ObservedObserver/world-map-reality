import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import SiteAnalytics from './components/SiteAnalytics.tsx'
import './index.css'

const routerBasename =
  import.meta.env.BASE_URL === '/'
    ? '/'
    : import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </HelmetProvider>
    <SiteAnalytics />
  </StrictMode>,
)
