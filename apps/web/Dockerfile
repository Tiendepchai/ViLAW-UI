FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_BACKEND_URL=http://localhost:8787
ARG VITE_STORAGE_MODE=server
ARG VITE_TOP_K=8

COPY apps/web/package.json ./package.json
RUN npm install

COPY apps/web/index.html ./index.html
COPY apps/web/vite.config.ts ./vite.config.ts
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/src ./src

# inject env for build
RUN printf "VITE_BACKEND_URL=%s\nVITE_STORAGE_MODE=%s\nVITE_TOP_K=%s\n" "$VITE_BACKEND_URL" "$VITE_STORAGE_MODE" "$VITE_TOP_K" > .env.production

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
