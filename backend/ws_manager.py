import asyncio
from fastapi import WebSocket

class ConnectionManager:

    def __init__(self):
        self.active_connections = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

        async with self.lock:
            self.active_connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead = set()

        async with self.lock:
            connections = list(self.active_connections)

        for conn in connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.add(conn)

        if dead:
            async with self.lock:
                self.active_connections -= dead