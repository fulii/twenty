# Twenty for diss: the environment `prod`

diss's CRM, deployed by CodingMonkey (codingmonkey-prod on zombie) after every
merge to `main`, into this workspace's namespace on zombie's K3s. People reach
it only through famiglia, at <https://fam.fuli.dev/twenty>: famiglia's
`apps.yaml` proxies `/twenty` to the Service `twenty-server` here, and signs
people in with `X-Famiglia-User` and `X-Famiglia-Key`. Nothing here is public
on its own: no tunnel, no ingress.

| File | What |
| --- | --- |
| `prod/deploy.sh` | Builds the commit's image in the namespace (`k8s/builder.yaml`), writes the Secret `twenty`, dumps the database before a new image starts, rolls server and worker (`k8s/twenty.yaml`) |
| `prod/validate.sh` | The commit's image runs; `/twenty/healthz`, the web app and the GraphQL API answer at the Service |
| `prod/render.sh` | Prints what a deploy applies, without a cluster |

## What a step is handed

From the platform, under the Kubernetes runtime: `CM_SHA`, `KUBECONFIG`,
`CM_CLUSTER_NAMESPACE`, `CM_CLUSTER_REGISTRY`.

Workspace secrets, scope `deploy:prod`:

| Name | |
| --- | --- |
| `TWENTY_APP_SECRET` | Twenty's `APP_SECRET`, also its at-rest encryption key: never change it on a database that has data |
| `TWENTY_DB_PASSWORD` | Postgres's password (URL-safe: it goes into the database URL) |
| `TWENTY_TRUSTED_PROXY_SECRET` | `AUTH_TRUSTED_PROXY_SECRET`, equal to famiglia's `APP_KEY_TWENTY` |
| `ANTHROPIC_API_KEY` | optional: Twenty's AI (chat, agents, workflow steps) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional, as a pair: Google sign-in, Gmail and Calendar; passwords go off with them |

## Data

Postgres (`twenty-db`, claim `data-twenty-db-0`) and the attachments (claim
`twenty-storage`). Before a new image starts, deploy.sh dumps the database to
`/var/lib/postgresql/data/before-<running sha>.dump` in `twenty-db-0` (the
newest three are kept); zombie's
nightly `gdrive-backup` copies a dump and the files to Google Drive. To go
back to the dump: scale `twenty-server` and `twenty-worker` to 0, then
`pg_restore --clean --if-exists -U twenty -d twenty` it in `twenty-db-0`.
