# Decision Log

> 꼭 필요한 기술/기획 결정만 짧게 기록.
> 원칙: 한 결정당 `결정 / 이유 / 영향`만 남김.
> 사소한 UI 문구, 구현 디테일, 일회성 논의는 적지 않음.

---

## 2026-06 | DB: PostgreSQL 선택

- **결정**: MySQL 대신 PostgreSQL 사용
- **이유**: JSON 처리와 확장성에 유리
- **영향**: 스키마를 PostgreSQL 기준으로 작성

---

## 2026-06 | 탈퇴 처리: Hard delete (MVP)

- **결정**: 회원 탈퇴 시 Hard delete + CASCADE
- **이유**: MVP에서는 구현을 단순하게 가져감
- **영향**: 사용자 삭제 시 연관 데이터도 함께 삭제

---

## 2026-06 | 숙박(contentTypeId=32) 수집 제외

- **결정**: 숙박 데이터는 수집하지 않음
- **이유**: MVP 범위에서 숙박은 제외
- **영향**: 수집 대상은 숙박 제외 209건

---

## 2026-06 | detailCommon2 파라미터 제한

- **결정**: `defaultYN`, `firstImageYN`, `overviewYN` 파라미터 사용 안 함
- **이유**: TourAPI v4.4에서 `INVALID_REQUEST_PARAMETER_ERROR` 발생 확인
- **영향**: `contentId`, `numOfRows`, `pageNo`만 사용

---

## 2026-06 | detailImage2: smallimageurl 별도 저장 안 함

- **결정**: `small_url` 컬럼 없이 `img_url`(originimgurl)만 저장
- **이유**: 두 URL이 동일하게 내려옴
- **영향**: PLACE_IMAGE 스키마 단순화

---

## 2026-06 | PLACE.category Enum 확정

- **결정**: 관광지 / 식당 / 카페 / 액티비티 / 문화공간 / 축제행사
- **이유**: TourAPI 분류를 서비스 기준에 맞춤
- **영향**: `category`를 ENUM으로 관리

---

## 2026-06-29 | 데이터↔백엔드 적재 방식: 직접 적재

- **결정**: 데이터 파트가 DB에 직접 적재
- **이유**: 적재 파이프라인을 단순하게 유지
- **영향**: 데이터 파트 DB 권한 필요, 스키마 변경 시 사전 협의 필요

---

## 2026-06-29 | 내 정보 필드 스펙 확정

- **결정**: 이메일 수정 불가 / 사용자ID 중복 불가 / 닉네임 중복 허용
- **이유**: 로그인 식별자와 표시용 값을 분리
- **영향**: USER 컬럼 제약 조건에 반영

---

## 2026-06-29 | 온보딩 종료 조건 확정

- **결정**: 오른쪽 스와이프 15개 누적 OR 스코어 변화량 임계값 이하 (조기 종료)
- **이유**: 피로도를 줄이고 빠르게 취향 수렴
- **영향**: 임계값 정의와 점수 갱신 로직 필요

---

## 2026-06-29 | 백엔드 스택 확정

- **결정**: Kotlin + Spring Boot 사용
- **이유**: 팀 백엔드 개발 방향에 맞춤
- **영향**: 서버 구현과 API 개발 기준으로 사용

---

## 2026-06-29 | 내 취향 프로필 UI: 레이더 차트

- **결정**: 감성태그 대분류 점수를 레이더 차트로 시각화, 0.5를 중립 기준선으로 설정
- **이유**: 태그 개수와 잘 맞고 선호/비선호를 직관적으로 구분 가능
- **영향**: 프론트에서 레이더 차트 구현 필요 (태그 수 확정 후 각형 결정)

---

## 2026-07-07 | 감성태그 7개 확정 (traditional/modern 분리)

- **결정**: 기존 `style` 단일 태그를 `traditional`/`modern`으로 분리하여 총 7개 태그 확정
- **이유**: 한옥 카페처럼 두 태그가 동시에 높은 복합 공간이 존재 → 독립 관리가 취향 분리에 유리
- **영향**: 내 취향 프로필 차트 7각형으로 확정. DB `emotion_tag` 참조 모든 파트 동기화 필요

---

## 2026-07-07 | 온보딩 알고리즘 확정 (v2.0.0)

- **결정**: 시드 7장 → 균형 60% + 탐색 30% + 랜덤 10%. 좋아요 학습률 0.40 / 싫어요 0.25. 수렴 기준 변화량 < 0.03 AND 최소 15장. 최대 25장 상한.
- **이유**: 상대적 업데이트 방식으로 전부 좋아요여도 벡터가 뾰족하게 수렴. 랜덤 10%로 편향 방지.
- **영향**: `onboarding_card` 테이블 필요. 세부 명세는 `server-back/Onboarding Algo.md` 참조.

---

## 2026-07-07 | 스키마 추가: has_onboarded, is_public, onboarding_card

- **결정**: `user.has_onboarded` (boolean, default false), `visit_log.is_public` (boolean, default true), `onboarding_card` 테이블 신규 추가
- **이유**: has_onboarded — 앱 재시작 시 온보딩 상태 복원에 필수. is_public — 유사 사용자 탐색 시 개인정보 보호. onboarding_card — 온보딩 런타임 AI 호출 없이 사전 분석 벡터 제공.
- **영향**: 기존 user/visit_log 테이블 ALTER 또는 재생성 필요.

---

## 2026-07-17 | 음식점 보완 방식: 카카오 로컬 API로 전화번호만 보완

- **결정**: TourAPI 음식점(39) 데이터셋(33건, 안동시 전체 결과 확인됨)은 그대로 유지하고, 카카오 로컬 API(키워드 장소검색)로 누락된 `tel`만 보완한다. 장소 자체를 카카오 데이터로 확장하지 않는다.
- **이유**: TourAPI 음식점 tel이 33/33건 전부 누락 확인. 카카오 로컬 API로 장소 수 자체를 늘리는 방안도 검토했으나, 카카오 API는 사진을 제공하지 않아 동글의 핵심인 사진 기반 감성태그 분석과 온보딩 카드 구성에 쓸 수 없음. 개수보다 사진 확보가 더 큰 병목이라 판단, 범위 확장은 보류.
- **영향**: `pipeline/fetch_kakao_tel.py` 추가 (title+좌표 기반 키워드 검색, 반경 300m 내 최근접 매칭). `load_places.py`가 TourAPI tel 없을 시 카카오 결과로 폴백. `KAKAO_REST_API_KEY` 환경변수 필요.

---

## 2026-07-17 | 로컬 개발 DB 환경: PostgreSQL 로컬 (포트 5433)

- **결정**: 개발 단계 DB는 각자 로컬 PostgreSQL 사용 (`dongle` 데이터베이스, 포트 5433)
- **이유**: 클라우드 계정/비용/네트워크 설정 없이 바로 개발 시작 가능. 배포용 클라우드 DB 호스팅은 별도 결정 필요
- **영향**: 팀원 각자 로컬에 PostgreSQL 설치 후 `schema.sql` 적용 필요. 배포 시에는 접속 정보(URL/계정)만 클라우드 값으로 교체

---

## 2026-07-17 | 백엔드 프로젝트 스택 세부 확정

- **결정**: Spring Boot 4.1 + Kotlin 2.3 + Gradle(Kotlin DSL), JPA `ddl-auto: none`
- **이유**: `schema.sql`이 스키마 기준(SSOT)이므로 JPA가 스키마를 직접 생성/변경하지 않도록 막음
- **영향**: 스키마 변경은 항상 `schema.sql`을 먼저 수정 후 반영. 엔티티 클래스는 `schema.sql`을 따라 작성

---

## 2026-07-17 | 쇼핑(38) 27건 category 매핑 확정

- **결정**: TourAPI 쇼핑(contentTypeId=38) 27건 중 브랜드 프랜차이즈 매장 19건(lclsSystm2=SH04)은 적재 제외, 전통시장·특산물직판장·소품샵 8건(SH05/SH06/SH07)은 `문화공간`으로 편입
- **이유**: 브랜드 매장은 전국 어디서나 볼 수 있어 개인화 여행 코스 추천 의미가 작음. 전통시장·특산물직판장·소품샵은 지역 문화 체험 콘텐츠로 `local` 감성태그와도 잘 맞음
- **영향**: `load_places.py` 반영 및 로컬 DB 검증 완료 (2026-07-22, 190/209건 적재). 원본 데이터 중복 항목(노스페이스 화이트라벨 안동점, 로이드 안동점 각 2건)은 전부 제외 대상(SH04)이라 실제로는 걸러지지 않았지만, 이름+주소 기준 중복 제거 로직을 안전장치로 추가함

---

## 2026-07-17 | 프론트엔드 프레임워크: React Native (Expo)

- **결정**: 모바일 앱 프론트엔드는 React Native + Expo로 개발
- **이유**: 백엔드(Kotlin)와 별개로 새 언어(Dart 등) 학습 부담을 줄이고, 소셜 로그인/지도 SDK 연동 라이브러리가 풍부하며 Expo로 네이티브 빌드 설정 부담을 줄여 공모전 일정(9/20 마감)에 유리
- **영향**: `client-front/` 프로젝트를 Expo 기준으로 세팅. 카카오/구글 로그인은 RN용 OAuth 라이브러리 사용

---

## 2026-07-17 | 스키마 추가: refresh_token 테이블

- **결정**: `refresh_token` 테이블 신규 추가 (`user_id`, `token`, `expires_at`)
- **이유**: JWT 리프레시 토큰 자체는 서버가 강제로 무효화할 수 없어서, 로그아웃 시 무효화하려면 서버 측 화이트리스트가 필요함
- **영향**: `schema.sql`, `schema.dbml` 반영. 로그아웃 시 해당 유저의 refresh_token 행 삭제, 리프레시 요청 시 DB에 존재 여부 확인

---

## 2026-07-17 | 카카오/구글 OAuth 앱 자격증명 미발급 상태로 개발 착수

- **결정**: 카카오/구글 개발자 콘솔 앱 등록 및 REST API 키/Client ID·Secret 발급 전이지만, 로그인 기능 코드는 먼저 구현하고 `.env`는 플레이스홀더로 관리
- **이유**: 자격증명 발급을 기다리지 않고 API 계약(요청/응답 구조)과 로직부터 진행해 개발 속도 확보
- **영향**: 실제 카카오/구글 로그인 E2E 테스트는 자격증명 발급 후 가능. 발급 즉시 `.env`에 실제 값 반영 필요 (팀 채팅 공유, 커밋 금지)

---

## 2026-07-23 | 공용 클라우드 DB: Supabase

- **결정**: 각자 로컬 PostgreSQL 대신 팀 공용 Supabase(PostgreSQL) 프로젝트(`DONG-GLE-DB`, ap-southeast-2)로 전환. `refresh_token` 테이블 포함 전체 스키마 반영 완료
- **이유**: 로컬-각자 방식이라 데이터 파트 적재 결과가 팀에 공유되지 않는 문제 해결 (이번 주 스프린트 최우선 항목)
- **영향**: `server-back`은 `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`를 `.env`로 주입받도록 변경 (커밋 금지, `.env.example` 참고). 접속 정보는 팀 채팅으로 공유. 리전 특성상 direct 연결(`db.<ref>.supabase.co`)이 아닌 pooler 연결(`aws-0-ap-southeast-2.pooler.supabase.com`)을 사용해야 함

---

## 2026-07-23 | GET /places/featured 개인화 보류

- **결정**: 인증 유저 개인화 추천(`user_preference` 상위 태그 매칭)은 온보딩 기능 구현 전까지 보류. 인증 여부와 무관하게 `visit_log_count` 내림차순 인기순으로 고정, `is_personalized`는 항상 `false` 반환
- **이유**: 온보딩/`user_preference` 적재 로직이 아직 없어서 개인화 로직을 지금 구현해도 실제로 동작할 데이터가 없음. 빈 로직을 미리 만드는 대신 API 계약(응답 형태)만 맞춰두고 실제 개인화는 온보딩 완료 후 추가
- **영향**: 온보딩 기능 구현 시 `PlaceService.featured()`에 개인화 분기 추가 필요 (코드에 TODO 표시해둠)

---

## 2026-07-23 | 지도/경로 API: 구글맵 확정

- **결정**: 지도/경로 API는 구글맵(Google Maps)으로 확정 (TMAP 대신)
- **이유**: 김지광 판단, TMAP과 비교했을 때 기능/비용 면에서 큰 차이가 없다고 결론
- **영향**: `api_1.3.1v.yaml`이 현재 TMAP 기준으로 경로 계산(경유지 최적화, 이동시간/거리 재계산)을 명시하고 있어 구글맵 기준으로 스펙 수정 필요 (`/courses/generate`, `/courses/:courseId` 등, 설만수 담당)

---

## 2026-07-23 | 감성태그 분석 AI 코드 위치: 별도 `ai/` 폴더

- **결정**: 감성태그 분석 AI 모델/프롬프트 구현(`analyze_image(image_url) -> dict[tag, score]`)은 `data/pipeline/` 안에 두지 않고 별도 `ai/` 폴더에 구현한다. `data/pipeline/analyze_place_emotion.py`는 이 함수를 import해서 쓰는 구조로 간다
- **이유**: (1) `server-back`↔`server`, `client-front`↔`client`처럼 파트별 폴더 구조 관례에 맞춤 (`ai` 브랜치가 이미 존재). (2) AI 모델 SDK 의존성을 데이터 파트 `requirements.txt`와 분리. (3) 방문 로그 실시간 감성태그 분석(`log_emotion_tag`) 등 다른 곳에서도 재사용 가능하도록 독립시킴. (4) 김지광의 잦은 프롬프트 수정이 `data` 브랜치와 충돌하지 않도록 경계 분리
- **영향**: 김지광이 `ai/` 폴더에 `analyze_image` 구현. `analyze_place_emotion.py`의 `stub_analyzer`를 실제 import로 교체만 하면 됨 (인터페이스는 이미 확정돼 있어 전환 비용 적음)

---

## 2026-08-02 | 음식점 tel 보완 API: 카카오 로컬 API → Google Places API 전환

- **결정**: 음식점(TourAPI 39) tel 보완에 쓰던 카카오 로컬 API(`fetch_kakao_tel.py`)를 Google Places API(`fetch_restaurant_tel.py`)로 교체한다. 2026-07-17 결정("음식점 보완 방식: 카카오 로컬 API로 전화번호만 보완")을 대체함
- **이유**: 김지광이 `ai/feat/semantic-vector` 작업 중 Google 쪽으로 통일해 구현. 매칭 로직(반경 300m, 이름 포함 관계 검증)은 기존 카카오 버전과 동일하게 유지됨
- **영향**: `data/pipeline/config.py`의 `KakaoConfig`/`get_kakao_config`를 `GoogleConfig`/`get_google_config`로 교체, `.env`는 `KAKAO_REST_API_KEY` 대신 `GOOGLE_MAPS_API_KEY` 필요. 기존 카카오 결과(`raw/kakao/restaurant_tel.json`, 28/33건 매칭)는 더 이상 쓰이지 않고 `raw/tel/restaurant_tel.json`로 재수집 필요. `GOOGLE_MAPS_API_KEY` 발급/공유 필요 (담당: 김지광)

---

## 2026-08-02 | 음식점 tel Google Places API 재적재 완료, 예미정 1건 수동 보정

- **결정**: `GOOGLE_MAPS_API_KEY` 발급받아 `fetch_restaurant_tel.py` 실행, Supabase에 재적재 완료 (26/33건 매칭). 기존 카카오 결과(28/33건)와 스팟체크 비교한 결과 겹치는 22건 중 5건 전화번호 불일치 발견 — 웹 검색으로 4곳 확인해 구글 2건(헛제사밥까치구멍집, 맘모스베이커리) 정답, 카카오 1건(밀레니엄안동찜닭) 정답 확인. 예미정은 카카오/구글 둘 다 오답이라 `054-822-0500`(예미정 본채, 주소로 확인)으로 수동 수정
- **이유**: provider 전환 후 실제 매칭 품질이 기존과 비슷한 수준인지 확인 필요했음. 예미정처럼 지점이 여러 개인 곳은 반경 300m 키워드 검색 방식(카카오/구글 공통 로직) 자체의 한계로 오매칭 발생 확인
- **영향**: `data/raw/tel/restaurant_tel.json`의 `2671162`(예미정) 항목만 수동 수정 후 `load_places.py` 재실행, Supabase `place.tel` 반영 완료. 반경 검색 로직 자체를 개선하지 않는 한 지점 많은 장소는 앞으로도 수동 확인 필요할 수 있음

---

## 2026-08-02 | 감성태그 분석 AI 연동: ai/semantic_vector 재사용

