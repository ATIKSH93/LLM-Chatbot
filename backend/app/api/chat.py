
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.session import ChatRequest, ChatResponse
from app.services.chat_service import process_chat


router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    simulate_failure: str | None = Header(
        default=None,
        alias="X-Simulate-Failure",
    ),
):

    return process_chat(
        db=db,
        request=request,
        simulate_failure=simulate_failure,
    )
