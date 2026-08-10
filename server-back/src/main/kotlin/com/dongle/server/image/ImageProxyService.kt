package com.dongle.server.image

import com.dongle.server.common.config.GoogleProperties
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.util.UriComponentsBuilder

@Service
class ImageProxyService(
    private val googlePlacesRestClient: RestClient,
    private val googleProperties: GoogleProperties,
) {
    fun fetchPhoto(photoReference: String, maxWidth: Int): ProxiedImage {
        if (photoReference.isBlank()) {
            throw InvalidPhotoReferenceException()
        }

        val uri = UriComponentsBuilder.fromUriString(GOOGLE_PHOTO_ENDPOINT)
            .queryParam("maxwidth", maxWidth.coerceIn(MIN_WIDTH, MAX_WIDTH))
            .queryParam("photo_reference", photoReference)
            .queryParam("key", googleProperties.placesApiKey)
            .build()
            .encode()
            .toUri()

        val response = try {
            googlePlacesRestClient.get()
                .uri(uri)
                .retrieve()
                .toEntity(ByteArray::class.java)
        } catch (e: RestClientException) {
            throw ImageProxyUpstreamException(e)
        }

        val body = response.body ?: throw ImageProxyUpstreamException(IllegalStateException("빈 응답 본문"))
        val contentType = response.headers.contentType?.toString() ?: "image/jpeg"

        return ProxiedImage(body = body, contentType = contentType)
    }

    companion object {
        private const val GOOGLE_PHOTO_ENDPOINT = "https://maps.googleapis.com/maps/api/place/photo"
        private const val MIN_WIDTH = 100
        private const val MAX_WIDTH = 1600
    }
}
