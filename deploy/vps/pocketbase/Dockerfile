# PocketBase runtime for one InvisibleDB customer.
# Official release binary on Alpine — no Go toolchain needed on the box.
# sqlite-vec arrives in Phase 3 (requires a custom build; the Dockerfile is
# structured so the binary step can be swapped without touching the rest).
ARG PB_VERSION=0.36.5

FROM alpine:3.21 AS fetch
ARG PB_VERSION
RUN apk add --no-cache unzip wget && \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
      -O /tmp/pb.zip && \
    unzip -q /tmp/pb.zip -d /pb && \
    chmod +x /pb/pocketbase

FROM alpine:3.21
RUN apk add --no-cache ca-certificates sqlite && \
    adduser -D -h /pb pocketbase
COPY --from=fetch /pb/pocketbase /usr/local/bin/pocketbase
USER pocketbase
WORKDIR /pb
VOLUME ["/pb/data"]
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8090/api/health || exit 1
# The provision script appends --origins and superuser bootstrap flags.
ENTRYPOINT ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/data"]
