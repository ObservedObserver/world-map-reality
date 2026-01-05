import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { FeatureCollection, GeoJsonProperties, Geometry, LineString } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type {
  CountryDatum,
  CountryFeature,
  GlobeHighlightCountry,
  LonLat,
  MapRenderedCountry,
  SelectedDetails,
  Vec3,
} from './types'
import { EARTH_DIAMETER_KM, PLANETS, PLANET_TEXTURES } from './solar'
import type { Planet } from './solar'
import GlobeView from './components/GlobeView'
import MapView from './components/MapView'
import './App.css'

const WORLD_TOPO_URL = `${import.meta.env.BASE_URL}data/countries-110m.json`
const WORLD_NAMES_URL = `${import.meta.env.BASE_URL}data/countries-110m.tsv`

const MAP_WIDTH = 1100
const MAP_HEIGHT = 650
const MAP_PADDING = 40

const COUNTRY_ORDER = [304, 643, 124, 840, 76, 356, 180, 36, 392]

const COUNTRY_META: Record<number, { name: string; area: number }> = {
  304: { name: 'Greenland', area: 2166086 },
  643: { name: 'Russia', area: 17098246 },
  124: { name: 'Canada', area: 9984670 },
  840: { name: 'United States', area: 9833520 },
  76: { name: 'Brazil', area: 8515767 },
  356: { name: 'India', area: 3287263 },
  180: { name: 'DR Congo', area: 2344858 },
  36: { name: 'Australia', area: 7692024 },
  392: { name: 'Japan', area: 377975 },
}

const COLOR_PALETTE = [
  '#ef6f5a',
  '#f6c453',
  '#6ad0c4',
  '#9bd0ff',
  '#f49cbb',
  '#b5e48c',
  '#ffb870',
  '#86b6ff',
  '#f08a5d',
  '#7ed7c1',
  '#ffd166',
  '#06d6a0',
  '#118ab2',
  '#ef476f',
  '#ffd6a5',
  '#7f5af0',
  '#72efdd',
  '#e07a5f',
  '#f2cc8f',
  '#84a59d',
  '#f28482',
  '#a3cef1',
  '#ffcad4',
  '#cdb4db',
]

const normalizeId = (value: string | number) => {
  const raw = String(value)
  const stripped = raw.replace(/^0+/, '')
  return stripped === '' ? '0' : stripped
}

const SOLAR_BASE_URL = `${import.meta.env.BASE_URL}solar/`

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const ROTATION_EPSILON = 1e-6

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const GLOBE_SIZE = 680
const GLOBE_PADDING = 28
const GLOBE_DEFAULT_ROTATION: Vec3 = [-20, -10, 0]
const GLOBE_DRAG_SENSITIVITY = 0.25
const MAX_GLOBE_TILT = 80
const PLANET_PREVIEW_SIZE = 260
const PLANET_PADDING = 16
const PLANET_BASE_RADIUS = PLANET_PREVIEW_SIZE / 2 - PLANET_PADDING
const PLANET_DEFAULT_ROTATION: Vec3 = [-28, -12, 0]
const PLANET_ZOOM_MIN = 0.6
const PLANET_ZOOM_MAX = 2.4
const PLANET_ZOOM_STEP = 0.18
const MAX_LATITUDE = 89.9

const lonLatToVector = ([lon, lat]: LonLat): Vec3 => {
  const lambda = lon * DEG_TO_RAD
  const phi = lat * DEG_TO_RAD
  const cosPhi = Math.cos(phi)
  return [
    cosPhi * Math.cos(lambda),
    cosPhi * Math.sin(lambda),
    Math.sin(phi),
  ]
}

