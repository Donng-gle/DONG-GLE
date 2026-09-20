package com.dongle.server.upload

class UnsupportedContentTypeException(contentType: String) :
    RuntimeException("지원하지 않는 파일 형식입니다. content_type=$contentType")
