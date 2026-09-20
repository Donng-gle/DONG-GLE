package com.dongle.server.image

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.net.http.HttpClient

@Configuration
class GooglePlacesImageConfig {

    // Google Places Photo API(/maps/api/place/photo)는 실제 이미지 바이너리가 있는 CDN URL로 302 리다이렉트한다.
    // 기본 JDK HttpClient는 리다이렉트를 따라가지 않으므로 명시적으로 설정한다.
    @Bean
    fun googlePlacesRestClient(): RestClient {
        val httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build()

        return RestClient.builder()
            .requestFactory(JdkClientHttpRequestFactory(httpClient))
            .build()
    }
}
