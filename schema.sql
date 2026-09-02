-- 동글 DB 스키마 (PostgreSQL)
-- 탈퇴 처리: Hard delete + CASCADE (MVP), 추후 soft delete로 전환 예정

CREATE TYPE place_category AS ENUM ('관광지', '식당', '카페', '액티비티', '문화공간', '축제행사');

-- 장소 (TourAPI 기반)
CREATE TABLE place (
    id               BIGSERIAL PRIMARY KEY,
    content_id       VARCHAR(20)      UNIQUE NOT NULL,   -- TourAPI contentid
    content_type_id  SMALLINT         NOT NULL,           -- 12/14/15/28/38/39
    category         place_category   NOT NULL,
    name             VARCHAR(200)     NOT NULL,            -- title
    addr1            VARCHAR(100),
    addr2            VARCHAR(100),
    lat              DOUBLE PRECISION,                     -- mapy
    lng              DOUBLE PRECISION,                     -- mapx
    tel              VARCHAR(50),                          -- 행사축제(15)는 100% 채워짐, 나머지 타입은 대부분 없음
    main_image_url   TEXT,                                 -- firstimage
    overview         TEXT,                                 -- detailCommon2.overview
    homepage         TEXT,                                 -- detailCommon2.homepage (적재 시 URL만 파싱해서 저장)
    lcls_systm1      VARCHAR(10),                          -- 신분류체계 1 (category 매핑 참고용)
    lcls_systm2      VARCHAR(10),
    lcls_systm3      VARCHAR(10),
    event_start_date DATE,                                 -- 행사축제(15)만. searchFestival2로 수집
    event_end_date   DATE,
    visit_log_count  INT              NOT NULL DEFAULT 0,  -- 서비스 로직에서 관리, 수집 시 건드리지 않음
    hidden_score     FLOAT,                                -- 숨은명소 점수, 데이터 파트가 산출하여 적재
    synced_at        TIMESTAMP
);

CREATE INDEX idx_place_content_type ON place (content_type_id);
CREATE INDEX idx_place_lnglat ON place (lng, lat);


-- 추가 이미지
-- originimgurl == smallimageurl 이 실제 응답에서 100% 동일 확인 → img_url 하나로 통합
CREATE TABLE place_image (
    id         BIGSERIAL PRIMARY KEY,
    place_id   BIGINT    NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    img_url    TEXT      NOT NULL,  -- originimgurl
    sort_order INT       NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    UNIQUE (place_id, img_url)
);

CREATE INDEX idx_place_image_place ON place_image (place_id);


-- 영업시간 (Google Places opening_hours.periods 기준 + TourAPI 텍스트 파싱 보완)
-- 브레이크타임 등 세부 휴게시간 데이터는 소스(TourAPI/Google) 어디에도 사실상 없어 미반영 (decision-log 참고)
-- close_day/close_time이 NULL이면 해당 open_day는 24시간 영업
CREATE TABLE place_hours (
    id         BIGSERIAL PRIMARY KEY,
    place_id   BIGINT    NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    open_day   SMALLINT  NOT NULL CHECK (open_day BETWEEN 0 AND 6),  -- 0=일요일 ~ 6=토요일 (Google 기준)
    open_time  TIME      NOT NULL,
    close_day  SMALLINT  CHECK (close_day BETWEEN 0 AND 6),          -- 자정 넘어가는 영업(예: 금 22:00~토 02:00) 표현용
    close_time TIME,
    UNIQUE (place_id, open_day, open_time)
);

CREATE INDEX idx_place_hours_place ON place_hours (place_id);


