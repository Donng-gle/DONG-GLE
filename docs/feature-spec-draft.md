# 기능설명서 (초안 · 검토 전)

> 이 문서는 동글 서비스의 기능을 하나하나 정의하는 기능설명서입니다. 작성 과정에서 코드를 참고하긴 했지만,
> **이 문서에 적힌 내용이 곧 기획(정답)** 이며 코드는 나중에 이 문서에 맞춰 수정합니다. 코드와 다른 부분을
> 발견하면 "코드가 이렇게 돼 있다"가 아니라 "기능은 이렇게 동작해야 한다"로 서술합니다.
> 아직 팀 검토를 거치지 않은 섹션에는 참고용으로 ⚠️(코드와 다른 점) / 🆕(계획에 없던 것) 표시가 남아있을
> 수 있음 — 검토가 끝나면 표시를 지우고 확정된 기능 설명으로 정리합니다.

---

## 검토 확정 로그

- **2026-09-07 | 인증**: 카카오 로그인, 구글 로그인 두 가지만 지원
- **2026-09-07 | 게스트(비로그인) 이용 범위**: 로그인하지 않아도 장소 목록/검색/상세(전 카테고리), 행사·축제 목록, 감성 태그 안내, 안동 거리 탭(카테고리 지도 탐색)은 볼 수 있음. 그 외(나의 일지, 취향 맞춤 코스, 코스 만들기·스크랩북, 방문 기록 작성, 알림 설정, 프로필)는 로그인해야 이용 가능
- **2026-09-07 | 온보딩 카드 풀 규모**: 지금 규모(카드 78장, 서로 다른 장소 58곳) 그대로 유지
- **2026-09-07 | 온보딩 종료 조건**: 최소 15장 진행 후 최근 3장의 취향 벡터 변화량 평균이 0.03 미만이면 그 시점에 종료, 그렇지 않으면 25장에서 강제 종료 — 그대로 유효
- **2026-09-08 | 개인화 장소 추천(`GET /places/featured`)**: 당장은 어느 화면에도 노출하지 않음(보류)
- **2026-09-08 | "비슷한 취향 탐색" 정리**: 드로어의 "비슷한 취향 탐색" 항목은 없앰. 다른 사용자의 코스/기록을 보는 진입점은 홈 탭 "취향 맞춤 코스" 하나로 통합
- **2026-09-08 | AI 코스 후보 개수**: 1개로 확정(3개 아님)
- **2026-09-08 | 필수 방문 장소 지정**: 정식 기능으로 포함(구현 필요, §10)
- **2026-09-08 | AI 코스 출발 위치·시간대**: 고정값 아님, 사용자가 조정 가능해야 함(시간대는 2026-09-09 구현 완료, 위치는 구현 필요, §10)
- **2026-09-08 | 직접 코스 만들기**: 정식 기능으로 확정
- **2026-09-08 | 코스 공개(`is_public`) 토글**: 이번 범위에선 만들지 않음(항상 공개), 발전계획으로만 남김
- **2026-09-08 | 방문기록 사진 캡션**: 정식 기능으로 확정, 작성 화면에 입력 UI 추가 필요(구현 필요, §10)
- **2026-09-08 | 방문기록 AI 자동 태깅 배치**: 데이터 파트가 직접 구현 완료, 실제 DB 적재 확인됨
- **2026-09-08 | 푸시 알림 실제 발송**: 이번 범위에선 구현 안 함(설정 UI만 유지), 발전계획으로 남김
- **2026-09-10 | AI 코스 N박N일 지원**: 기존 "AI 코스는 하루짜리" 방침을 뒤집고 확정 — AI 코스도 여러 날 지원. decision-log.md에 이 결정 기록이 없어서 팀에 기록 요청 필요(§10)
- **2026-09-10 | 코스 단위 방문 기록**: `POST /logs/course` 신규 기능 정식 확정(§7-1B)

---

## 0. 브랜치/통합 상태 (문서 내용과 별개, 진행 상황 메모)

**2026-09-08 재확인 — 지난번 지적했던 "dev가 뒤처짐" 문제는 대부분 해소됨:**
- `dev`가 `server`/`client`/`ai`를 다시 받아서(`d4813e2 Merge branch 'server' into dev` 등) 캡처 시점 기준 홈 화면 재설계, 취향 맞춤 코스 실제 코스화 등 최근 기능들이 이제 `dev`에도 들어와 있음(`dev`의 `HomeScreen.tsx`로 직접 확인)
- 남은 차이는 작음: `client`에 미병합 3커밋(장소 추가 팝업 완료 버튼, 취향 맞춤 코스 카드 선택 시 맨 위로 이동), `server`에 미병합 1커밋(방문기록 사진 업로드 403 버그 수정 — presigned URL 서명에서 Content-Type 제외), `ai`에 미병합 1커밋(장소 추천 로직 수정 — 아래 §6-4 참고)
- 내 PR #29는 `data`를 건너뛰고 `dev`로 머지 완료됨(2026-09-07). `data` 브랜치 자체엔 이 작업이 없는 상태로 남음 — 과거 PR #12/#25와 같은 패턴이 그대로 반복된 것, 팀에 인지 필요
- 열려있는 PR 없음(전부 머지됨)

**2026-09-10 재확인 — 같은 패턴 반복**: `ai`는 `dev`에 합류 완료. `server`(6커밋)·`client`(20여 커밋) 다시 미병합 상태로 쌓임 — AI 코스 시간대 조정/N박N일 지원(§6-1), "코스 단위 방문 기록"(§7) 등 포함. `dev`를 기준으로 보면 최신 기능이 계속 안 보이는 상황이 반복되고 있음 — 팀이 `server`/`client`→`dev` 병합을 좀 더 자주 하는 게 좋아 보임. 이번에도 열려있는 PR 없음

