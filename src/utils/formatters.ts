export const formatLatitude = (lat: number) => {
  const absolute = Math.abs(lat)
  if (absolute < 0.05) {
    return `${absolute.toFixed(1)}deg`
  }
  const direction = lat >= 0 ? 'N' : 'S'
  return `${absolute.toFixed(1)}deg${direction}`
}

export const formatLongitude = (lon: number) => {
  const absolute = Math.abs(lon)
  if (absolute < 0.05) {
    return `${absolute.toFixed(1)}deg`
  }
  const direction = lon >= 0 ? 'E' : 'W'
  return `${absolute.toFixed(1)}deg${direction}`
}

export const formatPlanetRatio = (ratio: number) =>
  `${ratio.toFixed(ratio >= 1 ? 1 : 2)}x Earth`

export const formatScale = (scale: number) => `${Math.round(scale * 100)}%`

export const getMercatorScale = (originalLat: number, currentLat: number) =>
  Math.cos((originalLat * Math.PI) / 180) /
  Math.cos((currentLat * Math.PI) / 180)
