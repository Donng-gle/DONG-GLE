// "다른 유저들" 목업 — 현재 API 스펙엔 유저 목록 엔드포인트가 따로 없어서(explore.similarLogs가
// 기록마다 nickname/profile_image_url을 직접 들고 있음, api/explore.ts 참고) 별도 조회 API는 없지만,
// 여러 기록에 같은 작성자를 일관되게 재사용하기 위해 fixture로 따로 둠.
export interface MockUser {
  id: number;
  nickname: string;
  profile_image_url: string;
}

export const MOCK_USERS: MockUser[] = [
  { id: 101, nickname: '지민', profile_image_url: 'https://i.pravatar.cc/150?img=12' },
  { id: 102, nickname: '하은', profile_image_url: 'https://i.pravatar.cc/150?img=25' },
  { id: 103, nickname: '서연', profile_image_url: 'https://i.pravatar.cc/150?img=33' },
  { id: 104, nickname: '도윤', profile_image_url: 'https://i.pravatar.cc/150?img=51' },
  { id: 105, nickname: '예준', profile_image_url: 'https://i.pravatar.cc/150?img=60' },
  { id: 106, nickname: '아린', profile_image_url: 'https://i.pravatar.cc/150?img=47' },
];