---

## 1. 서비스 개요

- 서비스명: 동글. 경상북도 안동시 대상 감성태그 기반 개인화 여행 코스 추천 서비스.
- 클라이언트: React Native + Expo(`client-front`), dev-client 빌드로만 테스트 가능(네이티브 모듈 사용 — 카카오/구글 로그인, 이미지 피커, `react-native-maps` 때문에 Expo Go 불가)
- 백엔드: Kotlin + Spring Boot(`server-back`), 배포는 Render 무료 플랜(`https://dong-gle.onrender.com`, 슬립 이슈·512MB 메모리 제한 있음)
- AI 서비스: Python FastAPI(`ai/api`), 백엔드가 HTTP로 호출하는 별도 서비스. `place_recommender`, `course_optimizer` 두 기능만 노출됨(§6 참고)
- DB: PostgreSQL, Supabase 공용 프로젝트(ap-southeast-2, pooler 연결)
- `schema.sql` / `schema.dbml`이 스키마 SSOT. `ssot.md`도 이 문서의 검토 결과를 반영해 2026-09-08 갱신 완료(테이블 목록 20개 전체 반영, 기능 스펙 전반 최신화)
- 로그인: 카카오 또는 구글 소셜 로그인만 지원
- 비로그인(게스트) 이용: 장소 둘러보기(목록/검색/상세, 안동 거리 탭 포함)와 행사·축제, 감성 태그 안내는 로그인 없이 가능. 그 외 개인화 기능은 로그인 필요(§2)

---

## 2. 인증 (`LoginScreen.tsx`, `AuthController.kt`)

| 항목 | 내용 |
|---|---|
| 카카오 로그인 | `WebBrowser.openAuthSessionAsync` 직접 호출(useAuthRequest 미사용, redirect_uri와 앱 복귀용 returnUrl을 분리하기 위함) → 인가 코드 획득 → `POST /auth/oauth/kakao` |
| 구글 로그인 | `@react-native-google-signin/google-signin`으로 네이티브 로그인 → ID 토큰 획득 → `POST /auth/oauth/google` |
| 콜백 | `GET /auth/kakao/callback` — 카카오 인가서버가 앱이 아닌 백엔드로 리다이렉트되는 걸 앱으로 중계 |
| 토큰 갱신 | `POST /auth/refresh`. client-front에 액세스 토큰 자동 갱신 로직 연결됨(2026-08-30) |
| 로그아웃 | `DELETE /auth/logout` |
| 세션 저장 | refresh_token 테이블 |
| 비로그인 이용 | 로그인하지 않고도 장소 둘러보기(목록/검색/상세), 안동 거리 탭, 행사·축제, 감성 태그 안내는 이용 가능. 그 외 기능을 누르면 로그인 화면으로 이동 |

**⚠️ 실기기 검증 중 발견/수정된 이슈(2026-08-31 완료, decision-log 참고)**
1. `API_BASE_URL`이 실기기(에뮬레이터 아님)에서 동작 안 함 → `EXPO_PUBLIC_API_BASE_URL` env로 해결
2. 카카오 OAuth 쪽 `RestClient.create()` 기본 컨버터가 SNAKE_CASE 미지원 → `KakaoOAuthHttpConfig` 신설로 수정
3. 디버그 키스토어는 프로젝트 로컬(`client-front/android/app/debug.keystore`) 걸 써야 카카오 앱 등록한 키 해시와 일치
4. 구글 로그인은 OAuth 동의화면이 테스트 모드라 "테스트 사용자"로 등록된 계정만 로그인 가능(배포 전 검토 필요 항목)

---

## 3. 온보딩 (`OnboardingScreen.tsx`, `OnboardingController.kt`)

| 엔드포인트 | 역할 |
|---|---|
| `GET /onboarding/status` | 온보딩 완료 여부 |
| `GET /onboarding/next` | 다음 카드 1장 |
| `POST /onboarding/swipe` | 좋아요/싫어요 기록 + 벡터 갱신 |
| `POST /onboarding/complete` | 온보딩 종료 |
| `POST /onboarding/reset` | "내 취향 다시 분석하기"(`ProfileScreen`의 `onRetakeOnboarding` → `App.tsx`가 `has_onboarded:false`로 다시 태움) |

- 카드 선택 전략: 시드 7장(태그별 대표 1장) → 균형 60% + 탐색 30% + 랜덤 10%
- 벡터 업데이트: 좋아요 학습률 0.40 / 싫어요 0.25 (상대적 업데이트 방식)
- **종료 조건**: 최소 15장까지는 무조건 진행. 15장째부터는 매 스와이프마다 "최근 3장의 취향 벡터 변화량 평균"을 계산해서 0.03 미만이면(=더 이상 취향이 안 바뀜, 수렴) 그 시점에 종료. 수렴이 안 되더라도 25장이 되면 무조건 종료(안전장치 상한선). 즉 대부분은 15~25장 사이에서 수렴해 끝나고, 못 해도 25장에서 끝남. 예외: 좋아요 3개 미만이면 최소 15장까지 강제 진행
- 카드 풀 규모: 78장(서로 다른 장소 58곳 커버) — 현재 규모 유지로 확정
- `/onboarding/cards`, `/onboarding/preferences`는 스펙에서 제거됨(다른 엔드포인트로 대체됨)

---

## 4. 메인 페이지 (`HomeScreen.tsx`) — 🆕 전면 재설계됨 (2026-08-31~09-07)

