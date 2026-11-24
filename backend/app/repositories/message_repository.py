
import json

from sqlalchemy.orm import Session

from app.db.models import Message


class MessageRepository:

    @staticmethod
    def create_message(
        db: Session,
        session_id: str,
        role: str,
        content: str,
        metadata: dict | None = None,
    ) -> Message:

        message = Message(
            session_id=session_id,
            role=role,
            content=content,
            metadata_json=(
                json.dumps(metadata)
                if metadata is not None
                else None
            ),
        )

        db.add(message)
        db.commit()
        db.refresh(message)

        return message

    @staticmethod
    def get_session_messages(
        db: Session,
        session_id: str,
    ) -> list[Message]:

        return (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .order_by(Message.created_at, Message.id)
            .all()
        )

    @staticmethod
    def session_exists(
        db: Session,
        session_id: str,
    ) -> bool:

        return (
            db.query(Message.id)
            .filter(Message.session_id == session_id)
            .first()
            is not None
        )
