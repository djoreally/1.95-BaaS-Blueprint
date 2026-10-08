plugins {
    kotlin("jvm") version "1.9.22"
}

group = "app.invisibledb"
version = "0.2.0"

repositories { mavenCentral() }

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")
    testImplementation(kotlin("test"))
}

tasks.test { useJUnitPlatform() }
