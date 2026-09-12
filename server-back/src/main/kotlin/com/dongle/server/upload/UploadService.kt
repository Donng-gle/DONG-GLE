package com.dongle.server.upload

import com.dongle.server.common.config.AwsProperties
import com.dongle.server.upload.dto.PresignedUrlRequest
import com.dongle.server.upload.dto.PresignedUrlResponse
import org.springframework.stereotype.Service
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest
import java.time.Duration
import java.util.UUID

@Service
class UploadService(
    private val s3Presigner: S3Presigner,
    private val awsProperties: AwsProperties,
) {
    fun createPresignedUrl(request: PresignedUrlRequest): PresignedUrlResponse {
        if (request.contentType !in ALLOWED_CONTENT_TYPES) {
            throw UnsupportedContentTypeException(request.contentType)
        }

        val prefix = when (request.purpose) {
            UploadPurpose.visit_log -> "visit_logs"
            UploadPurpose.profile -> "profiles"
        }
        val key = "$prefix/${UUID.randomUUID()}-${request.filename}"

        // contentType을 PutObjectRequest에 넣으면 그 값이 서명에 포함돼서, 실제 PUT 때 클라이언트가
        // 보내는 Content-Type 헤더가 한 글자라도 다르면 AWS가 SignatureDoesNotMatch로 403을 냄 —
        // React Native fetch가 Blob을 보낼 때 명시적으로 지정한 헤더를 blob 자체 타입으로 덮어쓰는
        // 경우가 있어서 실제로 이 문제가 발생함(2026-09-07 사용자 리포트, decision-log 참고).
        // Content-Type 검증(ALLOWED_CONTENT_TYPES)은 위에서 이미 했으니 서명에는 안 묶고, 실제 PUT
        // 요청이 보내는 헤더 값 그대로 S3 오브젝트 메타데이터에 저장되게 둠(서명 검증에서만 빠짐)
        val objectRequest = PutObjectRequest.builder()
            .bucket(awsProperties.s3Bucket)
            .key(key)
            .build()

        val presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(EXPIRY)
            .putObjectRequest(objectRequest)
            .build()

        val presigned = s3Presigner.presignPutObject(presignRequest)

        return PresignedUrlResponse(
            uploadUrl = presigned.url().toString(),
            fileUrl = "https://${awsProperties.s3Bucket}.s3.${awsProperties.region}.amazonaws.com/$key",
            expiresIn = EXPIRY.seconds.toInt(),
        )
    }

    companion object {
        private val EXPIRY: Duration = Duration.ofMinutes(10)
        private val ALLOWED_CONTENT_TYPES = setOf("image/jpeg", "image/png", "image/webp", "image/heic")
    }
}
