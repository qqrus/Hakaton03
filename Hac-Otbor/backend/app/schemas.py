from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from .models import UserRole

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole
    education: Optional[str] = None
    work_place: Optional[str] = None
    age: Optional[int] = None
    city: Optional[str] = None
    telegram: Optional[str] = None
    is_verified: bool = False

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class EventBase(BaseModel):
    title: str
    description: str
    base_points: int = 10
    difficulty_coeff: float = 1.0
    category: Optional[str] = None
    prizes: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    organizer_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class RatingResponse(BaseModel):
    total_points: int
    rank: Optional[int]
    level: str
    updated_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
