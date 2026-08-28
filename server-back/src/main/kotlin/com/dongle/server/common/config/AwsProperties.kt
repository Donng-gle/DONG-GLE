package com.dongle.server.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "aws")
data class AwsProperties(
    val region: String,
    val accessKeyId: String,
    val secretAccessKey: String,
    val s3Bucket: String,
)
