import json
from dataclasses import dataclass

from app.models import ChatMessage, Chat
from app.rag.types import ChatEventType, ChatMessageSate


class ChatStreamPayload:
    def dump(self):
        pass


@dataclass
class ChatStreamDataPayload(ChatStreamPayload):
    chat: Chat
    user_message: ChatMessage
    assistant_message: ChatMessage

    def dump(self):
        return [
            {
                "chat": self.chat.model_dump(mode="json"),
                "user_message": self.user_message.model_dump(mode="json"),
                "assistant_message": self.assistant_message.model_dump(mode="json"),
            }
        ]


@dataclass
class ChatStreamMessagePayload(ChatStreamPayload):
    state: ChatMessageSate = ChatMessageSate.TRACE
    display: str = ""
    context: dict | list | str = ""

    def dump(self):
        return [
            {
                "state": self.state.name,
                "display": self.display,
                "context": self.context,
            }
        ]


@dataclass
class ChatEvent:
    event_type: ChatEventType
    payload: str | ChatStreamPayload | None = None

    def encode(self, charset) -> bytes:
        body = self.payload

        if isinstance(body, ChatStreamPayload):
            body = body.dump()

        body = json.dumps(body, separators=(",", ":"))

        return f"{self.event_type.value}:{body}\n".encode(charset)
