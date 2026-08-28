"""Semantic vector 모듈 예외 정의."""


class SemanticVectorError(Exception):
    """Semantic vector 모듈 기본 예외."""


class InvalidVisionResponseError(SemanticVectorError):
    """GPT Vision 응답 파싱 또는 구조 오류."""


class TagSchemaMismatchError(SemanticVectorError):
    """35개 태그 키 집합 불일치."""


class VectorDimensionError(SemanticVectorError):
    """벡터 차원 오류."""


class QdrantIndexError(SemanticVectorError):
    """Qdrant 연결 또는 Collection 설정 오류."""


class VisionAuthenticationError(SemanticVectorError):
    """OpenAI 인증 오류 (재시도하지 않음)."""


class VisionRetryableError(SemanticVectorError):
    """OpenAI 일시적 오류 (재시도 대상)."""