- **결정**: `data/pipeline/analyze_place_emotion.py`의 `stub_analyzer`를 `ai/semantic_vector`의 GPT Vision 분석(`analyze_image_with_vision`, 35개 세부 태그) → `calculate_major_scores`(7개 대분류 평균) 조합으로 교체
- **이유**: `ai/semantic_vector`의 `MAJOR_TAG_ORDER`(relaxing/lively/romantic/local/photogenic/traditional/modern)가 `analyze_place_emotion.py`의 `EMOTION_TAGS`와 정확히 일치하고, 35개 세부 태그 판단 기준도 `ssot.md` 감성태그셋의 "AI 판단 기준 5가지"와 대응됨. 김지광이 이 파이프라인을 감성태그 분석용으로 확인
- **영향**: `data/.venv`에 `openai`, `pydantic`, `pydantic-settings`, `qdrant-client` 추가 설치 필요 (semantic_vector 패키지 `__init__.py`가 `analyzer.py`를 미리 import해서 Qdrant 미사용에도 `qdrant-client` 필요). `data/requirements.txt`엔 반영 안 함 (AI SDK 의존성 분리 원칙 유지, 2026-07-23 결정 참고). `OPENAI_API_KEY`/`QDRANT_URL` 발급 후 `python -m pipeline.analyze_place_emotion` 실행 가능 — 아직 실제 키로 실행/검증은 안 함

---

## 2026-08-03 | 사진 없는 장소 보완: Google Places 사진은 백엔드 프록시 경유 필요

- **결정**: 사진이 전무한 18개 장소(관광지 5, 식당 10, 카페 1, 액티비티 1, 문화공간 1)를 Google Places API로 보완하기로 하되, Google Photo API URL을 `place_image.img_url`에 직접 저장하지 않는다. 백엔드가 프록시 엔드포인트를 제공하면(서버가 서버사이드로 API 키를 붙여 Google에 요청 후 중계), 데이터 파트는 그 이후에 실제 보완 작업을 진행한다
- **이유**: Google Photo API는 사진 URL 자체에 `key=API_KEY` 쿼리 파라미터가 필요해서, URL을 그대로 DB/앱에 노출하면 API 키가 그대로 유출됨. TourAPI 이미지(`tong.visitkorea.or.kr`)는 키 없는 공개 URL이라 문제없었지만 Google은 구조가 다름. 키 제한(HTTP 리퍼러/IP)만으로는 완전한 보호가 안 돼서 프록시가 더 안전한 방식으로 판단
- **영향**: 백엔드(설만수)가 이미지 프록시 엔드포인트 구현 필요 (`/uploads/presigned-url`와 유사하게 서버가 외부 API 키를 다루는 패턴). 완료 전까지 데이터 파트의 "사진 없는 18건 보완" 작업은 보류. `place_image` 3장 이상인 159건을 GPT Vision 감성 벡터로 대표 3장 선정하는 작업은 이 이슈와 무관(TourAPI URL만 다루므로) — 다만 이번엔 같이 보류하고 백엔드 작업 완료 후 한 번에 진행하기로 함

---

## 2026-08-06 | 사진 없는 18건 Google Places로 보완, 이미지 프록시 연동

- **결정**: 이미지 프록시(`GET /images/proxy?ref=`) 배포 완료 후, `main_image_url`/`place_image` 둘 다 없던 18개 장소를 Google Places(이름+좌표 매칭)로 보완. `data/pipeline/place_photo_enrichment.py`, `fetch_place_photos.py` 신규 작성 — 매칭 성공 시 `photo_reference` 최대 5장을 `{PROXY_BASE_URL}/images/proxy?ref={photo_reference}` 형태로 변환해 저장 (Google 원본 URL/키는 저장하지 않음)
- **이유**: Google Photo API 원본 URL은 키가 노출돼서 직접 저장 불가 (2026-08-03 결정). 프록시 완성 후 그 방식을 따름
- **영향**: 15/18건 매칭 성공 (안동한우갈비, 위생찜닭, 안동시 월령빠지 3건은 구글에도 없음 — 저작권 문제로 리뷰 사이트 사진도 안 씀, 보류). `data/pipeline/config.py`에 `get_image_proxy_base_url()` 추가, `data/.env`에 `IMAGE_PROXY_BASE_URL` 필요. 참고: Render 무료 플랜이라 비활성 시 슬립되어 첫 요청 50~100초 걸릴 수 있음 (스크립트 타임아웃 넉넉히 설정)

---

## 2026-08-08 | 음식점/카페 대표이미지: 음식 사진 대신 내부/외부 사진 사용

- **결정**: `place.main_image_url`(스와이프·썸네일에 노출되는 대표이미지)은 음식점/카페 카테고리에서 음식 사진을 쓰지 않고 내부 또는 외부 사진으로 고정한다. 식당/카페 전체 32곳을 전수 검토해 음식 사진이던 7곳(신라국밥, 묵향, 하회 솔밭식당, 김정순명인의집, 안동 유진찜닭, 황소곳간, 농가맛집 뜰)을 내부/외부 사진으로 교체, 이미 조건을 만족하던 9곳도 더 나은 후보로 교체(경상도추어탕, 밀레니엄안동찜닭, 브레드 79, 원조안동찜닭 본점, 일직식당, 중앙찜닭, 카페뒤뜰, 폴모스트, 월영당)
- **이유**: 음식 사진만으로는 장소의 분위기(감성태그 기반 추천의 핵심)를 파악할 수 없음
- **영향**: `place_image`에 있던 후보 사진과 대표이미지가 자리를 맞바꾼 경우가 있어 순서(`sort_order`)가 일부 뒤섞임(교체된 옛 대표이미지는 `sort_order=99`로 맨 뒤에 재배치됨, 기능상 문제 없음). 향후 신규 장소 적재 시에도 이 기준(대표이미지는 음식 사진 지양)을 적용해야 함 — `load_places.py`나 이미지 보완 스크립트에 자동화된 검증 로직은 없고 현재는 수동 검토로만 확인됨

---

## 2026-08-10 | 영업시간: place_hours 테이블 신설, 브레이크타임은 미반영

- **결정**: Google Places `opening_hours.periods` 기반으로 `place_hours` 테이블을 신설(`schema.sql`/`schema.dbml` 반영, Supabase 적용 완료), 기존에 수집해둔 174건 중 70건 매칭 데이터를 `load_place_hours.py`로 적재(70개 장소, 415행). 요일별(0=일~6=토) 오픈~마감 시각만 저장하고, 브레이크타임(휴게시간)은 반영하지 않음
- **이유**: 코스 추천 시 영업시간 고려가 필요하다는 요구사항 있었음. 다만 사전 조사 결과(2026-08-04) TourAPI·Google 둘 다 브레이크타임 데이터가 거의 없음(174건 중 "휴게시간" 명시 2건뿐, 그나마 식당은 0건) 확인 → 오픈~마감만 반영하는 것으로 스코프 축소. 네이버지도 크롤링도 검토했으나 (1) 이용약관상 자동화 수집 자체가 금지 대상이고 비상업적 목적이 면제 사유가 아님 (2) 브레이크타임은 네이버도 사장님이 직접 입력하는 정보라 소스만 바뀔 뿐 채워져 있을 가능성이 낮아 보류
- **영향**: `place` 테이블에 컬럼 추가하는 대신 별도 테이블로 분리(요일별 여러 구간 지원 위함, 52건이 요일/계절별로 시간이 달라 단순 컬럼 2개로는 표현 불가했음). 나머지 104건(174건 중 미매칭)은 아직 비어있음 — 필요시 추가 매칭 시도 가능. 코스 추천 알고리즘에서 이 테이블을 실제로 참조하는 로직은 아직 없음(김지광 담당, 알고리즘 방향 자체가 미확정)

---

## 2026-08-10 | 종료된 축제 5건 DB 삭제

- **결정**: `event_end_date`가 지난 축제행사 5건(경북 K-스토리 페스티벌, 동아시아문화도시 안동, 안동 수(水)페스타, 안동벚꽃축제, 차전장군 노국공주축제)을 `place` 테이블에서 완전 삭제
- **이유**: `ssot.md` 기능 스펙상 "행사·축제는 사용자의 여행 예정일과 기간이 일치할 때만 노출"이 원칙이라, 이미 끝난 축제는 서비스에서 노출될 일이 없어 데이터로 남겨둘 실익이 없음
- **영향**: 삭제 전 `place_image`(24건, CASCADE로 함께 삭제됨) 외 찜/코스/방문기록 등 연결된 사용자 데이터 없음 확인 후 진행. 남은 축제 3건(안동 국가유산 야행, 안동국제탈춤페스티벌, 세계유산축전)은 진행중이거나 예정이라 유지. 앞으로도 축제 데이터는 종료되면 주기적으로 정리 필요 — 현재는 자동화된 배치 없이 수동 확인 후 삭제

---

## 2026-08-10 | 감성태그 분석 배치 첫 실행 및 파이프라인 버그 수정

- **결정**: `analyze_place_emotion.py`를 181건(사진 있는 장소) 대상으로 첫 실행, 167건 완료(태그 270개). 실행 중 발견한 트랜잭션 버그를 수정 — 기존엔 전체를 하나의 커넥션/트랜잭션으로 묶어서 마지막 한 곳이라도 실패하면 이미 처리한 것까지 전부 롤백됐음. 장소별로 커넥션을 분리해 즉시 커밋하고, 한 곳 실패해도 나머지는 계속 진행하도록 변경. `fetch_unanalyzed_places`도 개선 — `main_image_url`이 없어도 `place_image` 후보가 있으면(부용대 등) 폴백해서 분석 대상에 포함
- **이유**: 외부 이미지 소스(TourAPI 원본, 우리 이미지 프록시 둘 다) 타임아웃이 배치 중 종종 발생하는데, 트랜잭션이 통짜라 재실행할 때마다 처음부터 다시 돌아야 했음. Render 무료 플랜은 비활성 시 슬립되어 첫 요청이 오래 걸리는 것도 실패 빈도를 높이는 요인
- **영향**: 태그 분포가 심하게 쏠림 확인 (relaxing 135곳, traditional 91곳 vs romantic 5곳, lively 6곳 등). 현재 threshold(0.5)는 애초에 온보딩 레이더 차트 UI의 중립 기준선(2026-06-29 결정)에서 가져다 쓴 값이라 감성태그 판단 기준으로 검증된 적이 없었음 — 김지광에게 분포 공유하고 threshold 조정 여부 확인 요청함, 결론 날 때까지 재분석은 보류. 태그가 하나도 안 붙는 14곳(7개 태그 전부 threshold 미만)은 재실행할 때마다 계속 재분석 대상으로 잡히는 한계가 여전히 남아있음 (`place.emotion_analyzed_at` 같은 컬럼 추가가 근본 해결책, 아직 미착수)

---

## 2026-08-10 | 사진 끝내 못 채운 3건 DB 삭제

- **결정**: Google Places로도 매칭 안 돼 사진이 전무했던 3건(안동한우갈비, 위생찜닭, 안동시 월령빠지)을 `place`에서 완전 삭제
- **이유**: 저작권 불명확한 외부(리뷰 사이트) 사진을 가져다 쓰지 않기로 한 바 있어 (2026-08-06) 사진 확보 방법이 소진됨. 사진 없는 장소는 온보딩 카드/장소 탐색 등 사진 기반 기능에서 계속 예외 처리가 필요해 데이터로 남겨둘 실익이 크지 않다고 판단
- **영향**: 전체 장소 190건 → 187건, 사진 보유율 100% 달성. 삭제 전 연결된 `place_image`/`place_emotion_tag`/찜/코스/방문기록/영업시간 데이터 없음 확인 후 진행

---

## 2026-08-21 | 영업시간 TourAPI 텍스트 추가 파싱 (61건)

- **결정**: `place_hours`에 Google 매칭분(70건)에 더해, TourAPI 원문 텍스트 중 "상시개방"(38건)과 단순 단일 시간대(23건, 정규식 1개만 매칭되고 40자 미만인 경우) 총 61건을 추가로 파싱해 적재. 요일/계절별로 갈리는 복잡한 텍스트(33건)와 TourAPI에도 데이터 자체가 없는 곳(18건)은 자동 파싱 대상에서 제외
- **이유**: 자동 파싱 가능한 두 유형만 안전하게 골라서 커버리지를 늘림 (70→131건, 182건 중 72%). 복잡한 텍스트는 잘못 파싱할 위험이 커서 제외
- **영향**: `data/pipeline/load_tourapi_hours.py` 신규. 남은 51건(복잡 33 + 데이터없음 18)은 수동 확인 전까지는 영업시간 정보 없는 상태로 유지됨

---

## 2026-08-21 | place_emotion_tag 시드 데이터 삭제, 테이블/서비스 로직은 유지

