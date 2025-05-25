# Build stage
FROM node:18 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install SvelteKit Node adapter for Docker deployment
RUN npm install @sveltejs/adapter-node

# Apply the npm workaround for Rollup issue
RUN npm cache clean --force
RUN rm -rf node_modules package-lock.json
RUN npm install

# Copy source code
COPY . .

# Set build-time environment variables
ARG VITE_POCKETBASE_URL=http://localhost:8080
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files first
COPY --from=builder /app/package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sveltekit -u 1001

# Copy built application from builder stage
COPY --from=builder /app/build ./

# Change ownership of the app directory
RUN chown -R sveltekit:nodejs /app
USER sveltekit

# Expose port
EXPOSE 3000

# Set environment variable for production
ENV NODE_ENV=production

# Command to run the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"] 