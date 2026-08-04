package com.dongle.server.course

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface CourseRepository : JpaRepository<Course, Long> {

    fun findByUserId(userId: Long, pageable: Pageable): Page<Course>
}
