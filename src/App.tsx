import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { LineString } from 'geojson'
import * as d3 from 'd3'
import {
  Check,
  Copy,
  Facebook,
  Flame,
  Github,
  Globe,
  Linkedin,
  Mail,
  Map as MapIcon,
  MessageCircle,
  Orbit,
  Compass,
  Radiation,
  Share2,
  Sun,
  Twitter,
  Waves,
  Youtube,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import type {
  CountryDatum,
  CountryFeature,
  GlobeHighlightCountry,
  LonLat,
  MapRenderedCountry,
  PlanetPlacement,
  Vec3,
} from './types'
import { EARTH_DIAMETER_KM, PLANETS, PLANET_TEXTURES } from './solar'
import type { Planet } from './solar'
import {
  GLOBE_DEFAULT_ROTATION,
  GLOBE_DRAG_SENSITIVITY,
  GLOBE_PADDING,
  GLOBE_SIZE,
  MAP_HEIGHT,
  MAP_PADDING,
  MAP_WIDTH,
  MAX_GLOBE_TILT,
  PLANET_BASE_RADIUS,
  PLANET_DEFAULT_ROTATION,
  PLANET_PREVIEW_SIZE,
  PLANET_ZOOM_MAX,
  PLANET_ZOOM_MIN,
  PLANET_ZOOM_STEP,
  SOLAR_BASE_URL,
} from './constants'
import { useCountryData } from './hooks/useCountryData'
import { useFullscreenState } from './hooks/useFullscreenState'
import { useModifierKey } from './hooks/useModifierKey'
import { usePlanetTexture } from './hooks/usePlanetTexture'
import {
  formatLatitude,
  formatLongitude,
  formatPlanetRatio,
  formatScale,
  getMercatorScale,
} from './utils/formatters'
import {
  clamp,
  createSphericalRotation,
  rotateGeometry,
  scaleGeometry,
} from './utils/geo'
import GlobeView from './components/GlobeView'
import MapView from './components/MapView'
import EquatorShiftView from './components/EquatorShiftView'
import SeoContent from './components/SeoContent'
import SeaLevelSeoContent from './components/SeaLevelSeoContent'
import GlobeSeoContent from './components/GlobeSeoContent'
import EquatorSeoContent from './components/EquatorSeoContent'
import MapErrorBoundary from './components/MapErrorBoundary'
import AsteroidSeoContent from './components/AsteroidSeoContent'
import NuclearBlastSeoContent from './components/NuclearBlastSeoContent'
import SunAnalemmaSeoContent from './components/SunAnalemmaSeoContent'
import {
  ASTEROID_FAQS,
  MAIN_FAQS,
  NUCLEAR_FAQS,
  SUN_ANALEMMA_FAQS,
} from './seo'
import seoMeta from './seo-meta.json'
import './App.css'

const TRUE_SIZE_GLOBE_PATH = '/country-size-on-planets'
const CUSTOM_MERCATOR_PATH = '/custom-mercator-projection'
const SEA_LEVEL_PATH = '/sea-level-rise-simulator'
const ASTEROID_PATH = '/asteroid-impact-simulator'
const NUCLEAR_PATH = '/nuclear-blast-radius-map'
const SUN_ANALEMMA_PATH = '/sun-analemma-calculator'
const COMPARE_PATH_PREFIX = '/compare/'
const SEA_LEVEL_SHORTS_EMBED_URL =
  'https://www.youtube.com/embed/tMaH9cFs8XM'
const SeaLevelRiseView = lazy(() => import('./components/SeaLevelRiseView'))
const AsteroidImpactView = lazy(() => import('./components/AsteroidImpactView'))
const NuclearBlastView = lazy(() => import('./components/NuclearBlastView'))
const SunAnalemmaView = lazy(() => import('./components/SunAnalemmaView'))

const SeaLevelLoading = () => (
  <main className="sea-level-layout">
    <section className="sea-level-panel">
      <div className="panel-empty">Loading sea level simulator...</div>
    </section>
  </main>
)

const SeaLevelUnavailable = () => (
  <main className="sea-level-layout">
    <section className="sea-level-panel">
      <div className="panel-empty">
        The interactive sea level map could not load in this browser (it requires
        WebGL). The guide below explains how the sea level rise simulator works.
      </div>
    </section>
  </main>
)

const ToolViewUnavailable = ({ name }: { name: string }) => (
  <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px' }}>
    <p className="panel-empty">
      The interactive {name} could not load in this browser (it may require
      WebGL). The guide below explains how it works.
    </p>
  </main>
)

const SeaLevelRoute = () => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <SeaLevelLoading />
  }

  return (
    <Suspense fallback={<SeaLevelLoading />}>
      <SeaLevelRiseView />
    </Suspense>
  )
}

const AsteroidLoading = () => (
  <main className="asteroid-layout">
    <div className="panel-empty">Loading asteroid impact simulator...</div>
  </main>
)

const AsteroidRoute = () => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <AsteroidLoading />
  }

  return (
    <Suspense fallback={<AsteroidLoading />}>
      <AsteroidImpactView />
    </Suspense>
  )
}

const NuclearLoading = () => (
  <main className="asteroid-layout">
    <div className="panel-empty">Loading nuclear blast radius map...</div>
  </main>
)

const NuclearRoute = () => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <NuclearLoading />
  }

  return (
    <Suspense fallback={<NuclearLoading />}>
      <NuclearBlastView />
    </Suspense>
  )
}

const AnalemmaLoading = () => (
  <main className="analemma-layout">
    <div className="panel-empty">Loading Sun analemma explorer...</div>
  </main>
)

const AnalemmaRoute = ({
  worldFeatures,
  loading,
  error,
}: {
  worldFeatures: CountryFeature[]
  loading: boolean
  error: string | null
}) => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) return <AnalemmaLoading />

  return (
    <Suspense fallback={<AnalemmaLoading />}>
      <SunAnalemmaView
        worldFeatures={worldFeatures}
        loading={loading}
        error={error}
      />
    </Suspense>
  )
}

type ViewSelectionState = {
  selectedId: string | null
  draggableIds: string[]
  countryFilter: string
}

type DragState = {
  id: string
  pointerId: number
  start: { x: number; y: number }
  origin: { x: number; y: number }
  centroid: [number, number]
}

type GlobeDragState = {
  pointerId: number
  start: { x: number; y: number }
  rotation: Vec3
}

type GlobeCountryDragState = {
  id: string
  pointerId: number
  startLonLat: LonLat
  startCentroid: LonLat
}

