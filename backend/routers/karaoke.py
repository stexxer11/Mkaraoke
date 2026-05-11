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

        print("YOUTUBE RESPONSE:", data)

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

    songs = db.query(models.Song).all()

    return songs

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

    # BLOCK MULTIPLE SONGS SAME USER

    existing = db.query(models.Song).filter(
        models.Song.ownerId == song.ownerId
    ).first()

    if existing:

        return {
            "error": "USER_ALREADY_HAS_SONG"
        }

    new_song = models.Song(
        title=song.title,
        artist=song.artist,
        youtubeId=song.youtubeId,
        ownerId=song.ownerId,
        transpose=song.transpose
    )

    db.add(new_song)

    db.commit()

    db.refresh(new_song)

    await manager.broadcast({
        "type": "QUEUE_UPDATE"
    })

    return new_song

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
            "error": "SONG_NOT_FOUND"
        }

    db.delete(song)

    db.commit()

    await manager.broadcast({
        "type": "QUEUE_UPDATE"
    })

    return {
        "success": True
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
            "error": "SONG_NOT_FOUND"
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

    await manager.broadcast({
        "type": "QUEUE_UPDATE"
    })

    return song

# ==========================================
# NEXT SONG
# ==========================================

@router.post("/next")
async def next_song(
    db: Session = Depends(get_db)
):

    global current_song

    song = db.query(models.Song).first()

    if not song:

        current_song = None

        await manager.broadcast({
            "type": "NO_SONGS"
        })

        return {
            "message": "QUEUE_EMPTY"
        }

    current_song = {
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "youtubeId": song.youtubeId,
        "transpose": song.transpose
    }

    db.delete(song)

    db.commit()

    await manager.broadcast({
        "type": "CURRENT_SONG",
        "song": current_song
    })

    return current_song

# ==========================================
# WEBSOCKET
# ==========================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await manager.connect(websocket)

    try:

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(websocket)