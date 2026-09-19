FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY shared ./shared
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
