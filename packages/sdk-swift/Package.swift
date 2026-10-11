// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "InvisibleDB",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "InvisibleDB", targets: ["InvisibleDB"]),
    ],
    targets: [
        .target(name: "InvisibleDB", path: "Sources/InvisibleDB"),
        .testTarget(name: "InvisibleDBTests", dependencies: ["InvisibleDB"], path: "Tests/InvisibleDBTests"),
    ]
)
