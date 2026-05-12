from fastapi import WebSocket


class ConnectionManager:

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):

        dead = []

        for conn in self.active_connections:

            try:
                await conn.send_json(message)

            except:
                dead.append(conn)

        for d in dead:
            self.active_connections.remove(d)


manager = ConnectionManager()