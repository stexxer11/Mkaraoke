from pydantic import BaseModel

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
