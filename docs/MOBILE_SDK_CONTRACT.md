# InvisibleDB Mobile SDK Contract

InvisibleDB's mobile SDKs are product surfaces, not REST aliases.

Every certified mobile SDK must implement the same backend capabilities and add platform-native behavior appropriate to mobile lifecycle constraints.

## Required contract

| Capability | React Native | Swift/iOS | Kotlin/Android |
|---|---|---|---|
| User/password auth | built | built | built |
| API-key mode for trusted/server runtimes | built | built | built |
| Durable session abstraction | built | Keychain built-in | TokenStore abstraction |
| CRUD/list/filter/sort/expand | built | built | built |
| Multipart file create/update | built | built | built |
| File URLs | built | built | built |
| Vector query | built | built | built |
| Health/liveness | built | built | built |
| Request timeout | built | built | built |
| Retry/backoff | built | built | built |
| Realtime SSE | built via injected EventSource | native URLSession stream | native OkHttp SSE |
| Mobile lifecycle reconnect | AppState-aware | caller re-subscribes after background cancellation | caller re-subscribes from lifecycle owner |

## Security rule

Do not ship an InvisibleDB instance API key in an App Store/Play Store/React Native bundle. Consumer mobile apps authenticate as collection users. The instance API key remains for trusted server runtimes, CI, admin tooling, MCP, and local development.

## Certification gates

A platform may be advertised as a first-class SDK only after:

1. package compiles on its native toolchain;
2. auth session survives an app restart using the documented secure store;
3. create/read/update/delete passes against a live InvisibleDB tenant;
4. multipart file upload passes;
5. vector query passes when the tenant has vector support;
6. realtime reconnect passes across background → foreground;
7. invalid credentials, timeout, 429 and 5xx paths return deterministic SDK errors.

Until those live gates pass, the implementation is **built, certification pending** — never silently promoted to certified.
