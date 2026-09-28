export const DEFAULT_SEA_LEVEL_METERS = 0
export const MIN_SEA_LEVEL_METERS = -5000
export const MAX_SEA_LEVEL_METERS = 5000

export type MapViewMode = '2d' | '3d'
export type SeaLevelSettings = { height: number; mode: MapViewMode }

export function readSeaLevelSettings(
  params: Pick<URLSearchParams, 'get'>,
): SeaLevelSettings {
  const rawHeight = params.get('height')?.trim() ?? ''
  const height = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawHeight)
    ? Number(rawHeight)
    : NaN
  return {
    height: Number.isFinite(height)
      ? Math.round(Math.max(MIN_SEA_LEVEL_METERS, Math.min(MAX_SEA_LEVEL_METERS, height)))
      : DEFAULT_SEA_LEVEL_METERS,
    mode: params.get('mode')?.toLowerCase() === '3d' ? '3d' : '2d',
  }
}

export function buildSeaLevelShareUrl(href: string, settings: SeaLevelSettings) {
  const url = new URL(href)
  url.searchParams.set('height', String(settings.height))
  url.searchParams.set('mode', settings.mode)
  return url.href
}
