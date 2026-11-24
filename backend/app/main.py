
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import Base, engine

# Import models before create_all so SQLAlchemy registers them.
from app.db import models

from app.api import health, sessions


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Create database tables automatically at startup.
    Base.metadata.create_all(bind=engine)

    yield

    # Application shutdown actions can be added here.


app = FastAPI(
    title="Lyftr AI Chatbot API",
    description="Backend for the Lyftr full-stack assignment.",
    version="1.0.0",
    lifespan=lifespan,
)


# Configure frontend-backend communication.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers.
app.include_router(health.router)
app.include_router(sessions.router)


@app.get("/")
def root():
    return {
        "message": "Lyftr AI Chatbot API is running"
    }
