package com.dongle.server.course

import com.dongle.server.course.dto.CourseDetailResponse
import com.dongle.server.course.dto.CourseGenerateRequest
import com.dongle.server.course.dto.CourseGenerateResponse
import com.dongle.server.course.dto.CourseManualRequest
import com.dongle.server.course.dto.CourseSaveRequest
import com.dongle.server.course.dto.CourseSaveResponse
import com.dongle.server.course.dto.CourseUpdateRequest
import com.dongle.server.course.dto.MyCoursesResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class CourseController(
    private val courseService: CourseService,
) {
    @GetMapping("/users/me/courses")
    fun myCourses(
        authentication: Authentication,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): MyCoursesResponse = courseService.myCourses(authentication.userId(), page, size)

    @PostMapping("/courses/generate")
    fun generate(
        authentication: Authentication,
        @Valid @RequestBody request: CourseGenerateRequest,
    ): CourseGenerateResponse = courseService.generate(authentication.userId(), request)

    @PostMapping("/courses")
    fun save(
        authentication: Authentication,
        @Valid @RequestBody request: CourseSaveRequest,
    ): ResponseEntity<CourseSaveResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(courseService.save(authentication.userId(), request))

    @PostMapping("/courses/manual")
    fun saveManual(
        authentication: Authentication,
        @Valid @RequestBody request: CourseManualRequest,
    ): ResponseEntity<CourseSaveResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(courseService.saveManual(authentication.userId(), request))

    @GetMapping("/courses/{courseId}")
    fun getDetail(authentication: Authentication, @PathVariable courseId: Long): CourseDetailResponse =
        courseService.getDetail(authentication.userId(), courseId)

    @PatchMapping("/courses/{courseId}")
    fun update(
        authentication: Authentication,
        @PathVariable courseId: Long,
        @Valid @RequestBody request: CourseUpdateRequest,
    ): CourseDetailResponse = courseService.update(authentication.userId(), courseId, request)

    @DeleteMapping("/courses/{courseId}")
    fun delete(authentication: Authentication, @PathVariable courseId: Long): ResponseEntity<Unit> {
        courseService.delete(authentication.userId(), courseId)
        return ResponseEntity.noContent().build()
    }
}

private fun Authentication.userId(): Long = principal as Long
