# 프론트(Next.js) 이미지.
#
# 주의: NEXT_PUBLIC_* 는 빌드 시점에 코드 안으로 박힌다. 실행할 때 넣어도 반영되지
# 않으므로 네이버 지도 키는 build-arg 로 받는다. /api 프록시 주소도 마찬가지다.
# SITE_URL 은 실행 시에도 읽는다.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=""
ENV NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=$NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
# 빌드 중 사이트맵·메타데이터가 절대 URL 을 만들 때 쓴다
ARG SITE_URL="http://localhost:4000"
ENV SITE_URL=$SITE_URL
# /api 프록시 주소는 next.config 의 rewrites 로 들어가는데, rewrites 는 빌드 결과물
# (routes-manifest.json)에 그대로 박힌다. 실행 시 환경변수로는 바뀌지 않으므로
# 여기서 받아야 한다. 컨테이너 안에서 백엔드는 'back' 이라는 이름으로 보인다.
ARG API_BASE_URL="http://localhost:4030"
ENV API_BASE_URL=$API_BASE_URL
# 빌드 중에는 백엔드에 붙지 못해도 된다(실패하면 null 로 처리하게 돼 있다)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

# 루트로 돌리지 않는다
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 4000
CMD ["node", "server.js"]
