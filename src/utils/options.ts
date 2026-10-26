/** @public */
export type Importability = "public" | "package" | "private"

/**
 * Options of the `import-access/jsdoc` rule.
 * @public
 */
export type JSDocRuleOptions = {
	/**
	 * Allow importing package-private exports from `index.ts` in a subdirectory,
	 * as if `sub/index.ts` were `sub.ts`.
	 * @default true
	 */
	indexLoophole: boolean
	/**
	 * Allow `foo.ts` to import package-private exports from files in `foo/`.
	 * @default false
	 */
	filenameLoophole: boolean
	/**
	 * Importability of exports that have no access tag in their JSDoc.
	 * @default "package"
	 */
	defaultImportability: Importability
	/**
	 * How to treat imports that use the package's own name (Node.js self-reference).
	 * `external` skips the check like for any other package; `internal` checks them.
	 * @default "external"
	 */
	treatSelfReferenceAs: "internal" | "external"
	/**
	 * Glob patterns, relative to the working directory, of exporter files to skip.
	 * Useful for generated code.
	 * @default []
	 */
	excludeSourcePatterns: readonly string[]
	/**
	 * Glob patterns of directories that are package boundaries. By default every directory is one.
	 * Negated patterns (`"!**\/_internal"`) exclude directories, which then belong to their parent package.
	 */
	packageDirectory?: readonly string[] | undefined
}

/**
 * Resolved options used by the importability check.
 * @public
 */
export type PackageOptions = Readonly<JSDocRuleOptions> & {
	/** Base directory for relative glob patterns. */
	readonly projectDirectory: string
}

export const defaultOptions: JSDocRuleOptions = {
	indexLoophole: true,
	filenameLoophole: false,
	defaultImportability: "package",
	treatSelfReferenceAs: "external",
	excludeSourcePatterns: [],
}

/**
 * Fill in defaults for user-provided options.
 * @public
 */
export function normalizeOptions(
	options: Partial<JSDocRuleOptions> | undefined,
	projectDirectory: string,
): PackageOptions {
	return {
		indexLoophole: options?.indexLoophole ?? defaultOptions.indexLoophole,
		filenameLoophole: options?.filenameLoophole ?? defaultOptions.filenameLoophole,
		defaultImportability: options?.defaultImportability ?? defaultOptions.defaultImportability,
		treatSelfReferenceAs: options?.treatSelfReferenceAs ?? defaultOptions.treatSelfReferenceAs,
		excludeSourcePatterns: options?.excludeSourcePatterns ?? defaultOptions.excludeSourcePatterns,
		packageDirectory: options?.packageDirectory,
		projectDirectory,
	}
}
