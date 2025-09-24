# backend/app/utils.py
import os
import uuid
import cv2
from PIL import Image

import datetime
from bson import ObjectId


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATIC_DIR = os.path.join(BASE_DIR, "static")
SNAPSHOT_DIR = os.path.join(STATIC_DIR, "snapshots")

os.makedirs(SNAPSHOT_DIR, exist_ok=True)

def save_bgr_image(bgr_img) -> str:
    """Save BGR (OpenCV) image to static/snapshots and return web path."""
    filename = f"{uuid.uuid4().hex}.jpg"
    path = os.path.join(SNAPSHOT_DIR, filename)
    rgb = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(path, format="JPEG", quality=85)
    return f"/static/snapshots/{filename}"

def serialize_doc(value):
    """Recursively convert MongoDB docs into JSON-safe values."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: serialize_doc(v) for k, v in value.items()}
    if isinstance(value, list):
        return [serialize_doc(v) for v in value]
    return value