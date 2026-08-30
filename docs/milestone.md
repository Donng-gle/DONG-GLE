# 마일스톤

> 공모전 제출 마감: 2026년 9월 20일
> 최근 수정: 2026-08-24 · 이수연 (영업시간 "24시간 운영" 파싱 버그 수정)

---

## M0: 기반 확정 (~ 2026-07-06)
> 이 단계가 끝나야 각 파트가 병렬로 개발 가능

| 항목 | 담당 | 상태 |
|---|---|---|
| DB 스키마 확정 | 설만수, 이수연 | ⬜ 미정 |
| 감성태그셋 목록 확정 | 김지광 | ✅ 완료 (2026-07-07) |
| 데이터↔백엔드 적재 방식 결정 | 설만수, 이수연 | ✅ 완료 (2026-06-29) |
| 음식점 보완 방식 결정 (카카오 로컬 API 여부) | 이수연 | ✅ 완료 (2026-07-17) — 장소 확장 없이 tel만 카카오로 보완, decision-log 참고. **2026-08-02 Google Places API로 전환** (김지광 `ai/feat/semantic-vector` 작업분, decision-log 참고) |
| 코스 추천 알고리즘 방향 결정 (rule-based vs LLM) | 김지광 | ⬜ 미정 |
| 온보딩 조기 종료 스코어 변화 임계값 결정 | 김지광 | ✅ 완료 (2026-07-07) |
| 온보딩 사진 노출 알고리즘 결정 | 김지광 | ✅ 완료 (2026-07-07) |
| DB 접속 환경 세팅 (로컬/클라우드) | 설만수 | ✅ 완료 (2026-07-17, 로컬 개발 환경만. 각자 로컬이라 팀원 간 데이터 공유 안 됨 — 공용 클라우드 DB 전환 논의 중) |
| 지도/경로 API 결정 (TMAP vs 구글맵) | 김지광 | ✅ 완료 (2026-07-23) — 구글맵 확정. TMAP과 큰 차이 없다고 판단. **`api_1.3.1v.yaml`이 TMAP 기준으로 작성돼 있어 설만수 쪽 스펙 수정 필요** |
| 쇼핑(TourAPI contentTypeId=38) 27건 category 매핑 결정 | 이수연 | ✅ 완료 (2026-07-17) — 브랜드 매장 19건 적재 제외, 전통시장·특산물직판장·소품샵 8건 문화공간 편입. 구현(`load_places.py`) 및 로컬 DB 검증 완료 |
| 프론트엔드 프레임워크 결정 | 설만수 | ✅ 완료 (2026-07-17) — React Native (Expo), 모바일 앱 |

### 지도/경로 API 조사 노트 (2026-07-17, 이수연 — TMAP vs 카카오 기준, 과거 참고용)
> 2026-07-23 김지광이 구글맵으로 최종 확정 (decision-log 참고). 아래는 TMAP vs 카카오 비교 당시 조사 기록으로, 최종 결정과는 무관하게 남겨둠

- `api_1.3.1v.yaml`(v1.3.1, 설만수)에 경로 계산(경유지 최적화, 이동시간/거리 재계산)이 이미 TMAP 기준으로 설계되어 있음 (`/courses/generate`, `/courses/:courseId` 등에서 명시적으로 TMAP 언급)
- `GET /places/map`(지도 핀 조회)은 좌표만 반환하는 SDK 무관 설계라, 지도 렌더링 SDK는 경로 API와 별개로 정할 수 있음
- **카카오모빌리티 길찾기(Directions) API는 자동차 전용 공개 API.** 도보 경로는 별도 권한 신청이 필요한 제한 기능이라 단기간 승인은 어려울 것으로 보임 → 동글 코스 추천(안동 시내 도보 이동 위주로 예상)에는 불리
- TMAP은 보행자/자동차/대중교통 경로, 경유지 최적화(다중경유지), 자체 지도 SDK(Dynamic/Static Map)까지 전부 표준 공개 API로 제공
- 요금: 카카오 자동차 길찾기는 일 1만 건까지 무료, 초과 시 건당 8원 확인됨.
- **TMAP Free 요금제 실제 확인 완료** (openapi.sk.com, 이수연 2026-07-17):
  | API | Free 무료 한도 |
  |---|---|
  | 경로안내 (자동차/보행자/타임머신/이미지/화물차 공통 쿼터) | 1,000건/일 |
  | 다중 경유지 30 | 100건/일 |
  | 경유지 최적화 10 / 20 | 50건/일 |
  | 경유지 최적화 30 / 100 | 1건/일 (급격히 줄어듦) |
  | 지도보기 | 100,000건/일 |
  | Static MAP | 1,000건/일 |
  | 인증 | 100,000건/일 |
  - 1일 코스는 장소가 많아야 5~10개 수준이라 "경유지 최적화 10/20" 티어(50건/일)로 충분할 것으로 보임. 지도 렌더링(10만 건/일)은 데모 단계엔 사실상 무제한.
  - Free 요금제는 **한도 초과 시 자동 차단**이라 예상치 못한 과금 위험 없음. Lite부터는 월 220만원(VAT포함) 정액이라 공모전 규모엔 불필요.
