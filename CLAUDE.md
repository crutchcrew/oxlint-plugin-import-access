# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@crutchcrew/oxlint-plugin-import-access` is an oxlint JS plugin (port of uhyo's `eslint-plugin-import-access`) with one rule, `import-access/jsdoc`. Exports are `@public` by default (`defaultImportability: "public"`). Only exports tagged `@package` or `@private` (or all untagged ones, if `defaultImportability` is changed) are restricted: `@package` exports can be imported from their own package (the directory and its subdirectories; with the default `indexLoophole`, `sub/index.ts` also counts as `sub.ts`), `@private` exports never. It works **without a type checker**: imports are resolved with `oxc-resolver` and target files' exports and JSDoc are read with `oxc-parser`'s module record.

## Commands

Use bun for everything (package manager, scripts, CI one-liners) except where oxlint loads the plugin, which runs on Node.js: the tests (oxlint's `RuleTester` refuses Bun), `bun run lint` (dogfoods `./src/index.ts`, needs Node.js >= 22.18 for type stripping) and the e2e suite. Publishing uses `npm publish --provenance`.

```bash
bun install
bun run test            # vitest: rule suites + unit tests
bun run test:coverage   # same, enforces 100% lines/branches/functions/statements
bun run build           # bun build (ESM bundle) + tsc declarations → dist/
bun run test:e2e        # real oxlint CLI against dist/ (build first)
bun run check           # oxfmt check, oxlint (dogfoods ./src/index.ts), typecheck, lockfile
bun run bench [n]       # time oxlint on a generated project with n modules (build first)
```

## Architecture

- `src/index.ts` — plugin object `{ meta: { name: "import-access" }, rules: { jsdoc } }`.
- `src/rules/jsdoc.ts` — rule meta/schema and `createOnce` visitors (`ImportSpecifier`, `ImportDefaultSpecifier`, `ExportSpecifier` with source). Process-wide `checker`; policies cached by options JSON + cwd.
- `src/core/checkImportability.ts` — `ImportabilityChecker` (resolver, export tables, ambient modules, `findExport` emulating TS `getImmediateAliasedSymbol`) and `ImportabilityPolicy` (per options: excludes, self-reference, access, package boundaries).
- `src/core/resolveModule.ts` — oxc-resolver wrapper; classifies internal / external (builtin or `node_modules`, `symlinks: false`) / unresolved (incl. non-module files like `.svg`).
- `src/core/exportTable.ts` — export table from `parseSync(...).module.staticExports` + comments (never touches `.program`, except lazily for JSDoc inside variable statements); `ExportTableCache` re-validates by mtime/size per generation in long-running hosts.
- `src/core/ambientModules.ts` — lazy index of `declare module "x"` / wildcard modules in `.d.ts` files under cwd.
- `src/utils/jsdoc.ts` — TypeScript-compatible JSDoc attachment and tag parsing.
- `src/utils/isInPackage.ts` — package boundaries, `indexLoophole`, `filenameLoophole`, `packageDirectory`.

## Tests

- `src/__tests__/rules/*.spec.ts` — fixture suites run through oxlint's `RuleTester` (`src/__tests__/harness.ts`, `eslintCompat: true` for 1-based columns). The 11 upstream suites were converted 1:1; `edge.spec.ts` expectations were generated from upstream's TypeScript-based rule.
- Fixtures live in `src/__tests__/fixtures/project` (with workspace and third-party fixture packages in `fixtures/packages`). Fixture text is part of the expectations: oxfmt ignores it, and `bun run typecheck` checks it compiles.
- Colocated unit tests: `src/**/*.spec.ts`. Coverage must stay at 100% without ignore comments.
- `src/__tests__/e2e/` — CLI and packaging checks against `dist/`.

When changing semantics, compare against upstream: build upstream `eslint-plugin-import-access` (git history before the port) and lint the same fixtures with typed linting; results must match.

## Release

Merging a `release/vX.Y.Z` PR (with the bumped `package.json` version) tags `vX.Y.Z` and runs `publish.yml`, which publishes to npm with provenance via trusted publishing and creates a GitHub release.
