package com.dongle.server.upload

import com.dongle.server.upload.dto.PresignedUrlRequest
import com.dongle.server.upload.dto.PresignedUrlResponse
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/uploads")
class UploadController(
    private val uploadService: UploadService,
) {
    @PostMapping("/presigned-url")
    fun createPresignedUrl(@Valid @RequestBody request: PresignedUrlRequest): PresignedUrlResponse =
        uploadService.createPresignedUrl(request)
}
