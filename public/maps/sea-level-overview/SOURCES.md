# Sea-level overview data

The files in `imagery/` are Web Mercator JPEG tiles generated from NASA Earth
Observatory's August 2004 Blue Marble Next Generation image with topography and
bathymetry. Source image:
https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/world.topo.bathy.200408.3x5400x2700.jpg

Image credit: NASA Earth Observatory. NASA's image guidelines do not permit
implying NASA endorsement. https://www.nasa.gov/nasa-brand-center/images-and-media/

The files in `terrain/` are unmodified Terrarium PNG tiles from the Mapzen
Terrain Tiles public AWS dataset, `s3://elevation-tiles-prod/terrarium/`.
https://registry.opendata.aws/terrain-tiles/

These tiles combine terrain datasets from multiple contributors. Required
source credits are documented at:
https://github.com/tilezen/joerd/blob/master/docs/attribution.md

They include ArcticDEM, Geoscience Australia, Austria's open data program,
Canada's Open Government Licence data, EU-DEM, NOAA ETOPO1, Mexico's INEGI,
New Zealand LINZ, Norway's Kartverket, the UK Environment Agency, and USGS
3DEP/GMTED2010/SRTM. Data may have different local accuracies and dates.

The checked-in overview tiles cover zoom levels 0 through 4. Higher zooms in
the detail view continue to use the live Mapzen terrain tile endpoint. The
overview does not provide street or property-scale elevation information.

Regenerate both tile sets with `python3 scripts/build-sea-level-overview.py`
from the repository root. The script needs Pillow and NumPy. Runtime requests
for the overview use this site's static files only.
