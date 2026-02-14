# True size of countries

## Use case 1: counries on other planets



https://github.com/user-attachments/assets/e72ea398-c065-44f8-85bb-5292bf440815




## Use case 2: Mercator projection

An interactive map that you can compare true size of countries with drag and drop.


https://github.com/user-attachments/assets/548db03a-6b04-49a5-a41c-32a8cb9c4764

[Online playground](https://www.runcell.dev/tool/true-size-map)

## About

The Mercator projection is one of the most common map projections, but it has a significant flaw: it distorts the size of countries based on their latitude. Countries near the poles appear much larger than they actually are, while countries near the equator are shown more accurately.

This interactive playground lets you explore how Mercator distortion works by dragging countries to different latitudes on the map. As you move a country, you'll see it resize in real-time based on the Mercator scale factor, revealing how the same country would appear if it were located at that latitude.

### Features

- **Drag and drop**: Select countries from the sidebar and drag them anywhere on the map
- **Real-time scaling**: Watch countries resize automatically as you move them to different latitudes
- **Visual comparison**: Compare multiple countries side-by-side at different latitudes
- **Latitude indicators**: See latitude lines and labels to understand where countries are positioned
- **Country details**: View original latitude, current latitude, and Mercator scale factor for any selected country

### How it works

The Mercator projection uses the formula `1 / cos(latitude)` to determine scale. This means:
- At the equator (0°), the scale is 1:1 (no distortion)
- At higher latitudes, the scale increases dramatically
- Greenland, for example, appears much larger than it actually is because it's near the North Pole

By dragging countries to different latitudes, you can see how their apparent size changes based on Mercator's mathematical distortion, helping you understand why some countries look misleadingly large or small on traditional world maps.

## SEO / SSG

Build with static prerendered routes:

```bash
yarn build:ssg
```

SEO metadata source of truth:

- `src/seo-meta.json`

Default prerender routes:

- `/`
- `/country-size-on-planets`
- `/custom-mercator-projection`

The prerender script assumes subpath deployment under:

- `/tool/true-size-map/`
