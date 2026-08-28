package com.dongle.server

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class DongleServerApplication

fun main(args: Array<String>) {
	runApplication<DongleServerApplication>(*args)
}
