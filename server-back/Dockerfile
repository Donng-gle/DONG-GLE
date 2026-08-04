FROM eclipse-temurin:22-jdk AS build
WORKDIR /app

COPY gradlew gradlew.bat ./
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon || true

COPY src src
RUN ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:22-jre AS runtime
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080
# Render 무료 플랜(512MB) 안에서 안정적으로 뜨도록 힙/메타스페이스/GC를 보수적으로 제한.
# TieredStopAtLevel=1은 C2 JIT을 꺼서 메모리를 아끼는 대신 피크 처리량이 낮아지지만,
# 이 서비스 규모(공모전 데모)에는 영향 없음.
ENTRYPOINT ["java", \
    "-Xmx256m", "-Xss512k", "-XX:MaxMetaspaceSize=128m", \
    "-XX:ReservedCodeCacheSize=64m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", \
    "-jar", "app.jar"]
