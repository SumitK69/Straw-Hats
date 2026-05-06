FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git
WORKDIR /build
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o sentinel-server ./cmd/sentinel-server

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
RUN adduser -D -u 1000 sentinel
COPY --from=builder /build/sentinel-server /usr/local/bin/sentinel-server
RUN mkdir -p /var/sentinel/certs /var/sentinel/nats /var/sentinel/data \
    && chown -R sentinel:sentinel /var/sentinel
USER sentinel
EXPOSE 4222 8443
ENTRYPOINT ["sentinel-server"]
