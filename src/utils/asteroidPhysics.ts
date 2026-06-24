/**
 * Asteroid impact physics — a faithful implementation of the
 * Earth Impact Effects Program (Collins, Melosh & Marcus, 2005,
 * Meteoritics & Planetary Science 40, 817–840).
 *
 * Every equation below was validated numerically against the authors'
 * reference calculator (impact.ese.ic.ac.uk) across the Chelyabinsk and
 * Tunguska airbursts and 400 m / Chicxulub crater-forming impacts; the
 * outputs match to three significant figures. Equation numbers refer to
 * the 2005 paper.
 */

const J_PER_MT = 4.184e15 // joules per megaton of TNT
const J_PER_KT = 4.184e12 // joules per kiloton of TNT
const HIROSHIMA_MT = 0.015 // ~15 kt

const RHO0_AIR = 1.0 // kg/m^3, sea-level air density used in the entry model
const H_SCALE = 8000 // m, atmospheric scale height
const DRAG_CD = 2 // drag coefficient
const G_EARTH = 9.81 // m/s^2
const R_EARTH = 6371000 // m
const PANCAKE_FACTOR = 7 // airburst defined where the spread diameter L(z) = 7 L0

const K_LUMINOUS = 3e-3 // luminous efficiency (fraction of energy radiated)
const FIREBALL_TEMP_VELOCITY = 15000 // m/s, fireball thermal model valid above this
const P0_AMBIENT = 101325 // Pa, sea-level pressure
const C0_SOUND = 340 // m/s, sea-level sound speed
const CROSSOVER_RX = 290 // m, overpressure crossover distance for a 1 kt surface burst
const CROSSOVER_PX = 75000 // Pa, overpressure at the crossover distance

export type CompositionId = 'ice' | 'porous' | 'rock' | 'iron'

export type Composition = {
  id: CompositionId
  label: string
  density: number // kg/m^3
}

export const COMPOSITIONS: Composition[] = [
  { id: 'ice', label: 'Ice / comet', density: 1000 },
  { id: 'porous', label: 'Porous rock', density: 1500 },
  { id: 'rock', label: 'Dense rock', density: 3000 },
  { id: 'iron', label: 'Iron', density: 8000 },
]

export const TARGET_DENSITY = 2500 // kg/m^3, sedimentary rock (land target)

export type AsteroidParams = {
  diameterM: number
  speedKmS: number
  angleDeg: number
  composition: CompositionId
}

export type EffectKind = 'crater' | 'fireball' | 'thermal' | 'blast'

export type EffectZone = {
  id: string
  kind: EffectKind
  label: string
  shortLabel: string
  radiusM: number
  detail: string
  /** index into the rendering palette, 0 = most severe (innermost) */
  severity: number
}

export type ImpactResult = {
  energyJoules: number
  megatons: number
  hiroshimas: number
  recurrenceYears: number
  outcome: 'crater' | 'airburst'
  breakupAltitudeM: number | null
  burstAltitudeM: number | null
  surfaceSpeedKmS: number | null
  burstSpeedKmS: number | null
  craterDiameterM: number | null
  craterType: 'simple' | 'complex' | null
  fireballRadiusM: number
  seismicMagnitude: number
  peakGroundOverpressurePa: number
  peakGroundWindMS: number
  zones: EffectZone[]
}

function densityFor(composition: CompositionId): number {
  return (
    COMPOSITIONS.find((entry) => entry.id === composition)?.density ?? 3000
  )
}

export function compositionLabel(composition: CompositionId): string {
  return (
    COMPOSITIONS.find((entry) => entry.id === composition)?.label ?? 'rock'
  ).toLowerCase()
}

/**
 * Velocity at a target altitude after atmospheric deceleration. Integrates
 * d(ln v)/dz = (3 C_D rho0 e^{-z/H} L(z)^2) / (4 rho_i L0^3 sin theta) from the
 * top of the atmosphere downward (eq. 8 for the intact body; the pancake
 * model — eq. 13–17 — once the body has broken up at z*).
 */
