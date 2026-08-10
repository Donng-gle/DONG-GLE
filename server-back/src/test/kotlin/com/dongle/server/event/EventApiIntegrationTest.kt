package com.dongle.server.event

import com.dongle.server.place.Place
import com.dongle.server.place.PlaceCategory
import com.dongle.server.place.PlaceRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.YearMonth

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EventApiIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var placeRepository: PlaceRepository

    private fun festival(contentId: String, name: String, start: LocalDate, end: LocalDate) = placeRepository.save(
        Place(
            contentId = contentId,
            contentTypeId = 15,
            category = PlaceCategory.축제행사,
            name = name,
            addr1 = "경북 안동시",
            eventStartDate = start,
            eventEndDate = end,
        )
    )

    @Test
    fun `요청한 월에 걸치는 행사만 조회되고 진행중이면 d_day가 0이다`() {
        val today = LocalDate.now()
        val month = YearMonth.from(today)
        festival("EVT001", "테스트전용축제-진행중", today.minusDays(1), today.plusDays(1))
        festival("EVT002", "테스트전용축제-다음달", month.plusMonths(2).atDay(1), month.plusMonths(2).atDay(3))

        mockMvc.perform(get("/events").param("month", month.toString()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.events[?(@.name == '테스트전용축제-진행중' && @.d_day == 0)]").exists())
            .andExpect(jsonPath("$.events[?(@.name == '테스트전용축제-다음달')]").doesNotExist())
    }

    @Test
    fun `인증 없이도 조회 가능하다`() {
        mockMvc.perform(get("/events"))
            .andExpect(status().isOk)
    }
}
