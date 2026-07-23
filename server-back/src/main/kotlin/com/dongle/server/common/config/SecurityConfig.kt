package com.dongle.server.common.config

import com.dongle.server.auth.jwt.JwtAuthenticationFilter
import com.dongle.server.auth.jwt.JwtTokenProvider
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val jwtTokenProvider: JwtTokenProvider,
    private val restAuthenticationEntryPoint: RestAuthenticationEntryPoint,
) {
    // GET /places, /places/** 는 비인증 조회 허용 (PlaceController security: [] 참고)
    private val permitAllPaths = arrayOf(
        "/auth/oauth/kakao",
        "/auth/oauth/google",
        "/auth/refresh",
        "/places",
        "/places/**",
        "/error",
    )

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers(*permitAllPaths).permitAll()
                it.anyRequest().authenticated()
            }
            .exceptionHandling { it.authenticationEntryPoint(restAuthenticationEntryPoint) }
            .addFilterBefore(JwtAuthenticationFilter(jwtTokenProvider), UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }
}
