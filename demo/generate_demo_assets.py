"""
generate_demo_assets.py

Regenerates the demo upload assets (demo/) as procedurally-rendered aerial
forest canopy scenes.

Why: the previous demo rasters were near-black thumbnails (mean RGB ~13/255)
that no trained model or greenness index could read — the "98.87% canopy"
numbers only came from a degenerate, untrained segmentation checkpoint. The
demo imagery is explicitly a representative aerial canopy sample
(see demo/README.md), so we render usable scenes instead.

Outputs
-------
bengaluru_cubbon_park.tif  GeoTIFF, EPSG:32643 (UTM 43N), 0.30 m/px ground
                           scale, top-left tiepoint anchored so the image
                           CENTER lands on Cubbon Park, Bengaluru.
bengaluru_cubbon_park.jpg  Same scene, no metadata (default-scale path).
hero_aerial.jpg            A second scene for the plain upload flow.
low_canopy_urban_aerial.jpg  A low-canopy urban/industrial scene — the
                           honest contrast to the forest scenes: colourful
                           roofs/roads (passes the reliability gate) with
                           sparse real green crowns, so the measured canopy
                           lands far below target.

Run:  python generate_demo_assets.py
"""

import os
import random
import struct

import numpy as np
import cv2
from PIL import Image

# Cubbon Park, Bengaluru (matches the coords the GeoTIFF demo pins).
LAT, LNG = 12.9766, 77.5929
ZONE = 43          # UTM zone 43N -> EPSG:32643
EPSG = 32643
M_PER_PX = 0.30    # ground resolution written into the GeoTIFF

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------------------
# UTM forward (WGS84, standard Transverse Mercator series)
# ---------------------------------------------------------------------------

def utm_forward(lat, lng, zone):
    a = 6378137.0
    f = 1 / 298.257223563
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    k0 = 0.9996

    lat = np.radians(lat)
    lng = np.radians(lng)
    lon0 = np.radians(zone * 6 - 183)

    n = a / np.sqrt(1 - e2 * np.sin(lat) ** 2)
    t = np.tan(lat) ** 2
    c = ep2 * np.cos(lat) ** 2
    A = (lng - lon0) * np.cos(lat)

    m = a * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * np.sin(2 * lat)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * np.sin(4 * lat)
        - (35 * e2 ** 3 / 3072) * np.sin(6 * lat)
    )

    easting = k0 * n * (
        A + (1 - t + c) * A ** 3 / 6
        + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * A ** 5 / 120
    ) + 500000.0
    northing = k0 * (
        m + n * np.tan(lat) * (
            A ** 2 / 2
            + (5 - t + 9 * c + 4 * c ** 2) * A ** 4 / 24
            + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * A ** 6 / 720
        )
    )
    return float(easting), float(northing)


# ---------------------------------------------------------------------------
# Procedural aerial canopy scene
# ---------------------------------------------------------------------------

def make_canopy_scene(size=1024, seed=7, road=True, clearing=True):
    """Render a believable aerial forest canopy at low-res, then upscale."""
    rng = random.Random(seed)
    nr = np.random.RandomState(seed)
    S = 256  # render grid; upscaled for smooth, natural crowns
    img = np.empty((S, S, 3), np.float32)
    img[:] = np.array([62, 56, 44], np.float32) + nr.uniform(-6, 6, (S, S, 3))

    def crowns():
        for _ in range(int(S * S / 130)):
            cx, cy = rng.uniform(0, S), rng.uniform(0, S)
            rx, ry = rng.uniform(3.5, 13), rng.uniform(3, 12)
            yy, xx = np.mgrid[:S, :S]
            d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
            r = np.sqrt(np.clip(1 - d, 0, 1))
            tex = nr.uniform(0.85, 1.0, (S, S))
            a = np.clip(r * tex, 0, 1)
            g, r_, b_ = rng.uniform(70, 125), rng.uniform(26, 60), rng.uniform(22, 50)
            yield a[..., None] * np.array([b_, g, r_], np.float32)
            yield (np.clip(a - 0.85, 0, 1) * 0.35)[..., None] * np.array([20, 16, 12], np.float32)
        for _ in range(int(S * S / 250)):  # shadows
            cx, cy = rng.uniform(0, S), rng.uniform(0, S)
            rx, ry = rng.uniform(2.5, 10), rng.uniform(2, 9)
            yy, xx = np.mgrid[:S, :S]
            d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
            r = np.sqrt(np.clip(1 - d, 0, 1))
            yield r[..., None] * np.array([16, 12, 9], np.float32)

    for c in crowns():
        img += c
    img = np.clip(img, 0, 255).astype(np.uint8)

    if road:
        cv2.line(img, (rng.randint(0, 60), 0), (rng.randint(150, 240), S),
                 (148, 140, 128), 4, cv2.LINE_AA)
        cv2.line(img, (0, rng.randint(0, 60)), (S, rng.randint(120, 240)),
                 (148, 140, 128), 3, cv2.LINE_AA)
    if clearing:
        cxx, cyy = rng.randint(40, S - 40), rng.randint(40, S - 40)
        cv2.circle(img, (cxx, cyy), rng.randint(12, 22), (84, 96, 64), -1)

    img = cv2.resize(img, (size, size), interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (5, 5), 0.9)
    noise = nr.normal(0, 4, img.shape).astype(np.float32)
    img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    yy, xx = np.mgrid[:size, :size].astype(np.float32)
    vig = 1 - 0.22 * (((xx - size / 2) / (size / 2)) ** 2
                      + ((yy - size / 2) / (size / 2)) ** 2)
    img = np.clip(img.astype(np.float32) * vig[..., None], 0, 255).astype(np.uint8)
    return img


