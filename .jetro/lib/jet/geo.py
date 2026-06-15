"""jet.geo -- Geospatial utilities for Jetro refresh scripts.

Usage:
  from jet.geo import haversine, bbox, to_geojson_feature, to_geojson_collection
  from jet.geo import to_cesium_entities, grid_points, bearing, destination_point
"""

import json
import math


def haversine(lat1, lon1, lat2, lon2):
    """Distance between two points in km (Haversine formula)."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def bearing(lat1, lon1, lat2, lon2):
    """Initial bearing from point 1 to point 2 in degrees."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = (math.cos(lat1) * math.sin(lat2) -
         math.sin(lat1) * math.cos(lat2) * math.cos(dlon))
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def destination_point(lat, lon, bearing_deg, distance_km):
    """Calculate destination point given start, bearing, and distance."""
    R = 6371
    d = distance_km / R
    brng = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(math.sin(lat1) * math.cos(d) +
                      math.cos(lat1) * math.sin(d) * math.cos(brng))
    lon2 = lon1 + math.atan2(math.sin(brng) * math.sin(d) * math.cos(lat1),
                              math.cos(d) - math.sin(lat1) * math.sin(lat2))
    return math.degrees(lat2), math.degrees(lon2)


def bbox(center_lat, center_lon, radius_km):
    """Bounding box around a center point."""
    dlat = radius_km / 111.32
    dlon = radius_km / (111.32 * math.cos(math.radians(center_lat)))
    return {
        "south": center_lat - dlat, "north": center_lat + dlat,
        "west": center_lon - dlon, "east": center_lon + dlon,
    }


def grid_points(south, west, north, east, step_km=10):
    """Generate a grid of lat/lon points within a bounding box."""
    step_lat = step_km / 111.32
    step_lon = step_km / (111.32 * math.cos(math.radians((south + north) / 2)))
    points = []
    lat = south
    while lat <= north:
        lon = west
        while lon <= east:
            points.append((lat, lon))
            lon += step_lon
        lat += step_lat
    return points


def to_geojson_feature(id, lat, lon, properties=None, geometry_type="Point"):
    """Create a GeoJSON Feature."""
    return {"type": "Feature", "id": id,
            "geometry": {"type": geometry_type, "coordinates": [lon, lat]},
            "properties": properties or {}}


def to_geojson_collection(features):
    """Wrap features in a FeatureCollection."""
    return {"type": "FeatureCollection", "features": features}


def to_cesium_entities(data, id_field="id", lat_field="lat", lon_field="lon",
                       label_field="name"):
    """Convert tabular data to Cesium entity format for refresh scripts.

    Args:
        data: List of dicts with at least id, lat, lon fields
        id_field, lat_field, lon_field, label_field: column names

    Returns:
        List of dicts with id, lat, lon, label + extra fields
    """
    return [{
        "id": row[id_field], "lat": row[lat_field], "lon": row[lon_field],
        "label": row.get(label_field, ""),
        **{k: v for k, v in row.items()
           if k not in (id_field, lat_field, lon_field, label_field)}
    } for row in data]


def to_layer_update(layer_id, data):
    """Format layer data for 3D frame refresh output.

    Usage in refresh scripts:
      print(json.dumps({
          "layers": {
              "ships": to_layer_update("ships", ship_data)
          }
      }))
    """
    return {"data": data}