-- 장소별 VLM(GPT Vision) semantic 분석 raw score (장소 공식 사진 기반, 정적 기준선)
-- 장소당 최신 분석 결과 1행만 유지. model_name/prompt_version/tag_schema_version이 바뀌면 재분석 대상.
-- 아래 place_image_semantic_vector(이미지별 원본 점수)를 평균 낸 장소 단위 집계값 — 백엔드/코스추천/Qdrant는 이 집계 테이블만 읽음
-- place_emotion_tag(아래, 방문 로그 누적)와는 별개 신호 — 하나가 다른 하나를 대체하지 않음 (decision-log 2026-08-21 참고)
-- 데이터 파트 배치 스크립트(data/pipeline/semantic_vector_sync.py)로만 적재됨, 백엔드는 읽기 전용
CREATE TABLE place_semantic_vector (
    place_id                 BIGINT      PRIMARY KEY REFERENCES place (id) ON DELETE CASCADE,
    representative_image_url TEXT        NOT NULL,
    analysis_image_urls      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    analysis_image_count     INTEGER     NOT NULL,
    detail_scores            JSONB       NOT NULL,  -- 35개 세부 태그 점수
    major_scores             JSONB       NOT NULL,  -- 7개 대분류 태그 점수 (docs/ssot.md 감성태그셋 참고)
    summary                  TEXT,
    model_name               TEXT        NOT NULL,
    prompt_version           TEXT        NOT NULL,
    tag_schema_version       TEXT        NOT NULL,
    qdrant_point_id          TEXT        NOT NULL,  -- Qdrant place_semantic_vectors 컬렉션의 벡터 검색용 point id
    analyzed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_place_semantic_vector_prompt_version ON place_semantic_vector (prompt_version);
CREATE INDEX idx_place_semantic_vector_analyzed_at ON place_semantic_vector (analyzed_at DESC);


-- 장소 이미지별 VLM(GPT Vision) semantic 분석 raw score (이미지 1장 단위)
-- 위 place_semantic_vector(장소 단위 집계)의 원본 데이터. 온보딩 카드 대표 사진 선정처럼 이미지별 원본 점수가 필요한 곳에 사용
-- 재분석 시 (place_id, image_url) 기준으로 최신 버전만 유지(UPSERT). Qdrant는 이 테이블을 참조하지 않음(장소 단위 집계만 색인)
-- 데이터 파트 배치 스크립트(data/pipeline/semantic_vector_sync.py)로만 적재됨, 백엔드는 읽지 않음
CREATE TABLE place_image_semantic_vector (
    place_id             BIGINT      NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    image_url            TEXT        NOT NULL,
    detail_scores        JSONB       NOT NULL,  -- 35개 세부 태그 점수 (이 이미지 1장 기준)
    major_scores         JSONB       NOT NULL,  -- 7개 대분류 태그 점수 (이 이미지 1장 기준)
    summary               TEXT,
    model_name            TEXT        NOT NULL,
    prompt_version        TEXT        NOT NULL,
    tag_schema_version    TEXT        NOT NULL,
    analyzed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (place_id, image_url)
);

CREATE INDEX idx_place_image_semantic_vector_place ON place_image_semantic_vector (place_id);


-- 감성 태그 (방문 로그 누적 전용. 장소 공식 사진 기반 정적 분석은 위 place_semantic_vector 참고)
-- 사용자가 방문 기록에 사진을 올려 AI가 분석하면 여기 count가 늘고, 기록을 지우면 줄어드는 실시간 집계 테이블.
-- 초기 시드값은 없음 — 실제 방문 기록이 쌓이며 채워지는 게 정상 (decision-log 2026-08-21 참고)
CREATE TABLE place_emotion_tag (
    id       BIGSERIAL PRIMARY KEY,
    place_id BIGINT      NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    tag      VARCHAR(50) NOT NULL,
    count    INT         NOT NULL DEFAULT 1 CHECK (count >= 1),  -- 해당 태그가 이 장소에 붙은 횟수, 상위 태그 선정에 사용
    UNIQUE (place_id, tag)
);

CREATE INDEX idx_place_emotion_tag_place ON place_emotion_tag (place_id);


-- 사용자
CREATE TABLE "user" (
    id                BIGSERIAL PRIMARY KEY,
    user_id           VARCHAR(50)  NOT NULL UNIQUE,
    nickname          VARCHAR(50)  NOT NULL,
    email             VARCHAR(200),
    oauth_provider    VARCHAR(20)  NOT NULL CHECK (oauth_provider IN ('kakao', 'google')),
    oauth_id          VARCHAR(100) NOT NULL,
    profile_image_url TEXT,
    has_onboarded     BOOLEAN      NOT NULL DEFAULT FALSE,  -- 앱 재시작 시 온보딩 완료 여부 판단
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (oauth_provider, oauth_id)
);


-- 리프레시 토큰 (로그아웃 시 무효화 처리용 서버 측 화이트리스트)
CREATE TABLE refresh_token (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    token      VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP    NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_token_user ON refresh_token (user_id);


-- 사용자 취향 (온보딩 스와이프 결과)
CREATE TABLE user_preference (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    tag        VARCHAR(50) NOT NULL,
    score      FLOAT       NOT NULL,  -- 스와이프 누적 점수, 상위 2-3개 태그를 대표 취향으로 사용
    updated_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tag)
);

CREATE INDEX idx_user_preference_user ON user_preference (user_id);


-- 장소 좋아요
CREATE TABLE place_like (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    place_id   BIGINT    NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, place_id)
);

