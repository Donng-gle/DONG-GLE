package com.dongle.server.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "oauth")
data class OAuthProperties(
    val kakao: Provider,
    val google: Provider,
) {
    data class Provider(
        val clientId: String,
        val clientSecret: String = "",
        val redirectUri: String,
    )
}
