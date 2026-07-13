export type SunPosition = {
  azimuthDeg: number
  altitudeDeg: number
}

export type AnalemmaPoint = SunPosition & {
  dayIndex: number
  date: Date
  month: number
}

const RAD = Math.PI / 180
const DEG = 180 / Math.PI
const ANALemma_YEAR = 2025

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

// Compact Jean Meeus solar-position approximation. Longitude is east-positive;
// azimuth is north-based clockwise, matching a compass.
export function getSunPosition(
  date: Date | number,
  longitudeDeg: number,
  latitude: number
): SunPosition {
  const timestamp = typeof date === 'number' ? date : date.getTime()
  const { sin, cos, asin, atan2, PI } = Math
  const t = timestamp / 315576e7 - 0.3
  const meanAnomaly =
    RAD * (357.52911 + t * (35999.05029 - t * 0.0001537))
  const node = RAD * (125.04 - 1934.136 * t)
  const eclipticLongitude =
    RAD *
      (280.46646 +
        t * (36000.76983 + t * 0.0003032) +
        (1.914602 - t * (0.004817 - t * 0.000014)) * sin(meanAnomaly) -
        0.00569 -
        0.00478 * sin(node)) +
    (0.019993 - 0.000101 * t) * sin(2 * meanAnomaly) +
    0.000289 * sin(3 * meanAnomaly)
  const obliquity =
    (RAD *
      (84381.448 - t * (46.815 - t * (0.00059 + 0.001813 * t)))) /
      3600 +
    RAD * 0.00256 * cos(node)
  const sinLongitude = sin(eclipticLongitude)
  const cosLatitude = cos(RAD * latitude)
  const sinLatitude = sin(RAD * latitude)
  const declination = asin(sin(obliquity) * sinLongitude)
  const hourAngle =
    RAD * (280.46061837 + 13184999.8983375 * t + longitudeDeg) -
    atan2(cos(obliquity) * sinLongitude, cos(eclipticLongitude))
  const sinDeclination = sin(declination)
  const cosDeclination = cos(declination)
  const cosHourAngle = cos(hourAngle)
  const azimuth =
    PI +
    atan2(
      sin(hourAngle),
      cosHourAngle * sinLatitude -
        (cosLatitude * sinDeclination) / cosDeclination
    )
  const altitude = asin(
    sinLatitude * sinDeclination +
      cosLatitude * cosDeclination * cosHourAngle
  )

  return {
    azimuthDeg: ((azimuth * DEG) % 360 + 360) % 360,
    altitudeDeg: altitude * DEG,
  }
}

export function buildAnalemma(
  longitude: number,
  latitude: number,
  minutesUtc: number,
  stepDays = 1
): AnalemmaPoint[] {
  const hour = Math.floor(minutesUtc / 60)
  const minute = minutesUtc % 60
  const points: AnalemmaPoint[] = []

  for (let dayIndex = 0; dayIndex < 365; dayIndex += stepDays) {
    const date = new Date(
      Date.UTC(ANALemma_YEAR, 0, 1 + dayIndex, hour, minute)
    )
    points.push({
      dayIndex,
      date,
      month: date.getUTCMonth(),
      ...getSunPosition(date, longitude, latitude),
    })
  }

  return points
}

export function getSolarMetrics(dayIndex: number, latitude: number) {
  const gamma = (2 * Math.PI * dayIndex) / 365
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  const declinationRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  const latitudeRad = latitude * RAD
  const cosineHourAngle =
    -Math.tan(latitudeRad) * Math.tan(declinationRad)
  const daylightHours =
    cosineHourAngle >= 1
      ? 0
      : cosineHourAngle <= -1
        ? 24
        : (2 * Math.acos(cosineHourAngle) * DEG) / 15

  return {
    equationOfTime,
    declinationDeg: declinationRad * DEG,
    daylightHours,
  }
}

export function formatUtcTime(minutesUtc: number) {
  const hour = Math.floor(minutesUtc / 60)
  const minute = minutesUtc % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC`
}

export function formatCoordinate(value: number, axis: 'lat' | 'lng') {
  const direction =
    axis === 'lat'
      ? value >= 0
        ? 'N'
        : 'S'
      : value >= 0
        ? 'E'
        : 'W'
  return `${Math.abs(value).toFixed(2)}\u00b0 ${direction}`
}
