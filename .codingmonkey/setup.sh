# How CodingMonkey prepares a worktree before an agent or a check works in it:
# the monorepo's dependencies, with the Yarn the repository pins (the worker has
# Node and no Yarn: .codingmonkey/bin/yarn), and the builds the packages'
# typechecks and lint rules import.
PATH="$PWD/.codingmonkey/bin:$PATH"
export PATH
# No Nx daemon: started inside the worker's sandbox it hung the build for the
# whole setup timeout, and nothing here runs Nx twice.
export NX_DAEMON=false
yarn install --immutable
npx nx run-many -t build -p twenty-shared twenty-oxlint-rules
