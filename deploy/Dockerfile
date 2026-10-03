# Frilly prototype, one container: Postgres seeded from the rulebook + the
# generated rulebook API + the Vite app served statically. Built for Control
# Plane (cpln) but runs anywhere Docker runs.
#
#   docker build -f deploy/Dockerfile -t frilly .
#   docker run -p 8080:8080 frilly        -> http://localhost:8080
ARG BASE_IMAGE=node:22-bookworm
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 LC_ALL=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends postgresql postgresql-contrib ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# The generated backend (Postgres SQL + Node API) is produced on the HOST by
# `effortless build` in effortless-rulebook/effortless-editor-src (deploy.sh
# runs it) and copied in, so the image build needs no access to the
# transpiler catalog. Nothing is generated at runtime.
COPY effortless-rulebook/effortless-rulebook.json ./effortless-rulebook/effortless-rulebook.json
COPY effortless-rulebook/effortless-editor-src/effortless.json ./editor-src/effortless.json
COPY effortless-rulebook/effortless-editor-src/postgres ./editor-src/postgres
COPY effortless-rulebook/effortless-editor-src/api ./editor-src/api
COPY deploy/chmod-initdb.sh deploy/run-rulebook-db-reset.sh ./editor-src/postgres/
RUN ln -s /app/effortless-rulebook /app/editor-src/effortless-rulebook \
    && chmod +x /app/editor-src/postgres/*.sh \
    && cd /app/editor-src/api && npm install --omit=dev --silent

# The app: built once, served by app/server.mjs next to the API.
COPY app/package.json app/package-lock.json* ./app/
RUN cd app && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --silent --omit=dev --ignore-scripts && npm install --silent --no-save vite @vitejs/plugin-react
COPY app/index.html app/vite.config.js ./app/
COPY app/src ./app/src
COPY app/server.mjs ./app/server.mjs
RUN cd app && VITE_API_URL= npx vite build

COPY deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENV PORT=8080 API_PORT=42441
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