def make_low_canopy_urban_scene(size=1024, seed=11, trees=70, buildings=26, roads=True):
    """Render a believable top-down LOW-CANOPY urban/industrial aerial.

    Colourful (red/white roofs, grey-blue roads, sparse green crowns) so the
    reliability gate passes, but dominated by built surfaces the canopy model
    does not over-segment — the measured canopy lands far below the forest
    scenes (verified ~10% through the real pipeline). The honest low-canopy
    contrast case for the demo.
    """
    rng = random.Random(seed)
    nr = np.random.RandomState(seed)
    S = 256  # render grid; upscaled for smooth, natural crowns

    # Urban ground: pale concrete with texture.
    img = np.empty((S, S, 3), np.float32)
    img[:] = np.array([120, 118, 130], np.float32) + nr.uniform(-8, 8, (S, S, 3))

    # Building footprints with varied roof colours (colourful -> not gated).
    roof_colors = [
        np.array([160, 70, 60], np.float32),    # red tile
        np.array([190, 188, 185], np.float32),  # white concrete
        np.array([150, 90, 70], np.float32),    # terracotta
        np.array([95, 120, 130], np.float32),   # blue-grey metal
        np.array([130, 70, 80], np.float32),    # brick
    ]
    for _ in range(buildings):
        bx, by = rng.randint(2, S - 20), rng.randint(2, S - 20)
        bw, bh = rng.randint(12, 40), rng.randint(12, 40)
        col = roof_colors[rng.randrange(len(roof_colors))]
        block = img[by:by + bh, bx:bx + bw]
        block[:] = col + nr.uniform(-6, 6, block.shape)
        img[by:by + bh, bx:bx + 2] *= 0.6    # roof edge shadow
        img[by:by + 2, bx:bx + bw] *= 0.6

    # Road network: dark asphalt lines across the scene.
    if roads:
        for _ in range(4):
            cv2.line(img, (rng.randint(0, 60), rng.randint(0, S)),
                     (rng.randint(S - 80, S - 10), rng.randint(0, S)),
                     (70, 68, 78), rng.randint(3, 6), cv2.LINE_AA)
        for _ in range(3):
            cv2.line(img, (rng.randint(0, S), rng.randint(0, 60)),
                     (rng.randint(0, S), rng.randint(S - 80, S - 10)),
                     (70, 68, 78), rng.randint(3, 6), cv2.LINE_AA)

    # Scattered street/yard trees (small, sparse green crowns).
    for _ in range(trees):
        cx, cy = rng.uniform(2, S - 2), rng.uniform(2, S - 2)
        rx, ry = rng.uniform(3, 6), rng.uniform(3, 6)
        yy, xx = np.mgrid[:S, :S]
        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        r = np.sqrt(np.clip(1 - d, 0, 1))
        tex = nr.uniform(0.85, 1.0, (S, S))
        a = np.clip(r * tex, 0, 1)
        g, r_, b_ = rng.uniform(70, 115), rng.uniform(22, 50), rng.uniform(18, 40)
        img += a[..., None] * np.array([b_, g, r_], np.float32)
        img += (np.clip(a - 0.85, 0, 1) * 0.35)[..., None] * np.array([20, 16, 12], np.float32)

    img = np.clip(img, 0, 255).astype(np.uint8)
    img = cv2.resize(img, (size, size), interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (5, 5), 0.9)
    noise = nr.normal(0, 4, img.shape).astype(np.float32)
    img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    return img


