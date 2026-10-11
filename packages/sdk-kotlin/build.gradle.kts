plugins {
    kotlin("jvm") version "1.9.22"
}

group = "app.invisibledb"
version = "0.2.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.json:json:20231013")
    testImplementation(kotlin("test"))
}

kotlin {
    jvmToolchain(17)
}

tasks.test {
    useJUnitPlatform()
}
