# Changelog

## @crutchcrew/oxlint-plugin-import-access

### Unreleased

- Namespace imports are checked: `import * as foo from "./foo"` reports `foo.name`, `foo["name"]` and types such as `foo.Name` when `name` couldn't be imported by name. Upstream doesn't check namespace imports.

### 1.0.1

- In long-running hosts such as the oxlint language server, the `package.json` name used for `treatSelfReferenceAs` is looked up again for every linted file, like exporter files and resolved specifiers, instead of being cached for the whole process.
- Docs: the syntax tree is built for a few files (decorators, `export =`, re-exported imports, JSDoc inside variable statements), not never; all rule options are optional.
- CI: the lockfile check fails on drift; a plain `bun install` used to rewrite the lockfile first. The tagging workflow runs on the same runner as CI, since the one it used never started, and the publish workflow runs on a GitHub-hosted runner, because npm rejects provenance from self-hosted ones.

### 1.0.0

First release of the oxlint port.

- Native oxlint JS plugin (`createOnce` API) with the `import-access/jsdoc` rule: same options, messages and results as `eslint-plugin-import-access` 3.1.0, except for the default below.
- `defaultImportability` defaults to `"package"`: only `@public` exports can be imported from anywhere, and untagged exports only from their own package. Set `defaultImportability: "public"` for upstream's default.
- No type checker: imports are resolved with oxc-resolver and exports read with oxc-parser, so no `typescript` dependency, typed linting or `tsconfig.json` is needed.
- Supports ambient `declare module` and wildcard (`declare module "*.svg"`) declarations, `export =`, `export *` chains and TypeScript's JSDoc attachment rules.
- Re-validates changed files in long-running hosts such as the oxlint language server.
- Removed: ESLint support (flat config and eslintrc) and the TypeScript language service plugin.

## eslint-plugin-import-access (upstream)

History of the original ESLint plugin this package is ported from.

### 3.1.0

- feat: add packageDirectory option to customize package boundaries (#185)

### 3.0.0

> [!WARNING]
>
> **Breaking Change**: minimum supported versions have been updated to:
>
> - Node.js 20
> - TypeScript 5.0
> - TypeScript-ESLint 8

- feat: add excludeSourcePatterns option to import-access/jsdoc rule (#125)

### 2.2.2

- fix typing incompatibility with typescript-eslint (#49)

### 2.2.1

- Support ESLint V9 (#33)

### 2.2.0

- Support Flat Config (#20)

### 2.1.2

- fix bug check package incorrect on Windows (#15)

### 2.1.1

- Fixed the `treatSelfReferenceAs` option to support scoped packages. (#13)

### 2.1.0

- Added a `treatSelfReferenceAs` option which allows you to treat self-references either like internal file or like external module. (#12)

### 2.0.0

#### :warning: BREAKING CHANGES

- Minimum supported TypeScript version is now 4.7 (previously 4.4)
- Minimum supported Node.js version is now 16 (previously 14)

#### Other Changes

- Added check for the `export { ... } from` syntax. Previously you could export a private symbol by using this syntax, but now it is also checked. (#9)
- Fixed the handling of symlinked external modules. (#10)

### 1.1.2

- Fixed the issue where one could not import from type-only packages. (#7)
- Fixed the issue where one could not import from Node.js built-in modules. (#8)

### 1.1.1

- Removed check against imports from inside `node_modules`. (#6)

### 1.1.0

- Added a `defaultImportability` option with which you can use `@package` or `@private` as default importability of all exports in the project. (#5)

### 1.0.2

- Fix a bug that `export default` is not checked. (#2)
- Extend the file name pattern to consider as an index file. Previously only `index.ts` and `index.tsx` were considered as an index file. Now `index.js`, `index.mts`, etc. are also considered.

### 1.0.1

- Upgrade TypeScript to 4.5 (https://github.com/uhyo/eslint-plugin-import-access/pull/1)

### 1.0.0

No change from 1.0.0-beta.

### 1.0.0-beta

Initial release.
