# 협업 가이드

GitHub 처음 쓰는 팀원을 위한 기능 설명서.

---

## Issues

할 일, 버그, 논의할 내용을 Issues로 관리합니다.

### 이슈 만들기
1. GitHub 레포 상단 **Issues** 탭 클릭
2. **New issue** 버튼 클릭
3. 제목과 내용 작성 후 오른쪽에서 **Assignees**(담당자), **Labels**, **Milestone** 지정
4. **Submit new issue** 클릭

### 이슈 제목 형식
```
feat: 온보딩 스와이프 UI 구현
fix: 장소 이미지 로딩 실패 버그
data: PLACE 테이블 초기 적재
```

### 이슈 작성 원칙
- 하나의 이슈에는 하나의 목적만 담기
- 완료 조건이 보이도록 작성하기
- 담당자와 마일스톤을 가능하면 생성 시점에 바로 지정하기

### PR에서 이슈 자동 닫기
PR 설명에 아래처럼 쓰면 PR 머지 시 이슈가 자동으로 닫힙니다.
```
Closes #12
```

---

## Labels

이슈/PR의 성격을 분류하는 태그입니다.

### 기본 라벨 목록

| 라벨 | 용도 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 코드 개선 |
| `data` | 데이터 적재·파이프라인 |
| `docs` | 문서 |
| `chore` | 환경설정·패키지 |
| `test` | 테스트 추가·수정 |
| `blocked` | 외부 결정/의존성 때문에 진행 불가 |
| `discussion` | 구현 전 논의 필요 |

### 라벨 붙이기
이슈/PR 오른쪽 사이드바 **Labels** 클릭 → 해당 라벨 선택

> 라벨은 GitHub 레포 **Issues → Labels** 탭에서 팀 맞게 추가/수정할 수 있습니다.

---

## Milestones

M0~M3 마일스톤별로 이슈를 묶어서 진행률을 추적합니다.

### Milestone 만들기 (최초 1회, 관리자)
1. **Issues → Milestones** 탭 클릭
2. **New milestone** 클릭
3. 이름(`M0: 기반 확정`), 마감일 입력 후 저장
4. M0~M3 순서로 반복

### 이슈에 Milestone 연결하기
이슈/PR 오른쪽 사이드바 **Milestone** 클릭 → 해당 마일스톤 선택

마일스톤 페이지에서 완료된 이슈 비율을 진행률 바로 확인할 수 있습니다.

---

## 브랜치 전략

### 브랜치 역할

- `main`: 최종 제출 브랜치
- `dev`: 통합 확인 브랜치
- `server`, `client`, `data`, `ai`: 파트별 기준 브랜치
- `feat/...`, `fix/...`, `docs/...`: 실제 작업 브랜치

### 작업 흐름

```bash
# 1. 자기 파트 기준 브랜치 최신화
git checkout server
git pull origin server

# 2. 작업 브랜치 생성
git checkout -b feat/place-detail-api

# 3. 작업 후 커밋 및 push
git add .
git commit -m "feat: 장소 상세 API 구현"
git push origin feat/place-detail-api
```

### 머지 흐름 예시

- 백엔드 API 작업: `feat/place-detail-api → server → dev → main`
- 데이터 적재 작업: `data/tourapi-sync → data → dev → main`

### 운영 원칙

- 장기 브랜치: `main`, `dev`, `server`, `client`, `data`, `ai`
- 실제 개발은 짧은 작업 브랜치에서 진행
- 작업 브랜치는 보통 자기 파트 브랜치에서 분기
- 작업이 끝나면 PR로 자기 파트 브랜치에 먼저 머지
- 파트 브랜치가 정리되면 `dev`로 머지
- 최종 점검 후 `main`으로 머지
- 급한 수정이 아니면 `main`에 직접 반영하지 않음

---

## Branch Protection Rules

`main` 브랜치에 직접 push하면 실수로 전체 코드가 망가질 수 있습니다.
Branch Protection을 설정하면 PR을 통해서만 머지할 수 있도록 강제합니다.

### 설정 방법 (관리자 1회 설정)
1. 레포 **Settings → Branches** 클릭
2. **Add branch ruleset** 클릭
3. Branch name pattern에 `main` 입력
4. 아래 항목 체크:
   - **Require a pull request before merging** ✅
   - **Required approvals**: 1 ✅
5. **Save changes**

### 설정 후 작업 흐름
```
# main에 직접 push → ❌ 차단됨

# 올바른 방법
git checkout -b feat/example
git push origin feat/example
# → GitHub에서 PR 생성 → 리뷰 → 파트 브랜치/ dev에 머지
```

---

## 커밋 규칙

### 형식

```text
타입: 메시지
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

```text
feat: 지도 뷰포트 기반 장소 핀 조회 API 추가
fix: refresh token 만료 시 401 미반환 버그 수정
data: 관광공사 OpenAPI 안동 지역 장소 최초 적재
docs: OpenAPI YAML v1.2.0 업데이트
chore: 공통 환경변수 예시 파일 추가
```

---

## PR 규칙

### PR 제목 형식
커밋 컨벤션과 동일하게 작성합니다.
```
feat: 스와이프 일정짜기 기능 구현
fix: JWT refresh token 만료 처리
```

### PR 설명 템플릿
PR 생성 시 자동으로 채워집니다. 항목을 채워서 제출하세요.

### PR 크기 권장
- 가능하면 PR 1개는 한 가지 주제만 다루기
- 너무 큰 PR보다 리뷰 가능한 크기로 자주 올리기
- 문서만 수정한 PR도 제목/설명 형식은 동일하게 유지

### 머지 조건
- `작업 브랜치 → 파트 브랜치`: 셀프 체크 후 머지 가능, 가능하면 리뷰 요청
- `파트 브랜치 → dev`: 변경 영향이 크면 리뷰 1회 이상 권장
- `dev → main`: 리뷰어 1명 이상 승인 필수

### 리뷰 체크포인트
- SSOT와 충돌하지 않는가
- 관련 이슈 번호와 목적이 명확한가
- 문서/환경변수/테스트 반영이 빠지지 않았는가
- 다른 파트에 영향 주는 변경이면 설명이 적혀 있는가

### 머지 전 체크리스트
- [ ] 브랜치 대상이 맞다
- [ ] PR 제목이 컨벤션에 맞다
- [ ] 본문에 변경 이유가 적혀 있다
- [ ] `Closes #번호` 또는 관련 이슈가 연결돼 있다
- [ ] 로컬 확인 또는 수동 점검 내용을 적었다

---

## 전체 흐름 요약

```
1. 할 일 생기면 → Issue 생성 (라벨 + 마일스톤 지정)
2. 작업 브랜치 생성 후 작업하고 push
3. GitHub에서 PR 생성 (제목 형식 맞추기, Closes #이슈번호 작성)
4. 리뷰/셀프체크 후 파트 브랜치 또는 dev에 머지
5. dev 안정 확인 후 main PR 오픈
```
