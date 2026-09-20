package com.dongle.server.support

import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

// 앱스토어 심사 등에서 문의 연락처 확인용으로 서비스 루트("/")에 붙이는 최소 안내 페이지.
// SecurityConfig의 permitAllPaths에 "/"도 추가해야 인증 없이 열림.
@RestController
class SupportController {

    @GetMapping("/")
    fun support(): ResponseEntity<String> =
        ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
            .body(SUPPORT_HTML)

    companion object {
        private const val SUPPORT_HTML = """<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>동글 문의</title></head>
<body>
<h1>동글(Dong_Gle)</h1>
<p>앱 문제, 일반 피드백, 기능 개선 요청은 아래 이메일로 연락해 주세요.</p>
<p>이메일: <a href="mailto:tjfakstn04@gmail.com">tjfakstn04@gmail.com</a></p>
</body>
</html>"""
    }
}
