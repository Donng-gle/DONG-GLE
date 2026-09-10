import { CourseDetail, CourseListItem, CoursePlaceItem } from '../../api/course';
import { MOCK_PLACES } from './places';

function place(id: number) {
  const p = MOCK_PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`mock place not found: ${id}`);
  return p;
}

// 직전 장소와의 실제 좌표 기반 직선거리(km) — CourseManualBuilderScreen.tsx의 동명 함수와 동일 공식
// (2026-09-11 추가). 예전엔 distance_from_prev_km/duration_from_prev_min을 화면마다 임의의 숫자로
// 손으로 채워넣어서(예: 서로 다른 두 장소 쌍이 우연히 똑같이 "5.9 KM"), 실제 장소 좌표와 전혀
// 무관했음(사용자 지적) — 실제 서버(CourseService.routeFor, 구글맵 Directions)는 이미 실좌표 기반
// 경로로 계산하고 있어서 정확했지만, 목업 모드로 화면 확인할 땐 거리가 가짜였던 것
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// 실제 도로 경로가 아니라 직선거리라 항상 실제보다 짧음(구글맵 Directions와는 다름) — 목업 전용
// 근사치. 시간은 편도 평균 25km/h(차량 이동 가정, 기존에 손으로 채워뒀던 값들의 거리/시간 비율과
// 비슷한 수준)로 환산
const MOCK_AVG_SPEED_KMH = 25;

interface CoursePlaceSpec {
  placeId: number;
  plannedTime: string | null;
  // 여러 날 코스 지원(2026-09-06 결정, decision-log 참고) — 하루짜리 코스는 생략(undefined→null)
  visitDate?: string | null;
}

// 날짜가 바뀌거나(여러 날 코스) 목록의 첫 장소면 거리/시간을 null로(실제 서버와 동일 규칙,
// CourseService.kt의 "index == 0이면 leg는 null" 참고), 그 외엔 직전 장소와의 haversineKm으로 채움
function buildCoursePlaces(specs: CoursePlaceSpec[]): CoursePlaceItem[] {
  let prevCoord: { lat: number; lng: number } | null = null;
  let prevDate: string | null = null;
  let isFirst = true;

  return specs.map((spec, index) => {
    const p = place(spec.placeId);
    const visitDate = spec.visitDate ?? null;
    const sameDay = !isFirst && visitDate === prevDate;
    const hasCoord = p.lat != null && p.lng != null;

    let distanceKm: number | null = null;
    let durationMin: number | null = null;
    if (sameDay && prevCoord != null && hasCoord) {
      const raw = haversineKm(prevCoord, { lat: p.lat as number, lng: p.lng as number });
      distanceKm = Math.round(raw * 10) / 10;
      durationMin = Math.max(1, Math.round((raw / MOCK_AVG_SPEED_KMH) * 60));
    }

    if (hasCoord) prevCoord = { lat: p.lat as number, lng: p.lng as number };
    prevDate = visitDate;
    isFirst = false;

    return {
      place_id: p.id,
      name: p.name,
      visit_order: index + 1,
      planned_time: spec.plannedTime,
      lat: p.lat,
      lng: p.lng,
      main_image_url: p.main_image_url,
      distance_from_prev_km: distanceKm,
      duration_from_prev_min: durationMin,
      visit_date: visitDate,
      category: p.category,
    };
  });
}

// "취향 맞춤 코스" 저장된 코스 목록 목업(courseApi.myCourses)
// place_thumbnails: 스크랩북 카드 썸네일 스트립용, 방문 순서 기준 최대 3장(server
// CourseService.SCRAPBOOK_THUMBNAIL_LIMIT와 동일한 규칙, 2026-09-05 추가)
export const MOCK_COURSE_LIST: CourseListItem[] = [
  {
    id: 5001,
    title: '전통 안동 하루 코스',
    travel_date: '2026-09-10',
    end_date: null, // AI 코스는 여러 날 범위 미지원(2026-09-06 결정, decision-log 참고)
    source: 'ai',
    place_count: 4,
    thumbnail_url: place(1).main_image_url,
    // 코스 장소가 4곳(1,2,4,9)인데 3장만 노출 — 나머지 1곳은 "1+" 배지로 확인 가능
    place_thumbnails: [place(1).main_image_url, place(2).main_image_url, place(4).main_image_url].filter(
      (url): url is string => url != null,
    ),
    created_at: '2026-08-15T09:00:00',
  },
  {
    id: 5002,
    title: '감성 카페 + 야경 코스',
    travel_date: '2026-09-12',
    // 직접 코스는 여러 날 범위 선택 가능(2026-09-06 추가) — 목업 데이터로 화면 확인용
    end_date: '2026-09-14',
    source: 'user',
    place_count: 3,
    thumbnail_url: place(11).main_image_url,
    // 코스 장소가 정확히 3곳(11,6,5)이라 "N+" 배지 없이 다 보임
    place_thumbnails: [place(11).main_image_url, place(6).main_image_url, place(5).main_image_url].filter(
      (url): url is string => url != null,
    ),
    created_at: '2026-08-22T20:30:00',
  },
];

