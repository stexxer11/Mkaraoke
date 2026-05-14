from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


# =====================================================
# USER
# =====================================================

class UserCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    artist_name: str = Field(alias="artistName")


# =====================================================
# SONG CREATE
# =====================================================

class SongCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    owner_id: str = Field(alias="ownerId")
    title: str
    artist: str
    youtube_id: str = Field(alias="youtubeId")


# =====================================================
# SONG UPDATE
# =====================================================

class SongUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = None
    artist: Optional[str] = None
    youtube_id: Optional[str] = Field(default=None, alias="youtubeId")