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
