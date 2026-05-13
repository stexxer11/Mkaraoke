from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import httpx
import json
import time
import os
from uuid import uuid4

from sqlalchemy import create_engine, text
import asyncio

# =====================================================
# ENV
# =====================================================

API_KEY = os.getenv("YOUTUBE_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada")

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
# DB
# =====================================================

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

# =====================================================
# HTTP CLIENT
# =====================================================

http_client = None

@app.on_event("startup")
async def startup():
    global http_client
    http_client = httpx.AsyncClient(timeout=10)

@app.on_event("shutdown")
async def shutdown():
    await http_client.aclose()

# =====================================================
# WEBSOCKET STATE
# =====================================================

clients = set()
clients_lock = asyncio.Lock()

# =====================================================
# MODELS
# =====================================================

class SongCreate(BaseModel):
    ownerId: str
    title: str
    artist: str
    youtubeId: str


class UserCreate(BaseModel):
    id: str
    artistName: str

# =====================================================
# HELPERS
# =====================================================

def fetch_all(q, p={}):
    with engine.connect() as conn:
        return conn.execute(text(q), p).fetchall()

def fetch_one(q, p={}):
    with engine.connect() as conn:
        return conn.execute(text(q), p).fetchone()

def execute(q, p={}):
    with engine.begin() as conn:
        conn.execute(text(q), p)

# =====================================================
# USERS
# =====================================================

@app.get("/user/{user_id}")
def get_user(user_id: str):

    row = fetch_one("""
        SELECT id, artist_name
        FROM users
        WHERE id=:i
    """, {"i": user_id})

    if not row:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

    return {
        "id": row[0],
        "artistName": row[1]
    }


@app.post("/user")
def create_user(user: UserCreate):

    now = int(time.time() * 1000)

    exists = fetch_one("""
        SELECT id FROM users WHERE id=:i
    """, {"i": user.id})

    if exists:
        return {"ok": True, "exists": True}

    execute("""
        INSERT INTO users (id, artist_name, created_at)
        VALUES (:id, :name, :c)
    """, {
        "id": user.id,
        "name": user.artistName,
        "c": now
    })

    return {"ok": True}

# =====================================================
# SONG HELPERS
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

def get_queue():
    rows = fetch_all("""
        SELECT * FROM songs
        WHERE status IN ('queued','playing')
        ORDER BY created_at ASC
    """)
    return [row_to_song(r) for r in rows]

def get_current():
    row = fetch_one("""
        SELECT * FROM songs
        WHERE status='playing'
        LIMIT 1
    """)
    return row_to_song(row) if row else None

# =====================================================
# BROADCAST
# =====================================================

async def broadcast(data):
    msg = json.dumps(data)

    async with clients_lock:
        current = list(clients)

    dead = set()

    for ws in current:
        try:
            await ws.send_text(msg)
        except:
            dead.add(ws)

    async with clients_lock:
        clients.difference_update(dead)

async def broadcast_queue():
    await broadcast({
        "type": "queue_update",
        "queue": get_queue()
    })

async def broadcast_player():
    current = get_current()

    if not current:
        await broadcast({"type": "STOP_VIDEO"})
        return

    await broadcast({
        "type": "LOAD_VIDEO",
        "song": current
    })

# =====================================================
# SEARCH YOUTUBE
# =====================================================

@app.get("/search")
async def search(q: str = Query(...)):

    if not API_KEY:
        return []

    if len(q.strip()) < 3:
        return []

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

    return [
        {
            "youtubeId": item["id"].get("videoId"),
            "title": item["snippet"]["title"],
            "artist": item["snippet"]["channelTitle"]
        }
        for item in data.get("items", [])
        if item["id"].get("videoId")
    ]

# =====================================================
# WEBSOCKET
# =====================================================

@app.websocket("/ws")
async def ws(websocket: WebSocket):

    await websocket.accept()

    async with clients_lock:
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
        async with clients_lock:
            clients.discard(websocket)

# =====================================================
# ADD SONG
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    song_id = str(uuid4())
    now = int(time.time() * 1000)

    dup = fetch_one("""
        SELECT 1 FROM songs
        WHERE owner_id=:o AND youtube_id=:y
        AND status IN ('queued','playing')
    """, {"o": song.ownerId, "y": song.youtubeId})

    if dup:
        raise HTTPException(400, "DUPLICATE")

    playing = fetch_one("""
        SELECT id FROM songs WHERE status='playing'
    """)

    status = "queued" if playing else "playing"

    execute("""
        INSERT INTO songs VALUES (:id,:o,:t,:a,:y,:s,:c,:u)
    """, {
        "id": song_id,
        "o": song.ownerId,
        "t": song.title,
        "a": song.artist,
        "y": song.youtubeId,
        "s": status,
        "c": now,
        "u": now
    })

    await broadcast_queue()

    if status == "playing":
        await broadcast_player()

    return {"ok": True, "id": song_id}

# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
async def next_song():

    now = int(time.time() * 1000)

    execute("""
        UPDATE songs SET status='done', updated_at=:n
        WHERE status='playing'
    """, {"n": now})

    nxt = fetch_one("""
        SELECT id FROM songs
        WHERE status='queued'
        ORDER BY created_at ASC
        LIMIT 1
    """)

    if nxt:
        execute("""
            UPDATE songs SET status='playing', updated_at=:n
            WHERE id=:i
        """, {"n": now, "i": nxt[0]})

        await broadcast_player()
    else:
        await broadcast({"type": "STOP_VIDEO"})

    await broadcast_queue()

    return {"ok": True}

# =====================================================
# PLAY NOW
# =====================================================

@app.post("/queue/playnow/{song_id}")
async def play_now(song_id: str):

    now = int(time.time() * 1000)

    execute("UPDATE songs SET status='queued' WHERE status='playing'")

    execute("""
        UPDATE songs SET status='playing', updated_at=:n
        WHERE id=:i
    """, {"n": now, "i": song_id})

    await broadcast_queue()
    await broadcast_player()

    return {"ok": True}

# =====================================================
# EDIT
# =====================================================

@app.put("/queue/edit/{song_id}")
async def edit_song(song_id: str, data: dict):

    execute("""
        UPDATE songs
        SET title=COALESCE(:t,title),
            artist=COALESCE(:a,artist),
            youtube_id=COALESCE(:y,youtube_id),
            updated_at=:n
        WHERE id=:i
    """, {
        "t": data.get("title"),
        "a": data.get("artist"),
        "y": data.get("youtubeId"),
        "n": int(time.time()*1000),
        "i": song_id
    })

    await broadcast_queue()

    return {"ok": True}

# =====================================================
# CANCEL
# =====================================================

@app.put("/queue/cancel/{song_id}")
async def cancel_song(song_id: str):

    now = int(time.time() * 1000)

    execute("""
        UPDATE songs SET status='cancelled', updated_at=:n
        WHERE id=:i
    """, {"n": now, "i": song_id})

    await broadcast_queue()

    return {"ok": True}