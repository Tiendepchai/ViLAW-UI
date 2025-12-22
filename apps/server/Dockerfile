FROM node:20-alpine
WORKDIR /app

COPY apps/server/package.json ./package.json
RUN npm install --omit=dev

COPY apps/server/src ./src

# data mount point
RUN mkdir -p /app/data

ENV PORT=8787
EXPOSE 8787

CMD ["node", "src/index.js"]
