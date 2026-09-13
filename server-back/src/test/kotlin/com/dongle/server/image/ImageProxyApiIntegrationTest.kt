package com.dongle.server.image

import org.hamcrest.Matchers.startsWith
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.client.RestClient

// Google Places Photo API에 실제 네트워크 요청을 보내지 않도록, 테스트 전용 RestClient를
// MockRestServiceServer에 바인딩해서 googlePlacesRestClient 빈을 대체한다 (@Primary).
// GOOGLE_MAPS_API_KEY 없이도 프록시 로직(URL 구성, 성공/실패 응답 처리) 검증 가능.
@SpringBootTest
@AutoConfigureMockMvc
class ImageProxyApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @AfterEach
    fun resetMockServer() {
        mockServer.reset()
    }

    @TestConfiguration
    class MockGoogleRestClientConfig {
        @Bean
        @Primary
        fun testGooglePlacesRestClient(): RestClient {
            val builder = RestClient.builder()
            mockServer = MockRestServiceServer.bindTo(builder).build()
            return builder.build()
        }
    }

    companion object {
        private lateinit var mockServer: MockRestServiceServer
    }

    @Test
    fun `유효한 photo_reference로 요청하면 이미지 바이트를 그대로 반환한다`() {
        val fakeImageBytes = byteArrayOf(1, 2, 3, 4)

        mockServer.expect(requestTo(startsWith("https://maps.googleapis.com/maps/api/place/photo")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("photo_reference", "test-ref-1"))
            .andExpect(queryParam("maxwidth", "800"))
            .andRespond(withSuccess(fakeImageBytes, MediaType.IMAGE_JPEG))

        mockMvc.perform(get("/images/proxy").param("ref", "test-ref-1"))
            .andExpect(status().isOk)
            .andExpect(content().contentType(MediaType.IMAGE_JPEG))
            .andExpect(content().bytes(fakeImageBytes))

        mockServer.verify()
    }

    @Test
    fun `photo_reference가 비어있으면 400을 반환한다`() {
        mockMvc.perform(get("/images/proxy").param("ref", ""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("INVALID_PHOTO_REFERENCE"))
    }

    @Test
    fun `Google API 요청이 실패하면 502 대신 placeholder 이미지를 200으로 반환한다`() {
        // photo_reference 만료 등으로 upstream이 실패해도, RN <Image>가 그릴 수 있게 항상 이미지
        // 바이트를 내려준다(2026-09-14, 502로 죽이면 앱이 아무 것도 못 그리는 문제 수정)
        mockServer.expect(requestTo(startsWith("https://maps.googleapis.com/maps/api/place/photo")))
            .andRespond(withStatus(HttpStatus.NOT_FOUND))

        mockMvc.perform(get("/images/proxy").param("ref", "missing-ref"))
            .andExpect(status().isOk)
            .andExpect(content().contentType(MediaType.IMAGE_PNG))

        mockServer.verify()
    }
}
