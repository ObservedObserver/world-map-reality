export type FaqItem = {
  question: string
  answer: string
}

export const MAIN_FAQS: FaqItem[] = [
  {
    question: 'What is a true size of countries map?',
    answer:
      'A true size of countries map lets you move countries across latitudes so you can compare their real geographic area without being misled by Mercator projection distortion.',
  },
  {
    question: 'Why do countries look different sizes on a Mercator map?',
    answer:
      'Mercator projection preserves local shape for navigation, but it stretches land near the poles. Countries such as Greenland, Canada, and Russia appear larger than their real area.',
  },
  {
    question: 'How do I compare real country sizes with this tool?',
    answer:
      'Choose countries from the comparison set, drag the colored shapes on the map, and watch the scale factor update as each country moves to a new latitude.',
  },
  {
    question: 'Does the tool compare countries by real area?',
    answer:
      'Yes. The tool shows country area and uses Mercator scale math to demonstrate how apparent size changes when a country is moved north or south.',
  },
]

export const SEA_LEVEL_FAQS: FaqItem[] = [
  {
    question: 'What does this sea level rise simulator show?',
    answer:
      'It overlays a sea-level threshold you choose onto terrain elevation and highlights every area that sits below that level, so you can preview which coastlines and low-lying regions would be underwater at that height.',
  },
  {
    question: 'How much has sea level risen, and how much more could it rise?',
    answer:
      'Global mean sea level has risen roughly 20 cm (about 8 inches) since 1900 and the rate is accelerating. Depending on future emissions, the IPCC projects roughly 0.3 to over 1 metre of rise by 2100, with several metres possible over later centuries if major ice sheets destabilize.',
  },
  {
    question: 'Is this a real flood model?',
    answer:
      'No. It is an elevation-based "bathtub" visualization that shades all land below the chosen level. It does not model tides, storm surge, waves, drainage, or land subsidence, so it is best used as an educational illustration of exposure rather than a flood forecast.',
  },
  {
    question: 'Why do some inland areas appear flooded?',
    answer:
      'The map shades any location below the selected elevation, so closed basins that already lie below sea level — such as the Caspian Depression or Death Valley — light up even though no ocean water actually connects to them.',
  },
  {
    question: 'What elevation data does the map use?',
    answer:
      'It renders an open global digital elevation model with MapLibre GL. The resolution is limited to roughly tens of metres per pixel, so narrow channels, sea walls, and small islands may be averaged and shown approximately.',
  },
]

export const GLOBE_FAQS: FaqItem[] = [
  {
    question: 'Why compare country sizes on a globe instead of a flat map?',
    answer:
      'A globe shows land area without Mercator distortion, so high-latitude countries like Greenland and Russia stop looking oversized. An orthographic globe is the closest a screen gets to true relative area.',
  },
  {
    question: 'How do countries compare to other planets and moons?',
    answer:
      'Dropping a country onto another world shows scale directly. The Moon has about 38 million km² of surface, roughly a quarter of Earth’s land area, while Mars has about 145 million km², close to all of Earth’s land combined.',
  },
  {
    question: 'What is an orthographic globe projection?',
    answer:
      'It renders Earth as if viewed from deep space: the visible hemisphere keeps its round shape and near-true areas around the center, unlike a flat map that has to stretch the poles.',
  },
  {
    question: 'Which countries look most distorted on flat world maps?',
    answer:
      'Greenland, Russia, Canada, and Antarctica are the most exaggerated, because Mercator stretching grows with distance from the equator.',
  },
]

