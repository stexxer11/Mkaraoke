from fastapi import FastAPI, HTTPException, Query
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

# =====================================================
# ENV
# =====================================================

API_KEY = os.getenv("YOUTUBE_API_KEY")

http_client: httpx.AsyncClient | None = None


# =====================================================
# LIFECYCLE
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=15)
    yield
    await http_client.aclose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
# DB HELPERS
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
# SERIALIZER
# =====================================================

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
# SEARCH YOUTUBE
# =====================================================

@app.get("/search")
async def search(q: str = Query(...)):

    if not API_KEY or len(q.strip()) < 3:
        return []

    if http_client is None:
        raise HTTPException(500, "HTTP_CLIENT_NOT_READY")

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
# ADD SONG (SIN WS)
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    song_id = str(uuid4())

    try:
        with engine.begin() as conn:

            playing = conn.execute(text("""
                SELECT id FROM songs
                WHERE status='playing'
                LIMIT 1
                FOR UPDATE
            """)).fetchone()

            status = "queued" if playing else "playing"

            conn.execute(text("""
                INSERT INTO songs (
                    id, owner_id, title, artist, youtube_id,
                    status, created_at, updated_at
                )
                VALUES (
                    :id, :owner_id, :title, :artist, :youtube_id,
                    :status, :created_at, :updated_at
                )
            """), {
                "id": song_id,
                "owner_id": song.owner_id,
                "title": song.title,
                "artist": song.artist,
                "youtube_id": song.youtube_id,
                "status": status,
                "created_at": now_ms(),
                "updated_at": now_ms(),
            })

        return {"ok": True, "id": song_id, "status": status}

    except Exception as e:
        raise HTTPException(500, str(e))


# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
async def next_song():

    with engine.begin() as conn:

        conn.execute(text("""
            UPDATE songs
            SET status='done', updated_at=:t
            WHERE status='playing'
        """), {"t": now_ms()})

        nxt = conn.execute(text("""
            SELECT id FROM songs
            WHERE status='queued'
            ORDER BY created_at ASC
            LIMIT 1
        """)).fetchone()

        if nxt:
            conn.execute(text("""
                UPDATE songs
                SET status='playing', updated_at=:t
                WHERE id=:id
            """), {"t": now_ms(), "id": nxt[0]})

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

    return {"ok": True}