과거 "디자인 시안 없어서 버튼 목록"이던 상태는 **해소됨**. Figma 79개 프레임을 전수 확인해 실제 UI로 교체됨.

### 4-1. 상단 구조
- `AppHeader`: 좌측 메뉴(드로어 열기), 우측 검색(→ `SearchScreen` 오버레이, §5-2)/프로필
- 3개 탭(밑줄 스타일): **나의 일지** / **취향 맞춤 코스** / **안동 거리** — 각각 `./home/JournalTab.tsx`, `RecommendedTab.tsx`, `StreetTab.tsx`
- 하단 `FloatingNav`: 홈(나의 일지로 이동)/일정 생성(AI/직접 선택 바텀시트)/프로필 알약 네비게이션
- 비로그인 사용자는 나의 일지/취향 맞춤 코스 탭 대신 로그인 유도 화면을 보고, 첫 진입 탭은 **안동 거리**(로그인 없이 바로 쓸 수 있는 탭)

### 4-2. 좌측 드로어
- 프로필 요약(아바타/닉네임/온보딩 상태, 비로그인이면 게스트 상태 표시)
- 3개 섹션: **코스**(AI로 코스 만들기/직접 코스 만들기/스크랩북) / **탐색**(방문 기록/행사·축제) / **설정**(감성 태그 안내/알림 설정)
- 비로그인 사용자가 로그인이 필요한 항목(코스/스크랩북/방문 기록/알림 설정)을 누르면 로그인 화면으로 이동. 행사·축제/감성 태그 안내는 비로그인도 바로 이용 가능
- 다른 사용자의 코스·기록을 둘러보는 기능은 드로어가 아니라 홈 탭 "취향 맞춤 코스"(§4-4) 하나로 통합 — 예전에 있던 드로어 "비슷한 취향 탐색" 항목은 없앰(§5-4)
- ⚠️ 드로어 자체는 Figma 전용 시안이 없어서(2026-09-03 확인) 항목 구성은 여전히 임시 — 애니메이션/프로필/섹션 구분 같은 UX 기본기만 시안과 무관하게 다듬어 놓음

### 4-3. 나의 일지 탭 (`JournalTab.tsx`)
- 배경에 `AndongGlobe`(드래그로 회전 가능한 장식용 3D 안동 지구본, 실제 지도 데이터 아님) — 그 위에 방문기록 카드 목록이 **바텀시트(팝업)** 로 얹힘
- 평소엔 핸들+"안동에서의 추억" 타이틀만 하단에 살짝 보이다가, 위로 끌어올리면 지구본을 덮으며 화면 최상단까지 확장(PanResponder+Animated 직접 구현, gesture-handler 등 신규 네이티브 의존성 없이)
- 카드: 사진 여러 장(스와이프+점 인디케이터)+제목(`title`, 없으면 `place_name`)+한줄리뷰+날짜/장소/날씨 뱃지
- "+" 버튼 → `JournalLogCreateModal`(§7 참고)로 새 기록 작성

### 4-4. 취향 맞춤 코스 탭 (`RecommendedTab.tsx`) — ssot.md 계획과 크게 달라진 부분
- ssot 계획은 "유사 사용자 탐색 지도"였는데, 실제로는 **다른 사용자가 저장한 공개 코스 + 개별 방문기록을 섞어서 카드 목록**으로 보여줌 (2026-09-07 최종 형태, 그 전에 2번 뒤집힘 — decision-log 참고)
- `GET /explore/similar-courses` + `GET /explore/similar-logs`를 합쳐 하나의 리스트로: 코스는 "N곳 코스"+장소 썸네일 캐러셀, 개별 기록은 장소명+별점+태그
- 카드 "선택" → 배경이 `AndongGlobe`에서 실제 `MapView`+`Polyline`(코스는 경로, 개별 장소는 마커 1개)로 전환, 버튼이 "자세히 보기"로 바뀜
- "자세히 보기" → 코스면 `PublicCourseDetailScreen`(읽기 전용, 여러 날 코스면 날짜별 헤더), 개별 장소면 `PlaceDetailScreen`
- 카드 목록 API(`SimilarCourseItemResponse`)는 좌표 없이 가볍게 유지하고, 실제 좌표/경로는 "선택" 시점에만 `GET /explore/courses/{courseId}`로 따로 조회(코스 목록 조회마다 Google Directions를 호출하지 않기 위함)
- 카드를 "선택"하면 그 카드가 리스트 맨 위로 이동함(스크롤 없이 바로 "자세히 보기"로 이어지도록)

### 4-5. 안동 거리 탭 (`StreetTab.tsx`) — ssot.md의 "카테고리 탐색 지도"에 해당, 구현 방식이 완전히 다름
- ssot 계획/이전 구현은 구글맵+칩+리스트였는데, 2026-09-07에 **인터랙티브 지도가 아닌 정적 일러스트**(`AndongGlobe`, 회전 비활성화) 위에 6개 카테고리 3D 아이콘을 정해진 좌표에 오버레이하는 방식으로 전면 교체됨
- 아이콘을 누르면 해당 카테고리만 커지고 나머지는 작아지며, 나의 일지와 동일한 바텀시트 메커니즘으로 `GET /places?category=` 목록이 뜸(페이지네이션 지원)
- **실제 지리적 위치 기반이 아님** — 아이콘 좌표는 Figma 실측값을 화면 비율로 환산한 고정 배치일 뿐, 장소의 실제 위/경도와는 무관

---

## 5. 장소 탐색 / 검색

