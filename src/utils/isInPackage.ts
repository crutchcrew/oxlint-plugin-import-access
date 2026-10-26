import path from "node:path"

import { Minimatch } from "minimatch"

import type { PackageOptions } from "./options.ts"

const indexFileRegExp = /[/\\]index\.[cm]?[jt]sx?$/

type CompiledPattern = { readonly negated: boolean; readonly matcher: Minimatch }

/**
 * Decides which directory is the "package" of a file and whether two files share a package.
 * Create one per options object: it memoizes per-directory answers.
 * @public
 */
export class PackageBoundaries {
	readonly #options: PackageOptions
	readonly #patterns: readonly CompiledPattern[] | undefined
	readonly #packageDirCache = new Map<string, string>()

	constructor(options: PackageOptions) {
		this.#options = options
		const patterns = options.packageDirectory
		this.#patterns =
			patterns && patterns.length > 0
				? patterns.map((pattern) => {
						const negated = pattern.startsWith("!")
						return { negated, matcher: new Minimatch(negated ? pattern.slice(1) : pattern) }
					})
				: undefined
	}

	/**
	 * Whether `dir` matches the `packageDirectory` patterns (i.e. is a package boundary).
	 */
	#isPackageDirectory(dir: string, patterns: readonly CompiledPattern[]): boolean {
		const dirName = path.basename(dir)
		const relativePath = path.relative(this.#options.projectDirectory, dir)
		let matched = false
		for (const { negated, matcher } of patterns) {
			if (matcher.match(dirName) || matcher.match(relativePath)) {
				if (negated) {
					return false
				}
				matched = true
			}
		}
		return matched
	}

	/**
	 * The package directory of a file: its own directory, or with `packageDirectory` patterns,
	 * the closest ancestor directory that is a package boundary.
	 */
	packageDirectoryOf(filePath: string): string {
		const fileDir = path.dirname(filePath)
		const patterns = this.#patterns
		if (patterns === undefined) {
			return fileDir
		}
		const cached = this.#packageDirCache.get(fileDir)
		if (cached !== undefined) {
			return cached
		}
		let result = fileDir
		const { root } = path.parse(fileDir)
		for (let dir = fileDir; dir !== root; dir = path.dirname(dir)) {
			if (this.#isPackageDirectory(dir, patterns)) {
				result = dir
				break
			}
		}
		this.#packageDirCache.set(fileDir, result)
		return result
	}

	/**
	 * Whether `importer` is in the same package as `exporter`, or in a descendant package.
	 */
	isInPackage(importer: string, exporter: string): boolean {
		if (this.#options.indexLoophole) {
			const match = indexFileRegExp.exec(exporter)
			if (match) {
				// `sub/index.ts` acts as `sub.ts`, so an index file can be the entry point of a sub package.
				exporter = exporter.slice(0, -match[0].length)
			}
		}

		const importerPackageDir = this.packageDirectoryOf(importer)
		const exporterPackageDir = this.packageDirectoryOf(exporter)
		if (importerPackageDir === exporterPackageDir) {
			return true
		}

		if (this.#options.filenameLoophole) {
			// `foo.ts` may import from `foo/bar.ts`.
			const rel = path.relative(path.dirname(importer), path.dirname(exporter))
			if (rel === path.basename(importer, path.extname(importer))) {
				return true
			}
		}

		// The exporter's package is an ancestor of the importer's package.
		const rel = path.relative(exporterPackageDir, importerPackageDir)
		return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
	}
}
