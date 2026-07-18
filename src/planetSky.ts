export const MOON_DISTANCE_KM = 384400
export const MOON_DIAMETER_KM = 3474.8

export type SkyBody = {
  id: string
  name: string
  diameterKm: number
  /** Geometric albedo, used to scale how brightly the body lights the night. */
  albedo: number
  texture: string
  /** Fallback UI color while the texture is loading. */
  color: string
  /** True for bodies that emit their own light (no phases). */
  selfLuminous?: boolean
  /** Ring system, radii expressed in km from the body center. */
  rings?: { innerKm: number; outerKm: number }
  /** Axial tilt used for presentation, degrees. */
  tiltDeg: number
  blurb: string
}

export const SKY_BODIES: SkyBody[] = [
  {
    id: 'moon',
    name: 'Moon',
    diameterKm: MOON_DIAMETER_KM,
    albedo: 0.12,
    texture: '2k_moon.jpg',
    color: '#c2c5cc',
    tiltDeg: 6.7,
    blurb: 'Our actual night sky. The full Moon spans about half a degree.',
  },
  {
    id: 'mercury',
    name: 'Mercury',
    diameterKm: 4879,
    albedo: 0.14,
    texture: '2k_mercury.jpg',
    color: '#b0a6a0',
    tiltDeg: 0.03,
    blurb: 'Slightly larger than the Moon, and nearly the same cratered gray.',
  },
  {
    id: 'venus',
    name: 'Venus',
    diameterKm: 12104,
    albedo: 0.69,
    texture: '2k_venus_atmosphere.jpg',
    color: '#d8b365',
    tiltDeg: 2.6,
    blurb: 'A blinding white lamp: high clouds reflect most of the sunlight.',
  },
  {
    id: 'earth',
    name: 'Earth',
    diameterKm: 12742,
    albedo: 0.43,
    texture: '2k_earth_daymap.jpg',
    color: '#2f8edb',
    tiltDeg: 23.4,
    blurb: 'The view the Apollo crews had — nearly 4 Moons wide, blue and bright.',
  },
  {
    id: 'mars',
    name: 'Mars',
    diameterKm: 6779,
    albedo: 0.17,
    texture: '2k_mars.jpg',
    color: '#c76b3a',
    tiltDeg: 25.2,
    blurb: 'A rust-red disk about twice the width of the full Moon.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    diameterKm: 142984,
    albedo: 0.52,
    texture: '2k_jupiter.jpg',
    color: '#d7a77a',
    tiltDeg: 3.1,
    blurb: 'A banded giant covering more than 40 Moon-widths of sky, bright enough to read by.',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    diameterKm: 120536,
    albedo: 0.47,
    texture: '2k_saturn.jpg',
    color: '#d9c28a',
    rings: { innerKm: 74500, outerKm: 140220 },
    tiltDeg: 26.7,
    blurb: 'The rings alone would stretch across more than 40 degrees of sky.',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    diameterKm: 51118,
    albedo: 0.49,
    texture: '2k_uranus.jpg',
    color: '#78c7d8',
    tiltDeg: 82,
    blurb: 'A pale cyan globe 14 times wider than the full Moon.',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    diameterKm: 49528,
    albedo: 0.44,
    texture: '2k_neptune.jpg',
    color: '#4b6cb7',
    tiltDeg: 28.3,
    blurb: 'Deep azure, with the same striking size as Uranus.',
  },
  {
    id: 'sun',
    name: 'Sun',
    diameterKm: 1391400,
    albedo: 1,
    texture: '2k_sun.jpg',
    color: '#ffb347',
    selfLuminous: true,
    tiltDeg: 7.25,
    blurb: 'Its radius is almost twice the Moon’s distance — Earth would be inside it.',
  },
]

export const DEFAULT_SKY_BODY_ID = 'moon'

/**
 * Full angular diameter (degrees) of a sphere seen from a center-to-center
 * distance. A sphere's visible limb is where sight lines are tangent to it,
 * so it subtends 2·asin(R/D) — not the flat-disc formula 2·atan(R/D). The
 * difference is negligible for the Moon but large for giants pulled close
 * (Jupiter at 0.25× lunar distance: 96° vs 73°).
 */
export function angularDiameterDeg(diameterKm: number, distanceKm: number) {
  const ratio = diameterKm / 2 / distanceKm
  if (ratio >= 1) {
    return 180
  }
  return (2 * Math.asin(ratio) * 180) / Math.PI
}

/**
 * Rough night-sky illumination relative to the full Moon: apparent disk area
 * scaled by geometric albedo (all bodies imagined near 1 au from the Sun).
 */
export function brightnessVsFullMoon(body: SkyBody, distanceKm: number) {
  const moonAng = angularDiameterDeg(MOON_DIAMETER_KM, MOON_DISTANCE_KM)
  const bodyAng = angularDiameterDeg(body.diameterKm, distanceKm)
  const areaRatio = (bodyAng / moonAng) ** 2
  if (body.selfLuminous) {
    return areaRatio * 400000
  }
  return areaRatio * (body.albedo / 0.12)
}
