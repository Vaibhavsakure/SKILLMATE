"""
AI Chatbot API — Conversational career assistant.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Literal

from app.services.ai_service import ai_service
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# Caps on replayed history — an unbounded `history` array lets a client push
# arbitrarily large payloads straight into the model on every request.
MAX_HISTORY_MESSAGES = 30
MAX_MESSAGE_CHARS = 8_000


# --- Models ---
class ChatMessage(BaseModel):
    # Literal, not str: a client-supplied role of "system" would be lifted into
    # the Claude system prompt by ai_service._claude_chat, letting the caller
    # replace the assistant's instructions.
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)
    history: List[ChatMessage] = Field(default_factory=list, max_length=MAX_HISTORY_MESSAGES)


class ChatResponse(BaseModel):
    response: str
    history: List[ChatMessage]


# --- Endpoint ---
@router.post("/send", response_model=ChatResponse)
async def send_chat_message(
    data: ChatRequest,
    user: dict = Depends(get_current_user),
):
    """Sends a message to the AI chatbot and returns the response."""

    try:
        # 1. System Prompt
        system_msg = {
            "role": "system",
            "content": (
                "You are Skillmate AI, a helpful career assistant. "
                "Your goal is to help users with resume building, interview prep, and career advice. "
                "Be concise, encouraging, and professional."
            ),
        }

        # 2. Build Message List
        messages = [system_msg]
        for msg in data.history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": data.message})

        # 3. Get Response
        ai_reply = await ai_service.chat(messages)
        logger.info(f"Chat response generated for user {user.get('id')}")

        # 4. Update History
        updated_history = data.history + [
            ChatMessage(role="user", content=data.message),
            ChatMessage(role="assistant", content=ai_reply),
        ]

        return ChatResponse(response=ai_reply, history=updated_history)

    except Exception as e:
        logger.error(f"Chat API Error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat message")
