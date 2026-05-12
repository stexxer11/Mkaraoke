from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from schemas import SongCreate, SongUpdate
from ws_manager import manager
import os
import requests

router = APIRouter()

# =====================================================
# DB
# =====================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =====================================================
# SEARCH YOUTUBE (FIX QUE TE FALTABA)
# =====================================================

@router.get("/search")
async def search(q: str = Query(...)):

    api_key = os.getenv("YOUTUBE_API_KEY")

    if not api_key:
        return []

    url = (
        "https://www.googleapis.com/youtube/v3/search"
        f"?part=snippet&type=video&maxResults=10&q={q}&key={api_key}"
    )

    try:
        res = requests.get(url)
        data = res.json()

        results = []

        for item in data.get("items", []):
            results.append({
                "youtubeId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "artist": item["snippet"]["channelTitle"]
            })

        return results

    except Exception as e:
        print("SEARCH ERROR:", e)
        return []

# =====================================================
# QUEUE
# =====================================================

def build_queue(db: Session):

    songs = db.query(models.Song)\
        .order_by(models.Song.createdAt.asc())\
        .all()

    return [
        {
            "id": s.id,
            "ownerId": s.ownerId,
            "title": s.title,
            "artist": s.artist,
            "youtubeId": s.youtubeId,
            "status": s.status,
            "transpose": s.transpose
        }
        for s in songs
    ]

# =====================================================
# BROADCAST QUEUE
# =====================================================

async def broadcast_queue(db: Session):

    await manager.broadcast({
        "type": "queue_update",
        "queue": build_queue(db)
    })

# =====================================================
# ADD SONG
# =====================================================

@router.post("/song")
async def add_song(song: SongCreate, db: Session = Depends(get_db)):

    existing = db.query(models.Song).filter(
        models.Song.ownerId == song.ownerId,
        models.Song.status.in_(["queued", "playing"])
    ).first()

    if existing:
        return {"ok": False, "error": "USER_ALREADY_HAS_SONG"}

    new_song = models.Song(
        title=song.title,
        artist=song.artist,
        youtubeId=song.youtubeId,
        ownerId=song.ownerId,
        status="queued"
    )

    db.add(new_song)
    db.commit()
    db.refresh(new_song)

    await broadcast_queue(db)

    return {"ok": True, "song": {"id": new_song.id}}

# =====================================================
# CANCEL SONG
# =====================================================

@router.post("/song/{song_id}/cancel")
async def cancel_song(song_id: str, db: Session = Depends(get_db)):

    song = db.query(models.Song).filter(
        models.Song.id == song_id
    ).first()

    if not song:
        return {"ok": False, "error": "NOT_FOUND"}

    song.status = "cancelled"
    db.commit()

    await broadcast_queue(db)

    return {"ok": True}

# =====================================================
# EDIT SONG
# =====================================================

@router.put("/song/{song_id}")
async def edit_song(song_id: str, data: SongUpdate, db: Session = Depends(get_db)):

    song = db.query(models.Song).filter(
        models.Song.id == song_id
    ).first()

    if not song:
        return {"ok": False, "error": "NOT_FOUND"}

    if song.status == "playing":
        return {"ok": False, "error": "ALREADY_PLAYING"}

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

    return {"ok": True}

# =====================================================
# NEXT SONG
# =====================================================

current_song = None

@router.post("/next")
async def next_song(db: Session = Depends(get_db)):

    global current_song

    playing = db.query(models.Song).filter(
        models.Song.status == "playing"
    ).first()

    if playing:
        playing.status = "done"
        db.commit()

    nxt = db.query(models.Song).filter(
        models.Song.status == "queued"
    ).order_by(models.Song.createdAt.asc()).first()

    if not nxt:

        current_song = None

        await manager.broadcast({"type": "STOP_VIDEO"})
        await broadcast_queue(db)

        return {"message": "EMPTY"}

    nxt.status = "playing"
    db.commit()

    current_song = {
        "id": nxt.id,
        "title": nxt.title,
        "artist": nxt.artist,
        "youtubeId": nxt.youtubeId,
        "ownerId": nxt.ownerId
    }

    await manager.broadcast({
        "type": "LOAD_VIDEO",
        "song": current_song
    })

    await broadcast_queue(db)

    return current_song

# =====================================================
# PLAY NOW
# =====================================================

@router.post("/play-now/{song_id}")
async def play_now(song_id: str, db: Session = Depends(get_db)):

    global current_song

    db.query(models.Song).filter(
        models.Song.status == "playing"
    ).update({"status": "queued"})

    song = db.query(models.Song).filter(
        models.Song.id == song_id
    ).first()

    if not song:
        return {"ok": False}

    song.status = "playing"
    db.commit()

    current_song = {
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "youtubeId": song.youtubeId,
        "ownerId": song.ownerId
    }

    await manager.broadcast({
        "type": "LOAD_VIDEO",
        "song": current_song
    })

    await broadcast_queue(db)

    return {"ok": True}

# =====================================================
# WEBSOCKET
# =====================================================

@router.websocket("/ws")
async def ws(websocket: WebSocket):

    await manager.connect(websocket)

    db = SessionLocal()

    try:

        await websocket.send_json({
            "type": "queue_update",
            "queue": build_queue(db)
        })

        if current_song:
            await websocket.send_json({
                "type": "LOAD_VIDEO",
                "song": current_song
            })

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)

    finally:
        db.close()