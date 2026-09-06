// 목업 라우터 — api/client.ts의 request(method, path, body)를 그대로 받아서 REST 스타일 경로를
// 패턴 매칭하고, 맞으면 { matched: true, data }를, 우리가 아직 안 만든 엔드포인트면
// { matched: false }를 돌려줌(그러면 client.ts가 원래대로 실제 fetch로 흘려보냄).
//
// 지금 커버하는 범위: 장소(place), 방문기록(visitLog, 내 것 + 다른 유저 explore), 코스(course),
// 마이페이지 취향 그래프(users/me/preferences).
// 아직 목업 안 된 것: 인증(auth), 온보딩(onboarding), 스와이프(swipe), 이벤트(event), 태그(tag),
// 업로드(upload) — 필요해지면 이 파일에 핸들러만 추가하면 됨(패턴은 아래 것들과 동일).
import { PaginationMeta } from '../api/place';
import { CourseCandidate, CourseDetail, CourseListItem } from '../api/course';
import { VisitLogDetail, VisitLogMapItem, VisitLogPhoto, VisitLogSummary } from '../api/visitLog';
import { SimilarLogItem } from '../api/explore';
import { MOCK_PLACES, toPlaceDetail } from './fixtures/places';
import { MOCK_VISIT_LOGS, MockVisitLog, findMockAuthorForLog } from './fixtures/visitLogs';
import { MOCK_COURSE_LIST, MOCK_COURSE_DETAILS, buildMockGeneratedCandidate } from './fixtures/courses';

export type MockResult<T> = { matched: true; data: T } | { matched: false };

function ok<T>(data: T): MockResult<T> {
  return { matched: true, data };
}
const NOT_MATCHED: MockResult<never> = { matched: false };

// 세션(앱 재실행 전까지) 동안만 유지되는 변경 가능 상태 — 새로 만든 로그/코스, 좋아요 토글,
// 수정/삭제가 화면에 바로 반영되는지 볼 수 있게 원본 fixture를 복사해서 이 위에서만 조작함
let visitLogs: MockVisitLog[] = [...MOCK_VISIT_LOGS];
let courseList: CourseListItem[] = [...MOCK_COURSE_LIST];
const courseDetails: Record<number, CourseDetail> = { ...MOCK_COURSE_DETAILS };
// 스크랩북 "관광지" 탭이 바로 뭔가 보이도록 미리 몇 개 찜한 상태로 시작(하회마을/월영교/미소카페)
const likedPlaceIds = new Set<number>([1, 5, 11]);
let nextLogId = 9000;
let nextCourseId = 9000;

function paginate<T>(items: T[], page: number, size: number): { items: T[]; meta: PaginationMeta } {
  const start = (page - 1) * size;
  const pageItems = items.slice(start, start + size);
  return {
    items: pageItems,
    meta: { total: items.length, page, size, has_next: start + size < items.length },
  };
}

// MockVisitLogPhoto({url, caption?}) -> VisitLogPhoto({url, caption: string|null}) 계약 맞춤
// (2026-09-07 결정, decision-log 참고) — caption 없으면 undefined가 아니라 null로 정규화
function toPhotos(log: MockVisitLog): VisitLogPhoto[] {
  return log.photos.map((p) => ({ url: p.url, caption: p.caption ?? null }));
}

function toMapItem(log: MockVisitLog): VisitLogMapItem {
  const place = MOCK_PLACES.find((p) => p.id === log.placeId)!;
  return {
    id: log.id,
    place_id: place.id,
    place_name: place.name,
    lat: place.lat,
    lng: place.lng,
    photos: toPhotos(log),
    title: log.title ?? null,
    one_line: log.oneLine,
    weather: log.weather ?? null,
    rating: log.rating,
    visited_at: log.visitedAt,
    tags: log.tags,
  };
}

function toSummary(log: MockVisitLog): VisitLogSummary {
  return {
    id: log.id,
    photos: toPhotos(log),
    title: log.title ?? null,
    one_line: log.oneLine,
    weather: log.weather ?? null,
    rating: log.rating,
    visited_at: log.visitedAt,
    tags: log.tags,
  };
}

function toDetail(log: MockVisitLog): VisitLogDetail {
  const place = MOCK_PLACES.find((p) => p.id === log.placeId)!;
  return {
    id: log.id,
    place_id: place.id,
    place_name: place.name,
    photos: toPhotos(log),
    title: log.title ?? null,
    one_line: log.oneLine,
    weather: log.weather ?? null,
    rating: log.rating,
    visited_at: log.visitedAt,
    tags: log.tags,
  };
}

function toSimilarLogItem(log: MockVisitLog): SimilarLogItem {
  const place = MOCK_PLACES.find((p) => p.id === log.placeId)!;
  const author = findMockAuthorForLog(log)!; // mine:false 기록만 이 함수로 옴 — author 항상 있음
  return {
    log_id: log.id,
    place_id: place.id,
    place_name: place.name,
    lat: place.lat,
    lng: place.lng,
    // 여러 장 사진 확장은 처음엔 범위 밖이었는데(2026-09-06 결정), "취향 맞춤 코스" 카드에서
    // 사진을 넘기면 그 사진에 달린 글로 바뀌어야 해서(2026-09-07 결정, decision-log 참고)
    // 대표 사진 1장(mainPhotoUrl)에서 전체 목록+캡션(photos)으로 확장
    photos: toPhotos(log),
    one_line: log.oneLine,
    rating: log.rating,
    tags: log.tags,
    nickname: author.nickname,
    profile_image_url: author.profile_image_url,
  };
}

// 실제 백엔드(VisitLogRepository.findAverageRatingByPlaceId)와 동일하게 별점 없는(null) 기록은
// 평균 계산에서 제외 — 하나도 없으면 null
function averageRating(logsForPlace: MockVisitLog[]): number | null {
  const rated = logsForPlace.map((l) => l.rating).filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r, 0) / rated.length;
}

// path에서 쿼리스트링 뗀 것과 URLSearchParams를 같이 돌려줌
function splitPath(path: string): { pathname: string; query: URLSearchParams } {
  const [pathname, qs = ''] = path.split('?');
  return { pathname, query: new URLSearchParams(qs) };
}

export function resolveMock<T>(method: string, path: string, body: unknown): MockResult<T> {
  const { pathname, query } = splitPath(path);
  const segments = pathname.split('/').filter(Boolean); // 예: ['places', '3', 'logs']

  // GET /places
  if (method === 'GET' && pathname === '/places') {
    const category = query.get('category');
    const page = Number(query.get('page') ?? '1');
    const size = Number(query.get('size') ?? '20');
    const filtered = category ? MOCK_PLACES.filter((p) => p.category === category) : MOCK_PLACES;
    const { items, meta } = paginate(
      filtered.map((p) => ({ ...p, is_liked: likedPlaceIds.has(p.id) })),
      page,
      size,
    );
    return ok({ places: items, meta } as T);
  }

  // GET /places/map
  if (method === 'GET' && pathname === '/places/map') {
    const category = query.get('category');
    const filtered = category ? MOCK_PLACES.filter((p) => p.category === category) : MOCK_PLACES;
    const pins = filtered.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      main_image_url: p.main_image_url,
      tags: p.tags,
      is_liked: likedPlaceIds.has(p.id),
    }));
    return ok({ pins, total: pins.length } as T);
  }

  // GET /places/featured
  if (method === 'GET' && pathname === '/places/featured') {
    const limit = Number(query.get('limit') ?? '10');
    const places = MOCK_PLACES.slice(0, limit).map((p) => ({ ...p, is_liked: likedPlaceIds.has(p.id) }));
    return ok({ places, is_personalized: true } as T);
  }

  // GET /places/search
  if (method === 'GET' && pathname === '/places/search') {
    const q = (query.get('q') ?? '').trim();
    const page = Number(query.get('page') ?? '1');
    const size = Number(query.get('size') ?? '20');
    const filtered = q
      ? MOCK_PLACES.filter((p) => p.name.includes(q) || p.tags.some((t) => t.includes(q)))
      : MOCK_PLACES;
    const { items, meta } = paginate(
      filtered.map((p) => ({ ...p, is_liked: likedPlaceIds.has(p.id) })),
      page,
      size,
    );
    return ok({ places: items, meta } as T);
  }

  // GET /places/:id
  if (method === 'GET' && segments.length === 2 && segments[0] === 'places') {
    const id = Number(segments[1]);
    const place = MOCK_PLACES.find((p) => p.id === id);
    if (!place) return NOT_MATCHED;
    const logsForThisPlace = visitLogs.filter((l) => l.placeId === id);
    const detail = toPlaceDetail(
      { ...place, is_liked: likedPlaceIds.has(id) },
      logsForThisPlace.length,
      averageRating(logsForThisPlace),
    );
    return ok(detail as T);
  }

  // POST/DELETE /places/:id/like
  if (segments.length === 3 && segments[0] === 'places' && segments[2] === 'like') {
    const id = Number(segments[1]);
    if (method === 'POST') likedPlaceIds.add(id);
    if (method === 'DELETE') likedPlaceIds.delete(id);
    return ok({ is_liked: likedPlaceIds.has(id) } as T);
  }

  // GET /users/me/likes (스크랩북 "관광지" 탭 — 내가 찜한 장소 목록)
  if (method === 'GET' && pathname === '/users/me/likes') {
    const page = Number(query.get('page') ?? '1');
    const size = Number(query.get('size') ?? '20');
    const liked = MOCK_PLACES.filter((p) => likedPlaceIds.has(p.id)).map((p) => ({ ...p, is_liked: true }));
    const { items, meta } = paginate(liked, page, size);
    return ok({ places: items, meta } as T);
  }

  // GET /places/:id/logs (장소 상세의 방문기록 목록 — 내 것/다른 유저 것 다 포함)
  if (method === 'GET' && segments.length === 3 && segments[0] === 'places' && segments[2] === 'logs') {
    const placeId = Number(segments[1]);
    const page = Number(query.get('page') ?? '1');
    const size = Number(query.get('size') ?? '20');
    const logsForPlace = visitLogs.filter((l) => l.placeId === placeId);
    const { items, meta } = paginate(logsForPlace.map(toSummary), page, size);
    return ok({ logs: items, meta } as T);
  }

  // POST /places/:id/logs (방문기록 작성)
  if (method === 'POST' && segments.length === 3 && segments[0] === 'places' && segments[2] === 'logs') {
    const placeId = Number(segments[1]);
    const place = MOCK_PLACES.find((p) => p.id === placeId);
    if (!place) return NOT_MATCHED;
    const req = (body ?? {}) as {
      photos?: { url: string; caption?: string }[];
      title?: string;
      one_line?: string;
      weather?: string;
      rating?: number;
      visited_at?: string;
    };
    const newLog: MockVisitLog = {
      id: nextLogId++,
      placeId,
      mine: true,
      authorId: null,
      photos: req.photos ?? [],
      title: req.title ?? null,
      oneLine: req.one_line ?? null,
      weather: req.weather ?? null,
      rating: req.rating ?? null,
      visitedAt: req.visited_at ?? new Date().toISOString(),
      tags: [],
    };
    visitLogs = [newLog, ...visitLogs];
    return ok(toDetail(newLog) as T);
  }

  // GET /users/me/preferences (마이페이지 취향 레이더 차트) — ssot.md 7개 태그, 0.5가 중립 기준선
  if (method === 'GET' && pathname === '/users/me/preferences') {
    return ok({
      preferences: [
        { tag: 'relaxing', score: 0.72 },
        { tag: 'lively', score: 0.35 },
        { tag: 'romantic', score: 0.58 },
        { tag: 'local', score: 0.81 },
        { tag: 'photogenic', score: 0.9 },
        { tag: 'traditional', score: 0.77 },
        { tag: 'modern', score: 0.42 },
      ],
    } as T);
  }

  // GET /users/me/logs (나의 일지)
  if (method === 'GET' && pathname === '/users/me/logs') {
    const page = Number(query.get('page') ?? '1');
    const size = Number(query.get('size') ?? '50');
    const mine = visitLogs.filter((l) => l.mine);
    const { items, meta } = paginate(mine.map(toMapItem), page, size);
    return ok({ logs: items, meta } as T);
  }

  // GET/PATCH/DELETE /logs/:id
  if (segments.length === 2 && segments[0] === 'logs') {
    const logId = Number(segments[1]);
    const idx = visitLogs.findIndex((l) => l.id === logId);
    if (idx === -1) return NOT_MATCHED;

    if (method === 'GET') return ok(toDetail(visitLogs[idx]) as T);

    if (method === 'PATCH') {
      // 실제 백엔드와 동일하게: rating은 값이 오면 갱신, 생략하면 유지(one_line처럼 빈 값으로
      // 지우는 개념이 없음 — server VisitLogUpdateRequest.kt 참고)
      const req = (body ?? {}) as { one_line?: string; rating?: number; visited_at?: string };
      visitLogs[idx] = {
        ...visitLogs[idx],
        oneLine: req.one_line ?? visitLogs[idx].oneLine,
        rating: req.rating ?? visitLogs[idx].rating,
        visitedAt: req.visited_at ?? visitLogs[idx].visitedAt,
      };
      return ok(toDetail(visitLogs[idx]) as T);
    }

    if (method === 'DELETE') {
      visitLogs = visitLogs.filter((l) => l.id !== logId);
      return ok(undefined as T);
    }
  }

  // GET /explore/similar-logs (유사 사용자 탐색 — 다른 유저들이 올린 일지)
  if (method === 'GET' && pathname === '/explore/similar-logs') {
    const limit = Number(query.get('limit') ?? '50');
    const others = visitLogs.filter((l) => !l.mine).slice(0, limit);
    return ok({ logs: others.map(toSimilarLogItem) } as T);
  }

  // GET /users/me/courses
  if (method === 'GET' && pathname === '/users/me/courses') {
    const page = Number(query.get('page') ?? '1');
    const size = Number(query.get('size') ?? '20');
    const { items, meta } = paginate(courseList, page, size);
    return ok({ courses: items, meta } as T);
  }

  // POST /courses/generate
  if (method === 'POST' && pathname === '/courses/generate') {
    const candidate = buildMockGeneratedCandidate(`mock-candidate-${Date.now()}`);
    return ok({ candidates: [candidate] as CourseCandidate[] } as T);
  }

  // POST /courses, POST /courses/manual (저장)
  if (method === 'POST' && (pathname === '/courses' || pathname === '/courses/manual')) {
    const req = (body ?? {}) as {
      title?: string;
      travel_date?: string | null;
      end_date?: string | null;
      places?: unknown[];
    };
    const id = nextCourseId++;
    const title = req.title ?? '새 코스';
    courseList = [
      {
        id,
        title,
        travel_date: req.travel_date ?? null,
        // 여러 날 범위 지원(2026-09-06 추가) — /courses(AI 저장)는 이 필드를 안 보내니 자연히 null
        end_date: req.end_date ?? null,
        source: pathname === '/courses/manual' ? 'user' : 'ai',
        place_count: req.places?.length ?? 0,
        thumbnail_url: MOCK_PLACES[0]?.main_image_url ?? null,
        place_thumbnails: MOCK_PLACES.slice(0, 3)
          .map((p) => p.main_image_url)
          .filter((url): url is string => url != null),
        created_at: new Date().toISOString(),
      },
      ...courseList,
    ];
    return ok({ course_id: id } as T);
  }

  // GET/PATCH/DELETE /courses/:id
  if (segments.length === 2 && segments[0] === 'courses') {
    const courseId = Number(segments[1]);

    if (method === 'GET') {
      const detail = courseDetails[courseId];
      if (!detail) return NOT_MATCHED;
      return ok(detail as T);
    }

    if (method === 'PATCH') {
      const existing = courseDetails[courseId];
      if (!existing) return NOT_MATCHED;
      const req = (body ?? {}) as { title?: string };
      const updated = { ...existing, title: req.title ?? existing.title, updated_at: new Date().toISOString() };
      courseDetails[courseId] = updated;
      courseList = courseList.map((c) => (c.id === courseId ? { ...c, title: updated.title } : c));
      return ok(updated as T);
    }

    if (method === 'DELETE') {
      courseList = courseList.filter((c) => c.id !== courseId);
      delete courseDetails[courseId];
      return ok(undefined as T);
    }
  }

  return NOT_MATCHED;
}
