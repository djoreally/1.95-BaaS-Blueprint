// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "InvisibleDB",
    platforms: [.iOS(.15), .macOS(.12)],
    products: [
        .library(name: "InvisibleDB", targets: ["InvisibleDB"]),
    ],
    targets: [
        .target(name: "InvisibleDB", path: "Sources/InvisibleDB"),
    ]
)
