from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Table, Boolean
from sqlalchemy.orm import relationship, declarative_base
import enum
from datetime import datetime

Base = declarative_base()

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ORGANIZER = "organizer"
    PARTICIPANT = "participant"
    OBSERVER = "observer"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.PARTICIPANT)
    education = Column(String, nullable=True)
    work_place = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    city = Column(String, nullable=True)
    telegram = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    
    participations = relationship("Participation", back_populates="user")
    rating = relationship("Rating", back_populates="user", uselist=False)

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    base_points = Column(Integer, default=10)
    difficulty_coeff = Column(Float, default=1.0) # 1.0, 1.5, 2.0
    category = Column(String, nullable=True) # IT, Media, Sport
    prizes = Column(String, nullable=True) # text list or description
    organizer_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="published") # draft, published, completed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    participations = relationship("Participation", back_populates="event")

class Participation(Base):
    __tablename__ = "participations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"))
    status = Column(String, default="pending") # pending, confirmed, rejected
    confirmed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="participations")
    event = relationship("Event", back_populates="participations")

class Rating(Base):
    __tablename__ = "ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    total_points = Column(Integer, default=0)
    rank = Column(Integer, nullable=True)
    level = Column(String, default="Novice") # Novice, Activist, Leader, Elite
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="rating")
