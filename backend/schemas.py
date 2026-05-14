from pydantic import BaseModel, Field
from typing import Optional


class UserCreate(BaseModel):
    id: str
    artist_name: str = Field(alias="artistName")

    class Config:
        populate_by_name = True


class SongCreate(BaseModel):
    owner_id: str = Field(alias="ownerId")
    title: str
    artist: str
    youtube_id: str = Field(alias="youtubeId")

    class Config:
        populate_by_name = True


class SongUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    youtube_id: Optional[str] = Field(default=None, alias="youtubeId")

    class Config:
        populate_by_name = True