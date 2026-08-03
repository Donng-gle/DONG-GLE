package com.dongle.server.image

data class ProxiedImage(
    val body: ByteArray,
    val contentType: String,
)