// courseApi.getDetail(5001)
const COURSE_5001_PLACES: CoursePlaceItem[] = buildCoursePlaces([
  { placeId: 1, plannedTime: '09:30' },
  { placeId: 2, plannedTime: '11:30' },
  { placeId: 4, plannedTime: '14:00' },
  { placeId: 9, plannedTime: '16:30' },
]);

// courseApi.getDetail(5002) — 3일짜리(9/12~9/14) 직접 코스라 장소마다 visit_date로 날짜 구분
// (2026-09-06 결정, decision-log 참고). 1일차 1곳, 2일차 1곳, 3일차 1곳으로 목업 구성
const COURSE_5002_PLACES: CoursePlaceItem[] = buildCoursePlaces([
  { placeId: 11, plannedTime: '15:00', visitDate: '2026-09-12' },
  { placeId: 6, plannedTime: '11:00', visitDate: '2026-09-13' },
  { placeId: 5, plannedTime: '19:30', visitDate: '2026-09-14' },
]);

// 코스 총 거리/시간도 위 장소별 값의 실제 합으로 — 예전엔 이것도 손으로 채운 임의 값이었음
function sumDistance(places: CoursePlaceItem[]): number | null {
  const known = places.map((p) => p.distance_from_prev_km).filter((d): d is number => d != null);
  return known.length > 0 ? Math.round(known.reduce((a, b) => a + b, 0) * 10) / 10 : null;
}
function sumDuration(places: CoursePlaceItem[]): number | null {
  const known = places.map((p) => p.duration_from_prev_min).filter((d): d is number => d != null);
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
}

export const MOCK_COURSE_DETAILS: Record<number, CourseDetail> = {
  5001: {
    id: 5001,
    title: '전통 안동 하루 코스',
    travel_date: '2026-09-10',
    end_date: null,
    source: 'ai',
    places: COURSE_5001_PLACES,
    total_distance_km: sumDistance(COURSE_5001_PLACES),
    total_duration_min: sumDuration(COURSE_5001_PLACES),
    polyline: null,
    updated_at: '2026-08-15T09:00:00',
  },
  5002: {
    id: 5002,
    title: '감성 카페 + 야경 코스',
    travel_date: '2026-09-12',
    end_date: '2026-09-14',
    source: 'user',
    places: COURSE_5002_PLACES,
    total_distance_km: sumDistance(COURSE_5002_PLACES),
    total_duration_min: sumDuration(COURSE_5002_PLACES),
    polyline: null,
    updated_at: '2026-08-22T20:30:00',
  },
};

// "취향 맞춤 코스" 탭 — 다른 사용자의 공개 코스 목업(2026-09-07 결정, decision-log 참고).
// authorId는 mocks/fixtures/users.ts의 MOCK_USERS 참고. exploreApi.similarCourses/getCourseDetail이
// 이 배열을 씀(handlers.ts 참고) — MOCK_COURSE_LIST/DETAILS(내 코스)와는 별개 배열
export interface MockOtherCourse {
  id: number;
  authorId: number;
  title: string;
  travelDate: string | null;
  endDate: string | null;
  places: CoursePlaceItem[];
}

export const MOCK_OTHER_COURSES: MockOtherCourse[] = [
  {
    id: 6001,
    authorId: 101,
    title: '하회마을+월영교 반나절 코스',
    travelDate: '2026-08-18',
    endDate: null,
    places: buildCoursePlaces([
      { placeId: 1, plannedTime: '10:00' },
      { placeId: 5, plannedTime: '18:00' },
    ]),
  },
  {
    id: 6002,
    authorId: 102,
    title: '전통시장 먹거리 코스',
    travelDate: '2026-08-25',
    endDate: null,
    places: buildCoursePlaces([
      { placeId: 6, plannedTime: '11:30' },
      { placeId: 9, plannedTime: '13:00' },
      { placeId: 2, plannedTime: '15:30' },
    ]),
  },
  {
    id: 6003,
    authorId: 103,
    title: '안동 2박3일 나들이',
    travelDate: '2026-07-05',
    endDate: '2026-07-07',
    places: buildCoursePlaces([
      { placeId: 4, plannedTime: '10:00', visitDate: '2026-07-05' },
      { placeId: 11, plannedTime: '19:00', visitDate: '2026-07-06' },
      { placeId: 2, plannedTime: '10:30', visitDate: '2026-07-07' },
    ]),
  },
];

// courseApi.generate 결과 — 스와이프로 고른 걸 반영하는 대신 항상 같은 후보 하나 반환(실제
// course_optimizer 지금도 후보 1개만 옴, decision-log 2026-08-30 참고)
export function buildMockGeneratedCandidate(candidateId: string): {
  candidate_id: string;
  title: string;
  places: CoursePlaceItem[];
  total_distance_km: number | null;
  total_duration_min: number | null;
} {
  const places = buildCoursePlaces([
    { placeId: 1, plannedTime: '10:00' },
    { placeId: 8, plannedTime: '12:00' },
    { placeId: 6, plannedTime: '13:30' },
    { placeId: 5, plannedTime: '18:00' },
  ]);
  return {
    candidate_id: candidateId,
    title: '오늘의 추천 코스',
    places,
    total_distance_km: sumDistance(places),
    total_duration_min: sumDuration(places),
  };
}
