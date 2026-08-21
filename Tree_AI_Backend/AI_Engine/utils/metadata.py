"""
metadata.py

Purpose:
--------
Extract useful metadata from an image for later use in
tree estimation and GIS calculations.

Supports:
- EXIF GPS (JPG/JPEG from cameras & drones)
- GeoTIFF georeferencing: ModelPixelScale, ModelTiepoint,
  GeoKeyDirectory (EPSG CRS), UTM -> WGS84 coordinate conversion.
"""

import math

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

# GeoTIFF tag IDs
_TAG_PIXEL_SCALE = 33550
_TAG_TIEPOINT = 33922
_TAG_GEOKEYDIR = 34735

# GeoKey IDs (see GeoTIFF spec)
_KEY_GTRasterType = 1024
_KEY_GeographicType = 2048
_KEY_ProjectedCSType = 3072
_KEY_ProjLinearUnits = 3076

# Common UTM / projected EPSG ranges (meters)
_PROJECTED_METER_EPSGS = (
    list(range(32601, 32661)) +   # WGS84 / UTM north
    list(range(32701, 32761)) +   # WGS84 / UTM south
    list(range(25828, 25839)) +   # ETRS89 / UTM
    [3857, 2154, 27700, 3035, 3857]
)


def _parse_geokey_directory(data: bytes) -> dict:
    """Parse the GeoTIFF GeoKeyDirectory (tag 34735) into a dict of key->value."""
    try:
        if not data:
            return {}
        # Determine byte order from the TIFF magic carried in the first bytes.
        if len(data) < 2:
            return {}
        endian = '<' if data[:2] in (b'II',) else '>'
        import struct
        # Some writers store the value without the TIFF byte-order prefix.
        if data[:2] not in (b'II', b'MM'):
            # Assume big-endian like most GeoTIFF writers without prefix.
            endian = '>'
            header = struct.unpack_from('>4H', data, 0)
        else:
            header = struct.unpack_from(endian + '4H', data, 2)
        n_keys = header[3]
        keys = {}
        if len(data) < 8:
            return {}
        for i in range(n_keys):
            off = 8 + i * 8
            if off + 8 > len(data):
                break
            key_id, loc, count, value = struct.unpack_from(endian + '4H', data, off)
            if loc == 0:  # value stored directly
                keys[key_id] = value
            else:
                keys[key_id] = value  # value is an offset into a tag; keep raw
        return keys
    except Exception:
        return {}


def _is_projected_meter_epsg(epsg) -> bool:
    try:
        epsg = int(epsg)
    except (TypeError, ValueError):
        return False
    return epsg in _PROJECTED_METER_EPSGS or (3857 <= epsg <= 3859)


