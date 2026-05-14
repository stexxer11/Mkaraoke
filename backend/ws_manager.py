from fastapi import WebSocket
from starlette.websockets import (
    WebSocketState
)

import asyncio
import json

class ConnectionManager:

    def __init__(self):

        # conexiones activas
        self.active_connections = set()

        # lock async seguro
        self.lock = asyncio.Lock()

    # =====================================================
    # CONNECT
    # =====================================================

    async def connect(
        self,
        websocket: WebSocket
    ):

        await websocket.accept()

        async with self.lock:
            self.active_connections.add(
                websocket
            )

        print(
            f"WS CONNECTED: "
            f"{len(self.active_connections)}"
        )

    # =====================================================
    # DISCONNECT
    # =====================================================

    async def disconnect(
        self,
        websocket: WebSocket
    ):

        async with self.lock:

            if websocket in self.active_connections:
                self.active_connections.remove(
                    websocket
                )

        print(
            f"WS DISCONNECTED: "
            f"{len(self.active_connections)}"
        )

    # =====================================================
    # SAFE SEND
    # =====================================================

    async def safe_send_json(
        self,
        websocket: WebSocket,
        message: dict
    ):

        try:

            if (
                websocket.client_state !=
                WebSocketState.CONNECTED
            ):
                return False

            await websocket.send_text(
                json.dumps(message)
            )

            return True

        except Exception as error:

            print(
                "WS SEND ERROR:",
                error
            )

            return False

    # =====================================================
    # BROADCAST
    # =====================================================

    async def broadcast(
        self,
        message: dict
    ):

        if not self.active_connections:
            return

        dead_connections = []

        connections = list(
            self.active_connections
        )

        results = await asyncio.gather(
            *[
                self.safe_send_json(
                    conn,
                    message
                )
                for conn in connections
            ],
            return_exceptions=True
        )

        for index, success in enumerate(results):

            if success is not True:
                dead_connections.append(
                    connections[index]
                )

        if dead_connections:

            async with self.lock:

                for conn in dead_connections:

                    self.active_connections.discard(
                        conn
                    )

        print(
            f"WS BROADCAST -> "
            f"{len(connections)} clients"
        )

# instancia global
manager = ConnectionManager()