- (검토 의견) 경로+지도 렌더링을 TMAP 하나로 통일하면 SDK/키 관리가 단순해짐. 카카오맵으로 렌더링만 분리하는 것도 가능하나 얻는 이득 대비 복잡도 증가. Free 쿼터로도 공모전 데모 규모엔 충분해 보임

### M0 완료 기준
- `docs/ssot.md`에 스키마/알고리즘/운영 방식의 최종 기준이 반영됨
- `docs/decision-log.md`에 주요 결정의 이유와 영향이 기록됨
- 데이터, 백엔드, AI 파트가 각자 다음 작업을 바로 시작할 수 있음

---

## M1: 데이터 적재 & 백엔드 개발 시작 (~ 2026-07-06)

> M0 스키마 확정 후 데이터↔백엔드 **병렬 진행**

**데이터**

| 항목 | 상태 |
|---|---|
| PLACE DB 적재 (`load_places.py`) | 🟡 스크립트 작성·로컬 검증 완료, 190/209건 (쇼핑 브랜드 매장 19건은 category 없어 제외). 실제 운영 DB는 공용 클라우드 DB 확정 후 실행 필요 |
| PLACE_IMAGE 적재 | 🟡 스크립트 완료 (firstimage 없는 21건 중 실제 추가 이미지 있는 1건만 적재, 나머지 20건은 TourAPI 원본에 이미지 없음 확인) |
| 행사축제 날짜 적재 (event_start/end_date) | ✅ 완료 (2026-07-17, 8/8건) — `searchFestival2`가 지역코드 체계 불일치로 0건만 반환하던 버그 발견, `detailIntro2` 방식으로 수정 |
| homepage URL 파싱 적재 | ✅ 완료 (2026-07-17) |
| 음식점 tel 보완 | ✅ 완료 (2026-07-17, 카카오 로컬 API로 28/33건 매칭). 이름 불일치 검증 추가해 오탐 제거. **2026-08-02 Google Places API로 전환 및 재적재 완료** (26/33건 매칭, Supabase 반영). 카카오 대비 스팟체크 결과 큰 차이 없음, 예미정 1건은 둘 다 오매칭이라 수동 보정 (decision-log 참고) |

**백엔드**

| 항목 | 상태 |
|---|---|
| 기본 CRUD API (PLACE 조회) | ✅ 완료 (2026-07-17) — `GET /places`, `GET /places/{placeId}` |

### M1 완료 기준
- PLACE / PLACE_IMAGE / 행사축제 날짜 / homepage 데이터가 DB에 반영됨
- 적재 스크립트를 다시 실행해도 중복 없이 동작함
- 백엔드에서 PLACE 조회가 가능한 최소 API가 동작함

---

## 스프린트 1 (~2026-07-23, 종료) — 회의 결과 다음 스프린트로 이월

> M2 착수 전, M0/M1 마무리 + 막혀있던 결정사항 정리 목적

