package com.dongle.server.recommend

import com.dongle.server.common.config.AiServerProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.web.client.RestClient
import tools.jackson.databind.PropertyNamingStrategies
import tools.jackson.databind.json.JsonMapper

// CourseOptimizerHttpConfig와 동일한 이유로 SNAKE_CASE 컨버터를 직접 구성해 꽂는다
// (place_recommender도 Pydantic 모델 기반이라 snake_case 계약)
@Configuration
class PlaceRecommenderHttpConfig(
    private val aiServerProperties: AiServerProperties,
) {
    @Bean
    fun placeRecommenderRestClient(): RestClient {
        val mapper = JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .build()

        // CourseOptimizerHttpConfig와 동일한 이유로 타임아웃을 명시 (2026-09-01 결정, decision-log 참고)
        val requestFactory = SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(5_000)
            setReadTimeout(15_000)
        }

        return RestClient.builder()
            .baseUrl(aiServerProperties.baseUrl)
            .requestFactory(requestFactory)
            .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }
            .build()
    }
}
