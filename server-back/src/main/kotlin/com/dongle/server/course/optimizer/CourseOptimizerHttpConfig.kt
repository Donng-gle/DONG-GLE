package com.dongle.server.course.optimizer

import com.dongle.server.common.config.CourseOptimizerProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.web.client.RestClient
import tools.jackson.databind.PropertyNamingStrategies
import tools.jackson.databind.json.JsonMapper

@Configuration
class CourseOptimizerHttpConfig(
    private val courseOptimizerProperties: CourseOptimizerProperties,
) {
    // 이 프로젝트엔 자동구성된 RestClient.Builder 빈이 없다 (KakaoOAuthClient/GooglePlacesImageConfig도
    // 정적 팩토리 RestClient.create()/builder()를 쓰는 이유). 정적 팩토리의 기본 컨버터는
    // application.yml의 전역 Jackson 설정(SNAKE_CASE)을 안 물려받으므로, course_optimizer(snake_case
    // Pydantic 모델)와 직렬화가 맞도록 동일한 네이밍 전략의 컨버터를 직접 구성해 꽂는다
    @Bean
    fun courseOptimizerRestClient(): RestClient {
        val mapper = JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .build()

        return RestClient.builder()
            .baseUrl(courseOptimizerProperties.baseUrl)
            .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }
            .build()
    }
}
