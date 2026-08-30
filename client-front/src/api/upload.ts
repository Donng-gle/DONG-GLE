import { apiClient } from './client';

export type UploadPurpose = 'visit_log' | 'profile';

export interface PresignedUrlRequest {
  filename: string;
  content_type: string;
  purpose?: UploadPurpose; // 생략 시 서버 기본값 visit_log
}

export interface PresignedUrlResponse {
  upload_url: string; // 이 주소로 파일 바이너리를 PUT하면 S3에 업로드됨
  file_url: string; // 업로드 완료 후 실제 접근 가능한 URL — VisitLogCreateRequest.photo_url 등에 사용
  expires_in: number; // upload_url 유효 시간(초)
}

// 실제 "사진 선택 → 업로드" 흐름은 expo-image-picker 등 피커 라이브러리 도입 후 완성 가능.
// 요청 함수 자체는 순수 request/response라 미리 준비해둠 (아직 호출하는 화면 없음)
export const uploadApi = {
  getPresignedUrl: (request: PresignedUrlRequest) =>
    apiClient.post<PresignedUrlResponse>('/uploads/presigned-url', request, true),

  // presigned URL로 실제 파일(Blob/ArrayBuffer)을 PUT 업로드. auth 헤더 불필요(URL 자체에 서명 포함)
  uploadFile: async (uploadUrl: string, file: Blob, contentType: string) => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`파일 업로드에 실패했어요 (status ${response.status})`);
    }
  },
};
