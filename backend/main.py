from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
    Depends
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

from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import engine, SessionLocal, Base
from models import Song

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
# WS STATE
# =====================================================

clients = set()

# =====================================================
# SCHEMAS
# =====================================================

class SongCreate(BaseModel):
    ownerId: str
    title: str
    artist: str
    youtubeId: str

# =====================================================
# DB SESSION
# =====================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =====================================================
# STARTUP (SUPABASE / POSTGRES)
# =====================================================

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    print("DB READY (SUPABASE CONNECTED)")

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
# HELPERS (SQLALCHEMY OBJECT)
# =====================================================

def song_to_dict(song: Song):
    return {
        "id": song.id,
        "ownerId": song.owner_id,
        "title": song.title,
        "artist": song.artist,
        "youtubeId": song.youtube_id,
        "status": song.status,
        "createdAt": song.created_at,
        "updatedAt": song.updated_at,
    }

# =====================================================
# QUEUE
# =====================================================

@app.get("/queue")
def get_queue(db: Session = Depends(get_db)):

    songs = db.query(Song)\
        .filter(Song.status.in_(["queued", "playing"]))\
        .order_by(Song.created_at.asc())\
        .all()

    return [song_to_dict(s) for s in songs]

def get_current(db: Session):
    return db.query(Song)\
        .filter(Song.status == "playing")\
        .first()

# =====================================================
# WS MANUAL SIMPLE
# =====================================================

async def broadcast(data):
    dead = set()
    msg = json.dumps(data)

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

    db = SessionLocal()

    queue = db.query(Song)\
        .filter(Song.status.in_(["queued", "playing"]))\
        .order_by(Song.created_at.asc())\
        .all()

    await websocket.send_json({
        "type": "queue_update",
        "queue": [song_to_dict(s) for s in queue]
    })

    current = get_current(db)
    if current:
        await websocket.send_json({
            "type": "LOAD_VIDEO",
            "song": song_to_dict(current)
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
def add_song(song: SongCreate, db: Session = Depends(get_db)):

    now = int(time.time() * 1000)

    playing = get_current(db)

    status = "queued" if playing else "playing"

    new_song = Song(
        id=str(uuid4()),
        owner_id=song.ownerId,
        title=song.title,
        artist=song.artist,
        youtube_id=song.youtubeId,
        status=status,
        created_at=now,
        updated_at=now
    )

    db.add(new_song)
    db.commit()

    if status == "playing":
        asyncio.create_task(broadcast({
            "type": "LOAD_VIDEO",
            "song": song_to_dict(new_song)
        }))

    asyncio.create_task(broadcast({
        "type": "queue_update",
        "queue": get_queue(db)
    }))

    return {"ok": True, "id": new_song.id}

# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
def next_song(db: Session = Depends(get_db)):

    now = int(time.time() * 1000)

    current = get_current(db)
    if current:
        current.status = "done"
        current.updated_at = now

    nxt = db.query(Song)\
        .filter(Song.status == "queued")\
        .order_by(Song.created_at.asc())\
        .first()

    if nxt:
        nxt.status = "playing"
        nxt.updated_at = now

    db.commit()

    asyncio.create_task(broadcast({"type": "queue_update", "queue": get_queue(db)}))
    asyncio.create_task(broadcast({"type": "LOAD_VIDEO", "song": song_to_dict(nxt)} if nxt else {"type": "STOP_VIDEO"}))

    return {"ok": True}

# =====================================================
# EDIT (SIN RELOAD TV SI NO ES CURRENT)
# =====================================================

@app.put("/queue/edit/{song_id}")
def edit_song(song_id: str, data: dict, db: Session = Depends(get_db)):

    song = db.query(Song).filter(Song.id == song_id).first()

    if not song:
        raise HTTPException(404, "SONG_NOT_FOUND")

    song.title = data.get("title", song.title)
    song.artist = data.get("artist", song.artist)
    song.youtube_id = data.get("youtubeId", song.youtube_id)
    song.updated_at = int(time.time() * 1000)

    db.commit()

    asyncio.create_task(broadcast({
        "type": "queue_update",
        "queue": get_queue(db)
    }))

    current = get_current(db)

    if current and current.id == song_id:
        asyncio.create_task(broadcast({
            "type": "LOAD_VIDEO",
            "song": song_to_dict(song)
        }))

    return {"ok": True}

# =====================================================
# CANCEL
# =====================================================

@app.put("/queue/cancel/{song_id}")
def cancel_song(song_id: str, db: Session = Depends(get_db)):

    song = db.query(Song).filter(Song.id == song_id).first()

    if not song:
        raise HTTPException(404, "SONG_NOT_FOUND")

    was_playing = song.status == "playing"

    song.status = "cancelled"
    song.updated_at = int(time.time() * 1000)

    db.commit()

    if was_playing:
        next_song(db)

    asyncio.create_task(broadcast({"type": "queue_update", "queue": get_queue(db)}))

    return {"ok": True}