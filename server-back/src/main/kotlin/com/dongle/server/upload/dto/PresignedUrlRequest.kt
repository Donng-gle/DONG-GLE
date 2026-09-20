package com.dongle.server.upload.dto

import com.dongle.server.upload.UploadPurpose
import jakarta.validation.constraints.NotBlank

data class PresignedUrlRequest(
    @field:NotBlank
    val filename: String,
    @field:NotBlank
    val contentType: String,
    val purpose: UploadPurpose = UploadPurpose.visit_log,
)
