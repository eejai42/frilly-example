#!/usr/bin/env bash
# Deploy the Frilly prototype to Control Plane as a scale-to-zero workload.
# Prereqs: `cpln` CLI authenticated for org effortlessapi (cpln profile get),
#          or CPLN_TOKEN set in the environment.
set -euo pipefail
ORG="${CPLN_ORG:-effortlessapi}"
GVC="${CPLN_GVC:-ssotme-tools}"
VERSION="$(date -u +%Y-%m-%d-%H%M)"
IMAGE="frilly-prototype:$VERSION"
SRC=effortless-rulebook/effortless-editor-src
if [ ! -f "$SRC/api/index.js" ] || [ ! -f "$SRC/postgres/reset-rulebook-db.sh" ]; then
  echo "▸ generating the backend from the rulebook into $SRC …"
  mkdir -p "$SRC/postgres" && cp effortless-rulebook/docker/effortless.editor.json "$SRC/effortless.json"
  ln -sfn .. "$SRC/effortless-rulebook"
  cp deploy/chmod-initdb.sh deploy/run-rulebook-db-reset.sh "$SRC/postgres/"
  ( cd "$SRC" && effortless initdb -disable && effortless chmodinitdb -disable && effortless build )
fi
echo "▸ org=$ORG gvc=$GVC image=$IMAGE"
cpln image build --name "$IMAGE" --org "$ORG" --dockerfile ./deploy/Dockerfile --push .
tmp="$(mktemp)"
sed "s#/org/effortlessapi/image/IMAGE_NAME_TAG#/org/$ORG/image/$IMAGE#g" deploy/cpln-frilly.yaml > "$tmp"
cpln apply -f "$tmp" --gvc "$GVC" --org "$ORG"
rm -f "$tmp"
echo "✅ deployed frilly-prototype ($VERSION). Endpoint: cpln workload get frilly-prototype --gvc $GVC --org $ORG"
