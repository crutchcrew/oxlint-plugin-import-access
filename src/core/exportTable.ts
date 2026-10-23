import { readFileSync, statSync } from "node:fs"

import { parseSync } from "oxc-parser"
import type { Program } from "oxc-parser"

import { type Comment, jsDocTagsAt, type NodeTags, type Tag } from "../utils/jsdoc.ts"

/**
 * Where the declaration of an export keeps the JSDoc that TypeScript's
 * `symbol.getJsDocTags()` reads.
 */
export type OwnJsDoc =
	/** Declarations that are statements: functions, classes, `export default …`, `export =`. */
	| { readonly kind: "statement" }
	/** `export { a }`: the specifier, including comments on the same line before it. */
	| { readonly kind: "specifier"; readonly start: number }
	/** `export const a = 1, b = 2`: the declarator, and the statement when it is the only one. */
	| { readonly kind: "variable"; readonly nameStart: number; readonly statementEnd: number }
	/** `export * as ns from "…"`: the namespace export has no JSDoc of its own. */
	| { readonly kind: "none" }

/**
 * One export of a name by a module, in the shape the importability check needs.
 */
export type ExportEntry = {
	/**
	 * `false` for exports upstream never checks (enums, namespaces, `export import x = …`):
	 * TypeScript's `findExportableDeclaration` finds no exportable statement for them.
	 */
	readonly checked: boolean
	/** Start of the whole export statement. */
	readonly statementStart: number
	readonly own: OwnJsDoc
}

/**
 * Exports of one module file.
 */
export type ModuleExports = {
	readonly fileName: string
	/** `undefined` when the fast path proved every export public. */
	readonly names: ReadonlyMap<string, readonly ExportEntry[]> | undefined
	/** Module requests of `export * from "…"` statements. */
	readonly stars: readonly string[]
	/**
	 * JSDoc tags of a name's entries, in the order upstream reads them:
	 * the own tags of every declaration, then all tags of the first declaration's statement.
	 */
	tagsOf(entries: readonly ExportEntry[]): Tag[]
}

/** Name under which a module's `export = value` is stored, as TypeScript names the symbol. */
export const EXPORT_EQUALS = "export="

/**
 * Text that has to be present for a file to contain any access tag.
 * `@public` is not listed: it only ever restores the default `public`.
 */
const accessTagPattern = /@(?:package|private|access)(?![\p{ID_Continue}$])/u
const starExportPattern = /\bexport\s+(?:type\s+)?\*/
const exportEqualsPattern = /(?<![\p{ID_Continue}$.])export\s*=(?![=>])/gu

export function skipTrivia(text: string, pos: number): number {
	for (;;) {
		const code = text.charCodeAt(pos)
		if (code === 32 || code === 9 || code === 10 || code === 13 || code === 11 || code === 12) {
			pos++
		} else if (code === 47 /* / */ && text.charCodeAt(pos + 1) === 47) {
			const end = text.indexOf("\n", pos)
			pos = end === -1 ? text.length : end
		} else if (code === 47 && text.charCodeAt(pos + 1) === 42 /* * */) {
			const end = text.indexOf("*/", pos + 2)
			pos = end === -1 ? text.length : end + 2
		} else {
			return pos
		}
	}
}

