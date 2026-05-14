from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)

from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

import asyncio
import httpx
import os
import time

from uuid import uuid4

from database import engine
from schemas import (
    UserCreate,
    SongCreate,
    SongUpdate,
)

from ws_manager import manager

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

    http_client = httpx.AsyncClient(
        timeout=15
    )

@app.on_event("shutdown")
async def shutdown():

    if http_client:
        await http_client.aclose()

# =====================================================
# HELPERS
# =====================================================

def now_ms():
    return int(time.time() * 1000)

def fetch_one(query, params=None):

    params = params or {}

    with engine.connect() as conn:
        return conn.execute(
            text(query),
            params
        ).fetchone()

def fetch_all(query, params=None):

    params = params or {}

    with engine.connect() as conn:
        return conn.execute(
            text(query),
            params
        ).fetchall()

def execute(query, params=None):

    params = params or {}

    with engine.begin() as conn:
        conn.execute(
            text(query),
            params
        )

# =====================================================
# SERIALIZERS
# =====================================================

def serialize_user(row):

    if not row:
        return None

    return {
        "id": row[0],
        "artist_name": row[1],
    }

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

    return {
        "ok": True,
        "service": "mkaraoke-api"
    }

# =====================================================
# USERS
# =====================================================

@app.get("/user/{user_id}")
def get_user(user_id: str):

    row = fetch_one("""
        SELECT
            id,
            artist_name
        FROM users
        WHERE id=:id
    """, {
        "id": user_id
    })

    if not row:
        raise HTTPException(
            status_code=404,
            detail="USER_NOT_FOUND"
        )

    return serialize_user(row)

@app.post("/user")
def create_user(user: UserCreate):

    clean_name = user.artist_name.strip()

    if len(clean_name) < 2:

        raise HTTPException(
            status_code=400,
            detail="INVALID_ARTIST_NAME"
        )

    try:

        execute("""
            INSERT INTO users (
                id,
                artist_name,
                created_at
            )
            VALUES (
                :id,
                :artist_name,
                :created_at
            )
        """, {
            "id": user.id,
            "artist_name": clean_name,
            "created_at": now_ms()
        })

        return {
            "ok": True,
            "created": True,
        }

    except IntegrityError as error:

        message = str(error).lower()

        if "artist_name" in message:

            raise HTTPException(
                status_code=409,
                detail="ARTIST_NAME_TAKEN"
            )

        if (
            "users_pkey" in message or
            "duplicate key" in message
        ):

            return {
                "ok": True,
                "created": False,
            }

        raise HTTPException(
            status_code=500,
            detail="DATABASE_ERROR"
        )

# =====================================================
# QUEUE HELPERS
# =====================================================

def get_queue():

    rows = fetch_all("""
        SELECT
            id,
            owner_id,
            title,
            artist,
            youtube_id,
            status,
            created_at,
            updated_at
        FROM songs
        WHERE status IN (
            'queued',
            'playing'
        )
        ORDER BY created_at ASC
    """)

    return [
        serialize_song(r)
        for r in rows
    ]

def get_current_song():

    row = fetch_one("""
        SELECT
            id,
            owner_id,
            title,
            artist,
            youtube_id,
            status,
            created_at,
            updated_at
        FROM songs
        WHERE status='playing'
        LIMIT 1
    """)

    return serialize_song(row)

# =====================================================
# BROADCAST
# =====================================================

async def broadcast_queue():

    await manager.broadcast({
        "type": "queue_update",
        "queue": get_queue()
    })

async def broadcast_player():

    current = get_current_song()

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
async def search(
    q: str = Query(...)
):

    query = q.strip()

    if len(query) < 3:
        return []

    if not API_KEY:

        raise HTTPException(
            status_code=500,
            detail="MISSING_YOUTUBE_API_KEY"
        )

    try:

        response = await http_client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "type": "video",
                "maxResults": 10,
                "q": query,
                "key": API_KEY,
            }
        )

        data = response.json()

        return [
            {
                "youtubeId":
                    item["id"]["videoId"],

                "title":
                    item["snippet"]["title"],

                "artist":
                    item["snippet"]["channelTitle"]
            }
            for item in data.get("items", [])
            if item["id"].get("videoId")
        ]

    except Exception as error:

        print("YOUTUBE ERROR:", error)

        raise HTTPException(
            status_code=500,
            detail="YOUTUBE_SEARCH_ERROR"
        )

# =====================================================
# WEBSOCKET
# =====================================================

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket
):

    await manager.connect(websocket)

    try:

        await websocket.send_json({
            "type": "queue_update",
            "queue": get_queue()
        })

        current = get_current_song()

        if current:

            await websocket.send_json({
                "type": "LOAD_VIDEO",
                "song": current
            })

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(websocket)

    except Exception as error:

        print("WS ERROR:", error)

        manager.disconnect(websocket)

# =====================================================
# ADD SONG
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    song_id = str(uuid4())

    status = "playing"

    playing = fetch_one("""
        SELECT id
        FROM songs
        WHERE status='playing'
        LIMIT 1
    """)

    if playing:
        status = "queued"

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
                :owner_id,
                :title,
                :artist,
                :youtube_id,
                :status,
                :created_at,
                :updated_at
            )
        """, {
            "id": song_id,
            "owner_id": song.owner_id,
            "title": song.title,
            "artist": song.artist,
            "youtube_id": song.youtubeId,
            "status": status,
            "created_at": now_ms(),
            "updated_at": now_ms(),
        })

    except IntegrityError:

        raise HTTPException(
            status_code=409,
            detail="DUPLICATE_ACTIVE_SONG"
        )

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

    execute("""
        UPDATE songs
        SET
            status='done',
            updated_at=:updated_at
        WHERE status='playing'
    """, {
        "updated_at": now_ms()
    })

    next_song_row = fetch_one("""
        SELECT id
        FROM songs
        WHERE status='queued'
        ORDER BY created_at ASC
        LIMIT 1
    """)

    if next_song_row:

        execute("""
            UPDATE songs
            SET
                status='playing',
                updated_at=:updated_at
            WHERE id=:id
        """, {
            "updated_at": now_ms(),
            "id": next_song_row[0]
        })

    await broadcast_queue()
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
    data: SongUpdate
):

    execute("""
        UPDATE songs
        SET
            title=COALESCE(
                :title,
                title
            ),

            artist=COALESCE(
                :artist,
                artist
            ),

            youtube_id=COALESCE(
                :youtube_id,
                youtube_id
            ),

            updated_at=:updated_at

        WHERE id=:id
    """, {
        "title": data.title,
        "artist": data.artist,
        "youtube_id": data.youtubeId,
        "updated_at": now_ms(),
        "id": song_id,
    })

    await broadcast_queue()

    return {
        "ok": True
    }

# =====================================================
# CANCEL SONG
# =====================================================

@app.put("/queue/cancel/{song_id}")
async def cancel_song(song_id: str):

    execute("""
        UPDATE songs
        SET
            status='cancelled',
            updated_at=:updated_at
        WHERE id=:id
    """, {
        "updated_at": now_ms(),
        "id": song_id
    })

    await broadcast_queue()

    return {
        "ok": True
    }