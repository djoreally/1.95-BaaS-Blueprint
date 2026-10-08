`Dockerfile.vec` installs `sqlite-dev` in the Alpine build stage because `sqlite-vec-go-bindings` includes `sqlite3.h` during CGO compilation.
