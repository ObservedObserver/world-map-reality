# Equal Earth map data

`countries-110m.json` is an unchanged copy of world-atlas 2.0.2:
https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json

Retrieved 2026-09-06. It is also byte-identical to the existing local
`public/data/countries-110m.json`. This tracked copy makes the new page independent
of the ignored `data/` directory and external runtime data requests.

Source: Natural Earth 4.1.0, 1:110 million country boundaries.
https://github.com/topojson/world-atlas/tree/v2.0.2
https://www.naturalearthdata.com/about/terms-of-use/

Natural Earth data is public domain. The world-atlas package ISC license is
included in LICENSE.txt. Boundaries retain the source's de facto representation;
they do not imply political endorsement. Area estimates use the entire simplified
spherical geometry and are not official national area statistics.
