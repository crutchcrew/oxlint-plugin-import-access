# `import-access/jsdoc` rule

This rule checks every import against the JSDoc access tag of the imported export:

- `@public` exports can be imported from anywhere.
- `@package` exports can be imported only from files in the same "package" (or sub packages). By default, every directory is a package. An export without an access tag is `@package` (see [`defaultImportability`](#defaultimportability)).
- `@private` exports can't be imported at all.

![sub/foo.ts exports api tagged @public, helper without a tag and secret tagged @private. sub/bar.ts, in the same package, can import api and helper but not secret. src/main.ts, outside the package, can import only api.](./images/access.svg)

`@access public`, `@access package` and `@access private` work the same as the short tags.

The rule needs no type information and no `tsconfig.json`: see [How exports are found](#how-exports-are-found).

**Example settings in `.oxlintrc.json`**:

```jsonc
{
	"jsPlugins": ["@crutchcrew/oxlint-plugin-import-access"],
	"rules": {
		"import-access/jsdoc": [
			"error",
			{
				"indexLoophole": true,
				"filenameLoophole": false,
				"defaultImportability": "package", // "package" | "public" | "private"
				"treatSelfReferenceAs": "external", // "internal" | "external"
				"excludeSourcePatterns": ["generated/**/*"], // glob patterns of exporter files to skip
				"packageDirectory": ["**", "!**/_internal"], // glob patterns of package boundaries
			},
		],
	},
}
```

## Example

```ts
// ----- sub/foo.ts -----

/**
 * @public
 */
export const fooPublicVariable = "I am public export"

// No access tag, so this export is @package
export const fooPackageVariable = "I am package-private export"

/**
 * @private
 */
export const fooPrivateVariable = "I am private export"

// ----- sub/bar.ts -----
// This is correct because foo.ts is in the same directory
import { fooPackageVariable } from "./foo"
// This is INCORRECT because private exports cannot be imported at all
import { fooPrivateVariable } from "./foo"
// ----- baz.ts -----
// This is correct because @public exports can be imported from anywhere
import { fooPublicVariable } from "./sub/foo"
// This is INCORRECT because package-private exports
// cannot be imported from outside the sub directory
import { fooPackageVariable } from "./sub/foo"
```

Namespace imports are checked by the members they access, `foo.name`, `foo["name"]` and types such as `foo.Name`:

```ts
// ----- baz.ts -----
import * as foo from "./sub/foo"

// This is correct
console.log(foo.fooPublicVariable)
// This is INCORRECT, like importing fooPrivateVariable by name
console.log(foo.fooPrivateVariable)
```

Uses of the whole namespace object, such as passing `foo` to a function, are not checked.

## Options

The `import-access/jsdoc` rule has the following options. All options are optional (see below for default values).

```ts
type JSDocRuleOptions = {
	indexLoophole?: boolean
	filenameLoophole?: boolean
	defaultImportability?: "public" | "package" | "private"
	treatSelfReferenceAs?: "internal" | "external"
	excludeSourcePatterns?: string[]
	packageDirectory?: string[]
}
```

### `indexLoophole`

_Default value: `true`_

Enables the **index loophole** feature. When this option is enabled, `sub/index.ts` is treated similarly to `sub.ts`. That is, package-private exports exported from `index.ts` can be imported from files in the parent directory.

![Illustration of how indexLoophole works.](./images/indexLoophole.png)

**Example:**

```ts
// ----- sub/index.ts
/**
 * @package
 */
export const subIndex = 3

// ----- sub/foo.ts
/**
 * @package
 */
export const foo = 3

// ----- main.ts
// This is CORRECT under indexLoophole: true
import { subIndex } from "./sub"
// This is still INCORRECT
import { foo } from "./sub/foo"
```

Note that the loophole is effective only for one level. That is, package-private exports from `index.ts` cannot be imported from files in the parent directory's parent directory.

```ts
// ----- sub/sub2/index.ts

/**
 * @package
 */
export const pika = "chu"

// ----- bar.ts
// This is still INCORRECT
import { pika } from "./sub/sub2/index"
// ----- sub/foo.ts
// This is correct
import { pika } from "./sub2/index"
```

### `filenameLoophole`

_Default value: `false`_

Enables the **filename loophole** feature. When this option is enabled, package-private exports in a directory can be imported from a file with the same name as the directory.

![Illustration of how filenameLoophole works.](./images/filenameLoophole.png)

**Example:**

```ts
// ----- sub/foo.ts

/**
 * @package
 */
export const pika = "chu"

// ----- sub.ts
// This is correct to import a package-private exports
// from the directory named `sub`
import { pika } from "./sub/foo"
// ----- pika.ts
// This is still INCORRECT because file name does not match
// the directory name
import { pika } from "./sub/foo"
```

### `defaultImportability`

_Default value: `package`_

Sets the access of exports without an access tag, for the entire project. With the default `package`, they are treated as `@package` and can be imported only from their own package: only exports tagged `@public` can be imported from anywhere.

Set it to `public` to treat every untagged export as `@public`, which is the original plugin's default, or to `private` to treat every untagged export as `@private`.

An access tag on an export always overrides this default.

**Example:**

```ts
// defaultImportability: "package"
// ----- sub/bar.ts

export const pika = "chu" // no JSDoc, but automatically applied @package

/**
 * @public
 */
export const raichu = "rai"

// ----- sub/foo.ts
// you can import
import { pika } from "./bar"
// ----- bar2.ts
// you cannot import because pika is @package
import { pika } from "./sub/bar"
// you can import because raichu is @public
import { raichu } from "./sub/bar"
```

### `treatSelfReferenceAs`

_Default value: `external`_

Self referencing is [a feature of Node.js](https://nodejs.org/api/packages.html#self-referencing-a-package-using-its-name) that allows importing a file in the same package by using package name as the module specifier.

When this option is set to `external`, self reference is treated as an external export. Therefore, no restriction is applied to such imports.

When this option is set to `internal`, self reference is treated as an internal export. Therefore, self reference is restricted by the same rules as other internal exports.

**Example:**

```ts
// ----- src/somewhere/foo.ts
/**
 * @package
 */
export const something = "something"

// ----- src/main.ts
// This is CORRECT when treatSelfReferenceAs: external
import { something } from "my-package/foo"
```

In the above example, `my-package/foo` is a self reference that connects to `src/somewhere/foo.ts`.

When `treatSelfReferenceAs: external`, this import is always allowed even though `something` is a package-private export because it is treated like an import from an external package.

When `treatSelfReferenceAs: internal`, this import is disallowed because import from `my-package/foo` is treated like an import from `src/somewhere/foo.ts`.

### `excludeSourcePatterns`

_Default value: `[]`_

An array of glob patterns for source paths to exclude from the importability check. The patterns are resolved relative to the working directory oxlint runs in. When importing from a module that matches one of these patterns, the import-access/jsdoc rule will not apply any restrictions, regardless of the JSDoc annotations or defaultImportability setting.

This is particularly useful for handling imports from auto-generated files that don't have proper JSDoc annotations.

The patterns use the [minimatch](https://github.com/isaacs/minimatch) library's glob syntax.

**Examples:**

```ts
// Example: Match by file path
// excludeSourcePatterns: ["src/types/**/*.d.ts"]
import { typeDefinition } from "../types/api" // Allowed if the implementation is in a .d.ts file in the src/types directory
```

Additional examples:

```js
// Match all files in a particular directory
"src/generated/**"

// Match multiple extensions
"**/*.{generated,auto}.{ts,js}"

// Match files with specific naming patterns
"**/[a-z]*.auto.ts"

// Match specific type definition files
"src/**/*.d.ts"
```

**Next.js specific configuration:**

When working with Next.js projects, it's recommended to exclude the `.next` directory which contains auto-generated files:

```jsonc
// In your .oxlintrc.json
{
	"rules": {
		"import-access/jsdoc": [
			"error",
			{
				// ... other options ...
				"excludeSourcePatterns": [".next/**"],
			},
		],
	},
}
```

This will ensure that any imports from auto-generated files in the `.next` directory are not subject to import-access restrictions.

### `packageDirectory`

_Default value: `["**"]` (all directories are treated as package boundaries)_

An array of glob patterns that specify which directories should be treated as package boundaries. By default, every directory creates a package boundary. This option allows you to customize which directories are considered package boundaries, which is useful for organizing internal implementation details in subdirectories without creating separate packages.

The patterns use the [minimatch](https://github.com/isaacs/minimatch) library's glob syntax and are matched against the directory name and its path relative to the working directory.

**Example 1: Excluding `_internal` directories**

```ts
// Configuration
{
  "packageDirectory": ["**", "!**/_internal"]
}

// ----- src/feature1/foo.ts
import { internalHelper } from "./_internal/helpers"; // ✓ Allowed

// ----- src/feature1/_internal/helpers.ts
/**
 * @package
 */
export const internalHelper = () => { /* ... */ };

// ----- src/main.ts
// This is still INCORRECT because you are trying to import from inside the feature1 package
import { internalHelper } from "./feature1/_internal/helpers";
```

In this example:

- `["**", "!**/_internal"]` means all directories are package boundaries except those named `_internal`
- Files in `_internal/` are treated as belonging to the parent directory's package
- `src/feature1/foo.ts` can import from `src/feature1/_internal/helpers.ts` because they're in the same package
- `src/main.ts` cannot import from `src/feature1/_internal/helpers.ts` because `src/feature1` is a different package

**Example 2: Package boundaries at specific directory level**

```ts
// Configuration
{
  "packageDirectory": ["src/packages/*"]
}

// ----- src/packages/packageA/index.ts
export const foo = "foo";

// ----- src/packages/packageA/utils/helper.ts
/**
 * @package
 */
export const helper = () => { /* ... */ };

// ----- src/packages/packageA/index.ts
import { helper } from "./utils/helper"; // ✓ Allowed (same package)

// ----- src/packages/packageB/index.ts
import { helper } from "../packageA/utils/helper"; // ✗ Error (different package)
```

In this example:

- Only directories directly under `src/packages/` are treated as package boundaries
- `src/packages/packageA/` is a package, but `src/packages/packageA/utils/` is not
- All files within `packageA/` (including subdirectories) belong to the same package
- Cross-package imports are still restricted

**Additional examples:**

```js
// Exclude multiple directory patterns
"packageDirectory": ["**", "!**/_internal", "!**/utils"]

// Only treat specific directories as packages
"packageDirectory": ["packages/*", "apps/*"]

// Exclude deeply nested patterns
"packageDirectory": ["**", "!**/private/**"]
```

## How exports are found

The original ESLint rule asks the TypeScript type checker which declaration an import refers to. This port answers the same question without a type checker, which is what makes it fast:

1. **Resolve** the module specifier like TypeScript does, with [oxc-resolver](https://github.com/oxc-project/oxc-resolver): `tsconfig.json` `paths` and project references, `package.json` `exports`/`types`, `.js` → `.ts` extension mapping, Node.js builtins.
2. **Skip external modules.** Builtins and files reached through `node_modules` are never checked. Like in TypeScript, this includes workspace packages that are symlinked into `node_modules`.
3. **Read the exporter's exports** with [oxc-parser](https://github.com/oxc-project/oxc/tree/main/napi/parser). Mostly only the module record and comments are read; the syntax tree is used for the few files with decorators, `export =`, re-exported imports (`import { a } from "./a"; export { a }`) or JSDoc inside variable statements. Files are parsed once and cached.
4. **Find the export.** A direct export of the imported name is the answer, also when it re-exports something from another file (`export { a } from "./a"`): its JSDoc is what counts, exactly like upstream. `export * from` is followed.
5. **Read the JSDoc** with TypeScript's rules: which comments attach to a declaration, how tags are parsed, and which tag wins.
6. **Ambient modules.** `declare module "name" { … }` and wildcard declarations such as `declare module "*.svg"` in `.d.ts` files under the working directory are checked like files.

Results match upstream on its whole test suite and on additional fixtures for re-exports, `export *` chains, overloads, enums, namespaces, `export =`, ambient and wildcard modules, and JSDoc placement.

### Differences from upstream

- **Default access**: exports without an access tag are `@package` (`defaultImportability: "package"`); upstream treats them as `@public`. Set `defaultImportability: "public"` for upstream's behavior.
- **Namespace imports** (`import * as foo from "./foo"`): members accessed through them are checked. Upstream doesn't check namespace imports at all.
- **Symlinked workspace packages** are always external, even when your root `tsconfig.json` includes their sources. Upstream checks them in that case.
- **Ambient module declarations** are only read from `.d.ts` files outside `node_modules` and hidden directories, and only from files that are not modules themselves. In the language server, restart it after adding new ambient declarations.
- **Only the nearest `tsconfig.json`** is used for `paths`. Aliases defined in a differently named config file (such as `tsconfig.app.json`) that isn't referenced from `tsconfig.json` are not resolved.
- **Declaration merging across files** (module augmentation) is not followed; the JSDoc of the declarations in the resolved file counts.
- **Ambiguous `export *` names**, which TypeScript reports as an error, resolve to the first match.
- **Files with syntax errors**: exports that oxc-parser can't recover are not seen, so imports of them are not checked. TypeScript recovers from more errors.
- **`export * from` inside ambient modules** is not followed, and repeated `declare module "x"` blocks are not merged (the first one counts).
