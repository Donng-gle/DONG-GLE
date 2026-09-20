package com.dongle.server.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "google")
data class GoogleProperties(
    val placesApiKey: String,
)
