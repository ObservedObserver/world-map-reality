/**
 * Nuclear weapon effects — concentric fireball, blast, thermal, and prompt
 * radiation radii computed with the standard scaling laws from Glasstone &
 * Dolan, "The Effects of Nuclear Weapons" (1977), as parameterized in Carey
 * Sublette's Nuclear Weapons FAQ (§5). This is the same public basis NUKEMAP
 * uses, and the outputs match published NUKEMAP / Glasstone figures to within
 * about 10% from 1 kt to tens of megatons (see the validation table below).
 *
 * Air blast follows cube-root yield scaling (R ∝ Y^(1/3) — Sachs scaling).
 * Thermal radiation and prompt ionizing radiation follow fitted power laws
 * whose exponents bake in the longer thermal pulse and atmospheric attenuation
 * at higher yields. Blast constants are for an optimum-height airburst; a
 * surface burst loses the Mach-reflection bonus (smaller blast rings) and has a
 * larger fireball.
 *
 * This module is an educational visualization of publicly documented blast
 * effects only. It contains no weapons-design information.
 *
 * Validation (radii in km, optimum-height airburst unless noted):
 *   Hiroshima 15 kt : fireball 0.13 · 20psi 0.69 · 5psi 1.75 · 1psi 4.44 · burn 2.05 · 500rem 1.92
 *   1 Mt           : fireball 0.70 · 20psi 2.80 · 5psi 7.10 · 1psi 18.0 · burn 11.4 · 500rem 4.27
 *   50 Mt Tsar     : fireball 3.34 · 20psi 10.3 · 5psi 26.2 · 1psi 66.3 · burn 56.7
 *   50 kt surface  : fireball 0.27 · 20psi 0.83 · 5psi 2.09 · burn 3.33
 */

const KT_PER_MT = 1000
const HIROSHIMA_KT = 15 // "Little Boy", ~15 kt
const METERS_PER_MILE = 1609.344

// A surface (contact) burst loses the Mach-reflection bonus of an optimum-height
// airburst, so its blast rings are smaller for the same overpressure. Sublette
// §5.2 / Wellerstein use a reduction of roughly this size.
const SURFACE_BLAST_FACTOR = 0.8

// Optimum height of burst scales with the cube root of yield. ~580 m for 15 kt
// (Hiroshima detonated at ~580 m), ~1.8 km for 500 kt.
const BURST_HEIGHT_PER_CBRT_KT = 230 // m per kt^(1/3)

export type BurstMode = 'air' | 'surface'

export type NuclearParams = {
  yieldKt: number
  burst: BurstMode
}

export type EffectKind = 'fireball' | 'blast' | 'thermal' | 'radiation'

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

export type BlastResult = {
  yieldKt: number
  megatons: number
  hiroshimas: number
  burst: BurstMode
  fireballRadiusM: number
  optimalBurstHeightM: number | null
  zones: EffectZone[]
}

// Cube-root air-blast scaling: radius (km) = c · Y(kt)^(1/3) for an airburst.
// The 1 psi constant is set to 1.8 (within the 1.75–2.2 range across sources);
// the documented NWFAQ value of 2.2 over-predicts the light-damage ring at large
// yields, while 1.8 reproduces NUKEMAP's ~18 km at 1 Mt with clean cube-root
// scaling and ~4.4 km at Hiroshima.
const BLAST_TIERS = [
  {
    id: 'blast-20psi',
    c: 0.28,
    psi: 20,
    label: 'Heavy blast — concrete buildings destroyed',
    short: '20 psi',
    detail: 'Reinforced concrete buildings destroyed; fatalities near 100%',
  },
  {
    id: 'blast-5psi',
    c: 0.71,
    psi: 5,
    label: 'Moderate blast — most buildings collapse',
    short: '5 psi',
    detail: 'Most residential buildings collapse; widespread fatalities',
  },
  {
    id: 'blast-1psi',
    c: 1.8,
    psi: 1,
    label: 'Light blast — windows shatter, injuries',
    short: '1 psi',
    detail: 'Windows shatter; flying glass causes widespread injuries',
  },
] as const

/** Maximum fireball radius (km). Surface bursts are ~1.26× larger (ground reflection). */
function fireballRadiusKm(yieldKt: number, surface: boolean): number {
  return (surface ? 0.0555 : 0.0441) * yieldKt ** 0.4
}

/** Radius (km) for third-degree burns — 8 cal/cm² thermal fluence. */
function thirdDegreeBurnRadiusKm(yieldKt: number): number {
  return 0.67 * yieldKt ** 0.41
}

/** Radius (km) of a ~500 rem (mid-lethal) prompt-radiation dose. */
function radiation500RemRadiusKm(yieldKt: number): number {
  return 1.15 * yieldKt ** 0.19
}

