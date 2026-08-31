// Figma 디자인이 Pretendard Regular/Medium/SemiBold/Bold 네 가지 굵기만 사용 —
// React Native는 fontWeight로 굵기를 못 바꾸고 파일명이 곧 fontFamily라 여기서 이름을 고정해둔다.
// 실제 로드는 App.tsx의 useFonts에서 한 번만 수행됨.
export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semiBold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  // "Dong_Gle" 워드마크 전용 — 헤더에서만 사용 (Figma 노드 506:11141 등)
  logo: 'SquadaOne-Regular',
} as const;
