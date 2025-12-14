FROM rust:latest as builder

WORKDIR /app

COPY Cargo.toml ./
COPY src ./src
COPY migrations ./migrations

ENV SQLX_OFFLINE=true

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/jogos-educativos-backend /app/backend
COPY .env /app/.env

EXPOSE 8080

CMD ["/app/backend"]
