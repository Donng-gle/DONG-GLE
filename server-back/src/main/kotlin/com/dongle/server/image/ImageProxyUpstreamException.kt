package com.dongle.server.image

class ImageProxyUpstreamException(cause: Throwable) :
    RuntimeException("Google Places 이미지를 가져오지 못했습니다.", cause)
