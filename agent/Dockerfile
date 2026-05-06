FROM golang:alpine AS builder

RUN apk add --no-cache git
WORKDIR /build
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o sentinel-agent ./cmd/sentinel-agent

FROM scratch
COPY --from=builder /build/sentinel-agent /sentinel-agent
ENTRYPOINT ["/sentinel-agent"]
