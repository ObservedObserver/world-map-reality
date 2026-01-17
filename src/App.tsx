import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { LineString } from 'geojson'
import * as d3 from 'd3'
import { Globe, Twitter, Youtube } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
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
import './App.css'

const CUSTOM_MERCATOR_PATH = '/custom-mercator-projection'

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
  const [activeView, setActiveView] = useState<'map' | 'globe'>('globe')
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

  useEffect(() => {
    if (loading) {
      return
    }
    if (!selectedId && initialSelection.selectedId) {
      setSelectedId(initialSelection.selectedId)
    }
    if (draggableIds.length === 0 && initialSelection.draggableIds.length > 0) {
      setDraggableIds(initialSelection.draggableIds)
    }
  }, [loading, initialSelection, selectedId, draggableIds])

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
  const isEquatorLab = location.pathname.startsWith(CUSTOM_MERCATOR_PATH)
  const isTrueSizePage = !isEquatorLab

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
  }, [])

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
  const isMapView = activeView === 'map'
  return (
    <div className="app">
      <div className="page-tabs" role="tablist" aria-label="Experience views">
        <NavLink
          className={({ isActive }) =>
            `page-tab ${isActive ? 'is-active' : ''}`
          }
          to="/"
          role="tab"
          aria-selected={isTrueSizePage}
        >
          True size
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `page-tab ${isActive ? 'is-active' : ''}`
          }
          to={CUSTOM_MERCATOR_PATH}
          role="tab"
          aria-selected={!isTrueSizePage}
        >
          Equator lab
        </NavLink>
      </div>

      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">
            {isTrueSizePage
              ? isMapView
                ? 'Mercator True Size Playground'
                : 'True Size Globe'
              : 'Experimental Projection Lab'}
          </p>
          <h1>
            {isTrueSizePage
              ? isMapView
                ? 'The True Size of Countries (Mercator Map)'
                : 'Countries on a True Globe'
              : 'Redefine the Equator'}
          </h1>
          <p className="subhead">
            {isTrueSizePage
              ? isMapView
                ? 'Mercator inflates shapes near the poles. Drag a country to a new latitude and it resizes as if it belonged there.'
                : 'Spin the orthographic globe to compare countries at their real scale.'
              : 'Tilt the equator on the globe and see Mercator stretch the world in new directions.'}
          </p>
        </div>
        <div className="math-card">
          {isTrueSizePage && isMapView && (
            <>
              <div className="math-label">Mercator distortion</div>
              <div className="math-formula">1 / cos(latitude)</div>
              <div className="math-detail">
                Drag scale = cos(original lat) / cos(current lat)
              </div>
            </>
          )}
          {!isTrueSizePage && (
            <>
              <div className="math-label">Equator control</div>
              <div className="math-formula">Rotate the axis</div>
              <div className="math-detail">
                Drag the red handle to remap how Mercator stretches the Earth.
              </div>
            </>
          )}
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
          </div>
        </div>
      </header>

      {isTrueSizePage && (
        <div className="view-tabs" role="tablist" aria-label="Map views">
          <button
            className={`view-tab ${isMapView ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={isMapView}
            onClick={() => setActiveView('map')}
          >
            Mercator map
          </button>
          <button
            className={`view-tab ${isMapView ? '' : 'is-active'}`}
            type="button"
            role="tab"
            aria-selected={!isMapView}
            onClick={() => setActiveView('globe')}
          >
            <span className="view-tab-content">
              <Globe size={16} aria-hidden="true" />
              3D Globe
              <span className="view-tab-badge">new</span>
            </span>
          </button>
        </div>
      )}

      {isTrueSizePage ? (
        isMapView ? (
          <MapView
            loading={loading}
            error={error}
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
        )
      ) : (
        <EquatorShiftView
          loading={loading}
          error={error}
          worldFeatures={worldFeatures}
        />
      )}

      <footer className="app-footer">
        <p>
          Built by the creator of{' '}
          <a href="https://www.runcell.dev" target="_blank" rel="noopener noreferrer">
            runcell
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
