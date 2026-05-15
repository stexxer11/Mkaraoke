from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import os
import time
from uuid import uuid4
from supabase import create_client, Client

from schemas import SongCreate, SongUpdate

# =====================================================
# ENV
# =====================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Faltan credenciales de Supabase")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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
# UTIL
# =====================================================

def now_ms():
    return int(time.time() * 1000)

# =====================================================
# SEARCH YOUTUBE
# =====================================================

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

# =====================================================
# ADD SONG (SUPABASE)
# =====================================================

@app.post("/queue/add")
async def add_song(song: SongCreate):

    try:
        # 1. ver si hay alguien playing
        playing = supabase.table("songs") \
            .select("id") \
            .eq("status", "playing") \
            .limit(1) \
            .execute()

        status = "queued" if playing.data else "playing"

        # 2. insert song
        song_id = str(uuid4())

        res = supabase.table("songs").insert({
            "id": song_id,
            "owner_id": song.owner_id,
            "title": song.title,
            "artist": song.artist,
            "youtube_id": song.youtube_id,
            "status": status,
            "created_at": now_ms(),
            "updated_at": now_ms(),
        }).execute()

        return {
            "ok": True,
            "id": song_id,
            "status": status
        }

    except Exception as e:
        raise HTTPException(500, str(e))

# =====================================================
# NEXT SONG
# =====================================================

@app.post("/queue/next")
async def next_song():

    try:
        # 1. terminar actual
        supabase.table("songs") \
            .update({
                "status": "done",
                "updated_at": now_ms()
            }) \
            .eq("status", "playing") \
            .execute()

        # 2. siguiente
        nxt = supabase.table("songs") \
            .select("id") \
            .eq("status", "queued") \
            .order("created_at") \
            .limit(1) \
            .execute()

        if nxt.data:
            song_id = nxt.data[0]["id"]

            supabase.table("songs") \
                .update({
                    "status": "playing",
                    "updated_at": now_ms()
                }) \
                .eq("id", song_id) \
                .execute()

        return {"ok": True}

    except Exception as e:
        raise HTTPException(500, str(e))

# =====================================================
# EDIT
# =====================================================

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
        raise HTTPException(500, str(e))

# =====================================================
# CANCEL
# =====================================================

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
        raise HTTPException(500, str(e))

        # =====================================================
# GET USER
# =====================================================

@app.get("/user/{user_id}")
async def get_user(user_id: str):

    try:

        res = supabase.table("users") \
            .select("*") \
            .eq("id", user_id) \
            .limit(1) \
            .execute()

        if not res.data:
            return {}

        return res.data[0]

    except Exception as e:
        raise HTTPException(500, str(e))


# =====================================================
# CREATE USER
# =====================================================

@app.post("/user")
async def create_user(data: dict):

    try:

        # evitar duplicado
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
            "data": res.data
        }

    except Exception as e:
        raise HTTPException(500, str(e))