**최우선 (다른 파트 작업을 막고 있음)**
- 김지광: AI 모델 확정(감성태그 분석용 이미지 인식/멀티모달 모델), 코스 추천 알고리즘 방향 확정
- ~~김지광: 지도/경로 API 확정~~ ✅ 완료 (2026-07-23) — 구글맵 확정. `api_1.3.1v.yaml`의 TMAP 기준 경로 스펙 수정 필요 (설만수)
- ~~설만수: 공용 클라우드 DB 전환~~ ✅ 완료 (2026-07-23) — Supabase로 전환, 접속 정보 팀 채팅 공유 예정. 데이터 파트는 이제 공용 DB에 바로 적재 가능

**데이터 (이수연)**
- [x] 쇼핑 카테고리 매핑 구현 (`load_places.py` 반영, 이름+주소 기준 중복 제거 로직 추가)
- [x] 공용 DB 정보 받는 대로 실제 적재 (2026-07-23, Supabase에 190건 확인 완료)
- [x] 감성태그 분석 파이프라인 골격 구축 (`analyze_place_emotion.py`) — `analyze_image(image_url) -> dict[tag, score]` 인터페이스로 설계, 김지광 모델 확정되면 이 함수만 교체하면 됨. 로컬 DB로 가짜 분석기 검증 완료

**알고리즘 (김지광)**
- [ ] AI 모델 확정 (최우선)
- [x] 지도/경로 API 확정 — 구글맵
- [ ] 코스 추천 알고리즘 방향 확정
- [ ] 감성태그 판단 기준/프롬프트 설계
- [ ] **`ai/` 폴더에 `analyze_image(image_url) -> dict[tag, score]` 구현** (2026-07-23 결정: AI 코드는 `data/` 안이 아니라 별도 `ai/` 폴더로 분리, decision-log 참고). `data/pipeline/analyze_place_emotion.py`의 `stub_analyzer`를 이 함수로 교체하면 파이프라인 연결 완료

**백엔드 (설만수)**
- [x] 공용 클라우드 DB 세팅 (2026-07-23, Supabase)
- [x] 소셜 로그인 인증 구현 (`/auth/oauth/kakao`, `/auth/oauth/google`, `/auth/refresh`, `/auth/logout`) — 카카오/구글 앱 자격증명 발급 전이라 실 로그인 E2E는 아직 미검증
- [x] 내 정보 API (`GET/PATCH /users/me`) (2026-07-23)
- [x] PLACE 나머지 엔드포인트 (`/places/map`, `/places/featured`, `/places/search`, `/places/{placeId}/like`) (2026-07-23) — `/places/featured`는 온보딩/취향 데이터가 없어 개인화 없이 인기순(`visit_log_count`) 고정, `is_personalized`는 항상 false
- [ ] 업로드용 presigned URL 발급 (`/uploads/presigned-url`) — S3 사용 예정(API 명세 기준), 자격증명 필요

**프론트 (설만수)**: 당초 이번 주 보류 예정이었으나 백엔드 로그인 API와 함께 선작업 진행됨 (2026-07-23)
- [x] React Native(Expo) 프로젝트 초기 세팅, 로그인 화면 + 카카오/구글 OAuth 연동 (`client` 브랜치 머지 완료)

**디자인 (전성빈)**
- [ ] 주요 화면(온보딩 스와이프, 장소 탐색, 코스 추천) 시안 작업 시작

---

## 스프린트 2 (~2026-07-31, 종료) — 미완료분 스프린트3로 이월

**알고리즘 (김지광)**
- [ ] AI 모델 확정
- [ ] `ai/` 폴더에 `analyze_image(image_url) -> dict[tag, score]` 구현
- [ ] 감성태그 판단 기준/프롬프트 설계
- [ ] 코스 추천 알고리즘 방향 확정 + 초안 설계

