package com.dongle.server.upload.dto

data class PresignedUrlResponse(
    val uploadUrl: String,
    val fileUrl: String,
    val expiresIn: Int,
)
