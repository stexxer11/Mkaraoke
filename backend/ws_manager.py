from fastapi import WebSocket


class ConnectionManager:

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

        # evitar duplicados
        if websocket not in self.active_connections:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):

        # safe remove
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):

        dead_connections = []

        for conn in self.active_connections:

            try:
                await conn.send_json(message)

            except Exception as e:
                # solo marcamos muertos, no rompemos el loop
                dead_connections.append(conn)
                print("WS SEND ERROR:", e)

        # cleanup seguro
        for conn in dead_connections:
            if conn in self.active_connections:
                self.active_connections.remove(conn)


manager = ConnectionManager()