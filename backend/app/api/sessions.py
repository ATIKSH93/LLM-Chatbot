
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.repositories.message_repository import MessageRepository
from app.schemas.session import (
    MessageResponse,
    SessionHistoryResponse,
)


router = APIRouter()


@router.get(
    "/sessions/{session_id}/messages",
    response_model=SessionHistoryResponse
)
def get_session_history(
    session_id: str,
    db: Session = Depends(get_db),
):

    messages = MessageRepository.get_session_messages(
        db,
        session_id
    )

    # Return 404 if the session does not exist
    if not messages:
        raise HTTPException(
            status_code=404,
            detail="session not found"
        )

    response_messages = []

    for message in messages:

        metadata = (
            json.loads(message.metadata_json)
            if message.metadata_json
            else None
        )

        response_messages.append(
            MessageResponse(
                role=message.role,
                content=message.content,
                metadata=metadata,
            )
        )

    return SessionHistoryResponse(
        session_id=session_id,
        messages=response_messages,
    )
