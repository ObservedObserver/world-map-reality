import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildSeaLevelShareUrl,
  readSeaLevelSettings,
} from '../src/utils/seaLevel.ts'

const read = (search) => readSeaLevelSettings(new URLSearchParams(search))
const href = 'https://www.runcell.dev/tool/true-size-map/sea-level-rise-simulator'

test('an unconfigured link opens the existing 0m, 2D view', () => {
  assert.deepEqual(read(''), { height: 0, mode: '2d' })
})

test('shared positive and negative heights restore both map modes', () => {
  for (const height of [-5000, -120, 0, 2, 10, 30, 70, 5000]) {
    for (const mode of ['2d', '3d']) {
      const settings = { height, mode }
      const url = new URL(buildSeaLevelShareUrl(href, settings))
      assert.deepEqual(readSeaLevelSettings(url.searchParams), settings)
    }
  }
})

test('links clamp height to the slider range and round to whole meters', () => {
  for (const [input, expected] of [['-9999', -5000], ['9999', 5000], ['142.4', 142], ['-142.6', -143], ['.7', 1]]) {
    assert.equal(read(`height=${input}`).height, expected)
  }
  assert.deepEqual(read('height=70&mode=3D'), { height: 70, mode: '3d' })
})

test('malformed or missing values safely use the default settings', () => {
  for (const height of ['', ' ', 'NaN', 'Infinity', '1e3', '0x10', '70m', '12.5.6', '9'.repeat(400)]) {
    assert.deepEqual(read(new URLSearchParams({ height, mode: 'invalid' })), { height: 0, mode: '2d' })
  }
  assert.deepEqual(read('mode=3d'), { height: 0, mode: '3d' })
})

test('sharing replaces stale settings while preserving other query values and the fragment', () => {
  const url = new URL(buildSeaLevelShareUrl(`${href}?height=10&mode=2d&height=30&utm_source=friend#map`, { height: -120, mode: '3d' }))
  assert.equal(url.origin + url.pathname, href)
  assert.deepEqual(url.searchParams.getAll('height'), ['-120'])
  assert.equal(url.searchParams.get('mode'), '3d')
  assert.equal(url.searchParams.get('utm_source'), 'friend')
  assert.equal(url.hash, '#map')
})
