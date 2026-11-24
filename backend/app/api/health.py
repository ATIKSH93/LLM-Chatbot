
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db


router = APIRouter()


@router.get("/health")
def health_check(db: Session = Depends(get_db)):

    # Verify database connectivity
    try:
        db.execute(text("SELECT 1"))

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="database unavailable"
        )

    # Verify that the key pool is configured
    keys_configured = len(settings.api_keys)

    if keys_configured < 2:
        raise HTTPException(
            status_code=503,
            detail="insufficient API keys configured"
        )

    return {
        "status": "ok",
        "keys_configured": keys_configured,
        "cache_enabled": True
    }
