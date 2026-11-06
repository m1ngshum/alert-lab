FROM node:26.13.0-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS dependencies
# Keep copied libraries discoverable by vulnerability scanners, with their licenses.
RUN mkdir -p /runtime/usr/lib /runtime/var/lib/dpkg/status.d /runtime/usr/share/doc && \
    for package in libatomic1 libgcc-s1 libstdc++6; do \
      dpkg-query -s "$package" > "/runtime/var/lib/dpkg/status.d/$package"; \
      cp -Lr "/usr/share/doc/$package" /runtime/usr/share/doc/; \
    done && \
    cp -L /usr/lib/*-linux-gnu/libatomic.so.1 /usr/lib/*-linux-gnu/libgcc_s.so.1 /usr/lib/*-linux-gnu/libstdc++.so.6 /runtime/usr/lib/
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@12.2.2
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN mkdir /data && chown node:node /data


FROM gcr.io/distroless/base-nossl-debian13:nonroot@sha256:e6b0f82595aa1edde72c8054de7a9dca30f0f8f54820c37a167c0ddfc21c5c67
LABEL org.opencontainers.image.source="https://github.com/m1ngshum/alert-lab" org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies /usr/local/LICENSE /usr/share/doc/node/LICENSE
COPY --from=dependencies /runtime/ /
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
