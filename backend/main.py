from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from contextlib import asynccontextmanager

import httpx
import os
import time
from uuid import uuid4

from database import engine
from schemas import UserCreate, SongCreate, SongUpdate
from ws_manager import manager


# =====================================================
# ENV
# =====================================================

API_KEY = os.getenv("YOUTUBE_API_KEY")


# =====================================================
# HTTP CLIENT LIFECYCLE (MODERNO)
# =====================================================

http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=15)
    yield
    await http_client.aclose()


app = FastAPI(lifespan=lifespan)


# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en prod cambia esto
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# TIME
# =====================================================

def now_ms():
    return int(time.time() * 1000)


# =====================================================
# DB HELPERS (más seguros)
# =====================================================

def fetch_one(query, params=None):
    with engine.connect() as conn:
        return conn.execute(text(query), params or {}).fetchone()


def fetch_all(query, params=None):
    with engine.connect() as conn:
        return conn.execute(text(query), params or {}).fetchall()


def execute(query, params=None):
    with engine.begin() as conn:
        conn.execute(text(query), params or {})


# =====================================================
# SERIALIZERS
# =====================================================

def serialize_user(row):
    if not row:
        return None
    return {"id": row[0], "artist_name": row[1]}


def serialize_song(row):
    if not row:
        return None
    return {
        "id": row[0],
        "owner_id": row[1],
        "title": row[2],
        "artist": row[3],
        "youtubeId": row[4],
        "status": row[5],
        "created_at": row[6],
        "updated_at": row[7],
    }


# =====================================================
# STATUS
# =====================================================

@app.get("/status")
def status():
    return {"ok": True, "service": "mkaraoke-api"}


# =====================================================
# USERS
# =====================================================

@app.get("/user/{user_id}")
def get_user(user_id: str):
    row = fetch_one(
        "SELECT id, artist_name FROM users WHERE id=:id",
        {"id": user_id},
    )

    if not row:
        return {"id": user_id, "artist_name": None}

    return serialize_user(row)


@app.post("/user")
def create_user(user: UserCreate):
    clean_name = user.artist_name.strip()

    if len(clean_name) < 2:
        raise HTTPException(400, "INVALID_ARTIST_NAME")

    try:
        execute(
            """
            INSERT INTO users (id, artist_name, created_at)
            VALUES (:id, :artist_name, :created_at)
            """,
            {
                "id": user.id,
                "artist_name": clean_name,
                "created_at": now_ms(),
            },
        )

        return {"ok": True, "created": True}

    except IntegrityError:
        return {"ok": True, "created": False}


# =====================================================
# QUEUE HELPERS (OPTIMIZADOS)
# =====================================================

def get_queue():
    rows = fetch_all(
        """
        SELECT id, owner_id, title, artist, youtube_id, status, created_at, updated_at
        FROM songs
        WHERE status IN ('queued','playing')
        ORDER BY created_at ASC
        """
    )
    return [serialize_song(r) for r in rows]


def get_current_song():
    row = fetch_one(
        """
        SELECT id, owner_id, title, artist, youtube_id, status, created_at, updated_at
        FROM songs
        WHERE status='playing'
        LIMIT 1
        """
    )
    return serialize_song(row)


# =====================================================
# BROADCAST SAFE (SIN CRASH WS)
# =====================================================

async def safe_broadcast(data: dict):
    try:
        await manager.broadcast(data)
    except Exception as e:
        print("WS broadcast error:", e)


async def broadcast_queue():
    await safe_broadcast({
        "type": "queue_update",
        "queue": get_queue()
    })


async def broadcast_player():
    current = get_current_song()

    if not current:
        await safe_broadcast({"type": "STOP_VIDEO"})
        return

    await safe_broadcast({
        "type": "LOAD_VIDEO",
        "song": current
    })


# =====================================================
# SEARCH YOUTUBE (ROBUSTO)
# =====================================================

@app.get("/search")
async def search(q: str = Query(...)):

    if not API_KEY or len(q.strip()) < 3:
        return []

    try:
        res = await http_client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "type": "video",
                "maxResults": 10,
                "q": q,
                "key": API_KEY,
            },
        )

        data = res.json()

        return [
            {
                "youtubeId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "artist": item["snippet"]["channelTitle"],
            }
            for item in data.get("items", [])
            if item["id"].get("videoId")
        ]

    except Exception:
        return []


# =====================================================
# WEBSOCKET (MEJORADO)
# =====================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        await websocket.send_json({
            "type": "queue_update",
            "queue": get_queue(),
        })

        current = get_current_song()
        if current:
            await websocket.send_json({
                "type": "LOAD_VIDEO",
                "song": current,
            })

        while True:
            # keep alive (evita disconnect en render/proxies)
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)


# =====================================================
# ADD SONG (CLEAN)
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    song_id = str(uuid4())

    playing = fetch_one(
        "SELECT id FROM songs WHERE status='playing' LIMIT 1"
    )

    status = "queued" if playing else "playing"

    execute(
        """
        INSERT INTO songs (
            id, owner_id, title, artist, youtube_id,
            status, created_at, updated_at
        )
        VALUES (
            :id, :owner_id, :title, :artist, :youtube_id,
            :status, :created_at, :updated_at
        )
        """,
        {
            "id": song_id,
            "owner_id": song.owner_id,
            "title": song.title,
            "artist": song.artist,
            "youtube_id": song.youtube_id,
            "status": status,
            "created_at": now_ms(),
            "updated_at": now_ms(),
        },
    )

    await broadcast_queue()

    if status == "playing":
        await broadcast_player()

    return {"ok": True, "id": song_id}


# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
async def next_song():

    execute("""
        UPDATE songs
        SET status='done', updated_at=:t
        WHERE status='playing'
    """, {"t": now_ms()})

    nxt = fetch_one("""
        SELECT id FROM songs
        WHERE status='queued'
        ORDER BY created_at ASC
        LIMIT 1
    """)

    if nxt:
        execute("""
            UPDATE songs
            SET status='playing', updated_at=:t
            WHERE id=:id
        """, {"t": now_ms(), "id": nxt[0]})

    await broadcast_queue()
    await broadcast_player()

    return {"ok": True}


# =====================================================
# EDIT
# =====================================================

@app.put("/queue/edit/{song_id}")
async def edit_song(song_id: str, data: SongUpdate):

    execute("""
        UPDATE songs
        SET
            title=COALESCE(:title, title),
            artist=COALESCE(:artist, artist),
            youtube_id=COALESCE(:youtube_id, youtube_id),
            updated_at=:t
        WHERE id=:id
    """, {
        "title": data.title,
        "artist": data.artist,
        "youtube_id": data.youtube_id,
        "t": now_ms(),
        "id": song_id,
    })

    await broadcast_queue()
    return {"ok": True}


# =====================================================
# CANCEL
# =====================================================

@app.put("/queue/cancel/{song_id}")
async def cancel_song(song_id: str):

    execute("""
        UPDATE songs
        SET status='cancelled', updated_at=:t
        WHERE id=:id
    """, {"t": now_ms(), "id": song_id})

    await broadcast_queue()
    return {"ok": True}