### 5-1. 목록/검색 (`PlaceListScreen.tsx`)
- `GET /places` — 카테고리 필터(6종: 관광지/식당/카페/액티비티/문화공간/축제행사), 페이지네이션
- `GET /places/search` — 이름 검색
- `GET /places/featured` — 내 취향 상위 태그와 겹치는 장소를 우선 추천(없으면 인기순 폴백)하는 개인화 장소 추천 API. 백엔드는 완성돼 있으나 당장은 어느 화면에도 노출하지 않음(보류, §10)
- `CourseManualBuilderScreen`/`CourseEditScreen`에서 `onSelectPlace` 콜백으로 장소 선택 UI로 재사용

### 5-2. 🆕 검색 (`SearchScreen.tsx`, 2026-09-07 신설)
- `AppHeader` 돋보기 → `HomeScreen`이 투명 `Modal`로 이 화면을 오버레이로 띄움(뒷화면이 그대로 비침, 드로어와 동일 패턴)
- 검색어 없음: 하드코딩된 "인기 검색어" 칩(실제 인기도 데이터/API 없음)
- 검색어 있음: `/places/search` 재사용한 자동완성(접두어 매칭 강조)
- 칩/자동완성 선택 또는 키보드 검색 실행 → 목록이 아니라 **그 장소의 `PlaceDetailScreen`으로 바로 이동**(첫 번째 일치 장소 기준, 처음엔 `PlaceListScreen` 결과 목록으로 설계했다가 정정됨)

### 5-3. 상세 (`PlaceDetailScreen.tsx`)
- `GET /places/{placeId}`
- 대표 이미지 + 추가 이미지 + `place_hours`(영업시간) + 방문기록(한줄리뷰/사진/평점) 표시
- 찜: `POST/DELETE /places/{placeId}/like`

### 5-4. ~~비슷한 취향 탐색~~ — 폐지, 홈 탭 "취향 맞춤 코스"로 통합
- 다른 사용자의 코스·기록을 둘러보는 기능은 진입점을 하나로 통일한다 — 홈 탭 "취향 맞춤 코스"(§4-4)만 유지
- (참고) `ExploreScreen.tsx`가 기존에 이 화면으로 쓰이고 있었음 — `RecommendedTab`이 같은 데이터(`similar-logs`)를 코스와 함께 더 완성도 높게 보여주므로, `ExploreScreen`과 드로어 진입점은 제거 대상(§10)

### 5-5. 이미지 프록시 (`GET /images/proxy?ref=`)
- Google Photo API 키를 클라이언트에 노출하지 않기 위한 중계

### 5-6. 행사/축제 (`EventsScreen.tsx`, `GET /events`)
- D-day 라벨링(종료/진행중/D-N), 기간 겹치는 것만 노출

---

## 6. 코스 추천/생성

클라이언트에는 코스를 만드는 진입점이 **두 가지**입니다(드로어 "코스" 섹션, FloatingNav 중앙 버튼도 동일한 두 옵션의 바텀시트). 스와이프 기반 AI 추천과 직접 만들기 둘 다 정식 기능입니다.

### 6-1. AI 추천 코스 — 스와이프 흐름 (`CourseFlowScreen.tsx` → `CourseSwipeScreen.tsx` → `CourseResultScreen.tsx`)
1. `POST /swipe/candidates` — 세션 생성, 후보 카드 20장 고정 발급. `mood_tags` 미입력시 0.5 중립 폴백, 직접입력시 0.9점 가중
2. `GET /swipe/sessions/{sessionId}` — 세션 복구(재진입 시 이어서 스와이프 가능, resumable)
3. 스와이프 결과는 온보딩 v2.0.0의 `EmotionVector.applySwipe` 로직 재사용(좋아요 0.40 / 싫어요 0.25)
4. `POST /swipe/sessions/{sessionId}/results` — 스와이프 종료, 결과 반영
5. `POST /courses/generate` → AI 서비스 `POST /v1/places/recommend`(취향벡터 → Qdrant 유사도 검색 → hidden_score 결합 랭킹) → `POST /v1/courses/optimize`(`course_optimizer`의 `search_optimal_route()`, backtracking 방식)
6. `POST /courses` — 완성된 코스 저장(`source='ai'`)

**확정 사항**
- 코스 후보는 **1개**만 생성한다(3개 아님, 확정)
- 스와이프에서 좋아요한 장소 중 **꼭 방문하고 싶은 장소를 필수로 지정**할 수 있어야 한다 — 필수 지정한 장소는 코스에 반드시 포함
- 여행 시간대는 **사용자가 조정 가능**해야 한다 (2026-09-09 구현 완료) — `CourseGenerateRequest.startTime`/`endTime`(선택), 안 주면 기존 09:00~21:00 기본값
- 여행 출발 위치는 사용자가 조정 가능해야 한다 — 아직 미구현(`DEFAULT_ORIGIN`, 안동 시내 좌표 36.5684, 128.7294 하드코딩 그대로)
- **AI 코스도 여러 날(N박N일) 지원**(2026-09-09/10 구현 완료, 기존 "AI 코스는 하루짜리" 방침에서 변경 확정) — `CourseGenerateRequest.endDate`(선택), 날짜마다 `course_optimizer`를 따로 호출해 하루치씩 이어붙이는 방식. 그날 뽑힌 장소는 다음 날 후보에서 제외(중복 방지), 좋아요한 장소가 부족해지면 그 시점까지만 생성(에러 아님). `POST /courses`(AI 후보 저장)도 `end_date` 저장 지원

