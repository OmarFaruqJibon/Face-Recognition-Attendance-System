# backend/app/recognition.py

import os
import asyncio
import datetime
import numpy as np
import cv2
from bson.objectid import ObjectId
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageFilter

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
user_names: dict = {}  # user_id -> name
user_notes: dict = {}  # user_id -> note (new)
bad_embeddings: dict = {}  # bad_id -> np.array
bad_names: dict = {}  # bad_id -> {name, reason}
active_presence: dict = {}  # key -> presence info
last_frame = None  # global annotated frame for streaming


# ===================================================
# Model Loading
# ===================================================
def load_model():
    global model
    if model is None:
        import insightface
        model = insightface.app.FaceAnalysis(name="buffalo_l")
        model.prepare(ctx_id=INSIGHTFACE_CTX_ID, det_size=(640, 640))
    return model


def get_face_embedding_from_image(img_path: str):
    """Returns the first detected face embedding from image_path."""
    try:
        load_model()
        img = cv2.imread(img_path)
        if img is None:
            print("[get_face_embedding] Could not read image:", img_path)
            return None
        faces = model.get(img)
        if not faces:
            print("[get_face_embedding] No face detected in:", img_path)
            return None
        emb = faces[0].normed_embedding.astype(np.float32)
        return emb
    except Exception as e:
        print("[get_face_embedding] Error:", e)
        return None


# ===================================================
# Embeddings Loading
# ===================================================
async def reload_known_embeddings():
    """Reload embeddings for known users and store name + note."""
    global known_embeddings, user_names, user_notes
    known_embeddings = {}
    user_names = {}
    user_notes = {}
    cursor = db.users.find({})
    async for u in cursor:
        if "embedding" in u and u["embedding"]:
            uid = str(u["_id"])
            try:
                known_embeddings[uid] = np.array(u["embedding"], dtype=np.float32)
            except Exception:
                # defensive: skip if embedding malformed
                continue
            # store name and note (note may be missing)
            user_names[uid] = u.get("name", f"User {uid[:4]}")
            user_notes[uid] = u.get("note", "")  # <-- uses note field from DB
    print(f"[recognition] loaded {len(known_embeddings)} known embeddings")


async def reload_bad_embeddings():
    global bad_embeddings, bad_names
    bad_embeddings = {}
    bad_names = {}
    cursor = db.bad_people.find({})
    async for b in cursor:
        if "embedding" in b and b["embedding"]:
            bid = str(b["_id"])
            bad_embeddings[bid] = np.array(b["embedding"], dtype=np.float32)
            bad_names[bid] = {
                "name": b.get("name", f"Bad {bid[:4]}"),
                "reason": b.get("reason", ""),
            }
    print(f"[recognition] loaded {len(bad_embeddings)} bad embeddings")


# ===================================================
# Matching Helpers
# ===================================================
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