const vectorToLonLat = ([x, y, z]: Vec3): LonLat => {
  const lon = Math.atan2(y, x) * RAD_TO_DEG
  const hyp = Math.sqrt(x * x + y * y)
  const lat = Math.atan2(z, hyp) * RAD_TO_DEG
  return [lon, lat]
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const normalize = (value: Vec3): Vec3 => {
  const length = Math.hypot(value[0], value[1], value[2])
  if (length < ROTATION_EPSILON) {
    return [0, 0, 0]
  }
  return [value[0] / length, value[1] / length, value[2] / length]
}

// Rotate coordinates on the sphere so the feature centroid moves to the drag target.
const createSphericalRotation = (from: LonLat, to: LonLat) => {
  const fromVec = lonLatToVector(from)
  const toVec = lonLatToVector(to)
  const rawDot = clamp(dot(fromVec, toVec), -1, 1)
  const angle = Math.acos(rawDot)
  if (angle < ROTATION_EPSILON) {
    return (coordinate: LonLat) => coordinate
  }

  let axis = cross(fromVec, toVec)
  if (Math.hypot(axis[0], axis[1], axis[2]) < ROTATION_EPSILON) {
    const fallback: Vec3 =
      Math.abs(fromVec[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    axis = cross(fromVec, fallback)
  }
  axis = normalize(axis)

  const sinAngle = Math.sin(angle)
  const cosAngle = Math.cos(angle)
  const oneMinusCos = 1 - cosAngle

  return ([lon, lat]: LonLat): LonLat => {
    const vec = lonLatToVector([lon, lat])
    const crossAxis = cross(axis, vec)
    const dotAxis = dot(axis, vec)
    const rotated: Vec3 = [
      vec[0] * cosAngle + crossAxis[0] * sinAngle + axis[0] * dotAxis * oneMinusCos,
      vec[1] * cosAngle + crossAxis[1] * sinAngle + axis[1] * dotAxis * oneMinusCos,
      vec[2] * cosAngle + crossAxis[2] * sinAngle + axis[2] * dotAxis * oneMinusCos,
    ]
    return vectorToLonLat(rotated)
  }
}

const rotateGeometry = (geometry: Geometry, rotate: (coord: LonLat) => LonLat): Geometry => {
  const rotatePosition = (coord: number[]) => {
    const [lon, lat] = rotate([coord[0], coord[1]])
    return coord.length > 2 ? [lon, lat, ...coord.slice(2)] : [lon, lat]
  }

  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: rotatePosition(geometry.coordinates as number[]),
      }
    case 'MultiPoint':
    case 'LineString':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as number[][]).map(rotatePosition),
      }
    case 'MultiLineString':
    case 'Polygon':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as number[][][]).map((line) =>
          line.map(rotatePosition)
        ),
      }
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as number[][][][]).map((polygon) =>
          polygon.map((ring) => ring.map(rotatePosition))
        ),
      }
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map((geom) =>
          rotateGeometry(geom, rotate)
        ),
      }
    default:
      return geometry
  }
}

const scaleGeometry = (
  geometry: Geometry,
  center: LonLat,
  factor: number
): Geometry => {
  const scalePosition = (coord: number[]) => {
    const lon = center[0] + (coord[0] - center[0]) * factor
    const lat = clamp(
      center[1] + (coord[1] - center[1]) * factor,
      -MAX_LATITUDE,
      MAX_LATITUDE
    )
    const clampedLon = clamp(lon, -180, 180)
    return coord.length > 2 ? [clampedLon, lat, ...coord.slice(2)] : [clampedLon, lat]
  }

  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: scalePosition(geometry.coordinates as number[]),
      }
    case 'MultiPoint':
    case 'LineString':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as number[][]).map(scalePosition),
      }
    case 'MultiLineString':
    case 'Polygon':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as number[][][]).map((line) =>
          line.map(scalePosition)
        ),
      }
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as number[][][][]).map((polygon) =>
          polygon.map((ring) => ring.map(scalePosition))
        ),
      }
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map((geom) =>
          scaleGeometry(geom, center, factor)
        ),
      }
    default:
      return geometry
  }
}

type CountriesTopology = Topology<{ countries: GeometryCollection }>

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

type PlanetPlacement = {
  id: string
  centroid: LonLat
}

const formatLatitude = (lat: number) => {
  const absolute = Math.abs(lat)
  if (absolute < 0.05) {
    return `${absolute.toFixed(1)}deg`
  }
  const direction = lat >= 0 ? 'N' : 'S'
  return `${absolute.toFixed(1)}deg${direction}`
}

const formatLongitude = (lon: number) => {
  const absolute = Math.abs(lon)
  if (absolute < 0.05) {
    return `${absolute.toFixed(1)}deg`
  }
  const direction = lon >= 0 ? 'E' : 'W'
  return `${absolute.toFixed(1)}deg${direction}`
}

const formatPlanetRatio = (ratio: number) =>
  `${ratio.toFixed(ratio >= 1 ? 1 : 2)}x Earth`

const formatScale = (scale: number) => `${Math.round(scale * 100)}%`

const getMercatorScale = (originalLat: number, currentLat: number) =>
  Math.cos((originalLat * Math.PI) / 180) /
  Math.cos((currentLat * Math.PI) / 180)

