"""동글 AI HTTP 서버.

POST /v1/places/recommend  어떤 장소를 추천할지
POST /v1/courses/optimize  추천된 장소를 어떤 순서로 방문할지
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from course_optimizer.exceptions import (
    CourseOptimizerError,
    InvalidCourseEvaluationError,
    InvalidTripInputError,
    NoFeasibleRouteError,
    PlacesApiError,
    ReplacementNotFoundError,
    RoutesApiError,
)
from course_optimizer.models import CourseOptimizationResult, TripInput
from course_optimizer.planner import optimize_course
from place_recommender.models import RecommendRequest, RecommendResponse
from place_recommender.recommender import recommend_places

app = FastAPI(title="dongle-ai", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/places/recommend", response_model=RecommendResponse)
async def recommend(request: RecommendRequest) -> RecommendResponse:
    return await recommend_places(request)


@app.post("/v1/courses/optimize", response_model=CourseOptimizationResult)
async def optimize(trip: TripInput) -> CourseOptimizationResult:
    return await optimize_course(trip)


@app.exception_handler(InvalidTripInputError)
async def handle_invalid_trip_input(
    _request: Request, exc: InvalidTripInputError
) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(NoFeasibleRouteError)
async def handle_no_feasible_route(
    _request: Request, exc: NoFeasibleRouteError
) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


async def handle_upstream_error(_request: Request, exc: CourseOptimizerError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(ReplacementNotFoundError)
@app.exception_handler(CourseOptimizerError)
async def handle_optimizer_error(
    _request: Request, exc: CourseOptimizerError
) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": str(exc)})


for _exc in (PlacesApiError, RoutesApiError, InvalidCourseEvaluationError):
    app.add_exception_handler(_exc, handle_upstream_error)