type PlanetDragState = {
  pointerId: number
  start: { x: number; y: number }
  rotation: Vec3
}

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggableIds, setDraggableIds] = useState<string[]>([])
  const [countryFilter, setCountryFilter] = useState('')
  const [globeDragMode, setGlobeDragMode] = useState<'rotate' | 'country'>(
    'rotate'
  )
  const [solarSystemEnabled, setSolarSystemEnabled] = useState(true)
  const [activePlanetId, setActivePlanetId] = useState<Planet['id']>('mars')
  const [planetPlacements, setPlanetPlacements] = useState<PlanetPlacement[]>(
    []
  )
  const [planetRotation, setPlanetRotation] = useState<Vec3>(
    PLANET_DEFAULT_ROTATION
  )
  const [planetZoom, setPlanetZoom] = useState(1)
  const [globeRotation, setGlobeRotation] = useState<Vec3>(
    GLOBE_DEFAULT_ROTATION
  )
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  )
  const [globeDragging, setGlobeDragging] = useState(false)
  const [planetDragging, setPlanetDragging] = useState(false)

  const dragState = useRef<DragState | null>(null)
  const globeDragState = useRef<GlobeDragState | null>(null)
  const globeCountryDragState = useRef<GlobeCountryDragState | null>(null)
  const planetCountryDragState = useRef<{
    id: string
    pointerId: number
  } | null>(null)
  const planetDragState = useRef<PlanetDragState | null>(null)
  const planetRotationFrame = useRef<number | null>(null)
  const planetRotationPending = useRef<Vec3 | null>(null)
  const globeFrameRef = useRef<HTMLDivElement | null>(null)
  const globeSvgRef = useRef<SVGSVGElement | null>(null)
  const planetSvgRef = useRef<SVGSVGElement | null>(null)
  const planetInsetRef = useRef<HTMLDivElement | null>(null)
  const areaFormatter = useMemo(
    () => new Intl.NumberFormat('en-US'),
    []
  )


  const projection = useMemo(
    () =>
      d3
        .geoMercator()
        .scale(175)
        .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2 + 10]),
    []
  )

  const {
    countries,
    setCountries,
    worldFeatures,
    loading,
    error,
    initialSelection,
  } = useCountryData(projection)

  const antarcticaId = useMemo(() => {
    const directMatch = countries.find((country) => country.id === '10')
    if (directMatch) {
      return directMatch.id
    }
    const nameMatch = countries.find((country) =>
      country.name.toLowerCase().includes('antarctica')
    )
    return nameMatch?.id ?? null
  }, [countries])

  const pathGenerator = useMemo(
    () => d3.geoPath(projection),
    [projection]
  )

  const globeProjection = useMemo(
    () =>
      d3
        .geoOrthographic()
        .scale(GLOBE_SIZE / 2 - GLOBE_PADDING)
        .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
        .clipAngle(90)
        .precision(0.3)
        .rotate(globeRotation),
    [globeRotation]
  )

  const globePathGenerator = useMemo(
    () => d3.geoPath(globeProjection),
    [globeProjection]
  )

  const planetProjection = useMemo(
    () =>
      d3
        .geoOrthographic()
        .scale(PLANET_BASE_RADIUS * planetZoom)
        .translate([PLANET_PREVIEW_SIZE / 2, PLANET_PREVIEW_SIZE / 2])
        .clipAngle(90)
        .precision(0.3)
        .rotate(planetRotation),
    [planetRotation, planetZoom]
  )

  const planetPathGenerator = useMemo(
    () => d3.geoPath(planetProjection),
    [planetProjection]
  )

  const globeGraticule = useMemo(() => d3.geoGraticule10(), [])
  const globeSphere = useMemo(
    () => ({ type: 'Sphere' } as unknown as d3.GeoPermissibleObjects),
    []
  )
  const planetGraticule = useMemo(() => d3.geoGraticule10(), [])
  const latLines = useMemo(() => d3.range(-80, 81, 20), [])

  const mapLatLines = useMemo(
    () =>
      latLines.map((lat) => {
        const line: LineString = {
          type: 'LineString',
          coordinates: [
            [-180, lat],
            [180, lat],
          ],
        }
        const path = pathGenerator(line)
        const labelPoint = projection([-168, lat])
        const label =
          lat === 0
            ? 'Equator'
            : `${Math.abs(lat)}deg${lat > 0 ? 'N' : 'S'}`
        return {
          lat,
          path,
          label,
          labelX: labelPoint ? labelPoint[0] : null,
          labelY: labelPoint ? labelPoint[1] - 6 : null,
          isEquator: lat === 0,
        }
      }),
    [latLines, pathGenerator, projection]
  )

  const clearGlobeModifier = useCallback(() => {
    globeCountryDragState.current = null
    planetCountryDragState.current = null
    planetDragState.current = null
    if (planetRotationFrame.current !== null) {
      cancelAnimationFrame(planetRotationFrame.current)
      planetRotationFrame.current = null
    }
    planetRotationPending.current = null
    setPlanetDragging(false)
    if (!globeDragState.current) {
      setGlobeDragging(false)
    }
  }, [setPlanetDragging, setGlobeDragging])

  const location = useLocation()
  const activeNavItemRef = useRef<HTMLAnchorElement | null>(null)
  const isEquatorLab = location.pathname.startsWith(CUSTOM_MERCATOR_PATH)
  const isGlobePage = location.pathname.startsWith(TRUE_SIZE_GLOBE_PATH)
  const isSeaLevelPage = location.pathname.startsWith(SEA_LEVEL_PATH)
  const isAsteroidPage = location.pathname.startsWith(ASTEROID_PATH)
  const isNuclearPage = location.pathname.startsWith(NUCLEAR_PATH)
  const isAnalemmaPage = location.pathname.startsWith(SUN_ANALEMMA_PATH)
  const comparisonSlug = location.pathname.startsWith(COMPARE_PATH_PREFIX)
    ? location.pathname.slice(COMPARE_PATH_PREFIX.length).split('/')[0]
    : null
  const comparisonMeta = useMemo(() => {
    if (!comparisonSlug) {
      return null
    }
    if (
      Object.prototype.hasOwnProperty.call(seoMeta.comparisons, comparisonSlug)
    ) {
      return seoMeta.comparisons[
        comparisonSlug as keyof typeof seoMeta.comparisons
      ]
    }
    return null
  }, [comparisonSlug])
  const isTrueSizePage =
    !isEquatorLab &&
    !isSeaLevelPage &&
    !isAsteroidPage &&
    !isNuclearPage &&
    !isAnalemmaPage
  const activeView =
    isTrueSizePage && isGlobePage ? 'globe' : 'map'
  const isMapView = activeView === 'map'
  const shouldRenderSeoContent = isTrueSizePage && isMapView

  useEffect(() => {
    const activeItem = activeNavItemRef.current
    if (!activeItem || !window.matchMedia('(max-width: 760px)').matches) {
      return
    }
    const frameId = window.requestAnimationFrame(() => {
      const track = activeItem.parentElement
      if (!track) return
      const centeredLeft =
        activeItem.offsetLeft - track.clientWidth / 2 + activeItem.clientWidth / 2
      track.scrollTo({ left: Math.max(0, centeredLeft), behavior: 'auto' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [location.pathname])

  const savedTrueSizeStateRef = useRef<ViewSelectionState | null>(null)
  const savedEquatorStateRef = useRef<ViewSelectionState | null>(null)
  const lastIsEquatorLabRef = useRef(isEquatorLab)
  const appliedComparisonSlugRef = useRef<string | null>(null)
  const pageMeta = useMemo(() => {
    if (comparisonMeta) {
      return comparisonMeta
    }
    if (isNuclearPage) {
      return seoMeta.pages.nuclear
    }
    if (isAnalemmaPage) {
      return seoMeta.pages.analemma
    }
    if (isAsteroidPage) {
      return seoMeta.pages.asteroid
    }
    if (isSeaLevelPage) {
      return seoMeta.pages.seaLevel
    }
    if (isEquatorLab) {
      return seoMeta.pages.equator
    }
    if (isGlobePage) {
      return seoMeta.pages.globe
    }
    return seoMeta.pages.map
  }, [comparisonMeta, isAnalemmaPage, isAsteroidPage, isNuclearPage, isEquatorLab, isGlobePage, isSeaLevelPage])
  const shareUrl = pageMeta.canonical
  const structuredData = useMemo(() => {
    const breadcrumbs = [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Runcell Tools',
        item: 'https://www.runcell.dev/tool',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: comparisonMeta ? 'True Size of Countries Map' : pageMeta.title,
        item: comparisonMeta ? seoMeta.siteBaseUrl : pageMeta.canonical,
      },
    ]

    if (comparisonMeta) {
      breadcrumbs.push({
        '@type': 'ListItem',
        position: 3,
        name: `${comparisonMeta.primaryName} vs ${comparisonMeta.secondaryName}`,
        item: comparisonMeta.canonical,
      })
    }

    const graph: Array<Record<string, unknown>> = [
      {
        '@type': 'WebApplication',
        '@id': `${pageMeta.canonical}#web-application`,
        name: pageMeta.title,
        url: pageMeta.canonical,
        image: seoMeta.siteImageUrl,
        applicationCategory: 'EducationalApplication',
        operatingSystem:
          isAsteroidPage || isNuclearPage || isAnalemmaPage ? 'All' : 'Any',
        description: pageMeta.description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageMeta.canonical}#breadcrumb`,
        itemListElement: breadcrumbs,
      },
    ]

    if (
      shouldRenderSeoContent ||
      isAsteroidPage ||
      isNuclearPage ||
      isAnalemmaPage
    ) {
      const faqItems = isNuclearPage
        ? NUCLEAR_FAQS
        : isAnalemmaPage
        ? SUN_ANALEMMA_FAQS
        : isAsteroidPage
        ? ASTEROID_FAQS
        : comparisonMeta?.faq ?? MAIN_FAQS
      graph.push({
        '@type': 'FAQPage',
        '@id': `${pageMeta.canonical}#faq`,
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      })
    }

    return {
      '@context': 'https://schema.org',
      '@graph': graph,
    }
  }, [
    comparisonMeta,
    isAnalemmaPage,
    isAsteroidPage,
    isNuclearPage,
    pageMeta.canonical,
    pageMeta.description,
    pageMeta.title,
    shouldRenderSeoContent,
  ])
  const shareLinks = useMemo(() => {
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedTitle = encodeURIComponent(pageMeta.title)
    const hashtags = isAnalemmaPage
      ? 'Analemma,Astronomy,SunPosition'
      : 'TrueSizeMap,Cartography,Geography'
    const encodedEmailBody = encodeURIComponent(
      `${pageMeta.description}\n\n${shareUrl}`
    )
    return {
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtags}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${pageMeta.title} ${shareUrl}`)}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedEmailBody}`,
    }
  }, [isAnalemmaPage, pageMeta.description, pageMeta.title, shareUrl])

  const handleCopyShareLink = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        textArea.setAttribute('readonly', 'true')
        textArea.style.position = 'absolute'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        const copySucceeded = document.execCommand('copy')
        document.body.removeChild(textArea)
        if (!copySucceeded) {
          throw new Error('Clipboard copy command failed')
        }
      }
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }, [shareUrl])

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: pageMeta.title,
          text: pageMeta.description,
          url: shareUrl,
        })
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
      }
    }

    window.open(shareLinks.x, '_blank', 'noopener,noreferrer')
  }, [pageMeta.description, pageMeta.title, shareLinks.x, shareUrl])

  const headerEyebrow = comparisonMeta
    ? comparisonMeta.eyebrow
    : isAnalemmaPage
    ? 'Interactive Solar Astronomy'
    : isNuclearPage
    ? 'Nuclear Weapon Effects'
    : isAsteroidPage
    ? 'Impact Effects Calculator'
    : isSeaLevelPage
    ? 'Sea Level Rise Simulator'
    : isTrueSizePage
      ? isMapView
        ? 'True Size Map'
        : 'True Size Globe'
      : 'Experimental Projection Lab'
  const headerTitle = comparisonMeta
    ? comparisonMeta.h1
    : isAnalemmaPage
    ? 'Sun Analemma Calculator'
    : isNuclearPage
    ? 'Nuclear Blast Radius Map'
    : isAsteroidPage
    ? 'Asteroid Impact Simulator'
    : isSeaLevelPage
    ? 'Simulate Coastlines After Sea Level Rise'
    : isTrueSizePage
      ? isMapView
        ? 'The True Size of Countries (Mercator Map)'
        : 'Countries on a True Globe'
      : 'Redefine the Equator'
  const headerDescription = comparisonMeta
    ? comparisonMeta.intro
    : isAnalemmaPage
    ? 'Choose any place on Earth and trace the Sun’s figure-eight path at the same UTC time across all 365 days of the year.'
    : isNuclearPage
    ? 'Pick a target, choose a weapon yield, and map the fireball, blast, thermal, and radiation rings using the Glasstone & Dolan nuclear-effects scaling laws.'
    : isAsteroidPage
    ? 'Pick an impact site, choose an asteroid, and map the crater, fireball, thermal burns, and blast zones with the Collins, Melosh & Marcus impact-effects model.'
    : isSeaLevelPage
    ? 'Blend satellite imagery with terrain elevation and preview regions that fall below a custom sea-level threshold.'
    : isTrueSizePage
      ? isMapView
        ? 'Drag countries on a Mercator world map to see how latitude changes their true scale in real time.'
        : 'Spin the orthographic globe to compare countries at their real scale.'
      : 'Tilt the equator on the globe and see Mercator stretch the world in new directions.'

  useEffect(() => {
    if (lastIsEquatorLabRef.current === isEquatorLab) {
      return
    }

    lastIsEquatorLabRef.current = isEquatorLab

    if (isEquatorLab) {
      savedTrueSizeStateRef.current = {
        selectedId,
        draggableIds,
        countryFilter,
      }

      const savedEquatorState = savedEquatorStateRef.current
      setSelectedId(savedEquatorState?.selectedId ?? null)
      setDraggableIds(savedEquatorState?.draggableIds ?? [])
      setCountryFilter(savedEquatorState?.countryFilter ?? '')
      return
    }

    savedEquatorStateRef.current = {
      selectedId,
      draggableIds,
      countryFilter,
    }

    const savedTrueSizeState = savedTrueSizeStateRef.current
    if (savedTrueSizeState) {
      setSelectedId(savedTrueSizeState.selectedId)
      setDraggableIds(savedTrueSizeState.draggableIds)
      setCountryFilter(savedTrueSizeState.countryFilter)
    }
  }, [isEquatorLab, selectedId, draggableIds, countryFilter])

  useEffect(() => {
    if (copyStatus === 'idle') {
      return
    }
    const timeoutId = window.setTimeout(() => setCopyStatus('idle'), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [copyStatus])

  const comparisonCountryIds = useMemo(
    () => comparisonMeta?.countryIds ?? [],
    [comparisonMeta]
  )

  useEffect(() => {
    if (loading) {
      return
    }

    if (isEquatorLab) {
      if (draggableIds.length === 0) {
        const baseDefaults = initialSelection.draggableIds
        const withAntarctica =
          antarcticaId && !baseDefaults.includes(antarcticaId)
            ? [antarcticaId, ...baseDefaults]
            : baseDefaults
        if (withAntarctica.length > 0) {
          setDraggableIds(withAntarctica)
        }
      }
      if (antarcticaId && !selectedId) {
        setSelectedId(antarcticaId)
      }
      return
    }

    if (comparisonCountryIds.length > 0) {
      const availableIds = new Set(countries.map((country) => country.id))
      const availableComparisonIds = comparisonCountryIds.filter((id) =>
        availableIds.has(id)
      )
      if (
        comparisonSlug &&
        appliedComparisonSlugRef.current !== comparisonSlug &&
        availableComparisonIds.length > 0
      ) {
        setDraggableIds(availableComparisonIds)
        setSelectedId(availableComparisonIds[0])
        setCountryFilter('')
        appliedComparisonSlugRef.current = comparisonSlug
      }
      return
    }

    appliedComparisonSlugRef.current = null

    if (!selectedId && initialSelection.selectedId) {
      setSelectedId(initialSelection.selectedId)
    }
    if (draggableIds.length === 0 && initialSelection.draggableIds.length > 0) {
      setDraggableIds(initialSelection.draggableIds)
    }
  }, [
    loading,
    isEquatorLab,
    antarcticaId,
    comparisonCountryIds,
    comparisonSlug,
    countries,
    initialSelection,
    selectedId,
    draggableIds,
  ])

  const globeModifierPressed = useModifierKey(
    isTrueSizePage && activeView === 'globe',
    clearGlobeModifier
  )

  const fullscreenView = isTrueSizePage ? activeView : 'map'
  const {
    isFullscreen: isGlobeFullscreen,
    toggleFullscreen: toggleGlobeFullscreen,
  } = useFullscreenState(fullscreenView, globeFrameRef)

  const activePlanet = useMemo(
    () => PLANETS.find((planet) => planet.id === activePlanetId) ?? PLANETS[0],
    [activePlanetId]
  )
  const planetScaleFactor = useMemo(
    () => EARTH_DIAMETER_KM / activePlanet.diameterKm,
    [activePlanet]
  )
  const planetRatio = useMemo(
    () => activePlanet.diameterKm / EARTH_DIAMETER_KM,
    [activePlanet]
  )
  const planetTexture = useMemo(
    () => PLANET_TEXTURES[activePlanet.id] ?? null,
    [activePlanet.id]
  )
  const planetTextureUrl = useMemo(
    () => (planetTexture ? `${SOLAR_BASE_URL}${planetTexture}` : null),
    [planetTexture]
  )
  const planetRadius = PLANET_BASE_RADIUS * planetZoom
  const upsertPlanetPlacement = useCallback(
    (id: string, centroid: LonLat) => {
      setPlanetPlacements((prev) => {
        const index = prev.findIndex((entry) => entry.id === id)
        if (index === -1) {
          return [...prev, { id, centroid }]
        }
        const next = [...prev]
        next[index] = { ...next[index], centroid }
        return next
      })
    },
    []
  )
  const canPlanetZoomIn = planetZoom < PLANET_ZOOM_MAX - 0.001
  const canPlanetZoomOut = planetZoom > PLANET_ZOOM_MIN + 0.001

  const { planetCanvasRef } = usePlanetTexture({
    textureUrl: planetTextureUrl,
    projection: planetProjection,
    radius: planetRadius,
    previewSize: PLANET_PREVIEW_SIZE,
    solarSystemEnabled,
    loading,
    activeView,
    isDragging: planetDragging,
  })

  const draggableCountries = useMemo(
    () => countries.filter((country) => draggableIds.includes(country.id)),
    [countries, draggableIds]
  )

  const filteredCountries = useMemo(() => {
    const query = countryFilter.trim().toLowerCase()
    const base = query
      ? countries.filter((country) =>
          country.name.toLowerCase().includes(query)
        )
      : countries
    const selectedSet = new Set(draggableIds)
    return [...base].sort((a, b) => {
      const aSelected = selectedSet.has(a.id) ? 0 : 1
      const bSelected = selectedSet.has(b.id) ? 0 : 1
      if (aSelected !== bSelected) {
        return aSelected - bSelected
      }
      return a.name.localeCompare(b.name)
    })
  }, [countries, countryFilter, draggableIds])

  const orderedCountries = useMemo(() => {
    const items = [...draggableCountries]
    const score = (id: string) =>
      id === draggingId ? 2 : id === selectedId ? 1 : 0
    items.sort((a, b) => score(a.id) - score(b.id))
    return items
  }, [draggableCountries, draggingId, selectedId])

  const getCurrentCoordinates = useCallback(
    (country: CountryDatum): LonLat => {
      const [cx, cy] = country.centroidScreen
      const currentPoint: [number, number] = [
        cx + country.offset.x,
        cy + country.offset.y,
      ]
      const inverted = projection.invert?.(currentPoint)
      if (!inverted) {
        return country.originalCentroid
      }
      return [inverted[0], inverted[1]]
    },
    [projection]
  )

  const mapRenderedCountries = useMemo<MapRenderedCountry[]>(
    () =>
      orderedCountries.map((country) => {
        const currentCoordinates = getCurrentCoordinates(country)
        const rotation = createSphericalRotation(
          country.originalCentroid,
          currentCoordinates
        )
        const rotatedGeometry = country.feature.geometry
          ? rotateGeometry(country.feature.geometry, rotation)
          : country.feature.geometry
        const rotatedFeature: CountryFeature = {
          ...country.feature,
          geometry: rotatedGeometry,
        }
        return {
          country,
          feature: rotatedFeature,
          isDraggable: draggableIds.includes(country.id),
          isSelected: selectedId === country.id,
          isDragging: draggingId === country.id,
        }
      }),
    [orderedCountries, draggableIds, selectedId, draggingId, getCurrentCoordinates]
  )

  const selectedCountry =
    countries.find((country) => country.id === selectedId) ?? null

  const focusOnCountry = useCallback(
    (country: CountryDatum) => {
      setSelectedId(country.id)
      const [lon, lat] = country.globeCentroid
      setGlobeRotation([-lon, -lat, 0])
    },
    [setSelectedId, setGlobeRotation]
  )

  const resetGlobeRotation = useCallback(() => {
    setGlobeRotation(GLOBE_DEFAULT_ROTATION)
    setPlanetRotation(PLANET_DEFAULT_ROTATION)
    setPlanetZoom(1)
    setPlanetPlacements([])
    globeDragState.current = null
    globeCountryDragState.current = null
    planetCountryDragState.current = null
    planetDragState.current = null
    if (planetRotationFrame.current !== null) {
      cancelAnimationFrame(planetRotationFrame.current)
      planetRotationFrame.current = null
    }
    planetRotationPending.current = null
    setGlobeDragging(false)
    setPlanetDragging(false)
    setCountries((prev) =>
      prev.map((country) => ({
        ...country,
        globeCentroid: country.originalCentroid,
      }))
    )
  }, [setCountries])

  const handlePlanetZoomIn = useCallback(() => {
    setPlanetZoom((prev) => Math.min(PLANET_ZOOM_MAX, prev + PLANET_ZOOM_STEP))
  }, [])

  const handlePlanetZoomOut = useCallback(() => {
    setPlanetZoom((prev) => Math.max(PLANET_ZOOM_MIN, prev - PLANET_ZOOM_STEP))
  }, [])

  const toggleDraggable = (id: string) => {
    setDraggableIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((entry) => entry !== id)
        : [...prev, id]
      if (!next.includes(id) && dragState.current?.id === id) {
        dragState.current = null
        setDraggingId(null)
      }
      return next
    })
  }

  const resetPositions = () => {
    dragState.current = null
    setDraggingId(null)
    setCountries((prev) =>
      prev.map((country) => ({ ...country, offset: { x: 0, y: 0 } }))
    )
  }

  const handleDragMove = useCallback(
    (event: PointerEvent) => {
      if (!dragState.current || dragState.current.pointerId !== event.pointerId) {
        return
      }
      const dx = event.clientX - dragState.current.start.x
      const dy = event.clientY - dragState.current.start.y
      const nextOffset = {
        x: dragState.current.origin.x + dx,
        y: dragState.current.origin.y + dy,
      }

      const centroidX = dragState.current.centroid[0]
      const centroidY = dragState.current.centroid[1]
      const clampedCentroidX = Math.min(
        Math.max(centroidX + nextOffset.x, MAP_PADDING),
        MAP_WIDTH - MAP_PADDING
      )
      const clampedCentroidY = Math.min(
        Math.max(centroidY + nextOffset.y, MAP_PADDING),
        MAP_HEIGHT - MAP_PADDING
      )
      const clampedOffset = {
        x: clampedCentroidX - centroidX,
        y: clampedCentroidY - centroidY,
      }

      setCountries((prev) =>
        prev.map((country) =>
          country.id === dragState.current?.id
            ? { ...country, offset: clampedOffset }
            : country
        )
      )
    },
    [setCountries]
  )

  const handleDragEnd = useCallback((event: PointerEvent) => {
    if (!dragState.current || dragState.current.pointerId !== event.pointerId) {
      return
    }
    dragState.current = null
    setDraggingId(null)
  }, [])

  const handlePointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    country: CountryDatum
  ) => {
    event.preventDefault()
    if (!draggableIds.includes(country.id)) {
      setSelectedId(country.id)
      return
    }
    dragState.current = {
      id: country.id,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: country.offset.x, y: country.offset.y },
      centroid: country.centroidScreen,
    }
    setSelectedId(country.id)
    setDraggingId(country.id)
  }

  useEffect(() => {
    if (!draggingId) {
      return
    }
    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', handleDragEnd)
    window.addEventListener('pointercancel', handleDragEnd)
    return () => {
      window.removeEventListener('pointermove', handleDragMove)
      window.removeEventListener('pointerup', handleDragEnd)
      window.removeEventListener('pointercancel', handleDragEnd)
    }
  }, [draggingId, handleDragMove, handleDragEnd])

  const getGlobeLonLatFromClient = useCallback(
    (clientX: number, clientY: number): LonLat | null => {
      const svg = globeSvgRef.current
      if (!svg) {
        return null
      }
      const rect = svg.getBoundingClientRect()
      if (!rect.width || !rect.height) {
        return null
      }
      const x = ((clientX - rect.left) / rect.width) * GLOBE_SIZE
      const y = ((clientY - rect.top) / rect.height) * GLOBE_SIZE
      const radius = GLOBE_SIZE / 2 - GLOBE_PADDING
      const dx = x - GLOBE_SIZE / 2
      const dy = y - GLOBE_SIZE / 2
      if (dx * dx + dy * dy > radius * radius) {
        return null
      }
      const inverted = globeProjection.invert?.([x, y])
      if (!inverted) {
        return null
      }
      return [inverted[0], inverted[1]]
    },
    [globeProjection]
  )

  const getPlanetLonLatFromClient = useCallback(
    (clientX: number, clientY: number): LonLat | null => {
      const svg = planetSvgRef.current
      if (!svg) {
        return null
      }
      const rect = svg.getBoundingClientRect()
      if (!rect.width || !rect.height) {
        return null
      }
      const x = ((clientX - rect.left) / rect.width) * PLANET_PREVIEW_SIZE
      const y = ((clientY - rect.top) / rect.height) * PLANET_PREVIEW_SIZE
      const radius = planetRadius
      const dx = x - PLANET_PREVIEW_SIZE / 2
      const dy = y - PLANET_PREVIEW_SIZE / 2
      if (dx * dx + dy * dy > radius * radius) {
        return null
      }
      const inverted = planetProjection.invert?.([x, y])
      if (!inverted) {
        return null
      }
      return [inverted[0], inverted[1]]
    },
    [planetProjection, planetRadius]
  )

  const isClientInsidePlanetInset = useCallback(
    (clientX: number, clientY: number) => {
      const inset = planetInsetRef.current
      if (!inset) {
        return false
      }
      const rect = inset.getBoundingClientRect()
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      )
    },
    []
  )

  const getPlanetDropLonLat = useCallback(
    (clientX: number, clientY: number) => {
      const lonLat = getPlanetLonLatFromClient(clientX, clientY)
      if (lonLat) {
        return lonLat
      }
      if (isClientInsidePlanetInset(clientX, clientY)) {
        return [0, 0] as LonLat
      }
      return null
    },
    [getPlanetLonLatFromClient, isClientInsidePlanetInset]
  )

  const schedulePlanetRotation = useCallback((nextRotation: Vec3) => {
    planetRotationPending.current = nextRotation
    if (planetRotationFrame.current !== null) {
      return
    }
    planetRotationFrame.current = requestAnimationFrame(() => {
      planetRotationFrame.current = null
      if (planetRotationPending.current) {
        setPlanetRotation(planetRotationPending.current)
        planetRotationPending.current = null
      }
    })
  }, [])

  const flushPlanetRotation = useCallback(() => {
    if (planetRotationFrame.current !== null) {
      cancelAnimationFrame(planetRotationFrame.current)
      planetRotationFrame.current = null
    }
    if (planetRotationPending.current) {
      setPlanetRotation(planetRotationPending.current)
      planetRotationPending.current = null
    }
  }, [])

  const handleGlobeMove = useCallback(
    (event: PointerEvent) => {
      if (
        globeDragState.current &&
        globeDragState.current.pointerId === event.pointerId
      ) {
        const dx = event.clientX - globeDragState.current.start.x
        const dy = event.clientY - globeDragState.current.start.y
        const nextRotation: Vec3 = [
          globeDragState.current.rotation[0] + dx * GLOBE_DRAG_SENSITIVITY,
          clamp(
            globeDragState.current.rotation[1] - dy * GLOBE_DRAG_SENSITIVITY,
            -MAX_GLOBE_TILT,
            MAX_GLOBE_TILT
          ),
          0,
        ]
        setGlobeRotation(nextRotation)
        return
      }

      if (
        planetDragState.current &&
        planetDragState.current.pointerId === event.pointerId
      ) {
        const dx = event.clientX - planetDragState.current.start.x
        const dy = event.clientY - planetDragState.current.start.y
        const nextRotation: Vec3 = [
          planetDragState.current.rotation[0] + dx * GLOBE_DRAG_SENSITIVITY,
          clamp(
            planetDragState.current.rotation[1] - dy * GLOBE_DRAG_SENSITIVITY,
            -MAX_GLOBE_TILT,
            MAX_GLOBE_TILT
          ),
          0,
        ]
        schedulePlanetRotation(nextRotation)
        return
      }

      if (
        globeCountryDragState.current &&
        globeCountryDragState.current.pointerId === event.pointerId
      ) {
        const nextLonLat = getGlobeLonLatFromClient(
          event.clientX,
          event.clientY
        )
        if (!nextLonLat) {
          return
        }
        const rotation = createSphericalRotation(
          globeCountryDragState.current.startLonLat,
          nextLonLat
        )
        const nextCentroid = rotation(
          globeCountryDragState.current.startCentroid
        )
        setCountries((prev) =>
          prev.map((country) =>
            country.id === globeCountryDragState.current?.id
              ? { ...country, globeCentroid: nextCentroid }
              : country
          )
        )
        return
      }

      if (
        planetCountryDragState.current &&
        planetCountryDragState.current.pointerId === event.pointerId
      ) {
        const nextLonLat = getPlanetLonLatFromClient(
          event.clientX,
          event.clientY
        )
        if (!nextLonLat) {
          return
        }
        setPlanetPlacements((prev) =>
          prev.map((entry) =>
            entry.id === planetCountryDragState.current?.id
              ? { ...entry, centroid: nextLonLat }
              : entry
          )
        )
      }
    },
    [
      getGlobeLonLatFromClient,
      getPlanetLonLatFromClient,
      schedulePlanetRotation,
      setCountries,
      setGlobeRotation,
      setPlanetPlacements,
    ]
  )

  const handleGlobeEnd = useCallback((event: PointerEvent) => {
    if (
      globeDragState.current &&
      globeDragState.current.pointerId === event.pointerId
    ) {
      globeDragState.current = null
    }
    if (
      planetDragState.current &&
      planetDragState.current.pointerId === event.pointerId
    ) {
      planetDragState.current = null
      flushPlanetRotation()
      setPlanetDragging(false)
    }
    if (
      globeCountryDragState.current &&
      globeCountryDragState.current.pointerId === event.pointerId
    ) {
      const droppedId = globeCountryDragState.current.id
      const planetLonLat = getPlanetDropLonLat(
        event.clientX,
        event.clientY
      )
      if (solarSystemEnabled && planetLonLat) {
        upsertPlanetPlacement(droppedId, planetLonLat)
        setCountries((prev) =>
          prev.map((country) =>
            country.id === droppedId
              ? { ...country, globeCentroid: country.originalCentroid }
              : country
          )
        )
      }
      globeCountryDragState.current = null
    }
    if (
      planetCountryDragState.current &&
      planetCountryDragState.current.pointerId === event.pointerId
    ) {
      planetCountryDragState.current = null
    }
    if (
      !globeDragState.current &&
      !globeCountryDragState.current &&
      !planetCountryDragState.current &&
      !planetDragState.current
    ) {
      setGlobeDragging(false)
    }
  }, [
    flushPlanetRotation,
    getPlanetDropLonLat,
    solarSystemEnabled,
    upsertPlanetPlacement,
    setCountries,
    setPlanetDragging,
    setGlobeDragging,
  ])

  const handleGlobePointerDown = (
    event: ReactPointerEvent<SVGSVGElement>
  ) => {
    if (globeActiveMode !== 'rotate') {
      return
    }
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    globeCountryDragState.current = null
    planetCountryDragState.current = null
    planetDragState.current = null
    setPlanetDragging(false)
    globeDragState.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      rotation: globeRotation,
    }
    setGlobeDragging(true)
  }

  const handleGlobeCountryPointerDown = (
    event: ReactPointerEvent<SVGPathElement>,
    country: CountryDatum
  ) => {
    if (globeActiveMode !== 'country') {
      return
    }
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const startLonLat = getGlobeLonLatFromClient(
      event.clientX,
      event.clientY
    )
    if (!startLonLat) {
      return
    }
    globeDragState.current = null
    planetDragState.current = null
    setPlanetDragging(false)
    planetCountryDragState.current = null
    globeCountryDragState.current = {
      id: country.id,
      pointerId: event.pointerId,
      startLonLat,
      startCentroid: country.globeCentroid,
    }
    setSelectedId(country.id)
    setGlobeDragging(true)
  }

  const handlePlanetCountryPointerDown = (
    event: ReactPointerEvent<SVGPathElement>,
    country: CountryDatum
  ) => {
    if (globeActiveMode !== 'country' || !solarSystemEnabled) {
      return
    }
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const nextLonLat = getPlanetLonLatFromClient(
      event.clientX,
      event.clientY
    )
    if (!nextLonLat) {
      return
    }
    globeDragState.current = null
    globeCountryDragState.current = null
    planetDragState.current = null
    setPlanetDragging(false)
    planetCountryDragState.current = {
      id: country.id,
      pointerId: event.pointerId,
    }
    upsertPlanetPlacement(country.id, nextLonLat)
    setSelectedId(country.id)
    setGlobeDragging(true)
  }

  const handlePlanetPointerDown = (
    event: ReactPointerEvent<SVGSVGElement>
  ) => {
    if (globeActiveMode !== 'rotate' || !solarSystemEnabled) {
      return
    }
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    globeDragState.current = null
    globeCountryDragState.current = null
    planetCountryDragState.current = null
    planetDragState.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      rotation: planetRotation,
    }
    setPlanetDragging(true)
    setGlobeDragging(true)
  }

  useEffect(() => {
    if (!globeDragging) {
      return
    }
    window.addEventListener('pointermove', handleGlobeMove)
    window.addEventListener('pointerup', handleGlobeEnd)
    window.addEventListener('pointercancel', handleGlobeEnd)
    return () => {
      window.removeEventListener('pointermove', handleGlobeMove)
      window.removeEventListener('pointerup', handleGlobeEnd)
      window.removeEventListener('pointercancel', handleGlobeEnd)
    }
  }, [globeDragging, handleGlobeMove, handleGlobeEnd])

  const selectedDetails = selectedCountry
    ? (() => {
        const [, currentLat] = getCurrentCoordinates(selectedCountry)
        const originalLat = selectedCountry.originalCentroid[1]
        return {
          originalLat,
          currentLat,
          currentScale: getMercatorScale(originalLat, currentLat),
        }
      })()
    : null

  const globeHighlightCountries = useMemo<GlobeHighlightCountry[]>(
    () =>
      draggableCountries.map((country) => {
        const rotation = createSphericalRotation(
          country.originalCentroid,
          country.globeCentroid
        )
        const rotatedGeometry = country.feature.geometry
          ? rotateGeometry(country.feature.geometry, rotation)
          : country.feature.geometry
        const rotatedFeature: CountryFeature = {
          ...country.feature,
          geometry: rotatedGeometry,
        }
        return {
          country,
          feature: rotatedFeature,
        }
      }),
    [draggableCountries]
  )

  const planetPreviewCountries = useMemo(
    () =>
      planetPlacements
        .map((placement) => {
          const country =
            countries.find((entry) => entry.id === placement.id) ?? null
          if (!country) {
            return null
          }
          const scaleFactor = planetScaleFactor
          const scaledGeometry = country.feature.geometry
            ? scaleGeometry(
                country.feature.geometry,
                country.originalCentroid,
                scaleFactor
              )
            : country.feature.geometry
          const rotation = createSphericalRotation(
            country.originalCentroid,
            placement.centroid
          )
          const rotatedGeometry = scaledGeometry
            ? rotateGeometry(scaledGeometry, rotation)
            : scaledGeometry
          const rotatedFeature: CountryFeature = {
            ...country.feature,
            geometry: rotatedGeometry,
          }
          return {
            country,
            feature: rotatedFeature,
          }
        })
        .filter(
          (entry): entry is { country: CountryDatum; feature: CountryFeature } =>
            Boolean(entry)
        ),
    [planetPlacements, countries, planetScaleFactor]
  )

  const globeActiveMode = globeModifierPressed ? 'country' : globeDragMode
  return (
    <>
      <Helmet prioritizeSeoTags>
        <title>{pageMeta.title}</title>
        <meta name="description" content={pageMeta.description} />
        <link rel="canonical" href={pageMeta.canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageMeta.title} />
        <meta property="og:description" content={pageMeta.description} />
        <meta property="og:url" content={pageMeta.canonical} />
        <meta property="og:image" content={seoMeta.siteImageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageMeta.title} />
        <meta name="twitter:description" content={pageMeta.description} />
        <meta name="twitter:image" content={seoMeta.siteImageUrl} />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className="app">
      <nav className="page-tabs" aria-label="Interactive science tools">
        <a
          className="page-tabs-brand"
          href="https://www.runcell.dev"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Runcell"
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
          <NavLink
            ref={isTrueSizePage && isMapView ? activeNavItemRef : undefined}
            className={({ isActive }) => `page-tab ${isActive ? 'is-active' : ''}`}
            to="/"
            end
          >
            <MapIcon className="page-tab-icon" size={16} aria-hidden="true" />
            <span>True size</span>
          </NavLink>
          <NavLink ref={isGlobePage ? activeNavItemRef : undefined} className={({ isActive }) => `page-tab ${isActive ? 'is-active' : ''}`} to={TRUE_SIZE_GLOBE_PATH}>
            <Globe className="page-tab-icon" size={16} aria-hidden="true" />
            <span>Planets</span>
          </NavLink>
          <NavLink ref={isEquatorLab ? activeNavItemRef : undefined} className={({ isActive }) => `page-tab ${isActive ? 'is-active' : ''}`} to={CUSTOM_MERCATOR_PATH}>
            <Compass className="page-tab-icon" size={16} aria-hidden="true" />
            <span>Equator</span>
          </NavLink>
          <NavLink ref={isSeaLevelPage ? activeNavItemRef : undefined} className={({ isActive }) => `page-tab ${isActive ? 'is-active' : ''}`} to={SEA_LEVEL_PATH}>
            <Waves className="page-tab-icon" size={16} aria-hidden="true" />
            <span>Sea level</span>
          </NavLink>
          <NavLink ref={isAsteroidPage ? activeNavItemRef : undefined} className={({ isActive }) => `page-tab ${isActive ? 'is-active' : ''}`} to={ASTEROID_PATH}>
            <Flame className="page-tab-icon" size={16} aria-hidden="true" />
            <span>Asteroid</span>
          </NavLink>
          <NavLink ref={isNuclearPage ? activeNavItemRef : undefined} className={({ isActive }) => `page-tab ${isActive ? 'is-active' : ''}`} to={NUCLEAR_PATH}>
            <Radiation className="page-tab-icon" size={16} aria-hidden="true" />
            <span>Nuclear</span>
          </NavLink>
          <NavLink ref={isAnalemmaPage ? activeNavItemRef : undefined} className={({ isActive }) => `page-tab ${isActive ? 'is-active' : ''}`} to={SUN_ANALEMMA_PATH}>
            <Sun className="page-tab-icon" size={16} aria-hidden="true" />
            <span>Analemma</span>
          </NavLink>
        </div>
      </nav>

      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">{headerEyebrow}</p>
          <h1>{headerTitle}</h1>
          <p className="subhead">{headerDescription}</p>
          <div className="hero-cta">
            <div className="author-label">Follow the author</div>
            <div className="author-links">
              <a
                className="author-link"
                href="https://x.com/ob12er"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow on Twitter"
              >
                <Twitter size={16} />
                Twitter
              </a>
              <a
                className="author-link"
                href="https://www.youtube.com/@elwynnlab"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow on YouTube"
              >
                <Youtube size={16} />
                YouTube
              </a>
              <a
                className="author-link"
                href="https://github.com/ObservedObserver"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow on GitHub"
              >
                <Github size={16} />
                GitHub
              </a>
              {/* <a
                className="author-link"
                href="https://xhslink.com/m/71DmCX2c4vp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow on Xiaohongshu"
              >
                <Book size={16} />
                rednote
              </a>
              <a
                className="author-link"
                href="https://space.bilibili.com/7014948"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow on bilibili"
              >
                <Tv size={16} />
                bilibili
              </a> */}
            </div>
          </div>
        </div>
      </header>

      {isAnalemmaPage ? (
        <MapErrorBoundary key="analemma" fallback={<ToolViewUnavailable name="Sun analemma calculator" />}>
          <AnalemmaRoute
            worldFeatures={worldFeatures}
            loading={loading}
            error={error}
          />
        </MapErrorBoundary>
      ) : isNuclearPage ? (
        <MapErrorBoundary key="nuclear" fallback={<ToolViewUnavailable name="nuclear blast radius map" />}>
          <NuclearRoute />
        </MapErrorBoundary>
      ) : isAsteroidPage ? (
        <MapErrorBoundary key="asteroid" fallback={<ToolViewUnavailable name="asteroid impact simulator" />}>
          <AsteroidRoute />
        </MapErrorBoundary>
      ) : isSeaLevelPage ? (
        <MapErrorBoundary key="sea-level" fallback={<SeaLevelUnavailable />}>
          <SeaLevelRoute />
        </MapErrorBoundary>
      ) : isTrueSizePage ? (
        isMapView ? (
          <MapView
            loading={loading}
            error={error}
            showStaticPreview={!comparisonMeta}
            mapWidth={MAP_WIDTH}
            mapHeight={MAP_HEIGHT}
            worldFeatures={worldFeatures}
            pathGenerator={pathGenerator}
            latLines={mapLatLines}
            renderedCountries={mapRenderedCountries}
            draggableCountries={draggableCountries}
            selectedCountry={selectedCountry}
            selectedDetails={selectedDetails}
            selectedId={selectedId}
            countryFilter={countryFilter}
            filteredCountries={filteredCountries}
            draggableIds={draggableIds}
            areaFormatter={areaFormatter}
            formatLatitude={formatLatitude}
            formatScale={formatScale}
            onResetPositions={resetPositions}
            onSelectCountry={setSelectedId}
            onCountryPointerDown={handlePointerDown}
            onCountryFilterChange={setCountryFilter}
            onToggleDraggable={toggleDraggable}
          />
        ) : (
          <MapErrorBoundary key="globe" fallback={<ToolViewUnavailable name="globe" />}>
          <GlobeView
            loading={loading}
            error={error}
            worldFeatures={worldFeatures}
            globePathGenerator={globePathGenerator}
            globeSphere={globeSphere}
            globeGraticule={globeGraticule}
            planetPathGenerator={planetPathGenerator}
            planetGraticule={planetGraticule}
            globeHighlightCountries={globeHighlightCountries}
            globeActiveMode={globeActiveMode}
            globeDragging={globeDragging}
            planetDragging={planetDragging}
            solarSystemEnabled={solarSystemEnabled}
            isGlobeFullscreen={isGlobeFullscreen}
            activePlanet={activePlanet}
            activePlanetId={activePlanetId}
            planetRatio={planetRatio}
            planetZoom={planetZoom}
            canPlanetZoomIn={canPlanetZoomIn}
            canPlanetZoomOut={canPlanetZoomOut}
            planetCountries={planetPreviewCountries}
            areaFormatter={areaFormatter}
            selectedCountry={selectedCountry}
            draggableCountries={draggableCountries}
            countryFilter={countryFilter}
            filteredCountries={filteredCountries}
            draggableIds={draggableIds}
            globeFrameRef={globeFrameRef}
            globeSvgRef={globeSvgRef}
            planetCanvasRef={planetCanvasRef}
            planetSvgRef={planetSvgRef}
            planetInsetRef={planetInsetRef}
            globeSize={GLOBE_SIZE}
            planetPreviewSize={PLANET_PREVIEW_SIZE}
            planetRadius={planetRadius}
            onResetScene={resetGlobeRotation}
            onCenterSelected={() =>
              selectedCountry ? focusOnCountry(selectedCountry) : null
            }
            onToggleFullscreen={toggleGlobeFullscreen}
            onSetGlobeDragMode={setGlobeDragMode}
            onToggleSolarSystem={() => setSolarSystemEnabled((prev) => !prev)}
            onGlobePointerDown={handleGlobePointerDown}
            onGlobeCountryPointerDown={handleGlobeCountryPointerDown}
            onPlanetPointerDown={handlePlanetPointerDown}
            onPlanetCountryPointerDown={handlePlanetCountryPointerDown}
            onPlanetZoomIn={handlePlanetZoomIn}
            onPlanetZoomOut={handlePlanetZoomOut}
            onSelectPlanet={setActivePlanetId}
            onFocusCountry={focusOnCountry}
            onCountryFilterChange={setCountryFilter}
            onToggleDraggable={toggleDraggable}
            formatLatitude={formatLatitude}
            formatLongitude={formatLongitude}
            formatPlanetRatio={formatPlanetRatio}
          />
          </MapErrorBoundary>
        )
      ) : (
        <MapErrorBoundary key="projection-lab" fallback={<ToolViewUnavailable name="projection lab" />}>
        <EquatorShiftView
          loading={loading}
          error={error}
          countries={countries}
          setCountries={setCountries}
          worldFeatures={worldFeatures}
          draggableIds={draggableIds}
          selectedId={selectedId}
          onSelectCountry={setSelectedId}
          countryFilter={countryFilter}
          filteredCountries={filteredCountries}
          onCountryFilterChange={setCountryFilter}
          onToggleDraggable={toggleDraggable}
        />
        </MapErrorBoundary>
      )}

      {shouldRenderSeoContent && <SeoContent comparison={comparisonMeta} />}
      {isSeaLevelPage && <SeaLevelSeoContent />}
      {isTrueSizePage && !isMapView && <GlobeSeoContent />}
      {isEquatorLab && <EquatorSeoContent />}

      {isAsteroidPage && <AsteroidSeoContent />}

      {isNuclearPage && <NuclearBlastSeoContent />}

      {isAnalemmaPage && <SunAnalemmaSeoContent />}

      <section
        className={`share-card ${isSeaLevelPage ? 'has-slot' : ''}`}
        aria-labelledby="share-card-title"
      >
        <div className="share-card-header">
          <div className="share-card-icon" aria-hidden="true">
            <Share2 size={20} />
          </div>
          <div>
            <h2 id="share-card-title">Share This Tool</h2>
            <p>
              {isNuclearPage
                ? 'Share this nuclear blast radius map and let others model their own scenario.'
                : isAnalemmaPage
                ? 'Share this Sun analemma calculator and let others trace the figure eight from anywhere on Earth.'
                : isAsteroidPage
                ? 'Share your asteroid impact scenario and let others run their own.'
                : 'Help others discover this interactive map and globe experience.'}
            </p>
          </div>
        </div>

        <div className="share-card-body">
          <div className="share-card-main">
            <div className="share-group">
              <label className="share-label" htmlFor="share-link-input">
                Copy Link
              </label>
              <div className="share-copy-row">
                <input
                  id="share-link-input"
                  className="share-link-input"
                  type="text"
                  value={shareUrl}
                  readOnly
                />
                <button
                  type="button"
                  className="share-copy-button"
                  onClick={handleCopyShareLink}
                >
                  {copyStatus === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                  {copyStatus === 'copied'
                    ? 'Copied'
                    : copyStatus === 'failed'
                      ? 'Retry'
                      : 'Copy'}
                </button>
              </div>
            </div>

            <div className="share-group">
              <div className="share-label">Share on Social Media</div>
              <div className="share-options-grid">
                <a
                  className="share-option"
                  href={shareLinks.x}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Twitter size={18} />
                  X
                </a>
                <a
                  className="share-option"
                  href={shareLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Facebook size={18} />
                  Facebook
                </a>
                <a
                  className="share-option"
                  href={shareLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin size={18} />
                  LinkedIn
                </a>
                <a
                  className="share-option"
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={18} />
                  WhatsApp
                </a>
              </div>
              <a className="share-option share-option-email" href={shareLinks.email}>
                <Mail size={18} />
                Share via Email
              </a>
            </div>

            <div className="share-divider" />

            <button
              type="button"
              className="share-more-button"
              onClick={handleNativeShare}
            >
              <Share2 size={16} />
              More Share Options
            </button>

            <p className="share-hashtags">
              {isNuclearPage
                ? 'Suggested hashtags: #NuclearWeapons #BlastRadius #Science #History'
                : isAnalemmaPage
                ? 'Suggested hashtags: #Analemma #Astronomy #SunPosition #Science'
                : isAsteroidPage
                ? 'Suggested hashtags: #AsteroidImpact #Space #Science #Astronomy'
                : 'Suggested hashtags: #TrueSizeMap #Geography #Cartography #Learning'}
            </p>
          </div>

          {isSeaLevelPage && (
            <aside className="share-card-slot" aria-label="Sea level short video">
              <div className="share-card-slot-label">Quick Demo</div>
              <div className="share-card-video-frame">
                <iframe
                  src={SEA_LEVEL_SHORTS_EMBED_URL}
                  title="Sea Level Simulator YouTube Short"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </aside>
          )}
        </div>
      </section>

      <footer className="app-footer">
        <p>
          Built with {' '}
          <a href="https://www.runcell.dev" target="_blank" rel="noopener noreferrer">
            runcell
          </a>
        </p>
      </footer>
      </div>
    </>
  )
}

export default App
