import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Info, Move3d, MoonStar, Mountain, Ruler, Sparkles } from 'lucide-react'
import {
  DEFAULT_SKY_BODY_ID,
  MOON_DIAMETER_KM,
  MOON_DISTANCE_KM,
  SKY_BODIES,
  angularDiameterDeg,
  brightnessVsFullMoon,
} from '../planetSky'
import type { SkyBody } from '../planetSky'
import { SOLAR_BASE_URL } from '../constants'

const KM_PER_UNIT = 1000
const DEG = Math.PI / 180
const STAR_DOME_RADIUS = 14000
const SKY_DOME_RADIUS = 15500
const CAMERA_HEIGHT = 2
const MIN_FOV = 6
const MAX_FOV = 70
const DEFAULT_FOV = 45

/** Rough camera-equivalent for a given vertical field of view, for the HUD. */
function describeFov(fovDeg: number) {
  if (fovDeg >= 55) return 'ultra-wide lens'
  if (fovDeg >= 35) return 'phone main camera'
  if (fovDeg >= 18) return '50 mm lens'
  if (fovDeg >= 10) return 'telephoto lens'
  return '7× binoculars'
}

type SceneApi = {
  setBodyMesh: (body: SkyBody) => void
  applyParams: () => void
  dispose: () => void
}

type SkyParams = {
  bodyId: string
  distanceKm: number
  phaseAngleDeg: number
  altitudeDeg: number
}

