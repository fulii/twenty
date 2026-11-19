#!/usr/bin/env bash
# lib.sh's roll against a fake kubectl, asking no cluster.
set -euo pipefail
infra=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# The fake answers from the files of $FAKE and writes every call to $FAKE/calls.
mkdir "$work/bin"
cat >"$work/bin/kubectl" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
[[ $1 != --namespace ]] || shift 2
echo "$*" >>"$FAKE/calls"
case "$1 $2" in
"rollout status")
  name=${3#deployment/}
  for _ in $(seq "$(cat "$FAKE/timeout")"); do
    [[ ! -f $FAKE/$name.ready ]] || { echo "deployment \"$name\" successfully rolled out"; exit 0; }
    sleep 0.1
  done
  echo "error: timed out waiting for the condition on deployments/$name" >&2
  exit 1 ;;
"rollout undo") ;;
"get deployment") cat "$FAKE/$3.deployment" ;;
"get replicasets,pods") jq -s '{kind: "List", items: .}' "$FAKE/${4#app.kubernetes.io/name=}.items" ;;
"logs "*) echo "the logs of $2" ;;
*) echo "unexpected: kubectl $*" >&2; exit 1 ;;
esac
FAKE
chmod +x "$work/bin/kubectl"

# deployment <name> <generation> <observed generation> <revision>
deployment() {
  jq -n --arg name "$1" --argjson generation "$2" --argjson observed "$3" --arg revision "$4" '{
    kind: "Deployment",
    metadata: {name: $name, generation: $generation, annotations: {"deployment.kubernetes.io/revision": $revision}},
    status: {observedGeneration: $observed}}' >"$FAKE/$1.deployment"
}

# replicaset <deployment> <revision> <pod-template-hash>
replicaset() {
  jq -n --arg deployment "$1" --arg revision "$2" --arg hash "$3" '{
    kind: "ReplicaSet",
    metadata: {name: "\($deployment)-\($hash)", labels: {"pod-template-hash": $hash},
      annotations: {"deployment.kubernetes.io/revision": $revision},
      ownerReferences: [{kind: "Deployment", name: $deployment}]}}' >>"$FAKE/$1.items"
}

# pod <deployment> <pod-template-hash> <restarts> [waiting reason] [init]: one
# container, running unless a reason is given, an init container's with "init".
pod() {
  jq -n --arg deployment "$1" --arg hash "$2" --argjson restarts "$3" --arg reason "${4:-}" --arg init "${5:-}" '
    {restartCount: $restarts, state: (if $reason == "" then {running: {}} else {waiting: {reason: $reason, message: "back-off"}} end)} as $status
    | {kind: "Pod",
      metadata: {name: "\($deployment)-\($hash)-abcde", labels: {"pod-template-hash": $hash}},
      status: (if $init == "" then {containerStatuses: [$status]} else {initContainerStatuses: [$status]} end)}' \
    >>"$FAKE/$1.items"
}

# A release: twenty-server and twenty-worker at revision 2 (hash new), seen by
# the controller, with revision 1 (hash old) still around; both become ready.
scenario() {
  FAKE=$work/$1
  mkdir "$FAKE"
  : >"$FAKE/calls"
  echo 300 >"$FAKE/timeout"
  for name in twenty-server twenty-worker; do
    deployment "$name" 2 2 2
    replicaset "$name" 1 old
    replicaset "$name" 2 new
    touch "$FAKE/$name.ready"
  done
}

failures=0
# expect <exit status> <at most seconds> <text the output has>...
expect() {
  local status=0 began=$SECONDS want=$1 seconds=$2 text
  shift 2
  # Short polls: sleep is lib.sh's own, the fake's runs as it is.
  FAKE=$FAKE PATH="$work/bin:$PATH" CM_CLUSTER_NAMESPACE=test bash -c '
    sleep() { command sleep 0.1; }
    . "$1/lib.sh"
    roll 900 twenty-server twenty-worker' roll "$infra" >"$FAKE/output" 2>&1 || status=$?
  cat "$FAKE/calls" >>"$FAKE/output"
  local problem=
  [[ $status == "$want" ]] || problem+=" exited $status, not $want;"
  ((SECONDS - began <= seconds)) || problem+=" took $((SECONDS - began)) s, more than $seconds;"
  for text in "$@"; do
    grep -Fq -- "$text" "$FAKE/output" || problem+=" no '$text';"
  done
  if [[ -n $problem ]]; then
    failures=$((failures + 1))
    echo "FAIL  $(basename "$FAKE"):$problem" >&2
    sed 's/^/      /' "$FAKE/output" >&2
  else
    echo "ok    $(basename "$FAKE")"
  fi
}

# refute <text the output of the last expect does not have>
refute() {
  ! grep -Fq -- "$1" "$FAKE/output" || {
    failures=$((failures + 1))
    echo "FAIL  $(basename "$FAKE"): '$1'" >&2
  }
}

scenario healthy
pod twenty-server new 0
pod twenty-worker new 0
expect 0 10 'deployment "twenty-server" successfully rolled out' 'deployment "twenty-worker" successfully rolled out'
refute 'rollout undo'

scenario crash-loop
rm "$FAKE/twenty-server.ready"
pod twenty-server new 2 CrashLoopBackOff
expect 1 10 'twenty-server-new-abcde is in CrashLoopBackOff' 'the logs of pod/twenty-server-new-abcde' \
  'rollout undo deployment/twenty-server deployment/twenty-worker'

scenario image-pull
rm "$FAKE/twenty-worker.ready"
pod twenty-server new 0
pod twenty-worker new 0 ImagePullBackOff
expect 1 10 'deployment "twenty-server" successfully rolled out' 'twenty-worker-new-abcde is in ImagePullBackOff' \
  'rollout undo deployment/twenty-server deployment/twenty-worker'

scenario container-config
rm "$FAKE/twenty-server.ready"
pod twenty-server new 0 CreateContainerConfigError init
expect 1 10 'twenty-server-new-abcde is in CreateContainerConfigError'

# One restart is not yet a crash loop: the rollout times out as it would.
scenario one-restart
rm "$FAKE/twenty-server.ready"
echo 10 >"$FAKE/timeout"
pod twenty-server new 1 CrashLoopBackOff
expect 1 10 'twenty-server did not become ready. What its pods said' 'rollout undo deployment/twenty-server'
refute 'is in CrashLoopBackOff'

# A crash-looping pod of the previous release does not stop the new one.
scenario previous-release
pod twenty-server old 5 CrashLoopBackOff
pod twenty-server new 0
expect 0 10 'deployment "twenty-server" successfully rolled out'

# Before the controller sees the new spec, the revision is the previous one's.
scenario not-yet-observed
deployment twenty-server 3 2 1
pod twenty-server old 5 CrashLoopBackOff
expect 0 10 'deployment "twenty-server" successfully rolled out'

((failures == 0)) || { echo "$failures of roll's tests failed" >&2; exit 1; }
