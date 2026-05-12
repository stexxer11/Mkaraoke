from fastapi import APIRouter
from fastapi import Depends
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session

from database import SessionLocal
from database import engine

import models

from schemas import SongCreate
from schemas import SongUpdate

from ws_manager import manager

import requests
import os

from dotenv import load_dotenv

# ==========================================
# LOAD ENV
# ==========================================

load_dotenv()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

# ==========================================
# CREATE TABLES
# ==========================================

models.Base.metadata.create_all(bind=engine)

router = APIRouter()

# ==========================================
# DATABASE
# ==========================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()

# ==========================================
# GLOBAL STATE
# ==========================================

current_song = None

# ==========================================
# HELPER
# ==========================================

def build_queue_payload(db):

    songs = db.query(models.Song).all()

    queue = []

    for song in songs:

        queue.append({
            "id": song.id,
            "title": song.title,
            "artist": song.artist,
            "youtubeId": song.youtubeId,
            "ownerId": song.ownerId,
            "status": song.status,
            "transpose": song.transpose
        })

    return queue

# ==========================================
# BROADCAST QUEUE
# ==========================================

async def broadcast_queue(db):

    queue = build_queue_payload(db)

    await manager.broadcast({
        "type": "queue_update",
        "queue": queue
    })

# ==========================================
# YOUTUBE SEARCH
# ==========================================

@router.get("/youtube/search")
def youtube_search(q: str):

    if not q or len(q.strip()) < 3:
        return []

    try:

        response = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": f"{q} karaoke",
                "type": "video",
                "videoEmbeddable": "true",
                "videoSyndicated": "true",
                "maxResults": 10,
                "key": YOUTUBE_API_KEY,
            }
        )

        data = response.json()

        items = data.get("items", [])

        bad_keywords = [
            "live",
            "reaction",
            "tutorial",
            "shorts",
            "#shorts",
            "vlog",
            "interview"
        ]

        results = []

        for item in items:

            video_id = item.get("id", {}).get("videoId")

            if not video_id:
                continue

            title = item.get(
                "snippet",
                {}
            ).get(
                "title",
                ""
            )

            lower_title = title.lower()

            is_bad = any(
                word in lower_title
                for word in bad_keywords
            )

            if is_bad:
                continue

            results.append({
                "id": video_id,
                "youtubeId": video_id,
                "title": title,
                "artist": item.get(
                    "snippet",
                    {}
                ).get(
                    "channelTitle",
                    ""
                ),
                "thumbnail": item.get(
                    "snippet",
                    {}
                ).get(
                    "thumbnails",
                    {}
                ).get(
                    "medium",
                    {}
                ).get(
                    "url",
                    ""
                )
            })

        return results

    except Exception as e:

        print("YOUTUBE ERROR:", e)

        return JSONResponse(
            status_code=500,
            content={
                "error": "YOUTUBE_FAILED"
            }
        )

# ==========================================
# GET QUEUE
# ==========================================

@router.get("/queue")
def get_queue(
    db: Session = Depends(get_db)
):

    return build_queue_payload(db)

# ==========================================
# GET CURRENT
# ==========================================

@router.get("/current")
def get_current():

    return current_song

# ==========================================
# ADD SONG
# ==========================================

@router.post("/song")
async def add_song(
    song: SongCreate,
    db: Session = Depends(get_db)
):

    # ======================================
    # BLOCK MULTIPLE SONGS SAME USER
    # ======================================

    existing = db.query(models.Song).filter(
        models.Song.ownerId == song.ownerId,
        models.Song.status != "done",
        models.Song.status != "cancelled"
    ).first()

    if existing:

        return {
            "ok": False,
            "error": "USER_ALREADY_HAS_SONG"
        }

    new_song = models.Song(
        title=song.title,
        artist=song.artist,
        youtubeId=song.youtubeId,
        ownerId=song.ownerId,
        transpose=song.transpose,
        status="queued"
    )

    db.add(new_song)

    db.commit()

    db.refresh(new_song)

    await broadcast_queue(db)

    return {
        "ok": True,
        "song": {
            "id": new_song.id
        }
    }

# ==========================================
# DELETE SONG
# ==========================================

@router.delete("/song/{song_id}")
async def delete_song(
    song_id: int,
    db: Session = Depends(get_db)
):

    song = db.query(models.Song).filter(
        models.Song.id == song_id
    ).first()

    if not song:
        return {
            "ok": False,
            "error": "SONG_NOT_FOUND"
        }

    db.delete(song)

    db.commit()

    await broadcast_queue(db)

    return {
        "ok": True
    }

