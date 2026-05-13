from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    id: str
    artistName: str

class SongCreate(BaseModel):
    ownerId: str
    title: str
    artist: str
    youtubeId: str

class SongUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    youtubeId: Optional[str] = None