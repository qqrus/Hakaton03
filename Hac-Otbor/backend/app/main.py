from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .models import *
from .routes import router

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="RAZUM 2.0 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.on_event("startup")
def seed_data():
    from .database import SessionLocal
    from .models import User, UserRole, Rating
    from .auth import get_password_hash
    
    db = SessionLocal()
    try:
        # Initial users
        seed_users = [
            ("admin@razum.dev", "password123", "Админ", UserRole.ORGANIZER),
            ("participant@razum.dev", "password123", "Участник", UserRole.PARTICIPANT),
            ("hr@razum.dev", "password123", "Инспектор HR", UserRole.OBSERVER)
        ]
        
        for email, pwd, name, role in seed_users:
            exists = db.query(User).filter(User.email == email).first()
            if not exists:
                user = User(
                    email=email,
                    hashed_password=get_password_hash(pwd),
                    name=name,
                    role=role,
                    city="Москва",
                    education="ВШЭ"
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                
                # Rating for participant
                if role == UserRole.PARTICIPANT:
                    rating = Rating(user_id=user.id, total_points=350, level="Activist")
                    db.add(rating)
                    db.commit()
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "RAZUM 2.0 API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
