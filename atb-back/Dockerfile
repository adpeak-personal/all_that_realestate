# 백엔드(Fastify) 이미지. TypeScript 를 빌드해서 dist 만 싣는다.

FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4030

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

# 루트로 돌리지 않는다
RUN addgroup -g 1001 -S nodejs && adduser -S fastify -u 1001 && chown -R fastify:nodejs /app
USER fastify

EXPOSE 4030
CMD ["node", "dist/main.js"]
