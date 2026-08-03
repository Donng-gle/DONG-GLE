package com.dongle.server.image

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
        val image = imageProxyService.fetchPhoto(ref, maxWidth)

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(image.contentType))
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=${TimeUnit.DAYS.toSeconds(1)}")
            .body(image.body)
    }
}
