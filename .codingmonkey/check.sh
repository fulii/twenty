#!/usr/bin/env bash
# The gate of a change against origin/main: the typecheck of every package it
# affects, then lint, format and the related tests of the changed files of each
# package it touches, with that package's own test runner.
set -euo pipefail
# Twenty's targets call yarn; the worker has none of its own.
export PATH="$(git rev-parse --show-toplevel)/.codingmonkey/bin:$PATH"
base=origin/main
npx nx affected -t typecheck --base="$base"
mapfile -t packages < <(git diff --name-only --diff-filter=d "$base"...HEAD -- packages/ | cut -d/ -f2 | sort -u)
for package in "${packages[@]}"; do
  (
    cd "packages/$package"
    # Not an Nx project (twenty-apps): upstream neither lints nor formats it.
    [[ -f project.json ]] || exit 0
    mapfile -t files < <(git diff --name-only --relative --diff-filter=d "$base"...HEAD -- . | grep -E '\.(ts|tsx|js|jsx)$' || true)
    [[ ${#files[@]} != 0 ]] || exit 0
    echo "== $package: ${#files[@]} changed files"
    if [[ -f .oxlintrc.json ]]; then
      # Type-aware only where the package's own lint is.
      npx oxlint $(grep -qs -- --type-aware project.json && echo --type-aware) -c .oxlintrc.json "${files[@]}"
    fi
    # Generated files are in the format's ignore list.
    npx oxfmt --check --no-error-on-unmatched-pattern "${files[@]}"
    vitest_config=$(compgen -G 'vitest.config.*' || true)
    if [[ -f jest.config.mjs ]]; then
      npx jest --config jest.config.mjs --passWithNoTests --findRelatedTests "${files[@]}"
    elif [[ -n $vitest_config ]]; then
      # A config with a `unit` project also has browser ones, which need Playwright.
      npx vitest related --run --passWithNoTests --config "$vitest_config" \
        $(grep -q "name: 'unit'" "$vitest_config" && echo --project unit) "${files[@]}"
    fi
  )
done