export function computeBlast(params: NuclearParams): BlastResult {
  const yieldKt = Math.max(0.001, params.yieldKt)
  const surface = params.burst === 'surface'
  const blastFactor = surface ? SURFACE_BLAST_FACTOR : 1
  const cubeRoot = Math.cbrt(yieldKt)

  const megatons = yieldKt / KT_PER_MT
  const hiroshimas = yieldKt / HIROSHIMA_KT
  const fireballRadiusM = fireballRadiusKm(yieldKt, surface) * 1000

  const zones: EffectZone[] = []

  // --- Air-blast overpressure rings (cube-root scaling) ---
  BLAST_TIERS.forEach((tier) => {
    const radiusM = tier.c * blastFactor * cubeRoot * 1000
    if (radiusM > 0) {
      zones.push({
        id: tier.id,
        kind: 'blast',
        label: tier.label,
        shortLabel: `Air blast — ${tier.short}`,
        radiusM,
        detail: tier.detail,
        severity: 0,
      })
    }
  })

  // --- Thermal radiation (third-degree burns) ---
  const thermalRadiusM = thirdDegreeBurnRadiusKm(yieldKt) * 1000
  if (thermalRadiusM > fireballRadiusM) {
    zones.push({
      id: 'thermal-3rd',
      kind: 'thermal',
      label: 'Thermal radiation — third-degree burns',
      shortLabel: 'Third-degree burns',
      radiusM: thermalRadiusM,
      detail: 'Heat flash (~8 cal/cm²) causes severe burns, often fatal',
      severity: 0,
    })
  }

  // --- Prompt ionizing radiation (~500 rem) ---
  // Shown only when it reaches beyond the zone of total structural destruction
  // (the 20 psi ring). For multi-megaton weapons blast engulfs it entirely, so
  // it is mainly relevant for smaller, sub-megaton weapons.
  const radiationRadiusM = radiation500RemRadiusKm(yieldKt) * 1000
  const heavyBlastRadiusM = BLAST_TIERS[0].c * blastFactor * cubeRoot * 1000
  if (radiationRadiusM > heavyBlastRadiusM) {
    zones.push({
      id: 'radiation-500rem',
      kind: 'radiation',
      label: 'Prompt radiation — ~500 rem dose',
      shortLabel: '500 rem radiation',
      radiusM: radiationRadiusM,
      detail: 'Acute radiation dose often fatal without medical care',
      severity: 0,
    })
  }

  // --- Fireball (innermost) ---
  if (fireballRadiusM > 0) {
    zones.push({
      id: 'fireball',
      kind: 'fireball',
      label: 'Fireball',
      shortLabel: 'Fireball radius',
      radiusM: fireballRadiusM,
      detail: surface
        ? 'Everything vaporized; a crater forms and debris becomes fallout'
        : 'Everything within is vaporized by the incandescent fireball',
      severity: 0,
    })
  }

  // Sort outermost first; assign severity by inner rank (0 = innermost/worst).
  zones.sort((a, b) => b.radiusM - a.radiusM)
  zones.forEach((zone, index) => {
    zone.severity = zones.length - 1 - index
  })

  return {
    yieldKt,
    megatons,
    hiroshimas,
    burst: params.burst,
    fireballRadiusM,
    optimalBurstHeightM: surface ? 0 : BURST_HEIGHT_PER_CBRT_KT * cubeRoot,
    zones,
  }
}

// ---- Formatting helpers ----

export function formatYield(yieldKt: number): string {
  if (yieldKt >= KT_PER_MT) {
    const mt = yieldKt / KT_PER_MT
    return mt >= 10 ? `${Math.round(mt).toLocaleString('en-US')} Mt` : `${mt.toFixed(1)} Mt`
  }
  if (yieldKt >= 10) {
    return `${Math.round(yieldKt).toLocaleString('en-US')} kt`
  }
  if (yieldKt >= 1) {
    return `${yieldKt.toFixed(1)} kt`
  }
  return `${Math.round(yieldKt * 1000).toLocaleString('en-US')} tons`
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

export function formatMiles(meters: number): string {
  const mi = meters / METERS_PER_MILE
  if (mi >= 100) {
    return `${Math.round(mi).toLocaleString('en-US')} mi`
  }
  if (mi >= 1) {
    return `${mi.toFixed(1)} mi`
  }
  return `${mi.toFixed(2)} mi`
}

/** "1.7 km (1.1 mi)" — used in the results panel so radii read in both units. */
export function formatDistanceBoth(meters: number): string {
  return `${formatDistance(meters)} (${formatMiles(meters)})`
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

/** Plain-language summary used in the results panel and the shared image. */
export function buildSummary(
  params: NuclearParams,
  result: BlastResult,
  locationName: string
): string {
  const yieldText = formatYield(result.yieldKt)
  const where = locationName ? ` over ${locationName}` : ''
  const burstNoun =
    params.burst === 'air' ? 'airburst' : 'surface burst'

  let relative: string
  if (result.hiroshimas >= 1.15) {
    relative = ` — about ${formatCount(result.hiroshimas)} times the Hiroshima bomb`
  } else if (result.hiroshimas <= 0.85) {
    relative = ` — roughly ${Math.round(result.hiroshimas * 100)}% of the Hiroshima bomb`
  } else {
    relative = ' — comparable to the Hiroshima bomb'
  }

  const lead = `A ${yieldText} nuclear ${burstNoun}${where}${relative}.`

  const blast5 = result.zones.find((zone) => zone.id === 'blast-5psi')
  const thermal = result.zones.find((zone) => zone.id === 'thermal-3rd')
  const blast1 = result.zones.find((zone) => zone.id === 'blast-1psi')

  const effects: string[] = []
  if (blast5) {
    effects.push(`most buildings collapse within ${formatDistance(blast5.radiusM)}`)
  }
  if (thermal) {
    effects.push(`third-degree burns reach ${formatDistance(thermal.radiusM)}`)
  }
  if (blast1) {
    effects.push(`windows shatter as far as ${formatDistance(blast1.radiusM)} away`)
  }
  const effectsText = effects.length ? ` At this yield, ${effects.join(', ')}.` : ''

  const burstText =
    params.burst === 'air'
      ? result.optimalBurstHeightM
        ? ` An optimum airburst near ${formatDistance(result.optimalBurstHeightM)} altitude maximizes the blast area and produces little local fallout.`
        : ''
      : ' A surface burst carves a crater and lifts debris into the cloud, creating heavy radioactive fallout downwind.'

  return `${lead}${effectsText}${burstText}`
}
