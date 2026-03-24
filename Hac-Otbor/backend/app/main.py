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
def startup_event():
    from .seed import seed_db
    seed_db()

@app.get("/")
def read_root():
    return {"message": "RAZUM 2.0 API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
