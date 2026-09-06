// Figma 디자인 문서(페이지 "디자인")에서 화면마다 반복 확인된 공용 색상.
// 화면별로 새 색이 나오면 여기 추가하고, 화면 로컬 StyleSheet에 하드코딩하지 않는다.
export const colors = {
  black: '#111111',
  gray700: '#505050',
  gray500: '#767676',
  gray400: '#999999',
  border: '#e5e5ec',
  divider: '#dddddd',
  white: '#ffffff',
  backgroundMuted: '#f7f7fb',
  // Figma엔 삭제/탈퇴류 파괴적 액션 시안이 없어서 코드에서 쓰던 임시값(#d33)을 토큰화만 함
  danger: '#d33',
  // "메인 페이지-나의 일지-기록하기"(593:12613) "확인" 버튼 텍스트 색 — 앱 전체가 흑백 톤인데
  // 이 화면에만 유일하게 등장(2026-09-05 확인)
  accentBlue: '#0066ff',
  // "직접 일정 만들기-기본화면"(501:12088) 지도 위 번호 핀 배경 — 옅은 분홍(2026-09-06 실측)
  pinBackground: '#fcf3f6',
} as const;
