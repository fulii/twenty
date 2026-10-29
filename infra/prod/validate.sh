#!/usr/bin/env bash
# Is prod running this commit, and does it answer? Asked inside the cluster, at
# the Service famiglia proxies to: people reach it only through famiglia's
# sign-in, which a script has no session for.
# CodingMonkey's ship stage runs it with CM_SHA, after deploy.sh.
set -euo pipefail
cd "$(dirname "$0")"
. ../lib.sh
need CM_SHA KUBECONFIG CM_CLUSTER_NAMESPACE CM_CLUSTER_REGISTRY
base=http://twenty-server:3000/twenty
fail() {
  echo "FAIL  $*" >&2
  exit 1
}

for deployment in twenty-server twenty-worker; do
  running=$(k get deployment "$deployment" -o jsonpath='{.spec.template.spec.containers[0].image} {.status.updatedReplicas}/{.status.availableReplicas}')
  [[ $running == "$(image) 1/1" ]] || fail "$deployment runs ${running:-nothing}, not $(image) available"
  echo "ok    $deployment runs $(image)"
done

pod_up client
inside curl -fsS --max-time 20 -o /dev/null "$base/healthz" || fail "$base/healthz does not answer"
echo "ok    $base/healthz answers"

# The web app is served under /twenty/, and so is what it loads.
page=$(inside curl -fsS --max-time 20 "$base/") || fail "$base/ does not answer"
# No pipe into head: under pipefail grep's SIGPIPE would fail the match.
script=
[[ $page =~ (/twenty/assets/[^\"]*\.js) ]] && script=${BASH_REMATCH[1]}
[[ -n $script ]] || fail "$base/ names no script under /twenty/assets/"
inside curl -fsS --max-time 20 -o /dev/null "http://twenty-server:3000$script" || fail "$script does not load"
echo "ok    $base/ serves the web app, and $script loads"

# Without a key the API answers, and refuses.
answer=$(inside curl -sS --max-time 20 -H 'content-type: application/json' -d '{"query":"{ currentUser { id } }"}' "$base/graphql") || answer=
grep -q 'UNAUTHENTICATED' <<<"$answer" || fail "$base/graphql does not answer as an API without a key: ${answer:0:200}"
echo "ok    $base/graphql answers, and refuses a request without a key"
