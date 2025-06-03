# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock ./

# Install ALL dependencies (including devDependencies)
RUN bun install

# Copy source code
COPY . .

# Set production environment and build the application
ENV NODE_ENV=production
RUN bun run build:prod

# Production stage
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy package files first
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/bun.lock ./

# Install ALL dependencies (including devDependencies) in production
RUN bun install

# Create a non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy built application from builder stage
COPY --from=builder /app/build ./

# Change ownership of the app directory
RUN chown -R appuser:appgroup /app
USER appuser

# Expose port
EXPOSE 3001

# Set environment variable for production
ENV NODE_ENV=production

# Command to run the application
CMD ["bun", "index.js"] 