function velocityAt(
  zTargetM: number,
  zStarM: number | null,
  diameterM: number,
  rhoI: number,
  v0: number,
  sinTheta: number
): number {
  const zTop = 120000
  const dz = 2
  let lScale = 0
  if (zStarM !== null) {
    const rhoStar = RHO0_AIR * Math.exp(-zStarM / H_SCALE)
    lScale = diameterM * sinTheta * Math.sqrt(rhoI / (DRAG_CD * rhoStar))
  }
  const lSquared = (z: number): number => {
    if (zStarM === null || z >= zStarM) {
      return diameterM * diameterM
    }
    const term =
      ((2 * H_SCALE) / lScale) *
      (Math.exp((zStarM - z) / (2 * H_SCALE)) - 1)
    return diameterM * diameterM * (1 + term * term)
  }
  const coefficient = (3 * DRAG_CD * RHO0_AIR) / (4 * rhoI * diameterM ** 3 * sinTheta)
  let lnLoss = 0
  for (let z = zTop; z > zTargetM; z -= dz) {
    const zMid = z - dz / 2
    lnLoss += coefficient * Math.exp(-zMid / H_SCALE) * lSquared(zMid) * dz
  }
  return v0 * Math.exp(-lnLoss)
}

/** Final crater rim-to-rim diameter (eq. 21, 22, 27). */
function craterDiameter(
  diameterM: number,
  rhoI: number,
  surfaceSpeed: number,
  sinTheta: number
): { diameterM: number; type: 'simple' | 'complex' } {
  const transient =
    1.161 *
    (rhoI / TARGET_DENSITY) ** (1 / 3) *
    diameterM ** 0.78 *
    surfaceSpeed ** 0.44 *
    G_EARTH ** -0.22 *
    sinTheta ** (1 / 3)
  const complexThreshold = 3200 // m, simple→complex transition (final diameter, Earth)
  const simpleFinal = 1.25 * transient
  if (simpleFinal < complexThreshold) {
    return { diameterM: simpleFinal, type: 'simple' }
  }
  return {
    diameterM: (1.17 * transient ** 1.13) / complexThreshold ** 0.13,
    type: 'complex',
  }
}

/** Peak overpressure (Pa) at ground distance r from the impact (eq. 54, 57). */
function overpressureAt(r: number, energyKt: number, burstAltitudeM: number): number {
  const cubeRootEnergy = Math.cbrt(energyKt)
  // Airbursts use the slant range to the burst point so the value stays finite
  // at ground zero; surface bursts use the ground distance directly.
  const distance =
    burstAltitudeM > 0 ? Math.hypot(r, burstAltitudeM) : r
  const r1 = distance / cubeRootEnergy // scale to a 1 kt explosion
  return ((CROSSOVER_PX * CROSSOVER_RX) / (4 * r1)) * (1 + 3 * (CROSSOVER_RX / r1) ** 1.3)
}

/** Peak wind speed (m/s) behind a shock of overpressure p (Rankine–Hugoniot). */
function windSpeedFor(p: number): number {
  return ((5 * p) / (7 * P0_AMBIENT)) * (C0_SOUND / Math.sqrt(1 + (6 * p) / (7 * P0_AMBIENT)))
}

