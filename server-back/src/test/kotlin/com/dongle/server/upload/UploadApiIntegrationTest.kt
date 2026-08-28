package com.dongle.server.upload

import com.dongle.server.auth.jwt.JwtTokenProvider
import com.dongle.server.user.OAuthProvider
import com.dongle.server.user.User
import com.dongle.server.user.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

// presigned URL 발급은 로컬에서 서명만 계산할 뿐 실제 S3에 네트워크 요청을 보내지 않으므로
// 진짜 AWS 자격증명 없이도(테스트용 값으로도) 정상 동작 검증이 가능함
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UploadApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider

    private fun accessTokenFor(userId: String, oauthId: String): String {
        val user = userRepository.save(
            User(userId = userId, nickname = "테스터", oauthProvider = OAuthProvider.kakao, oauthId = oauthId)
        )
        return jwtTokenProvider.generateAccessToken(user.id)
    }

    @Test
    fun `presigned URL을 발급받을 수 있다`() {
        val token = accessTokenFor("upload_user_1", "kakao-upload-1")

        mockMvc.perform(
            post("/uploads/presigned-url")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"filename":"photo.jpg","content_type":"image/jpeg","purpose":"visit_log"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.upload_url").exists())
            .andExpect(jsonPath("$.file_url").value(org.hamcrest.Matchers.containsString("visit_logs/")))
            .andExpect(jsonPath("$.expires_in").value(600))
    }

    @Test
    fun `profile 목적이면 profiles 경로로 저장된다`() {
        val token = accessTokenFor("upload_user_2", "kakao-upload-2")

        mockMvc.perform(
            post("/uploads/presigned-url")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"filename":"avatar.png","content_type":"image/png","purpose":"profile"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.file_url").value(org.hamcrest.Matchers.containsString("profiles/")))
    }

    @Test
    fun `지원하지 않는 파일 형식이면 400을 반환한다`() {
        val token = accessTokenFor("upload_user_3", "kakao-upload-3")

        mockMvc.perform(
            post("/uploads/presigned-url")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"filename":"video.mp4","content_type":"video/mp4","purpose":"visit_log"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_CONTENT_TYPE"))
    }

    @Test
    fun `인증 없이 호출하면 401을 반환한다`() {
        mockMvc.perform(
            post("/uploads/presigned-url")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"filename":"photo.jpg","content_type":"image/jpeg","purpose":"visit_log"}""")
        )
            .andExpect(status().isUnauthorized)
    }
}
