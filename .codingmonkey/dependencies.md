# Dependencies

This repository is diss's fork of Twenty (twentyhq/twenty). Its one dependency
is **Twenty itself**: everything under `packages/`, the lockfile and the
Dockerfile's pins are upstream's, and move only when upstream moves them.

## Twenty's releases

- Source: `https://github.com/twentyhq/twenty.git`, tags `twenty/v<x.y.z>`
  (the server's `packages/twenty-server/package.json` says the version `main`
  is at). The newest is the highest such tag: `git ls-remote --tags
  https://github.com/twentyhq/twenty.git 'twenty/v*'`. Ignore `sdk/v*` and the
  old `v*` tags.
- Update: fetch the newest tag and **merge** it into `main`
  (`git merge --no-ff twenty/v<x.y.z>`). Never rebase and never cherry-pick:
  `main` is shared, and a merge keeps our commits as they are. One release per
  pull request, the newest; the ones between come with it.
- Resolve conflicts by keeping upstream's code and re-applying ours on top.
  These are ours and must survive every merge:
  - **Serving under a sub-path**: Twenty under `/twenty` of famiglia's host
    (`SERVER_URL=https://fam.fuli.dev/twenty`) — the server's routes, the web
    app's base path and its assets.
  - **Sign-in from famiglia**: `AUTH_TRUSTED_PROXY_SECRET`; a request carrying
    `X-Famiglia-User` and a matching `X-Famiglia-Key` signs that person in
    (`trusted-proxy-auth` in `packages/twenty-server`), including before any
    workspace exists.
  - `infra/` and `.codingmonkey/`, which upstream does not have.
- Validated by: the checks, then ship's build of the image and
  `infra/prod/validate.sh`. The server runs upstream's upgrade commands as it
  starts; deploy.sh dumps the database before a new image starts.

## npm packages and pins

Held by upstream: no package, Node version or image digest is updated here on
its own. A release merge brings upstream's. The only pins of ours are the
images in `infra/prod/k8s/` (Postgres, Redis, BuildKit, curl, busybox), updated
to the newest of their line with their digest.

## Held by a person

- `serve-under-a-sub-path`, `trusted-proxy-auth` and `diss/v2.52.0` are
  branches kept as they are (the first is the change offered upstream); never
  rebase, push to or delete them.
