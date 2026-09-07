import { apiClient } from './client';
import { CourseDetail } from './course';
import { VisitLogPhoto } from './visitLog';

export interface SimilarLogItem {
  log_id: number;
  place_id: number;
  place_name: string;
  lat: number | null;
  lng: number | null;
  // 여러 장 사진 확장은 처음엔 범위 밖이었는데(2026-09-06 결정), "취향 맞춤 코스" 카드에서
  // 사진을 넘기면 그 사진에 달린 글로 바뀌어야 해서(2026-09-07 결정, decision-log 참고)
  // 대표 사진 1장(photo_url)에서 전체 목록+캡션(photos)으로 확장. 없으면 빈 배열
  photos: VisitLogPhoto[];
  one_line: string | null;
  rating: number | null; // 1~5, 선택 입력이라 없을 수 있음 (2026-09-05 추가, decision-log 참고)
  tags: string[];
  // 2026-09-03 추가 (decision-log 참고) — Figma "취향 비슷 사용자 프로필"(507:10963) 카드의
  // 작성자 이름+아바타에 대응
  nickname: string;
  profile_image_url: string | null;
}

export interface SimilarLogsResponse {
  logs: SimilarLogItem[];
}

// 코스 안 장소 하나의 미리보기(이름+썸네일). "취향 맞춤 코스" 카드에서 사진을 넘기면 그 장소
// 이름으로 설명 텍스트가 바뀌게 하기 위한 쌍(2026-09-07 결정, decision-log 참고)
export interface SimilarCoursePlacePreview {
  name: string;
  thumbnail_url: string | null;
}

export interface SimilarCourseItem {
  course_id: number;
  title: string;
  travel_date: string | null;
  end_date: string | null;
  place_count: number;
  // 카드 사진 캐러셀용(방문 순서 기준 최대 3장) — 장소 좌표/전체 경로는 없음. "선택" 시
  // exploreApi.getCourseDetail로 따로 조회해서 지도 미리보기에 씀(2026-09-07 결정)
  place_previews: SimilarCoursePlacePreview[];
  nickname: string;
  profile_image_url: string | null;
}

export interface SimilarCoursesResponse {
  courses: SimilarCourseItem[];
}

export const exploreApi = {
  // 내 상위 태그(score 상위 3개)와 겹치는(score 0.6 이상) 다른 유저의 공개 기록.
  // bounds("swLat,swLng,neLat,neLng")는 지도 뷰포트 필터용, 생략하면 뷰포트 제한 없이 반환됨
  similarLogs: (params: { bounds?: string; limit?: number } = {}) => {
    const { bounds, limit = 50 } = params;
    const query = new URLSearchParams({ limit: String(limit) });
    if (bounds) query.set('bounds', bounds);
    return apiClient.get<SimilarLogsResponse>(`/explore/similar-logs?${query.toString()}`, true);
  },

  // "취향 맞춤 코스" 탭 카드 목록(2026-09-07 결정, decision-log 참고)
  similarCourses: (limit = 20) =>
    apiClient.get<SimilarCoursesResponse>(`/explore/similar-courses?limit=${limit}`, true),

  // "선택"/"자세히 보기" — GET /courses/{courseId}와 응답 형태 동일(CourseDetail), 소유권 대신
  // 공개 여부만 확인
  getCourseDetail: (courseId: number) => apiClient.get<CourseDetail>(`/explore/courses/${courseId}`, true),
};
