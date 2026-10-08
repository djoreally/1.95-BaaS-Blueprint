plugins {
    kotlin("jvm") version "1.9.22"
}

group = "app.invisibledb"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.json:json:20231013")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