**⚠️ 구현 상태(§10 참고)**: "필수 방문 장소 지정"과 "출발 위치 조정"은 아직 구현 안 됨(`backtracking.py`가 후보 1개만 유지하는 건 확정 스펙과 일치, `CandidatePlace`에 필수 플래그 없음, 출발 좌표 하드코딩 그대로) — 실제 구현 필요

### 6-2. 직접 코스 만들기 (`CourseManualBuilderScreen.tsx`, `POST /courses/manual`) — N박N일 지원
- course_optimizer를 거치지 않고 사용자가 장소를 검색해서 직접 추가(장소 추가 팝업에 "완료" 버튼으로 선택 종료)
- **N박N일 지원**: 시작일~종료일을 `CalendarPicker`로 범위 선택하면 날짜별 탭이 생기고, 탭마다 장소를 따로 추가/순서 변경/삭제 — 저장 시 `course_place.visit_date`에 날짜별로, `visit_order`는 코스 전체 통틀은 전역 순서로 저장. 특정 날짜가 통째로 비면 저장 전 확인
- 이동수단(도보/자동차/대중교통) 입력
- AI 추천 코스와 함께 정식 기능으로 확정

### 6-3. 코스 조회/수정/삭제/공개여부
- `GET /users/me/courses` — 내 코스 목록. `ScrapbookScreen`(§8)의 "여행코스" 탭에서 씀
- `GET /courses/{courseId}` — 상세(`CourseDetailScreen.tsx`, 본인 코스, 수정/삭제 가능): 제목, 날짜, 총거리/총시간(있으면), 장소별 방문순서
- `PATCH /courses/{courseId}` — 수정(`CourseEditScreen.tsx`, 제목·장소 구성만 가능, 날짜/이동수단은 수정 불가 — `CourseUpdateRequest`에 그 필드가 없음)
- `DELETE /courses/{courseId}` — 삭제
- `course.is_public`(기본 true) — 다른 사용자의 "취향 맞춤 코스" 탭(§4-4)에 내 코스가 공개로 노출되는 기준. **사용자가 켜고 끄는 UI는 만들지 않음(확정)** — 항상 공개, 우선순위 낮은 기능이라 발전계획으로만 남김(§10)
- `GET /explore/courses/{courseId}` — 소유자가 아닌 사용자가 공개 코스 상세(좌표 포함)를 읽기 전용으로 조회할 때 씀(`PublicCourseDetailScreen.tsx`가 사용). 비공개 코스면 `CourseNotPublicException`

### 6-4. AI 서비스 내부 구성
- `ai/place_recommender`: 취향벡터 + Qdrant 유사도 + `hidden_score`(방문로그 적고 대표관광지 아닌 "숨은 장소" 점수, `ai/hidden_score` 모듈) 결합해 랭킹
- 🆕 **Qdrant 색인 단위가 장소→이미지로 변경**(2026-09-07): 예전엔 장소 하나당 대표 벡터 1개(`place_semantic_vector` 집계)를 Qdrant에 올렸는데, 이제 사진 한 장 한 장(`place_image_semantic_vector`)을 각각 색인함. 재색인은 `scripts/reindex_qdrant_from_image_scores.py`로 수행
- 🆕 **추천 결과가 "장소 목록용"과 "코스용" 두 갈래로 분리**: `POST /v1/places/recommend`가 이제 `recommendations`(장소별 대표 사진 1장, 일반 장소 추천용)와 `course_recommendations`(코스 후보 개수만큼, 장소 중복 없이 베스트 이미지 1장씩, `course_optimizer`에 넘길 전용 목록)를 같이 반환. 요청에 `course_top_n`(코스용 개수, 기본 0)이 추가됨
- `ai/course_optimizer`: 추천된 장소들의 방문 순서 최적화(backtracking), `place_hours_client`로 영업시간 필터링, `GoogleRoutesClient`로 실제 이동거리/시간 계산
- 두 모듈 모두 `ai/api/app.py`(FastAPI)로 감싸져 `/v1/places/recommend`, `/v1/courses/optimize`만 백엔드에 노출됨
- ⚠️ 위 두 변경은 아직 `ai` 브랜치에만 있고 `dev`/`server`에 안 들어감(§0). 백엔드 `CourseController`/`PlaceService`가 새 `course_recommendations`/`course_top_n`을 실제로 쓰도록 연결됐는지 확인 필요(§10)

---

## 7. 방문 기록 — 🆕 대폭 확장 (title/weather/rating/여러 사진+캡션, 2026-09-05~07)

과거엔 `VisitLogCreateScreen`(사진 1장+한줄리뷰만) 하나였는데, 지금은 작성 경로가 나의 일지 탭 전용 모달로 바뀌고 스키마도 크게 늘어남.

| 엔드포인트 | 역할 |
|---|---|
| `POST /places/{placeId}/logs` | 기록 생성 |
| `GET /users/me/logs` | 내 기록 목록(`MyLogsScreen`, `JournalTab` 둘 다 사용) |
| `GET /places/{placeId}/logs` | 장소별 기록 목록 |
| `GET /logs/{logId}` | 기록 상세 |
| `PATCH /logs/{logId}` | 수정(`LogEditScreen`) |
| `DELETE /logs/{logId}` | 삭제 |

