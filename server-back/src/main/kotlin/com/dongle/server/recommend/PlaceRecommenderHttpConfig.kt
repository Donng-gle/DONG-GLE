package com.dongle.server.recommend

import com.dongle.server.common.config.PlaceRecommenderProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.web.client.RestClient
import tools.jackson.databind.PropertyNamingStrategies
import tools.jackson.databind.json.JsonMapper

// CourseOptimizerHttpConfig와 동일한 이유로 SNAKE_CASE 컨버터를 직접 구성해 꽂는다
// (place_recommender도 Pydantic 모델 기반이라 snake_case 계약)
@Configuration
class PlaceRecommenderHttpConfig(
    private val placeRecommenderProperties: PlaceRecommenderProperties,
) {
    @Bean
    fun placeRecommenderRestClient(): RestClient {
        val mapper = JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .build()

        return RestClient.builder()
            .baseUrl(placeRecommenderProperties.baseUrl)
            .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }
            .build()
    }
}