# ===================================================
# Beautiful Label Renderer
# ===================================================
def draw_ai_label(frame, x1, y1, x2, y2, person_type, name=None, note=None):
    try:
        # --- Convert OpenCV -> PIL ---
        img_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(img_pil, "RGBA")

        # --- Fonts ---
        font_title = ImageFont.truetype("fonts/Roboto-Bold.ttf", 14)
        font_note = ImageFont.truetype("fonts/Roboto-Italic.ttf", 10)

        # --- Label content & colors ---
        if person_type == "known":
            grad_start, grad_end = (80, 255, 150, 180), (30, 150, 90, 140)
            title_color, note_color = (20, 60, 20), (50, 50, 50)
            lines = [name or "Known Person"]
            if note:
                lines.append(note)

        elif person_type == "bad":
            grad_start, grad_end = (255, 70, 70, 200), (180, 0, 0, 160)
            title_color, note_color = (255, 255, 255), (235, 235, 235)
            lines = [name or "Suspect"]
            if note:
                lines.append(note)

        else:
            grad_start, grad_end = (255, 170, 60, 200), (240, 110, 0, 150)
            title_color, note_color = (255, 255, 255), (245, 245, 245)
            lines = ["Unknown"]

        # --- Measure text area ---
        text_boxes = [
            draw.textbbox((0, 0), line, font=font_title if i == 0 else font_note)
            for i, line in enumerate(lines)
        ]
        width = max(w - x for x, y, w, h in text_boxes) + 28
        height = sum(h - y for x, y, w, h in text_boxes) + 24 + (len(lines) - 1) * 5

        # --- Position ---
        text_x = x1
        text_y = max(0, y1 - height - 50)
        radius = 10

        # --- Translucent gradient background ---
        gradient = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        grad_draw = ImageDraw.Draw(gradient)
        for y in range(height):
            r = int(grad_start[0] + (grad_end[0] - grad_start[0]) * (y / height))
            g = int(grad_start[1] + (grad_end[1] - grad_start[1]) * (y / height))
            b = int(grad_start[2] + (grad_end[2] - grad_start[2]) * (y / height))
            a = int(grad_start[3] + (grad_end[3] - grad_start[3]) * (y / height))
            grad_draw.line([(0, y), (width, y)], fill=(r, g, b, a))

        # --- Rounded rectangle mask ---
        mask = Image.new("L", (width, height), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([(0, 0), (width, height)], radius=radius, fill=255)

        # --- Paste translucent gradient card ---
        img_pil.paste(gradient, (text_x, text_y), mask)

        # --- Draw text ---
        ty = text_y + 12
        for i, line in enumerate(lines):
            color = title_color if i == 0 else note_color
            font = font_title if i == 0 else font_note
            draw.text((text_x + 14, ty), line, font=font, fill=color)
            ty += (text_boxes[i][3] - text_boxes[i][1]) + 6

        # --- Back to OpenCV ---
        frame = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
        return frame

    except Exception as e:
        print("[draw_ai_label] error:", e)
        return frame

    
    
    
    
    
    
# ===================================================
# Recognition Loop
# ===================================================
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
                bid, bad_dist = match_bad(emb)
                uid, dist = match_known(emb)
                x1, y1, x2, y2 = face.bbox.astype(int)

                # BAD PERSON
                if bid is not None and bad_dist <= THRESHOLD:
                    bad_info = bad_names.get(bid, {})
                    name = bad_info.get("name", f"Suspect {bid[:4]}")
                    reason = bad_info.get("reason", "")
                    key = f"bad:{bid}"

                    if key not in active_presence:
                        snapshot_path = save_bgr_image(frame_small)
                        await manager.broadcast_json({
                            "type": "alert_bad",
                            "bad_id": bid,
                            "name": name,
                            "reason": reason,
                            "snapshot": snapshot_path,
                            "first_seen": now.isoformat(),
                        })
                        print(f"[ALERT] Bad person detected: {name} - {reason}")
                        active_presence[key] = {
                            "id": bid,
                            "event_id": None,
                            "entry_time": now,
                            "last_seen": now,
                            "embedding": emb,
                            "type": "bad",
                        }
                    else:
                        active_presence[key]["last_seen"] = now
                        await manager.broadcast_json({
                            "type": "alert_bad_update",
                            "bad_id": bid,
                            "name": name,
                            "reason": reason,
                            "last_seen": now.isoformat(),
                        })
                    processed_keys.add(key)
                    frame_small = draw_ai_label(frame_small, x1, y1, x2, y2, "bad", name, reason)

                # KNOWN PERSON
                elif uid is not None and dist <= THRESHOLD:
                    # Get name and note from previously loaded maps
                    name = user_names.get(uid, f"User {uid[:4]}")
                    note = user_notes.get(uid, "")

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
                            "name": name,
                            "note": note,              # include note in broadcast
                            "first_seen": now.isoformat(),
                            "snapshot": snapshot_path,
                        })
                    else:
                        active_presence[key]["last_seen"] = now
                        await manager.broadcast_json({
                            "type": "known",
                            "user_id": uid,
                            "name": name,
                            "note": note,              # include note in update
                            "last_seen": now.isoformat(),
                        })
                    processed_keys.add(key)
                    # Draw label using name + note from DB (note displayed as comment line)
                    frame_small = draw_ai_label(frame_small, x1, y1, x2, y2, "known", name, note)

                # UNKNOWN PERSON
                else:
                    matched_unknown_key = None
                    matched_unknown_dist = float("inf")
                    for key, info in active_presence.items():
                        if not key.startswith("unknown:"):
                            continue
                        stored_emb = info.get("embedding")
                        if stored_emb is None:
                            continue
                        d = float(np.linalg.norm(emb - stored_emb))
                        if d < matched_unknown_dist:
                            matched_unknown_dist = d
                            matched_unknown_key = key

                    if matched_unknown_key and matched_unknown_dist <= THRESHOLD:
                        active_presence[matched_unknown_key]["last_seen"] = now
                        await manager.broadcast_json({
                            "type": "unknown",
                            "unknown_id": active_presence[matched_unknown_key]["id"],
                            "last_seen": now.isoformat(),
                        })
                        processed_keys.add(matched_unknown_key)
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
                            "embedding": emb,
                            "type": "unknown",
                        }
                        await manager.broadcast_json({
                            "type": "unknown",
                            "unknown_id": unknown_id,
                            "image_path": snapshot_path,
                            "first_seen": now.isoformat(),
                        })
                        processed_keys.add(key)
                    frame_small = draw_ai_label(frame_small, x1, y1, x2, y2, "unknown")

            # Cleanup
            to_remove = []
            for key, info in list(active_presence.items()):
                if (now - info["last_seen"]).total_seconds() > ABSENCE_TIMEOUT:
                    exit_time = info["last_seen"]
                    duration = (exit_time - info["entry_time"]).total_seconds()
                    if info.get("event_id"):
                        await db.presence_events.update_one(
                            {"_id": info["event_id"]},
                            {"$set": {
                                "exit_time": exit_time,
                                "duration_seconds": duration
                            }}
                        )
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

            last_frame = frame_small
            await asyncio.sleep(0.05)

    finally:
        cap.release()
