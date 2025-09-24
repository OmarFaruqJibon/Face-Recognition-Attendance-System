import os
import asyncio
import datetime
import numpy as np
import cv2
from bson.objectid import ObjectId
from dotenv import load_dotenv

from app.db import db
from app.ws_manager import manager
from app.utils import save_bgr_image

load_dotenv()

INSIGHTFACE_CTX_ID = int(os.getenv("INSIGHTFACE_CTX_ID", "-1"))
THRESHOLD = float(os.getenv("THRESHOLD", "1.2"))
RESIZE_WIDTH = int(os.getenv("RESIZE_WIDTH", "480"))
ABSENCE_TIMEOUT = int(os.getenv("ABSENCE_TIMEOUT", "5"))

model = None
known_embeddings: dict = {}  # user_id -> np.array
user_names: dict = {}        # user_id -> name
active_presence: dict = {}   # key -> presence info

last_frame = None  # global annotated frame for streaming


def load_model():
    global model
    if model is None:
        import insightface
        model = insightface.app.FaceAnalysis(name="buffalo_l")
        model.prepare(ctx_id=INSIGHTFACE_CTX_ID, det_size=(640, 640))
    return model


async def reload_known_embeddings():
    """Reload embeddings cache from DB, including names."""
    global known_embeddings, user_names
    known_embeddings = {}
    user_names = {}
    cursor = db.users.find({})
    async for u in cursor:
        if "embedding" in u and u["embedding"]:
            uid = str(u["_id"])
            known_embeddings[uid] = np.array(u["embedding"], dtype=np.float32)
            user_names[uid] = u.get("name", f"User {uid[:4]}")
    print(f"[recognition] loaded {len(known_embeddings)} known embeddings")


def match_known(emb: np.ndarray):
    best_id = None
    best_dist = float("inf")
    for uid, kev in known_embeddings.items():
        d = float(np.linalg.norm(emb - kev))
        if d < best_dist:
            best_dist = d
            best_id = uid
    return best_id, best_dist


async def start_recognition_loop():
    global last_frame
    load_model()
    await reload_known_embeddings()
    loop = asyncio.get_running_loop()
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("[recognition] WARNING: camera 0 could not be opened")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.5)
                continue

            h, w = frame.shape[:2]
            new_h = int(h * RESIZE_WIDTH / w)
            frame_small = cv2.resize(frame, (RESIZE_WIDTH, new_h))

            try:
                faces = await loop.run_in_executor(None, model.get, frame_small)
            except Exception as ex:
                print("[recognition] inference error:", ex)
                faces = []

            now = datetime.datetime.utcnow()
            processed_keys = set()

            # draw faces
            for face in faces:
                emb = face.normed_embedding
                uid, dist = match_known(emb)

                x1, y1, x2, y2 = face.bbox.astype(int)
                label = "Unknown"
                color = (0, 0, 255)

                if uid is not None and dist <= THRESHOLD:
                    label = user_names.get(uid, f"User {uid[:4]}")
                    color = (255, 0, 255)

                cv2.rectangle(frame_small, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame_small, label, (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

                # === presence logic ===
                if uid is not None and dist <= THRESHOLD:
                    key = f"known:{uid}"
                    if key not in active_presence:
                        snapshot_path = save_bgr_image(frame_small)
                        ev = {
                            "user_id": ObjectId(uid),
                            "entry_time": now,
                            "exit_time": None,
                            "snapshot_path": snapshot_path,
                        }
                        res = await db.presence_events.insert_one(ev)
                        active_presence[key] = {
                            "id": uid,
                            "event_id": res.inserted_id,
                            "entry_time": now,
                            "last_seen": now,
                        }
                        await manager.broadcast_json({
                            "type": "known",
                            "user_id": uid,
                            "name": label,
                            "first_seen": now.isoformat(),
                            "snapshot": snapshot_path,
                        })
                    else:
                        active_presence[key]["last_seen"] = now
                        await manager.broadcast_json({
                            "type": "known",
                            "user_id": uid,
                            "name": label,
                            "last_seen": now.isoformat(),
                        })
                    processed_keys.add(key)

                else:
                    snapshot_path = save_bgr_image(frame_small)
                    unknown_doc = {
                        "image_path": snapshot_path,
                        "embedding": emb.tolist(),
                        "first_seen": now,
                        "last_seen": now,
                        "alert_sent": True,
                    }
                    res = await db.unknowns.insert_one(unknown_doc)
                    unknown_id = str(res.inserted_id)
                    key = f"unknown:{unknown_id}"
                    active_presence[key] = {
                        "id": unknown_id,
                        "event_id": None,
                        "entry_time": now,
                        "last_seen": now,
                    }
                    await manager.broadcast_json({
                        "type": "unknown",
                        "unknown_id": unknown_id,
                        "image_path": snapshot_path,
                        "first_seen": now.isoformat(),
                    })
                    processed_keys.add(key)

            # cleanup old presence
            to_remove = []
            for key, info in list(active_presence.items()):
                if (now - info["last_seen"]).total_seconds() > ABSENCE_TIMEOUT:
                    exit_time = info["last_seen"]
                    duration = (exit_time - info["entry_time"]).total_seconds()
                    if info["event_id"]:
                        await db.presence_events.update_one(
                            {"_id": info["event_id"]},
                            {"$set": {
                                "exit_time": exit_time,
                                "duration_seconds": duration
                            }},
                        )
                    await manager.broadcast_json({
                        "type": "presence_end",
                        "id": info["id"],
                        "duration_seconds": duration,
                        "exit_time": exit_time.isoformat(),
                    })
                    to_remove.append(key)
            for k in to_remove:
                active_presence.pop(k, None)

            # update annotated frame for streaming
            last_frame = frame_small

            await asyncio.sleep(0.05)
    finally:
        cap.release()
