import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { geoArea, geoCircle, geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import {
  createAreaLens,
  createMapProjection,
  DEFAULT_EXPLORER_STATE,
  EARTH_RADIUS_KM,
  explorerSearch,
  MAP_SCALE,
  measureRegion,
  parseExplorerState,
  prepareRegions,
} from '../src/utils/equalEarth.ts'

const topology = JSON.parse(
  readFileSync(new URL('../public/maps/countries-110m.json', import.meta.url)),
)
const regions = prepareRegions(
  feature(topology, topology.objects.countries).features,
)
const ids = new Set(regions.map((region) => region.id))
const region = (id) => regions.find((item) => item.id === id)
const near = (actual, expected, tolerance = 0.001) =>
  assert.ok(
    Math.abs(actual / expected - 1) < tolerance,
    `${actual} differs from ${expected}`,
  )

test('Equal Earth preserves the area of known spherical caps at different latitudes', () => {
  const expected = 2 * Math.PI * (1 - Math.cos((4 * Math.PI) / 180))
  for (const latitude of [-75, -60, -30, 0, 30, 60, 75]) {
    const measurements = measureRegion(createAreaLens(latitude))
    near(measurements.areaKm2, expected * EARTH_RADIUS_KM ** 2, 0.0001)
    near(measurements.equalEarthArea, expected, 0.0001)
  }
})

test('Mercator tiny-patch area tends to secant squared, and the finite circle is integrated', () => {
  for (const latitude of [0, 30, 60, 75]) {
    const tiny = geoCircle().center([0, latitude]).radius(0.01).precision(1)()
    near(
      measureRegion(tiny).inflation,
      1 / Math.cos((latitude * Math.PI) / 180) ** 2,
    )
  }
  const at60 = measureRegion(createAreaLens(60))
  assert.ok(at60.inflation > 4 && at60.inflation < 4.1)
  near(at60.inflation, measureRegion(createAreaLens(-60)).inflation, 0.00001)
})

test('all supplied countries have finite areas and valid Equal Earth paths, including both poles', () => {
  assert.equal(regions.length, 178)
  assert.equal(ids.size, regions.length)
  for (const item of regions) {
    const metrics = measureRegion(item.geometry)
    assert.ok(
      Number.isFinite(metrics.areaKm2) && metrics.areaKm2 > 0,
      item.name,
    )
    near(metrics.equalEarthArea, geoArea(item.geometry), 0.001)
    const path = geoPath(createMapProjection('equalEarth'))(item.geometry)
    assert.ok(path && !/NaN|Infinity/.test(path), item.name)
  }
})

test('Africa is assembled without Greenland; its area is about fourteen Greenlands', () => {
  const africa = region('africa')
  assert.ok(
    africa.memberIds.includes('818') && africa.memberIds.includes('710'),
  )
  assert.ok(
    africa.geometry.features.some(
      (item) => item.properties.name === 'Somaliland',
    ),
  )
  assert.ok(!africa.memberIds.includes('304'))
  const ratio =
    measureRegion(africa.geometry).areaKm2 /
    measureRegion(region('304').geometry).areaKm2
  assert.ok(ratio > 13 && ratio < 15, String(ratio))
})

test('whole-country Mercator multiplier includes the full Greenland polygon', () => {
  const metrics = measureRegion(region('304').geometry)
  assert.ok(
    metrics.inflation > 14 && metrics.inflation < 20,
    String(metrics.inflation),
  )
  assert.equal(metrics.clipped, false)
})

test('Antarctica never reports a clipped Mercator outline as a full-country multiplier', () => {
  const metrics = measureRegion(region('10').geometry)
  assert.equal(metrics.clipped, true)
  assert.equal(metrics.inflation, null)
  assert.ok(Number.isFinite(metrics.mercatorArea))
})

test('both panels share the exact same scale and antimeridian changes preserve areas', () => {
  for (const id of ['643', '242', '840', '304', 'africa']) {
    for (const kind of ['equalEarth', 'mercator']) {
      const baseline = geoPath(createMapProjection(kind, 0)).area(
        region(id).geometry,
      )
      for (const meridian of [-180, -100, 120, 180]) {
        const projection = createMapProjection(kind, meridian)
        assert.equal(projection.scale(), MAP_SCALE)
        near(geoPath(projection).area(region(id).geometry), baseline, 0.008)
        assert.ok(
          !/NaN|Infinity/.test(geoPath(projection)(region(id).geometry)),
        )
      }
    }
  }
})

test('Equal Earth forward and inverse round-trip across the globe', () => {
  const projection = geoEqualEarth()
  for (let lon = -175; lon <= 175; lon += 25)
    for (let lat = -85; lat <= 85; lat += 17) {
      const inverse = projection.invert(projection([lon, lat]))
      assert.ok(Math.abs(inverse[0] - lon) < 1e-8)
      assert.ok(Math.abs(inverse[1] - lat) < 1e-8)
    }
})

test('share state round-trips and invalid input safely falls back or clamps', () => {
  const state = {
    country: '643',
    compare: '36',
    meridian: 120,
    latitude: -60,
    grid: false,
    lens: true,
  }
  assert.deepEqual(parseExplorerState(explorerSearch(state), ids), state)
  assert.deepEqual(parseExplorerState('', ids), DEFAULT_EXPLORER_STATE)
  assert.deepEqual(
    parseExplorerState(
      '?country=evil&compare=none&latitude=Infinity&meridian=NaN',
      ids,
    ),
    DEFAULT_EXPLORER_STATE,
  )
  assert.equal(
    parseExplorerState('?latitude=89&meridian=-999', ids).latitude,
    75,
  )
  assert.equal(
    parseExplorerState('?latitude=89&meridian=-999', ids).meridian,
    -180,
  )
})
