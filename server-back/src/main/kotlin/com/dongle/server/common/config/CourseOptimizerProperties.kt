package com.dongle.server.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "course-optimizer")
data class CourseOptimizerProperties(
    val baseUrl: String,
)
