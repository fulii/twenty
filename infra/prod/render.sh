#!/usr/bin/env bash
# What a deploy of one commit applies, printed, asking no cluster:
#   CM_SHA=$(git rev-parse HEAD) CM_CLUSTER_REGISTRY=10.43.0.50:5000/twenty infra/prod/render.sh
set -euo pipefail
cd "$(dirname "$0")"
. ../lib.sh
need CM_SHA CM_CLUSTER_REGISTRY

for file in k8s/*.yaml; do
  echo "---"
  manifest "$(basename "$file" .yaml)"
done
