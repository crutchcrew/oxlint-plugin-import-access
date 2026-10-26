import path from "node:path"

import { Minimatch } from "minimatch"

import { getAccessOfJsDocs } from "../utils/getAccessOfJsDocs.ts"
import { PackageBoundaries } from "../utils/isInPackage.ts"
import type { PackageOptions } from "../utils/options.ts"
import { AmbientModuleIndex } from "./ambientModules.ts"
import {
	EXPORT_EQUALS,
	type ExportEntry,
	ExportTableCache,
	type ModuleExports,
} from "./exportTable.ts"
import { lookupPackageName } from "./lookupPackageJson.ts"
import { ModuleResolver } from "./resolveModule.ts"

/**
 * A violation: the access level of the export, and its name as TypeScript reports it
 * (`default` for default exports, `export=` for `export =`).
 */
export type Violation = {
	readonly access: "package" | "private"
	readonly identifier: string
}

/**
 * A specifier that could name a package or a subpath of one (not relative, not absolute).
 */
const possibleSubpathImportFromPackage = /^(?![./\\])([^/\\]*)(?:$|[/\\][^/\\])/
const relativeOrAbsolute = /^(?:\.{1,2}(?:[/\\]|$)|[/\\]|[a-zA-Z]:[/\\])/

type FoundExport = {
	readonly module: ModuleExports
	readonly name: string
	readonly entries: readonly ExportEntry[]
}

/**
 * Shared state for checking imports: resolver, parsed modules and ambient modules.
 * One instance lives for the whole process; its caches are keyed by file path.
 * @public
 */
export class ImportabilityChecker {
	readonly resolver: ModuleResolver = new ModuleResolver()
	readonly exportTables: ExportTableCache = new ExportTableCache()
	readonly ambientModules: AmbientModuleIndex = new AmbientModuleIndex()
	/** Results of `findExport`, which may follow `export *` chains across files. */
	#found = new WeakMap<ModuleExports, Map<string, FoundExport | null>>()

	/**
	 * Find the module entry TypeScript's `getImmediateAliasedSymbol` would return:
	 * a direct export of `name` stops the search (even when it re-exports something else),
	 * `export * from` edges are followed.
	 */
	findExport(module: ModuleExports, name: string): FoundExport | undefined {
		let byName = this.#found.get(module)
		if (byName === undefined) {
			byName = new Map()
			this.#found.set(module, byName)
		}
		let found = byName.get(name)
		if (found === undefined) {
			found = this.#findExport(module, name, new Set()) ?? null
			byName.set(name, found)
		}
		return found ?? undefined
	}

