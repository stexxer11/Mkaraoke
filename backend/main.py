from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import os
import time
from uuid import uuid4
from supabase import create_client, Client

from schemas import SongCreate, SongUpdate

# =========================
# ENV
# =========================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Faltan credenciales de Supabase")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# UTILS
# =========================
def now_ms():
    return int(time.time() * 1000)

# =========================
# SEARCH YOUTUBE
# =========================
@app.get("/search")
async def search(q: str = Query(...)):

    if not YOUTUBE_API_KEY or len(q.strip()) < 3:
        return []

    import httpx

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "type": "video",
                "maxResults": 10,
                "q": q,
                "key": YOUTUBE_API_KEY,
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

# =========================
# SONGS
# =========================
@app.post("/queue/add")
async def add_song(song: SongCreate):

    try:
        playing = supabase.table("songs") \
            .select("id") \
            .eq("status", "playing") \
            .limit(1) \
            .execute()

        status = "queued" if playing.data else "playing"

        song_id = str(uuid4())

        supabase.table("songs").insert({
            "id": song_id,
            "owner_id": song.owner_id,
            "title": song.title,
            "artist": song.artist,
            "youtube_id": song.youtube_id,
            "status": status,
            "created_at": now_ms(),
            "updated_at": now_ms(),
        }).execute()

        return {"ok": True, "id": song_id, "status": status}

    except Exception as e:
        print("ADD SONG ERROR:", str(e))
        raise HTTPException(500, str(e))


@app.post("/queue/next")
async def next_song():
    try:
        supabase.table("songs") \
            .update({"status": "done", "updated_at": now_ms()}) \
            .eq("status", "playing") \
            .execute()

        nxt = supabase.table("songs") \
            .select("id") \
            .eq("status", "queued") \
            .order("created_at") \
            .limit(1) \
            .execute()

        if nxt.data:
            song_id = nxt.data[0]["id"]

            supabase.table("songs") \
                .update({"status": "playing", "updated_at": now_ms()}) \
                .eq("id", song_id) \
                .execute()

        return {"ok": True}

    except Exception as e:
        print("NEXT SONG ERROR:", str(e))
        raise HTTPException(500, str(e))


@app.put("/queue/edit/{song_id}")
async def edit_song(song_id: str, data: SongUpdate):
    try:
        supabase.table("songs") \
            .update({
                "title": data.title,
                "artist": data.artist,
                "youtube_id": data.youtube_id,
                "updated_at": now_ms()
            }) \
            .eq("id", song_id) \
            .execute()

        return {"ok": True}

    except Exception as e:
        print("EDIT SONG ERROR:", str(e))
        raise HTTPException(500, str(e))


@app.put("/queue/cancel/{song_id}")
async def cancel_song(song_id: str):
    try:
        supabase.table("songs") \
            .update({
                "status": "cancelled",
                "updated_at": now_ms()
            }) \
            .eq("id", song_id) \
            .execute()

        return {"ok": True}

    except Exception as e:
        print("CANCEL SONG ERROR:", str(e))
        raise HTTPException(500, str(e))

# =========================
# USER (FIX DEFINITIVO)
# =========================
@app.get("/user/{user_id}")
async def get_user(user_id: str):

    try:
        res = supabase.table("users") \
            .select("*") \
            .eq("id", user_id) \
            .execute()

        # si existe usuario
        if res.data and len(res.data) > 0:
            return res.data[0]

        # crear usuario si no existe
        new_user = supabase.table("users").insert({
            "id": user_id,
            "artist_name": "Artista"
        }).execute()

        # 🔥 FIX CRÍTICO: evitar crash si data viene vacío
        if new_user.data and len(new_user.data) > 0:
            return new_user.data[0]

        return {
            "id": user_id,
            "artist_name": "Artista"
        }

    except Exception as e:
        print("USER ERROR:", str(e))
        raise HTTPException(500, str(e))


@app.post("/user")
async def create_user(data: dict):

    try:
        existing = supabase.table("users") \
            .select("id") \
            .eq("id", data["id"]) \
            .limit(1) \
            .execute()

        if existing.data:
            return {"ok": True}

        res = supabase.table("users").insert({
            "id": data["id"],
            "artist_name": data["artist_name"]
        }).execute()

        return {
            "ok": True,
            "data": res.data[0] if res.data else None
        }

    except Exception as e:
        print("CREATE USER ERROR:", str(e))
        raise HTTPException(500, str(e))