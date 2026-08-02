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

        val objectRequest = PutObjectRequest.builder()
            .bucket(awsProperties.s3Bucket)
            .key(key)
            .contentType(request.contentType)
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
