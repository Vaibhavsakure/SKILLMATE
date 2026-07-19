"""
AI Chatbot API — Conversational career assistant.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List

from app.services.ai_service import ai_service
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


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