### 7-1. 작성 — `JournalLogCreateModal.tsx` (나의 일지 탭 "+"에서 열림)
- 입력 항목: 제목(`title`, 신규), 한줄리뷰(`one_line`), 날씨(`weather`, 자유 텍스트, 신규), 방문일(`CalendarPicker`), 장소(`PlaceListScreen`을 선택모드로 열어 검색 — "+"가 특정 장소 상세가 아니라 탭에서 눌려서 장소를 미리 모름), 사진 최대 5장
- **사진 여러 장 + 캡션**: 사진마다 짧은 설명(캡션)을 붙일 수 있어야 한다 — 홈 탭 "취향 맞춤 코스"에서 다른 사용자가 내 기록의 사진을 넘겨볼 때, 캡션이 있으면 사진마다 다른 설명이, 없으면 한줄리뷰가 대신 보임(이미 구현됨). **[구현 필요]** 정작 캡션을 입력하는 UI가 작성 화면에 없어서 지금은 캡션이 항상 비어있음 — 입력 필드 추가 필요(§10)
- 업로드 흐름: `expo-image-picker`(legacy 모드, 기기 로컬 갤러리도 스캔) → `POST /uploads/presigned-url` → S3 PUT → `file_url`. presigned URL 서명에 Content-Type을 포함하던 버그로 업로드가 403으로 실패하던 문제가 있었음(수정 완료)
- 별점(`rating`, 1~5)은 작성 시점이 아니라 **수정 화면(7-2)에서만** 매길 수 있음 — 처음 기록할 땐 사진/제목/한줄리뷰/날씨/장소/날짜만 입력

### 7-1B. 코스 단위 방문 기록 — `POST /logs/course` (신규, 2026-09-10 정식 확정)
- 나의 일지 탭 "+"를 누르면 "장소 기록"(기존, 7-1) / "코스 작성"(신규, 장소 2곳 이상) 중 고르는 바텀시트가 뜸
- "코스 작성": 여행 날짜(범위 선택, 여러 날도 가능) → 장소 2~20곳 선택(지도 다중 선택) → 장소마다 사진(최대 10장)/제목/한줄리뷰/날씨/별점/실제 방문일을 각각 입력 → 한 번에 저장
- 백엔드가 한 트랜잭션으로 `course(source='journal')` + `course_place` + 장소마다 `visit_log`를 생성해서 같은 `course_id`로 묶음(`visit_log.course_id`, nullable FK). `POST/PATCH /courses`에는 `journal` source를 직접 지정 못하게 막아서 이 경로로만 생성되도록 제한
- 나의 일지 목록에서 같은 `course_id`를 가진 기록은 "코스 카드" 하나로 묶여서 보임(장소별 작은 썸네일 가로 나열). 이렇게 만든 코스도 스크랩북 "내 코스"에 AI/직접 코스와 동등하게 노출됨(별도 필터링 없음)
- 아직 전용 Figma 시안이 없어서 기존 "장소 기록" 모달과 같은 스타일을 임시로 재사용 중(디자인 확정되면 교체 예정)

### 7-2. 조회/수정/삭제 — `MyLogsScreen.tsx` + `LogEditScreen.tsx` (드로어 "방문 기록"에서 진입)
- 단순 리스트(장소명/별점/한줄리뷰/날짜) → 선택 시 `LogEditScreen`으로 수정/삭제
- 별점(1~5)은 여기서 매기거나 바꿈. 한줄리뷰는 빈 문자열로 지우면 실제로 지워짐(별점은 반대로 "지우기" 개념 없음 — 값이 있을 때만 반영)
- 사진 있으면 옵셔널이라 텍스트만으로도 기록 작성 가능한 원칙은 유지

### 7-3. 방문기록 → AI 자동 태깅 ✅ 구현 완료 (2026-09-08)
- 방문 기록에 첨부한 사진을 AI가 감성 태그셋 기준으로 분석해서 `log_emotion_tag`에 태그별 점수(`score`)를 채워 넣음
- **연결 방식**: 백엔드는 `VisitLog.emotionTags`가 `log_emotion_tag`를 실시간 JPA 조회로 그대로 매핑하는 구조라, AI/데이터 파트가 `log_emotion_tag` 테이블에 행을 채워 넣기만 하면 백엔드 추가 작업 없이 태그가 바로 노출됨. `place_semantic_vector`(장소 공식 사진 분석)와 같은 패턴으로, 사용자 요청 시점 동기 호출이 아니라 별도 배치로 채움
- **구현**: `data/pipeline/log_emotion_sync.py` + `log_emotion_tag_store.py`(데이터 파트가 직접 작성) — 미분석 방문기록(사진 있고 `log_emotion_tag` 행 없음) 조회 → GPT Vision 분석(Qdrant 저장은 안 함, `persist=False`) → 태그 7개 raw score 그대로 저장(threshold 없음, 백엔드가 `SUM(score) DESC`로 집계하므로). 실행은 `scripts/auto_sync_log_emotion.py`(1회 또는 `--watch` 폴링)
- 테스트 14건 작성, `data/tests/` 전체 35건 회귀 없이 통과 확인. 실제 DB에 대해 1건 실행해 `log_emotion_tag`에 태그 7개(0.1~0.34 범위로 다양한 점수)가 정상 적재되는 것까지 확인
- (참고) 장소별 방문 로그 누적 태그 집계용으로 쓰던 `place_emotion_tag` 카운터 테이블은 2026-09-02에 제거됨 — 지금은 `log_emotion_tag`를 조회 시점에 직접 집계(`SUM(score) GROUP BY tag`)하는 방식으로 바뀌어서 별도 동기화가 필요 없음

---

## 8. 프로필/설정 (`ProfileScreen.tsx`, `UserController.kt`)

