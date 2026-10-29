# Dependencies

This repository is diss's fork of Twenty (twentyhq/twenty). Its one dependency
is **Twenty itself**: everything under `packages/`, the lockfile, `.nvmrc` and
the Dockerfile's pins are upstream's, and move only when upstream moves them.
The only pins of ours are the images in `infra/prod/k8s/`.

## Ecosystems

| Ecosystem | What | Update with |
| --- | --- | --- |
| Twenty upstream (git) | `packages/`, `package.json`, `yarn.lock`, `.yarn/`, `.nvmrc`, `nx.json`, `packages/twenty-docker/twenty/Dockerfile` | a merge of upstream's newest release tag (below) |
| npm (Yarn 4 workspaces) | the monorepo's packages | only through the release merge, then `.codingmonkey/bin/yarn install --immutable` |
| Container images | `infra/prod/k8s/*.yaml` `image:` pins | edit the tag and digest (below) |

## Twenty's releases

- Source: `https://github.com/twentyhq/twenty.git`, tags `twenty/v<x.y.z>`.
  No `package.json` carries the version; `main` is at the newest such tag
  that is its ancestor (`git describe --match 'twenty/v*' --abbrev=0` after
  fetching the tags). The newest release is the highest tag: `git ls-remote
  --tags https://github.com/twentyhq/twenty.git 'twenty/v*'`. Ignore `sdk/v*`
  and the old `v*` tags.
- Update: fetch the newest tag and **merge** it into `main`
  (`git merge --no-ff twenty/v<x.y.z>`). Never rebase and never cherry-pick:
  `main` is shared, and a merge keeps our commits as they are. One release per
  pull request, the newest; the ones between come with it. Then
  `.codingmonkey/bin/yarn install --immutable`.
- Resolve conflicts by keeping upstream's code and re-applying ours on top.
  These are ours and must survive every merge:
  - **Serving under a sub-path**: Twenty under `/twenty` of famiglia's host
    (`SERVER_URL=https://fam.fuli.dev/twenty`) — the server's routes, the web
    app's base path and its assets. A clean merge is not enough: grep what the
    release adds for `window.location.pathname`, `window.location.origin` and
    absolute public-file paths in `twenty-front`, and route them through
    `~/utils/getAppPathname`, `~/utils/buildAbsoluteAppUrl` or `BASE_PATH`.
  - **Sign-in from famiglia**: `AUTH_TRUSTED_PROXY_SECRET`; a request carrying
    `X-Famiglia-User` and a matching `X-Famiglia-Key` signs that person in
    (`trusted-proxy-auth` in `packages/twenty-server`), including before any
    workspace exists.
  - `infra/` and `.codingmonkey/`, which upstream does not have.
- Node: upstream's `.nvmrc`, `engines.node` and the Dockerfile's `node` base
  image move together with the release. The checks run on the worker's Node,
  which must satisfy `engines.node`.
- Validated by: the checks (`.codingmonkey/check.sh`: typecheck of every
  affected package, lint, format and related tests of the changed files), then
  ship's build of the image and `infra/prod/validate.sh`. The server runs
  upstream's upgrade commands as it starts; deploy.sh dumps the database before
  a new image starts.

## Image pins (`infra/prod/k8s/`)

Each is `<image>:<tag>@sha256:<digest>`, the digest of the tag's multi-arch
index. Each moves to the newest tag of its line (same major; for BuildKit the
`v0.x` line), with that tag's digest.

| Pin | File | Line | Newest tag |
| --- | --- | --- | --- |
| `docker.io/library/postgres:<16.x>-trixie` | `twenty.yaml` (twice: the database and the server's wait-for-db) | 16 | `curl -s 'https://hub.docker.com/v2/repositories/library/postgres/tags?page_size=100&name=16.'` |
| `docker.io/library/redis:<8.x.y>-alpine` | `twenty.yaml` | 8 | same, `library/redis`, `name=8.` (several pages: also `name=8.1`, `name=8.2`, …) |
| `docker.io/library/busybox:<1.x.y>-musl` | `twenty.yaml` (storage init) | 1 | same, `library/busybox`, `name=musl` |
| `curlimages/curl:<8.x.y>` | `client.yaml` | 8 | same, `curlimages/curl`, `name=8.` |
| `moby/buildkit:<v0.x.y>-rootless` | `builder.yaml` | v0 | same, `moby/buildkit`, `name=rootless` |

Official images are rebuilt under the same tag (base-image fixes): an
unchanged tag can still take a new digest.

Digest, for `<repo>` (`library/postgres`, `curlimages/curl`, …) and `<tag>`:

```bash
token=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:<repo>:pull" | python3 -I -c 'import json,sys;print(json.load(sys.stdin)["token"])')
curl -sI -H "Authorization: Bearer $token" \
  -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' \
  "https://registry-1.docker.io/v2/<repo>/manifests/<tag>" | grep -i docker-content-digest
```

Validated by: the `infra` check (`render.sh` renders the manifests), then
ship's `infra/prod/deploy.sh` (the builder pod builds the image, the client
pod reaches the registry, the database, Redis and the storage init start) and
`infra/prod/validate.sh`.

Outside the update: `packages/twenty-docker/` other than
`twenty/Dockerfile` (upstream's docker-compose, Helm, k8s and Podman
examples) — nothing here builds or deploys them; they move with the release.

## Version groups

- **Twenty release**: every npm package, the lockfile, Node (`.nvmrc`,
  `engines`, the Dockerfile's base) and the Dockerfile's pins. One group,
  moved only by merging a release.
- **Postgres 16**: both `postgres` pins in `twenty.yaml`, together.
- **Redis 8**, **BusyBox 1**, **curl 8**, **BuildKit v0**: one group each.
- A new major of any pin is a group of its own (see Held).

## Held

- **Every npm package, Node and the Dockerfile's pins, on their own**: held
  by upstream; they move only with a Twenty release. Lift: never — merge the
  release that carries them.
- **Postgres 17 and 18** (newest: `18.6-trixie`): a new major needs the data
  directory upgraded (dump and restore, or `pg_upgrade`) — deploy.sh does
  neither — and upstream's own deployments are on Postgres 16. Needs its own
  ticket. Lift: a migration path for `twenty-db` and upstream supporting the
  major.

## Held by a person

- `serve-under-a-sub-path`, `trusted-proxy-auth` and `diss/v2.52.0` are
  branches kept as they are (the first is the change offered upstream); never
  rebase, push to or delete them.