function mulberry(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function createSilhouetteTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 8192
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)

  const rand = mulberry(20260717)
  // The cylinder this wraps spans 24 world units at radius 120, so one canvas
  // pixel is ~0.018° — the whole skyline stays within the few degrees a real
  // city subtends from a couple of kilometres away. Base sits ~1 unit below
  // eye level.
  const skylineBase = height * 0.71

  // Distant ridge, barely lighter than the horizon sky, hugging the skyline.
  ctx.fillStyle = '#0a1322'
  ctx.beginPath()
  ctx.moveTo(0, height)
  for (let x = 0; x <= width; x += 16) {
    const y =
      skylineBase -
      26 -
      14 * Math.sin(x * 0.0016 + 1.7) -
      8 * Math.sin(x * 0.0051 + 0.6)
    ctx.lineTo(x, y)
  }
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fill()

  // Warm light-pollution haze rising from the rooftops. The gradient runs all
  // the way down to the skyline base so it leaves no hard edge in the sky.
  const hazeTop = skylineBase - 300
  const haze = ctx.createLinearGradient(0, hazeTop, 0, skylineBase)
  haze.addColorStop(0, 'rgba(255, 158, 84, 0)')
  haze.addColorStop(0.55, 'rgba(255, 158, 84, 0.05)')
  haze.addColorStop(1, 'rgba(255, 150, 80, 0.15)')
  ctx.fillStyle = haze
  ctx.fillRect(0, hazeTop, width, skylineBase - hazeTop)

  // Far block of buildings behind the main skyline, for depth.
  let fx = 0
  while (fx < width) {
    const w = 10 + rand() * 22
    const h = 26 + rand() * 60
    ctx.fillStyle = '#081020'
    ctx.fillRect(fx, skylineBase - 8 - h, w, h + 8)
    fx += w + rand() * 30
  }

  // Main skyline: narrow dark slabs, occasional towers.
  const buildingColor = '#050810'
  let x = 0
  while (x < width) {
    const tower = rand() < 0.05
    const buildingWidth = tower ? 14 + rand() * 10 : 9 + rand() * 18
    const buildingHeight = tower ? 150 + rand() * 60 : 36 + rand() * 100
    const top = skylineBase - buildingHeight
    ctx.fillStyle = buildingColor
    ctx.fillRect(x, top, buildingWidth, buildingHeight)

    // Antenna masts with aircraft-warning lights on the towers.
    if (tower && rand() < 0.8) {
      const mastX = x + buildingWidth * (0.35 + rand() * 0.3)
      const mastH = 10 + rand() * 16
      ctx.fillRect(mastX - 0.5, top - mastH, 1, mastH)
      ctx.fillStyle = 'rgba(255, 92, 92, 0.9)'
      ctx.fillRect(mastX - 1, top - mastH - 2, 2, 2)
    }

    // Lit windows: at this distance a window is a 1–2 px speck, not a block.
    const cols = Math.max(2, Math.floor((buildingWidth - 3) / 3))
    const rows = Math.max(4, Math.floor((buildingHeight - 6) / 4))
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (rand() > 0.16) continue
        const warm = rand() < 0.8
        const alpha = 0.25 + rand() * 0.55
        ctx.fillStyle = warm
          ? `rgba(255, ${170 + Math.floor(rand() * 55)}, 110, ${alpha})`
          : `rgba(190, 214, 255, ${alpha * 0.8})`
        ctx.fillRect(x + 1.5 + c * 3, top + 3 + r * 4, 1.4, 1.8)
      }
    }
    x += buildingWidth + (rand() < 0.2 ? 6 + rand() * 18 : 1 + rand() * 3)
  }

  // Solid foreground below the skyline base.
  ctx.fillStyle = '#030509'
  ctx.fillRect(0, skylineBase, width, height - skylineBase)

  // Streetlight pinpricks along the base line.
  for (let i = 0; i < 260; i += 1) {
    const lx = rand() * width
    ctx.fillStyle = `rgba(255, 186, 120, ${0.3 + rand() * 0.45})`
    ctx.fillRect(lx, skylineBase - 1.5 + rand() * 2, 1.6, 1.6)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function createGroundTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const rand = mulberry(41507)
  // Radial gradient: slightly lifted near the observer, fading to the same
  // near-black the silhouette base uses so the seam at the horizon vanishes.
  const base = ctx.createRadialGradient(512, 512, 40, 512, 512, 512)
  base.addColorStop(0, '#202836')
  base.addColorStop(0.55, '#12171f')
  base.addColorStop(1, '#030509')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 1024, 1024)
  // Mottled scrub, soil and shadow patches.
  for (let i = 0; i < 3400; i += 1) {
    const px = rand() * 1024
    const py = rand() * 1024
    const size = 2 + rand() * 12
    const kind = rand()
    ctx.fillStyle =
      kind < 0.4
        ? `rgba(${44 + Math.floor(rand() * 22)}, ${56 + Math.floor(rand() * 24)}, ${44 + Math.floor(rand() * 14)}, ${0.1 + rand() * 0.14})`
        : kind < 0.7
          ? `rgba(${48 + Math.floor(rand() * 20)}, ${52 + Math.floor(rand() * 18)}, ${66 + Math.floor(rand() * 22)}, ${0.1 + rand() * 0.13})`
          : `rgba(3, 5, 9, ${0.1 + rand() * 0.16})`
    ctx.beginPath()
    ctx.ellipse(
      px,
      py,
      size,
      size * (0.5 + rand() * 0.7),
      rand() * Math.PI,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.28)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.07)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createRingTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 8
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = ctx.createImageData(512, 8)
  for (let x = 0; x < 512; x += 1) {
    const r = x / 511
    let alpha = 0
    let tone = 0.75
    if (r < 0.09) {
      alpha = 0.28 + 0.1 * Math.sin(r * 200)
      tone = 0.55
    } else if (r < 0.46) {
      alpha = 0.85 + 0.12 * Math.sin(r * 260)
      tone = 0.82
    } else if (r < 0.5) {
      alpha = 0.12 // Cassini division
      tone = 0.4
    } else if (r < 0.86) {
      alpha = 0.62 + 0.14 * Math.sin(r * 300)
      tone = 0.72
    } else if (r < 0.9) {
      alpha = 0.1 // Encke-ish gap
      tone = 0.4
    } else {
      alpha = 0.4
      tone = 0.62
    }
    const base = { r: 226, g: 210, b: 178 }
    for (let y = 0; y < 8; y += 1) {
      const idx = (y * 512 + x) * 4
      image.data[idx] = Math.round(base.r * tone)
      image.data[idx + 1] = Math.round(base.g * tone)
      image.data[idx + 2] = Math.round(base.b * tone)
      image.data[idx + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SKY_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlowColor;
  uniform vec3 uBodyDir;
  uniform float uGlowStrength;
  uniform float uGlowPow;
  uniform float uAmbientLift;
  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uZenith, pow(up, 0.5));
    // Below the horizon fade to near-black ground haze.
    float below = clamp(-dir.y * 4.0, 0.0, 1.0);
    sky = mix(sky, vec3(0.004, 0.006, 0.01), below);
    // Warm light-pollution band hugging the horizon (city glow).
    float horizonBand = pow(1.0 - abs(dir.y), 10.0);
    sky += vec3(0.085, 0.052, 0.024) * horizonBand;
    // Glow scattered around the body; sharpness tracks its angular size so a
    // half-degree Moon gets a tight halo and a 20-degree giant a broad one.
    float facing = clamp(dot(dir, uBodyDir), 0.0, 1.0);
    float glow = pow(facing, uGlowPow) * 0.9
      + pow(facing, max(uGlowPow * 0.12, 6.0)) * 0.18;
    sky += uGlowColor * glow * uGlowStrength;
    // Whole-sky lift when the body is very bright.
    sky += uGlowColor * uAmbientLift;
    gl_FragColor = vec4(sky, 1.0);
  }
`

const textureCache = new Map<string, THREE.Texture>()

function loadBodyTexture(file: string, onLoad: (texture: THREE.Texture) => void) {
  const cached = textureCache.get(file)
  if (cached) {
    onLoad(cached)
    return
  }
  new THREE.TextureLoader().load(`${SOLAR_BASE_URL}${file}`, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    textureCache.set(file, texture)
    onLoad(texture)
  })
}

function formatAngularSize(deg: number) {
  if (deg >= 180) return 'fills the sky'
  if (deg >= 1) return `${deg.toFixed(1)}°`
  const arcmin = deg * 60
  if (arcmin >= 1) return `${arcmin.toFixed(1)}′`
  return `${(arcmin * 60).toFixed(0)}″`
}

function formatBrightness(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000)}k×`
  if (value >= 100) return `${Math.round(value)}×`
  if (value >= 10) return `${value.toFixed(0)}×`
  return `${value.toFixed(1)}×`
}

