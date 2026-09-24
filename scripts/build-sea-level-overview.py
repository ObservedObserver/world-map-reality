"""Build the sea-level overview's self-hosted raster tile set.

Run with Python 3, Pillow, and NumPy. Source imagery is NASA Blue Marble Next
Generation (August 2004); elevation is Mapzen Terrain Tiles in Terrarium format.
The output is checked into public/maps/sea-level-overview so browsers never
request either source host in overview mode.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
import math
import urllib.request

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/maps/sea-level-overview"
MAX_ZOOM = 4
IMAGE_URL = (
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/"
    "world.topo.bathy.200408.3x5400x2700.jpg"
)
TERRAIN_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "runcell-sea-level-overview/1.0"})
    with urllib.request.urlopen(request, timeout=35) as response:
        return response.read()


def build_imagery() -> None:
    source = np.asarray(Image.open(BytesIO(fetch(IMAGE_URL))).convert("RGB"))
    height, width, _ = source.shape
    for zoom in range(MAX_ZOOM + 1):
        size = (1 << zoom) * 256
        for x in range(1 << zoom):
            image_x = (x * 256 + np.arange(256) + 0.5) * width / size - 0.5
            x0 = np.floor(image_x).astype(int) % width
            x1 = (x0 + 1) % width
            dx = (image_x - np.floor(image_x))[None, :, None]
            for y in range(1 << zoom):
                global_y = y * 256 + np.arange(256) + 0.5
                lat = np.arctan(np.sinh(math.pi * (1 - 2 * global_y / size)))
                image_y = (0.5 - lat / math.pi) * height - 0.5
                y0 = np.clip(np.floor(image_y).astype(int), 0, height - 1)
                y1 = np.clip(y0 + 1, 0, height - 1)
                dy = (image_y - np.floor(image_y))[:, None, None]
                top = source[y0[:, None], x0[None, :]] * (1 - dx) + source[y0[:, None], x1[None, :]] * dx
                bottom = source[y1[:, None], x0[None, :]] * (1 - dx) + source[y1[:, None], x1[None, :]] * dx
                tile = Image.fromarray(np.clip(top * (1 - dy) + bottom * dy, 0, 255).astype("uint8"))
                path = OUT / "imagery" / str(zoom) / str(x) / f"{y}.jpg"
                path.parent.mkdir(parents=True, exist_ok=True)
                tile.save(path, quality=82, optimize=True)


def download_terrain(tile: tuple[int, int, int]) -> None:
    zoom, x, y = tile
    path = OUT / "terrain" / str(zoom) / str(x) / f"{y}.png"
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    url = f"{TERRAIN_URL}/{zoom}/{x}/{y}.png"
    for attempt in range(3):
        try:
            data = fetch(url)
            with Image.open(BytesIO(data)) as image:
                image.verify()
            path.write_bytes(data)
            return
        except Exception:
            if attempt == 2:
                raise


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print("Building NASA imagery tiles", flush=True)
    build_imagery()
    tiles = [
        (zoom, x, y)
        for zoom in range(MAX_ZOOM + 1)
        for x in range(1 << zoom)
        for y in range(1 << zoom)
    ]
    print(f"Downloading {len(tiles)} Mapzen terrain tiles", flush=True)
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(download_terrain, tile) for tile in tiles]
        for future in as_completed(futures):
            future.result()
    print("Done", flush=True)


if __name__ == "__main__":
    main()