| 기능 | 엔드포인트 | 비고 |
|---|---|---|
| 내 정보 조회/수정 | `GET/PATCH /users/me` | 닉네임만 수정 가능(이메일은 소셜 그대로, 수정 불가 — ssot 확정사항) |
| 회원 탈퇴 | `DELETE /users/me` | 확인 Alert 포함, Hard delete + CASCADE(ssot 확정, MVP 기준) |
| 취향 프로필 | `GET /users/me/preferences` | `RadarChart` 컴포넌트(`react-native-svg`)로 7각형 레이더 차트 표시, 없는 태그는 0.5 중립값으로 채움 — ssot 계획대로 구현됨 |
| 🆕 스크랩북 | `GET /users/me/courses` + `GET /users/me/likes` | `ScrapbookScreen.tsx` — 기존 `MyCoursesScreen`/`LikesScreen`을 하나로 통합(2026-09-03, "여행코스"/"관광지" 두 탭). 코스 카드는 장소 썸네일 3장+"N+" 배지, 관광지 카드는 찜 해제 하트 |
| 감성태그 안내 | `GET /tags` (`TagsScreen.tsx`) | 7개 대분류 라벨+설명 나열 |
| 알림 설정 | `GET/PATCH /users/me/notification` (`NotificationSettingsScreen.tsx`) | 푸시 전체/행사알림/코스리마인더 토글. **실제 발송은 이번 범위에 포함 안 함**(설정값 저장까지만, 발전계획) |
| 디바이스 토큰 등록 | `POST /users/me/device-token` | 발송 인프라가 없어 지금은 토큰만 저장하고 쓰지 않음 |
| "내 취향 다시 분석하기" | `onRetakeOnboarding` → `App.tsx`가 온보딩 재시작 | `POST /onboarding/reset` 연결 확인됨(§3) |

**⚠️ 명시적 미완성**
- `NotificationSettingsScreen.tsx`: "실제 푸시 발송은 아직 서버에서도 구현되지 않았어요" 문구 노출 — 설정값 저장(`device_token`, on/off 토글)까지만 되고 실제 발송 로직·FCM/APNs 연동이 없음

---

## 9. 데이터 파이프라인 (`data/pipeline/`, 19개 스크립트)

| 구분 | 스크립트 | 역할 |
|---|---|---|
| 수집 | `fetch_places.py`, `fetch_detail.py`, `fetch_place_photos.py`, `fetch_place_hours.py`, `fetch_kakao_tel.py`, `fetch_restaurant_tel.py` | TourAPI/Google Places 원본 수집 |
| 적재 | `load_places.py`, `load_place_hours.py`, `load_tourapi_hours.py` | DB upsert(`content_id` 기준) |
| 보강 | `place_hours_enrichment.py`, `place_photo_enrichment.py`, `tel_enrichment.py` | 누락 데이터(영업시간/사진/전화번호) 채우기 |
| 검증 | `validate_places.py` | 적재 데이터 정합성 체크 |
| 감성태그 | `analyze_place_emotion.py`(deprecated), `semantic_score_store.py`, `semantic_vector_sync.py` | GPT Vision 기반 이미지 분석 → `place_semantic_vector` 적재 |
| 공통 | `config.py`, `db.py`, `paths.py` | 환경설정/DB 커넥션/경로 |

