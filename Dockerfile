FROM node:20-alpine AS builder
WORKDIR /app
# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production Image ----
FROM node:20-alpine
WORKDIR /app
# Install only prod deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate
# Copy build artifacts
COPY --from=builder /app/dist ./dist
# Copy email templates to match the path your code expects
COPY --from=builder /app/src/email/templates ./src/email/templates
EXPOSE 3000
CMD ["node", "dist/src/main"]
