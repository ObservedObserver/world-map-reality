import type { Geometry } from 'geojson'
import type { LonLat, Vec3 } from '../types'
import { MAX_LATITUDE } from '../constants'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const ROTATION_EPSILON = 1e-6

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

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
export const createSphericalRotation = (from: LonLat, to: LonLat) => {
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

export const rotateGeometry = (
  geometry: Geometry,
  rotate: (coord: LonLat) => LonLat
): Geometry => {
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

export const scaleGeometry = (
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
