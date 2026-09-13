package com.dongle.server.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "oauth")
data class OAuthProperties(
    val kakao: Provider,
    val google: Provider,
    val apple: AppleProvider,
) {
    data class Provider(
        val clientId: String,
        val clientSecret: String = "",
        val redirectUri: String,
    )

    // 애플은 ID 토큰 서명·issuer·audience만 검증하고(구글과 동일 방식) code→token 교환을 안 해서
    // client_secret/redirect_uri가 필요 없다. clientId는 네이티브 Sign in with Apple ID 토큰의
    // audience(=앱 번들 ID, com.dongle.andong)와 일치해야 함
    data class AppleProvider(
        val clientId: String,
    )
}
