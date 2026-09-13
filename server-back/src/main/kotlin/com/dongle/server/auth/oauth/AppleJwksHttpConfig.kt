package com.dongle.server.auth.oauth

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestClient

@Configuration
class AppleJwksHttpConfig {
    // GoogleJwksHttpConfig와 동일한 이유 — JWK 필드명(kid/n/e)이 소문자 단일 단어라 기본
    // RestClient로 충분
    @Bean
    fun appleJwksRestClient(): RestClient = RestClient.create()
}