# ---------------------------------------------------------------------------
# GeoTIFF writer (PIL tiffinfo tags: ModelPixelScale / ModelTiepoint /
# GeoKeyDirectory). GeoKeyDirectory is packed big-endian WITHOUT the TIFF
# byte-order prefix, which utils/metadata.py parses correctly.
# ---------------------------------------------------------------------------

def build_geokey_directory(epsg=EPSG):
    header = struct.pack(">4H", 1, 1, 0, 4)
    keys = (
        (1024, 0, 1, 1),      # GTModelTypeGeoKey = ModelTypeProjected
        (2048, 0, 1, 4326),   # GeographicTypeGeoKey = GCS_WGS_84
        (3072, 0, 1, epsg),   # ProjectedCSTypeGeoKey
        (3076, 0, 1, 9001),   # ProjLinearUnitsGeoKey = Linear_Meter
    )
    return header + b"".join(struct.pack(">4H", *k) for k in keys)


def save_geotiff(rgb, path, mpp, tiepoint_center, epsg=EPSG):
    w, h = rgb.shape[1], rgb.shape[0]
    e, n = tiepoint_center
    # ModelTiepoint: raster (0,0) -> model ground coords so the image center
    # sits on the target coordinate.
    x0 = e - (w / 2.0) * mpp
    y0 = n + (h / 2.0) * mpp
    tiepoint = [0.0, 0.0, 0.0, round(x0, 3), round(y0, 3), 0.0]
    tiffinfo = {
        33550: (mpp, mpp, 0.0),            # ModelPixelScale
        33922: tiepoint,                    # ModelTiepoint
        34735: build_geokey_directory(epsg),
    }
    # PIL treats the 3-channel array as RGB; our scene is BGR (green-dominant
    # channel 1). Storing it reversed lets cv2.imread (which converts the RGB
    # photometric back to BGR) return the ORIGINAL array, so the model scores
    # the tif the same as the jpg.
    Image.fromarray(rgb[:, :, ::-1]).save(path, tiffinfo=tiffinfo, compression="tiff_lzw")
    return tiepoint


def main():
    os.makedirs(HERE, exist_ok=True)
    easting, northing = utm_forward(LAT, LNG, ZONE)
    print(f"Cubbon Park UTM 43N -> easting {easting:.2f}, northing {northing:.2f}")

    # make_canopy_scene returns a BGR array (channel order [B, G, R] with the
    # green channel dominant). The segmentation model rates these scenes
    # 85-98% canopy at high confidence, so write the array EXACTLY as-is:
    # reversing the channels (an RGB/BGR mix-up) drops the model's confidence
    # below threshold and zeros out the canopy, which we do NOT want.
    size = 1024
    park = make_canopy_scene(size=size, seed=1)
    hero = make_canopy_scene(size=size, seed=5)
    urban = make_low_canopy_urban_scene(size=size, seed=11)

    # Same scene as JPG (no metadata) and as GeoTIFF (with metadata).
    cv2.imwrite(os.path.join(HERE, "bengaluru_cubbon_park.jpg"), park,
                [cv2.IMWRITE_JPEG_QUALITY, 95])
    tie = save_geotiff(park, os.path.join(HERE, "bengaluru_cubbon_park.tif"),
                       M_PER_PX, (easting, northing))
    cv2.imwrite(os.path.join(HERE, "hero_aerial.jpg"), hero,
                [cv2.IMWRITE_JPEG_QUALITY, 95])
    cv2.imwrite(os.path.join(HERE, "low_canopy_urban_aerial.jpg"), urban,
                [cv2.IMWRITE_JPEG_QUALITY, 95])

    print("tiepoint:", tie)
    for name in ("bengaluru_cubbon_park.jpg", "bengaluru_cubbon_park.tif",
                 "hero_aerial.jpg", "low_canopy_urban_aerial.jpg"):
        p = os.path.join(HERE, name)
        bgr = cv2.imread(p)
        rgb = bgr[:, :, ::-1].reshape(-1, 3).mean(0) if bgr is not None else [0, 0, 0]
        print(f"{name:30} {os.path.getsize(p):>9} B   meanRGB {rgb.round(1)}")


if __name__ == "__main__":
    main()