function formatDistance(km: number) {
  return `${new Intl.NumberFormat('en-US').format(Math.round(km))} km`
}

export default function PlanetSkyView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const paramsRef = useRef<SkyParams>({
    bodyId: DEFAULT_SKY_BODY_ID,
    distanceKm: MOON_DISTANCE_KM,
    phaseAngleDeg: 0,
    altitudeDeg: 26,
  })

  const [bodyId, setBodyId] = useState(DEFAULT_SKY_BODY_ID)
  const [distanceLog, setDistanceLog] = useState(0)
  const [phaseAngleDeg, setPhaseAngleDeg] = useState(0)
  const [altitudeDeg, setAltitudeDeg] = useState(26)
  const [fovDeg, setFovDeg] = useState(DEFAULT_FOV)
  const [webglFailed, setWebglFailed] = useState(false)

  const body = useMemo(
    () => SKY_BODIES.find((entry) => entry.id === bodyId) ?? SKY_BODIES[0],
    [bodyId]
  )
  const distanceKm = useMemo(
    () => MOON_DISTANCE_KM * 2 ** distanceLog,
    [distanceLog]
  )
  const angularDeg = useMemo(
    () => angularDiameterDeg(body.diameterKm, distanceKm),
    [body, distanceKm]
  )
  const moonAngularDeg = angularDiameterDeg(MOON_DIAMETER_KM, MOON_DISTANCE_KM)
  const vsMoon = angularDeg / moonAngularDeg
  const brightness = useMemo(
    () => brightnessVsFullMoon(body, distanceKm),
    [body, distanceKm]
  )
  const insideBody = distanceKm <= body.diameterKm / 2
  const illuminatedShare = (1 + Math.cos(phaseAngleDeg * DEG)) / 2

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setWebglFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight, false)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.domElement.className = 'planet-sky-canvas'
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      DEFAULT_FOV,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.05,
      42000
    )
    camera.position.set(0, CAMERA_HEIGHT, 0)
    camera.rotation.order = 'YXZ'
    camera.rotation.x = 14 * DEG

    // --- Sky dome -----------------------------------------------------------
    const skyUniforms = {
      uZenith: { value: new THREE.Color(0x020409) },
      uHorizon: { value: new THREE.Color(0x0a1526) },
      uGlowColor: { value: new THREE.Color(0xbfd2e8) },
      uBodyDir: { value: new THREE.Vector3(0, 0.45, -0.9).normalize() },
      uGlowStrength: { value: 0.5 },
      uGlowPow: { value: 90 },
      uAmbientLift: { value: 0.0 },
    }
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
    })
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_DOME_RADIUS, 48, 32),
      skyMaterial
    )
    scene.add(sky)

    // --- Stars --------------------------------------------------------------
    const starRand = mulberry(88123)
    const makeStars = (count: number, size: number, opacity: number) => {
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i += 1) {
        const u = starRand() * 2 - 1
        const theta = starRand() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        positions[i * 3] = r * Math.cos(theta) * STAR_DOME_RADIUS
        positions[i * 3 + 1] = Math.abs(u) * STAR_DOME_RADIUS * 0.98 + 40
        positions[i * 3 + 2] = r * Math.sin(theta) * STAR_DOME_RADIUS
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({
        color: 0xdde6f2,
        size,
        sizeAttenuation: false,
        transparent: true,
        opacity,
        depthWrite: false,
      })
      const points = new THREE.Points(geometry, material)
      scene.add(points)
      return points
    }
    const starsFaint = makeStars(2200, 1.0, 0.5)
    const starsBright = makeStars(260, 1.9, 0.85)

    // --- Foreground silhouette ---------------------------------------------
    const silhouetteTexture = createSilhouetteTexture()
    const silhouette = new THREE.Mesh(
      new THREE.CylinderGeometry(120, 120, 24, 160, 1, true),
      new THREE.MeshBasicMaterial({
        map: silhouetteTexture ?? undefined,
        color: silhouetteTexture ? 0xffffff : 0x04070c,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: true,
      })
    )
    // Spans y −6…18, putting the texture's skyline base ~1 unit below eye
    // level so rooftops rise only a few degrees above the horizon.
    silhouette.position.y = 6
    scene.add(silhouette)

    // --- Ground -------------------------------------------------------------
    // A real ground disc out to the silhouette cylinder; together they occlude
    // everything below the horizon (previously the sky dome — or the Sun's
    // surface — showed through when looking down).
    const groundTexture = createGroundTexture()
    const groundMaterial = new THREE.MeshBasicMaterial({
      map: groundTexture ?? undefined,
      color: groundTexture ? 0xffffff : 0x05070c,
    })
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(120, 96),
      groundMaterial
    )
    ground.rotation.x = -90 * DEG
    scene.add(ground)

    // --- Lights -------------------------------------------------------------
    const sunLight = new THREE.DirectionalLight(0xfff3e0, 6.0)
    scene.add(sunLight)
    scene.add(sunLight.target)
    const fillLight = new THREE.AmbientLight(0x3a4a63, 0.055)
    scene.add(fillLight)

    // --- Celestial body -----------------------------------------------------
    const bodyGroup = new THREE.Group()
    scene.add(bodyGroup)
    const glowTexture = createGlowTexture()
    const glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture ?? undefined,
        color: 0xcfe0f5,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    scene.add(glowSprite)

    let bodyMesh: THREE.Mesh | null = null
    let ringMesh: THREE.Mesh | null = null
    let spinGroup: THREE.Group | null = null
    let activeBody: SkyBody =
      SKY_BODIES.find((entry) => entry.id === paramsRef.current.bodyId) ??
      SKY_BODIES[0]

    const clearBody = () => {
      if (bodyMesh) {
        bodyMesh.geometry.dispose()
        ;(bodyMesh.material as THREE.Material).dispose()
      }
      if (ringMesh) {
        ringMesh.geometry.dispose()
        ;(ringMesh.material as THREE.Material).dispose()
      }
      bodyGroup.clear()
      bodyMesh = null
      ringMesh = null
      spinGroup = null
    }

    const setBodyMesh = (nextBody: SkyBody) => {
      clearBody()
      activeBody = nextBody
      const radiusUnits = nextBody.diameterKm / 2 / KM_PER_UNIT
      const material = nextBody.selfLuminous
        ? new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1,
            metalness: 0,
          })
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radiusUnits, 96, 64),
        material
      )
      const spin = new THREE.Group()
      spin.add(mesh)
      loadBodyTexture(nextBody.texture, (texture) => {
        if (activeBody.id !== nextBody.id) return
        if (material instanceof THREE.MeshBasicMaterial) {
          material.map = texture
        } else {
          ;(material as THREE.MeshStandardMaterial).map = texture
        }
        material.needsUpdate = true
      })
      if (nextBody.rings) {
        const inner = nextBody.rings.innerKm / KM_PER_UNIT
        const outer = nextBody.rings.outerKm / KM_PER_UNIT
        const ringGeometry = new THREE.RingGeometry(inner, outer, 256, 1)
        const pos = ringGeometry.attributes.position
        const uv = ringGeometry.attributes.uv
        const vec = new THREE.Vector3()
        for (let i = 0; i < pos.count; i += 1) {
          vec.fromBufferAttribute(pos, i)
          const t = (vec.length() - inner) / (outer - inner)
          uv.setXY(i, t, 0.5)
        }
        const ringTexture = createRingTexture()
        ringMesh = new THREE.Mesh(
          ringGeometry,
          new THREE.MeshStandardMaterial({
            map: ringTexture ?? undefined,
            color: 0xffffff,
            roughness: 1,
            metalness: 0,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
        ringMesh.rotation.x = 90 * DEG
        spin.add(ringMesh)
      }
      spin.rotation.z = -nextBody.tiltDeg * DEG
      bodyGroup.add(spin)
      bodyMesh = mesh
      spinGroup = spin
      applyParams()
      // Re-center the view on the new body so it is never off-screen.
      yaw = 0
      pitch = THREE.MathUtils.clamp(
        (paramsRef.current.altitudeDeg - 6) * DEG,
        -6 * DEG,
        84 * DEG
      )
      yawVelocity = 0
      pitchVelocity = 0
    }

    const bodyDir = new THREE.Vector3()
    const toCamera = new THREE.Vector3()
    const sideways = new THREE.Vector3()
    const sunDir = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)

    const applyParams = () => {
      const params = paramsRef.current
      const distUnits = params.distanceKm / KM_PER_UNIT
      const altRad = params.altitudeDeg * DEG
      bodyDir.set(0, Math.sin(altRad), -Math.cos(altRad))
      bodyGroup.position.copy(bodyDir).multiplyScalar(distUnits)
      bodyGroup.position.y += CAMERA_HEIGHT

      toCamera.copy(bodyDir).negate()
      sideways.crossVectors(up, toCamera).normalize()
      const alpha = params.phaseAngleDeg * DEG
      sunDir
        .copy(toCamera)
        .multiplyScalar(Math.cos(alpha))
        .addScaledVector(sideways, Math.sin(alpha))
        .normalize()
      sunLight.position
        .copy(bodyGroup.position)
        .addScaledVector(sunDir, distUnits * 4)
      sunLight.target.position.copy(bodyGroup.position)
      // Normalize exposure per body: bright cloud textures (Venus, the gas
      // giants) blow out to a white disk under the light level the dark lunar
      // surface needs, so scale the light down as albedo goes up.
      sunLight.intensity = activeBody.selfLuminous
        ? 0
        : 6.0 * Math.min(1, Math.sqrt(0.12 / activeBody.albedo))

      const bright = brightnessVsFullMoon(activeBody, params.distanceKm)
      const phaseFactor = activeBody.selfLuminous
        ? 1
        : 0.12 + 0.88 * (1 + Math.cos(alpha)) / 2
      const glowStrength = Math.min(
        1.7,
        (0.22 + 0.2 * Math.log10(1 + bright)) * phaseFactor
      )
      const ambientLift = Math.min(
        0.055,
        0.004 * Math.log10(1 + bright) * phaseFactor * 4
      )
      skyUniforms.uBodyDir.value.copy(bodyDir)
      skyUniforms.uGlowStrength.value = glowStrength
      const angular = angularDiameterDeg(
        activeBody.diameterKm,
        params.distanceKm
      )
      skyUniforms.uGlowPow.value = THREE.MathUtils.clamp(
        550 / Math.max(angular, 0.2),
        14,
        2400
      )
      skyUniforms.uAmbientLift.value = ambientLift
      const glowColor = new THREE.Color(
        activeBody.selfLuminous ? '#ffcf9a' : activeBody.color
      ).lerp(new THREE.Color(0xffffff), 0.45)
      skyUniforms.uGlowColor.value.copy(glowColor)

      glowSprite.position.copy(bodyGroup.position)
      const radiusUnits = activeBody.diameterKm / 2 / KM_PER_UNIT
      const glowScale = radiusUnits * (activeBody.selfLuminous ? 5.4 : 2.4)
      glowSprite.scale.set(glowScale, glowScale, 1)
      const spriteMaterial = glowSprite.material as THREE.SpriteMaterial
      spriteMaterial.color = glowColor
      spriteMaterial.opacity = activeBody.selfLuminous
        ? 0.85
        : Math.min(0.5, 0.16 + 0.1 * Math.log10(1 + bright)) * phaseFactor
      glowSprite.visible = params.distanceKm > activeBody.diameterKm / 2

      // The ground picks up the body's light: brighter and tinted toward the
      // glow color as the body gets brighter, like moonlit (or Jupiter-lit)
      // grass.
      const groundGain = Math.min(
        2.2,
        0.85 + 0.35 * Math.log10(1 + bright) * phaseFactor
      )
      groundMaterial.color
        .set(0xffffff)
        .lerp(glowColor, 0.3)
        .multiplyScalar(groundGain)

      fillLight.intensity = 0.045 + Math.min(0.12, 0.02 * Math.log10(1 + bright))
    }

    // --- Look controls ------------------------------------------------------
    let yaw = 0
    let pitch = 14 * DEG
    let yawVelocity = 0
    let pitchVelocity = 0
    const activePointers = new Map<number, { x: number; y: number }>()
    let pinchDistance = 0
    let lastMove = { x: 0, y: 0 }

    const dom = renderer.domElement
    dom.style.touchAction = 'none'

    const onPointerDown = (event: PointerEvent) => {
      dom.setPointerCapture(event.pointerId)
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      lastMove = { x: event.clientX, y: event.clientY }
      yawVelocity = 0
      pitchVelocity = 0
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!activePointers.has(event.pointerId)) return
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()]
        const nextDistance = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDistance > 0) {
          camera.fov = THREE.MathUtils.clamp(
            camera.fov * (pinchDistance / nextDistance),
            MIN_FOV,
            MAX_FOV
          )
          camera.updateProjectionMatrix()
          setFovDeg(Math.round(camera.fov))
          if (nextDistance > pinchDistance) {
            easeViewTowardBody()
          }
        }
        pinchDistance = nextDistance
        return
      }
      const dx = event.clientX - lastMove.x
      const dy = event.clientY - lastMove.y
      lastMove = { x: event.clientX, y: event.clientY }
      const speed = 0.0026 * (camera.fov / DEFAULT_FOV)
      yaw -= dx * speed
      pitch += dy * speed
      pitch = THREE.MathUtils.clamp(pitch, -6 * DEG, 84 * DEG)
      yawVelocity = -dx * speed
      pitchVelocity = dy * speed
    }
    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId)
      pinchDistance = 0
    }
    // While zooming in, ease the view toward the body so it never slides out
    // of a narrow (binocular) field of view.
    const easeViewTowardBody = () => {
      const targetPitch = paramsRef.current.altitudeDeg * DEG
      const blend = 0.2
      yaw += (0 - yaw) * blend
      pitch += (targetPitch - pitch) * blend
      yawVelocity = 0
      pitchVelocity = 0
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      // Scale the step with the current FOV so zooming stays smooth down at
      // binocular magnifications.
      const step = event.deltaY * 0.02 * Math.max(0.25, camera.fov / DEFAULT_FOV)
      camera.fov = THREE.MathUtils.clamp(camera.fov + step, MIN_FOV, MAX_FOV)
      camera.updateProjectionMatrix()
      setFovDeg(Math.round(camera.fov))
      if (step < 0) {
        easeViewTowardBody()
      }
    }
    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('pointercancel', onPointerUp)
    dom.addEventListener('wheel', onWheel, { passive: false })

    // --- Resize -------------------------------------------------------------
    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth
      const height = Math.max(1, container.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(container)

    // --- Render loop --------------------------------------------------------
    let lastFrameTime = performance.now()
    let frameId = 0
    const renderLoop = () => {
      frameId = window.requestAnimationFrame(renderLoop)
      const now = performance.now()
      const delta = Math.min((now - lastFrameTime) / 1000, 0.1)
      lastFrameTime = now
      if (activePointers.size === 0) {
        yaw += yawVelocity
        pitch = THREE.MathUtils.clamp(
          pitch + pitchVelocity,
          -6 * DEG,
          84 * DEG
        )
        yawVelocity *= 0.92
        pitchVelocity *= 0.92
      }
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      if (spinGroup && bodyMesh) {
        bodyMesh.rotation.y += delta * 0.012
      }
      renderer.render(scene, camera)
    }
    renderLoop()

    setBodyMesh(activeBody)

    apiRef.current = {
      setBodyMesh,
      applyParams,
      dispose: () => undefined,
    }

    return () => {
      apiRef.current = null
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('pointercancel', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
      clearBody()
      sky.geometry.dispose()
      skyMaterial.dispose()
      for (const stars of [starsFaint, starsBright]) {
        stars.geometry.dispose()
        ;(stars.material as THREE.Material).dispose()
      }
      silhouette.geometry.dispose()
      ;(silhouette.material as THREE.Material).dispose()
      silhouetteTexture?.dispose()
      ground.geometry.dispose()
      groundMaterial.dispose()
      groundTexture?.dispose()
      glowTexture?.dispose()
      ;(glowSprite.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // The scene is built once; parameter changes flow through apiRef.
  }, [])

  useEffect(() => {
    paramsRef.current = { bodyId, distanceKm, phaseAngleDeg, altitudeDeg }
    apiRef.current?.applyParams()
  }, [bodyId, distanceKm, phaseAngleDeg, altitudeDeg])

  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    api.setBodyMesh(body)
  }, [body])

  if (webglFailed) {
    return (
      <main className="planet-sky-layout">
        <section className="planet-sky-stage">
          <div className="panel-empty">
            This simulator needs WebGL, which your browser could not start. The
            guide below still explains what each planet would look like in place
            of the Moon.
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="planet-sky-layout">
      <section className="planet-sky-stage" aria-label="Night sky simulator">
        <div ref={containerRef} className="planet-sky-viewport">
          <div className="planet-sky-hud">
            <span className="planet-sky-hud-name">
              <MoonStar size={14} aria-hidden="true" />
              {body.name}
            </span>
            <span className="planet-sky-hud-size">
              {formatAngularSize(angularDeg)}
              {angularDeg < 180 && (
                <small>
                  {' '}
                  · {vsMoon >= 0.99 && vsMoon <= 1.01
                    ? 'our full Moon'
                    : `${vsMoon.toFixed(vsMoon >= 10 ? 0 : 1)}× the full Moon`}
                </small>
              )}
            </span>
            <span className="planet-sky-hud-fov">
              {fovDeg}° camera FOV · {describeFov(fovDeg)}
            </span>
          </div>
          {insideBody && (
            <div className="planet-sky-warning" role="status">
              At this distance the {body.name}&apos;s surface is beyond Earth —
              you are looking around from <em>inside</em> it. Drag the distance
              slider right to back away.
            </div>
          )}
          <div className="planet-sky-hint" aria-hidden="true">
            <Move3d size={14} /> Drag to look around · scroll or pinch to zoom
          </div>
        </div>
      </section>

      <section className="planet-sky-panel" aria-label="Simulator controls">
        <div className="planet-sky-picker" role="group" aria-label="Choose a body">
          {SKY_BODIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`planet-sky-chip ${entry.id === bodyId ? 'is-active' : ''}`}
              aria-pressed={entry.id === bodyId}
              onClick={() => setBodyId(entry.id)}
            >
              <span
                className="planet-sky-chip-orb"
                style={{
                  backgroundColor: entry.color,
                  backgroundImage: `url(${SOLAR_BASE_URL}${entry.texture})`,
                }}
                aria-hidden="true"
              />
              {entry.name}
            </button>
          ))}
        </div>

        <p className="planet-sky-blurb">
          <Info size={14} aria-hidden="true" /> {body.blurb}
        </p>

        <div className="planet-sky-controls">
          <div className="planet-sky-control">
            <label htmlFor="planet-sky-distance">
              <span>
                <Ruler size={14} /> Distance
              </span>
              <strong>
                {(distanceKm / MOON_DISTANCE_KM).toFixed(2)}× Moon
              </strong>
            </label>
            <input
              id="planet-sky-distance"
              type="range"
              min="-2"
              max="4"
              step="0.05"
              value={distanceLog}
              onChange={(event) => setDistanceLog(Number(event.target.value))}
            />
            <div className="planet-sky-slider-scale">
              <span>0.25×</span>
              <span>Moon distance</span>
              <span>16×</span>
            </div>
          </div>

          <div className="planet-sky-control">
            <label htmlFor="planet-sky-phase">
              <span>
                <Sparkles size={14} /> Phase
              </span>
              <strong>
                {body.selfLuminous
                  ? 'self-luminous'
                  : `${Math.round(illuminatedShare * 100)}% lit`}
              </strong>
            </label>
            <input
              id="planet-sky-phase"
              type="range"
              min="0"
              max="165"
              step="1"
              value={phaseAngleDeg}
              disabled={Boolean(body.selfLuminous)}
              onChange={(event) => setPhaseAngleDeg(Number(event.target.value))}
            />
            <div className="planet-sky-slider-scale">
              <span>Full</span>
              <span>Half</span>
              <span>Crescent</span>
            </div>
          </div>

          <div className="planet-sky-control">
            <label htmlFor="planet-sky-altitude">
              <span>
                <Mountain size={14} /> Height in sky
              </span>
              <strong>{altitudeDeg}°</strong>
            </label>
            <input
              id="planet-sky-altitude"
              type="range"
              min="6"
              max="70"
              step="1"
              value={altitudeDeg}
              onChange={(event) => setAltitudeDeg(Number(event.target.value))}
            />
            <div className="planet-sky-slider-scale">
              <span>Horizon</span>
              <span></span>
              <span>Overhead</span>
            </div>
          </div>
        </div>

        <div className="planet-sky-stats" aria-label={`${body.name} sky facts`}>
          <div className="planet-sky-stat">
            <span>Angular size</span>
            <strong>{formatAngularSize(angularDeg)}</strong>
            <small>
              {angularDeg >= 180
                ? 'surface surrounds Earth'
                : `full Moon is ${formatAngularSize(moonAngularDeg)}`}
            </small>
          </div>
          <div className="planet-sky-stat">
            <span>Vs full Moon</span>
            <strong>
              {angularDeg >= 180 ? '—' : `${vsMoon.toFixed(vsMoon >= 10 ? 0 : 2)}×`}
            </strong>
            <small>apparent diameter</small>
          </div>
          <div className="planet-sky-stat">
            <span>Distance</span>
            <strong>{formatDistance(distanceKm)}</strong>
            <small>center to center</small>
          </div>
          <div className="planet-sky-stat">
            <span>Night brightness</span>
            <strong>
              {body.selfLuminous ? 'daylight' : formatBrightness(brightness * ((1 + Math.cos(phaseAngleDeg * DEG)) / 2))}
            </strong>
            <small>
              {body.selfLuminous ? 'it is the Sun' : 'vs tonight’s full Moon'}
            </small>
          </div>
        </div>
      </section>

      <p className="planet-sky-method-note">
        Every body is rendered at its true angular diameter for the chosen
        distance — 2·asin(radius ÷ distance), the exact limb angle of a sphere
        — using NASA fact-sheet diameters
        and the Moon&apos;s mean distance of 384,400 km. Brightness is an
        area-times-albedo estimate, and Saturn&apos;s rings span the real
        140,220 km of the A–C ring system.
      </p>
    </main>
  )
}
