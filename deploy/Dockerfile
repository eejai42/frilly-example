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
RUN npm install -g @effortlessapi/cli && effortless -version

WORKDIR /app
# The rulebook and the editor's pipeline config are the only inputs the
# generated backend needs. Generation happens at BUILD time (needs network to
# the transpiler catalog); nothing is generated at runtime.
COPY effortless.json ./effortless.json
COPY effortless-rulebook/effortless-rulebook.json ./effortless-rulebook/effortless-rulebook.json
COPY effortless-rulebook/docker/effortless.editor.json ./editor-src/effortless.json
COPY deploy/chmod-initdb.sh deploy/run-rulebook-db-reset.sh ./editor-src/postgres/
RUN ln -s /app/effortless-rulebook /app/editor-src/effortless-rulebook \
    && chmod +x /app/editor-src/postgres/*.sh \
    && cd /app/editor-src \
    # the DB steps need a live Postgres; run them at boot instead
    && effortless initdb -disable && effortless chmodinitdb -disable \
    && effortless build \
    && cd api && npm install --omit=dev --silent

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
