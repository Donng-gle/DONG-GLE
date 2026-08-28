FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY pyproject.toml ./
COPY hidden_score ./hidden_score
COPY semantic_vector ./semantic_vector
COPY course_optimizer ./course_optimizer
COPY place_recommender ./place_recommender
COPY api ./api

RUN pip install .

EXPOSE 8000

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]
