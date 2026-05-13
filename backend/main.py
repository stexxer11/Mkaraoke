from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

import asyncio
import httpx
import json
import os
import time

from uuid import uuid4

from database import engine
from models import UserCreate, SongCreate, SongUpdate
from connection_manager import manager

# =====================================================
# ENV
# =====================================================

API_KEY = os.getenv("YOUTUBE_API_KEY")

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
# HELPERS
# =====================================================

def fetch_one(q, p={}):

    with engine.connect() as conn:
        return conn.execute(text(q), p).fetchone()

def fetch_all(q, p={}):

    with engine.connect() as conn:
        return conn.execute(text(q), p).fetchall()

def execute(q, p={}):

    with engine.begin() as conn:
        conn.execute(text(q), p)

# =====================================================
# STATUS
# =====================================================

@app.get("/status")
def status():
    return {"ok": True}

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
        raise HTTPException(404, "USER_NOT_FOUND")

    return {
        "id": row[0],
        "artistName": row[1]
    }

@app.post("/user")
def create_user(user: UserCreate):

    now = int(time.time() * 1000)

    try:

        execute("""
            INSERT INTO users (id, artist_name, created_at)
            VALUES (:id, :name, :c)
        """, {
            "id": user.id,
            "name": user.artistName,
            "c": now
        })

        return {
            "ok": True,
            "created": True
        }

    except IntegrityError as e:

        error = str(e).lower()

        if "artist_name" in error:
            raise HTTPException(400, "ARTIST_NAME_TAKEN")

        if "users_pkey" in error:
            return {
                "ok": True,
                "created": False
            }

        raise HTTPException(500, "DATABASE_ERROR")

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
        SELECT *
        FROM songs
        WHERE status IN ('queued','playing')
        ORDER BY created_at ASC
    """)

    return [row_to_song(r) for r in rows]

def get_current():

    row = fetch_one("""
        SELECT *
        FROM songs
        WHERE status='playing'
        LIMIT 1
    """)

    return row_to_song(row) if row else None

# =====================================================
# BROADCAST
# =====================================================

async def broadcast_queue():

    await manager.broadcast({
        "type": "queue_update",
        "queue": get_queue()
    })

async def broadcast_player():

    current = get_current()

    if not current:

        await manager.broadcast({
            "type": "STOP_VIDEO"
        })

        return

    await manager.broadcast({
        "type": "LOAD_VIDEO",
        "song": current
    })

# =====================================================
# SEARCH
# =====================================================

@app.get("/search")
async def search(q: str = Query(...)):

    if not API_KEY or len(q.strip()) < 3:
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
            "youtubeId": item["id"]["videoId"],
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
async def websocket_endpoint(websocket: WebSocket):

    await manager.connect(websocket)

    try:

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

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)

# =====================================================
# ADD SONG
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    song_id = str(uuid4())
    now = int(time.time() * 1000)

    playing = fetch_one("""
        SELECT id
        FROM songs
        WHERE status='playing'
    """)

    status = "queued" if playing else "playing"

    try:

        execute("""
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
            VALUES (
                :id,
                :o,
                :t,
                :a,
                :y,
                :s,
                :c,
                :u
            )
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

    except IntegrityError:
        raise HTTPException(400, "DUPLICATE_ACTIVE_SONG")

    await broadcast_queue()

    if status == "playing":
        await broadcast_player()

    return {
        "ok": True,
        "id": song_id
    }

# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
async def next_song():

    now = int(time.time() * 1000)

    execute("""
        UPDATE songs
        SET status='done',
            updated_at=:n
        WHERE status='playing'
    """, {"n": now})

    nxt = fetch_one("""
        SELECT id
        FROM songs
        WHERE status='queued'
        ORDER BY created_at ASC
        LIMIT 1
    """)

    if nxt:

        execute("""
            UPDATE songs
            SET status='playing',
                updated_at=:n
            WHERE id=:i
        """, {
            "n": now,
            "i": nxt[0]
        })

    await broadcast_queue()
    await broadcast_player()

    return {"ok": True}

# =====================================================
# EDIT SONG
# =====================================================

@app.put("/queue/edit/{song_id}")
async def edit_song(song_id: str, data: SongUpdate):

    execute("""
        UPDATE songs
        SET title=COALESCE(:t,title),
            artist=COALESCE(:a,artist),
            youtube_id=COALESCE(:y,youtube_id),
            updated_at=:n
        WHERE id=:i
    """, {
        "t": data.title,
        "a": data.artist,
        "y": data.youtubeId,
        "n": int(time.time() * 1000),
        "i": song_id
    })

    await broadcast_queue()

    return {"ok": True}

# =====================================================
# CANCEL SONG
# =====================================================

@app.put("/queue/cancel/{song_id}")
async def cancel_song(song_id: str):

    now = int(time.time() * 1000)

    execute("""
        UPDATE songs
        SET status='cancelled',
            updated_at=:n
        WHERE id=:i
    """, {
        "n": now,
        "i": song_id
    })

    await broadcast_queue()

    return {"ok": True}