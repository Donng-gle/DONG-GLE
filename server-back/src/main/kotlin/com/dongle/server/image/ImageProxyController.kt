package com.dongle.server.image

import org.springframework.core.io.ClassPathResource
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.concurrent.TimeUnit

@RestController
@RequestMapping("/images")
class ImageProxyController(
    private val imageProxyService: ImageProxyService,
) {
    // Google Places 사진은 URL 자체에 API 키가 필요해 DB/앱에 직접 노출할 수 없다.
    // place_image.img_url에는 이 프록시 URL(ref=photo_reference)을 저장해 앱이 키 없이 바로 로드하게 한다.
    @GetMapping("/proxy")
    fun proxyGooglePlacesPhoto(
        @RequestParam ref: String,
        @RequestParam(required = false, defaultValue = "800") maxWidth: Int,
    ): ResponseEntity<ByteArray> {
        // photo_reference는 DB에 영구 URL처럼 박혀있지만 Google 쪽에서 만료될 수 있는 토큰이고,
        // 이 프로젝트는 place_id를 저장해두지 않아 재발급이 불가능하다(2026-09-14 확인, 근본 수정은
        // 데이터 파트 협의 필요). 그렇다고 502를 그대로 내려주면 RN <Image>가 onError 처리도 없이
        // 그냥 빈 화면이 되니, 최소한 placeholder 이미지라도 200으로 내려줘서 앱이 항상 뭔가는
        // 그리게 한다.
        val image = try {
            imageProxyService.fetchPhoto(ref, maxWidth)
        } catch (e: ImageProxyUpstreamException) {
            return placeholderResponse()
        }

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(image.contentType))
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=${TimeUnit.DAYS.toSeconds(1)}")
            .body(image.body)
    }

    private fun placeholderResponse(): ResponseEntity<ByteArray> =
        ResponseEntity.ok()
            .contentType(MediaType.IMAGE_PNG)
            // 원본 사진과 달리 오래 캐시해두지 않음 — 나중에 데이터가 정리돼 정상 사진으로
            // 바뀔 수 있으니 클라이언트/CDN이 실패 응답을 하루씩 붙들고 있지 않게 짧게 둔다.
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=${TimeUnit.HOURS.toSeconds(1)}")
            .body(PLACEHOLDER_IMAGE_BYTES)

    companion object {
        private val PLACEHOLDER_IMAGE_BYTES: ByteArray =
            ClassPathResource("images/place-placeholder.png").inputStream.use { it.readBytes() }
    }
}
