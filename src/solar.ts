export const EARTH_DIAMETER_KM = 12742

export const PLANETS = [
  {
    id: 'jupiter',
    name: 'Jupiter',
    diameterKm: 142984,
  },
  {
    id: 'saturn',
    name: 'Saturn',
    diameterKm: 120536,
  },
  {
    id: 'uranus',
    name: 'Uranus',
    diameterKm: 51118,
  },
  {
    id: 'neptune',
    name: 'Neptune',
    diameterKm: 49528,
  },
  {
    id: 'earth',
    name: 'Earth',
    diameterKm: 12742,
  },
  {
    id: 'moon',
    name: 'Moon',
    diameterKm: 1738,
  },
  {
    id: 'venus',
    name: 'Venus',
    diameterKm: 12104,
  },
  {
    id: 'mars',
    name: 'Mars',
    diameterKm: 6779,
  },
  {
    id: 'mercury',
    name: 'Mercury',
    diameterKm: 4879,
  },
] as const

export type Planet = (typeof PLANETS)[number]

export const PLANET_TEXTURES: Record<Planet['id'], string | null> = {
  jupiter: '2k_jupiter.jpg',
  saturn: '2k_saturn.jpg',
  uranus: '2k_uranus.jpg',
  neptune: '2k_neptune.jpg',
  earth: '2k_earth_daymap.jpg',
  moon: '2k_moon.jpg',
  venus: '2k_venus_atmosphere.jpg',
  mars: '2k_mars.jpg',
  mercury: '2k_mercury.jpg',
}
