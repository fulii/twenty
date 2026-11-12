#!/usr/bin/env bash
# The gate of a change against origin/main: the typecheck of every package it
# affects, then lint, format and the related tests of the changed files of each
# package it touches, with that package's own test runner.
set -euo pipefail
# Twenty's targets call yarn; the worker has none of its own.
export PATH="$(git rev-parse --show-toplevel)/.codingmonkey/bin:$PATH"
# No Nx daemon (as in setup.sh), and test runners held to the parallelism the
# worker hands every command: one Jest worker per core ran the host out of memory.
export NX_DAEMON=false
workers=${CM_PARALLELISM:-2}
# Jest at 16 workers over a release's ~1000 server suites got workers OOM-killed
# on the shared host; 6 workers that recycle past 1 GB run them in under a minute.
jest_workers=$((workers < 6 ? workers : 6))
base=origin/main
# One at a time and without emitting: twenty-server's tsgo peaks near 4 GB
# (over 9 GB when it also writes declarations), and beside twenty-front's it
# was OOM-killed on the shared host.
npx nx affected -t typecheck --base="$base" --noEmit --parallel=1
mapfile -t packages < <(git diff --name-only --diff-filter=d "$base"...HEAD -- packages/ | cut -d/ -f2 | sort -u)
for package in "${packages[@]}"; do
  (
    cd "packages/$package"
    # The runners' own binaries, not npx: npx passes the file list as one
    # argument, which a release's ~1600 server files take past Linux's 128 KiB.
    PATH="$PWD/node_modules/.bin:$PWD/../../node_modules/.bin:$PATH"
    # Not an Nx project (twenty-apps): upstream neither lints nor formats it.
    [[ -f project.json ]] || exit 0
    mapfile -t files < <(git diff --name-only --relative --diff-filter=d "$base"...HEAD -- . | grep -E '\.(ts|tsx|js|jsx)$' || true)
    [[ ${#files[@]} != 0 ]] || exit 0
    echo "== $package: ${#files[@]} changed files"
    if [[ -f .oxlintrc.json ]]; then
      # Type-aware only where the package's own lint is.
      oxlint $(grep -qs -- --type-aware project.json && echo --type-aware) -c .oxlintrc.json "${files[@]}"
    fi
    # Generated files are in the format's ignore list. A package whose own fmt
    # is Prettier (twenty-agent-skills, twenty-docs) is not format-checked by
    # upstream's CI, and v2.58.0 ships one of its files unformatted.
    if ! grep -qs '"command": "prettier' project.json; then
      oxfmt --check --no-error-on-unmatched-pattern "${files[@]}"
    fi
    # Its tests call a running Twenty server (upstream's ci-zapier.yaml starts one).
    [[ $package != twenty-zapier ]] || exit 0
    vitest_config=$(compgen -G 'vitest.config.*' || true)
    if [[ -f jest.config.mjs ]]; then
      jest --config jest.config.mjs --maxWorkers="$jest_workers" --workerIdleMemoryLimit=1G --passWithNoTests --findRelatedTests "${files[@]}"
    elif [[ -n $vitest_config ]]; then
      # A config with a `unit` project also has browser ones, which need Playwright.
      vitest related --run --maxWorkers="$workers" --passWithNoTests --config "$vitest_config" \
        $(grep -q "name: 'unit'" "$vitest_config" && echo --project unit) "${files[@]}"
    fi
  )
done
