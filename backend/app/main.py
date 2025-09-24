# backend/app/main.py
import os
import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from bson.objectid import ObjectId
from dotenv import load_dotenv
from app.utils import serialize_doc
from fastapi.middleware.cors import CORSMiddleware


from app.db import db
from app.ws_manager import manager
from app import recognition, scheduler

load_dotenv()

app = FastAPI(title="Face RT Recognition Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"]
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
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)

@app.get("/users")
async def list_users():
    out = []
    cursor = db.users.find({})
    async for u in cursor:
        # u["_id"] = str(u["_id"])
        # out.append(u)
        out.append(serialize_doc(u))
    return out

@app.get("/unknowns")
async def list_unknowns(limit: int = 50):
    out = []
    cursor = db.unknowns.find({}).sort("first_seen", -1).limit(limit)
    async for u in cursor:
        # u["_id"] = str(u["_id"])
        # out.append(u)
        out.append(serialize_doc(u))
    return out

@app.get("/presence_events")
async def list_presence(limit: int = 100):
    out = []
    cursor = db.presence_events.find({}).sort("entry_time", -1).limit(limit)
    async for e in cursor:
        # e["_id"] = str(e["_id"])
        # out.append(e)
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
