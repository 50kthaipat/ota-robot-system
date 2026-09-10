FROM golang:alpine AS builder
WORKDIR /app
ENV GOTOOLCHAIN=auto
COPY go.mod go.sum* ./
RUN go mod download || echo "no go.sum, continuing..."
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./main.go

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server /usr/local/bin/server
COPY keys /app/keys
EXPOSE 8000
CMD ["/usr/local/bin/server"]
