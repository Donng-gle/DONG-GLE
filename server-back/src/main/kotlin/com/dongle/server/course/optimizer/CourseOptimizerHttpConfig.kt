package com.dongle.server.course.optimizer

import com.dongle.server.common.config.AiServerProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.web.client.RestClient
import tools.jackson.databind.PropertyNamingStrategies
import tools.jackson.databind.json.JsonMapper

@Configuration
class CourseOptimizerHttpConfig(
    private val aiServerProperties: AiServerProperties,
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

        // AI 서버가 이제 로컬이 아니라 실제 네트워크 너머(EC2)에 있어서 기본(무제한) 타임아웃으로 두면
        // 서버가 죽거나 응답이 느릴 때 요청 스레드가 무한정 걸릴 수 있음. 코스 최적화는 LLM 호출을
        // 포함해 시간이 걸릴 수 있어 read timeout을 넉넉히 둠 (2026-09-01 결정, decision-log 참고)
        //
        // 30s → 60s로 상향(2026-09-12): 후보 19개로 실제 요청했을 때 SocketTimeoutException(Read
        // timed out)으로 30초도 넘김을 Render 로그로 실측 확인(사용자 리포트) — 임시 완화 조치이고,
        // 이 정도 후보 수/시간 범위에서 원래 이렇게 느린 게 정상인지는 AI 서버 쪽(김지광) 확인 필요
        val requestFactory = SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(5_000)
            setReadTimeout(60_000)
        }

        return RestClient.builder()
            .baseUrl(aiServerProperties.baseUrl)
            .requestFactory(requestFactory)
            .messageConverters { it.add(0, JacksonJsonHttpMessageConverter(mapper)) }
            .build()
    }
}
