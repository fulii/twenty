# Working on this repository under CodingMonkey

The root CLAUDE.md is Twenty's own; this file adds what running on a shared
CodingMonkey worker needs.

- Run test runners with `--maxWorkers="$CM_PARALLELISM"` — `npx jest … --maxWorkers="$CM_PARALLELISM"`,
  `npx vitest run … --maxWorkers="$CM_PARALLELISM"`. Without it Jest starts one worker per core,
  and on this machine that ran out of memory for everything else on it.
- Prefer a single spec file or `--findRelatedTests` over a package's whole suite.
- Run Nx with `NX_DAEMON=false`, as `.codingmonkey/setup.sh` and `check.sh` do.
