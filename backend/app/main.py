# backend/app/main.py
import os
import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from bson.objectid import ObjectId
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import status
from fastapi import Body
from fastapi import File, UploadFile, Form

from app.db import db
from app.ws_manager import manager
from app import recognition, scheduler
from app.utils import serialize_doc

load_dotenv()

app = FastAPI(title="Face RT Recognition Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to ["http://localhost:5173"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# static files
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(os.path.join(STATIC_DIR, "snapshots"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ApproveBody(BaseModel):
    name: str

class BadPersonBody(BaseModel):
    name: str
    reason: str = "" 


@app.on_event("startup")
async def startup_event():
    import asyncio
    asyncio.create_task(recognition.start_recognition_loop())
    scheduler.start_scheduler()


@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # heartbeat pings
    except WebSocketDisconnect:
        await manager.disconnect(ws)


# === Live Video Stream (MJPEG) ===
def generate_frames():
    import cv2
    while True:
        if recognition.last_frame is None:
            continue
        ret, buffer = cv2.imencode('.jpg', recognition.last_frame)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        )

@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# === API endpoints ===
@app.get("/users")
async def list_users():
    out = []
    cursor = db.users.find({})
    async for u in cursor:
        out.append(serialize_doc(u))
    return out

# ADD NEW USER FROM DASHBOARD
@app.post("/users")
async def create_user(
    name: str = Form(...),
    role: str = Form(""),
    note: str = Form(""),
    image: UploadFile = File(None),
):
    import os
    import datetime
    from app import recognition

    image_path = None
    embedding = None

    if image:
        image_name = f"{datetime.datetime.utcnow().timestamp()}_{image.filename}"
        save_path = os.path.join(STATIC_DIR, "snapshots", image_name)
        with open(save_path, "wb") as f:
            f.write(await image.read())
        image_path = f"/static/snapshots/{image_name}"

        emb = recognition.get_face_embedding_from_image(save_path)
        if emb is not None:
            embedding = emb.tolist()
            print("[create_user] embedding generated successfully")
        else:
            print("[create_user] no face found, embedding skipped")

    doc = {
        "name": name,
        "role": role,
        "note": note,
        "image_path": image_path,
        "embedding": embedding,
        "created_at": datetime.datetime.utcnow(),
    }

    res = await db.users.insert_one(doc)
    doc["_id"] = str(res.inserted_id)  # ✅ Fix JSON serialization issue

    await recognition.reload_known_embeddings()
    return {"success": True, "data": doc}



@app.get("/unknowns")
async def list_unknowns(limit: int = 50):
    out = []
    cursor = db.unknowns.find({}).sort("first_seen", -1).limit(limit)
    async for u in cursor:
        out.append(serialize_doc(u))
    return out

@app.get("/presence_events")
async def list_presence(limit: int = 100):
    out = []
    cursor = db.presence_events.find({}).sort("entry_time", -1).limit(limit)
    async for e in cursor:
        out.append(serialize_doc(e))
    return out

@app.post("/admin/approve_unknown/{unknown_id}")
async def approve_unknown(unknown_id: str, body: ApproveBody):
    unk = await db.unknowns.find_one({"_id": ObjectId(unknown_id)})
    if not unk:
        raise HTTPException(status_code=404, detail="unknown not found")
    user_doc = {
        "name": body.name,
        "image_path": unk.get("image_path"),
        "embedding": unk.get("embedding"),
        "first_seen": unk.get("first_seen"),
        "last_seen": unk.get("last_seen"),
        "created_at": datetime.datetime.utcnow(),
    }
    res = await db.users.insert_one(user_doc)
    await db.unknowns.delete_one({"_id": ObjectId(unknown_id)})
    await recognition.reload_known_embeddings()
    return {"user_id": str(res.inserted_id)}

@app.delete("/admin/ignore_unknown/{unknown_id}")
async def ignore_unknown(unknown_id: str):
    res = await db.unknowns.delete_one({"_id": ObjectId(unknown_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="unknown not found")
    return {"status": "ok", "unknown_id": unknown_id}

@app.post("/admin/generate_attendance/{date_str}")
async def generate_attendance(date_str: str):
    y, m, d = map(int, date_str.split("-"))
    target = datetime.date(y, m, d)
    await scheduler.generate_attendance_for_date(target)
    return {"status": "ok", "date": date_str}

@app.post("/admin/reload_embeddings")
async def reload_embeddings():
    await recognition.reload_known_embeddings()
    return {"status": "ok", "loaded": len(recognition.known_embeddings)}


@app.post("/admin/mark_bad_person/{unknown_id}")
async def mark_bad_person(unknown_id: str, body: BadPersonBody):
    unk = await db.unknowns.find_one({"_id": ObjectId(unknown_id)})
    if not unk:
        raise HTTPException(status_code=404, detail="unknown not found")
    
    bad_person_doc = {
        "name": body.name,
        "reason": body.reason,  # Store the reason/comment
        "image_path": unk.get("image_path"),
        "embedding": unk.get("embedding"),
        "first_seen": unk.get("first_seen"),
        "last_seen": unk.get("last_seen"),
        "created_at": datetime.datetime.utcnow(),
    }
    res = await db.bad_people.insert_one(bad_person_doc)
    await db.unknowns.delete_one({"_id": ObjectId(unknown_id)})
    await recognition.reload_bad_embeddings()  # Reload bad embeddings
    
    return {"bad_person_id": str(res.inserted_id)}

# DELETE USER
@app.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(user_id: str):
    """Delete a user by ID"""
    res = await db.users.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="user not found")
    # Optionally: cleanup from presence_events or unknowns if linked
    await recognition.reload_known_embeddings()  # refresh memory
    return {"status": "ok", "deleted_id": user_id}


# UPDATE USER
@app.put("/users/{user_id}")
async def update_user(user_id: str, body: dict = Body(...)):
    """Update user info (name, role, note)"""
    allowed_fields = {"name", "role", "note"}
    update_data = {k: v for k, v in body.items() if k in allowed_fields}

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"status": "ok", "updated_fields": update_data}


# -------------------------- BAD PEOPLE SECTION -----------------

@app.get("/bad_people")
async def list_bad_people(limit: int = 50):
    out = []
    cursor = db.bad_people.find({}).sort("created_at", -1).limit(limit)
    async for p in cursor:
        out.append(serialize_doc(p))
    return out

@app.delete("/delete_bad_person/{user_id}")
async def delete_bad_person(user_id: str):
    res = await db.bad_people.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="person not found")
    return {"status": "ok", "deleted_id": user_id}

@app.put("/update_bad_person/{user_id}")
async def update_bad_person(user_id: str, body: dict):
    fields = {k: v for k, v in body.items() if k in ["name", "role", "reason"]}
    if not fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    res = await db.bad_people.update_one({"_id": ObjectId(user_id)}, {"$set": fields})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="person not found")
    return {"status": "ok", "updated_id": user_id}


