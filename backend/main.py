from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect
)

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import aiosqlite
import httpx
import asyncio
import json
import time

from uuid import uuid4

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
# CONFIG
# =====================================================

API_KEY = "TU_API_KEY"

db = None

clients = set()

http_client = httpx.AsyncClient(
    timeout=10
)

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

    db = await aiosqlite.connect(
        "karaoke.db"
    )

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

    # ============================
    # PERFORMANCE INDEXES
    # ============================

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
# HELPERS
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

# =====================================================
# QUEUE HELPERS
# =====================================================

async def get_queue():

    cursor = await db.execute("""
        SELECT *
        FROM songs
        WHERE status IN ('queued', 'playing')
        ORDER BY created_at ASC
    """)

    rows = await cursor.fetchall()

    return [
        row_to_song(r)
        for r in rows
    ]

async def get_current_song():

    cursor = await db.execute("""
        SELECT *
        FROM songs
        WHERE status = 'playing'
        LIMIT 1
    """)

    row = await cursor.fetchone()

    if not row:
        return None

    return row_to_song(row)

# =====================================================
# BROADCAST
# =====================================================

async def broadcast(data):

    dead = set()

    tasks = []

    message = json.dumps(data)

    for ws in clients:

        tasks.append(
            send_safe(
                ws,
                message,
                dead
            )
        )

    await asyncio.gather(*tasks)

    clients.difference_update(dead)

async def send_safe(ws, message, dead):

    try:

        await ws.send_text(message)

    except:

        dead.add(ws)

# =====================================================
# BROADCAST QUEUE
# =====================================================

async def broadcast_queue():

    await broadcast({

        "type": "queue_update",

        "queue": await get_queue()
    })

# =====================================================
# BROADCAST PLAYER
# =====================================================

async def broadcast_player():

    current = await get_current_song()

    if not current:

        await broadcast({

            "type": "STOP_VIDEO",

            "timestamp":
                int(time.time() * 1000)
        })

        return

    await broadcast({

        "type": "LOAD_VIDEO",

        "song": current,

        "timestamp":
            int(time.time() * 1000)
    })

# =====================================================
# WEBSOCKET
# =====================================================

@app.websocket("/ws")

async def websocket_endpoint(ws: WebSocket):

    await ws.accept()

    clients.add(ws)

    await ws.send_json({

        "type": "queue_update",

        "queue": await get_queue()
    })

    current = await get_current_song()

    if current:

        await ws.send_json({

            "type": "LOAD_VIDEO",

            "song": current,

            "timestamp":
                int(time.time() * 1000)
        })

    try:

        while True:

            await ws.receive_text()

    except WebSocketDisconnect:

        clients.discard(ws)

# =====================================================
# ADD SONG
# =====================================================

@app.post("/queue/add")

async def add_song(song: SongCreate):

    cursor = await db.execute("""
        SELECT 1
        FROM songs
        WHERE owner_id = ?
        AND status IN ('queued', 'playing')
        LIMIT 1
    """, (song.ownerId,))

    exists = await cursor.fetchone()

    if exists:

        raise HTTPException(
            status_code=400,
            detail="Ya tienes una canción activa"
        )

    cursor = await db.execute("""
        SELECT 1
        FROM songs
        WHERE status = 'playing'
        LIMIT 1
    """)

    playing = await cursor.fetchone()

    status = (
        "queued"
        if playing
        else "playing"
    )

    now = int(time.time() * 1000)

    await db.execute("""
        INSERT INTO songs (

            id,
            owner_id,

            title,
            artist,
            youtube_id,

            status,

            created_at,
            updated_at

        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

    return {
        "ok": True
    }

# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")

async def next_song():

    now = int(time.time() * 1000)

    await db.execute("""
        UPDATE songs

        SET
            status = 'done',
            updated_at = ?

        WHERE status = 'playing'
    """, (now,))

    cursor = await db.execute("""
        SELECT id
        FROM songs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
    """)

    nxt = await cursor.fetchone()

    if nxt:

        await db.execute("""
            UPDATE songs

            SET
                status = 'playing',
                updated_at = ?

            WHERE id = ?
        """, (

            now,
            nxt[0]
        ))

    await db.commit()

    await asyncio.gather(

        broadcast_queue(),

        broadcast_player()
    )

    return {
        "ok": True
    }

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

        SET
            status = 'playing',
            updated_at = ?

        WHERE id = ?
    """, (

        now,
        song_id
    ))

    await db.commit()

    await asyncio.gather(

        broadcast_queue(),

        broadcast_player()
    )

    return {
        "ok": True
    }

# =====================================================
# REMOVE SONG
# =====================================================

@app.delete("/queue/remove/{song_id}")

async def remove_song(song_id: str):

    await db.execute("""
        UPDATE songs

        SET
            status = 'cancelled',
            updated_at = ?

        WHERE id = ?
    """, (

        int(time.time() * 1000),
        song_id
    ))

    await db.commit()

    await asyncio.gather(

        broadcast_queue(),

        broadcast_player()
    )

    return {
        "ok": True
    }