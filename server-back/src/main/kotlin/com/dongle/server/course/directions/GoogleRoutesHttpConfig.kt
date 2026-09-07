package com.dongle.server.course.directions

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestClient

@Configuration
class GoogleRoutesHttpConfig {

    // GoogleJwksHttpConfig처럼 컨버터를 따로 구성할 필요 없이 기본 RestClient로 충분
    // (Google Routes API가 카멜케이스 JSON을 쓰는데, 정적 팩토리 기본 컨버터가 딱 그 형식임)
    @Bean
    fun googleRoutesRestClient(): RestClient = RestClient.create()
}
