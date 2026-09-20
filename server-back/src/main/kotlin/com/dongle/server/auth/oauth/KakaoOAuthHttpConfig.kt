package com.dongle.server.auth.oauth

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.web.client.RestClient
import tools.jackson.databind.PropertyNamingStrategies
import tools.jackson.databind.json.JsonMapper

@Configuration
class KakaoOAuthHttpConfig {
    // KakaoOAuthClient가 기존엔 RestClient.create()(정적 팩토리)를 직접 썼는데, 이 기본 컨버터는
    // application.yml의 전역 Jackson 설정(SNAKE_CASE)을 안 물려받는다 (CourseOptimizerHttpConfig 주석 참고).
    // 카카오 토큰/사용자 정보 응답은 access_token, kakao_account, profile_image_url처럼 실제로 스네이크케이스라
    // 그동안 KakaoTokenResponse.accessToken 등이 전부 null로 역직렬화되고 있었음 (2026-08-31 실기기 테스트 중 발견,
    // decision-log 참고). course_optimizer와 동일한 방식으로 SNAKE_CASE 컨버터를 직접 구성해 꽂는다
    @Bean
    fun kakaoOAuthRestClient(): RestClient {
        val mapper = JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .build()

        return RestClient.builder()
            .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }
            .build()
    }
}
