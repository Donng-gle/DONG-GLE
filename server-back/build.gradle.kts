plugins {
	kotlin("jvm") version "2.3.21"
	kotlin("plugin.spring") version "2.3.21"
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
	kotlin("plugin.jpa") version "2.3.21"
}

group = "com.dongle"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(22)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation(platform("software.amazon.awssdk:bom:2.49.6"))

	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	implementation("tools.jackson.module:jackson-module-kotlin")
	implementation("io.jsonwebtoken:jjwt-api:0.12.6")
	implementation("software.amazon.awssdk:s3")
	runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-gson:0.12.6")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.springframework.security:spring-security-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
	compilerOptions {
		freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
	}
}

allOpen {
	annotation("jakarta.persistence.Entity")
	annotation("jakarta.persistence.MappedSuperclass")
	annotation("jakarta.persistence.Embeddable")
}

// 로컬 개발용: .env 파일을 읽어서 bootRun/test 프로세스의 환경변수로 주입.
// 배포 환경에서는 호스팅 플랫폼이 직접 환경변수를 주입하므로 .env 파일이 필요 없음.
fun loadEnvFile(): Map<String, String> {
	val envFile = rootProject.file(".env")
	if (!envFile.exists()) return emptyMap()
	return envFile.readLines()
		.filter { it.isNotBlank() && !it.trimStart().startsWith("#") }
		.mapNotNull { line ->
			val idx = line.indexOf('=')
			if (idx < 0) null else line.substring(0, idx).trim() to line.substring(idx + 1).trim()
		}
		.toMap()
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
	environment(loadEnvFile())
}

tasks.withType<Test> {
	useJUnitPlatform()
	// "test" 프로파일 강제 활성화 → src/test/resources/application-test.yml이 병합 적용됨
	// (현재는 Hikari maximum-pool-size만 낮춤. 공용 Supabase pooler 커넥션 한도 관련,
	// docs/decision-log.md 2026-08-30 "(관찰)" 항목 참고). 운영(main resources) 설정에는 영향 없음
	environment(loadEnvFile() + ("SPRING_PROFILES_ACTIVE" to "test"))
}
