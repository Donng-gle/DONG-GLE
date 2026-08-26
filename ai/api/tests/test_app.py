from datetime import datetime
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from api.app import app
from course_optimizer.exceptions import (
    InvalidTripInputError,
    NoFeasibleRouteError,
    PlacesApiError,
)
from course_optimizer.models import (
    CourseOptimizationResult,
    LatLng,
    RouteScoreBreakdown,
    ScoredRoute,
    VisitStop,
)

client = TestClient(app)

_TRIP = {
    "start_time": "2026-08-25T10:00:00",
    "end_time": "2026-08-25T18:00:00",
    "transport_mode": "walk",
    "origin": {"latitude": 36.568, "longitude": 128.729},
    "candidates": [
        {
            "place_id": "1",
            "category": "관광지",
            "latitude": 36.57,
            "longitude": 128.73,
            "major_scores": {
                "relaxing": 0.7,
                "lively": 0.3,
                "romantic": 0.4,
                "local": 0.6,
                "photogenic": 0.5,
                "traditional": 0.5,
                "modern": 0.2,
            },
        },
        {
            "place_id": "2",
            "category": "카페",
            "latitude": 36.571,
            "longitude": 128.731,
            "major_scores": {
                "relaxing": 0.6,
                "lively": 0.4,
                "romantic": 0.5,
                "local": 0.5,
                "photogenic": 0.6,
                "traditional": 0.3,
                "modern": 0.4,
            },
        },
    ],
}


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_optimize_returns_course_result() -> None:
    result = CourseOptimizationResult(
        selected_route=ScoredRoute(
            stops=[
                VisitStop(
                    place_id="1",
                    arrival_time=datetime(2026, 8, 25, 10, 10),
                    visit_start_time=datetime(2026, 8, 25, 10, 10),
                    departure_time=datetime(2026, 8, 25, 11, 10),
                    actual_stay_minutes=60,
                )
            ],
            score=RouteScoreBreakdown(
                time_score=0.7,
                transition_score=0.0,
                balance_score=100.0,
                experience_score=70.0,
                total_travel_minutes=10,
                travel_score=90.0,
                total_score=80.0,
            ),
        ),
        candidate_route_count=1,
        evaluated_route_count=1,
        target_visit_count=1,
        prompt_version="course-evaluation-v1",
        model_name="gpt-4.1-mini",
    )

    with patch("api.app.optimize_course", new=AsyncMock(return_value=result)):
        response = client.post("/v1/courses/optimize", json=_TRIP)

    assert response.status_code == 200
    body = response.json()
    assert body["selected_route"]["stops"][0]["place_id"] == "1"
    assert body["prompt_version"] == "course-evaluation-v1"


def test_optimize_invalid_trip_returns_400() -> None:
    with patch(
        "api.app.optimize_course",
        new=AsyncMock(side_effect=InvalidTripInputError("not enough candidates")),
    ):
        response = client.post("/v1/courses/optimize", json=_TRIP)
    assert response.status_code == 400
    assert "not enough candidates" in response.json()["detail"]


def test_optimize_no_route_returns_422() -> None:
    with patch(
        "api.app.optimize_course",
        new=AsyncMock(side_effect=NoFeasibleRouteError("no feasible route")),
    ):
        response = client.post("/v1/courses/optimize", json=_TRIP)
    assert response.status_code == 422


def test_optimize_places_api_error_returns_502() -> None:
    with patch(
        "api.app.optimize_course",
        new=AsyncMock(side_effect=PlacesApiError("upstream")),
    ):
        response = client.post("/v1/courses/optimize", json=_TRIP)
    assert response.status_code == 502
