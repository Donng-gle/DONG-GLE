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
ENTRYPOINT ["java", "-jar", "app.jar"]
