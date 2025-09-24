# backend/seed_users.py
"""
Seed known users into MongoDB from an `images/` folder.

Place person images like either:
  backend/images/John.jpg
  backend/images/Jane.png
or
  backend/images/John/1.jpg
  backend/images/John/2.jpg
"""

import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from dotenv import load_dotenv
from pymongo import MongoClient

# --- config (read .env if present) ---
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "face_db")
INSIGHTFACE_CTX_ID = int(os.getenv("INSIGHTFACE_CTX_ID", "-1"))  # -1 CPU, 0 GPU

IMAGES_DIR = BASE_DIR / "images"
SNAPSHOT_DIR = BASE_DIR / "static" / "snapshots"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

# Accept image extensions
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}

# --- connect to DB ---
client = MongoClient(MONGO_URI)
db = client[DB_NAME]


def is_image_file(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() in IMG_EXTS


def save_snapshot_bgr(bgr_img) -> str:
    """Save cv2 BGR image to static/snapshots and return web path like /static/snapshots/<name>.jpg"""
    filename = f"{uuid.uuid4().hex}.jpg"
    out_path = SNAPSHOT_DIR / filename
    rgb = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(out_path, format="JPEG", quality=85)
    return f"/static/snapshots/{filename}"


def load_insightface_model():
    import insightface
    print("[seed] Loading InsightFace model (this may take a while)...")
    model = insightface.app.FaceAnalysis(name="buffalo_l")
    model.prepare(ctx_id=INSIGHTFACE_CTX_ID, det_size=(640, 640))
    return model


def extract_embedding_from_image(model, img_bgr):
    """Return numpy array embedding or None if no face found."""
    try:
        faces = model.get(img_bgr)
    except Exception as e:
        print("[seed] model.get() error:", e)
        return None

    if not faces:
        return None
    # take the first detected face
    emb = faces[0].normed_embedding
    return np.array(emb, dtype=np.float32)


def seed_from_person_folder(model, person_dir: Path, name: str):
    # check if already exists
    if db.users.find_one({"name": name}):
        print(f"[seed] user with name '{name}' already exists in DB, skipping")
        return False

    embeddings = []
    snapshot_img = None

    for f in sorted(person_dir.iterdir()):
        if not is_image_file(f):
            continue
        img = cv2.imread(str(f))
        if img is None:
            print(f"[seed] cannot read {f}, skipping")
            continue
        emb = extract_embedding_from_image(model, img)
        if emb is not None:
            embeddings.append(emb)
            if snapshot_img is None:
                snapshot_img = img  # first valid face image
        else:
            print(f"[seed] no face in {f}, skipping")

    if not embeddings:
        print(f"[seed] no valid faces for person {name}, skipping")
        return False

    avg_emb = np.mean(np.stack(embeddings, axis=0), axis=0)
    snapshot_path = save_snapshot_bgr(snapshot_img)

    doc = {
        "name": name,
        "role": "employee",
        "embedding": avg_emb.astype(np.float32).tolist(),
        "image_path": snapshot_path,
        "created_at": datetime.utcnow(),
    }
    db.users.insert_one(doc)
    print(f"[seed] added user '{name}' (from folder)")
    return True


def seed_from_single_image(model, img_path: Path):
    name = img_path.stem
    if db.users.find_one({"name": name}):
        print(f"[seed] user with name '{name}' already exists in DB, skipping")
        return False

    img = cv2.imread(str(img_path))
    if img is None:
        print(f"[seed] cannot read {img_path}, skipping")
        return False

    emb = extract_embedding_from_image(model, img)
    if emb is None:
        print(f"[seed] no face found in {img_path}, skipping")
        return False

    snapshot_path = save_snapshot_bgr(img)
    doc = {
        "name": name,
        "role": "employee",
        "embedding": emb.astype(np.float32).tolist(),
        "image_path": snapshot_path,
        "created_at": datetime.utcnow(),
    }
    db.users.insert_one(doc)
    print(f"[seed] added user '{name}' (from single image)")
    return True


def main():
    # make sure images folder exists
    if not IMAGES_DIR.exists() or not any(IMAGES_DIR.iterdir()):
        print(f"[seed] images directory is empty or missing: {IMAGES_DIR}")
        print("Place images at backend/images/ or create subfolders (backend/images/<name>/...).")
        sys.exit(1)

    model = load_insightface_model()

    added = 0
    for entry in sorted(IMAGES_DIR.iterdir()):
        if entry.is_dir():
            name = entry.name
            ok = seed_from_person_folder(model, entry, name)
            if ok:
                added += 1
        elif is_image_file(entry):
            ok = seed_from_single_image(model, entry)
            if ok:
                added += 1

    print(f"[seed] finished. Total new users added: {added}")


if __name__ == "__main__":
    main()
