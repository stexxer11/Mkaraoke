from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect
)

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sqlite3
import requests
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

API_KEY = "AIzaSyBEnuSxawI3qX-6OcnNl_fp9NDR_nmpp5Q"

# =====================================================
# SQLITE
# =====================================================

conn = sqlite3.connect(
    "karaoke.db",
    check_same_thread=False
)

cursor = conn.cursor()

cursor.execute("""
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

conn.commit()

# =====================================================
# WEBSOCKET CLIENTS
# =====================================================

clients = []

# =====================================================
# MODELS
# =====================================================

class SongCreate(BaseModel):

    ownerId: str

    title: str
    artist: str
    youtubeId: str


class SongEdit(BaseModel):

    title: str
    artist: str
    youtubeId: str

# =====================================================
# HELPERS
# =====================================================

def song_to_dict(row):

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


def get_queue():

    rows = cursor.execute("""
        SELECT *
        FROM songs
        WHERE status != 'done'
        AND status != 'cancelled'
        ORDER BY created_at ASC
    """).fetchall()

    return [
        song_to_dict(r)
        for r in rows
    ]


def get_current_song():

    row = cursor.execute("""
        SELECT *
        FROM songs
        WHERE status = 'playing'
        LIMIT 1
    """).fetchone()

    if not row:
        return None

    return song_to_dict(row)

# =====================================================
# BROADCAST
# =====================================================

async def broadcast(data: dict):

    disconnected = []

    for ws in clients:

        try:

            await ws.send_text(
                json.dumps(data)
            )

        except:

            disconnected.append(ws)

    for ws in disconnected:

        if ws in clients:
            clients.remove(ws)

# =====================================================
# BROADCAST QUEUE
# =====================================================

async def broadcast_queue():

    await broadcast({

        "type": "queue_update",

        "queue": get_queue()
    })

# =====================================================
# BROADCAST PLAYER
# =====================================================

async def broadcast_player():

    current = get_current_song()

    # =========================================
    # STOP VIDEO
    # =========================================

    if not current:

        await broadcast({

            "type": "STOP_VIDEO",

            "timestamp":
                int(time.time() * 1000)
        })

        return

    # =========================================
    # LOAD VIDEO
    # =========================================

    await broadcast({

        "type": "LOAD_VIDEO",

        "song": current,

        "force": True,

        "timestamp":
            int(time.time() * 1000)
    })

# =====================================================
# WEBSOCKET
# =====================================================

@app.websocket("/ws")

async def websocket_endpoint(ws: WebSocket):

    await ws.accept()

    clients.append(ws)

    # SEND INITIAL QUEUE

    await ws.send_text(json.dumps({

        "type": "queue_update",

        "queue": get_queue()

    }))

    # SEND CURRENT PLAYER

    current = get_current_song()

    if current:

        await ws.send_text(json.dumps({

            "type": "LOAD_VIDEO",

            "song": current,

            "force": True,

            "timestamp":
                int(time.time() * 1000)

        }))

    try:

        while True:

            await ws.receive_text()

    except WebSocketDisconnect:

        if ws in clients:

            clients.remove(ws)

# =====================================================
# QUEUE
# =====================================================

@app.get("/queue")

def queue():

    return get_queue()

# =====================================================
# ADD SONG
# =====================================================

@app.post("/queue/add")

async def add_song(song: SongCreate):

    active = cursor.execute("""
        SELECT *
        FROM songs
        WHERE owner_id = ?
        AND status IN ('queued', 'playing')
    """, (song.ownerId,)).fetchone()

    if active:

        raise HTTPException(
            status_code=400,
            detail="Ya tienes una canción activa"
        )

    playing = cursor.execute("""
        SELECT *
        FROM songs
        WHERE status = 'playing'
    """).fetchone()

    status = (
        "queued"
        if playing
        else "playing"
    )

    now = int(time.time() * 1000)

    song_id = str(uuid4())

    cursor.execute("""
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

        song_id,
        song.ownerId,

        song.title,
        song.artist,
        song.youtubeId,

        status,

        now,
        now
    ))

    conn.commit()

    await broadcast_queue()

    if status == "playing":

        await broadcast_player()

    return {
        "ok": True
    }

# =====================================================
# EDIT SONG
# =====================================================

@app.put("/queue/edit/{song_id}")

