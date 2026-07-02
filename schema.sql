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


-- 감성 태그 (방문 로그 AI 분석 결과 누적)
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
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (oauth_provider, oauth_id)
);


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
