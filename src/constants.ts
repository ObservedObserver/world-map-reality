import type { Vec3 } from './types'

export const WORLD_TOPO_URL = `${import.meta.env.BASE_URL}data/countries-110m.json`
export const WORLD_NAMES_URL = `${import.meta.env.BASE_URL}data/countries-110m.tsv`
export const SOLAR_BASE_URL = `${import.meta.env.BASE_URL}solar/`

export const MAP_WIDTH = 1100
export const MAP_HEIGHT = 650
export const MAP_PADDING = 40

export const GLOBE_SIZE = 680
export const GLOBE_PADDING = 28
export const GLOBE_DEFAULT_ROTATION: Vec3 = [-20, -10, 0]
export const GLOBE_DRAG_SENSITIVITY = 0.25
export const MAX_GLOBE_TILT = 80

export const PLANET_PREVIEW_SIZE = 260
export const PLANET_PADDING = 16
export const PLANET_BASE_RADIUS = PLANET_PREVIEW_SIZE / 2 - PLANET_PADDING
export const PLANET_DEFAULT_ROTATION: Vec3 = [-28, -12, 0]
export const PLANET_ZOOM_MIN = 0.6
export const PLANET_ZOOM_MAX = 2.4
export const PLANET_ZOOM_STEP = 0.18

export const MAX_LATITUDE = 89.9
