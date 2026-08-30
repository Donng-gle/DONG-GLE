package com.dongle.server.swipe

import org.springframework.data.jpa.repository.JpaRepository

interface SwipeSessionRepository : JpaRepository<SwipeSession, String>
