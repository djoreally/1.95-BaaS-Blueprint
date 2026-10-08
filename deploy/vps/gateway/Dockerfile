FROM node:20-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY gateway.js ./
ENV PORT=8080 KEYS_DIR=/keys
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/healthz || exit 1
CMD ["node", "gateway.js"]