@app.post("/bad_people")
async def create_bad_person(
    name: str = Form(...),
    reason: str = Form(""),
    role: str = Form("bad"),
    image: UploadFile = File(None),
):
    """
    Create a bad person (from dashboard). Saves image, generates embedding via recognition,
    inserts into db.bad_people, reloads bad embeddings and returns serialized doc.
    """
    image_path = None
    embedding = None

    if image:
        # Save uploaded image
        image_name = f"{datetime.datetime.utcnow().timestamp()}_{image.filename}"
        save_path = os.path.join(STATIC_DIR, "snapshots", image_name)
        with open(save_path, "wb") as f:
            f.write(await image.read())
        image_path = f"/static/snapshots/{image_name}"

        # Generate embedding using recognition helper
        try:
            emb = recognition.get_face_embedding_from_image(save_path)
            if emb is not None:
                embedding = emb.tolist()
                print("[create_bad_person] embedding generated")
            else:
                print("[create_bad_person] no face found, embedding skipped")
        except Exception as ex:
            print("[create_bad_person] embedding error:", ex)

    doc = {
        "name": name,
        "role": role or "bad",
        "reason": reason,
        "image_path": image_path,
        "embedding": embedding,
        "created_at": datetime.datetime.utcnow(),
    }

    res = await db.bad_people.insert_one(doc)
    # make returned doc JSON-friendly
    doc["_id"] = str(res.inserted_id)

    # reload bad embeddings so system recognizes new bad person immediately
    await recognition.reload_bad_embeddings()

    return {"success": True, "data": doc}



# -------------------------- BAD PEOPLE SECTION -----------------






