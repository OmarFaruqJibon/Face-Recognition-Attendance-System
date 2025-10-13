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
known_embeddings: dict = {}   # user_id -> np.array
user_names: dict = {}         # user_id -> name
bad_embeddings: dict = {}     # bad_id -> np.array
bad_names: dict = {}          # bad_id -> name
active_presence: dict = {}    # key -> presence info; keys: known:<uid>, bad:<bid>, unknown:<unknown_id>

last_frame = None  # global annotated frame for streaming


# ==========================================================
#   Model loading
# ==========================================================
def load_model():
    global model
    if model is None:
        import insightface
        model = insightface.app.FaceAnalysis(name="buffalo_l")
        model.prepare(ctx_id=INSIGHTFACE_CTX_ID, det_size=(640, 640))
    return model


# ==========================================================
#   Embeddings loading
# ==========================================================
async def reload_known_embeddings():
    """Reload embeddings for known users."""
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


async def reload_bad_embeddings():
    """Reload embeddings for bad people."""
    global bad_embeddings, bad_names
    bad_embeddings = {}
    bad_names = {}
    cursor = db.bad_people.find({})
    async for b in cursor:
        if "embedding" in b and b["embedding"]:
            bid = str(b["_id"])
            bad_embeddings[bid] = np.array(b["embedding"], dtype=np.float32)
            bad_names[bid] = b.get("name", f"Bad {bid[:4]}")
    print(f"[recognition] loaded {len(bad_embeddings)} bad embeddings")


# ==========================================================
#   Matching helpers
# ==========================================================
def match_known(emb: np.ndarray):
    best_id = None
    best_dist = float("inf")
    for uid, kev in known_embeddings.items():
        d = float(np.linalg.norm(emb - kev))
        if d < best_dist:
            best_dist = d
            best_id = uid
    return best_id, best_dist


def match_bad(emb: np.ndarray):
    best_id = None
    best_dist = float("inf")
    for bid, bev in bad_embeddings.items():
        d = float(np.linalg.norm(emb - bev))
        if d < best_dist:
            best_dist = d
            best_id = bid
    return best_id, best_dist


