# sqlite-vec build note

The Alpine builder for `deploy/vps/pocketbase/Dockerfile.vec` must include `sqlite-dev` because the sqlite-vec CGO bindings include `sqlite3.h` during compilation.
