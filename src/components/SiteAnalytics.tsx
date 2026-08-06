import { useEffect } from 'react'
import { track } from '@vercel/analytics'
import { Analytics } from '@vercel/analytics/react'

const RUNCELL_DOMAIN = 'runcell.dev'
const TOOL_HOSTNAME = 'true-size-map.runcell.dev'
const TOOL_PATH_PREFIX = '/tool/true-size-map'
const FALLBACK_PLACEMENT = 'unlabeled_link'

const isRuncellHostname = (hostname: string) =>
  hostname === RUNCELL_DOMAIN || hostname.endsWith(`.${RUNCELL_DOMAIN}`)

const isCurrentToolUrl = (url: URL) =>
  url.hostname === TOOL_HOSTNAME ||
  url.pathname === TOOL_PATH_PREFIX ||
  url.pathname.startsWith(`${TOOL_PATH_PREFIX}/`)

const getRuncellDestination = (link: HTMLAnchorElement) => {
  let url: URL

  try {
    url = new URL(link.href, window.location.href)
  } catch {
    return null
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !isRuncellHostname(url.hostname) ||
    isCurrentToolUrl(url)
  ) {
    return null
  }

  return `${url.hostname}${url.pathname}`.slice(0, 255)
}

export default function SiteAnalytics() {
  useEffect(() => {
    const trackOutboundClick = (event: MouseEvent) => {
      if (event.button > 1 || !(event.target instanceof Element)) {
        return
      }

      const link = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!link) {
        return
      }

      const destination = getRuncellDestination(link)
      if (!destination) {
        return
      }

      track('runcell_outbound_click', {
        destination,
        placement:
          link.dataset.analyticsLocation?.slice(0, 255) ?? FALLBACK_PLACEMENT,
      })
    }

    document.addEventListener('click', trackOutboundClick, true)
    document.addEventListener('auxclick', trackOutboundClick, true)

    return () => {
      document.removeEventListener('click', trackOutboundClick, true)
      document.removeEventListener('auxclick', trackOutboundClick, true)
    }
  }, [])

  return <Analytics />
}