**데이터 (이수연)** — 2~4번은 김지광 AI 모델 전제
1. [x] 온보딩 카드용 사진 풀 확장 (2026-08-02) — 전체 장소(209건) 대상 `detailImage2` 호출로 확장, 161개 장소·총 1,012장 확보 (기존 1장→평균 6.3장). Supabase `place_image`에 전량 적재 완료. 대표 3장 선정은 AI 모델 확정 후 진행 예정(스키마상 우선순위는 아직 안 정함)
2. [~] `analyze_place_emotion.py`를 실제 AI로 연결 (2026-08-02) — `ai/semantic_vector`(GPT Vision, 35개 세부 태그→7개 대분류 평균) 재사용해 `stub_analyzer` 교체 완료. `OPENAI_API_KEY`/`QDRANT_URL` 없어서 실행 검증은 아직 못 함, 키 받으면 실행 후 Supabase `PLACE_EMOTION_TAG` 적재 확인 필요
3. [ ] `onboarding_card` 시드 데이터 스크립트 신규 작성 — PLACE_IMAGE 후보 조회 → AI 점수 → 태그별 대표 사진 선정 적재. 스키마 제약(태그별 최소 4장, `is_seed=true` 7장) 충족 방법 확인 필요
4. [ ] 결과 검증 (태그 분포, 온보딩 카드 선정 품질)
5. [x] `ai` 브랜치(hidden_score, semantic_vector) → `dev` 병합 (2026-08-02) — `ai`가 repo init 시점부터 `dev`와 공통 조상 없이 분기돼 있어 충돌 9건 발생, 수동 해결. `load_places.py`의 `semantic_vector_sync` 자동 연동은 제외(데이터 파트 의존성 분리 원칙 유지, decision-log 참고), 백필은 `scripts/backfill_semantic_vectors.py`로 별도 실행

**백엔드 (설만수)**
- [x] `api_1.3.1v.yaml` TMAP→구글맵 스펙 수정 (2026-07-23)
- [ ] 카카오/구글 OAuth 앱 자격증명 발급 + 로그인 E2E 검증
- [ ] presigned URL 업로드 API (S3)
- [ ] 온보딩 API 구현 (`/onboarding/*`) — `onboarding_card` 데이터는 데이터 파트 담당(위 2번)

**프론트 (설만수)**
- [ ] 디자인 시안 나오는 대로 탐색/코스 화면 작업 시작

**디자인 (전성빈)**
- [ ] 주요 화면 시안 — 진행 상황 회의에서 확인

---

## 스프린트 3 (~2026-08-07, 다음 회의까지)

**최우선 (다른 파트 작업을 막고 있음)**
- 설만수: `feat/onboarding-api`, `feat/presigned-upload` → `server` 머지 완료 (2026-08-03 확인). `server`→`dev` 통합은 아직 미완료 — 프론트 온보딩 화면 작업 시작하려면 필요 (계속 이월)
- ~~설만수: 이미지 프록시 엔드포인트 구현 필요~~ ✅ 완료 (2026-08-04) — `GET /images/proxy?ref={photo_reference}&maxWidth=`. Render(`https://dong-gle.onrender.com`)에 배포·검증까지 완료. 데이터 파트 사진 없는 18개 장소 보완 작업 블로커 해제
- 김지광: 코스 추천 알고리즘 방향 아직 미확정 (스프린트1부터 계속 이월)