async def edit_song(
    song_id: str,
    data: SongEdit
):

    row = cursor.execute("""
        SELECT *
        FROM songs
        WHERE id = ?
        AND status = 'queued'
    """, (song_id,)).fetchone()

    if not row:

        raise HTTPException(
            status_code=404,
            detail="Canción no editable"
        )

    cursor.execute("""
        UPDATE songs

        SET
            title = ?,
            artist = ?,
            youtube_id = ?,
            updated_at = ?

        WHERE id = ?
    """, (

        data.title,
        data.artist,
        data.youtubeId,

        int(time.time() * 1000),

        song_id
    ))

    conn.commit()

    await broadcast_queue()

    return {
        "ok": True
    }

# =====================================================
# CANCEL SONG
# =====================================================

@app.put("/queue/cancel/{song_id}")

async def cancel_song(song_id: str):

    cursor.execute("""
        UPDATE songs

        SET
            status = 'cancelled',
            updated_at = ?

        WHERE id = ?
    """, (

        int(time.time() * 1000),
        song_id
    ))

    conn.commit()

    await broadcast_queue()

    await broadcast_player()

    return {
        "ok": True
    }

# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")

async def next_song():

    current = cursor.execute("""
        SELECT *
        FROM songs
        WHERE status = 'playing'
        LIMIT 1
    """).fetchone()

    if current:

        cursor.execute("""
            UPDATE songs

            SET
                status = 'done',
                updated_at = ?

            WHERE id = ?
        """, (

            int(time.time() * 1000),
            current[0]
        ))

    next_song = cursor.execute("""
        SELECT *
        FROM songs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
    """).fetchone()

    if next_song:

        cursor.execute("""
            UPDATE songs

            SET
                status = 'playing',
                updated_at = ?

            WHERE id = ?
        """, (

            int(time.time() * 1000),
            next_song[0]
        ))

    conn.commit()

    await broadcast_queue()

    await broadcast_player()

    return {
        "ok": True
    }

# =====================================================
# PLAY NOW
# =====================================================

@app.post("/queue/playnow/{song_id}")

async def play_now(song_id: str):

    cursor.execute("""
        UPDATE songs
        SET status = 'queued'
        WHERE status = 'playing'
    """)

    cursor.execute("""
        UPDATE songs

        SET
            status = 'playing',
            updated_at = ?

        WHERE id = ?
    """, (

        int(time.time() * 1000),
        song_id
    ))

    conn.commit()

    await broadcast_queue()

    await broadcast_player()

    return {
        "ok": True
    }

# =====================================================
# REMOVE SONG
# =====================================================

@app.delete("/queue/remove/{song_id}")

async def remove_song(song_id: str):

    cursor.execute("""
        UPDATE songs

        SET
            status = 'cancelled',
            updated_at = ?

        WHERE id = ?
    """, (

        int(time.time() * 1000),
        song_id
    ))

    conn.commit()

    await broadcast_queue()

    await broadcast_player()

    return {
        "ok": True
    }

# =====================================================
# SEARCH
# =====================================================

@app.get("/search")

def search_youtube(q: str):

    if not q:
        return []

    url = "https://www.googleapis.com/youtube/v3/search"

    params = {
        "part": "snippet",
        "q": f"{q} karaoke",
        "type": "video",
        "maxResults": 10,
        "key": API_KEY
    }

    res = requests.get(
        url,
        params=params
    ).json()

    items = res.get("items", [])

    video_ids = []
    raw = []

    bad_words = [
        "live",
        "reaction",
        "tutorial",
        "shorts",
        "vlog",
        "interview",
        "cover by",
        "instrumental only"
    ]

    for item in items:

        video_id = (
            item.get("id", {})
            .get("videoId")
        )

        if not video_id:
            continue

        title = (
            item["snippet"]["title"]
            .lower()
        )

        if any(
            w in title
            for w in bad_words
        ):
            continue

        video_ids.append(video_id)

        raw.append({
            "youtubeId": video_id,
            "title": item["snippet"]["title"],
            "artist": item["snippet"]["channelTitle"],
            "thumbnail": item["snippet"]["thumbnails"]["medium"]["url"]
        })

    if not video_ids:
        return []

    # ============================================
    # CHECK EMBEDDABLE
    # ============================================

    url2 = "https://www.googleapis.com/youtube/v3/videos"

    params2 = {
        "part": "status",
        "id": ",".join(video_ids),
        "key": API_KEY
    }

    res2 = requests.get(
        url2,
        params=params2
    ).json()

    items2 = res2.get("items", [])

    embeddable_ids = set()

    for v in items2:

        if (
            v.get("status", {})
            .get("embeddable")
        ):

            embeddable_ids.add(v["id"])

    final = [

        v for v in raw

        if v["youtubeId"] in embeddable_ids
    ]

    final.sort(
        key=lambda x:
            "karaoke"
            in x["title"].lower(),
        reverse=True
    )

    return final