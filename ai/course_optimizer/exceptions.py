"""course_optimizer 예외 정의."""


class CourseOptimizerError(Exception):
  """course_optimizer 기본 예외."""


class InvalidTripInputError(CourseOptimizerError):
  """TripInput 검증 실패."""


class InvalidCourseEvaluationError(CourseOptimizerError):
  """LLM 평가 응답 검증 실패."""


class NoFeasibleRouteError(CourseOptimizerError):
  """실행 가능한 경로가 없음."""


class PlacesApiError(CourseOptimizerError):
  """Google Places API 오류."""


class RoutesApiError(CourseOptimizerError):
  """Google Routes API 오류."""


class ReplacementNotFoundError(CourseOptimizerError):
  """대체 장소를 찾지 못함."""
