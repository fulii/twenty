# What deploy.sh, validate.sh and render.sh share. Sourced, never run.
infra=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Stops unless every named variable is set. Every input comes from the
# environment: the ship stage hands a step what infra/README.md lists.
need() {
  local name
  for name in "$@"; do
    [[ -n ${!name:-} ]] || {
      echo "$name is not set (infra/README.md)" >&2
      exit 1
    }
  done
}

# kubectl, in the one namespace the environment is given.
k() {
  kubectl --namespace "$CM_CLUSTER_NAMESPACE" "$@"
}

# The short-lived pods a run started are removed when it ends, however it ends.
started=
finish() {
  local name
  for name in $started; do pod_down "$name"; done
}
trap finish EXIT

image() {
  printf '%s\n' "${CM_CLUSTER_REGISTRY:-}/twenty:${CM_SHA:-}"
}

# One file of prod/k8s/ with the commit's image and the registry in it. No
# manifest names a namespace: `k` puts everything into the environment's.
manifest() {
  local registry=${CM_CLUSTER_REGISTRY:-}
  sed -e "s|\${IMAGE}|$(image)|g" -e "s|\${REGISTRY}|${registry%%/*}|g" "$infra/prod/k8s/$1.yaml"
}

# Starts a short-lived pod of prod/k8s/ and waits for it; one a stopped run
# left behind is replaced first.
pod_up() {
  manifest "$1" | k delete -f - --ignore-not-found >/dev/null
  started+=" $1"
  manifest "$1" | k apply -f - >/dev/null
  k wait --for=condition=Ready "pod/$1" --timeout=180s >/dev/null || {
    echo "The $1 pod did not start. What the namespace says:" >&2
    k get events --sort-by=.lastTimestamp 2>&1 | tail -n 15 >&2
    return 1
  }
}

pod_down() {
  manifest "$1" | k delete -f - --ignore-not-found --wait=false >/dev/null 2>&1 || true
  started=${started// $1/}
}

# curl from a pod of the namespace (k8s/client.yaml), where the Services'
# names resolve and the registry answers.
inside() {
  k exec client -- "$@"
}

# ---- the registry -----------------------------------------------------------

registry_api() {
  printf 'http://%s/v2/%s/twenty\n' "${CM_CLUSTER_REGISTRY%%/*}" "${CM_CLUSTER_REGISTRY#*/}"
}

# The commits the registry has an image of, one a line.
image_tags() {
  inside curl -sS --max-time 30 "$(registry_api)/tags/list" | tr ',[]' '\n\n\n' |
    sed -n 's/^[[:space:]]*"\([0-9a-f]\{40\}\)"[[:space:]]*$/\1/p'
}

# What packages/twenty-docker/twenty/Dockerfile copies, and nothing else: the
# website, the docs and the e2e tests stay out of the build context.
CONTEXT=(package.json yarn.lock .yarnrc.yml tsconfig.base.json nx.json .yarn
  packages/twenty-docker packages/twenty-ui packages/twenty-shared packages/twenty-front
  packages/twenty-front-component-renderer packages/twenty-sdk packages/twenty-client-sdk
  packages/twenty-emails packages/twenty-server packages/twenty-oxlint-rules)

# Builds the commit's image (target `twenty`: server and web app) in a builder
# that lives for this one build (k8s/builder.yaml), and pushes it. An attempt
# is stopped after 40 minutes, about three times a cold build on zombie; there
# are two, which the deploy's 90 minutes (.codingmonkey/config.json) hold.
build() {
  local sha=$1 version
  version=$(app_version "$sha")
  pod_up builder
  git -C "$infra/.." archive --format=tar "$sha" -- "${CONTEXT[@]}" |
    k exec -i builder -- sh -c '
      set -eu
      umask 022
      context=$(mktemp -d)
      trap "rm -rf \"$context\"" EXIT
      tar -x -f - -C "$context"
      attempts=2 limit=2400 attempt=1
      while :; do
        echo "Build attempt $attempt of $attempts, for at most $limit seconds"
        began=$(date +%s)
        if timeout "$limit" buildctl build --progress=plain --frontend dockerfile.v0 \
          --local context="$context" --local dockerfile="$context/packages/twenty-docker/twenty" \
          --opt target=twenty --opt build-arg:APP_VERSION="$3" \
          --output type=image,name="$2",push=true; then
          echo "ok    build attempt $attempt of $attempts finished in $(($(date +%s) - began)) seconds"
          exit 0
        fi
        echo "FAIL  build attempt $attempt of $attempts stopped after $(($(date +%s) - began)) seconds" >&2
        [ "$attempt" -lt "$attempts" ] || break
        attempt=$((attempt + 1))
      done
      echo "The image of $1 was not built in $attempts attempts" >&2
      exit 1
    ' build "$sha" "$(image)" "$version"
  pod_down builder
  echo "ok    built and pushed $(image)"
}

# What Twenty shows as its version at a commit: the SDK package's, the one
# package that carries the release's number (the server's has no version).
app_version() {
  local version
  version=$(git -C "$infra/.." show "$1:packages/twenty-sdk/package.json" |
    node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).version')
  [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]] ||
    { echo "No release version in packages/twenty-sdk/package.json at $1: '$version'" >&2; return 1; }
  echo "$version"
}

# Removes the image tags beyond the newest three of this commit's history.
# Run after the release is live; nothing is removed unless the commit just
# rolled is among the ones kept.
prune_images() {
  local sha=$1 tags keep tag
  tags=$(image_tags) || return 1
  keep=$(git -C "$infra/.." rev-list --first-parent "$sha" | grep -Fx -f <(printf '%s\n' "$tags") | sed -n '1,3p') ||
    return 1
  grep -Fqx "$sha" <<<"$keep" || return 1
  for tag in $tags; do
    grep -Fqx "$tag" <<<"$keep" && continue
    inside curl -fsS --max-time 30 -o /dev/null -X DELETE "$(registry_api)/manifests/$tag" ||
      return 1
    echo "ok    removed the image of $tag"
  done
}
