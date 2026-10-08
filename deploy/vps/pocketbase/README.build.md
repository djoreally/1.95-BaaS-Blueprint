The sqlite-vec custom PocketBase image is compiled with CGO on Alpine. The build stage requires `sqlite-dev` so `sqlite3.h` is available to `sqlite-vec-go-bindings`.