- 감성 이미지 분석: `semantic-image-v4.1` 프롬프트, gpt-4.1-mini, 35개 세부 판단기준 → 7개 대분류 raw score
- 🆕 진행 중(PR #29, `feat/place-image-semantic-vector`): `onboarding_card`를 `place_image_semantic_vector`(사진 단위 벡터, 기존 장소 단위 벡터보다 세분화) 기준으로 재시딩 — DB에는 이미 반영되어 §3의 데이터 신뢰성 문제가 해소된 상태(카드 78장/장소 58곳)
- 쇼핑(TourAPI contentTypeId=38) 매핑: 브랜드 프랜차이즈 매장(`lclsSystm2=SH04`)은 적재 제외, 전통시장·특산물직판장·소품샵은 `문화공간`으로 편입 — `load_places.py`에 반영 완료 확인(실제 DB `문화공간` 33건 = 문화시설 25건 + 쇼핑 편입 8건, 정확히 일치)

---

## 10. 알려진 이슈 / 미완성 / 확인 필요 목록

✅ 표시는 이번 갱신에서 해소가 확인된 이전 항목. 나머지는 여전히 열려있거나 새로 발견된 것.

1. ✅ ~~홈 화면이 메뉴판 상태~~ — GNB+3탭+드로어로 전면 재설계됨(§4)
1-1. **게스트 이용 범위가 확정된 스펙(§1)과 코드의 실제 가드 범위가 정확히 일치하는지 재확인 필요** — 확정된 범위(장소/검색/상세, 행사·축제, 감성 태그, 안동 거리)와 코드의 `authRequired`/`SecurityConfig` 허용 범위가 거의 일치하는 것으로 보이나 화면 단위로 한 번 더 대조 필요
2. ✅ ~~`dev` 브랜치가 `server`/`client`보다 뒤처짐~~ — 2026-09-08 재확인 결과 대부분 해소(§0). 남은 미병합분은 소규모 버그 수정 몇 건뿐
3. **내 PR #29가 `data`를 건너뛰고 `dev`로 머지 완료됨** — 과거 PR #12/#25와 같은 패턴이 이번에도 그대로 반복됨. `data` 브랜치엔 이 작업이 없는 상태로 남아있어 다음에 `data`를 새로 브랜치 딸 때 이 변경이 누락될 수 있음 — 팀에 공유 필요(§0)
4. **지도가 실제 지리 데이터 기반이 아님** — `AndongGlobe`는 장식용 정적 지구본(회전만 가능), `StreetTab`의 카테고리 아이콘도 Figma 실측 좌표를 고정 배치한 것일 뿐 실제 위경도와 무관. 실제 좌표 기반 지도(`MapView`)는 "선택" 이후 경로 미리보기(§4-4)와 `PublicCourseDetailScreen`에서만 씀
5. ✅ ~~`ExploreScreen`(드로어) ↔ `RecommendedTab`(홈 탭)의 기능 중복~~ — 드로어 항목 폐지, 홈 탭 하나로 통합 확정. **액션 아이템**: `ExploreScreen.tsx`와 드로어의 해당 메뉴 항목을 코드에서 제거해야 함(§5-4)
6. ✅ ~~코스 후보 개수~~ — 1개로 확정(스펙 자체가 1개, `course_optimizer` 구현과도 일치)(§6-1)
7. **[구현 필요] 필수 방문 장소 지정 기능** — 정식 기능으로 확정됐으나 아직 미구현(`CandidatePlace`에 must 플래그 추가, `search_optimal_route()`가 필수 장소를 항상 포함하도록 수정 필요)(§6-1)
7-1. ✅ ~~AI 코스 시간대 조정~~ — 2026-09-09 `server`에 구현 완료(`CourseGenerateRequest.startTime`/`endTime`), 아직 `dev` 미병합(§0)(§6-1)
7-2. **[구현 필요] AI 코스 출발 위치 조정** — 정식 기능으로 확정됐으나 아직 미구현(`DEFAULT_ORIGIN` 하드코딩 그대로)(§6-1)
7-3. **[진행 중, dev 미병합] AI 코스 N박N일 지원** — 2026-09-09/10 `server`에 구현 완료, "AI 코스는 하루짜리" 기존 방침을 뒤집는 확정 변경(2026-09-10 재확인). decision-log.md에 이 결정 기록이 없음 — 팀에 기록 남기도록 요청 필요(§6-1, §0)
7-4. ✅ ~~"코스 단위 방문 기록"(`visit_log.course_id`) 신규 기능~~ — 검토 완료, 정식 기능으로 확정(§7-1B). `dev`/`client` 미병합 상태는 여전함(§0)
8. ✅ ~~방문기록 → AI 자동 태깅 배치 작업이 아직 없음~~ — 데이터 파트가 직접 구현 완료, 실제 DB 적재까지 확인(§7-3)
9. ✅ ~~onboarding_card 데이터 신뢰성 문제~~ — 재확인 결과 현재 DB 기준으로 `place_id NULL`/중복 벡터/깨진 참조 전부 0건, 이미 해소됨. 카드 풀 규모(78장/58곳)는 현재 규모로 유지 확정(§3)
10. ✅ ~~푸시 알림 인프라 없음~~ — 이번 범위에선 구현 안 함으로 확정(설정 UI만 유지), 발전계획으로만 남김(§8)
11. ✅ ~~직접 코스 만들기가 ssot 스펙에 없음~~ — AI 추천 코스와 함께 정식 기능으로 확정(§6-2)
12. ✅ ~~`visit_log.rating`(별점) 입력 UI 미확인~~ — 작성 시점이 아니라 수정 화면(`LogEditScreen`)에서 매기는 구조로 확인됨(§7-2)
13. **[구현 필요] 사진별 캡션 입력 UI** — 정식 기능으로 확정됐으나 작성 화면(`JournalLogCreateModal`)에 입력 필드가 없어 구현 필요(§7-1)
14. ✅ ~~`course.is_public` 토글 UI~~ — 이번 범위에선 만들지 않는 걸로 확정(항상 공개), 발전계획으로만 남김(§6-3, §9 발전계획)
15. ✅ ~~취향 프로필 레이더 차트 렌더링 방식 미확인~~ — `RadarChart` 컴포넌트로 구현 확인(§8)
16. ✅ ~~`GET /places/featured`(개인화 장소 추천) 미사용~~ — 당장은 어느 화면에도 노출하지 않는 걸로 확정(보류). 백엔드 로직 자체는 남겨둠(§5-1)
17. **AI 서비스의 장소/코스 추천 분리(`recommendations`/`course_recommendations`, §6-4)가 백엔드에 연결됐는지 미확인** — `ai` 브랜치에만 있는 변경이라 `CourseController`가 새 응답 구조를 실제로 쓰는지 확인 필요
18. ✅ ~~`load_places.py`의 쇼핑→문화공간 매핑 반영 여부~~ — 코드/실제 DB 둘 다 확인 완료, 반영돼 있음(§9)
19. ✅ ~~`ssot.md` 테이블 목록·기능 스펙이 실제 스키마/화면과 상당히 어긋남~~ — 2026-09-08 이 문서의 확정 사항 전체를 `ssot.md`에 반영 완료(§1)
20. **테스트 안정성**: Supabase pooler 세션모드 커넥션 15개 한도 vs Hikari 풀 크기 이슈 — 근본 해결 여부 미확인
21. **구글 OAuth 테스트 모드** — 배포 전 "테스트 사용자" 제한 해제 필요(§2)
22. 참고: **2026-09-07 세션부터 실기기 검증은 사용자(설만수로 추정)가 직접 진행하는 걸로 전환**됨 — 이후 client 커밋들의 실기기 확인 여부는 decision-log 각 항목에 개별 명시돼 있음

---

## 다음 단계 제안

1. §2~§9를 순서대로 같이 보면서 ⚠️/🆕 항목이 "의도된 축소"인지 "그냥 안 끝난 것"인지 구분(§1은 완료)
2. §10 목록 중 우선 확인할 항목 정하기
3. 확정되는 대로 `ssot.md`/`decision-log.md`에 반영
4. §0은 매번 이 문서를 열 때마다 `git fetch`로 재확인 — 지금은 대부분 정리된 상태
