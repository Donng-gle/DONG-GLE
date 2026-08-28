package com.dongle.server.onboarding

import com.dongle.server.onboarding.dto.TagsResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/tags")
class TagController {

    @GetMapping
    fun getTags(): TagsResponse = TagsResponse(tags = TagCatalog.TAGS)
}
