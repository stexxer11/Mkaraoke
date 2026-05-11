@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):

    await ws.accept()
    clients.append(ws)

    try:
        while True:
            await ws.receive_text()

    except WebSocketDisconnect:
        clients.remove(ws)