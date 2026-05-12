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
# ENV
# =====================================================

load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")

http_client = httpx.AsyncClient(timeout=10)

# =====================================================
# APP
# =====================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# STATE
# =====================================================

db = None
clients = set()

# =====================================================
# MODEL
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

    await db.commit()

# =====================================================
# ROOT
# =====================================================

@app.get("/")
def root():
    return {"status": "ok", "service": "mkaraoke"}

# =====================================================
# YOUTUBE SEARCH
# =====================================================

@app.get("/search")
async def search(q: str = Query(...)):

    if not API_KEY:
        return []

    try:
        res = await http_client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "type": "video",
                "maxResults": 10,
                "q": q,
                "key": API_KEY
            }
        )

        data = res.json()

        results = []

        for item in data.get("items", []):

            vid = item["id"].get("videoId")
            if not vid:
                continue

            results.append({
                "youtubeId": vid,
                "title": item["snippet"]["title"],
                "artist": item["snippet"]["channelTitle"]
            })

        return results

    except Exception as e:
        print("SEARCH ERROR:", e)
        return []

# =====================================================
# HELPERS
# =====================================================

def row_to_song(r):
    return {
        "id": r[0],
        "ownerId": r[1],
        "title": r[2],
        "artist": r[3],
        "youtubeId": r[4],
        "status": r[5],
        "createdAt": r[6],
        "updatedAt": r[7],
    }

async def get_queue():
    cursor = await db.execute("""
        SELECT * FROM songs
        WHERE status IN ('queued', 'playing')
        ORDER BY created_at ASC
    """)
    return [row_to_song(r) for r in await cursor.fetchall()]

async def get_current():
    cursor = await db.execute("""
        SELECT * FROM songs
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
    msg = json.dumps(data)

    async def send(ws):
        try:
            await ws.send_text(msg)
        except:
            dead.add(ws)

    await asyncio.gather(*(send(c) for c in clients))
    clients.difference_update(dead)

async def broadcast_queue():
    await broadcast({
        "type": "queue_update",
        "queue": await get_queue()
    })

async def broadcast_player():
    current = await get_current()

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

    current = await get_current()
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
# ADD SONG (MEJORADO)
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    # evitar duplicado por usuario + canción
    cursor = await db.execute("""
        SELECT 1 FROM songs
        WHERE owner_id = ?
        AND youtube_id = ?
        AND status IN ('queued', 'playing')
    """, (song.ownerId, song.youtubeId))

    if await cursor.fetchone():
        raise HTTPException(400, "DUPLICATE_SONG")

    # bloquear múltiples canciones activas
    cursor = await db.execute("""
        SELECT 1 FROM songs
        WHERE owner_id = ?
        AND status IN ('queued', 'playing')
    """, (song.ownerId,))

    if await cursor.fetchone():
        raise HTTPException(400, "USER_ALREADY_HAS_SONG")

    now = int(time.time() * 1000)

    # si no hay nadie reproduciendo → auto play
    cursor = await db.execute("""
        SELECT 1 FROM songs WHERE status = 'playing'
    """)
    playing = await cursor.fetchone()

    status = "queued" if playing else "playing"

    song_id = str(uuid4())

    await db.execute("""
        INSERT INTO songs VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        song_id,
        song.ownerId,
        song.title,
        song.artist,
        song.youtubeId,
        status,
        now,
        now
    ))

    await db.commit()

    if status == "playing":

        await broadcast({
            "type": "LOAD_VIDEO",
            "song": {
                "id": song_id,
                "ownerId": song.ownerId,
                "title": song.title,
                "artist": song.artist,
                "youtubeId": song.youtubeId
            }
        })

    await broadcast_queue()

    return {
        "ok": True,
        "song": {
            "id": song_id,
            "status": status
        }
    }

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

    await broadcast_queue()
    await broadcast_player()

    return {"ok": True}

# =====================================================
# PLAY NOW
# =====================================================

@app.post("/queue/playnow/{song_id}")
async def play_now(song_id: str):

    now = int(time.time() * 1000)

    await db.execute("""
        UPDATE songs SET status = 'queued'
        WHERE status = 'playing'
    """)

    await db.execute("""
        UPDATE songs
        SET status = 'playing', updated_at = ?
        WHERE id = ?
    """, (now, song_id))

    await db.commit()

    await broadcast_queue()
    await broadcast_player()

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

    await broadcast_queue()
    await broadcast_player()

    return {"ok": True}

@app.put("/queue/edit/{song_id}")
async def edit_song(song_id: str, data: dict):

    now = int(time.time() * 1000)

    # verificar que exista
    cursor = await db.execute("""
        SELECT * FROM songs WHERE id = ?
    """, (song_id,))

    song = await cursor.fetchone()

    if not song:
        raise HTTPException(status_code=404, detail="SONG_NOT_FOUND")

    # actualizar solo campos enviados
    await db.execute("""
        UPDATE songs
        SET title = COALESCE(?, title),
            artist = COALESCE(?, artist),
            youtube_id = COALESCE(?, youtube_id),
            updated_at = ?
        WHERE id = ?
    """, (
        data.get("title"),
        data.get("artist"),
        data.get("youtubeId"),
        now,
        song_id
    ))

    await db.commit()

    await broadcast_queue()

    return {
        "ok": True,
        "message": "SONG_UPDATED"
    }

@app.put("/queue/cancel/{song_id}")
async def cancel_song(song_id: str):

    now = int(time.time() * 1000)

    cursor = await db.execute("""
        SELECT * FROM songs WHERE id = ?
    """, (song_id,))

    song = await cursor.fetchone()

    if not song:
        raise HTTPException(status_code=404, detail="SONG_NOT_FOUND")

    await db.execute("""
        UPDATE songs
        SET status = 'cancelled',
            updated_at = ?
        WHERE id = ?
    """, (now, song_id))

    await db.commit()

    # si cancelan la que está sonando → pasar a la siguiente
    if song[5] == "playing":  # status column

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
                SET status = 'playing',
                    updated_at = ?
                WHERE id = ?
            """, (now, nxt[0]))

            await db.commit()

            await broadcast_player()

    await broadcast_queue()

    return {
        "ok": True,
        "message": "SONG_CANCELLED"
    }