**데이터 (이수연)**
1. [x] ~~`analyze_place_emotion.py` 전체 배치 실행~~ → **아키텍처 전환으로 폐기** (2026-08-21) — 김지광이 `place_semantic_vector`(사진 3장·검증된 프롬프트 `semantic-image-v4.1` 기반 raw score)로 182곳 전체를 이미 분석·적재 완료 (`feat/semantic-vector`→`ai` PR #20). 우리가 만든 threshold(0.5) 기반 시드값(167곳, 270개 태그)은 삭제 완료, `place_emotion_tag` 테이블/백엔드 서비스 로직 자체는 유지 (방문 로그 누적용으로 별도 역할, decision-log 2026-08-21 참고)
2. [x] ~~결과 검증~~ → 위 전환으로 대상 자체가 바뀜, `place_semantic_vector` 결과 검증은 김지광 담당(PR #20에 이미 SUN 데이터셋 벤치마크·안동 파일럿 검증 포함됨)
3. [ ] `onboarding_card` 시드 데이터 스크립트 신규 작성 — 이제 `place_semantic_vector`(장소 단위 raw score)를 참고할지, 이미지별 개별 점수가 별도로 필요한지(온보딩 카드는 "사진 한 장 단위" 대표성이 필요함, ssot.md 카드 선택 전략 참고) 확인 필요. PLACE_IMAGE 후보 조회 → AI 점수 → 태그별 대표 사진 선정. 스키마 제약(태그별 최소 4장, `is_seed=true` 7장) 충족 방법도 확인 필요
4. [x] `fetch_unanalyzed_places` 로직 개선 완료 (2026-08-10) — `main_image_url` 없어도 `place_image` 후보가 있으면 폴백해서 분석 대상에 포함 (부용대 반영 확인). *(단, 이 함수 자체가 있던 `analyze_place_emotion.py`는 위 1번으로 폐기됨 — 로직은 남아있으나 더 이상 호출되지 않음)*
5. [x] **`place_image` 정리 완료** (2026-08-06~10) — 사진 전무 18건 중 15건 Google Places로 보완(`place_photo_enrichment.py`), 나머지 3건(안동한우갈비/위생찜닭/안동시 월령빠지)은 구글에도 없어 **DB에서 삭제** (2026-08-10, decision-log 참고) — 전체 장소 190건 → 187건, 사진 보유율 100%. **당초 계획했던 "3장으로 트림"은 하지 않기로 함** — `place_image`는 다다익선으로 그대로 두고, 온보딩 카드용 대표 선정은 스프린트3 3번 항목에서 별도 처리. 식당/카페 대표이미지(`main_image_url`)는 32곳 전수 검토해 음식 사진 대신 내부/외부 사진으로 통일 (decision-log 2026-08-08 참고)
6. [x] **영업시간 `place_hours` 테이블 신설 및 적재 완료** (2026-08-10~24) — Google Places `opening_hours`(70건) + TourAPI 텍스트 자동 파싱(상시개방 38건, 단순 단일시간대 23건) 합쳐 182건 중 **131건(72%)** 확보. "매일 24시간 운영" 특수 케이스를 잘못 파싱하던 버그 수정 완료 (2026-08-24, decision-log 참고). 브레이크타임은 소스에 데이터가 없어 미반영. 남은 51건은 요일/계절별 복잡한 텍스트(33건)거나 데이터 자체가 없음(18건). 코스 추천 알고리즘에서 실제로 참조하는 로직은 아직 없음
7. [x] **종료된 축제 5건 + 사진 없는 장소 3건 DB 삭제** (2026-08-10) — 축제: 경북 K-스토리 페스티벌, 동아시아문화도시 안동, 안동 수(水)페스타, 안동벚꽃축제, 차전장군 노국공주축제(남은 3건은 진행중/예정이라 유지). 장소: 안동한우갈비/위생찜닭/안동시 월령빠지(구글에도 사진 없어 삭제). 연결된 사용자 데이터 없음 확인 후 삭제. 전체 장소 190→182건
8. [ ] **`place_semantic_vector` vs `place_emotion_tag` 역할 정리 필요** (2026-08-21) — 코스 추천/장소 상세 등에서 이 두 신호를 어떻게 함께 쓸지 알고리즘 설계 영역이라 김지광/설만수 확인 대기 (decision-log 참고)

**알고리즘 (김지광)**
- [x] AI 모델 확정 — OpenAI GPT Vision(`gpt-4.1-mini`) 기반, `ai/semantic_vector`로 구현 완료 (2026-08-02 데이터 파트에서 실제 연동·검증함, decision-log 참고)
- [x] 감성태그 판단 기준/프롬프트 설계 — `ai/semantic_vector/prompt.py`에 35개 세부 태그(7개 대분류×5개) 기준으로 구현됨, `ssot.md` 감성태그셋과 대응 확인
- [x] `ai/` 폴더에 `analyze_image(image_url) -> dict[tag, score]` 구현 — `ai/semantic_vector` 재사용으로 데이터 파트에서 연동 완료
- [ ] 코스 추천 알고리즘 방향 확정 + 초안 설계 (최우선, 계속 이월)

**백엔드 (설만수)**
- [x] `feat/onboarding-api` → `server` 머지 완료 (2026-08-03) — 온보딩 API v2.0.0 알고리즘 전체 구현 (스와이프, 카드 선택, 감성 벡터 업데이트), `schema.sql`/`schema.dbml`에 `onboarding_card`/`user_preference` 반영됨
- [x] `feat/presigned-upload` → `server` 머지 완료 (2026-08-03) — S3 presigned URL 업로드 API
- [x] **이미지 프록시 엔드포인트 구현** (2026-08-04) — `GET /images/proxy?ref={photo_reference}&maxWidth=`. Google Places Photo API 키는 서버사이드에서만 다루고 이미지 바이너리를 중계하는 방식. `server` 머지 완료
- [x] **백엔드 Render 배포** (2026-08-04) — `https://dong-gle.onrender.com` (무료 플랜, Docker 멀티스테이지 빌드, `server` 브랜치 push 시 자동 배포). 무료 플랜 512MB 메모리 제한으로 배포 직후 OOM(Exit 137) 발생 확인 → JVM 힙/GC 옵션 조정으로 해결. `main`은 아직 서버 코드가 반영 안 된 상태라 배포 소스는 임시로 `server` 사용 중 — `dev`/`main` 통합되면 배포 브랜치 전환 필요
- [ ] `server` → `dev` 통합 (계속 이월, 의도적으로 보류 중)
- [ ] 카카오/구글 OAuth 앱 자격증명 발급 + 로그인 E2E 검증 (스프린트2부터 이월)
- [x] **여행 기록(방문 로그) 관련 제외한 나머지 엔드포인트 — 1차분 구현 완료** (2026-08-04):
  - `GET /users/me/preferences`, `GET /users/me/likes`, `GET /events` (월별 축제 목록, d_day 계산)
  - 코스 CRUD 신규 구현: `GET /users/me/courses`, `POST /courses`, `POST /courses/manual`, `GET/PATCH/DELETE /courses/{courseId}` — 구글맵 Directions 경로 재계산(이동시간/거리/폴리라인)은 스코프 제외, 코드에 TODO로 명시(항상 null 반환)
  - `GET/PATCH /users/me/notification`, `POST /users/me/device-token` — `notification_setting`/`device_token` 테이블 신규 추가(`schema.sql`/`schema.dbml` 반영, 공용 Supabase에도 적용 완료). 설정값/토큰 저장까지만 구현, 실제 푸시 발송(FCM 연동, `course_reminder` 크론 등)은 스코프 외
  - `GET /health`
- [x] **여행 기록 CRUD·유사 사용자 탐색 — 2차분 구현 완료** (2026-08-05, 재검토 후 착수) — 애초에 "여행 기록 관련은 전부 제외"로 뭉뚱그렸던 걸 다시 뜯어보니 AI 태그 분석이 필요 없는 부분은 스키마가 이미 있어서 바로 구현 가능했음:
  - `GET /users/me/logs`, `GET /places/{placeId}/logs`, `GET/PATCH/DELETE /logs/{logId}`
  - `GET /explore/similar-logs` — 내 상위 태그(score 상위 3개)와 겹치는(score 0.6 이상) 다른 유저의 공개 기록을 뷰포트 필터링해서 반환
  - `DELETE /logs/{logId}` 시 `place.visit_log_count`, `place_emotion_tag.count` 감소까지 스펙대로 구현
- [ ] **미구현 잔여분 — 보류**:
  - [x] `POST /places/{placeId}/logs`(여행 기록 작성) — AI 감성 태그 자동 부여는 제외하고 우선 구현 완료 (2026-08-30, `feat/visit-log-create`). 기록 생성/저장, `visit_log_count` 증가는 정상 동작, 응답 `tags`는 AI 연동 전까지 항상 빈 배열. AI 태그 부여는 `ai/semantic_vector`의 이미지 분석이 아직 어떤 HTTP 엔드포인트로도 노출되지 않아서 계속 보류 (decision-log 2026-08-30 참고)
  - [x] `/swipe/candidates`, `/swipe/sessions/{sessionId}`, `/swipe/sessions/{sessionId}/results` — **2026-08-30 구현 완료** (`feat/swipe-session`). 후보 랭킹은 `ai/place_recommender`(취향 벡터 기반 Qdrant 검색 + `place.hidden_score` 결합 Top-N, `POST /v1/places/recommend`, PR #25 포함분) 호출 + 신설한 `swipe_session`/`swipe_session_candidate` 테이블로 세션 상태 저장. 세부 값(후보 20장, mood_tags 가중치 등)은 decision-log 참고
  - [x] `/courses/generate` — **2026-08-30 구현 완료(스코프 축소)**. `ai/course_optimizer` 연동해서 좋아요/필수 표시 장소로 코스 1개를 생성. 스펙상 "최대 3개 후보"·"must 강제 포함"은 course_optimizer 알고리즘 자체의 한계(경로 1개만 반환 가능, 필수 장소 개념 없음)로 지금은 근사치 — 상세는 decision-log 참고. **김지광에게 알고리즘 확장(top-N 경로, 필수 장소 강제) 요청 필요**. 구글맵 Directions(거리/이동시간 재계산)는 여전히 스코프 외, `totalDurationMin`만 course_optimizer 실제값 사용
  - `/onboarding/cards`, `/onboarding/preferences` — api 스펙 자체에 `[DEPRECATED 가능성]` 표기됨. `Onboarding Algo.md`(v2.0.0)가 스와이프 방식(`/onboarding/next` 등)만 다루고 이 두 엔드포인트를 전혀 언급하지 않음 — 예전 카드 다중선택 방식의 흔적으로 추정되며, `/onboarding/complete`가 이미 같은 역할(결과 저장 + `has_onboarded` 갱신)을 스와이프 방식으로 수행 중이라 사실상 대체된 것으로 보임. 실제 필요 여부 팀 확인 후 스펙 정리 필요
  - `/admin/sync/places` — TourAPI 재동기화 트리거 기능인데, "데이터 파트가 DB에 직접 적재" 결정(2026-06-29)과 책임이 겹침. 응답 스펙의 `deactivated`(비활성화 수)를 반영할 soft-delete 컬럼도 `place` 테이블에 없어 스키마 추가까지 필요 — 정말 필요한 기능인지 재검토 필요

**프론트 (설만수)**
- [ ] 온보딩 API `dev` 머지되는 대로 온보딩 스와이프 화면 구현 착수
- [ ] 디자인 시안 나오는 대로 탐색/코스 화면 작업 시작 (계속 이월)

**디자인 (전성빈)**
- [ ] 주요 화면(온보딩 스와이프, 장소 탐색, 코스 추천) 시안 계속 진행

---

## M2: 핵심 기능 구현 (~ 2026-08-11)

> M1 완료 후 항목 구체화 예정

| 파트 | 큰 덩어리 | 상태 |
|---|---|---|
| 데이터 | 감성태그 분석 파이프라인 구축 & PLACE_EMOTION_TAG 적재 | 🔄 진행 중 (골격 구축 완료, AI 모델 확정 대기) |
| 알고리즘 | 감성태그 분석용 AI 모델 선택(이미지 인식/멀티모달), 판단 기준/프롬프트 설계, 코스 추천 알고리즘 구현 | ⬜ |
| 백엔드 | 인증(소셜 로그인) + 핵심 API 구현 | 🔄 진행 중 (2026-07-17 착수, OAuth 앱 자격증명 발급 전이라 `.env` 플레이스홀더로 개발) |
| 프론트 | 주요 화면 UI 구현 | 🔄 진행 중 (2026-07-17, React Native(Expo) 프로젝트 세팅 + 로그인 화면부터 시작) |

### M2 완료 기준
- 사용자 핵심 여정(온보딩 → 추천 조회 → 상세 조회)이 한 번 이어서 동작함
- 감성태그 분석 결과가 추천 로직 또는 노출 로직에 연결됨
- 데모 시연이 가능한 수준의 안정성이 확보됨

---

## M3: 통합 & 마무리 (~ 2026-09-20)

> M2 완료 후 항목 구체화 예정

| 파트 | 큰 덩어리 |
|---|---|
| 전체 | 통합 테스트 & 버그 수정 |
| 기획 | 발표 자료 & 시연 영상 |
| 전체 | 최종 제출 |

### M3 완료 기준
- 발표 자료와 시연 시나리오가 완성됨
- 최종 시연 빌드/버전이 고정됨
- 제출물 체크리스트를 기준으로 누락 없이 제출 가능함

---

## 주의사항
- 미확정 사항은 SSOT에 바로 적지 않고 먼저 여기서 상태 관리
- 상태가 바뀌면 날짜와 함께 갱신
- 결정 완료 시 `decision-log.md`를 먼저 기록한 뒤 `ssot.md`를 반영
