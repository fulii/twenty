#!/usr/bin/env bash
# One package's gate: its typecheck, then lint, format and the tests related to
# the files this branch changed against origin/main.
#   .codingmonkey/check.sh twenty-server
set -euo pipefail
package=$1
# Twenty's targets call yarn; the worker has none of its own.
export PATH="$(git rev-parse --show-toplevel)/.codingmonkey/bin:$PATH"
npx nx typecheck "$package"
cd "packages/$package"
mapfile -t files < <(git diff --name-only --relative --diff-filter=d origin/main...HEAD -- src/ test/ | grep -E '\.(ts|tsx)$' || true)
if [[ ${#files[@]} == 0 ]]; then
  echo "No changed files in $package."
  exit 0
fi
npx oxlint --type-aware -c .oxlintrc.json "${files[@]}"
npx oxfmt --check "${files[@]}"
npx jest --config jest.config.mjs --passWithNoTests --findRelatedTests "${files[@]}"
