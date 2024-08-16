from typing import Optional, Any

from sqlmodel import Field, Column, JSON

from .base import UpdatableBaseModel, AESEncryptedColumn
from app.types import LLMProvider


class BaseLLM(UpdatableBaseModel):
    name: str = Field(max_length=64)
    provider: LLMProvider
    model: str = Field(max_length=256)
    config: dict | list | None = Field(sa_column=Column(JSON), default={})
    is_default: bool = Field(default=False)


class LLM(BaseLLM, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    credentials: Any = Field(sa_column=Column(AESEncryptedColumn, nullable=True))

    __tablename__ = "llms"


class AdminLLM(BaseLLM):
    id: int
