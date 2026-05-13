from fastapi import WebSocket


class ConnectionManager:

    def __init__(self):
        self.active_connections = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead = set()

        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except:
                dead.add(conn)

        self.active_connections -= dead


manager = ConnectionManager()