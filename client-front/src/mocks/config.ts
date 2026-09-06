// 목업 모드 스위치 — true면 api/client.ts의 request()가 실제 fetch를 아예 안 타고 handlers.ts가
// 만든 가짜 응답을 즉시 돌려줌(네트워크/백엔드/로그인 전부 무관). 로그인 화면의 "게스트로 계속하기"
// (App.tsx의 onGuestContinue)와 같이 쓰면 실제 카카오/구글 로그인 없이도 목업으로 채워진 화면들을
// 끝까지 둘러볼 수 있음.
//
// 켜는 법: client-front/.env에 EXPO_PUBLIC_USE_MOCK=true 추가 후 Metro 재시작(env 변경은
// Fast Refresh로 안 잡히고 번들러 재시작 필요). 다른 값이거나 없으면 기본 false(실제 서버로 나감) —
// 실수로 배포 빌드에 목업이 섞여 나가는 일 없게 기본은 항상 꺼짐.
export const MOCK_ENABLED = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

// 네트워크 요청처럼 살짝 지연을 흉내내고 싶을 때 쓰는 값(ms). 0이면 즉시 응답.
// 로딩 스피너/스켈레톤 UI가 실제로 잠깐이라도 보이는지 확인하고 싶을 때 늘려서 테스트.
export const MOCK_DELAY_MS = 200;
