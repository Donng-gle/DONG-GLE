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

## 문서 읽는 순서

1. `docs/ssot.md` — 지금 확정된 기준
2. `docs/milestone.md` — 아직 결정해야 할 일과 일정
3. `docs/decision-log.md` — 왜 그렇게 결정했는지 기록
4. `CONTRIBUTING.md` — GitHub 협업 방식

---

## 팀 구성 및 담당

| 이름 | 역할 | 기본 파트 브랜치 | 실제 작업 브랜치 예시 |
|------|------|------------------|------------------------|
| 설만수 | 풀스택 (백엔드 + 프론트) | `server`, `client` | `feat/place-detail-api`, `fix/login-error` |
| 이수연 | 데이터 | `data` | `data/tourapi-sync`, `feat/homepage-parser` |
| 김지광 | AI | `ai` | `feat/emotion-tagging`, `fix/prompt-tuning` |
| 전성빈 | 디자인 | `-` | Figma 작업 |

> `server`, `client`, `data`, `ai`는 장기 파트 브랜치입니다. 실제 개발은 짧은 작업 브랜치를 만들어 진행한 뒤 PR로 머지합니다.

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

- `main`은 최종 제출본입니다.
- `dev`는 여러 파트를 합쳐서 확인하는 통합본입니다.
- `server`, `client`, `data`, `ai`는 파트별 작업 기준 브랜치입니다.
- 실제 코드를 수정할 때는 `feat/...`, `fix/...` 같은 짧은 작업 브랜치를 새로 만들어 사용합니다.

---

## 커밋 컨벤션

- 형식: `타입: 메시지`
- 상세 타입과 PR/브랜치 규칙은 `CONTRIBUTING.md` 참고

---

## 환경변수

`.env` 파일은 절대 커밋하지 않습니다.

각 파트별 `.env.example` 파일을 참고해서 `.env` 파일을 직접 생성하세요.
실제 값은 팀 채팅으로 공유합니다.

---

## 기술 스택

### 백엔드 (`server-back/`)
- Kotlin
- Spring Boot

### 프론트엔드 (`client-front/`)
- React Native (Expo)

### 데이터 (`data/`)
- Python
- 한국관광공사 OpenAPI

### AI (`ai/`)
- VLM (Vision Language Model) — 모델 추후 확정
- 감성 태그 자동 분석

### 인프라
- DB: PostgreSQL (호스팅 환경 미확정)
- 지도/경로 API: 미확정 (TMAP vs 카카오 검토 중)

---

## API 명세

- API 명세 파일: `docs/galrae_openapi.yaml`
- 현재는 저장소에 아직 반영 전이며, 문서 경로는 선점해서 유지

Swagger UI로 확인하는 방법:
1. [editor.swagger.io](https://editor.swagger.io) 접속
2. File → Import file → `galrae_openapi.yaml` 업로드

---

## 협업 가이드

브랜치 전략, 커밋 규칙, PR 규칙, 리뷰 방식 → [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 관련 문서

- [SSOT](./docs/ssot.md)
- [마일스톤](./docs/milestone.md)
- [Decision Log](./docs/decision-log.md)
- [API 명세 (OpenAPI YAML)](./docs/galrae_openapi.yaml)
- [유저플로우](./docs/galrae_userflow.html)
- [협업 가이드](./CONTRIBUTING.md)
- Figma 디자인: (링크 추가 예정)

---

## 현재 문서 상태

- 새 문서를 만들면 `README.md`와 함께 링크를 갱신
