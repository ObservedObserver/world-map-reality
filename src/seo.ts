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
