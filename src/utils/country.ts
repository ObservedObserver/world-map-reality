export const COUNTRY_ORDER = [304, 643, 124, 840, 76, 356, 180, 36, 392]

export const COUNTRY_META: Record<number, { name: string; area: number }> = {
  304: { name: 'Greenland', area: 2166086 },
  643: { name: 'Russia', area: 17098246 },
  124: { name: 'Canada', area: 9984670 },
  840: { name: 'United States', area: 9833520 },
  76: { name: 'Brazil', area: 8515767 },
  356: { name: 'India', area: 3287263 },
  180: { name: 'DR Congo', area: 2344858 },
  36: { name: 'Australia', area: 7692024 },
  392: { name: 'Japan', area: 377975 },
}

const COLOR_PALETTE = [
  '#ef6f5a',
  '#f6c453',
  '#6ad0c4',
  '#9bd0ff',
  '#f49cbb',
  '#b5e48c',
  '#ffb870',
  '#86b6ff',
  '#f08a5d',
  '#7ed7c1',
  '#ffd166',
  '#06d6a0',
  '#118ab2',
  '#ef476f',
  '#ffd6a5',
  '#7f5af0',
  '#72efdd',
  '#e07a5f',
  '#f2cc8f',
  '#84a59d',
  '#f28482',
  '#a3cef1',
  '#ffcad4',
  '#cdb4db',
]

export const normalizeId = (value: string | number) => {
  const raw = String(value)
  const stripped = raw.replace(/^0+/, '')
  return stripped === '' ? '0' : stripped
}

export const getCountryColor = (id: string) => {
  const numericId = Number(id)
  const index = Number.isFinite(numericId)
    ? Math.abs(numericId) % COLOR_PALETTE.length
    : id
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}
