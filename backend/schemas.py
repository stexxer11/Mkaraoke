from pydantic import BaseModel
from typing import Optional


class SongCreate(BaseModel):
    title: str
    artist: str
    youtubeId: str
    ownerId: str
    username: str   # NUEVO
    transpose: int = 0


class SongUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    youtubeId: Optional[str] = None
    transpose: Optional[int] = None