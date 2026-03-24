from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
import qrcode
from typing import List
from .database import get_db
from .models import User, Event, Participation, Rating, UserRole
from .schemas import UserCreate, UserLogin, UserResponse, Token, EventCreate, EventResponse, RatingResponse
from .auth import get_password_hash, verify_password, create_access_token, get_current_user
from .ai_service import generate_ai_summary
from datetime import datetime
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from xhtml2pdf import pisa
except ImportError:
    pass

router = APIRouter()

# --- Auth ---
@router.post("/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        hashed_password=hashed_password,
        name=user.name,
        role=user.role,
        education=user.education,
        work_place=user.work_place,
        age=user.age,
        city=user.city,
        telegram=user.telegram
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Initialize Rating
    new_rating = Rating(user_id=new_user.id, total_points=0, level="Novice")
    db.add(new_rating)
    db.commit()
    
    return new_user

@router.post("/auth/login", response_model=Token)
def login(form_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me")
def get_user_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rating = db.query(Rating).filter(Rating.user_id == current_user.id).first()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "education": current_user.education,
        "work_place": current_user.work_place,
        "avatar_url": current_user.avatar_url,
        "age": current_user.age,
        "city": current_user.city,
        "telegram": current_user.telegram,
        "is_verified": current_user.is_verified,
        "rating": {
            "total_points": rating.total_points if rating else 0,
            "level": rating.level if rating else "Novice",
            "rank": rating.rank if rating else None
        }
    }

@router.put("/users/me")
def update_user_me(user_data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Simple profile update endpoint
    if "name" in user_data: current_user.name = user_data["name"]
    if "city" in user_data: current_user.city = user_data["city"]
    if "education" in user_data: current_user.education = user_data["education"]
    if "work_place" in user_data: current_user.work_place = user_data["work_place"]
    if "telegram" in user_data: current_user.telegram = user_data["telegram"]
    
    db.commit()
    db.refresh(current_user)
    return {"message": "Профиль успешно обновлен."}

@router.get("/users/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    rating = db.query(Rating).filter(Rating.user_id == user.id).first()
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "education": user.education,
        "work_place": user.work_place,
        "avatar_url": user.avatar_url,
        "age": user.age,
        "city": user.city,
        "telegram": user.telegram,
        "is_verified": user.is_verified,
        "rating": {
            "total_points": rating.total_points if rating else 0,
            "level": rating.level if rating else "Novice",
            "rank": rating.rank if rating else None
        }
    }

@router.get("/users")
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.OBSERVER]:
        raise HTTPException(status_code=403, detail="Not authorized for HR view")
    
    users = db.query(User).filter(User.role == UserRole.PARTICIPANT).all()
    results = []
    for u in users:
        rating = db.query(Rating).filter(Rating.user_id == u.id).first()
        results.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "education": u.education,
            "work_place": u.work_place,
            "age": u.age,
            "city": u.city,
            "telegram": u.telegram,
            "rating": {
                "total_points": rating.total_points if rating else 0,
                "level": rating.level if rating else "Novice",
                "rank": rating.rank if rating else None
            }
        })
    return results

@router.get("/users/{user_id}/pdf")
def get_user_pdf(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    rating = db.query(Rating).filter(Rating.user_id == user.id).first()
    
    # Use HTML template for xhtml2pdf to handle Cyrillic better
    html_content = f"""
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Helvetica, sans-serif; }}
            .header {{ font-size: 24pt; font-weight: bold; text-align: center; margin-bottom: 20pt; }}
            .item {{ margin-bottom: 10pt; font-size: 14pt; }}
            .label {{ font-weight: bold; color: #333; }}
        </style>
    </head>
    <body>
        <div class="header">RAZUM 2.0 Candidate Report</div>
        <div class="item"><span class="label">Name:</span> {user.name}</div>
        <div class="item"><span class="label">Email:</span> {user.email}</div>
        <div class="item"><span class="label">Role:</span> {user.role.value}</div>
        <div class="item"><span class="label">City:</span> {user.city or "N/A"}</div>
        <hr/>
        <div class="item"><span class="label">Total Points:</span> {rating.total_points if rating else 0}</div>
        <div class="item"><span class="label">Level:</span> {rating.level if rating else 'Novice'}</div>
    </body>
    </html>
    """
    
    buffer = BytesIO()
    pisa.CreatePDF(html_content, dest=buffer, encoding='utf-8')
    pdf = buffer.getvalue()
    buffer.close()
    
    return Response(
        content=pdf, 
        media_type="application/pdf", 
        headers={'Content-Disposition': f'attachment; filename="report_{user.id}.pdf"'}
    )

# --- Events ---
@router.get("/users/{user_id}/events")
def get_user_events(user_id: int, db: Session = Depends(get_db)):
    user_events = db.query(Participation, Event).join(Event, Participation.event_id == Event.id).filter(Participation.user_id == user_id).all()
    
    result = []
    for part, event in user_events:
        result.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "category": event.category,
            "base_points": event.base_points,
            "difficulty_coeff": event.difficulty_coeff,
            "status": part.status,
            "created_at": part.created_at
        })
    return result
  
