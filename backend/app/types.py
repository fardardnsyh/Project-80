import enum


class LLMProvider(str, enum.Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    ANTHROPIC_VERTEX = "anthropic_vertex"
    OPENAI_LIKE = "openai_like"
    BEDROCK = "bedrock"


class EmbeddingProvider(str, enum.Enum):
    OPENAI = "openai"


class RerankerProvider(str, enum.Enum):
    JINA = "jina"
    COHERE = "cohere"