- **결정**: `analyze_place_emotion.py`로 적재했던 초기 시드 데이터(167곳, 270개 태그 행)를 삭제. `place_emotion_tag` 테이블 자체와 백엔드 서비스 로직(`VisitLogService`의 방문 기록 삭제 시 count 증감 처리)은 그대로 유지
- **이유**: 김지광이 새로 만든 `place_semantic_vector`(PR #20, `feat/semantic-vector`→`ai`)가 이미 182곳 전체를 사진 3장·검증된 프롬프트(`semantic-image-v4.1`)로 분석해 공용 Supabase에 적재 완료함 — 기존에 우리가 사진 1장·검증 안 된 threshold(0.5)로 만든 시드값보다 훨씬 신뢰도 높은 "AI 판단 기준선" 역할을 이미 대체함. 다만 `place_emotion_tag`는 `ssot.md` 방문 기록 스펙("업로드된 사진은 AI가 분석 → 장소 분위기 데이터 보강")대로 **실제 방문 로그가 쌓이며 누적되는 카운트 테이블**로 설계돼 있고, 이미 `VisitLogService.delete()`에 태그 count 증감 로직이 구현돼 있어 백엔드가 실사용 중인 구조 — `place_semantic_vector`(정적 raw score, 장소당 1행)로 완전히 대체할 수 있는 게 아니라 서로 다른 목적(공식 사진 기반 기준선 vs 방문자 누적 신호)의 상호보완 관계로 판단
- **영향**: `place_emotion_tag`는 이제 실제 방문 기록이 쌓이기 전까지 정상적으로 비어있는 상태 (0행). `place_semantic_vector`의 점수에 threshold를 다시 적용해 재시딩하지 않기로 함 — 근거 없는 threshold 자르기를 반복하는 것이고, 애초에 "AI 의견"과 "방문자 수 집계"는 의미가 다름. 코스 추천/장소 상세 등에서 두 신호(`place_semantic_vector`=기준선, `place_emotion_tag`=누적 신호)를 어떻게 함께 쓸지는 알고리즘 설계 영역이라 별도 논의 필요 (김지광/설만수 확인 대기)
---

## 2026-08-26 | 구글 로그인: code 교환 → ID 토큰 검증 방식으로 전환

- **결정**: 구글 로그인을 기존 `expo-auth-session` 브라우저 리다이렉트(인가 코드 → 서버가 client_secret으로 token 교환) 방식에서, 네이티브 Google Sign-In(Play Services) + ID 토큰 검증 방식으로 전환. Google Cloud Console에 클라이언트 2개 생성: **Web 애플리케이션**(client_secret 보유, 실제 로그인엔 안 쓰이고 ID 토큰의 audience 지정용 "서버 클라이언트 ID" 역할만 함) + **Android**(패키지명 `com.dongle.app` + 디버그 SHA-1, 네이티브 로그인 실행 주체). 카카오는 기존 인가 코드 방식 그대로 유지 — 이 결정은 구글에만 해당.
- **이유**: `expo-auth-session`이 쓰는 `dongle://` 커스텀 스킴 리다이렉트를 Google이 Web 애플리케이션 유형에서 거부함("잘못된 리디렉션: 도메인이 포함되어야 합니다" — 실제 콘솔에서 확인). 커스텀 스킴을 살리려면 백엔드에 HTTPS 중계 엔드포인트 + Universal Link/App Link 네이티브 설정까지 필요해 우회 비용이 컸음. 반면 네이티브 Google Sign-In + "두 클라이언트" 패턴(Android로 로그인 실행, Web 클라이언트 ID를 audience로 지정)은 Google 공식 권장 패턴이고 리다이렉트 URI 개념 자체가 없어 이 문제가 근본적으로 발생하지 않음.
- **영향**:
  - 서버: `GoogleOAuthClient.kt`가 code→token 교환(`client_secret` 사용)에서 ID 토큰 서명·발급자·audience 검증으로 완전히 교체됨. `jjwt`(기존 자체 JWT 발급에 이미 쓰던 라이브러리)로 구글 JWKS(`https://www.googleapis.com/oauth2/v3/certs`, 1시간 캐시)를 직접 검증 — Google 공식 클라이언트 라이브러리 추가 없이 구현. `POST /auth/oauth/google` 요청 바디가 `{code}`에서 `{id_token}`으로 변경(`GoogleOAuthRequest`, `api_1.3.1v.yaml` 반영 완료). `GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`는 이제 실제로 안 쓰이지만 Web 클라이언트 생성 시 콘솔이 요구해서 등록해둔 값이라 `.env` 필드는 유지.
  - 클라이언트: `expo-auth-session`의 구글 부분을 네이티브 Google Sign-In 라이브러리(`@react-native-google-signin/google-signin` 등)로 교체 필요. `app.json`에 `android.package: "com.dongle.app"` 반영 완료(`feat/google-oauth-android-package`). **2026-08-30 완료 확인** — `LoginScreen.tsx`/`oauthConfig.ts`가 `GoogleSignin.hasPlayServices()` → `GoogleSignin.signIn()` → `idToken`을 `POST /auth/oauth/google`에 `{id_token}`으로 전달하는 흐름으로 이미 전환되어 있음(커밋 `71f7983`). 이 라이브러리는 네이티브 모듈이라 Expo Go로 테스트 불가, `expo-dev-client` + 실제 Android 빌드 필요 — 실기기 E2E 검증은 아직 남음(사용자 확인 예정).
  - 카카오 로그인 코드(`KakaoOAuthClient.kt`, `client-front`의 카카오 부분)는 이번 변경과 무관, 그대로 유지.

---

## 2026-08-27 | 카카오 로그인 Redirect URI: 백엔드 HTTPS 중계 엔드포인트 신설

- **결정**: 카카오 개발자 콘솔의 "카카오 로그인 리다이렉트 URI"에 앱의 커스텀 스킴(`dongle://`)을 직접 등록할 수 없어서(콘솔이 "유효하지 않은 URL"로 거부, 실제 확인함), 백엔드에 `GET /auth/kakao/callback` HTTPS 엔드포인트를 신설해 카카오 콘솔엔 이 주소(`https://dong-gle.onrender.com/auth/kakao/callback`)를 등록한다. 이 엔드포인트는 실제 로그인 처리를 하지 않고, 카카오가 붙여준 쿼리스트링(code/error)을 그대로 유지한 채 앱의 커스텀 스킴(`dongle://redirect`)으로 302 리다이렉트만 해주는 순수 중계 역할만 한다.
- **이유**: 구글 Web 애플리케이션 클라이언트와 동일한 문제(2026-08-26 결정 참고) — OAuth 제공자들이 브라우저 리다이렉트 흐름에선 커스텀 스킴 대신 http(s) URL을 요구하는 경우가 많음. 구글은 네이티브 SDK로 전환해 이 문제를 근본적으로 피했지만, 카카오는 기존 `expo-auth-session` 브라우저 흐름을 그대로 유지하기로 했으므로(스코프상 네이티브 카카오 SDK 도입은 보류) HTTPS 중계가 더 적은 비용의 해결책. 참고로 `dongle://`(경로 없이 authority가 완전히 빈 형태)는 카카오 콘솔뿐 아니라 `java.net.URI.create()`도 `IllegalArgumentException`으로 거부함을 실제 테스트로 확인 — 그래서 `dongle://redirect`처럼 경로 세그먼트를 하나 붙인 형태를 리다이렉트 대상으로 확정.
- **영향**: `AuthController.kt`에 `kakaoRedirectRelay` 추가, `SecurityConfig`의 `permitAllPaths`에 등록(비인증 허용 필수 — 카카오가 리다이렉트로 호출하므로 JWT가 있을 수 없음). `KAKAO_REDIRECT_URI` 값은 이제 이 중계 엔드포인트 주소로 고정(`.env.example` 반영). `client-front`가 `expo-auth-session`의 `useAuthRequest`/`promptAsync` 기본 흐름을 그대로 쓰면 `redirect_uri`(카카오에 보내는 값)와 `WebBrowser`가 감지하는 `returnUrl`이 항상 같은 값으로 강제되므로, 카카오에는 이 HTTPS 주소를 보내면서 앱은 `dongle://redirect`를 기다리는 두 값을 분리하려면 `useAuthRequest` 대신 `WebBrowser.openAuthSessionAsync`를 직접 호출하는 방식으로 바꿔야 함. **2026-08-30 완료 확인** — `LoginScreen.tsx`의 `promptKakaoLoginAsync`가 정확히 이 방식(`WebBrowser.openAuthSessionAsync(authUrl, kakaoAppReturnUrl)`로 두 URL 분리)으로 구현되어 있음(커밋 `a21dcf5`). 실기기 E2E 검증은 아직 남음(사용자 확인 예정).

---

## 2026-08-30 | 방문 기록 작성: AI 태그 부여 제외하고 우선 구현

- **결정**: `POST /places/{placeId}/logs`(여행 기록 작성)를 AI 감성 태그 자동 부여(`log_emotion_tag`/`place_emotion_tag` 갱신) 없이 우선 구현. 기록 생성/저장, `place.visit_log_count` +1은 정상 동작하고, 응답의 `tags`는 AI 연동 전까지 항상 빈 배열.
- **이유**: `dev`/`ai` 브랜치를 다시 확인한 결과, 감성태그 분석 함수(`ai/semantic_vector.analyze_place`)는 순수 파이썬 함수일 뿐 백엔드가 호출할 수 있는 HTTP 서비스가 전혀 없음(`ai/course_optimizer`와 동일 상황, FastAPI 등 서버 레이어 없음). `place_emotion_tag`를 "AI 연동 방식이 정해질 때까지 어떻게 함께 쓸지는 별도 논의 필요"로 미뤄둔 2026-08-21 결정도 여전히 미해결 상태. 즉 이건 팀 의사결정 대기가 아니라 호출할 인프라 자체의 부재라서, 그 부분만 비워두고 나머지를 먼저 구현하는 게 합리적이라고 판단.
- **영향**: `VisitLogCreateRequest`, `VisitLogService.create()`, `VisitLogController`의 `POST /places/{placeId}/logs` 추가. `api_1.3.1v.yaml`에 AI 미연동 상태 명시. 나중에 AI 연동 방식이 정해지면 `VisitLogService.create()`에 태그 부여 로직만 추가하면 됨 — 지금 만든 구조를 버릴 필요 없음.
- **정정 (2026-08-30 늦은 시각)**: 위 "이유"에서 "`ai/course_optimizer`와 동일 상황(HTTP 서버 없음)"이라고 쓴 부분은 이 결정 직후 `dev`에 병합된 `ai/api/app.py`(FastAPI, PR #25 포함분)로 인해 틀린 비교가 됨 — `course_optimizer`는 이제 `POST /v1/courses/optimize`로 HTTP 노출됨. 다만 결론 자체(사진 기반 감성태그 자동분석, 즉 `ai/semantic_vector`의 `analyze_image_with_vision`)는 여전히 어떤 HTTP 엔드포인트로도 노출되지 않았음을 재확인함 — `ai/api/app.py`는 `place_recommender`/`course_optimizer`만 감싸고 `semantic_vector`는 다루지 않음. 그래서 이 결정의 실질적 결론(방문 기록 AI 태그 부여 보류)은 그대로 유효.

---

<!-- 결정되면 아래 양식으로 추가 -->
<!--
## YYYY-MM-DD | 제목

- **결정**: 
- **이유**: 
- **영향**: 
-->

## 2026-08-21 | place_semantic_vector를 schema.sql/schema.dbml에 반영

- **결정**: `feat/semantic-vector`(PR #20)가 `data/migrations/001_place_semantic_vector.sql`로 따로 관리하던 `place_semantic_vector` 테이블을 `schema.sql`/`schema.dbml`에 반영. 실제 Supabase 컬럼 구조와 대조해 일치 확인. `place_emotion_tag` 관련 주석도 새 역할(방문 로그 누적 전용)에 맞게 갱신
- **이유**: `schema.sql`이 스키마 기준(SSOT)이라는 팀 원칙(2026-07-17)에 따름 — 별도 마이그레이션 파일로 관리하면 실제 DB 상태와 문서가 어긋날 수 있음(이번에도 테이블이 이미 Supabase엔 있는데 schema.sql엔 없는 상태였음)
- **영향**: PR #20 리뷰 코멘트로 이 방식 통일을 요청함. `data/migrations/` 폴더 자체를 없앨지는 PR #20 머지 시 같이 정리 필요

---

## 2026-08-24 | place_hours: "매일 24시간 운영" 파싱 버그 수정

- **결정**: `load_place_hours.py`가 Google Places의 "매일 24시간 운영" 특수 표현(`periods`가 `{"open": {"day": 0, "time": "0000"}}` 하나뿐이고 `close` 없음)을 "일요일만 00:00에 열고 안 닫음"으로 잘못 저장하던 버그 수정. 이제 이 패턴을 감지하면 7일 전체에 대해 `open_time=00:00, close_time=NULL`로 확장 저장
- **이유**: 실제로 8곳(부용대, 월영교, 신세동 벽화마을 등 주로 야외 유적지·공원류)이 이 형식으로 응답받았는데, 그대로 저장하면 "월~토는 영업시간 정보 없음"으로 잘못 해석될 수 있었음
- **영향**: 기존 잘못 저장된 8곳의 행 삭제 후 재적재, 정상적으로 7일 전체 커버됨 확인. `place_hours` 전체 보유 장소 수는 131건으로 동일 유지(버그 있던 8곳이 빠졌다 다시 정상 채워짐)

---

## 2026-08-28 | data/migrations 폴더 삭제, schema.sql로 완전 통일

- **결정**: `data/migrations/001_place_semantic_vector.sql` 삭제. `place_semantic_vector` 정의는 이미 `schema.sql`/`schema.dbml`에 있고(2026-08-21), 컬럼/인덱스가 완전히 동일한 것 확인 후 진행. `data/README.md`의 마이그레이션 참조도 `schema.sql`/`schema.dbml` 참조로 갱신
- **이유**: `ai` 브랜치가 PR #25로 `dev`에 정상 병합된 뒤에도 이 파일이 남아있어서, 같은 테이블이 두 곳(schema.sql, migrations 파일)에 중복 정의된 상태였음. 방치하면 한쪽만 컬럼이 추가되는 식으로 나중에 어긋날 위험이 있어 SSOT 하나로 통일
- **영향**: `ai/semantic_vector/semantic_ai.md`(AI 파트 문서)에도 이 마이그레이션 파일에 대한 참조가 남아있는데, 이건 AI 파트 소관이라 직접 수정하지 않음 — 필요시 해당 파트에서 정리 요청

---

## 2026-08-30 | feat/visit-log-create, feat/google-oauth-android-package → server/client/dev 통합 완료

- **결정**: 두 미머지 브랜치를 각각 파트 브랜치에 머지 후 `dev`까지 반영. `feat/visit-log-create`(방문 기록 작성 API) → `server` → `dev`, `feat/google-oauth-android-package`(구글 네이티브 로그인 + 카카오 redirect 분리) → `client` → `dev`. 머지 전후 모두 충돌 없음 재확인, 서버는 `./gradlew clean test` 전체 통과, 클라이언트는 `tsc --noEmit` 통과 확인 후 push
- **이유**: 지난 세션에 이미 충돌 없음을 확인해뒀던 항목이지만, 그 사이 `ai` 브랜치가 PR #25로 대량 병합돼 `dev`가 29커밋 뒤처져 있었음 — 재검증 후 안전하게 진행
- **영향**: 없음(순수 머지, 신규 로직 추가 없음). 참고로 구글 로그인 실제 E2E 테스트는 여전히 미검증 상태로 남아있음(에뮬레이터 이슈, 사용자가 실기기로 추후 확인 예정)

---

## 2026-08-30 | feat/course-optimizer-client 경로 수정 후 server/dev 병합 완료

- **결정**: `feat/course-optimizer-client`(`cad5f41`, 8/26 작업)가 실제로는 `server`/`dev`에 미병합 상태였음을 발견(지난 세션 메모엔 "이미 병합 완료"로 잘못 남아있었음, 착오 원인 불명). `CourseOptimizerClient.OPTIMIZE_PATH`를 당시 placeholder였던 `"/optimize"`에서 실제 `ai/api/app.py` 라우트인 `"/v1/courses/optimize"`로 수정 후 `server` → `dev` 순으로 병합
- **이유**: DTO 필드(`TripInput`/`CourseOptimizationResult` 등)는 `ai/course_optimizer/models.py`와 이미 정확히 일치했고, 경로만 당시 미배포라 확인 불가능했던 부분 — 이번에 `ai/api/app.py` 실체를 확인했으니 바로 고쳐서 병합 가능한 상태였음
- **영향**: `CourseOptimizerClient`/`CourseOptimizerClientTest`의 경로 문자열만 수정, DTO 변경 없음. `./gradlew clean test` 실행 시 무관한 `ImageProxyApiIntegrationTest` 3건이 공용 Supabase pooler 커넥션 경합으로 간헐적 실패(격리 실행 시 통과 확인, 기존부터 있던 인프라 플레이크로 판단, 이 변경과 무관). `CourseOptimizerClientTest`는 MockRestServiceServer 기반이라 항상 통과 확인. **여전히 남은 것**: `TransportMode`(walk/transit/car) ↔ `api_1.3.1v.yaml`의 `CourseGenerateRequest.transport`(car/walk/public) 값 불일치 매핑, 실제 `/courses/generate` 엔드포인트에서 이 클라이언트를 호출하는 연동 코드는 아직 없음(클라이언트만 존재)

---

## 2026-08-30 | 발견: ai/place_recommender 신규 — 스와이프 후보 추천 랭킹 알고리즘 확보

- **결정**: 별도 결정 사항은 아니고 현황 기록. 김지광이 `d18f50d`(8/25, PR #25에 포함)로 `ai/place_recommender`를 구현 완료한 것을 이번에 재확인함 — 사용자 취향 벡터 → Qdrant 유사도 검색(`semantic_vector.qdrant_repository`) → `place.hidden_score`(기존 스키마 컬럼, 숨은명소 점수) 결합 → Top-N 랭킹. `ai/api/app.py`가 `POST /v1/places/recommend`로 HTTP 노출함
- **이유**: 스프린트3 milestone에 남아있던 "`/swipe/candidates` 등은 추천 랭킹 알고리즘 자체가 미설계"라는 전제가 더 이상 사실이 아님 — 랭킹 알고리즘은 이제 존재함. 다만 스와이프 세션(발급/저장/만료/진행상태) 자체를 저장할 DB 테이블은 `schema.sql`에 여전히 없고, `/swipe/candidates`·`/swipe/sessions/{id}`·`/swipe/sessions/{id}/results` 백엔드 구현도 미착수 — 이 부분은 순수 백엔드 스코프라 팀 확인 없이 설계 가능
- **영향**: `docs/milestone.md`의 관련 항목 갱신 필요(다음 커밋에서 반영 예정). 백엔드 다음 작업 후보로 등록: 스와이프 세션 테이블 설계 + 위 3개 엔드포인트 구현, `ai/api`의 `/v1/places/recommend` 호출 연동

---

## 2026-08-30 | 스와이프 세션 백엔드 구현 (`/swipe/candidates`, `/swipe/sessions/{id}`, `/swipe/sessions/{id}/results`)

- **결정**: `ai/place_recommender`(취향 벡터 기반 Qdrant 유사도 + `place.hidden_score` 결합 랭킹, `POST /v1/places/recommend`)를 호출해 후보를 고르고, 그 진행 상태를 저장하는 `swipe_session`/`swipe_session_candidate` 테이블을 신설해 스와이프 세션 3개 엔드포인트를 구현. `api_1.3.1v.yaml`에 이미 있던 스펙(세션 24시간 유효, `SwipeCandidatesRequest`/`SwipeSessionDetail`/`SwipeResultRequest` 스키마)을 그대로 따름. 아래는 스펙에 명시 안 돼 있어 구현하며 정한 세부 값들:
  - 세션당 후보 카드 수: 20장 고정(`SWIPE_CANDIDATE_COUNT`). `preferred_categories`가 여러 개면 place_recommender API가 category를 단일 문자열로만 받아서(1개 카테고리씩 나눠 호출 후 점수순 병합·상한 자르기) 처리
  - `mood_tags` 미입력 + 미온보딩(=user_preference 빈 상태)이면 7개 태그 전부 0.5(중립)로 채운 취향 벡터로 폴백 — place_recommender의 Pydantic 검증(`require_preference_values`)이 최소 1개 이상의 취향 신호를 요구해서, 완전히 빈 상태로는 호출 자체가 불가능함
  - `mood_tags` 직접 입력 시 해당 태그들에 0.9점 부여(`MOOD_TAG_SCORE`) — "이번 여행에 한해 우선 적용"(api 스펙 문구)을 강한 가중치로 해석
  - 스와이프 결과(like/must/skip)의 `user_preference` 반영은 온보딩 알고리즘(v2.0.0)의 `EmotionVector.applySwipe` 상대적 업데이트 공식을 그대로 재사용(like/must→좋아요 학습률 0.40, skip→싫어요 학습률 0.25). 이 학습률은 온보딩 수렴 알고리즘 전용으로 튜닝된 값이라 스와이프 세션에도 최선인지는 검증 안 됨 — 코드에도 주석으로 명시, 필요시 별도 값으로 분리 가능
- **이유**: 후보 선정 알고리즘(`place_recommender`)은 이미 있고 세션 저장/API 레이어만 없는 상태였음(지난 세션 결론). 위 세부 값들은 팀 확인 없이도 되돌리기 쉬운 순수 백엔드 구현 디테일이라 합리적 기본값으로 우선 구현
- **영향**: `schema.sql`/`schema.dbml`에 `swipe_session`/`swipe_session_candidate` 테이블 추가, 공용 Supabase에도 반영 완료(둘 다 CREATE TABLE만 하는 순수 추가라 기존 데이터 영향 없음). `PlaceService.semanticVectorsByPlaceId`/`displayTags`를 `private`→공개로 변경해 `SwipeService`가 재사용(태그 노출 규칙 중복 방지). `place-recommender` 설정 키(`PLACE_RECOMMENDER_BASE_URL`)를 `course-optimizer`와 별도로 신설 — 실제로는 같은 FastAPI 서비스(`ai/api/app.py`)이므로 배포 시 두 값을 반드시 동일하게 맞춰야 함(당장 하나로 통합하지는 않음, `common/config/PlaceRecommenderProperties.kt` 주석 참고). `/courses/generate`(스와이프 결과로 실제 코스 후보 생성, course_optimizer 연동)는 이번 범위 밖 — 다음 작업 후보

---

## 2026-08-30 | (관찰) `./gradlew test` 전체 스위트 플레이크가 테스트 추가할수록 악화되는 중

- **결정 아님, 현황 기록**: `SwipeApiIntegrationTest` 추가 후 `./gradlew clean test` 전체 실행 시 실패 개수가 회차마다 3~8건으로 늘어남(격리 실행하면 항상 통과). 원인은 기존에 파악한 것과 동일 — 공용 Supabase pooler가 세션 모드 커넥션을 15개로 제한하는데, `application.yml`의 `spring.datasource.hikari.maximum-pool-size: 5`가 테스트에도 그대로 적용되어 커스텀 `@TestConfiguration`을 쓰는 통합 테스트 클래스(현재 `ImageProxyApiIntegrationTest`, `SwipeApiIntegrationTest` — 서로 다른 Spring 컨텍스트를 만듦)가 늘어날수록 한 번의 전체 실행에서 동시에 열리는 커넥션 풀 개수가 늘어나 한도를 넘기기 쉬워짐
- **왜 지금 안 고쳤는지**: `maximum-pool-size: 5`는 `application.yml` 하나로 테스트/운영(Render 배포)이 공유하는 값이라, 테스트 플레이크만 보고 낮추면 운영 동시 커넥션 여유도 함께 줄어듦 — 별도 테스트 프로파일 분리 같은 설계가 필요한 사안이라 이번 스와이프 세션 작업 범위를 벗어난다고 판단
- **영향**: 앞으로 `@TestConfiguration`으로 외부 HTTP를 모킹하는 통합 테스트가 하나씩 늘어날 때마다 이 플레이크가 더 자주 재현될 것으로 예상됨. 근본 해결(테스트 전용 프로파일 + 별도 풀 크기, 또는 Supabase pool_size 자체 상향)은 별도 작업으로 필요

---

## 2026-08-30 | `/courses/generate` 구현 — course_optimizer 연동, 1개 후보로 스코프 축소

- **결정**: 스와이프 세션의 like/must 후보를 `ai/course_optimizer`(`POST /v1/courses/optimize`)에 넘겨 코스를 생성하는 `/courses/generate`를 구현하되, api_1.3.1v.yaml이 기대하는 "최대 3개 후보"가 아니라 **항상 1개만 반환**하도록 스코프를 좁힘(`minItems: 1`이라 스펙 위반은 아님). 코드 조사 결과 아래 두 가지가 course_optimizer 알고리즘 자체의 한계로 확인됨:
  1. `search_optimal_route()`(`ai/course_optimizer/backtracking.py`)가 k(방문 개수)별로 최고점 경로 1개만 유지하고 나머지는 버림 — 평가된 경로들을 따로 안 남겨서 "상위 3개"를 뽑아낼 방법이 지금 코드엔 없음
  2. `CandidatePlace`에 "필수 방문(must)" 플래그 자체가 없음 — 알고리즘이 그냥 주어진 후보 풀에서 점수 최고 조합을 고를 뿐이라, "무조건 포함"을 강제할 방법이 없음
  - 2번은 후보 풀 자체를 스와이프의 like/must 표시 장소로만 좁혀서 근사(시간이 다 들어가면 전부 포함, 부족하면 무엇이 빠질지 보장 못 함)
  - 사용자 출발 위치(origin)를 요청 스펙이 안 받아서, 안동 시내 대표 좌표(36.5684, 128.7294)로 고정 (MVP 근사치, 실제 GPS 연동 전까지)
  - 코스 시간대는 여행일 09:00~21:00로 고정 (스펙에 명시 안 됨, 하루 코스 기준 임의 설정)
  - `candidateId`는 서버에 저장하지 않는 순수 opaque 토큰(UUID) — `POST /courses` 저장 시 `candidateId`가 실제로 조회에 안 쓰이고(요청에 담긴 `places` 배열을 그대로 저장) 무시되는 걸 `CourseService.save()`에서 확인함
  - `totalDurationMin`은 course_optimizer의 실제 값(`selectedRoute.score.totalTravelMinutes`)을 사용하지만, `totalDistanceKm`과 장소별 `distanceFromPrevKm`/`durationFromPrevMin`은 기존 `GET /courses/{courseId}` 패턴과 동일하게 항상 null(구글맵 Directions 연동 전까지 스코프 외)
- **이유**: 3개 후보/must 강제 둘 다 course_optimizer 알고리즘 자체의 확장이 필요한 사안이라 백엔드가 임의로 구현할 수 없음 — 사용자(설만수) 확인 후 "1개 후보 우선 연결, 나머지는 김지광과 별도 논의"로 진행하기로 함
- **영향**: `CourseService.generate()`, `CourseController.generate()`, `CourseGenerateRequest`/`CourseGenerateResponse`/`CourseCandidateResponse` 추가. `SwipeService.likedOrMustCandidates()` 공개 메서드 신설(세션 소유권/만료 검증 + like/must 필터링 재사용). `GlobalExceptionHandler`에 `CourseOptimizerUpstreamException`(502, 그동안 미등록 상태였음)·`NotEnoughSwipeCandidatesException`(400, 신규) 핸들러 추가. `api_1.3.1v.yaml`의 `CourseGenerateResponse.candidates` 설명에 위 제약사항 명시. **김지광에게 요청 필요**: (1) 상위 N개 경로 반환 지원, (2) 필수 방문 장소 강제 포함 지원 — 이 둘이 되면 이 구현의 스코프 제한을 풀 수 있음

---

## 2026-08-30 | 테스트 전용 Hikari 풀 크기 분리로 `./gradlew clean test` 플레이크 해결

- **결정**: 위 "(관찰)" 항목에서 미룬 근본 해결 착수. `server-back/src/test/resources/application-test.yml` 신설(`spring.datasource.hikari.maximum-pool-size: 2`), `build.gradle.kts`의 `Test` 태스크에 `SPRING_PROFILES_ACTIVE=test` 환경변수를 자동 주입해 모든 테스트 JVM에서 이 프로파일이 항상 켜지도록 함(개별 테스트 클래스에 `@ActiveProfiles` 붙일 필요 없음). Spring Boot 프로파일 병합 방식이라 `src/main/resources/application.yml`(운영값 `5`)은 그대로 유지, 테스트만 값이 덮어써짐
- **이유**: `@TestConfiguration`으로 별도 Spring 컨텍스트를 만드는 통합 테스트가 늘어날수록(`ImageProxyApiIntegrationTest`, `SwipeApiIntegrationTest` 등) 컨텍스트마다 자기 Hikari pool이 열려 공용 Supabase pooler 세션 모드 커넥션 한도(15개)를 넘기기 쉬웠음. 컨텍스트 수를 줄이는 방안(테스트 구조 조정)은 이번 스코프에서 제외하고, 컨텍스트당 풀 크기를 최소로 낮추는 쪽을 택함 — 운영 설정에 전혀 영향을 주지 않으면서 가장 빠르게 적용 가능
- **영향**: `./gradlew clean test` 연속 2회 실행 모두 통과 확인(현재 컨텍스트 5개 × 풀 2개 = 최대 동시 커넥션 10개, 한도 15개 대비 여유 있음). 통합 테스트가 더 늘어나 컨텍스트가 6개를 넘으면(풀 2개 기준 총 12개, 7개부터 14개로 한도에 근접) 다시 플레이크가 재현될 수 있음 — 그 시점엔 풀 크기를 더 낮추거나(1개), Supabase `pool_size` 자체 상향, 또는 테스트 컨텍스트 캐시 재사용(공통 `@TestConfiguration` 통합 등)을 재검토 필요

---

## 2026-08-30 | 구글맵 Directions(Routes API) 연동 — `/courses/generate`, `GET /courses/{courseId}` 이동거리/시간/폴리라인 계산

- **결정**: Google **Routes API v2**(`POST https://routes.googleapis.com/directions/v2:computeRoutes`, `X-Goog-Api-Key`/`X-Goog-FieldMask` 헤더 방식)로 코스의 이동거리/시간/폴리라인을 계산하는 `GoogleRoutesClient` 신규 작성, `/courses/generate`와 `GET /courses/{courseId}`(및 `PATCH`) 양쪽에 연결. 레거시 Directions API(`maps.googleapis.com/maps/api/directions/json`)가 아니라 Routes API를 택한 이유는 `ai/course_optimizer/routes_client.py`(김지광)가 이미 내부 이동시간 행렬 계산에 이 API를 쓰고 있어서 — 같은 Google Cloud 프로젝트에서 이미 활성화·검증된 API를 재사용
  - waypoint 순서는 그대로 사용하고 Google에 재최적화(waypoint optimize)를 요청하지 않음 — course_optimizer/사용자가 이미 감성 점수·영업시간 등을 고려해 정한 순서를 순수 거리 기준으로 다시 흔들면 안 되기 때문. 예전 api_1.3.1v.yaml 문구("경유지 최적화 호출 시 사용")와는 의도적으로 다르게 구현
  - 실패해도 코스 자체는 보여줘야 하므로(이동거리/시간은 부가 정보) `GoogleRoutesClient`가 예외를 던지지 않고 항상 null로 폴백. 좌표 없는 장소가 하나라도 섞이면(스키마상 nullable) leg 인덱스가 안 맞아 아예 계산을 건너뜀
  - `course` 테이블에 `transport` 컬럼 신규 추가(nullable, car/walk/public) — 저장된 코스를 조회할 때 어떤 이동수단으로 재계산할지 알아야 하는데 기존엔 저장 시점에 이 값을 받는 필드 자체가 없었음(`CourseManualRequest.transport`가 "구글맵 도입 시 사용 예정, 현재는 저장 안 함" 주석과 함께 이미 존재했고, `CourseSaveRequest`엔 아예 없었음). 둘 다 이번에 실제로 저장하도록 연결, `CourseSaveRequest`에도 옵셔널로 신규 추가(api_1.3.1v.yaml 반영). 값이 없으면(과거 데이터, 미입력) `walk` 기본값으로 계산
  - `/courses/generate`의 `totalDurationMin`은 이제 Directions 실계산값을 우선 사용하고(기존엔 course_optimizer의 `selectedRoute.score.totalTravelMinutes`), Directions 실패 시에만 그 값으로 폴백
- **이유**: 스프린트3부터 "구글맵 Directions 경로 재계산(이동시간/거리/폴리라인)은 스코프 제외, 코드에 TODO"로 미뤄뒀던 항목. 팀 확인 없이 바로 진행 가능한 순수 백엔드 구현 항목이라 착수
- **영향**: `schema.sql`/`schema.dbml`에 `course.transport` 컬럼 추가, 공용 Supabase에도 `ALTER TABLE`로 반영 완료(nullable 추가라 기존 데이터 영향 없음). `CoursePlaceItemResponse.distanceFromPrevKm`/`durationFromPrevMin`, `CourseDetailResponse`/`CourseCandidateResponse`의 `totalDistanceKm`/`totalDurationMin`/`polyline`이 이제 실제 값을 반환(그동안 전부 항상 null이었음). **테스트 작성 중 발견한 별도 버그(중요)**: `RestClient` 타입 빈이 여러 개(course-optimizer/place-recommender/google-routes) 있는 상태에서 `@TestConfiguration` + `@Primary`로 그중 하나만 교체해도, Spring이 "같은 타입이면 @Primary 하나가 전부를 이긴다"는 규칙 때문에 그 테스트 안에서 다른 외부 클라이언트까지 몽땅 그 목(mock)으로 뒤섞여버림 — `CourseGenerateApiIntegrationTest`가 course_optimizer와 google-routes를 동시에 호출하면서 처음 발견됨. `@Qualifier`로 임시 해결을 시도했으나 `NoUniqueBeanDefinitionException`으로 실패, 최종적으로 `CourseOptimizerClient`/`GoogleRoutesClient`를 `@MockitoBean`으로 직접 모킹하는 방식으로 전환해 해결(`CourseGenerateApiIntegrationTest`, `CourseApiIntegrationTest` 갱신). `SwipeApiIntegrationTest`(place_recommender만 단독으로 모킹)는 이 문제에 해당하지 않아 그대로 둠 — 앞으로 **한 테스트에서 외부 RestClient 클라이언트 2개 이상을 모킹해야 하면 반드시 `@MockitoBean`으로 클라이언트 자체를 모킹할 것**, `@Primary` RestClient 교체 방식은 쓰지 말 것

---

## 2026-08-30 | `/onboarding/cards`, `/onboarding/preferences` API 스펙에서 제거 (미사용 확정)

- **결정**: `api_1.3.1v.yaml`에서 `[DEPRECATED 가능성]` 표기돼 있던 `GET /onboarding/cards`, `POST /onboarding/preferences` 두 경로와 이들만 참조하던 `OnboardingPreferenceRequest`/`OnboardingPreferenceResponse` 스키마를 삭제. `OnboardingCard` 스키마는 `GET /onboarding/next`(`OnboardingNextResponse`)가 여전히 참조하므로 유지
- **이유**: `server-back/OnboardingController.kt`에 `/status`, `/next`, `/swipe`, `/complete`, `/reset` 다섯 엔드포인트만 구현돼 있고 `cards`/`preferences`는 컨트롤러에 아예 없음(서비스/레포지토리에도 관련 로직 없음) — 실제로 안 쓰이는 게 코드로 확인됨. `Onboarding Algo.md`(v2.0.0)도 카드 다중 선택 방식을 전혀 언급하지 않고 스와이프 방식만 다룸. `POST /onboarding/complete`가 카드 선택 결과 집계 대신 스와이프 누적 벡터 기준으로 `has_onboarded` 갱신 + `top_tags` 반환까지 이미 같은 역할을 수행 중이라 `/onboarding/preferences`는 완전히 대체된 예전 설계(카드 다중 선택 방식)의 흔적으로 결론
- **영향**: `api_1.3.1v.yaml` 스펙만 정리, 백엔드 코드 변경 없음(애초에 구현이 없었음). YAML 문법 검증(`ruby -ryaml`)만 확인, 버전 헤더(`1.3.1`)는 최근 다른 스펙 변경 커밋들과 동일하게 그대로 유지(변경 이력 섹션에 버전 bump 없이 반영해온 기존 패턴 따름)

---

## 2026-08-30 | `/admin/sync/places` 스펙에 남겨둠 (제거 보류)

- **결정**: `/admin/sync/places`(TourAPI 재동기화 트리거)를 이번엔 스펙에서 제거하지 않고 그대로 둠
- **이유**: "데이터 파트가 DB에 직접 적재"(2026-06-29 결정)와 책임이 겹치는 건 맞지만, 이건 데이터 적재 방식이 아니라 **관리자가 수동으로 재동기화를 트리거하는 운영 기능**이라 성격이 다름 — 공모전 데모/제출 전에 TourAPI 원본이 바뀌었을 때(주소·전화번호 수정 등) 백엔드 쪽에서 대응할 방법이 현재 전혀 없는데, 이 엔드포인트가 유일한 안전장치 역할을 할 수 있음. 다만 응답 스펙의 `deactivated`(비활성화 수)를 실제로 구현하려면 `place` 테이블에 soft-delete 컬럼이 없어 스키마 추가가 필요하고, 정말 이 기능이 필요한지는 데이터 파트(이수연)가 실제 재동기화 운영 계획이 있는지에 달려있어 백엔드 혼자 판단할 사안이 아니라고 재확인함
- **영향**: 스펙/코드 변경 없음. 실제 구현 여부는 데이터 파트에 필요성 확인 후 결정 — 필요 없다고 확정되면 그때 스펙에서 제거

---

## 2026-08-30 | client-front 네이티브 라이브러리 3종 검토: image-picker만 도입, notifications/maps 보류

- **결정**: `expo-image-picker`는 바로 도입해서 방문 기록 작성(`VisitLogCreateScreen`)에 사진 첨부를 연결. `expo-notifications`(푸시 디바이스 토큰)와 `react-native-maps`(지도 핀)는 이번엔 보류
- **이유**: image-picker는 SSOT 기능 스펙("방문 장소에 사진 + 한줄 리뷰 남기기")에 명시된 기능이고, 이미 구글 네이티브 로그인 때문에 `expo-dev-client`로 전환된 상태라 추가 네이티브 복잡도·새 자격증명 없이 바로 붙일 수 있었음. notifications는 서버 쪽 실제 푸시 발송(FCM 연동, `course_reminder` 크론)이 스코프 아웃으로 확정돼 있어(milestone.md 참고) 토큰을 등록해도 아무것도 발송되지 않는 죽은 코드가 될 것이라 보류. maps는 SSOT상 "지도"가 별도 기능 대분류라 가치는 크지만, Android용 Google Maps SDK API 키를 새로 발급·제한 설정해야 해서(서버가 쓰는 Places/Routes 키와는 별개) 마감(9/20)까지 3주 남은 시점에 외부 자격증명 대기가 낄 수 있어 팀 확인 후 별도 진행하기로 함
- **영향**: `client-front/package.json`에 `expo-image-picker` 추가, `app.json` plugins에 한국어 권한 문구로 설정 반영. `VisitLogCreateScreen.tsx`가 사진 선택 → `POST /uploads/presigned-url` → S3 PUT 업로드 → `photo_url`로 기록 생성까지 전체 흐름 연결됨(`photo_url`이 서버 스펙상 옵셔널이라 사진 없이도 기존처럼 작성 가능). `registerDeviceToken`(`user.ts`) API 함수와 `/places/map`(`place.ts`) API 함수는 라이브러리 도입 전이라 만들어만 두고 호출하는 화면은 없음 — 각 라이브러리 도입 결정 시 화면만 추가하면 됨

---

## 2026-08-30 | client-front: 액세스 토큰 자동 갱신 연결

- **결정**: `client-front/src/api/client.ts`의 공통 요청 함수가 인증 요청에서 401을 받으면 `refresh_token`으로 한 번 갱신 후 원요청을 재시도하도록 구현. 갱신까지 실패하면(리프레시 토큰도 만료/무효, 30일) 토큰을 정리하고 `App.tsx`에 등록된 리스너를 통해 로그인 화면으로 돌려보냄
- **이유**: 서버 액세스 토큰 만료가 1시간(`application.yml access-token-expiry-seconds`)인데, 그동안 클라이언트엔 갱신 로직이 전혀 없어서 앱을 1시간 이상 켜두면 이후 모든 API 호출이 그냥 401로 실패하는 상태였음. `tokenStorage.ts`에 `setAccessToken()`이 이미 준비돼 있던 걸 보면 예전에 붙이려다 만 것으로 보여 마무리함
- **영향**: 동시에 여러 요청이 401을 받아도 갱신 호출은 한 번만 나가도록 in-flight promise 공유 처리. `authApi.refresh`(auth.ts)와의 순환 의존을 피하려고 `client.ts` 내부에서 `/auth/refresh`를 fetch로 직접 호출(이 호출 자체는 `auth: false`라 갱신 재시도 로직 대상이 아님). 실기기 E2E 검증 시 1시간 이상 세션 유지 케이스도 같이 확인 필요(사용자 담당)

---

## 2026-08-31 | 카카오/구글 로그인 실기기 E2E 검증 완료 — 버그 1건 발견/수정, 운영 노하우 정리

- **결정**: 안드로이드 실기기(무선 디버깅)로 카카오/구글 로그인을 처음부터 끝까지 검증. 이 과정에서 카카오 OAuth 응답 역직렬화 버그를 발견해 수정하고(`server`), client-front가 실기기에서 백엔드 주소를 못 찾던 문제를 고쳤음(`client`). 둘 다 지금 실기기에서 로그인 성공 확인 완료
- **이유/발견 내용**:
  1. **`client-front` `API_BASE_URL`이 실기기에서 작동 안 함**: `10.0.2.2`(에뮬레이터 전용)/`localhost` 둘 다 실기기에선 연결 자체가 안 됨(`ConnectException` 실제 확인). `EXPO_PUBLIC_API_BASE_URL` env로 덮어쓸 수 있게 고치고, 실기기 테스트 시엔 배포된 Render 백엔드(`https://dong-gle.onrender.com`)를 가리키도록 설정 — 로컬 백엔드를 따로 띄울 필요 없어짐
  2. **카카오 OAuth 진짜 버그 발견**: `KakaoOAuthClient`가 `RestClient.create()`(정적 팩토리)를 직접 썼는데, 이 기본 컨버터는 `application.yml`의 전역 Jackson SNAKE_CASE 설정을 안 물려받음(`CourseOptimizerHttpConfig` 등 기존 외부 클라이언트들이 각자 컨버터를 직접 구성해온 이유와 동일). 카카오 토큰/사용자 응답은 실제로 `access_token`/`kakao_account`/`profile_image_url`처럼 스네이크케이스라 `KakaoTokenResponse.accessToken` 등이 계속 null로 역직렬화되고 있었음 — 카카오 로그인이 이번 세션 전까지 한 번도 실기기로 끝까지 테스트된 적이 없어서 안 걸렸던 버그. `KakaoOAuthHttpConfig`를 신설해 SNAKE_CASE 컨버터를 명시적으로 꽂는 방식으로 수정(`CourseOptimizerHttpConfig`와 동일 패턴)
  3. **디버그 키스토어 SHA-1 확인 시 주의**: 이 프로젝트(Expo bare Android)는 전역 `~/.android/debug.keystore`가 아니라 **`client-front/android/app/debug.keystore`(프로젝트 로컬)**를 쓰도록 `build.gradle`에 명시돼 있음(`storeFile file('debug.keystore')`). 전역 키스토어에서 SHA-1을 뽑아 Google Cloud Console에 등록했다가 완전히 다른 값이라 구글 네이티브 로그인이 `DEVELOPER_ERROR`로 계속 실패했던 사례 있음 — **디버그 SHA-1은 항상 `keytool -list -v -keystore client-front/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`로 뽑을 것**
  4. **구글 OAuth 동의 화면(대상/Audience) 테스트 사용자 등록 필요**: GCP 프로젝트가 "테스트 중" 게시 상태라 "테스트 사용자" 목록에 없는 구글 계정은 SHA-1/webClientId가 전부 맞아도 로그인 자체가 막힘(0명 등록 상태였음). 실기기로 로그인 테스트할 계정은 GCP 콘솔 → 대상(Audience) → 테스트 사용자에 미리 추가해둬야 함
- **영향**: `server-back/src/main/kotlin/com/dongle/server/auth/oauth/KakaoOAuthHttpConfig.kt` 신설, `KakaoOAuthClient` 생성자에 `kakaoOAuthRestClient: RestClient` 주입(`server` 브랜치 배포 완료). `client-front/src/api/config.ts`/`​.env.example`에 `EXPO_PUBLIC_API_BASE_URL` 추가(`client` 브랜치, `dev`엔 아직 미병합). **작업 방식 교훈**: 이번 세션 중 백엔드 코드를 고치려고 같은 작업 디렉토리에서 `git checkout server`를 여러 번 했다가, 그때마다 Metro가 실기기에 설치된 앱의 `client-front` 파일 변경을 감지해서 옛날 코드를 핫리로드해버리는 사고가 반복 발생함(카카오 KOE006 오류의 실제 원인이었음) — **실기기 테스트가 진행 중인 동안 다른 브랜치 작업이 필요하면 반드시 `git worktree add`로 별도 디렉토리를 만들어 작업할 것**, 같은 디렉토리에서 `git checkout`으로 브랜치를 오가면 안 됨

---

## 2026-08-31 | 방문 기록 AI 태그: 백엔드는 이미 준비됨, AI 쪽이 `log_emotion_tag`에 직접 적재 예정으로 확인

- **결정**: 김지광 확인 결과 (1) 방문 기록 사진 감성 태그는 AI 서버가 별도 배치로 DB(`log_emotion_tag`)에 직접 적재하는 방식으로 진행, (2) AI 코스 생성은 지금처럼 사용자 요청 시점에 백엔드가 동기 호출하는 방식이 맞음(변경 없음)을 코드로 재확인
- **이유**: `VisitLogService`의 `tags` 필드가 하드코딩된 빈 배열이 아니라 `VisitLog.emotionTags`(`log_emotion_tag` 테이블에 대한 JPA `@OneToMany` 실시간 조회)를 그대로 매핑하는 구조임을 코드로 확인 — AI가 `visit_log_id` 기준으로 `log_emotion_tag`에 행을 채워넣기 시작하면 백엔드 추가 작업 없이 GET 엔드포인트들이 자동으로 태그를 반환함. `CourseService.generate()`도 이미 요청 시점에 `ai/course_optimizer`를 동기 호출하는 구조라 김지광이 설명한 방식과 정확히 일치함을 확인
- **영향**: 코드 변경 없음. **미해결 질문**: `place_emotion_tag.count`(장소별 감성태그 집계)를 AI가 `log_emotion_tag` 적재 시 같이 갱신해주는지, 아니면 백엔드가 별도 동기화 로직을 추가해야 하는지 김지광에게 확인 필요 — 현재 `VisitLogService.delete()`엔 감소 로직만 있고 증가 로직이 없는 상태(AI 연동 전이라 애초에 필요 없었음). 확인되면 필요 시 `create()`에 증가 로직 추가

---

## 2026-08-31 | onboarding_card 실데이터 부족 확인 — 데모 전 반드시 보강 필요

- **결정**: 실제 Supabase `onboarding_card` 테이블을 직접 조회해 현재 상태를 수치로 확인. 전체 11건(시드 7 + 일반 4)뿐이고, 태그별 커버리지가 relaxing 4 / lively 2 / romantic 1 / local 3 / photogenic 6 / traditional 3 / modern 2 — 7개 태그 중 5개가 milestone.md에 명시된 "최소 4장" 기준 미달(`romantic`은 1장뿐)
- **이유**: 사용자가 "온보딩에 유저 사진이 뜨는지" 질문한 걸 계기로 실데이터 상태를 처음으로 직접 확인함(그동안 `onboarding_card` 시드 스크립트 자체가 스프린트3까지 계속 `[ ]` 미완료로만 기록돼 있었고, 실제 DB 상태 수치는 기록된 적 없었음). 시드 7장을 다 보여준 뒤 이어서 보여줄 카드가 4장뿐이라, 온보딩 알고리즘 스펙(균형 60%+탐색 30%+랜덤 10%로 최소 15장~최대 25장 진행)이 실제로는 작동할 수 없는 상태
- **영향**: `milestone.md`의 `onboarding_card` 시드 스크립트 항목(이수연 담당)에 이 수치 반영. 공모전 데모 전 반드시 채워야 하는 항목으로 우선순위 상향 필요 — 이수연에게 수치 전달 필요

---

## 2026-08-31 | 디자인 적용 착수 — Pretendard 폰트 도입, LoginScreen 1차 반영

- **결정**: Figma 문서("디자인" 페이지, 77개 프레임)를 화면 우선순위 없이 앱 플로우 순서대로(로그인부터) 하나씩 실제 코드에 반영하기로 함. 첫 화면으로 `LoginScreen.tsx`를 Figma 노드 `330:1293`(로그인 프레임, 카카오/구글 버튼 있는 최종 상태) 스펙대로 재작성. 이 과정에서 앱 전역에 처음 필요해진 두 가지를 같이 결정:
  1. **Pretendard 폰트**: 프로젝트에 폰트 로딩 자체가 없었음(디자인 반영 전 화면들은 시스템 기본 폰트). `pretendard` npm 패키지 배포본(jsdelivr CDN, `dist/public/static/alternative/*.ttf`)에서 Regular/Medium/SemiBold/Bold 4종만 받아 `client-front/assets/fonts/`에 번들, `App.tsx`에서 `expo-font`의 `useFonts`로 앱 시작 시 한 번만 로드(로딩 전엔 스피너). `app.config.js`가 동적 설정이라 `expo-font` config-plugin이 `app.json`에 자동으로 못 써서 `plugins` 배열에 수기로 추가함. 화면마다 반복 쓸 `fontFamily`/색상 상수는 `src/theme/fonts.ts`·`src/theme/colors.ts`로 신설 — 앞으로 디자인 반영하는 모든 화면이 이 두 파일을 공유
  2. **로그인 배경 사진 교체**: Figma의 배경 사진(노드 `330:1294`/`330:1295`, 월영교)을 그대로 export해보니 우측 하단에 스톡사진 미리보기 워터마크가 찍혀 있어 그대로 쓸 수 없었음. Supabase `place` 테이블에서 월영교(`id=116`)를 직접 조회해 TourAPI 적재 사진(`https://tong.visitkorea.or.kr/cms/resource_photo/85/4062785_image2_1.jpg`, 야경 컷)으로 교체 — 이미 라이선스가 확인된 프로젝트 데이터셋 사진이라 워터마크/저작권 문제 없음
  - **"비로그인 상태로 계속 진행" 버튼**: 이번엔 UI만 반영(버튼 배치·문구까지 디자인대로), 실제 동작은 "준비 중" 알림만 뜸. `App.tsx`의 네비게이션 구조가 아직 비로그인 상태를 지원하지 않아서(로그인 성공 시에만 다음 화면 진입) 게스트 모드 전체 구현은 범위가 커서 별도 작업으로 분리하기로 함
  - **카카오/구글 버튼 아이콘**: Figma 아이콘 노드(`334:1399` 카카오, `334:1404` 구글)를 export해도 이 세션의 MCP 툴 경로로는 이미지 바이트를 실제 파일로 저장할 방법이 없었음(항상 렌더링된 미리보기로만 반환됨). 구글은 공식 배포 자산(`developers.google.com/identity/images/g-logo.png`)을 받아 번들. 카카오는 카카오 공식 디자인 가이드(색상 규정: 심볼 `#FEE500` 배경 + 검정 심볼) 색상만 따르고, 심볼 자체는 RN View 조합(노란 원 + 검정 말풍선 사각형)으로 근사 구현 — 실제 브랜드 리소스 파일로 나중에 교체 가능하도록 컴포넌트 분리는 안 해두었음(단순 인라인)
- **이유**: 디자인 팀 산출물을 코드로 옮기는 첫 화면이라, 이후 모든 화면이 재사용할 폰트/색상 로딩 기반을 여기서 먼저 갖춰야 했음. 배경 사진은 라이선스 리스크가 명확해서 임의로 넘어가지 않고 즉시 교체
- **영향**: `client-front/App.tsx`, `app.config.js`, `src/screens/LoginScreen.tsx`, `src/theme/{colors,fonts}.ts`, `assets/fonts/Pretendard-*.ttf`(4종, 총 ~10.3MB), `assets/images/google-logo.png` 추가/수정. `tsc --noEmit` 통과 확인, 실기기 시각 확인은 이번 세션엔 Metro/adb 연결이 없어서 못함(다음 실기기 세션에서 확인 필요). `feat/react-native-maps` 브랜치에 커밋·push 완료(`client` 기준 미병합). **다음 화면 작업 시에도 이 결정(폰트 로딩 방식, 배경 사진 교체 원칙, 게스트 버튼 UI-only 범위)을 그대로 따를 것**

---

## 2026-08-31 | 앱 전체에 세이프에어리어 처리가 아예 없던 버그 발견/수정 (`react-native-safe-area-context` 도입)

- **결정**: 위 LoginScreen을 실기기(SM_S901N, Android)로 처음 띄워보고서야 발견 — 앱 전체에 `react-native-safe-area-context`가 한 번도 설치된 적이 없어서, 화면 하단 콘텐츠가 시스템 내비게이션 바(제스처바/3버튼 내비 모두)에 그냥 가려지고 있었음(Expo SDK 57이 Android edge-to-edge를 기본으로 렌더링하기 때문). `react-native-safe-area-context` 설치 후 `App.tsx` 최상단을 `SafeAreaProvider`로 감싸고, `LoginScreen`은 `useSafeAreaInsets()`로 받은 `insets.bottom`을 하단 시트 `paddingBottom`에 반영(`Math.max(디자인값 36, insets.bottom + 16)`)
- **이유**: 이 프로젝트가 지금까지 화면 대부분을 에뮬레이터/타입체크로만 검증하고 실기기 육안 확인 없이 넘어와서 안 걸렸던 것으로 보임(온보딩/코스/탐색 등 기존 화면들도 같은 문제를 안고 있을 가능성이 높음 — 이번엔 LoginScreen만 고침). 디자인 반영을 시작한 첫 화면에서 바로 걸려서 지금 고치고 넘어감
- **영향**: `client-front/package.json`에 `react-native-safe-area-context` 추가(네이티브 모듈이라 `expo run:android` 재빌드 필요했음 — JS Fast Refresh만으로는 `IllegalViewOperationException`으로 크래시). 실기기(SM_S901N)로 하단 문구 안 가리는 것 확인 완료. **다음 화면부터도 하단/좌우 여백이 있는 화면은 처음부터 `useSafeAreaInsets`를 반영할 것** — 기존 화면(온보딩, 홈, 탐색 등)도 언젠가 실기기로 훑어서 같은 문제 있는지 점검 필요(별도 작업)

---

## 2026-08-31 | LoginScreen 실제 플로우 정정 — 히어로+"계속하기" → 로그인 팝업 2단계

- **결정**: 처음엔 Figma `330:1293` 프레임을 "카카오/구글 버튼이 이미 보이는 최종 상태"로 오독해서 LoginScreen을 로그인 팝업이 항상 떠 있는 1단계로 구현했음. 사용자가 실제 플로우 스크린샷 2장(히어로+"계속하기" 상태 / "계속하기" 탭 후 로그인 팝업 상태)을 보여줘서 정정 — 실제로는 `330:1293` 프레임 안에 두 상태(초기 히어로 화면 + 그 위에 겹쳐진 로그인 팝업)가 같은 아트보드에 함께 들어있던 것이었음. `LoginScreen`에 `step: 'intro' | 'login'` state 추가, "계속하기" 탭 시 `login`으로 전환, 로그인 시트 바깥(사진 영역) 탭하면 다시 `intro`로 복귀하도록 구현
- **이유**: Figma 프레임 하나가 여러 UI 상태를 겹쳐서 담고 있을 수 있다는 걸 간과함 — 다음부터 프레임을 "최종 상태"로 단정하지 말고, 겹쳐진 레이어(z-order상 뒤에 가려진 텍스트/버튼 등)가 있는지 `get_node_info`의 children 목록을 끝까지 확인할 것
- **영향**: `client-front/src/screens/LoginScreen.tsx` 재작성, `expo-linear-gradient` 신규 도입(인트로 화면 사진→흰색 그라디언트 오버레이, 네이티브 모듈이라 재빌드 1회 필요했음). 실기기(SM_S901N)로 인트로 화면 렌더링 확인 완료(계속하기 탭 전환은 좌표 문제로 자동화 검증은 중단, 사용자가 직접 확인하기로 함)

---

## 2026-08-31 | OnboardingScreen 디자인 적용 — 드래그 스와이프 카드로 전면 재작성

- **결정**: Figma 노드 `501:12699`("스와이프") 스펙 반영. 기존엔 좋아요/싫어요 버튼 2개짜리 화면이었는데, 디자인엔 버튼이 아예 없고 카드를 직접 드래그해서 넘기는 UI였음(뒤에 살짝 보이는 스택 카드 포함). `react-native` 내장 `Animated`+`PanResponder`로 드래그·플링·스프링 복귀 구현(신규 네이티브 의존성 없음, 재빌드 불필요). 하단 버튼 2개는 스펙에 라벨이 없어서 텍스트로만 유추: 알약 버튼 "맞춤 취향 분석하기"는 SSOT 최소 스와이프 기준(15장) 이상일 때만 활성화되는 조기 종료 CTA로, 옆 정사각 아이콘 버튼은 SSOT의 "내 취향 다시 분석하기"(재시작) 버튼으로 판단해 `onboardingApi.reset()`에 연결(이미 있던 엔드포인트, 그동안 미사용 상태였음)
- **이유**: 정사각 아이콘 버튼의 아이콘명이 Figma상 "rotate-cw"였고, `onboardingApi.reset()`이 이미 준비돼 있었지만 어떤 화면에서도 호출된 적이 없었음 — SSOT에 명시된 "'내 취향 다시 분석하기' 버튼 → 온보딩 재시작" 문구와 아이콘 의미가 정확히 일치해서 이 해석으로 연결
- **영향**: `client-front/src/screens/OnboardingScreen.tsx` 전면 재작성. 기존 progress 텍스트("n / 최대 25장")는 Figma 디자인에 해당 요소가 없어서 제거함

---

## 2026-08-31 | HomeScreen을 GNB+3탭+플로팅 네비게이션 셸로 재구성

- **결정**: Figma 노드 `506:11115`/`334:2691`/`334:3255`("메인 페이지-나의 일지/맞춤 코스/안동 거리") 반영해 기존 평면 버튼 메뉴였던 `HomeScreen`을 상단 GNB(드로어 아이콘+로고, 검색+마이페이지 아이콘) + 3개 탭(나의 일지/취향 맞춤 코스/안동 거리) + 하단 플로팅 네비게이션 바 구조로 재구성. 3개 탭 내용은 `src/screens/home/{Journal,Recommended,Street}Tab.tsx`로 분리. 기존에 홈 화면에 나열돼 있던 나머지 화면들(코스 만들기, 방문 기록, 행사·축제, 태그 안내, 알림 설정 등)은 좌측 드로어(Modal 기반 슬라이드 패널)로 이동
- **이유**: 디자인 문서에 실제 드로어(서랍) UI 스펙은 없어서(아이콘만 존재) 임시로 전체 메뉴 목록 형태 Modal로 구현 — 실제 드로어 시안 나오면 교체 필요. `나의 일지`/`안동 거리` 탭에 `react-native-maps`를 이 세션에서 처음 실사용(둘 다 이미 네이티브 링크돼 있어 재빌드 불필요했음)
- **디자인과 실제 구현이 갈린 지점**:
  1. **별점(★4.0), 작성자 프로필(아바타+닉네임), 사진 캐러셀+인디케이터, 페이지네이션("1/20")**: `취향 맞춤 코스`/`안동 거리` 탭 카드에 디자인상 있지만, 대응하는 백엔드 데이터가 없음(`/explore/similar-logs`는 작성자 정보 없음, `visit_log`엔 별점 컬럼 없음 — 8/31 앞선 결정 항목 참고). 가짜 데이터를 지어내지 않기 위해 전부 생략
  2. **하단 플로팅 네비게이션(홈+공유 아이콘, 중앙 그라디언트 원형 버튼)**: 3개 메인 탭 프레임 모두 아이콘 구성이 동일(홈/공유_1/홈 중복)해서 tab별 전환이 아니라 고정 UI로 판단. 실제 동작은 추측으로 연결함 — 홈(양옆+중앙 모두)은 "이미 홈 화면이라 사실상 no-op", 공유는 `Share.share()`로 앱 소개 텍스트 공유. **실제 의도(예: 중앙 버튼이 다른 화면에서 홈으로 복귀하는 용도인지)는 디자인팀(전성빈) 확인 필요**
  3. **지도 뷰포트**: `안동 거리`/`나의 일지` 탭 모두 지도 이동에 따른 재조회(팬/줌 시 bounds 갱신) 없이 안동시 전역을 덮는 고정 좌표로만 조회함 — 추후 지도 `onRegionChangeComplete` 연동 필요
- **영향**: `client-front/src/screens/HomeScreen.tsx`, `src/screens/home/*.tsx` 신규, `src/theme/colors.ts`에 `backgroundMuted` 추가, `src/theme/fonts.ts`에 로고 전용 `SquadaOne-Regular` 추가(`assets/fonts/`). 실기기 시각 확인은 아직 안 함(다음에 확인 필요) — 특히 지도 렌더링(Google Maps API 키 적용 여부)과 플로팅 네비게이션 겹침 레이아웃은 꼭 실기기로 봐야 함

---

## 2026-09-01 | `app.config.js`의 구글맵 키가 실제 매니페스트에 반영 안 되던 버그 발견/수정 — 디버그 키스토어 SHA-1도 함께 재발급됨

- **결정**: 실기기로 HomeScreen 지도(`나의 일지`/`안동 거리` 탭)를 처음 열어보니 `IllegalStateException: API key not found`로 크래시. `client-front/android/`가 `.gitignore`로 완전히 무시되는 자동 생성 폴더인데, 로컬에 이미 존재하던 `android/`가 `app.config.js`(8/31에 구글맵 키 주입 추가)보다 먼저 생성된 상태로 남아있어서 `expo run:android`가 재빌드만 하고 설정을 다시 안 읽어들이고 있었음. `npx expo prebuild --platform android`로 `android/`를 완전히 새로 생성해서 해결
- **부작용(중요)**: prebuild가 `android/`를 통째로 지우고 새로 만들면서 `debug.keystore`도 새로 생성됨 → SHA-1이 랜덤하게 바뀜 → 8/31에 검증 완료했던 구글/카카오 로그인이 다시 막힐 상태가 됨(새 SHA-1을 GCP/카카오 콘솔에 재등록해야 함, 사용자에게 안내 후 별도 진행하기로 함)
- **재발 방지**: `client-front/.gitignore`에서 `android/app/debug.keystore` 하나만 예외로 두고 git에 커밋함(비밀번호가 `android`/`android`로 공개된 디버그 전용 키라 커밋해도 안전, 릴리즈 서명과 무관). 디렉토리 단위 `/android` 무시 규칙 안에 있는 파일이라 단순 `!` negate로는 안 먹혀서 `/android/*` → `!/android/app/` → `/android/app/*` → `!/android/app/debug.keystore` 순으로 단계별로 열어줘야 했음(git이 무시된 디렉토리는 아예 안 훑는 특성 때문)
- **이유**: `android/`가 자동 생성 폴더라는 이유로 아무 파일도 git에 안 잡혀있었는데, `debug.keystore`만큼은 예외로 둬야 한다는 걸 이번에 실제로 겪고서야 알게 됨. 앞으로 `expo prebuild`(또는 `--clean` 옵션)를 다시 돌릴 일이 생겨도 이 파일만큼은 git에서 복원되므로 SHA-1이 다시는 안 바뀜
- **영향**: `client-front/.gitignore` 수정, `client-front/android/app/debug.keystore` 신규 커밋. **사용자 확인 필요**: 새 SHA-1(`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`)을 GCP 콘솔(Android OAuth 클라이언트)과 카카오 디벨로퍼스(플랫폼 키 해시)에 재등록해야 로그인이 다시 동작함 — 콘솔 접근 권한이 없어 직접 등록은 못 함

---

## 2026-09-01 | PlaceDetailScreen·PlaceListScreen 디자인 적용

- **결정**: Figma 노드 `358:5134`("관광지 상세 페이지")/`362:3724`("검색창") 반영. 상세 페이지는 사진 캐러셀+점 인디케이터, 이름+찜 버튼, 감성태그+카테고리 칩, 개요, "기본정보"(지도 미리보기+주소/전화/홈페이지/영업시간), "리뷰"(방문 기록 목록) 순으로 재구성. 검색 화면은 기존 카테고리+검색 통합 구조를 유지한 채 디자인의 알약형 검색바 스타일만 입힘
- **디자인과 실제 구현이 갈린 지점**: 별점(★4.0), 리뷰 작성자 프로필(아바타+닉네임+여행 시기), 리뷰 좋아요·댓글 수, "가는 방법"(예: "신세동 벽화 마을에서 차로 6분") — 전부 대응하는 백엔드 데이터가 없어서 생략함(`place_like`는 내 찜 여부만 있고 개수 없음, `visit_log`엔 별점·작성자 노출 필드 없음, `place`엔 랜드마크 기준 이동시간 필드 없음). 검색 화면의 "인기 검색어"/자동완성 추천 목록도 대응 API가 없어서 생략
- **이유**: 없는 데이터를 지어내지 않기 위한 선택 — 반복되는 원칙(8/31 HomeScreen 결정과 동일)
- **영향**: `client-front/src/screens/{PlaceDetailScreen,PlaceListScreen}.tsx`, `src/components/PlaceListItemRow.tsx` 재작성. 상세 페이지에 `react-native-maps` 위치 미리보기(스크롤/줌 비활성) 신규 추가. 실기기 시각 확인 아직 안 함

---

## 2026-09-01 | 코스 만들기 플로우(AI/직접) 디자인 적용 — Figma에 없는 부분은 자체 판단으로 채움

- **결정**: Figma 노드 `316:4643`("직접 일정 만들기-날짜 선택", 달력), `510:11265`("AI일정 짜기-스와이프"), `510:11285`("AI 일정 만들기-화면") 반영해서 `CourseFlowScreen`(AI 코스 설정)/`CourseManualBuilderScreen`(직접 코스)/`CourseSwipeScreen`/`CourseResultScreen` 전면 재작성
  - **캘린더 날짜 선택기 신규 도입**(`src/components/CalendarPicker.tsx`): 기존엔 `YYYY-MM-DD` 텍스트 직접입력이었음. 원본 디자인은 Poppins 폰트+파란 강조색(`#0066ff`)을 쓰고 있었는데, 이건 다른 부분(399:3661 "계획짜기" 등)과 마찬가지로 **범용 UI 킷 템플릿을 그대로 붙여넣은 흔적**으로 판단해서(Inter/Poppins 폰트, "Lorem ipsum", "$250 per person" 같은 영문 목업 텍스트가 섞여 있음) 실제 앱 톤(Pretendard, 검정 강조)으로 통일함. AI 코스/직접 코스 양쪽에서 공용으로 씀
  - **CourseSwipeScreen 3-way 스와이프**: 노드 `510:11265`는 실제로 온보딩 스와이프 프레임(`501:12699`)을 그대로 복제해둔 것뿐이라(텍스트까지 "당신의 취향을 선택하세요" 동일) 이 화면 전용 스펙이 없음. OnboardingScreen에서 확립한 드래그 카드 언어(Animated+PanResponder)를 재사용하되, 온보딩과 달리 좋아요/넘기기/**꼭 가기** 3가지 결과가 필요해서(SSOT: "필수 방문 장소 지정") 좌우 드래그(좋아요/넘기기)에 "꼭 가기 ★" 버튼을 별도로 추가 — 이 구성 자체는 화면 판단으로 정함
  - **CourseResultScreen 번호 핀 지도**: `CoursePlaceItem`의 실좌표(lat/lng)로 `react-native-maps` `Marker`(방문 순서 번호 배지)+`Polyline`(점선, 좌표 순서 연결)을 그림 — 디자인의 "번호 핀+점선 경로" 컨셉을 실제 데이터로 구현. 장소 카드 좌측엔 디자인처럼 세로 연결선을 그려 Day-리스트 느낌 유지
- **디자인과 실제 구현이 갈린 지점**: 장소 카드의 카테고리 라벨("관광명소" 등) — `CoursePlaceItem`에 카테고리 필드 자체가 없어서(장소당 상세 조회를 추가로 N번 해야 해서 비용 대비 가치가 낮다고 판단) 생략. "장소 추가" 버튼 — 이 화면(결과 확인 후 저장)의 책임이 아니라 `CourseEditScreen`이 담당할 영역이라 여기서는 안 넣음
- **이유**: 참조용 UI 킷 템플릿과 실제 완성된 디자인을 구분해서, 완성 안 된 부분은 앱의 확립된 톤(Pretendard/검정 강조/기존 컴포넌트 패턴)을 그대로 따라가는 쪽으로 판단
- **영향**: `client-front/src/components/CalendarPicker.tsx` 신규, `CourseBuilderPlaceList.tsx` 테마 적용, `CourseFlowScreen`/`CourseManualBuilderScreen`/`CourseSwipeScreen`/`CourseResultScreen.tsx` 재작성. 새 네이티브 의존성 없음(Animated/PanResponder는 코어, react-native-maps는 이미 링크됨) — 재빌드 불필요. 실기기 시각 확인 아직 안 함. **다음**: `CourseDetailScreen`(저장된 코스 조회)/`CourseEditScreen`/`MyCoursesScreen` 아직 디자인 미반영 상태로 남음

---

## 2026-09-01 | AI 서버 EC2 배포 확인 — `COURSE_OPTIMIZER_BASE_URL`/`PLACE_RECOMMENDER_BASE_URL`을 `AI_SERVER_URL` 하나로 통합

- **결정**: 김지광이 AI 서버(course_optimizer + place_recommender)를 EC2 인스턴스에 Docker로 배포 완료, 단일 호스트(`http://3.27.148.167:8000`)에서 `GET /health`, `POST /v1/places/recommend`, `POST /v1/courses/optimize` 세 엔드포인트를 함께 서빙함을 확인. 8/26·8/30에 각각 도입된 `CourseOptimizerProperties`/`PlaceRecommenderProperties`(둘 다 "실제로는 같은 서비스, 배포 시 통합 검토"라고 미리 코멘트 남겨뒀던 상태)를 이번에 실제로 `AiServerProperties`(`ai-server.base-url`, env `AI_SERVER_URL`) 하나로 통합
- **이유**: 배포가 한 프로세스/한 호스트로 확정된 이상 설정을 굳이 두 키로 나눠 관리할 이유가 없어짐(예전엔 "혹시 나중에 분리 배포될 수도" 대비였는데 실제로 안 그렇게 됨). `CourseOptimizerClient`/`PlaceRecommenderClient`의 요청 경로(`/v1/courses/optimize`, `/v1/places/recommend`)는 이미 8/30에 실제 라우트로 검증된 상태라 그대로 유지, RestClient 빈 자체는 클라이언트별로 계속 분리해둠(8/30 "`@Primary` RestClient 여러 개 섞이는 문제" 재발 방지 목적)
- **타임아웃 추가**: 두 RestClient 모두 `SimpleClientHttpRequestFactory`로 connect timeout 5s를 명시. read timeout은 course-optimizer 30s(LLM 호출 포함이라 여유), place-recommender 15s로 설정 — 예전엔 로컬(`localhost:8001`) 기준이라 타임아웃이 없어도 문제없었지만, 이제 실제 네트워크(EC2) 너머라 응답 지연/장애 시 요청 스레드가 무한정 걸리는 걸 방지
- **미검증 사항**: 이 세션 환경(샌드박스)에서 `3.27.148.167:8000`으로 직접 `curl`/TCP 연결을 시도했으나 **타임아웃**(연결 자체가 안 됨, 일반 인터넷 접속은 정상이라 이 환경 IP가 AI 서버 보안그룹에서 허용 안 된 것으로 추정) — 그래서 실제 요청/응답 검증(스키마 일치 여부, 실제 응답 지연시간 등)은 못 하고 코드/설정만 반영함. **사용자가 직접 확인 필요**: 아래 curl로 연결·요청 성공 여부, 또는 Render(운영 백엔드)가 이 환경 대신 실제로 호출 성공하는지
  ```bash
  curl http://3.27.148.167:8000/health
  ```
- **영향**: `server-back/src/main/kotlin/com/dongle/server/common/config/AiServerProperties.kt` 신규(`CourseOptimizerProperties`/`PlaceRecommenderProperties` 삭제), `CourseOptimizerHttpConfig`/`PlaceRecommenderHttpConfig`가 이 프로퍼티 사용하도록 수정, `application.yml`/`.env.example`의 `course-optimizer`/`place-recommender` 키를 `ai-server.base-url`(`AI_SERVER_URL`)로 통합. 로컬 `.env`에 실제 EC2 주소 반영 완료(커밋 안 됨). 관련 테스트(`PlaceRecommenderClientTest`/`CourseOptimizerClientTest`/`CourseGenerateApiIntegrationTest`/`SwipeApiIntegrationTest`) 전부 통과 확인 — 단 이 테스트들은 `MockRestServiceServer`로 HTTP 레이어를 가로채는 방식이라 실제 EC2 서버 연동 자체를 검증하진 못함. `feat/ai-server-url-consolidation` → `server` 병합·push 완료
- **후속(같은 날)**: 위 미검증 사항 실제로 확인 완료. 초반엔 이 세션 환경에서 `3.27.148.167:8000` 자체가 TCP 타임아웃(보안그룹 미허용 추정) — 이후 팀이 보안그룹을 열어줘서 재확인함. `GET /health` 정상, `POST /v1/places/recommend` 정상(응답이 `RecommendResponse`와 필드까지 일치), `POST /v1/courses/optimize`도 실제 DB 장소 좌표로 재시도해 정상 응답 확인(처음엔 테스트로 넣은 두 장소가 지리적으로 멀어서 `422 no feasible route found`가 정상적으로 뜬 것뿐이었음 — 버그 아님). `/openapi.json`으로 AI 서버의 실제 스펙과 우리 Kotlin DTO(`TripInput`/`CandidatePlace`/`CourseOptimizationResult` 등)가 필드명·타입까지 정확히 일치하는 것도 확인함. **결론: 코드 수정 없이 바로 연동 가능한 상태**

---

## 2026-09-02 | `place_emotion_tag` 카운터 테이블 제거 — `log_emotion_tag`를 조회 시점에 직접 집계

- **결정**: `place_emotion_tag(place_id, tag, count)` 테이블을 완전히 제거하고, 장소의 "방문 로그 누적 감성 태그"는 `log_emotion_tag`를 조회 시점에 직접 집계(`GROUP BY tag ORDER BY COUNT DESC`)해서 계산하는 방식으로 전환
- **이유**: 8/31 결정으로 AI가 `log_emotion_tag`에 직접 배치로 적재하기로 확정됐는데, `place_emotion_tag.count`(집계 카운터)를 AI가 같이 갱신해주는지 우리가 별도로 동기화해야 하는지가 미해결로 남아있었음(8/31 decision-log). 애초에 이 카운터는 `log_emotion_tag`의 파생값(합계)일 뿐이라, 저장을 아예 없애고 조회 시점에 그때그때 계산하면 "누가 갱신 책임을 지는가"라는 질문 자체가 사라짐 — AI가 `log_emotion_tag`에 행만 넣어주면 백엔드 추가 작업 없이 바로 반영됨
- **구현**: `LogEmotionTagRepository.countTagsByPlaceId()`(JPQL 집계 쿼리, Kotlin interface 프로젝션) 신규 추가. `PlaceService.resolveTags()`/`EventService`가 기존 `Place.emotionTags` 관계 대신 이걸 사용하도록 변경. `VisitLogService.delete()`의 카운트 차감 로직 삭제(`log_emotion_tag`는 `visit_log` 삭제 시 FK `ON DELETE CASCADE`로 이미 같이 지워지므로 별도 처리 불필요). `PlaceEmotionTag`/`PlaceEmotionTagRepository` 삭제, `schema.sql`/`schema.dbml`에서 테이블 정의 제거하고 실제 Supabase에도 `DROP TABLE` 적용(적용 전 행 0개·참조 FK 없음 확인 완료). `api_1.3.1v.yaml`의 방문기록 작성/삭제 설명도 실제 아키텍처(AI 비동기 배치 적재 + 조회 시점 집계)로 수정
- **사이드 노트(Kotlin 함정)**: 집계 쿼리 결과를 담는 프로젝션 인터페이스를 `fun getTag(): String` 같은 Java 스타일 getter로 선언했더니, 같은 Kotlin 모듈 안의 다른 코드에서 `.tag` 프로퍼티 접근이 컴파일 에러(`Unresolved reference`)로 실패함 — getter→프로퍼티 합성은 **Java 상호운용 전용 기능**이라 Kotlin-to-Kotlin 호출엔 적용 안 됨. `val tag: String`(Kotlin 프로퍼티)으로 바꾸니 해결(바이트코드상 getter는 동일해서 Spring Data 프록시 생성엔 영향 없음)
- **영향**: `server-back` 6개 파일 수정 + `LogEmotionTagRepository.kt` 신규, `docs/ssot.md`/`docs/milestone.md` 테이블 목록 갱신. `VisitLogApiIntegrationTest`의 태그 삭제 테스트를 `place_emotion_tag` 직접 조작 대신 `GET /places/:id`의 `top_tags` 응답으로 검증하도록 재작성. `./gradlew test` 전체(89개) 통과 확인, 실제로 테이블을 지운 뒤 재실행해서도 통과 재확인함. `feat/place-emotion-tag-live-aggregate` → `server` 병합·push 완료

---

## 2026-09-03 | Figma "디자인" 페이지(79개 프레임) 전수 확인 + 스크랩북 화면(내 코스+찜한 장소 통합) 반영

- **배경**: Figma 채널(`pww1b6bg`)로 재접속해서 남은 미반영 화면을 찾기 위해 페이지 내 79개 프레임을 전부 스캔·분류함. 이전 세션들에서 이미 "범용 UI 킷 템플릿과 실제 시안이 섞여 있다"는 게 확인된 상태였는데, 이번에 전수 확인해서 목록으로 정리함
- **결정 1 (Figma 프레임 분류)**:
  - **실제 반영 대상으로 확정**: `485:10903`("코스 저장")/`488:11855`("관광지 저장") — 둘 다 "스크랩북" 화면의 "여행코스"/"관광지" 탭. 헤더(뒤로가기+제목)·세그먼트 탭·히어로 카드(그라디언트+제목+메타)·하단 플로팅 네비게이션까지 실제 Pretendard/검정 톤으로 완성돼 있어 그대로 반영
  - **템플릿 쓰레기로 확정, 무시**: `533:11388`("마이 페이지" — 실제로는 가구쇼핑앱 "FUN-ITURE" 목업), `316:3150`("Home" — "FrameAI" 영상 앱 목업), `316:3248`("Finance & Banking App"), `316:3613`("Travel Journey 1"), `477:7162`("Plan" 섹션), `399:3661`("계획짜기") — 전부 Inter/Poppins 폰트+Lorem ipsum/영문 목업 텍스트가 있는 범용 UI 킷 템플릿
  - **사용자 확인 후 보류/배제 확정**: `437:4426`("Frame 1464203734", Day1/Day2 코스 상세 후보) — 실제 우리 장소 데이터(월영교 등)와 템플릿 잔재("Lorem ipsum...", "Blogs", "Over View", 영문 "25 minutes"/"5.9 KM")가 섞여 있어 사용자에게 확인 후 **이 프레임 자체를 참고하지 않기로 결정**(CourseDetailScreen 디자인 반영은 다음 기회로 이월). `316:4607`("당신이 선호하는 여행 스타일을 선택해주세요", 칩 다중선택 UI) — SSOT상 온보딩은 스와이프 방식으로 확정돼 있어 이 화면과 방식이 다름, 용도 불명확해서 **일단 보류**(폐기도 채택도 안 함)
  - **참고용으로만 확인, 반영 안 함**: `316:4122`("유저 리스트", 취향 비슷 사용자 피드 리스트뷰)와 `507:10963`("취향 비슷 사용자 프로필", 단건 상세뷰) — 실제 시안이지만 이번 작업 범위 밖이라 다음 기회로 이월. "갤럭시24" 프레임 다수(316:4210 등)는 전부 이미 구현된 "안동 거리" 탭의 반복 변형본으로 확인, 새로운 내용 없음
- **결정 2 (구현)**: 기존 `MyCoursesScreen.tsx`/`LikesScreen.tsx`(둘 다 `Button`/회색 테두리뿐인 기본 스타일, 기능은 이미 동작하던 상태)를 삭제하고 `ScrapbookScreen.tsx` 하나로 통합. 두 탭 다 기존 API 로직(`courseApi.myCourses`/`userApi.getLikes`)을 그대로 재사용, `CourseDetailScreen`/`CourseEditScreen`/`PlaceDetailScreen`으로의 진입도 기존과 동일하게 유지(그 안쪽 화면들 자체는 이번에 손 안 댐 — 여전히 미반영 상태). HomeScreen에만 있던 하단 플로팅 네비게이션을 `src/components/FloatingNav.tsx`로 분리해 재사용(Figma상 두 카드형 화면 모두 동일 배치로 확인됨)
- **디자인과 실제 구현이 갈린 지점**: 코스 카드의 장소 썸네일 3장 스트립+"N+" 배지 — `CourseListItem`이 코스 썸네일 1장만 주고 코스 내 개별 장소 썸네일 목록을 안 줘서 "장소 N곳" 텍스트로 대체. 코스 카드 우상단 좋아요 버튼 — 스키마에 "코스 찜" 개념 자체가 없음(`PLACE_LIKE`만 존재, `COURSE_LIKE` 없음)이라 생략. 반복되는 원칙(8/31 HomeScreen, 9/1 코스 만들기 플로우 결정과 동일 — 없는 데이터는 지어내지 않음)
- **드로어 메뉴 정리**: 기존 "내 코스"/"찜한 장소" 두 항목을 "스크랩북" 하나로 통합(둘 다 같은 화면의 다른 탭일 뿐이라 항목을 나눌 이유가 없어짐)
- **영향**: `client-front/src/screens/{MyCoursesScreen,LikesScreen}.tsx` 삭제, `ScrapbookScreen.tsx` 신규, `src/components/FloatingNav.tsx` 신규, `HomeScreen.tsx`/`ProfileScreen.tsx` 수정. `npx tsc --noEmit` 통과 확인(Metro/실기기 세션 없는 상태에서 작업). `feat/my-courses-screen` → `client` 병합·push 완료. **`client` → `dev` 통합은 여전히 미완료**(8/31부터 계속 대기 중인 결정, 이번 작업도 그 위에 얹힘). **다음 후보**: `CourseDetailScreen`/`CourseEditScreen` 자체 디자인 반영, `316:4122`/`507:10963`(유사 사용자 탐색 피드) 반영, `437:4426`/`316:4607` 보류 건 재논의

---

## 2026-09-03 | 코스 상세/수정 화면 디자인 적용 — 전용 시안 없어서 기존 화면 언어 재사용

- **결정**: `CourseDetailScreen`/`CourseEditScreen`(기능은 있으나 `Button`/기본 스타일뿐이던 상태)에 디자인 적용. 전용 Figma 시안이 없어서(9/3 앞선 결정으로 `437:4426` 배제) 새로 만들지 않고 이미 확립된 화면의 언어를 그대로 재사용: `CourseDetailScreen`은 `CourseResultScreen`의 번호 핀 지도+거리/시간 리스트 구조를, `CourseEditScreen`은 `CourseManualBuilderScreen`의 헤더/입력창/버튼 스타일을 그대로 가져옴(둘 다 같은 "장소 순서 편집" 성격)
- **이유**: 시안 없는 화면은 앱 톤을 임의로 새로 짜기보다 이미 확정된 동일 성격 화면의 패턴을 재사용하는 쪽이 일관성 있음(8/31, 9/1 결정과 동일 원칙)
- **부수 정리**: 코드에 `#d33`로 하드코딩돼 있던 삭제 버튼 색을 `colors.danger` 토큰으로 승격(Figma에 파괴적 액션 시안 자체가 없어서 기존 값 그대로 토큰화만 함)
- **영향**: `client-front/src/screens/{CourseDetailScreen,CourseEditScreen}.tsx` 재작성, `src/theme/colors.ts`에 `danger` 추가. `npx tsc --noEmit` 통과. `feat/course-detail-edit-screen` → `client` 병합·push 완료

---

## 2026-09-03 | `log_emotion_tag.score` 컬럼 드리프트 발견·수정 — 실제 Supabase와 schema.sql/엔티티가 어긋나 있었음

- **배경**: 유사 사용자 탐색 피드 화면 작업 중 `ExploreApiIntegrationTest`가 제출한 변경과 무관한 지점(`LogEmotionTag` insert)에서 계속 실패. 원인 추적 결과 **실제 Supabase `log_emotion_tag` 테이블에 `score DOUBLE PRECISION NOT NULL` 컬럼이 이미 존재**하는데, `schema.sql`/`schema.dbml`/`LogEmotionTag.kt` 엔티티 어디에도 반영이 안 돼 있었음(`psql`로 라이브 DB `\d log_emotion_tag` 직접 확인). 테이블은 비어있어(0행) 데이터 유실 위험은 없었음. 추정: 8/30 "AI가 log_emotion_tag에 직접 배치 적재" 결정 이후, AI/데이터 파트가 태그별 확신도를 같이 적재하려고 컬럼을 라이브 DB에 직접 추가하면서 스키마 문서·백엔드에 공유가 안 된 것으로 보임 — **데이터 파트(이수연)/AI 파트(김지광)에게 실제 의도 확인 필요**
- **영향 범위**: `ExploreApiIntegrationTest` 3개 전부, `VisitLogApiIntegrationTest` 11개 중 5개(둘 다 `LogEmotionTag`를 insert하는 테스트) 실패 중이었음 — 내 작업과 무관하게 `server` 브랜치가 이미 이 상태였음(변경 stash 후 재현해서 확인)
- **결정**: `LogEmotionTag` 엔티티에 `score: Double`(non-null) 추가해서 실제 DB와 맞춤. 이왕 추가하는 김에 `LogEmotionTagRepository.countTagsByPlaceId`의 정렬 기준을 `COUNT(let)`(단순 등장 횟수)에서 `SUM(let.score)`(확신도 합산)로 바꿈 — 태그가 여러 번 등장하면 합산값도 자연히 커지니 빈도는 그대로 반영되면서, 애매하게 붙은 태그보다 확신도 높은 태그가 상위 태그로 우선하도록 개선. `PlaceService.resolveTags`/`EventService` 등 호출부는 정렬된 태그 목록의 `.tag`만 쓰고 있어서 이 변경만으로 호출부 수정 없이 반영됨
- **적용**: `schema.sql`/`schema.dbml`에 `score` 컬럼 반영, `ExploreApiIntegrationTest`/`VisitLogApiIntegrationTest`의 `LogEmotionTag` 생성 헬퍼에 `score = 0.8` 추가. **라이브 Supabase DB 자체는 이미 컬럼이 있었으므로 별도 마이그레이션 불필요**(문서·엔티티만 실제에 맞춤)
- **영향**: `server-back` 4개 파일 수정(`LogEmotionTag.kt`, `LogEmotionTagRepository.kt`, 테스트 2개), `schema.sql`/`schema.dbml`/`api_1.3.1v.yaml` 갱신. `./gradlew test` 전체 통과 확인(이전엔 실패 상태였음). `feat/explore-nickname` → `server` 병합·push 완료(worktree `/tmp/dongle-server-explore`에서 작업 후 정리)

---

## 2026-09-03 | 유사 취향 탐색 피드 화면 디자인 적용 + `SimilarLogItem`에 작성자 정보 추가

- **결정**: Figma 노드 `316:4122`("유저 리스트")/`507:10963`("취향 비슷 사용자 프로필") 반영해서 `ExploreScreen` 재작성. 카드에 작성자 아바타+닉네임이 있는데 `SimilarLogItemResponse`엔 없어서(VisitLog에 user 관계는 있지만 노출 안 함) **백엔드에 `nickname`/`profile_image_url` 필드 추가**(User 엔티티에 이미 있던 필드 그대로 노출, 새 데이터 아님)
- **디자인과 실제 구현이 갈린 지점**: 사진 여러 장+점 인디케이터+사진 우상단 좋아요 버튼 — `SimilarLogItem`은 사진이 `photo_url` 1장뿐이고 "방문 기록 좋아요" 개념 자체가 스키마에 없어서(`PLACE_LIKE`만 존재) 사진 1장만 버튼 없이 표시. 카드의 별점(예: ★★★★ 4.0) — 같은 Figma 문서 안에서도 카드마다 있다 없다 해서(507:10963엔 없음, 316:4122 두 번째 카드에만 있음) 확정된 요소로 보기 어렵고 대응 데이터도 없어서 생략
- **"선택" 버튼**: 카드 우상단 버튼의 의도가 불명확했는데, 카드에 있는 유일한 실제 액션 가능 데이터가 `place_id`라 "이 장소 상세로 이동"으로 해석해서 구현(`PlaceDetailScreen`으로 이동)
- **페이징**: `316:4122` 하단에 "◀◀ ◀ 1/20 ▶ ▶▶" 형태의 실제 페이징 컨트롤이 있어서, `FlatList`의 `onViewableItemsChanged`로 현재 보이는 카드 인덱스를 추적하고 버튼으로 `scrollToIndex` 이동하는 방식으로 구현(서버 페이지네이션이 아니라 이미 받아온 전체 목록 안에서의 스크롤 위치 이동)
- **영향**: `server-back/src/main/kotlin/com/dongle/server/explore/{ExploreService.kt,dto/SimilarLogItemResponse.kt}`, `api_1.3.1v.yaml`, `ExploreApiIntegrationTest.kt` 수정(`feat/explore-nickname` → `server`, 위 항목과 같은 브랜치). `client-front/src/{api/explore.ts,screens/ExploreScreen.tsx}` 수정, `npx tsc --noEmit` 통과, `feat/explore-feed` → `client` 병합·push 완료. **`server`/`client` → `dev` 통합은 둘 다 여전히 미완료** — 지금 이 nickname 필드는 `client`에서 타입만 맞춰뒀을 뿐, `dev`/`main` 배포본엔 아직 없어서 실제 응답엔 없는 상태(두 브랜치 다 dev 통합 대기 중이라 당장 불일치는 없음, 통합 시점에 같이 맞아떨어짐)

---

## 2026-09-03 | 좌측 드로어 UX 개선 — 전용 시안 없이 기본기만 보강

- **결정**: Figma 79개 프레임을 전수 확인해도(9/3 앞선 세션에서 이미 확인) 드로어 전용 시안은 끝내 없어서, 디자인을 새로 짜지 않고 **디자인과 무관한 UX 기본기만** 개선: ① `Modal`이 그냥 `fade`뿐이던 걸 실제 좌측에서 슬라이드 인/아웃하는 애니메이션으로(`Animated.Value` + `translateX` 보간), ② 인사말 옆에 `UserProfile.profile_image_url` 아바타 추가(이미 있는 필드, 새 데이터 아님), ③ 항목 8개를 그냥 나열하던 걸 "코스/탐색/설정" 3개 섹션으로 구분
- **이유**: 시안이 없다고 방치하기보다, 시안과 무관하게 명백히 필요한 부분(슬라이드 애니메이션 없는 서랍은 기본적인 모바일 UX 관례에도 안 맞음, 항목 8개 나열은 훑어보기 어려움)은 먼저 개선. 항목 구성 자체(어떤 메뉴를 넣을지, 순서)는 여전히 임시라는 점은 유지 — 실제 서랍 시안 나오면 항목 배치는 다시 손볼 것
- **영향**: `client-front/src/screens/HomeScreen.tsx` 수정(같은 애니메이션 로직을 다른 화면에서 또 써야 하는 상황이 생기면 그때 공용 컴포넌트로 분리 검토). `npx tsc --noEmit` 통과. `feat/drawer-improvements` → `client` 병합·push 완료

---

## 2026-09-03 | 게스트 모드(비로그인 이용) 구현

- **결정**: `App.tsx`에 `isGuest` 상태를 추가해서 로그인 없이 `HomeScreen`에 진입 가능하게 함(`profile: UserProfile | null`로 변경, `null`이면 게스트). `LoginScreen`의 기존 "비로그인 상태로 계속 진행" 텍스트 링크(`handleGuestPress`)가 지금까지는 "준비 중" 얼럿만 띄웠는데, 이번에 `onGuestContinue` prop을 실제로 호출하도록 연결
- **게스트가 쓸 수 있는 것 / 없는 것**: SSOT상 비인증 허용 API(장소 탐색·지도, 행사·축제, 감성 태그 안내)만 실제로 열어주고, 인증 필요한 기능(AI/직접 코스 만들기, 스크랩북, 방문 기록, 비슷한 취향 탐색, 알림 설정, 내 정보)은 눌러도 그 화면을 열지 않고 바로 로그인 화면으로 돌려보냄 — 어차피 토큰 없이 호출하면 401이라, 미리 막고 "로그인하면 ~할 수 있어요" 안내를 보여주는 쪽을 선택(호출 실패를 겪게 하지 않음). 홈 탭 3개 중 "나의 일지"/"취향 맞춤 코스"는 개인화 데이터라 게스트에겐 안내 문구+로그인 버튼(`GuestPrompt`)으로 대체, "안동 거리"는 완전히 공개 데이터라 그대로 노출(게스트 진입 시 기본 탭도 여기로)
- **드로어**: 인사말 영역이 프로필 대신 "게스트로 둘러보는 중" 안내로, 하단 "로그아웃"이 "로그인하기"로 바뀜. 인증 필요한 항목은 텍스트 색만 옅게(`gray400`) 해서 구분(막혀있다는 걸 알 수 있게), 탭하면 여전히 로그인 화면으로 이동
- **디자인 관련**: 사용자가 확인 — 현재 Figma 시안엔 게스트 진입이 버튼이 아니라 텍스트 링크로만 되어 있음(`guestText` 스타일, 12px 텍스트). 디자인팀(전성빈)에 버튼 형태 전환 여부 문의 예정 — 지금 구현은 스타일 안 건드리고 있는 텍스트 링크 그대로 기능만 연결함
- **남은 거친 부분**: `PlaceDetailScreen`의 찜(좋아요) 버튼은 게스트가 눌러도 여전히 API를 그냥 호출하고 실패 얼럿("로그인이 필요할 수 있어요")으로 처리 — HomeScreen 레벨의 사전 차단과 달리 이 leaf 화면은 로그인 화면으로 보내는 콜백 자체가 없어서(여러 화면을 거쳐야 App.tsx까지 prop이 이어짐) 이번 범위에서는 손 안 댐. 우선순위 낮다고 판단(에러 메시지 자체는 이미 있어서 완전히 깨지진 않음)
- **영향**: `client-front/App.tsx`, `src/screens/{LoginScreen,HomeScreen}.tsx` 수정. `npx tsc --noEmit` 통과. `feat/guest-mode` → `client` 병합·push 완료

---

## 2026-09-03 | `client` → `dev` 통합 완료 (8/31부터 대기 중이던 결정)

- **결정**: 8/31부터 계속 보류돼있던 `client` → `dev` 병합을 사용자 확인 받고 진행. 로그인/온보딩/홈/장소상세·목록/코스만들기/스크랩북/코스상세·수정/유사사용자탐색/드로어/게스트모드까지 이번에 반영된 디자인 작업 전부가 `dev`에 들어감
- **병합 전 확인**: `git diff`로 `client`가 merge-base 이후 **오직 `client-front/`만** 건드렸고 `dev`는 그 사이 `client-front/`를 **전혀** 안 건드린 것 확인(둘 다 diff 0건) — 그래서 충돌 없이 완전히 깨끗하게 병합됨. `docs/`·`server-back/`·`schema.sql` 등은 `client`가 손 안 댄 파일들이라 병합해도 그대로 `dev` 버전 유지됨(`client`의 낡은 스냅샷으로 덮어써질 위험 없음)
- **영향**: `dev`에 `client-front` 38개 파일 반영(2753줄 추가/806줄 삭제 규모). `npx tsc --noEmit` 통과 확인. `docs/milestone.md` 등 문서는 병합 후에도 그대로 최신 상태 유지 확인함. **`server` → `dev` 통합은 여전히 미완료** — 다음 후보

---

## 2026-09-04 | 실기기 테스트 전 로직 검토 — 프론트↔백엔드 흐름 전수 확인, 버그 7건 발견·전부 수정

- **배경**: `client` → `dev` 통합 이후, 실기기로 확인하기 전에 로그인→온보딩→탐색→코스 만들기→방문기록 전체 흐름을 코드 레벨로 검토(디자인이 아니라 로직/데이터 정합성 관점). 화면 크래시는 없었지만 사용자가 눈치채기 어려운 방식으로 조용히 잘못 동작하는 지점 7건을 찾아서 전부 수정함

1. **방문기록 한줄리뷰 삭제 불가** (🔴 확실한 버그) — `LogEditScreen`이 빈 문자열을 `undefined`로 바꿔 보내서 필드 자체가 요청에서 빠졌고, `VisitLogService.update()`의 `request.oneLine?.let {...}` 패턴은 "필드 없음"과 "명시적으로 지움"을 구분 못 해 옛날 리뷰가 그대로 남았음(저장은 성공했다고 뜸). 프론트는 항상 trim된 값을 보내도록, 백엔드는 빈 문자열을 `null`로 정규화(`it.ifBlank { null }`)하도록 계약을 명확히 함. 테스트 추가(빈 문자열 PATCH → 응답에 `one_line` 없음 확인)

2. **장소 목록 20개 캡** (🔴 확실한 버그) — `PlaceListScreen`(검색/코스 장소 추가에서 재사용)과 `StreetTab`(안동 거리 탭) 둘 다 페이지네이션 없이 1페이지(20건)만 보여줬음. 관광지만 107건이라 87개는 어디서도 검색·선택 불가능했던 상태. 두 화면 다 `onEndReached` 무한 스크롤 추가(`hasNext`/`page` 상태 추적). `PlaceListScreen.load()`에 원래 없던 에러 핸들링도 같이 보완(실패 시 무한 로딩에 갇히던 것 해소)

3. **온보딩 카드 소진 시 조기 종료를 조용히 처리** (🟡 로직 구멍) — `onboarding_card`가 11건뿐이라(milestone.md 기록) `getNextCard()`가 15장 채우기 전에 카드 소진으로 null을 반환할 수 있는데, 프론트가 이를 자연 수렴/완료와 구분 없이 그냥 `/onboarding/complete`를 호출했음. `totalSeen < 15`인 채로 종료되는 경우에만 "보여드릴 사진이 더 없어요" 안내를 띄우도록 프론트에 분기 추가(백엔드 API 계약은 안 바꿈 — 카드 데이터가 채워지면 자연히 안 뜨는 경로)

4. **스와이프 "이어하기" 문구가 사실과 다름** (🟡 로직 구멍) — `POST /swipe/sessions/:id/results`가 마지막 카드까지 다 넘긴 뒤 한 번에만 호출되는 구조(트랜잭션 all-or-nothing)라, 세션이 남아있다는 건 곧 아무 것도 제출 안 됐다는 뜻(`swiped_results`는 항상 빈 배열 — 수학적으로 증명 가능: 부분 제출 자체가 불가능한 구조). 그런데 "진행 중이던 스와이프가 있어요, 이어서 진행할까요?"라는 문구는 마치 스와이프 답변이 보존되는 것처럼 들림. 실제로 남는 건 "같은 조건(날짜·이동수단)으로 이어갈지, 새 조건으로 다시 뽑을지"의 선택뿐이라 그에 맞게 문구만 수정(로직 자체는 이미 맞았음)

5. **리프레시 토큰 미회전 + 동일 초 중복 발급** (🟢 보안 강화, ⚠️ 겸사겸사 새 버그 발견) — `AuthService.refresh()`가 액세스 토큰만 새로 내주고 리프레시 토큰은 원래 만료 시각까지 계속 재사용됐음 → 회전 도입(갱신마다 새 리프레시 토큰 발급 + 기존 것 즉시 폐기, 슬라이딩 만료). **구현 중 실제로 겪은 새 버그**: `JwtTokenProvider`가 `iat`/`exp`를 초 단위로만 넣어서, 같은 유저에게 같은 초 안에 토큰을 두 번 발급하면 완전히 같은 문자열이 나옴 — 회전 로직에서 "새 토큰 저장" 시점에 방금 지운 토큰과 값이 같아 `UNIQUE` 제약 위반으로 실패하는 걸 테스트로 재현함. `jti`(무작위 UUID) 클레임을 추가해 해결. 프론트는 `/auth/refresh` 응답의 `refresh_token`으로 저장된 토큰을 교체하도록 수정(`tokenStorage.save`)

6. **게스트가 찜 버튼을 누르면 뻔한 API 실패 후에야 안내** (🟢 사소함) — `PlaceDetail.is_liked`가 `null`이면 비인증 조회(게스트)라는 뜻인데도 그냥 `placeApi.like/unlike`를 호출해서 401을 받은 뒤에야 실패 얼럿을 띄웠음. `is_liked === null`이면 API 호출 자체를 생략하고 바로 "로그인이 필요해요" 안내로 대체

7. **`upload.ts` 주석이 낡음** (🟢 사소함) — "아직 호출하는 화면 없음"이라고 돼 있었는데 `VisitLogCreateScreen`이 이미 호출 중이었음. 코멘트만 정정

- **부수 확인**: 백엔드 전체 테스트(`./gradlew test`) 실행 중 `ImageProxyApiIntegrationTest` 5건이 간헐적으로 실패하는 걸 봤는데, 재실행하니 통과 — 8/30에 이미 기록된 "공용 Supabase pooler 커넥션 한도로 가끔 플레이키함" 관찰과 같은 현상으로 판단, 별도 이슈로 추가 기록 안 함
- **영향**: 프론트 `feat/fix-review-bugs`(1·2번) + `feat/review-fixes-round2`(3·4·6·7번) → `client` 병합·push 완료. 백엔드 `fix/visitlog-oneline-clear`(1번) + `feat/refresh-token-rotation`(5번) → `server` 병합·push 완료. 둘 다 `./gradlew test` 전체 통과 확인(worktree에서 작업 후 정리). `npx tsc --noEmit` 통과. **이번 라운드로 `client`/`server`가 다시 `dev`보다 앞서게 됨** — 다음 통합 시점에 같이 반영 필요. 사용자가 이 커밋들 기준으로 실기기 테스트 예정

---

## 2026-09-06 | 스키마 추가: visit_log_photo 테이블 (방문 기록 여러 장 사진 지원)

- **결정**: `visit_log.photo_url`(단일 TEXT 컬럼)을 없애고, `place_image`와 동일한 패턴(부모 테이블 + `sort_order`)의 `visit_log_photo` 테이블로 대체. 백엔드 `VisitLogCreateRequest.photoUrls`(목록, 최대 10장)로 받아 목록 순서를 그대로 `sort_order`로 저장, `VisitLogDetail/Summary/MapItem` 응답도 `photo_urls`(배열)로 변경
- **이유**: "기록 작성 시 사진 여러 장 선택 가능하게 해달라"는 요청 — 단일 컬럼으로는 애초에 여러 장을 저장할 수 없어서 스키마 확장이 필수. 새 테이블 대신 배열 컬럼(`photo_urls TEXT[]`)도 검토했으나, `place_image` 등 기존 다대일 사진 관계가 전부 부모 테이블 패턴이라 일관성 위해 테이블 방식 채택(2026-09-06 사용자 확인)
- **영향**: `visit_log.photo_url` 컬럼 삭제(당시 실제 데이터 0건이라 무손실 마이그레이션), `visit_log_photo(id, visit_log_id, photo_url, sort_order)` 신규. `SimilarLogItem`(유사 사용자 탐색, `GET /explore/similar-logs`)은 범위 밖 — 대표 사진 1장만 계속 노출(`VisitLog.mainPhotoUrl` = sort_order 최상위 사진). `schema.sql`/`schema.dbml`/`api_1.3.1v.yaml` 갱신, 통합 테스트 갱신, `server` 병합·push·프로덕션 배포 완료. **`api_1.3.1v.yaml`이 이번에 보니 7/23 이후로 `title`/`weather`/`rating`/`avg_rating` 등 여러 필드가 통째로 안 갱신돼 있었음을 발견** — 이번 변경분(`photo_url`→`photo_urls`)만 맞춰뒀고, 나머지 누락분은 범위 밖이라 별도 정리 필요(다음 세션 후보)

---

## 2026-09-06 | Android 갤러리 접근: `expo-image-picker`에 `legacy: true` 적용

- **결정**: `JournalLogCreateModal`/`VisitLogCreateScreen`의 `ImagePicker.launchImageLibraryAsync` 호출에 `legacy: true` 옵션 추가
- **이유**: 사용자가 "구글 포토에 있는 사진만 업로드되고 폰 로컬 갤러리 사진은 안 올라가는 것 같다"고 리포트. 원인은 기본값(`legacy: false`)이 Android "포토 라이브러리" 범위로만 스캔하는 최신 시스템 피커를 쓰기 때문 — `expo-image-picker` 문서상 `legacy: true`가 "포토 라이브러리 밖" 미디어도 선택 가능하게 함. 실기기(갤럭시 S22)로 확인해보니 `legacy:true` 적용 후 데스크 사진·캘린더 스크린샷·다른 앱이 저장한 이미지 등 로컬 사진이 정상적으로 보임
- **영향**: 같은 커밋에서 `allowsMultipleSelection`+`selectionLimit`(최대 5장)도 같이 추가해 여러 장 선택 가능하게 함(위 `visit_log_photo` 결정과 세트). `client` 병합·push 완료, 실기기로 로컬 갤러리 접근+여러 장 선택+캐러셀 표시까지 end-to-end 확인함