@router.post("/events", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.ORGANIZER]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    new_event = Event(
        title=event.title,
        description=event.description,
        base_points=event.base_points,
        difficulty_coeff=event.difficulty_coeff,
        category=event.category,
        prizes=event.prizes,
        organizer_id=current_user.id
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@router.put("/events/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event_data: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.ORGANIZER]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    if db_event.organizer_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Can only edit own events")
        
    db_event.title = event_data.title
    db_event.description = event_data.description
    db_event.base_points = event_data.base_points
    db_event.difficulty_coeff = event_data.difficulty_coeff
    db_event.category = event_data.category
    db_event.prizes = event_data.prizes
    
    db.commit()
    db.refresh(db_event)
    return db_event

@router.get("/events/{event_id}/qr")
def get_event_qr(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # QR data could be the URL to the event confirm page or just event info
    qr_data = f"https://razum.dev/events/{event_id}/confirm"
    img = qrcode.make(qr_data)
    
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="image/png")

@router.get("/events", response_model=List[EventResponse])
def get_events(db: Session = Depends(get_db)):
    return db.query(Event).all()

@router.post("/events/{event_id}/join")
def join_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
        
    # Anti-Farming: limit to 3 pending requests
    pending_count = db.query(Participation).filter(
        Participation.user_id == current_user.id,
        Participation.status == "pending"
    ).count()
    
    if pending_count >= 3:
        raise HTTPException(
            status_code=400, 
            detail="Вы не можете подать больше 3 заявок одновременно. Дождитесь проверки."
        )

    # Check if already joined
    existing = db.query(Participation).filter(
        Participation.user_id == current_user.id, 
        Participation.event_id == event_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже подавали заявку на это событие")
        
    participation = Participation(user_id=current_user.id, event_id=event_id, status="pending")
    db.add(participation)
    db.commit()
    return {"message": "Заявка отправлена организатору"}

@router.post("/events/{event_id}/confirm/{user_id}")
def confirm_participation(event_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or (event.organizer_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized (only organizer or admin can confirm)")
        
    participation = db.query(Participation).filter(
        Participation.user_id == user_id, 
        Participation.event_id == event_id
    ).first()
    if not participation:
        raise HTTPException(status_code=404, detail="Participation request not found")
        
    if participation.status == "confirmed":
        return {"message": "Already confirmed"}
        
    participation.status = "confirmed"
    participation.confirmed_at = datetime.utcnow()
    
    # Update Points
    rating = db.query(Rating).filter(Rating.user_id == user_id).first()
    points_earned = int(event.base_points * event.difficulty_coeff)
    rating.total_points += points_earned
    
    # Simple Level Logic
    if rating.total_points > 400: rating.level = "Elite"
    elif rating.total_points > 150: rating.level = "Leader"
    elif rating.total_points > 50: rating.level = "Activist"
    
    db.commit()
    return {"message": f"Confirmed! User earned {points_earned} points."}

@router.get("/events/{event_id}/participants")
def get_event_participants(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or (event.organizer_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    participations = db.query(Participation, User).join(User).filter(Participation.event_id == event_id).all()
    return [
        {
            "user_id": p.Participation.user_id,
            "name": p.User.name,
            "email": p.User.email,
            "status": p.Participation.status,
            "confirmed_at": p.Participation.confirmed_at
        }
        for p in participations
    ]

@router.delete("/events/{event_id}/participation")
def cancel_participation(event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    participation = db.query(Participation).filter(
        Participation.event_id == event_id,
        Participation.user_id == current_user.id
    ).first()
    
    if not participation:
        raise HTTPException(status_code=404, detail="Participation not found")
    
    if participation.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot cancel confirmed participation")
        
    db.delete(participation)
    db.commit()
    return {"message": "Participation cancelled"}

# --- Rating & AI ---
@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    results = db.query(User.name, Rating.total_points, Rating.level)\
                .join(Rating).order_by(Rating.total_points.desc()).limit(10).all()
    return [{"name": r[0], "points": r[1], "level": r[2]} for r in results]

@router.get("/users/{user_id}/ai-summary")
async def get_user_ai_summary(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    # Get activities
    activities = db.query(Event.title, Event.base_points, Event.difficulty_coeff)\
                   .join(Participation).filter(Participation.user_id == user_id).all()
    
    act_list = [{"title": a[0], "points": int(a[1]*a[2])} for a in activities]
    
    summary = await generate_ai_summary(user.name, act_list)
    return {"summary": summary}
