# backend/app/ws_manager.py
import asyncio
from fastapi import WebSocket
from typing import Set

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active_connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            self.active_connections.discard(websocket)

    async def broadcast_json(self, message: dict):
        async with self.lock:
            to_remove = []
            for ws in list(self.active_connections):
                try:
                    await ws.send_json(message)
                except Exception:
                    to_remove.append(ws)
            for r in to_remove:
                self.active_connections.discard(r)


manager = ConnectionManager()
