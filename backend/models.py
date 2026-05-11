from sqlalchemy import Column
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