# ==========================================================
#   Recognition loop
# ==========================================================
async def start_recognition_loop():
    global last_frame
    load_model()
    await reload_known_embeddings()
    await reload_bad_embeddings()
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

            for face in faces:
                emb = face.normed_embedding.astype(np.float32)

                # Match order: BAD -> KNOWN -> UNKNOWN
                bid, bad_dist = match_bad(emb)        # best bad match
                uid, dist = match_known(emb)         # best known match

                x1, y1, x2, y2 = face.bbox.astype(int)
                label = "Unknown"
                main_color = (0, 255, 255)  # yellow for unknown
                outline_color = (255, 255, 255)

                # ==========================================================
                #   BAD PERSON DETECTED (use active_presence to avoid spam)
                # ==========================================================
                if bid is not None and bad_dist <= THRESHOLD:
                    label = f"Bad People: {bad_names.get(bid, 'Suspect')}"
                    main_color = (0, 0, 255)  # red
                    outline_color = (255, 255, 255)

                    key = f"bad:{bid}"
                    if key not in active_presence:
                        # first sighting -> save snapshot and send one alert
                        snapshot_path = save_bgr_image(frame_small)
                        await manager.broadcast_json({
                            "type": "alert_bad",
                            "bad_id": bid,
                            "name": bad_names.get(bid),
                            "snapshot": snapshot_path,
                            "first_seen": now.isoformat(),
                        })
                        print(f"[ALERT] Bad person detected: {bad_names.get(bid)}")

                        # track presence (no DB event for bad by default, set event_id None)
                        active_presence[key] = {
                            "id": bid,
                            "event_id": None,
                            "entry_time": now,
                            "last_seen": now,
                            "embedding": emb,   # store embedding for robustness
                            "type": "bad",
                        }
                    else:
                        # update last_seen only; do not re-alert or re-save snapshots
                        active_presence[key]["last_seen"] = now
                        # optional broadcast update to show still present
                        await manager.broadcast_json({
                            "type": "alert_bad_update",
                            "bad_id": bid,
                            "name": bad_names.get(bid),
                            "last_seen": now.isoformat(),
                        })
                    processed_keys.add(key)

                # ==========================================================
                #   KNOWN PERSON DETECTED (existing behavior)
                # ==========================================================
                elif uid is not None and dist <= THRESHOLD:
                    label = user_names.get(uid, f"User {uid[:4]}")
                    main_color = (0, 255, 0)  # green
                    outline_color = (255, 255, 255)

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
                            "type": "known",
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

                # ==========================================================
                #   UNKNOWN PERSON DETECTED (de-duplicate by embedding)
                # ==========================================================
                else:
                    # Attempt to match this unknown against currently tracked unknown presences
                    matched_unknown_key = None
                    matched_unknown_dist = float("inf")
                    for key, info in active_presence.items():
                        if not key.startswith("unknown:"):
                            continue
                        stored_emb = info.get("embedding")
                        if stored_emb is None:
                            continue
                        # compute distance
                        d = float(np.linalg.norm(emb - stored_emb))
                        if d < matched_unknown_dist:
                            matched_unknown_dist = d
                            matched_unknown_key = key

                    if matched_unknown_key and matched_unknown_dist <= THRESHOLD:
                        # treat as the same unknown person currently tracked
                        active_presence[matched_unknown_key]["last_seen"] = now
                        # optional broadcast to update unknown presence
                        await manager.broadcast_json({
                            "type": "unknown",
                            "unknown_id": active_presence[matched_unknown_key]["id"],
                            "last_seen": now.isoformat(),
                        })
                        processed_keys.add(matched_unknown_key)
                    else:
                        # New unknown -> save snapshot + DB insert + track in active_presence
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
                            "embedding": emb,   # store embedding for later matching
                            "type": "unknown",
                        }
                        await manager.broadcast_json({
                            "type": "unknown",
                            "unknown_id": unknown_id,
                            "image_path": snapshot_path,
                            "first_seen": now.isoformat(),
                        })
                        processed_keys.add(key)

                # ==========================================================
                #   Draw labels
                # ==========================================================
                try:
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    scale = 0.8
                    thickness = 2
                    (text_w, text_h), _ = cv2.getTextSize(label, font, scale, thickness)
                    frame_h, frame_w = frame_small.shape[:2]
                    text_x = int((x1 + x2) / 2 - text_w / 2)
                    text_y = y1 - 40
                    text_x = max(0, min(text_x, frame_w - text_w))
                    if text_y - text_h < 0:
                        text_y = text_h + 5
                    cv2.putText(frame_small, label, (text_x, text_y),
                                font, scale, outline_color, thickness + 2, cv2.LINE_AA)
                    cv2.putText(frame_small, label, (text_x, text_y),
                                font, scale, main_color, thickness, cv2.LINE_AA)
                except Exception:
                    # drawing should not break the loop
                    pass

            # ==========================================================
            #   Cleanup old presence events (people who left)
            # ==========================================================
            to_remove = []
            for key, info in list(active_presence.items()):
                if (now - info["last_seen"]).total_seconds() > ABSENCE_TIMEOUT:
                    exit_time = info["last_seen"]
                    duration = (exit_time - info["entry_time"]).total_seconds()
                    # If this presence corresponds to a presence_events DB doc (known users),
                    # update that doc with exit_time and duration. For bad/unknown we used event_id None.
                    if info.get("event_id"):
                        await db.presence_events.update_one(
                            {"_id": info["event_id"]},
                            {"$set": {
                                "exit_time": exit_time,
                                "duration_seconds": duration
                            }},
                        )
                    # notify clients that presence ended
                    await manager.broadcast_json({
                        "type": "presence_end",
                        "id": info["id"],
                        "duration_seconds": duration,
                        "exit_time": exit_time.isoformat(),
                        "presence_type": info.get("type"),
                    })
                    to_remove.append(key)

            for k in to_remove:
                active_presence.pop(k, None)

            # update annotated frame for streaming
            last_frame = frame_small

            await asyncio.sleep(0.05)
    finally:
        cap.release()