const getCountryColor = (id: string) => {
  const numericId = Number(id)
  const index = Number.isFinite(numericId)
    ? Math.abs(numericId) % COLOR_PALETTE.length
    : id
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

function App() {
  const [countries, setCountries] = useState<CountryDatum[]>([])
  const [worldFeatures, setWorldFeatures] = useState<CountryFeature[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggableIds, setDraggableIds] = useState<string[]>([])
  const [countryFilter, setCountryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'map' | 'globe'>('map')
  const [globeDragMode, setGlobeDragMode] = useState<'rotate' | 'country'>(
    'rotate'
  )
  const [globeModifierPressed, setGlobeModifierPressed] = useState(false)
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
  const [isGlobeFullscreen, setIsGlobeFullscreen] = useState(false)
  const [planetDragging, setPlanetDragging] = useState(false)

  const dragState = useRef<DragState | null>(null)
  const globeDragState = useRef<GlobeDragState | null>(null)
  const globeCountryDragState = useRef<GlobeCountryDragState | null>(null)
  const planetCountryDragState = useRef<{
    id: string
    pointerId: number
  } | null>(null)
  const planetDragState = useRef<PlanetDragState | null>(null)
  const planetCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const planetTextureDataRef = useRef<{
    data: Uint8ClampedArray
    width: number
    height: number
  } | null>(null)
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
    let cancelled = false
    const controller = new AbortController()

    const loadCountryNames = async () => {
      const nameLookup = new Map<string, string>()
      try {
        const response = await fetch(WORLD_NAMES_URL, {
          signal: controller.signal,
        })
        if (!response.ok) {
          return nameLookup
        }
        const namesText = await response.text()
        const rows = d3.tsvParse(namesText)
        rows.forEach((row) => {
          const id = row.iso_n3 ?? row.un_a3 ?? row.iso_a3
          const name = row.name ?? row.name_long
          if (id && name) {
            const rawId = String(id)
            nameLookup.set(rawId, String(name))
            nameLookup.set(normalizeId(rawId), String(name))
          }
        })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw err
        }
      }
      return nameLookup
    }

    const loadData = async () => {
      try {
        setLoading(true)
        const topoResponse = await fetch(WORLD_TOPO_URL, {
          signal: controller.signal,
        })
        if (!topoResponse.ok) {
          throw new Error('Unable to load map data.')
        }

        const nameLookup = await loadCountryNames()
        const topoData = (await topoResponse.json()) as CountriesTopology
        const countriesObject = topoData.objects?.countries
        if (!countriesObject) {
          throw new Error('Unexpected map data format.')
        }

        const collection = topojson.feature(
          topoData,
          countriesObject
        ) as FeatureCollection<Geometry, GeoJsonProperties>

        const allFeatures = collection.features as CountryFeature[]

        const prepared: CountryDatum[] = allFeatures
          .filter((feature) => feature.id !== undefined && feature.id !== null)
          .map((feature) => {
            const rawId = feature.id as string | number
            const id = normalizeId(rawId)
            const numericId = Number(rawId)
            const meta = COUNTRY_META[numericId]
            const [lng, lat] = d3.geoCentroid(feature)
            const projected = projection([lng, lat]) ?? [0, 0]
            return {
              id,
              name:
                meta?.name ??
                nameLookup.get(id) ??
                feature.properties?.name ??
                `Country ${id}`,
              area: meta?.area ?? null,
              feature,
              originalCentroid: [lng, lat] as [number, number],
              globeCentroid: [lng, lat] as LonLat,
              centroidScreen: [projected[0], projected[1]] as [number, number],
              offset: { x: 0, y: 0 },
              color: getCountryColor(id),
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))

        const availableIds = new Set(prepared.map((country) => country.id))
        const defaultDraggableIds = COUNTRY_ORDER.map(String).filter((id) =>
          availableIds.has(id)
        )
        const fallbackIds = prepared.slice(0, 6).map((country) => country.id)
        const initialDraggableIds =
          defaultDraggableIds.length > 0 ? defaultDraggableIds : fallbackIds

        if (!cancelled) {
          setCountries(prepared)
          setWorldFeatures(allFeatures)
          setSelectedId(initialDraggableIds[0] ?? prepared[0]?.id ?? null)
          setDraggableIds(initialDraggableIds)
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) {
          return
        }
        const message =
          err instanceof Error ? err.message : 'Failed to load map.'
        setError(message)
        setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [projection])

  useEffect(() => {
    if (activeView !== 'globe') {
      setGlobeModifierPressed(false)
      return
    }
    const clearModifier = () => {
      setGlobeModifierPressed(false)
      globeCountryDragState.current = null
      planetCountryDragState.current = null
      planetDragState.current = null
      setPlanetDragging(false)
      if (!globeDragState.current) {
        setGlobeDragging(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'Control') {
        setGlobeModifierPressed(true)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'Control') {
        clearModifier()
      }
    }
    const handleBlur = () => {
      clearModifier()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleBlur)
    }
  }, [activeView])

  useEffect(() => {
    if (activeView !== 'globe') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.()
      } else {
        setIsGlobeFullscreen(false)
      }
    }
  }, [activeView])

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

  const drawPlanetTexture = useCallback(() => {
    const canvas = planetCanvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    const size = PLANET_PREVIEW_SIZE
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size
      canvas.height = size
    }
    context.clearRect(0, 0, size, size)
    const radius = planetRadius
    const radiusSquared = radius * radius
    const center = size / 2
    const baseColor: [number, number, number] = [10, 18, 36]
    const texture = planetTextureDataRef.current
    const imageData = context.createImageData(size, size)
    const output = imageData.data
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - center
        const dy = y - center
        if (dx * dx + dy * dy > radiusSquared) {
          continue
        }
        const destIndex = (y * size + x) * 4
        output[destIndex] = baseColor[0]
        output[destIndex + 1] = baseColor[1]
        output[destIndex + 2] = baseColor[2]
        output[destIndex + 3] = 255

        if (!texture) {
          continue
        }
        const lonLat = planetProjection.invert?.([x, y])
        if (!lonLat) {
          continue
        }
        const { data, width, height } = texture
        const [lon, lat] = lonLat
        const u = (lon + 180) / 360
        const v = (90 - lat) / 180
        const srcX = Math.min(width - 1, Math.max(0, Math.floor(u * width)))
        const srcY = Math.min(height - 1, Math.max(0, Math.floor(v * height)))
        const srcIndex = (srcY * width + srcX) * 4
        output[destIndex] = data[srcIndex]
        output[destIndex + 1] = data[srcIndex + 1]
        output[destIndex + 2] = data[srcIndex + 2]
      }
    }
    context.putImageData(imageData, 0, 0)
  }, [planetProjection, planetRadius])

  useEffect(() => {
    if (!planetTextureUrl) {
      planetTextureDataRef.current = null
      drawPlanetTexture()
      return
    }
    let cancelled = false
    const image = new Image()
    image.decoding = 'async'
    image.src = planetTextureUrl
    image.onload = () => {
      if (cancelled) {
        return
      }
      const offscreen = document.createElement('canvas')
      offscreen.width = image.naturalWidth
      offscreen.height = image.naturalHeight
      const ctx = offscreen.getContext('2d')
      if (!ctx) {
        planetTextureDataRef.current = null
        drawPlanetTexture()
        return
      }
      ctx.drawImage(image, 0, 0)
      const textureData = ctx.getImageData(
        0,
        0,
        offscreen.width,
        offscreen.height
      )
      planetTextureDataRef.current = {
        data: textureData.data,
        width: offscreen.width,
        height: offscreen.height,
      }
      drawPlanetTexture()
    }
    image.onerror = () => {
      if (cancelled) {
        return
      }
      planetTextureDataRef.current = null
      drawPlanetTexture()
    }
    return () => {
      cancelled = true
    }
  }, [planetTextureUrl, drawPlanetTexture])

  useEffect(() => {
    if (!solarSystemEnabled || loading) {
      return
    }
    drawPlanetTexture()
  }, [solarSystemEnabled, loading, planetRotation, drawPlanetTexture])

  useEffect(() => {
    if (activeView !== 'globe' || !solarSystemEnabled || loading) {
      return
    }
    drawPlanetTexture()
  }, [activeView, solarSystemEnabled, loading, drawPlanetTexture])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsGlobeFullscreen(
        document.fullscreenElement === globeFrameRef.current
      )
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

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

  const toggleGlobeFullscreen = useCallback(() => {
    const frame = globeFrameRef.current
    if (!frame) {
      return
    }
    if (document.fullscreenElement === frame) {
      document.exitFullscreen?.()
      return
    }
    frame.requestFullscreen?.()
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
        setPlanetRotation(nextRotation)
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
      setPlanetRotation,
      setCountries,
      setGlobeRotation,
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
  }, [getPlanetDropLonLat, solarSystemEnabled, upsertPlanetPlacement])

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
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">
            {isMapView ? 'Mercator True Size Playground' : 'True Size Globe'}
          </p>
          <h1>
            {isMapView
              ? 'The True Size of Countries (Mercator Map)'
              : 'Countries on a True Globe'}
          </h1>
          <p className="subhead">
            {isMapView
              ? 'Mercator inflates shapes near the poles. Drag a country to a new latitude and it resizes as if it belonged there.'
              : 'Spin the orthographic globe to compare countries at their real scale.'}
          </p>
        </div>
        <div className="math-card">
          {isMapView ? (
            <>
              <div className="math-label">Mercator distortion</div>
              <div className="math-formula">1 / cos(latitude)</div>
              <div className="math-detail">
                Drag scale = cos(original lat) / cos(current lat)
              </div>
            </>
          ) : (
            <>
              <div className="math-label">Globe controls</div>
              <div className="math-formula">Drag to rotate</div>
              <div className="math-detail">
                Tap a country chip to center it on the sphere.
              </div>
            </>
          )}
        </div>
      </header>

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
          3D globe
        </button>
      </div>

      {isMapView ? (
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