	#findExport(module: ModuleExports, name: string, visited: Set<string>): FoundExport | undefined {
		if (module.names === undefined) {
			// Fast path: no access tags and no star exports in the file.
			return undefined
		}
		const entries = module.names.get(name)
		if (entries !== undefined) {
			return { module, name, entries }
		}
		if (name === "default") {
			// A default import of an `export =` module imports the `export=` symbol.
			// `export *` never re-exports the default export.
			const exportEquals = module.names.get(EXPORT_EQUALS)
			return exportEquals && { module, name: EXPORT_EQUALS, entries: exportEquals }
		}
		visited.add(module.fileName)
		for (const request of module.stars) {
			const target = this.resolver.resolve(module.fileName, request)
			if (target.kind !== "internal" || visited.has(target.fileName)) {
				continue
			}
			// Full tables behind stars: a fast-path table can't tell whether it exports `name`,
			// and a public export there must stop the search.
			const targetModule = this.exportTables.get(target.fileName, false)
			const found = targetModule && this.#findExport(targetModule, name, visited)
			if (found !== undefined) {
				return found
			}
		}
		return undefined
	}

	/**
	 * Module that `specifier` leads to from `importerFileName`, if the rule should check it.
	 * Mirrors TypeScript's order: exact ambient module, resolved file, wildcard ambient module.
	 */
	targetModule(
		importerFileName: string,
		specifier: string,
		projectDirectory: string,
		assumeAllPublic: boolean,
	): ModuleExports | undefined {
		if (!relativeOrAbsolute.test(specifier)) {
			const ambient = this.ambientModules.exact(projectDirectory, specifier)
			if (ambient !== undefined) {
				return ambient
			}
		}
		const resolution = this.resolver.resolve(importerFileName, specifier)
		if (resolution.kind === "internal") {
			return this.exportTables.get(resolution.fileName, assumeAllPublic)
		}
		return resolution.kind === "unresolved"
			? this.ambientModules.pattern(projectDirectory, specifier)
			: undefined
	}

	/**
	 * Whether files can change while this process runs. The CLI lints a snapshot, each file once;
	 * long-running hosts (the oxlint language server) lint files again as they change.
	 */
	#watching: boolean
	readonly #lintedFiles = new Set<string>()

	constructor(watching: boolean = process.argv.includes("--lsp")) {
		this.#watching = watching
	}

	/**
	 * Start checking `fileName`. In a long-running host, everything read for earlier files is
	 * re-validated: exporter files are stat-ed again and specifiers resolved again.
	 */
	nextFile(fileName: string): void {
		if (!this.#watching) {
			if (!this.#lintedFiles.has(fileName)) {
				this.#lintedFiles.add(fileName)
				return
			}
			// Linting a file a second time: this is no one-shot CLI run.
			this.#watching = true
			this.#lintedFiles.clear()
		}
		this.exportTables.nextGeneration()
		this.resolver.clear()
		this.#found = new WeakMap()
	}

	clear(): void {
		this.#found = new WeakMap()
		this.resolver.clear()
		this.exportTables.clear()
		this.ambientModules.clear()
	}
}

/**
 * Per-options part of the check: compiled globs and package boundaries.
 * @public
 */
export class ImportabilityPolicy {
	readonly options: PackageOptions
	readonly #exclude: readonly Minimatch[]
	readonly #boundaries: PackageBoundaries

	constructor(options: PackageOptions) {
		this.options = options
		this.#exclude = options.excludeSourcePatterns.map(
			(pattern) => new Minimatch(pattern, { dot: true }),
		)
		this.#boundaries = new PackageBoundaries(options)
	}

	#isExcluded(exporterFileName: string): boolean {
		if (this.#exclude.length === 0) {
			return false
		}
		const relativePath = path.relative(this.options.projectDirectory, exporterFileName)
		return this.#exclude.some((matcher) => matcher.match(relativePath))
	}

	#isSelfReference(importerFileName: string, specifier: string): boolean {
		if (
			this.options.treatSelfReferenceAs !== "external" ||
			!possibleSubpathImportFromPackage.test(specifier)
		) {
			return false
		}
		const packageName = lookupPackageName(importerFileName)
		return (
			packageName !== null && (specifier === packageName || specifier.startsWith(`${packageName}/`))
		)
	}

	/**
	 * Check importing `name` (the export name, `default` for default imports) via `specifier`.
	 */
	check(
		checker: ImportabilityChecker,
		importerFileName: string,
		specifier: string,
		name: string,
	): Violation | undefined {
		const { defaultImportability, projectDirectory } = this.options
		// Exports without access tags are public, so files without any tag need no parsing.
		const assumeAllPublic = defaultImportability === "public"
		const module = checker.targetModule(
			importerFileName,
			specifier,
			projectDirectory,
			assumeAllPublic,
		)
		const found = module && checker.findExport(module, name)
		if (found === undefined || !found.entries[0]!.checked) {
			return undefined
		}
		const exporterFileName = found.module.fileName
		if (this.#isExcluded(exporterFileName) || this.#isSelfReference(importerFileName, specifier)) {
			return undefined
		}
		const access = getAccessOfJsDocs(found.module.tagsOf(found.entries), defaultImportability)
		if (
			access === "public" ||
			(access === "package" && this.#boundaries.isInPackage(importerFileName, exporterFileName))
		) {
			return undefined
		}
		return { access, identifier: found.name }
	}
}
