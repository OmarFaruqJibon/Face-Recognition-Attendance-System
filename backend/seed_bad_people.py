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

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env") 

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "face_db")
INSIGHTFACE_CTX_ID = int(os.getenv("INSIGHTFACE_CTX_ID", "-1"))
BAD_PEOPLE_DIR = BASE_DIR / "bad_people"
SNAPSHOT_DIR = BASE_DIR / "static" / "snapshots"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def is_image_file(p: Path):
    return p.is_file() and p.suffix.lower() in IMG_EXTS

def save_snapshot_bgr(bgr_img):
    filename = f"{uuid.uuid4().hex}.jpg"
    out_path = SNAPSHOT_DIR / filename
    rgb = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(out_path, format="JPEG", quality=85)
    return f"/static/snapshots/{filename}"

def load_insightface_model():
    import insightface
    print("[seed_bad] Loading InsightFace model...")
    model = insightface.app.FaceAnalysis(name="buffalo_l")
    model.prepare(ctx_id=INSIGHTFACE_CTX_ID, det_size=(640, 640))
    return model

def extract_embedding_from_image(model, img_bgr):
    try:
        faces = model.get(img_bgr)
    except Exception as e:
        print("[seed_bad] model.get() error:", e)
        return None
    if not faces:
        return None
    return np.array(faces[0].normed_embedding, dtype=np.float32)

def seed_from_image(model, img_path: Path):
    name = img_path.stem
    if db.bad_people.find_one({"name": name}):
        print(f"[seed_bad] '{name}' already exists in bad_people, skipping")
        return False

    img = cv2.imread(str(img_path))
    if img is None:
        print(f"[seed_bad] cannot read {img_path}, skipping")
        return False

    emb = extract_embedding_from_image(model, img)
    if emb is None:
        print(f"[seed_bad] no face in {img_path}, skipping")
        return False

    snapshot_path = save_snapshot_bgr(img)
    doc = {
        "name": name,
        "role": "bad",
        "embedding": emb.tolist(), 
        "image_path": snapshot_path,
        "created_at": datetime.utcnow(),
    }
    db.bad_people.insert_one(doc)
    print(f"[seed_bad] added bad person '{name}'")
    return True

def main():
    if not BAD_PEOPLE_DIR.exists() or not any(BAD_PEOPLE_DIR.iterdir()):
        print(f"[seed_bad] Folder missing or empty: {BAD_PEOPLE_DIR}")
        sys.exit(1)

    model = load_insightface_model()
    added = 0
    for entry in sorted(BAD_PEOPLE_DIR.iterdir()):
        if is_image_file(entry):
            if seed_from_image(model, entry):
                added += 1
    print(f"[seed_bad] finished. Total new bad people added: {added}")

if __name__ == "__main__":
    main()
