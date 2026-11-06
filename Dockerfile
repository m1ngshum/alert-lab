FROM node:26.13.0-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@12.2.2
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN mkdir /data && chown node:node /data

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:08476c244888bfb425bae1ae4dd7c17f093e972aab8426883d97f3c6f280f7c1
LABEL org.opencontainers.image.source="https://github.com/m1ngshum/alert-lab" org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies /usr/local/LICENSE /usr/share/doc/node/LICENSE
COPY --from=dependencies /usr/lib/*-linux-gnu/libatomic.so.1 /usr/lib/libatomic.so.1
COPY --from=dependencies --chown=1000:1000 /data /data
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY LICENSE ./LICENSE
COPY server ./server
COPY web ./web
COPY bin ./bin
USER 1000:1000
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/alert-lab.db PATH=/usr/local/bin:/usr/bin:/bin
EXPOSE 8080
CMD ["/usr/local/bin/node", "server/main.mjs"]