def _utm_to_latlon(easting, northing, zone, southern=False):
    """
    Convert UTM (WGS84) to latitude/longitude using the standard
    Transverse Mercator series. Returns (lat, lon) in decimal degrees.
    """
    k0 = 0.9996
    a = 6378137.0
    f = 1 / 298.257223563
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))

    x = easting - 500000.0
    y = northing if not southern else northing - 10000000.0

    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    phi1 = (mu
            + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
            + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))

    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = n1 * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2)
    d = x / (n1 * k0)

    lat = (phi1
           - (n1 * math.tan(phi1) / r1) * (d ** 2 / 2
                - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
                + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720))
    lon = (d
           - (1 + 2 * t1 + c1) * d ** 3 / 6
           + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / math.cos(phi1)

    zone_cm = zone * 6 - 183
    lon = zone_cm + math.degrees(lon)
    lat = math.degrees(lat)
    return lat, lon


def _geo_to_latlon(tiepoint, pixel_scale, geokeys, width, height):
    """
    Compute the geographic coordinates (lat, lng) of the image center and the
    ground resolution (meters/pixel) from GeoTIFF tags.

    Returns (coords | None, meters_per_pixel | None, crs_epsg | None,
             warning | None, scale_approximation: bool).
    """
    warning = None
    epsg = None

    proj_epsg = geokeys.get(_KEY_ProjectedCSType)
    geo_epsg = geokeys.get(_KEY_GeographicType)
    if proj_epsg:
        epsg = proj_epsg
    elif geo_epsg:
        epsg = geo_epsg
    elif geokeys.get(_KEY_ProjLinearUnits) == 9001:
        epsg = None  # meters but unknown CRS
    else:
        epsg = None

    try:
        if len(tiepoint) < 6 or len(pixel_scale) < 2:
            return None, None, epsg, "GeoTIFF has no usable tiepoint/pixel-scale.", False
        x0, y0 = tiepoint[3], tiepoint[4]
        sx, sy = float(pixel_scale[0]), abs(float(pixel_scale[1]))
        cx = width / 2.0
        cy = height / 2.0
        ground_x = x0 + (cx - tiepoint[0]) * sx
        ground_y = y0 - (cy - tiepoint[1]) * sy
    except (TypeError, ValueError, IndexError) as exc:
        return None, None, epsg, f"Unusable GeoTIFF georeferencing: {exc}", False

    if epsg == 4326:
        # Geographic, degrees directly.
        lat, lon = ground_y, ground_x
        # Approximate: 1 degree of latitude ~= 111320 m; ground size of a
        # degree pixel varies with latitude.
        mpp = sx * 111320.0 * max(0.15, math.cos(math.radians(lat)))
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return None, None, epsg, "GeoTIFF coordinates out of range.", False
        return {"lat": round(lat, 6), "lng": round(lon, 6)}, mpp, 4326, None, True

    if _is_projected_meter_epsg(epsg):
        # Projected (UTM meters). Convert the easting/northing to WGS84.
        code = int(epsg)
        if 32601 <= code <= 32660:
            zone, southern = code - 32600, False
        elif 32701 <= code <= 32760:
            zone, southern = code - 32700, True
        elif 25828 <= code <= 25838:
            zone, southern = code - 25800 + 1, False  # ETRS89 UTM zones 28..38 -> 29..39
        elif code in (3857, 3859):
            # Web Mercator -> inverse spherical Mercator.
            lat = math.degrees(2 * math.atan(math.exp(ground_y / 6378137.0)) - math.pi / 2)
            lon = math.degrees(ground_x / 6378137.0)
            return {"lat": round(lat, 6), "lng": round(lon, 6)}, sx, epsg, None, False
        else:
            return None, None, epsg, (
                f"GeoTIFF uses projected CRS EPSG:{epsg}; coordinate conversion is not "
                "implemented for this CRS. Install pyproj for full CRS support."
            ), False
        try:
            lat, lon = _utm_to_latlon(ground_x, ground_y, zone, southern)
        except Exception as exc:
            return None, None, epsg, f"UTM conversion failed: {exc}", False
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return None, None, epsg, "Converted coordinates out of range.", False
        return {"lat": round(lat, 6), "lng": round(lon, 6)}, sx, epsg, None, False

    # No usable CRS: only accept degree-like tiepoints conservatively.
    if abs(ground_x) <= 180 and abs(ground_y) <= 90 and sx < 1.0:
        warning = "GeoTIFF had no EPSG CRS; assumed geographic coordinates from tiepoint range."
        return {"lat": round(ground_y, 6), "lng": round(ground_x, 6)}, None, None, warning, False

    return None, None, epsg, (
        "GeoTIFF georeferencing present but CRS is not recognized. "
        "Install pyproj (or re-export in EPSG:4326 / UTM WGS84) for coordinate support."
    ), False


def _extract_gps(gps_info):
    """Convert raw GPS EXIF tags into readable form."""

    gps_data = {}

    for key in gps_info:
        name = GPSTAGS.get(key, key)
        gps_data[name] = gps_info[key]

    return gps_data


def extract_metadata(image_path):
    """
    Reads metadata from an image.

    Returns a dictionary containing:
        - Image size
        - Camera model
        - GPS availability (EXIF)
        - GeoTIFF georeferencing (raster geo, CRS, scale)
        - Metadata availability
        - Scale availability
        - Warning messages
    """

    metadata = {

        "image_path": image_path,

        "metadata_available": False,

        "gps_available": False,

        "gps_data": None,

        "camera_model": None,

        "camera_make": None,

        "image_width": None,

        "image_height": None,

        "capture_datetime": None,

        "scale_available": False,

        "meters_per_pixel": None,

        "scale_approximation": False,

        "crs_epsg": None,

        "raster_geo": None,

        "georef_warning": None,

        "warning": None
    }

    try:

        image = Image.open(image_path)

        metadata["image_width"] = image.width
        metadata["image_height"] = image.height

        # --------------------------------------------------
        # GeoTIFF georeferencing (ModelPixelScale / Tiepoint /
        # GeoKeyDirectory). Present before EXIF so projected
        # files provide both real scale and coordinates.
        # --------------------------------------------------

        if image.format == "TIFF":
            tags = image.tag_v2
            pixel_scale = tags.get(_TAG_PIXEL_SCALE)
            tiepoint = tags.get(_TAG_TIEPOINT)
            geokey_raw = tags.get(_TAG_GEOKEYDIR)
            geokeys = _parse_geokey_directory(geokey_raw) if geokey_raw else {}

            if pixel_scale and tiepoint:
                geo, mpp, epsg, warning, scale_approx = _geo_to_latlon(
                    tiepoint, pixel_scale, geokeys, image.width, image.height
                )
                metadata["crs_epsg"] = epsg
                metadata["raster_geo"] = geo
                metadata["georef_warning"] = warning
                metadata["gps_available"] = bool(geo)
                metadata["gps_data"] = geo
                if mpp is not None and mpp > 0:
                    metadata["scale_available"] = True
                    metadata["meters_per_pixel"] = mpp
                    metadata["scale_approximation"] = bool(scale_approx)

        # --------------------------------------------------
        # EXIF metadata
        # --------------------------------------------------

        exif = image.getexif()

        if exif is None or len(exif) == 0:

            if not metadata["gps_available"] and metadata["warning"] is None:
                metadata["warning"] = "No EXIF metadata found."

        else:

            metadata["metadata_available"] = True

            exif_data = {}

            for tag_id, value in exif.items():

                tag = TAGS.get(tag_id, tag_id)

                exif_data[tag] = value

            metadata["camera_make"] = exif_data.get("Make")

            metadata["camera_model"] = exif_data.get("Model")

            metadata["capture_datetime"] = exif_data.get("DateTime")

            if "GPSInfo" in exif_data and not metadata["gps_available"]:

                metadata["gps_available"] = True

                metadata["gps_data"] = _extract_gps(exif_data["GPSInfo"])

        # --------------------------------------------------
        # Drone images (DJI/Pix4D/Agisoft) may contain GSD
        # in XMP metadata. Future support.
        # --------------------------------------------------

    except Exception as e:

        metadata["warning"] = str(e)

    return metadata


if __name__ == "__main__":

    image_path = input("Enter image path: ")

    info = extract_metadata(image_path)

    print("\n----------- IMAGE METADATA -----------")

    for key, value in info.items():

        print(f"{key:20}: {value}")
