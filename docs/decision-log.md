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
  - 클라이언트: `expo-auth-session`의 구글 부분을 네이티브 Google Sign-In 라이브러리(`@react-native-google-signin/google-signin` 등)로 교체 필요 — **아직 미착수**. 이 라이브러리는 네이티브 모듈이라 Expo Go로 테스트 불가, `expo-dev-client` 설치 + 실제 Android 빌드 필요. `app.json`에 `android.package: "com.dongle.app"` 반영 완료(`feat/google-oauth-android-package`).
  - 카카오 로그인 코드(`KakaoOAuthClient.kt`, `client-front`의 카카오 부분)는 이번 변경과 무관, 그대로 유지.

---

## 2026-08-27 | 카카오 로그인 Redirect URI: 백엔드 HTTPS 중계 엔드포인트 신설

- **결정**: 카카오 개발자 콘솔의 "카카오 로그인 리다이렉트 URI"에 앱의 커스텀 스킴(`dongle://`)을 직접 등록할 수 없어서(콘솔이 "유효하지 않은 URL"로 거부, 실제 확인함), 백엔드에 `GET /auth/kakao/callback` HTTPS 엔드포인트를 신설해 카카오 콘솔엔 이 주소(`https://dong-gle.onrender.com/auth/kakao/callback`)를 등록한다. 이 엔드포인트는 실제 로그인 처리를 하지 않고, 카카오가 붙여준 쿼리스트링(code/error)을 그대로 유지한 채 앱의 커스텀 스킴(`dongle://redirect`)으로 302 리다이렉트만 해주는 순수 중계 역할만 한다.
- **이유**: 구글 Web 애플리케이션 클라이언트와 동일한 문제(2026-08-26 결정 참고) — OAuth 제공자들이 브라우저 리다이렉트 흐름에선 커스텀 스킴 대신 http(s) URL을 요구하는 경우가 많음. 구글은 네이티브 SDK로 전환해 이 문제를 근본적으로 피했지만, 카카오는 기존 `expo-auth-session` 브라우저 흐름을 그대로 유지하기로 했으므로(스코프상 네이티브 카카오 SDK 도입은 보류) HTTPS 중계가 더 적은 비용의 해결책. 참고로 `dongle://`(경로 없이 authority가 완전히 빈 형태)는 카카오 콘솔뿐 아니라 `java.net.URI.create()`도 `IllegalArgumentException`으로 거부함을 실제 테스트로 확인 — 그래서 `dongle://redirect`처럼 경로 세그먼트를 하나 붙인 형태를 리다이렉트 대상으로 확정.
- **영향**: `AuthController.kt`에 `kakaoRedirectRelay` 추가, `SecurityConfig`의 `permitAllPaths`에 등록(비인증 허용 필수 — 카카오가 리다이렉트로 호출하므로 JWT가 있을 수 없음). `KAKAO_REDIRECT_URI` 값은 이제 이 중계 엔드포인트 주소로 고정(`.env.example` 반영). **클라이언트 쪽도 추가 작업 필요**(아직 미착수) — `client-front`가 `expo-auth-session`의 `useAuthRequest`/`promptAsync` 기본 흐름을 그대로 쓰면 `redirect_uri`(카카오에 보내는 값)와 `WebBrowser`가 감지하는 `returnUrl`이 항상 같은 값으로 강제되므로, 카카오에는 이 HTTPS 주소를 보내면서 앱은 `dongle://redirect`를 기다리는 두 값을 분리하려면 `useAuthRequest` 대신 `WebBrowser.openAuthSessionAsync`를 직접 호출하는 방식으로 바꿔야 함.

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