# ==========================================
# CANCEL SONG
# ==========================================

@router.post("/song/{song_id}/cancel")
async def cancel_song(
    song_id: int,
    db: Session = Depends(get_db)
):

    song = db.query(models.Song).filter(
        models.Song.id == song_id
    ).first()

    if not song:
        return {
            "ok": False,
            "error": "SONG_NOT_FOUND"
        }

    song.status = "cancelled"

    db.commit()

    await broadcast_queue(db)

    return {
        "ok": True
    }

# ==========================================
# UPDATE SONG
# ==========================================

@router.put("/song/{song_id}")
async def update_song(
    song_id: int,
    data: SongUpdate,
    db: Session = Depends(get_db)
):

    song = db.query(models.Song).filter(
        models.Song.id == song_id
    ).first()

    if not song:
        return {
            "ok": False,
            "error": "SONG_NOT_FOUND"
        }

    # ======================================
    # BLOCK EDIT IF PLAYING
    # ======================================

    if song.status == "playing":

        return {
            "ok": False,
            "error": "SONG_ALREADY_PLAYING"
        }

    if data.title:
        song.title = data.title

    if data.artist:
        song.artist = data.artist

    if data.youtubeId:
        song.youtubeId = data.youtubeId

    if data.transpose is not None:
        song.transpose = data.transpose

    db.commit()

    await broadcast_queue(db)

    return {
        "ok": True
    }

# ==========================================
# NEXT SONG
# ==========================================

@router.post("/next")
async def next_song(
    db: Session = Depends(get_db)
):

    global current_song

    # ======================================
    # FINISH CURRENT PLAYING
    # ======================================

    playing_song = db.query(models.Song).filter(
        models.Song.status == "playing"
    ).first()

    if playing_song:

        playing_song.status = "done"

        db.commit()

    # ======================================
    # GET NEXT QUEUED
    # ======================================

    song = db.query(models.Song).filter(
        models.Song.status == "queued"
    ).first()

    # ======================================
    # NO SONGS
    # ======================================

    if not song:

        current_song = None

        await manager.broadcast({
            "type": "STOP_VIDEO"
        })

        await broadcast_queue(db)

        return {
            "message": "QUEUE_EMPTY"
        }

    # ======================================
    # SET PLAYING
    # ======================================

    song.status = "playing"

    db.commit()

    current_song = {
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "youtubeId": song.youtubeId,
        "transpose": song.transpose,
        "ownerId": song.ownerId
    }

    # ======================================
    # BROADCAST VIDEO
    # ======================================

    await manager.broadcast({
        "type": "LOAD_VIDEO",
        "song": current_song
    })

    await broadcast_queue(db)

    return current_song

# ==========================================
# PLAY NOW
# ==========================================

@router.post("/play-now/{song_id}")
async def play_now(
    song_id: int,
    db: Session = Depends(get_db)
):

    global current_song

    # ======================================
    # RESET CURRENT PLAYING
    # ======================================

    playing_song = db.query(models.Song).filter(
        models.Song.status == "playing"
    ).first()

    if playing_song:

        playing_song.status = "queued"

    # ======================================
    # FIND SONG
    # ======================================

    song = db.query(models.Song).filter(
        models.Song.id == song_id
    ).first()

    if not song:

        return {
            "ok": False,
            "error": "SONG_NOT_FOUND"
        }

    # ======================================
    # FORCE PLAY
    # ======================================

    song.status = "playing"

    db.commit()

    current_song = {
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "youtubeId": song.youtubeId,
        "transpose": song.transpose,
        "ownerId": song.ownerId
    }

    await manager.broadcast({
        "type": "LOAD_VIDEO",
        "song": current_song
    })

    await broadcast_queue(db)

    return {
        "ok": True
    }

# ==========================================
# WEBSOCKET
# ==========================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await manager.connect(websocket)

    try:

        # ======================================
        # SEND INITIAL DATA
        # ======================================

        db = SessionLocal()

        queue = build_queue_payload(db)

        await websocket.send_json({
            "type": "queue_update",
            "queue": queue
        })

        if current_song:

            await websocket.send_json({
                "type": "LOAD_VIDEO",
                "song": current_song
            })

        db.close()

        # ======================================
        # KEEP CONNECTION ALIVE
        # ======================================

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(websocket)