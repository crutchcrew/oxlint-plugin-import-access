import { realpathSync } from "node:fs"
import path from "node:path"

import { ResolverFactory } from "oxc-resolver"

/**
 * Where an import specifier leads.
 *
 * - `internal`: a source file of the project, which the rule checks.
 * - `external`: a builtin module or a file reached through `node_modules`
 *   (TypeScript's "external library import", which includes symlinked workspace packages).
 * - `unresolved`: nothing found, or a file that is no module to TypeScript (`.svg`, `.css`…);
 *   a wildcard ambient module (`declare module "*.svg"`) may still declare it.
 * @package
 */
export type Resolution =
	| { readonly kind: "internal"; readonly fileName: string }
	| { readonly kind: "external" }
	| { readonly kind: "unresolved" }

const EXTERNAL: Resolution = { kind: "external" }
const UNRESOLVED: Resolution = { kind: "unresolved" }

/** Extensions of files whose exports the rule can read. */
const sourceFilePattern = /\.(?:[cm]?[jt]sx?|d\.[cm]?ts)$/
/** JSON modules resolve (with `resolveJsonModule`) but have no checkable declarations. */
const jsonFilePattern = /\.json$/
const nodeModulesPattern = /[/\\]node_modules[/\\]/

const relativeSpecifier = /^\.{1,2}(?:[/\\]|$)/
/** `./dir/`, `.`, `..`: specifiers that can only name a directory. */
const directorySpecifier = /(?:^|[/\\])\.{0,2}$/

/**
 * Resolves import specifiers like TypeScript would.
 *
 * Results are memoized per importing directory, and relative specifiers also by the absolute
 * path they point at, so every importer of a module shares one resolution.
 * @package
 */
export class ModuleResolver {
	readonly #resolver = new ResolverFactory({
		tsconfig: "auto",
		builtinModules: true,
		// Keep the path as reached so a `node_modules` segment is visible even for symlinked packages.
		symlinks: false,
		conditionNames: ["types", "import", "require", "node", "default"],
		mainFields: ["types", "typings", "module", "main"],
		extensions: [
			".ts",
			".tsx",
			".d.ts",
			".mts",
			".d.mts",
			".cts",
			".d.cts",
			".js",
			".jsx",
			".mjs",
			".cjs",
			".json",
		],
		extensionAlias: {
			".js": [".ts", ".tsx", ".d.ts", ".js", ".jsx"],
			".jsx": [".tsx", ".d.ts", ".jsx"],
			".mjs": [".mts", ".d.mts", ".mjs"],
			".cjs": [".cts", ".d.cts", ".cjs"],
		},
	})
	readonly #byDirectory = new Map<string, Resolution>()
	readonly #byTarget = new Map<string, Resolution>()

	resolve(importerFileName: string, specifier: string): Resolution {
		const importerDir = path.dirname(importerFileName)
		const directoryKey = `${importerDir}\0${specifier}`
		let resolution = this.#byDirectory.get(directoryKey)
		if (resolution === undefined) {
			if (relativeSpecifier.test(specifier)) {
				// `./foo` may be `foo.ts` while `./foo/` is `foo/index.ts`: keep them apart.
				const target =
					path.resolve(importerDir, specifier) +
					(directorySpecifier.test(specifier) ? path.sep : "")
				resolution = this.#byTarget.get(target)
				if (resolution === undefined) {
					resolution = this.#resolveUncached(importerFileName, specifier)
					this.#byTarget.set(target, resolution)
				}
			} else {
				resolution = this.#resolveUncached(importerFileName, specifier)
			}
			this.#byDirectory.set(directoryKey, resolution)
		}
		return resolution
	}

	#resolveUncached(importerFileName: string, specifier: string): Resolution {
		const result = this.#resolver.resolveFileSync(importerFileName, specifier)
		if (result.builtin !== undefined) {
			return EXTERNAL
		}
		const resolved = result.path
		if (resolved === undefined) {
			return UNRESOLVED
		}
		if (jsonFilePattern.test(resolved)) {
			return EXTERNAL
		}
		if (!sourceFilePattern.test(resolved)) {
			// Not a module to TypeScript: only a wildcard ambient module can declare it.
			return UNRESOLVED
		}
		if (nodeModulesPattern.test(resolved)) {
			return EXTERNAL
		}
		return { kind: "internal", fileName: realpathSync.native(resolved) }
	}

	clear(): void {
		this.#byDirectory.clear()
		this.#byTarget.clear()
		this.#resolver.clearCache()
	}
}
