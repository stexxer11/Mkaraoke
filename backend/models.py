from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
import uuid

from database import Base


class Song(Base):

    __tablename__ = "songs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    ownerId = Column(String, index=True)

    title = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    youtubeId = Column(String, nullable=False)

    transpose = Column(Integer, default=0)

    status = Column(String, default="queued")  # queued | playing | done | cancelled

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow)