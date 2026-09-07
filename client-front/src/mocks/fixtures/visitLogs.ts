import { MOCK_PLACES } from './places';
import { MOCK_USERS } from './users';

// 방문기록(일지) 원본 목업 — "나의 일지"(mine: true, 로그인한 나)와 "유사 사용자 탐색"에 쓰이는
// 다른 유저 기록(mine: false, author 필드 있음)을 한 배열에 같이 두고 handlers.ts에서 각 API
// 응답 형태(VisitLogMapItem / SimilarLogItem / VisitLogSummary / VisitLogDetail)로 매핑해서 씀.
export interface MockVisitLog {
  id: number;
  placeId: number;
  mine: boolean;
  authorId: number | null; // mine이면 null(나니까 굳이 안 씀)
  // 여러 장 지원(2026-09-06 결정, decision-log 참고) — 이전엔 photoUrl(단일) 필드였음. 없으면
  // 빈 배열(백엔드 photo_urls와 동일 계약)
  photoUrls: string[];
  // title/weather는 2026-09-05 추가(메인 페이지-나의 일지-기록하기) — 기존 fixture 20여 개를 다
  // 안 고쳐도 되게 옵셔널로 둠(생략하면 null 취급, handlers.ts의 toMapItem 등 참고)
  title?: string | null;
  oneLine: string | null;
  weather?: string | null;
  rating: number | null; // 1~5, 선택 입력이라 null 있음(평균 계산에서 제외됨을 목업으로도 확인 가능)
  visitedAt: string; // ISO
  tags: string[];
}

function findPlace(placeId: number) {
  const place = MOCK_PLACES.find((p) => p.id === placeId);
  if (!place) throw new Error(`mock place not found: ${placeId}`);
  return place;
}

function findUser(userId: number) {
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error(`mock user not found: ${userId}`);
  return user;
}

export const MOCK_VISIT_LOGS: MockVisitLog[] = [
  // --- 내 기록 (나의 일지) ---
  {
    id: 1001,
    placeId: 1,
    mine: true,
    authorId: null,
    // 여러 장 캐러셀(JournalTab 카드 스와이프) 목업 확인용으로 이 기록만 3장 넣어둠(2026-09-06)
    photoUrls: [
      'https://picsum.photos/seed/log-1001/500/500',
      'https://picsum.photos/seed/log-1001b/500/500',
      'https://picsum.photos/seed/log-1001c/500/500',
    ],
    oneLine: '기와지붕 사이로 낙동강이 흐르는 게 진짜 예뻤어요',
    rating: 5,
    visitedAt: '2026-08-20T10:30:00',
    tags: ['traditional', 'photogenic'],
  },
  {
    id: 1002,
    placeId: 5,
    mine: true,
    authorId: null,
    photoUrls: ['https://picsum.photos/seed/log-1002/500/500'],
    oneLine: '야경 보러 다시 올 예정, 다리 조명이 은은해서 좋았음',
    rating: 4,
    visitedAt: '2026-08-20T19:10:00',
    tags: ['romantic', 'photogenic'],
  },
  {
    id: 1003,
    placeId: 6,
    mine: true,
    authorId: null,
    photoUrls: ['https://picsum.photos/seed/log-1003/500/500'],
    oneLine: '웨이팅 있었지만 그만한 가치 있었다',
    rating: null,
    visitedAt: '2026-08-21T18:40:00',
    tags: ['local', 'lively'],
  },
  {
    id: 1004,
    placeId: 4,
    mine: true,
    authorId: null,
    photoUrls: [],
    oneLine: '조용히 산책하기 좋은 곳',
    rating: 4,
    visitedAt: '2026-07-15T14:00:00',
    tags: ['traditional', 'relaxing'],
  },
  {
    id: 1005,
    placeId: 11,
    mine: true,
    authorId: null,
    photoUrls: ['https://picsum.photos/seed/log-1005/500/500'],
    oneLine: '강 보이는 창가 자리 추천',
    rating: 5,
    visitedAt: '2026-08-30T15:20:00',
    tags: ['modern', 'photogenic'],
  },
  {
    id: 1006,
    placeId: 2,
    mine: true,
    authorId: null,
    photoUrls: ['https://picsum.photos/seed/log-1006/500/500'],
    oneLine: '만대루에 앉아서 한참 있었어요',
    rating: 4,
    visitedAt: '2026-06-02T11:00:00',
    tags: ['traditional', 'relaxing', 'photogenic'],
  },

  // --- 다른 유저 기록 (유사 사용자 탐색 / explore.similarLogs) ---
  {
    id: 2001,
    placeId: 1,
    mine: false,
    authorId: 101,
    photoUrls: ['https://picsum.photos/seed/log-2001/500/500'],
    oneLine: '한복 입고 사진 찍기 최고인 곳',
    rating: 5,
    visitedAt: '2026-08-18T13:00:00',
    tags: ['traditional', 'photogenic'],
  },
  {
    id: 2002,
    placeId: 3,
    mine: false,
    authorId: 101,
    photoUrls: ['https://picsum.photos/seed/log-2002/500/500'],
    oneLine: '단풍철에 다시 가고 싶다',
    rating: 4,
    visitedAt: '2026-07-02T10:00:00',
    tags: ['traditional', 'relaxing'],
  },
  {
    id: 2003,
    placeId: 5,
    mine: false,
    authorId: 102,
    photoUrls: ['https://picsum.photos/seed/log-2003/500/500'],
    oneLine: '노을 질 때 가면 더 예뻐요',
    rating: 5,
    visitedAt: '2026-08-25T18:30:00',
    tags: ['romantic', 'photogenic'],
  },
  {
    id: 2004,
    placeId: 7,
    mine: false,
    authorId: 102,
    photoUrls: ['https://picsum.photos/seed/log-2004/500/500'],
    oneLine: '전망대에서 보는 뷰가 시원함',
    rating: null,
    visitedAt: '2026-06-14T09:40:00',
    tags: ['relaxing', 'photogenic'],
  },
  {
    id: 2005,
    placeId: 6,
    mine: false,
    authorId: 103,
    photoUrls: ['https://picsum.photos/seed/log-2005/500/500'],
    oneLine: '매운맛 2단계도 은근 매워요',
    rating: 3,
    visitedAt: '2026-08-22T19:00:00',
    tags: ['local', 'lively'],
  },
  {
    id: 2006,
    placeId: 9,
    mine: false,
    authorId: 103,
    photoUrls: [],
    oneLine: '역사 공부하고 가면 더 의미있음',
    rating: 4,
    visitedAt: '2026-05-30T11:20:00',
    tags: ['traditional', 'local'],
  },
  {
    id: 2007,
    placeId: 4,
    mine: false,
    authorId: 104,
    photoUrls: ['https://picsum.photos/seed/log-2007/500/500'],
    oneLine: '극락전 앞에서 한참 서있었어요',
    rating: 5,
    visitedAt: '2026-07-28T08:50:00',
    tags: ['traditional', 'relaxing'],
  },
  {
    id: 2008,
    placeId: 10,
    mine: false,
    authorId: 104,
    photoUrls: ['https://picsum.photos/seed/log-2008/500/500'],
    oneLine: '시음 코너에서 소주 종류별로 맛봄',
    rating: null,
    visitedAt: '2026-08-10T16:10:00',
    tags: ['traditional', 'local'],
  },
  {
    id: 2009,
    placeId: 11,
    mine: false,
    authorId: 105,
    photoUrls: ['https://picsum.photos/seed/log-2009/500/500'],
    oneLine: '디저트가 생각보다 맛있어서 놀람',
    rating: 4,
    visitedAt: '2026-08-27T14:50:00',
    tags: ['modern', 'photogenic'],
  },
  {
    id: 2010,
    placeId: 12,
    mine: false,
    authorId: 105,
    photoUrls: ['https://picsum.photos/seed/log-2010/500/500'],
    oneLine: '가성비 좋은 한우 코스',
    rating: 3,
    visitedAt: '2026-06-20T19:30:00',
    tags: ['local', 'lively'],
  },
  {
    id: 2011,
    placeId: 2,
    mine: false,
    authorId: 106,
    photoUrls: ['https://picsum.photos/seed/log-2011/500/500'],
    oneLine: '사람 적어서 여유롭게 둘러봄',
    rating: 5,
    visitedAt: '2026-07-05T10:15:00',
    tags: ['traditional', 'relaxing', 'photogenic'],
  },
  {
    id: 2012,
    placeId: 8,
    mine: false,
    authorId: 106,
    photoUrls: [],
    oneLine: '숨은 명소 느낌, 아는 사람만 아는 곳',
    rating: 4,
    visitedAt: '2026-05-18T13:40:00',
    tags: ['traditional', 'relaxing'],
  },
  {
    id: 2013,
    placeId: 1,
    mine: false,
    authorId: 103,
    photoUrls: ['https://picsum.photos/seed/log-2013/500/500'],
    oneLine: '외국인 친구 데려갔는데 반응 좋았음',
    rating: 5,
    visitedAt: '2026-08-05T12:00:00',
    tags: ['traditional', 'local', 'photogenic'],
  },
  {
    id: 2014,
    placeId: 7,
    mine: false,
    authorId: 105,
    photoUrls: ['https://picsum.photos/seed/log-2014/500/500'],
    oneLine: '자전거 타고 한바퀴 돌기 좋음',
    rating: null,
    visitedAt: '2026-07-19T09:00:00',
    tags: ['relaxing'],
  },
];

export function findMockPlaceForLog(log: MockVisitLog) {
  return findPlace(log.placeId);
}

export function findMockAuthorForLog(log: MockVisitLog) {
  if (log.authorId === null) return null;
  return findUser(log.authorId);
}
