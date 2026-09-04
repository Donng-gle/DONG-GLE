import { CourseDetail, CourseListItem, CoursePlaceItem } from '../../api/course';
import { MOCK_PLACES } from './places';

function place(id: number) {
  const p = MOCK_PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`mock place not found: ${id}`);
  return p;
}

function toCoursePlaceItem(
  placeId: number,
  visitOrder: number,
  plannedTime: string | null,
  distanceFromPrevKm: number | null,
  durationFromPrevMin: number | null,
): CoursePlaceItem {
  const p = place(placeId);
  return {
    place_id: p.id,
    name: p.name,
    visit_order: visitOrder,
    planned_time: plannedTime,
    lat: p.lat,
    lng: p.lng,
    main_image_url: p.main_image_url,
    distance_from_prev_km: distanceFromPrevKm,
    duration_from_prev_min: durationFromPrevMin,
  };
}

// "취향 맞춤 코스" 저장된 코스 목록 목업(courseApi.myCourses)
export const MOCK_COURSE_LIST: CourseListItem[] = [
  {
    id: 5001,
    title: '전통 안동 하루 코스',
    travel_date: '2026-09-10',
    source: 'ai',
    place_count: 4,
    thumbnail_url: place(1).main_image_url,
    created_at: '2026-08-15T09:00:00',
  },
  {
    id: 5002,
    title: '감성 카페 + 야경 코스',
    travel_date: '2026-09-12',
    source: 'user',
    place_count: 3,
    thumbnail_url: place(11).main_image_url,
    created_at: '2026-08-22T20:30:00',
  },
];

// courseApi.getDetail(5001)
const COURSE_5001_PLACES: CoursePlaceItem[] = [
  toCoursePlaceItem(1, 1, '09:30', null, null),
  toCoursePlaceItem(2, 2, '11:30', 4.2, 9),
  toCoursePlaceItem(4, 3, '14:00', 8.6, 15),
  toCoursePlaceItem(9, 4, '16:30', 12.1, 20),
];

// courseApi.getDetail(5002)
const COURSE_5002_PLACES: CoursePlaceItem[] = [
  toCoursePlaceItem(11, 1, '15:00', null, null),
  toCoursePlaceItem(6, 2, '18:00', 1.8, 6),
  toCoursePlaceItem(5, 3, '19:30', 0.9, 3),
];

export const MOCK_COURSE_DETAILS: Record<number, CourseDetail> = {
  5001: {
    id: 5001,
    title: '전통 안동 하루 코스',
    travel_date: '2026-09-10',
    source: 'ai',
    places: COURSE_5001_PLACES,
    total_distance_km: 24.9,
    total_duration_min: 44,
    polyline: null,
    updated_at: '2026-08-15T09:00:00',
  },
  5002: {
    id: 5002,
    title: '감성 카페 + 야경 코스',
    travel_date: '2026-09-12',
    source: 'user',
    places: COURSE_5002_PLACES,
    total_distance_km: 2.7,
    total_duration_min: 9,
    polyline: null,
    updated_at: '2026-08-22T20:30:00',
  },
};

// courseApi.generate 결과 — 스와이프로 고른 걸 반영하는 대신 항상 같은 후보 하나 반환(실제
// course_optimizer 지금도 후보 1개만 옴, decision-log 2026-08-30 참고)
export function buildMockGeneratedCandidate(candidateId: string): {
  candidate_id: string;
  title: string;
  places: CoursePlaceItem[];
  total_distance_km: number | null;
  total_duration_min: number | null;
} {
  return {
    candidate_id: candidateId,
    title: '오늘의 추천 코스',
    places: [
      toCoursePlaceItem(1, 1, '10:00', null, null),
      toCoursePlaceItem(8, 2, '12:00', 0.6, 3),
      toCoursePlaceItem(6, 3, '13:30', 6.4, 11),
      toCoursePlaceItem(5, 4, '18:00', 1.2, 4),
    ],
    total_distance_km: 8.2,
    total_duration_min: 18,
  };
}
