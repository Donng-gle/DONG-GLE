# 동글 (DONG-GLE)

> 안동 감성 여행 플랫폼 — 취향 기반 숨은 명소 추천 & AI 코스 생성 서비스

---

## 프로젝트 구조

```
DONG-GLE/
├── server-back/    # 백엔드 API 서버
├── client-front/   # 모바일 앱 프론트엔드
├── data/           # 데이터 적재 스크립트 (관광공사 OpenAPI sync)
└── ai/             # AI 이미지 분석 파이프라인 (VLM 감성 태그)
```

---

## 팀 구성 및 담당

| 이름 | 역할 | 담당 브랜치 |
|------|------|------------|
| 설만수 | 풀스택 (백엔드 + 프론트) | `server`, `client` |
| - | 데이터 | `data` |
| - | AI | `ai` |
| - | 디자인 | - (Figma) |

---

## 브랜치 전략

```
main      ← 배포 브랜치. PR만 허용. 직접 push 금지.
dev       ← 통합 브랜치. 각 파트 작업 완성 후 머지.
  server  ← 백엔드 작업
  client  ← 프론트엔드 작업
  data    ← 데이터 적재 작업
  ai      ← AI 분석 파이프라인 작업
```

### 작업 흐름

```bash
# 1. 자기 브랜치로 이동 후 최신화
git checkout server   # 본인 브랜치로
git pull origin server

# 2. 작업 후 커밋
git add .
git commit -m "feat(place): 장소 상세 API 구현"
git push origin server

# 3. 기능 완성되면 → dev로 PR 오픈
# 4. dev 안정 확인 후 → main으로 PR 오픈
```

---

## 커밋 컨벤션

```
타입(스코프): 메시지
```

### 타입

| 타입 | 설명 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 코드 개선 (기능 변화 없음) |
| `chore` | 빌드·패키지·환경설정 |
| `docs` | 문서 작성·수정 |
| `test` | 테스트 추가·수정 |
| `data` | 데이터 적재·파이프라인 |

### 예시

```
feat(place): 지도 뷰포트 기반 장소 핀 조회 API 추가
fix(auth): refresh token 만료 시 401 미반환 버그 수정
data(sync): 관광공사 OpenAPI 안동 지역 장소 최초 적재
docs(api): OpenAPI YAML v1.2.0 업데이트
chore(infra): Supabase 환경변수 설정 및 .env.example 추가
```

---

## PR 규칙

### PR 제목 형식
```
[feat] 스와이프 일정짜기 기능 구현
[fix] JWT refresh token 만료 처리
```

### PR 설명 템플릿
```
## 무엇을 했나요?

## 왜 했나요?

## 테스트
- [ ] 로컬에서 확인
- [ ] 엣지케이스 확인

## 관련
- Closes #이슈번호
```

### 머지 조건
- `dev → main`: 리뷰어 1명 이상 승인 필수
- `각 브랜치 → dev`: 코드리뷰 권장

---

## 환경변수

`.env` 파일은 절대 커밋하지 않습니다.

각 파트별 `.env.example` 파일을 참고해서 `.env` 파일을 직접 생성하세요.
실제 값은 팀 채팅으로 공유합니다.

---

## 기술 스택

### 백엔드 (`server-back/`)
- TBD

### 프론트엔드 (`client-front/`)
- TBD

### 데이터 (`data/`)
- Python
- 한국관광공사 OpenAPI

### AI (`ai/`)
- VLM (Vision Language Model) — TBD
- 감성 태그 자동 분석

### 인프라
- DB: Supabase (PostgreSQL)
- Storage: Supabase Storage
- 지도: TMAP API

---

## API 명세

`docs/galrae_openapi.yaml` 참고

Swagger UI로 확인하는 방법:
1. [editor.swagger.io](https://editor.swagger.io) 접속
2. File → Import file → `galrae_openapi.yaml` 업로드

---

## 관련 문서

- [API 명세 (OpenAPI YAML)](./docs/galrae_openapi.yaml)
- [유저플로우](./docs/galrae_userflow.html)
- Figma 디자인: (링크 추가 예정)
