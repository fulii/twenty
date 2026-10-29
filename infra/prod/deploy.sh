#!/usr/bin/env bash
# Deploys one commit to Twenty's one environment, prod: builds its image in the
# namespace, writes the Secret twenty, dumps the database before a new image
# starts, rolls the server and the worker. Safe to run again.
# CodingMonkey's ship stage runs it with CM_SHA after every merge to main.
set -euo pipefail
cd "$(dirname "$0")"
. ../lib.sh
need CM_SHA KUBECONFIG CM_CLUSTER_NAMESPACE CM_CLUSTER_REGISTRY
need TWENTY_APP_SECRET TWENTY_DB_PASSWORD TWENTY_TRUSTED_PROXY_SECRET
pod_up client

if grep -Fqx "$CM_SHA" <<<"$(image_tags)"; then
  echo "ok    the registry has $(image)"
else
  build "$CM_SHA"
fi

# Workspace secrets into the Secret, on stdin and never on a command line.
# With a Google client: Google sign-in, Gmail and Calendar, and no passwords.
google=false
[[ -n ${GOOGLE_CLIENT_ID:-} && -n ${GOOGLE_CLIENT_SECRET:-} ]] && google=true
written=$({
  printf 'app_secret=%s\n' "$TWENTY_APP_SECRET"
  printf 'db_password=%s\n' "$TWENTY_DB_PASSWORD"
  printf 'db_url=postgres://twenty:%s@twenty-db:5432/twenty\n' "$TWENTY_DB_PASSWORD"
  printf 'trusted_proxy_secret=%s\n' "$TWENTY_TRUSTED_PROXY_SECRET"
  printf 'google_client_id=%s\ngoogle_client_secret=%s\n' "${GOOGLE_CLIENT_ID:-}" "${GOOGLE_CLIENT_SECRET:-}"
  printf 'auth_google_enabled=%s\nauth_password_enabled=%s\n' "$google" "$([[ $google == true ]] && echo false || echo true)"
  # Only when set: Twenty treats an empty key as a configured one.
  [[ -z ${ANTHROPIC_API_KEY:-} ]] || printf 'anthropic_api_key=%s\n' "$ANTHROPIC_API_KEY"
} | k create secret generic twenty --from-env-file=/dev/stdin --dry-run=client -o yaml | k apply -f -)

# The server migrates the database as it starts, and a migration is not undone
# by rolling back: a new image starts only after a dump named after the running
# one. Never overwritten: a retry finds a database the failed roll migrated.
running=$(k get deployment twenty-server -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null) || running=
if [[ -n $running && $running != "$(image)" ]]; then
  k exec twenty-db-0 -c postgres -- sh -c '
    cd /var/lib/postgresql/data
    [ -f "before-$1.dump" ] || { pg_dump -U twenty -Fc twenty > "before-$1.dump.part" && mv "before-$1.dump.part" "before-$1.dump"; }
    ls -1t before-*.dump | tail -n +4 | xargs -r rm --' sh "${running##*:}"
  echo "ok    the database of $running is in before-${running##*:}.dump"
fi

manifest twenty | k apply -f - >/dev/null
# A pod reads the Secret as it starts.
[[ $written != *configured* || $running != "$(image)" ]] ||
  k rollout restart deployment/twenty-server deployment/twenty-worker >/dev/null

# Migrations run before the server listens: its startup probe allows 10 minutes.
for deployment in twenty-server twenty-worker; do
  k rollout status "deployment/$deployment" --timeout=900s && continue
  echo "$deployment did not become ready. What its pods said:" >&2
  k logs --selector "app.kubernetes.io/name=$deployment" --all-containers --tail=40 --prefix >&2 || true
  echo "Undoing both." >&2
  k rollout undo deployment/twenty-server deployment/twenty-worker >&2 || true
  exit 1
done
echo "ok    $(image) is live"

prune_images "$CM_SHA" || echo "Not every image beyond the newest three was removed." >&2
