import os

# ==========================================
# MKARAOKE FULL PROFESSIONAL STRUCTURE
# ==========================================

folders = [

    # ROOT
    "backend",
    "backend/routers",
    "backend/core",
    "backend/services",
    "backend/websocket",

    "frontend",
    "frontend/public",

    "frontend/src",
    "frontend/src/pages",
    "frontend/src/components",
    "frontend/src/context",
    "frontend/src/services",
    "frontend/src/layouts",
    "frontend/src/hooks",
    "frontend/src/styles",
]

files = {

# =====================================================
# BACKEND
# =====================================================

"backend/main.py": '''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.karaoke import router

app = FastAPI(title="MKARAOKE")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/karaoke")

@app.get("/")
def root():
    return {
        "message": "MKARAOKE RUNNING"
    }
''',

"backend/database.py": '''from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./mkaraoke.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
''',

"backend/models.py": '''from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime

from datetime import datetime

from database import Base

class Song(Base):

    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)
    artist = Column(String)

    youtubeId = Column(String)

    ownerId = Column(String)

    transpose = Column(Integer, default=0)

    status = Column(String, default="queued")

    createdAt = Column(
        DateTime,
        default=datetime.utcnow
    )
''',

"backend/schemas.py": '''from pydantic import BaseModel

class SongCreate(BaseModel):

    title: str
    artist: str
    youtubeId: str

    ownerId: str

    transpose: int = 0

class SongUpdate(BaseModel):

    title: str | None = None
    artist: str | None = None

    transpose: int | None = None
''',

"backend/ws_manager.py": '''from fastapi import WebSocket

class ConnectionManager:

    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):

        await websocket.accept()

        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):

        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):

        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()
''',

"backend/routers/karaoke.py": '''from fastapi import APIRouter
from fastapi import Depends
from fastapi import WebSocket
from fastapi import WebSocketDisconnect

from sqlalchemy.orm import Session

from database import SessionLocal
from database import engine

import models

from schemas import SongCreate
from schemas import SongUpdate

from ws_manager import manager

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
''',

"backend/.env": '''YOUTUBE_API_KEY=YOUR_KEY
FRONTEND_URL=http://localhost:5173
''',

"backend/requirements.txt": '''fastapi
uvicorn[standard]
sqlalchemy
pydantic
python-multipart
websockets
aiofiles
requests
python-dotenv
''',

# =====================================================
# FRONTEND
# =====================================================

"frontend/src/App.jsx": '''import { BrowserRouter, Routes, Route } from "react-router-dom"

import MobilePage from "./pages/MobilePage"
import TvPage from "./pages/TvPage"
import AdminPage from "./pages/AdminPage"

function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<MobilePage />}
        />

        <Route
          path="/tv"
          element={<TvPage />}
        />

        <Route
          path="/admin"
          element={<AdminPage />}
        />

      </Routes>

    </BrowserRouter>
  )
}

export default App
''',

"frontend/src/main.jsx": '''import React from "react"
import ReactDOM from "react-dom/client"

import App from "./App"

import "./index.css"

ReactDOM.createRoot(
  document.getElementById("root")
).render(

  <React.StrictMode>
    <App />
  </React.StrictMode>
)
''',

"frontend/src/index.css": '''@tailwind base;
@tailwind components;
@tailwind utilities;

body{

    margin:0;

    background:#050505;

    color:white;

    font-family:sans-serif;
}
''',

"frontend/src/pages/MobilePage.jsx": '''function MobilePage(){

    return(

        <div>

            MOBILE PAGE

        </div>
    )
}

export default MobilePage
''',

"frontend/src/pages/TvPage.jsx": '''function TvPage(){

    return(

        <div>

            TV PAGE

        </div>
    )
}

export default TvPage
''',

"frontend/src/pages/AdminPage.jsx": '''function AdminPage(){

    return(

        <div>

            ADMIN PAGE

        </div>
    )
}

export default AdminPage
''',

"frontend/src/context/KaraokeContext.jsx": '''import { createContext } from "react"

export const KaraokeContext = createContext()
''',

"frontend/src/services/api.js": '''import axios from "axios"

const API = axios.create({

    baseURL:
    "http://127.0.0.1:8000/api/karaoke"
})

export default API
''',

"frontend/src/services/websocket.js": '''const socket = new WebSocket(
    "ws://127.0.0.1:8000/api/karaoke/ws"
)

export default socket
''',

"frontend/tailwind.config.js": '''export default {

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {},
  },

  plugins: [],
}
''',

"frontend/postcss.config.js": '''export default {

  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
}
''',

"README.md": '''# MKARAOKE

Realtime QR Karaoke Platform
'''
}

# ==========================================
# CREATE FOLDERS
# ==========================================

for folder in folders:
    os.makedirs(folder, exist_ok=True)

# ==========================================
# CREATE FILES
# ==========================================

for filepath, content in files.items():

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("\\n================================")
print("MKARAOKE CREATED SUCCESSFULLY")
print("================================")
print("\\nProfessional structure generated.")
print("\\nNext:")
print("1. Create React Vite frontend")
print("2. Install npm packages")
print("3. Install backend requirements")
print("4. Run FastAPI")
print("5. Connect WebSocket")
print("6. Add YouTube API")
print("7. Add QR realtime")
