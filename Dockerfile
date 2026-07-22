# Stage 1: Build the web app
FROM node:22-bookworm AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy source and build the static web export
COPY . .
RUN npx expo export --platform web

# Stage 2: Serve with a lightweight static server
FROM node:22-bookworm-slim AS runner

WORKDIR /app
RUN npm install -g serve

# Copy the built static files from the builder stage
COPY --from=builder /app/dist ./dist

# The container listens on the port provided at runtime (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "serve dist -p ${PORT}"]
