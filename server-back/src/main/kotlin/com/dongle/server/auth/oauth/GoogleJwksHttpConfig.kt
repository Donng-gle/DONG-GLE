package com.dongle.server.auth.oauth

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestClient

@Configuration
class GoogleJwksHttpConfig {
    // JWK 필드명(kid/n/e)이 이미 소문자 단일 단어라 Jackson 네이밍 전략(SNAKE_CASE) 영향을 안 받음 —
    // CourseOptimizerHttpConfig처럼 컨버터를 따로 구성할 필요 없이 기본 RestClient로 충분
    @Bean
    fun googleJwksRestClient(): RestClient = RestClient.create()
}