export const EQUATOR_FAQS: FaqItem[] = [
  {
    question: 'What is a custom Mercator projection?',
    answer:
      'It is a Mercator map where you choose where the line of least distortion sits. Moving that line shows how the same projection would stretch the world from a different center.',
  },
  {
    question: 'Why does the Mercator projection distort country sizes?',
    answer:
      'Mercator preserves angles and shapes for navigation, but it cannot preserve area on a flat sheet. The scale factor grows toward the poles, so land far from the equator looks much larger than it is.',
  },
  {
    question: 'What happens when you move the equator?',
    answer:
      'Countries near your chosen equator shrink toward their true scale, while countries far from it inflate. It makes the trade-off behind every flat map visible.',
  },
  {
    question: 'Can any flat map avoid distortion entirely?',
    answer:
      'No. No flat map can keep area, shape, distance, and direction all correct at once. Every projection, including Mercator, sacrifices some properties to preserve others.',
  },
]

export const ASTEROID_FAQS: FaqItem[] = [
  {
    question: 'What does an asteroid impact simulator calculate?',
    answer:
      'It estimates the consequences of an asteroid striking Earth — the impact energy in megatons of TNT, the crater size, the fireball radius, the thermal radiation zones that cause burns, the air-blast overpressure rings, the peak wind speed, and the seismic magnitude — based on the asteroid size, speed, impact angle, and composition you choose.',
  },
  {
    question: 'How is asteroid impact energy calculated?',
    answer:
      'Impact energy is the kinetic energy of the asteroid, one half times its mass times its velocity squared. The mass comes from the diameter and density (an iron asteroid is far heavier than an icy one of the same size). The energy is then expressed in megatons of TNT for comparison: one megaton equals 4.184 × 10^15 joules.',
  },
  {
    question: 'What is the difference between an airburst and a crater-forming impact?',
    answer:
      'Small or low-density asteroids break apart in the atmosphere and release their energy as an airburst before reaching the ground, so no crater forms — the 2013 Chelyabinsk and 1908 Tunguska events were airbursts. Larger or denser bodies, especially iron ones, keep enough momentum to hit the surface and excavate a crater.',
  },
  {
    question: 'How big does an asteroid need to be to cause mass extinction?',
    answer:
      'The Chicxulub impactor that ended the age of dinosaurs about 66 million years ago is estimated at roughly 10 kilometers across and released on the order of 100 million megatons of TNT. Impacts that large occur only every hundred million years or so, while city-threatening impacts of tens of meters are far more frequent.',
  },
  {
    question: 'Which model do the impact effects use?',
    answer:
      'The calculations follow the Earth Impact Effects Program published by Gareth Collins, Jay Melosh, and Robert Marcus in 2005, which combines atmospheric-entry physics, crater-scaling laws from experiments and nuclear tests, fireball thermal radiation, and air-blast data into a single set of equations.',
  },
  {
    question: 'How accurate is an asteroid impact simulation?',
    answer:
      'The results are order-of-magnitude estimates with large uncertainties, particularly for airburst blast effects and very large impacts. The model assumes a land target and does not include ocean impacts, tsunamis, ejecta fallout, or long-term climate effects, so it is best used for education rather than emergency planning.',
  },
]

export const POPULAR_COMPARISON_LINKS = [
  {
    title: 'Greenland vs Africa',
    href: '/tool/true-size-map/compare/greenland-vs-africa',
  },
  {
    title: 'Russia vs United States',
    href: '/tool/true-size-map/compare/russia-vs-united-states',
  },
  {
    title: 'Canada vs United States',
    href: '/tool/true-size-map/compare/canada-vs-united-states',
  },
  {
    title: 'Australia vs Greenland',
    href: '/tool/true-size-map/compare/australia-vs-greenland',
  },
  {
    title: 'India vs United States',
    href: '/tool/true-size-map/compare/india-vs-united-states',
  },
  {
    title: 'Brazil vs United States',
    href: '/tool/true-size-map/compare/brazil-vs-united-states',
  },
  {
    title: 'Russia vs Canada',
    href: '/tool/true-size-map/compare/russia-vs-canada',
  },
  {
    title: 'Japan vs United States',
    href: '/tool/true-size-map/compare/japan-vs-united-states',
  },
]

export const formatSeoArea = (areaKm2: number) =>
  new Intl.NumberFormat('en-US').format(areaKm2)
