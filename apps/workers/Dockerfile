FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps/workers ./apps/workers

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages and workers
RUN pnpm run -r build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install pnpm and dumb-init
RUN npm install -g pnpm && \
    apk add --no-cache dumb-init

# Copy built application from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/workers ./apps/workers

# Copy package.json files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the workers
CMD ["node", "--loader", "tsx", "apps/workers/src/index.ts"]