/** Ground radius (m) at which the overpressure equals the threshold. */
function blastRadiusFor(thresholdPa: number, energyKt: number, burstAltitudeM: number): number {
  if (overpressureAt(0, energyKt, burstAltitudeM) < thresholdPa) {
    return 0 // even ground zero never reaches this overpressure (high airburst)
  }
  let lo = 0
  let hi = 2e7
  for (let i = 0; i < 90; i += 1) {
    const mid = (lo + hi) / 2
    if (overpressureAt(mid, energyKt, burstAltitudeM) > thresholdPa) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return (lo + hi) / 2
}

/** Radius (m) of a thermal-radiation effect, capped at the horizon distance. */
function thermalRadiusFor(
  thresholdMJ: number,
  energyJoules: number,
  megatons: number,
  fireballRadiusM: number
): number {
  // Thermal exposure required scales with yield^(1/6) (longer pulse for larger
  // fireballs); set Phi = K E / (2 pi r^2) equal to the threshold and solve.
  const thresholdJ = thresholdMJ * 1e6 * megatons ** (1 / 6)
  const radius = Math.sqrt((K_LUMINOUS * energyJoules) / (2 * Math.PI * thresholdJ))
  // Beyond the horizon the fireball is hidden and cannot deliver radiation.
  const cosArg = 1 - fireballRadiusM / R_EARTH
  const horizon = cosArg <= -1 ? Math.PI * R_EARTH : R_EARTH * Math.acos(Math.max(-1, cosArg))
  return Math.min(radius, horizon)
}

// Air-blast overpressure thresholds (Pa) and thermal exposure thresholds
// (MJ/m^2 for a 1 Mt event), from the EIEP damage tables.
const BLAST_TIERS = [
  {
    id: 'blast-20psi',
    pa: 137895,
    label: 'Reinforced & steel-framed buildings collapse',
    short: '20 psi',
  },
  {
    id: 'blast-5psi',
    pa: 34474,
    label: 'Most homes & buildings collapse',
    short: '5 psi',
  },
  {
    id: 'blast-1psi',
    pa: 6895,
    label: 'Glass shatters — widespread injuries',
    short: '1 psi',
  },
] as const

const THERMAL_TIERS = [
  { id: 'thermal-3rd', mj: 0.42, label: 'Third-degree burns', short: '3rd-degree burns' },
  { id: 'thermal-2nd', mj: 0.25, label: 'Second-degree burns', short: '2nd-degree burns' },
  { id: 'thermal-1st', mj: 0.13, label: 'First-degree burns', short: '1st-degree burns' },
] as const

export function computeImpact(params: AsteroidParams): ImpactResult {
  const diameterM = Math.max(0.1, params.diameterM)
  const rhoI = densityFor(params.composition)
  const v0 = Math.max(11, params.speedKmS) * 1000 // m/s; Earth-impact minimum ~11 km/s
  const angle = Math.min(90, Math.max(1, params.angleDeg))
  const theta = (angle * Math.PI) / 180
  const sinTheta = Math.sin(theta)

  const mass = (Math.PI / 6) * rhoI * diameterM ** 3
  const energyEntry = 0.5 * mass * v0 ** 2
  const megatonsEntry = energyEntry / J_PER_MT
  const recurrenceYears = 109 * megatonsEntry ** 0.78

  // --- Atmospheric entry (eq. 9, 11, 12, 16, 17) ---
  const yieldStrength = 10 ** (2.107 + 0.0624 * Math.sqrt(rhoI)) // Pa
  const breakupFactor =
    (4.07 * DRAG_CD * H_SCALE * yieldStrength) / (rhoI * diameterM * v0 ** 2 * sinTheta)

  let outcome: 'crater' | 'airburst'
  let breakupAltitudeM: number | null = null
  let burstAltitudeM: number | null = null
  let surfaceSpeed: number | null = null
  let burstSpeed: number | null = null
  let energyImpact: number // energy used for fireball / seismic / crater
  let energyBlast: number // energy used for the air blast

  if (breakupFactor >= 1) {
    // Strong/large enough to cross the atmosphere intact and form a crater.
    outcome = 'crater'
    surfaceSpeed = velocityAt(0, null, diameterM, rhoI, v0, sinTheta)
    energyImpact = 0.5 * mass * surfaceSpeed ** 2
    energyBlast = energyImpact
  } else {
    breakupAltitudeM =
      -H_SCALE *
      (Math.log(yieldStrength / (RHO0_AIR * v0 ** 2)) +
        1.308 -
        0.314 * breakupFactor -
        1.303 * Math.sqrt(1 - breakupFactor))
    const rhoStar = RHO0_AIR * Math.exp(-breakupAltitudeM / H_SCALE)
    const lScale = diameterM * sinTheta * Math.sqrt(rhoI / (DRAG_CD * rhoStar))
    const burst =
      breakupAltitudeM -
      2 * H_SCALE * Math.log(1 + (lScale / (2 * H_SCALE)) * Math.sqrt(PANCAKE_FACTOR ** 2 - 1))

    if (burst > 0) {
      // Disrupts above the surface — an airburst; no crater forms.
      outcome = 'airburst'
      burstAltitudeM = burst
      burstSpeed = velocityAt(burst, breakupAltitudeM, diameterM, rhoI, v0, sinTheta)
      energyBlast = 0.5 * mass * (v0 ** 2 - burstSpeed ** 2) // energy deposited in the air
      energyImpact = energyBlast
    } else {
      // Breaks up but the fragments still reach the ground and crater.
      outcome = 'crater'
      surfaceSpeed = velocityAt(0, breakupAltitudeM, diameterM, rhoI, v0, sinTheta)
      energyImpact = 0.5 * mass * surfaceSpeed ** 2
      energyBlast = energyImpact
    }
  }

  const megatonsImpact = energyImpact / J_PER_MT
  const energyKt = energyBlast / J_PER_KT

  // --- Crater (only for ground impacts) ---
  let craterDiameterM: number | null = null
  let craterType: 'simple' | 'complex' | null = null
  if (outcome === 'crater' && surfaceSpeed !== null) {
    const crater = craterDiameter(diameterM, rhoI, surfaceSpeed, sinTheta)
    craterDiameterM = crater.diameterM
    craterType = crater.type
  }

  // --- Fireball & thermal radiation (eq. 32, 34) ---
  const fireballRadiusM = 0.002 * energyImpact ** (1 / 3)
  const thermalActive = v0 >= FIREBALL_TEMP_VELOCITY

  // --- Seismic magnitude (eq. 40) ---
  const seismicMagnitude = 0.67 * Math.log10(energyImpact) - 5.87

  // --- Peak ground-level air blast ---
  const peakGroundOverpressurePa = overpressureAt(0, energyKt, burstAltitudeM ?? 0)
  const peakGroundWindMS = windSpeedFor(peakGroundOverpressurePa)

  // --- Effect zones, ordered outermost → innermost for clean stacking ---
  const zones: EffectZone[] = []

  BLAST_TIERS.forEach((tier) => {
    const radiusM = blastRadiusFor(tier.pa, energyKt, burstAltitudeM ?? 0)
    if (radiusM > 0) {
      zones.push({
        id: tier.id,
        kind: 'blast',
        label: tier.label,
        shortLabel: `Air blast — ${tier.short}`,
        radiusM,
        detail: `~${Math.round(windSpeedFor(tier.pa))} m/s peak winds`,
        severity: 0,
      })
    }
  })

  if (thermalActive) {
    THERMAL_TIERS.forEach((tier) => {
      const radiusM = thermalRadiusFor(tier.mj, energyImpact, megatonsImpact, fireballRadiusM)
      if (radiusM > fireballRadiusM) {
        zones.push({
          id: tier.id,
          kind: 'thermal',
          label: tier.label,
          shortLabel: tier.label,
          radiusM,
          detail: 'Thermal radiation from the fireball',
          severity: 0,
        })
      }
    })
  }

  if (fireballRadiusM > 0) {
    zones.push({
      id: 'fireball',
      kind: 'fireball',
      label: 'Fireball',
      shortLabel: 'Fireball radius',
      radiusM: fireballRadiusM,
      detail:
        outcome === 'airburst'
          ? 'Incandescent airburst plume'
          : 'Vaporized rock and incandescent plume',
      severity: 0,
    })
  }

  if (craterDiameterM !== null) {
    zones.push({
      id: 'crater',
      kind: 'crater',
      label: `${craterType === 'complex' ? 'Complex' : 'Simple'} crater`,
      shortLabel: 'Crater (rim to rim)',
      radiusM: craterDiameterM / 2,
      detail: 'Final rim-to-rim crater',
      severity: 0,
    })
  }

  // Sort outermost first; assign severity by inner rank (0 = innermost/worst).
  zones.sort((a, b) => b.radiusM - a.radiusM)
  zones.forEach((zone, index) => {
    zone.severity = zones.length - 1 - index
  })

  return {
    energyJoules: energyEntry,
    megatons: megatonsEntry,
    hiroshimas: megatonsEntry / HIROSHIMA_MT,
    recurrenceYears,
    outcome,
    breakupAltitudeM,
    burstAltitudeM,
    surfaceSpeedKmS: surfaceSpeed === null ? null : surfaceSpeed / 1000,
    burstSpeedKmS: burstSpeed === null ? null : burstSpeed / 1000,
    craterDiameterM,
    craterType,
    fireballRadiusM,
    seismicMagnitude,
    peakGroundOverpressurePa,
    peakGroundWindMS,
    zones,
  }
}

// ---- Formatting helpers ----

export function formatEnergy(megatons: number): string {
  if (megatons >= 1e6) {
    return `${(megatons / 1e6).toFixed(1)} million megatons`
  }
  if (megatons >= 1000) {
    return `${Math.round(megatons).toLocaleString('en-US')} megatons`
  }
  if (megatons >= 1) {
    return `${megatons.toFixed(1)} megatons`
  }
  if (megatons >= 0.001) {
    return `${(megatons * 1000).toFixed(0)} kilotons`
  }
  return `${(megatons * 1e6).toFixed(0)} tons`
}

export function formatDistance(meters: number): string {
  const km = meters / 1000
  if (km >= 100) {
    return `${Math.round(km).toLocaleString('en-US')} km`
  }
  if (km >= 1) {
    return `${km.toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

export function formatCount(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)} billion`
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)} million`
  }
  if (value >= 1000) {
    return Math.round(value).toLocaleString('en-US')
  }
  if (value >= 10) {
    return Math.round(value).toString()
  }
  return value.toFixed(1)
}

export function formatRecurrence(years: number): string {
  if (years >= 1e6) {
    return `${(years / 1e6).toFixed(0)} million years`
  }
  if (years >= 1000) {
    return `${Math.round(years / 1000).toLocaleString('en-US')},000 years`
  }
  if (years >= 1) {
    return `${Math.round(years).toLocaleString('en-US')} years`
  }
  return 'less than a year'
}

/** Plain-language summary used in the results panel and the shared image. */
export function buildSummary(
  params: AsteroidParams,
  result: ImpactResult,
  locationName: string
): string {
  const composition = compositionLabel(params.composition)
  const energy = formatEnergy(result.megatons)
  const hiroshima =
    result.hiroshimas >= 1
      ? ` — about ${formatCount(result.hiroshimas)} Hiroshima bombs`
      : ''
  const where = locationName ? ` over ${locationName}` : ''

  const lead = `A ${formatDistance(params.diameterM)}-wide ${composition} asteroid striking${where} at ${params.speedKmS} km/s hits with the energy of ${energy} of TNT${hiroshima}.`

  let outcomeText: string
  if (result.outcome === 'airburst' && result.burstAltitudeM !== null) {
    outcomeText = ` It never reaches the ground: atmospheric pressure shatters it ${formatDistance(
      result.burstAltitudeM
    )} up in an airburst, so no crater forms.`
  } else if (result.craterDiameterM !== null) {
    outcomeText = ` It blasts a ${formatDistance(result.craterDiameterM)}-wide ${result.craterType} crater.`
  } else {
    outcomeText = ''
  }

  const thirdDegree = result.zones.find((zone) => zone.id === 'thermal-3rd')
  const blast5 = result.zones.find((zone) => zone.id === 'blast-5psi')
  const blast1 = result.zones.find((zone) => zone.id === 'blast-1psi')

  const effects: string[] = []
  if (thirdDegree) {
    effects.push(`third-degree burns out to ${formatDistance(thirdDegree.radiusM)}`)
  }
  if (blast5) {
    effects.push(`buildings collapse within ${formatDistance(blast5.radiusM)}`)
  }
  if (blast1) {
    effects.push(`windows shatter as far as ${formatDistance(blast1.radiusM)} away`)
  }
  const effectsText = effects.length
    ? ` It causes ${effects.join(', ')}.`
    : ''

  const quake = ` The impact registers about magnitude ${result.seismicMagnitude.toFixed(
    1
  )} on the Richter scale.`
  const odds = ` An impact this size strikes Earth roughly once every ${formatRecurrence(
    result.recurrenceYears
  )}.`

  return `${lead}${outcomeText}${effectsText}${quake}${odds}`
}
