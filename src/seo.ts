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

export const NUCLEAR_FAQS: FaqItem[] = [
  {
    question: 'What is a nuclear blast radius?',
    answer:
      'A nuclear blast radius is the distance from the detonation out to which a particular effect reaches — a level of blast overpressure, heat, or radiation. There is no single radius: each effect has its own ring, so building collapse, third-degree burns, and broken windows happen at very different distances, and every ring grows with the weapon’s yield.',
  },
  {
    question: 'How is a nuclear blast radius calculated?',
    answer:
      'Blast radii are calculated with cube-root scaling: for a given overpressure, the distance grows with the cube root of the yield, so a 1,000 kt bomb reaches about ten times farther than a 1 kt bomb because the cube root of 1,000 is 10. This map applies the scaling laws published in Glasstone and Dolan’s The Effects of Nuclear Weapons, the same public reference that NUKEMAP uses, to draw each blast, thermal, and radiation ring to scale.',
  },
  {
    question: 'What is the blast radius of a nuclear bomb?',
    answer:
      'It depends almost entirely on the yield. The 15-kiloton Hiroshima bomb collapsed most buildings out to roughly 1.7 km (the 5 psi ring) and broke windows out to about 4.4 km (1 psi). A 1-megaton warhead pushes those rings to roughly 7 km and 18 km, and the 50-megaton Tsar Bomba shatters windows more than 60 km away. Pick a preset or set a custom yield to see every ring drawn on the map.',
  },
  {
    question: 'What is the difference between an airburst and a surface burst?',
    answer:
      'An airburst detonates the weapon high above the ground so the blast wave reflects off the surface and reaches farther, maximizing destruction over a wide area while producing little local fallout. A surface (ground) burst detonates at the surface: it digs a crater, has a larger fireball, and lifts debris into the cloud to create heavy radioactive fallout, but its blast rings are smaller than an optimally placed airburst of the same yield. Hiroshima and Nagasaki were both airbursts.',
  },
  {
    question: 'How far does the radiation from a nuclear bomb reach?',
    answer:
      'Prompt radiation — the burst of neutrons and gamma rays at the moment of detonation — delivers a roughly 500 rem dose out to about 1 to 2 km for a small, Hiroshima-scale weapon, because the atmosphere absorbs it within a few kilometers. For larger weapons the blast and fire rings extend well beyond the prompt-radiation range, so radiation is rarely the limiting effect. Long-term fallout from a surface burst can travel far downwind, but it depends on weather and is not drawn on this map.',
  },
  {
    question: 'How accurate is this nuclear blast radius map?',
    answer:
      'The rings are modeled estimates, not predictions of any specific event. They use the standard cube-root blast and thermal scaling laws from Glasstone and Dolan and assume flat terrain, clear air, and an idealized burst height. Real effects vary with weather, terrain, buildings, and the exact height of burst, so the map is best used as an educational illustration of scale rather than as a planning tool.',
  },
]

export const SUN_ANALEMMA_FAQS: FaqItem[] = [
  {
    question: 'What is a Sun analemma?',
    answer:
      'A Sun analemma is the lopsided figure-eight path made by the Sun when its position is recorded from one location at the same clock time throughout a year.',
  },
  {
    question: 'Why does the analemma form a figure eight?',
    answer:
      'The north-south motion comes mainly from Earth’s 23.4-degree axial tilt, while the east-west motion comes from the equation of time caused by the tilt and Earth’s slightly elliptical orbit.',
  },
  {
    question: 'Does the analemma look different in each location?',
    answer:
      'Yes. Latitude changes the altitude and orientation of the curve, longitude changes which UTC times place it above the horizon, and the two hemispheres face opposite directions toward the equator.',
  },
  {
    question: 'What are altitude and azimuth?',
    answer:
      'Altitude is the Sun’s angle above the horizon, from 0 degrees at the horizon to 90 degrees overhead. Azimuth is its compass bearing measured clockwise from north.',
  },
  {
    question: 'Why does this calculator use UTC?',
    answer:
      'A fixed UTC time keeps every sample evenly spaced in clock time. Local daylight-saving changes would shift some observations by an hour and introduce an artificial jump in the curve.',
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