const identifierPattern = /[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*/uy

function wordAt(text: string, pos: number): string {
	identifierPattern.lastIndex = pos
	return identifierPattern.exec(text)?.[0] ?? ""
}

type DeclarationKind = "variable" | "checked" | "unchecked"

/**
 * Kind of the declaration at `pos` (right after `export`, possibly after `declare`).
 * Upstream checks variables, functions, classes, type aliases and interfaces only.
 */
function declarationKind(text: string, pos: number): DeclarationKind {
	let word = wordAt(text, pos)
	if (word === "declare") {
		pos = skipTrivia(text, pos + word.length)
		word = wordAt(text, pos)
	}
	switch (word) {
		case "const":
			// `const enum` is an enum.
			return wordAt(text, skipTrivia(text, pos + word.length)) === "enum" ? "unchecked" : "variable"
		case "let":
		case "var":
			return "variable"
		case "function":
		case "async":
		case "class":
		case "abstract":
		case "type":
		case "interface":
			return "checked"
		default:
			return "unchecked"
	}
}

/**
 * Whether the export statement at `start` is a specifier list: `export { … }` / `export type { … }`.
 */
function isSpecifierList(text: string, start: number): boolean {
	let pos = skipTrivia(text, start + "export".length)
	if (text.startsWith("type", pos)) {
		pos = skipTrivia(text, pos + "type".length)
	}
	return text.charCodeAt(pos) === 123 /* { */
}

function isInComment(comments: readonly Comment[], pos: number): boolean {
	let lo = 0
	let hi = comments.length - 1
	while (lo <= hi) {
		const mid = (lo + hi) >> 1
		const comment = comments[mid]!
		if (pos < comment.start) {
			hi = mid - 1
		} else if (pos >= comment.end) {
			lo = mid + 1
		} else {
			return true
		}
	}
	return false
}

/**
 * Whether `pos` starts the keyword `export` (not part of a longer identifier, not in a comment).
 */
function isExportKeywordAt(text: string, comments: readonly Comment[], pos: number): boolean {
	return !isInComment(comments, pos) && (pos === 0 || !/[\p{ID_Continue}$.]/u.test(text[pos - 1]!))
}

/**
 * Start of the `export` statement an entry belongs to.
 *
 * oxc-parser files `import { a } from "./a"; export { a }` under the *import* statement
 * (the export becomes an indirect export of `./a`), so the statement start it reports
 * can be the import. The JSDoc that matters is on the `export { … }` statement.
 */
function exportStatementStart(
	text: string,
	comments: readonly Comment[],
	statementStart: number,
	entryStart: number,
): number {
	if (text.startsWith("export", statementStart)) {
		return statementStart
	}
	let pos = text.lastIndexOf("export", entryStart)
	while (pos > 0 && !isExportKeywordAt(text, comments, pos)) {
		pos = text.lastIndexOf("export", pos - 1)
	}
	return pos
}

/**
 * Starts of `export = value` statements (absent from oxc-parser's module record).
 */
function exportEqualsStarts(text: string, comments: readonly Comment[]): number[] {
	const starts: number[] = []
	for (const match of text.matchAll(exportEqualsPattern)) {
		if (!isInComment(comments, match.index)) {
			starts.push(match.index)
		}
	}
	return starts
}

type VariableDeclarators = {
	readonly single: boolean
	/** Start and end of each declarator. */
	readonly spans: readonly (readonly [number, number])[]
}

export function createModuleExports(
	fileName: string,
	text: string,
	comments: readonly Comment[],
	names: ReadonlyMap<string, readonly ExportEntry[]> | undefined,
	stars: readonly string[],
	program?: () => Program,
): ModuleExports {
	const tagCache = new Map<string, NodeTags>()
	const tagsAt = (start: number, includeSameLine: boolean): NodeTags => {
		const key = `${start}:${includeSameLine}`
		let tags = tagCache.get(key)
		if (tags === undefined) {
			tags = jsDocTagsAt(text, comments, start, includeSameLine)
			tagCache.set(key, tags)
		}
		return tags
	}

	let declarators: Map<number, VariableDeclarators> | undefined
	const declaratorsOf = (statementStart: number): VariableDeclarators | undefined => {
		if (declarators === undefined) {
			declarators = new Map()
			for (const statement of program!().body) {
				const declaration =
					statement.type === "ExportNamedDeclaration" ? statement.declaration : undefined
				if (declaration?.type === "VariableDeclaration") {
					declarators.set(statement.start, {
						single: declaration.declarations.length === 1,
						spans: declaration.declarations.map(({ start, end }) => [start, end] as const),
					})
				}
			}
		}
		return declarators.get(statementStart)
	}

	const ownTags = (entry: ExportEntry): readonly Tag[] => {
		const { own } = entry
		switch (own.kind) {
			case "statement":
				return tagsAt(entry.statementStart, false).own
			case "specifier":
				return tagsAt(own.start, true).own
			case "none":
				return []
		}
		// A variable: only a JSDoc comment inside the statement can belong to a declarator,
		// otherwise the statement's JSDoc is all there is.
		const inner = comments.some(
			(comment) =>
				comment.start > entry.statementStart &&
				comment.end <= own.statementEnd &&
				comment.value.startsWith("*"),
		)
		const statementTags = tagsAt(entry.statementStart, false).own
		const variables = inner ? declaratorsOf(entry.statementStart) : undefined
		if (variables === undefined) {
			return statementTags
		}
		const span = variables.spans.find(
			([start, end]) => start <= own.nameStart && own.nameStart < end,
		)!
		const declaratorTags = tagsAt(span[0], true).own
		return variables.single ? [...declaratorTags, ...statementTags] : declaratorTags
	}

	return {
		fileName,
		names,
		stars,
		tagsOf(entries) {
			const tags = entries.flatMap(ownTags)
			tags.push(...tagsAt(entries[0]!.statementStart, false).all)
			return tags
		},
	}
}

/**
 * Build the export table of a module from its source text.
 *
 * Only oxc-parser's module record and comments are read; the AST is only deserialized
 * for the rare JSDoc comment inside a variable statement. That is several times faster
 * than walking `program`.
 */
export function parseModuleExports(
	fileName: string,
	text: string,
	assumeAllPublic: boolean,
): ModuleExports {
	if (assumeAllPublic && !accessTagPattern.test(text) && !starExportPattern.test(text)) {
		return createModuleExports(fileName, text, [], undefined, [])
	}

	const result = parseSync(fileName, text)
	const { comments } = result
	const names = new Map<string, ExportEntry[]>()
	const stars: string[] = []
	const add = (name: string, entry: ExportEntry) => {
		const list = names.get(name)
		if (list) {
			list.push(entry)
		} else {
			names.set(name, [entry])
		}
	}

	for (const statement of result.module.staticExports) {
		for (const entry of statement.entries) {
			const { exportName, importName, localName, moduleRequest } = entry
			if (importName.kind === "AllButDefault") {
				stars.push(moduleRequest!.value)
				continue
			}
			const statementStart = exportStatementStart(text, comments, statement.start, entry.start)
			let checked = true
			let own: OwnJsDoc = { kind: "statement" }
			if (isSpecifierList(text, statementStart)) {
				own = { kind: "specifier", start: entry.start }
			} else if (importName.kind === "All") {
				own = { kind: "none" }
			} else if (exportName.kind === "Name" && localName.kind === "Name") {
				const kind = declarationKind(text, entry.start)
				checked = kind !== "unchecked"
				if (kind === "variable") {
					own = { kind: "variable", nameStart: exportName.start!, statementEnd: statement.end }
				}
			}
			add(exportName.kind === "Default" ? "default" : exportName.name!, {
				checked,
				statementStart,
				own,
			})
		}
	}
	for (const start of exportEqualsStarts(text, comments)) {
		add(EXPORT_EQUALS, { checked: true, statementStart: start, own: { kind: "statement" } })
	}

	return createModuleExports(fileName, text, comments, names, stars, () => result.program)
}

type CacheEntry = {
	readonly mtimeMs: number
	readonly size: number
	/** Lint generation in which the file was last stat-ed. */
	generation: number
	readonly exports: ModuleExports
}

/**
 * Process-wide cache of module export tables.
 *
 * Files are re-validated (stat-ed, re-parsed when changed) at most once per generation.
 * In long-running hosts such as the oxlint language server, every linted file starts a new
 * generation; a CLI run stays in one generation and reads each file once.
 */
export class ExportTableCache {
	readonly #entries = new Map<string, CacheEntry>()
	#generation = 0

	/** Start a new generation: files will be re-validated on their next lookup. */
	nextGeneration(): void {
		this.#generation++
	}

	/**
	 * Export table of `fileName`, or `undefined` when the file can't be read.
	 */
	get(fileName: string, assumeAllPublic: boolean): ModuleExports | undefined {
		const cached = this.#entries.get(fileName)
		// A table from the fast path has no entries, so it only answers "assume all public" lookups.
		const usable =
			cached !== undefined && (cached.exports.names !== undefined || assumeAllPublic)
				? cached
				: undefined
		if (usable?.generation === this.#generation) {
			return usable.exports
		}
		let stats
		try {
			stats = statSync(fileName)
		} catch {
			return undefined
		}
		if (usable !== undefined && usable.mtimeMs === stats.mtimeMs && usable.size === stats.size) {
			usable.generation = this.#generation
			return usable.exports
		}
		const exports = parseModuleExports(fileName, readFileSync(fileName, "utf8"), assumeAllPublic)
		this.#entries.set(fileName, {
			mtimeMs: stats.mtimeMs,
			size: stats.size,
			generation: this.#generation,
			exports,
		})
		return exports
	}

	clear(): void {
		this.#entries.clear()
	}
}
