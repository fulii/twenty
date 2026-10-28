# How CodingMonkey prepares a worktree before an agent or a check works in it:
# the monorepo's dependencies, with the Yarn the repository carries (the worker
# has Node and no Yarn of its own), and what the packages' typechecks and the
# lint rules import from a build.
node .yarn/releases/yarn-*.cjs install --immutable
npx nx run-many -t build -p twenty-shared twenty-oxlint-rules