CREATE INDEX idx_place_like_user  ON place_like (user_id);
CREATE INDEX idx_place_like_place ON place_like (place_id);


-- 방문 로그
CREATE TABLE visit_log (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    place_id   BIGINT       NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    photo_url  TEXT,
    one_line   VARCHAR(100),
    is_public  BOOLEAN      NOT NULL DEFAULT TRUE,  -- 유사 사용자 탐색(GET /explore/similar-logs)에서 공개 기록만 노출
    visited_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visit_log_user    ON visit_log (user_id);
CREATE INDEX idx_visit_log_place   ON visit_log (place_id);
CREATE INDEX idx_visit_log_visited ON visit_log (visited_at);


-- 로그 감성 태그 (AI 분석)
CREATE TABLE log_emotion_tag (
    id           BIGSERIAL   PRIMARY KEY,
    visit_log_id BIGINT      NOT NULL REFERENCES visit_log (id) ON DELETE CASCADE,
    tag          VARCHAR(50) NOT NULL,
    UNIQUE (visit_log_id, tag)
);

CREATE INDEX idx_log_emotion_tag_log ON log_emotion_tag (visit_log_id);


-- 코스
-- source: 'ai'=AI 추천 저장, 'ai_edited'=AI 추천 후 유저 수정, 'user'=유저 직접 생성
CREATE TABLE course (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    source      VARCHAR(20)  NOT NULL CHECK (source IN ('ai', 'ai_edited', 'user')),
    travel_date DATE,
    transport   VARCHAR(10)  CHECK (transport IN ('car', 'walk', 'public')),  -- 구글맵 경로 재계산용, nullable(과거 데이터/미입력 허용)
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_user ON course (user_id);


-- 코스 장소 (TMAP 경로는 장기 저장 안 함 → 코스 열 때 재호출)
CREATE TABLE course_place (
    id           BIGSERIAL PRIMARY KEY,
    course_id    BIGINT    NOT NULL REFERENCES course (id) ON DELETE CASCADE,
    place_id     BIGINT    NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    visit_order  INT       NOT NULL CHECK (visit_order >= 1),
    planned_time TIME,
    UNIQUE (course_id, visit_order)
);

CREATE INDEX idx_course_place_course ON course_place (course_id);
CREATE INDEX idx_course_place_place ON course_place (place_id);


-- 알림 설정 (유저당 1행, GET/PATCH /users/me/notification)
-- push_enabled=false면 event_alert/course_reminder 값과 무관하게 알림 미발송
CREATE TABLE notification_setting (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT    NOT NULL UNIQUE REFERENCES "user" (id) ON DELETE CASCADE,
    push_enabled    BOOLEAN   NOT NULL DEFAULT FALSE,
    event_alert     BOOLEAN   NOT NULL DEFAULT TRUE,
    course_reminder BOOLEAN   NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);


-- FCM 디바이스 토큰 (플랫폼별 최신 토큰만 유지, POST /users/me/device-token)
CREATE TABLE device_token (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    platform   VARCHAR(10)  NOT NULL CHECK (platform IN ('ios', 'android')),
    fcm_token  VARCHAR(500) NOT NULL,
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, platform)
);


-- 온보딩 카드 (AI 파트가 사전 분석하여 적재. 온보딩 런타임에 AI 호출 없음)
-- place_id: nullable — 특정 장소에 종속되지 않는 분위기 카드 허용
-- 태그별 최소 4장, is_seed=true 카드 7장(태그별 대표 1장씩) 필수
CREATE TABLE onboarding_card (
    id          BIGSERIAL PRIMARY KEY,
    place_id    BIGINT    REFERENCES place (id) ON DELETE SET NULL,
    image_url   TEXT      NOT NULL,
    is_seed     BOOLEAN   NOT NULL DEFAULT FALSE,
    relaxing    FLOAT     NOT NULL DEFAULT 0,
    lively      FLOAT     NOT NULL DEFAULT 0,
    romantic    FLOAT     NOT NULL DEFAULT 0,
    local       FLOAT     NOT NULL DEFAULT 0,
    photogenic  FLOAT     NOT NULL DEFAULT 0,
    traditional FLOAT     NOT NULL DEFAULT 0,
    modern      FLOAT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_card_seed  ON onboarding_card (is_seed);
CREATE INDEX idx_onboarding_card_place ON onboarding_card (place_id);


-- 온보딩 스와이프 이력 (진행 상태 복원 + 수렴 판정용. 최근 3장 변화량 계산에 사용)
-- onboarding/reset 시 유저의 이 이력 전체를 삭제하고 재시작
CREATE TABLE onboarding_swipe_log (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    card_id       BIGINT       NOT NULL REFERENCES onboarding_card (id) ON DELETE CASCADE,
    action        VARCHAR(10)  NOT NULL CHECK (action IN ('like', 'dislike')),
    change_amount FLOAT        NOT NULL,  -- 이번 스와이프로 인한 벡터 변화량 Σ|after-before|/7
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, card_id)
);

CREATE INDEX idx_onboarding_swipe_log_user ON onboarding_swipe_log (user_id, created_at);


-- 스와이프 세션 (일정짜기 화면. POST /swipe/candidates 발급, 24시간 유효)
-- id는 애플리케이션에서 'swipe_session_' + UUID로 생성해서 저장 (세션 토큰 성격, 순번 노출 방지)
CREATE TABLE swipe_session (
    id          VARCHAR(50) PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    travel_date DATE        NOT NULL,
    transport   VARCHAR(10) NOT NULL CHECK (transport IN ('car', 'walk', 'public')),
    expires_at  TIMESTAMP   NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swipe_session_user ON swipe_session (user_id);


-- 스와이프 세션의 후보 카드 (발급 시점 순서 고정)
-- action이 NULL이면 아직 스와이프 안 한 잔여 후보, 값이 있으면 이미 제출된 결과
CREATE TABLE swipe_session_candidate (
    id         BIGSERIAL   PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES swipe_session (id) ON DELETE CASCADE,
    place_id   BIGINT      NOT NULL REFERENCES place (id) ON DELETE CASCADE,
    sort_order INT         NOT NULL,
    action     VARCHAR(10) CHECK (action IN ('like', 'skip', 'must')),
    swiped_at  TIMESTAMP,
    UNIQUE (session_id, place_id)
);

CREATE INDEX idx_swipe_session_candidate_session ON swipe_session_candidate (session_id, sort_order);


-- 공통 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_updated_at
BEFORE UPDATE ON "user"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_preference_updated_at
BEFORE UPDATE ON user_preference
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_course_updated_at
BEFORE UPDATE ON course
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
