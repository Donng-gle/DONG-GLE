package com.dongle.server

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class DongleServerApplication

fun main(args: Array<String>) {
	runApplication<DongleServerApplication>(*args)
}
