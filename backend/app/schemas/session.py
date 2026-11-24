
from pydantic import BaseModel, ConfigDict


class MessageResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    role: str
    content: str
    metadata: dict | None = None


class SessionHistoryResponse(BaseModel):

    session_id: str
    messages: list[MessageResponse]
