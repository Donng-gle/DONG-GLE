package com.dongle.server.place

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import java.time.LocalDate

@Entity
@Table(name = "place")
class Place(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "content_id", nullable = false, unique = true)
    val contentId: String,

    @Column(name = "content_type_id", nullable = false)
    val contentTypeId: Int,

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false)
    val category: PlaceCategory,

    @Column(name = "name", nullable = false)
    val name: String,

    val addr1: String? = null,
    val addr2: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val tel: String? = null,

    @Column(name = "main_image_url")
    val mainImageUrl: String? = null,

    val overview: String? = null,
    val homepage: String? = null,

    @Column(name = "event_start_date")
    val eventStartDate: LocalDate? = null,

    @Column(name = "event_end_date")
    val eventEndDate: LocalDate? = null,

    @Column(name = "visit_log_count", nullable = false)
    var visitLogCount: Int = 0,

    @OneToMany(mappedBy = "place", fetch = FetchType.LAZY)
    @OrderBy("sortOrder asc")
    val images: List<PlaceImage> = emptyList(),
)
