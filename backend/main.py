from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query
)

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import httpx
import asyncio
import json
import time
import os

from uuid import uuid4
from dotenv import load_dotenv

from sqlalchemy import create_engine, text

# =====================================================
# ENV
# =====================================================

load_dotenv()

API_KEY = os.getenv("YOUTUBE_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

http_client = httpx.AsyncClient(timeout=10)

# =====================================================
# DB (SUPABASE)
# =====================================================

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

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
def startup():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        print("DB OK (Supabase conectado)")

# =====================================================
# ROOT
# =====================================================

@app.get("/")
def root():
    return {"status": "ok", "service": "mkaraoke"}

# =====================================================
# YOUTUBE SEARCH
# =====================================================

# =====================================================
# SEARCH
# =====================================================

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
# HELPERS (SQL RAW)
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

def fetch_all(query, params={}):
    with engine.connect() as conn:
        return conn.execute(text(query), params).fetchall()

def fetch_one(query, params={}):
    with engine.connect() as conn:
        return conn.execute(text(query), params).fetchone()

def execute(query, params={}):
    with engine.begin() as conn:
        conn.execute(text(query), params)

# =====================================================
# QUEUE
# =====================================================

def get_queue():
    rows = fetch_all("""
        SELECT * FROM songs
        WHERE status IN ('queued', 'playing')
        ORDER BY created_at ASC
    """)
    return [row_to_song(r) for r in rows]

def get_current():
    row = fetch_one("""
        SELECT * FROM songs
        WHERE status = 'playing'
        LIMIT 1
    """)
    return row_to_song(row) if row else None

# =====================================================
# BROADCAST
# =====================================================

async def broadcast(data):
    msg = json.dumps(data)
    dead = set()

    for ws in clients:
        try:
            await ws.send_text(msg)
        except:
            dead.add(ws)

    clients.difference_update(dead)

# =====================================================
# WEBSOCKET
# =====================================================

@app.websocket("/ws")
async def ws(websocket: WebSocket):

    await websocket.accept()
    clients.add(websocket)

    await websocket.send_json({
        "type": "queue_update",
        "queue": get_queue()
    })

    current = get_current()
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

    song_id = str(uuid4())
    now = int(time.time() * 1000)

    # duplicado usuario + video
    dup = fetch_one("""
        SELECT 1 FROM songs
        WHERE owner_id = :owner
        AND youtube_id = :yt
        AND status IN ('queued', 'playing')
    """, {"owner": song.ownerId, "yt": song.youtubeId})

    if dup:
        raise HTTPException(400, "DUPLICATE_SONG")

    # check playing
    playing = fetch_one("""
        SELECT 1 FROM songs WHERE status = 'playing'
    """)

    status = "queued" if playing else "playing"

    execute("""
        INSERT INTO songs
        (id, owner_id, title, artist, youtube_id, status, created_at, updated_at)
        VALUES
        (:id, :owner, :title, :artist, :yt, :status, :created, :updated)
    """, {
        "id": song_id,
        "owner": song.ownerId,
        "title": song.title,
        "artist": song.artist,
        "yt": song.youtubeId,
        "status": status,
        "created": now,
        "updated": now
    })

    await broadcast({
        "type": "queue_update",
        "queue": get_queue()
    })

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

    return {"ok": True, "id": song_id, "status": status}

# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
async def next_song():

    now = int(time.time() * 1000)

    execute("""
        UPDATE songs
        SET status = 'done', updated_at = :now
        WHERE status = 'playing'
    """, {"now": now})

    nxt = fetch_one("""
        SELECT id FROM songs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
    """)

    if nxt:
        execute("""
            UPDATE songs
            SET status = 'playing', updated_at = :now
            WHERE id = :id
        """, {"now": now, "id": nxt[0]})

    await broadcast({"type": "queue_update", "queue": get_queue()})
    await broadcast({"type": "LOAD_VIDEO", "song": get_current()})

    return {"ok": True}

# =====================================================
# REMOVE
# =====================================================

@app.delete("/queue/remove/{song_id}")
async def remove_song(song_id: str):

    execute("""
        UPDATE songs
        SET status = 'cancelled', updated_at = :now
        WHERE id = :id
    """, {"now": int(time.time()*1000), "id": song_id})

    await broadcast({"type": "queue_update", "queue": get_queue()})

    return {"ok": True}

# =====================================================
# EDIT
# =====================================================

@app.put("/queue/edit/{song_id}")
async def edit_song(song_id: str, data: dict):

    execute("""
        UPDATE songs
        SET title = COALESCE(:title, title),
            artist = COALESCE(:artist, artist),
            youtube_id = COALESCE(:yt, youtube_id),
            updated_at = :now
        WHERE id = :id
    """, {
        "title": data.get("title"),
        "artist": data.get("artist"),
        "yt": data.get("youtubeId"),
        "now": int(time.time()*1000),
        "id": song_id
    })

    await broadcast({"type": "queue_update", "queue": get_queue()})

    return {"ok": True}

# =====================================================
# CANCEL
# =====================================================

@app.put("/queue/cancel/{song_id}")
async def cancel_song(song_id: str):

    execute("""
        UPDATE songs
        SET status = 'cancelled', updated_at = :now
        WHERE id = :id
    """, {"now": int(time.time()*1000), "id": song_id})

    await broadcast({"type": "queue_update", "queue": get_queue()})

    return {"ok": True}