from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query
)

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import aiosqlite
import httpx
import asyncio
import json
import time
import os

from uuid import uuid4
from dotenv import load_dotenv

# =====================================================
# ENV CONFIG (NUEVO)
# =====================================================

load_dotenv()

API_KEY = os.getenv("YOUTUBE_API_KEY")

http_client = httpx.AsyncClient(timeout=10)

# =====================================================
# APP
# =====================================================

app = FastAPI()

# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# DB
# =====================================================

db = None
clients = set()

# =====================================================
# MODELS
# =====================================================

class SongCreate(BaseModel):
    ownerId: str
    title: str
    artist: str
    youtubeId: str


# =====================================================
# STARTUP
# =====================================================

@app.on_event("startup")
async def startup():

    global db

    db = await aiosqlite.connect("karaoke.db")

    await db.execute("""
    CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        title TEXT,
        artist TEXT,
        youtube_id TEXT,
        status TEXT,
        created_at INTEGER,
        updated_at INTEGER
    )
    """)

    await db.execute("""
    CREATE INDEX IF NOT EXISTS idx_status
    ON songs(status)
    """)

    await db.execute("""
    CREATE INDEX IF NOT EXISTS idx_created
    ON songs(created_at)
    """)

    await db.commit()


# =====================================================
# YOUTUBE SEARCH (NUEVO / CONFIG API BIEN)
# =====================================================

@app.get("/search")
async def search(q: str = Query(...)):

    if not API_KEY:
        return []

    url = (
        "https://www.googleapis.com/youtube/v3/search"
        f"?part=snippet&type=video&maxResults=10&q={q}&key={API_KEY}"
    )

    try:
        res = await http_client.get(url)
        data = res.json()

        results = []

        for item in data.get("items", []):

            results.append({
                "youtubeId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "artist": item["snippet"]["channelTitle"]
            })

        return results

    except Exception as e:
        print("SEARCH ERROR:", e)
        return []


# =====================================================
# HELPERS (igual que tu versión)
# =====================================================

def row_to_song(row):
    return {
        "id": row[0],
        "ownerId": row[1],
        "title": row[2],
        "artist": row[3],
        "youtubeId": row[4],
        "status": row[5],
        "createdAt": row[6],
        "updatedAt": row[7],
    }


async def get_queue():
    cursor = await db.execute("""
        SELECT *
        FROM songs
        WHERE status IN ('queued', 'playing')
        ORDER BY created_at ASC
    """)
    return [row_to_song(r) for r in await cursor.fetchall()]


async def get_current_song():
    cursor = await db.execute("""
        SELECT *
        FROM songs
        WHERE status = 'playing'
        LIMIT 1
    """)
    row = await cursor.fetchone()
    return row_to_song(row) if row else None


# =====================================================
# BROADCAST
# =====================================================

async def broadcast(data):

    dead = set()
    message = json.dumps(data)

    async def send(ws):
        try:
            await ws.send_text(message)
        except:
            dead.add(ws)

    await asyncio.gather(*(send(ws) for ws in clients))

    clients.difference_update(dead)


async def broadcast_queue():
    await broadcast({
        "type": "queue_update",
        "queue": await get_queue()
    })


async def broadcast_player():

    current = await get_current_song()

    if not current:
        await broadcast({"type": "STOP_VIDEO"})
        return

    await broadcast({
        "type": "LOAD_VIDEO",
        "song": current
    })


# =====================================================
# WEBSOCKET
# =====================================================

@app.websocket("/ws")
async def ws(websocket: WebSocket):

    await websocket.accept()
    clients.add(websocket)

    await websocket.send_json({
        "type": "queue_update",
        "queue": await get_queue()
    })

    current = await get_current_song()

    if current:
        await websocket.send_json({
            "type": "LOAD_VIDEO",
            "song": current
        })

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        clients.discard(websocket)


# =====================================================
# ADD SONG
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    cursor = await db.execute("""
        SELECT 1 FROM songs
        WHERE owner_id = ?
        AND status IN ('queued', 'playing')
    """, (song.ownerId,))

    if await cursor.fetchone():
        raise HTTPException(400, "Ya tienes canción activa")

    cursor = await db.execute("""
        SELECT 1 FROM songs
        WHERE status = 'playing'
    """)

    status = "queued" if await cursor.fetchone() else "playing"

    now = int(time.time() * 1000)

    await db.execute("""
        INSERT INTO songs VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(uuid4()),
        song.ownerId,
        song.title,
        song.artist,
        song.youtubeId,
        status,
        now,
        now
    ))

    await db.commit()

    await asyncio.gather(
        broadcast_queue(),
        broadcast_player()
    )

    return {"ok": True}


# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
async def next_song():

    now = int(time.time() * 1000)

    await db.execute("""
        UPDATE songs
        SET status = 'done', updated_at = ?
        WHERE status = 'playing'
    """, (now,))

    cursor = await db.execute("""
        SELECT id FROM songs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
    """)

    nxt = await cursor.fetchone()

    if nxt:
        await db.execute("""
            UPDATE songs
            SET status = 'playing', updated_at = ?
            WHERE id = ?
        """, (now, nxt[0]))

    await db.commit()

    await asyncio.gather(
        broadcast_queue(),
        broadcast_player()
    )

    return {"ok": True}

@app.get("/")
def root():
    return {"status": "ok", "service": "mkaraoke"}
# =====================================================
# PLAY NOW
# =====================================================

@app.post("/queue/playnow/{song_id}")
async def play_now(song_id: str):

    now = int(time.time() * 1000)

    await db.execute("""
        UPDATE songs
        SET status = 'queued'
        WHERE status = 'playing'
    """)

    await db.execute("""
        UPDATE songs
        SET status = 'playing', updated_at = ?
        WHERE id = ?
    """, (now, song_id))

    await db.commit()

    await asyncio.gather(
        broadcast_queue(),
        broadcast_player()
    )

    return {"ok": True}


# =====================================================
# REMOVE
# =====================================================

@app.delete("/queue/remove/{song_id}")
async def remove_song(song_id: str):

    await db.execute("""
        UPDATE songs
        SET status = 'cancelled', updated_at = ?
        WHERE id = ?
    """, (int(time.time() * 1000), song_id))

    await db.commit()

    await asyncio.gather(
        broadcast_queue(),
        broadcast_player()
    )

    return {"ok": True}