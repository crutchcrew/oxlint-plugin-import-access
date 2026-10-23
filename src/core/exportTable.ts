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
const accessTagPattern = /@(?:package|private|access)(?![\p{ID_Continue}$-])/u
/** `export * from` / `export type * from`, also without spaces or with comments in between. */
const starExportPattern =
	/\bexport(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*(?:type(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*)?\*/
/** Hint that a file may contain `export = value`; the AST confirms it. */
const exportEqualsHint = /\bexport\s*=(?!=)/

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

const identifierPattern = /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/uy

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
	if (text.charCodeAt(pos) === 64 /* @ */) {
		// `export @dec class …`: only classes take decorators.
		return "checked"
	}
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

/** Whether the file may contain decorators: an `@` outside comments. */
function mayHaveDecorators(text: string, comments: readonly Comment[]): boolean {
	for (let pos = text.indexOf("@"); pos !== -1; pos = text.indexOf("@", pos + 1)) {
		if (!isInComment(comments, pos)) {
			return true
		}
	}
	return false
}

/** Initializers whose own JSDoc TypeScript reads for the variable (but not class expressions). */
const jsDocInitializers = new Set([
	"ArrowFunctionExpression",
	"FunctionExpression",
	"ParenthesizedExpression",
])

type Declarator = {
	readonly start: number
	readonly end: number
	/** Start of an initializer that carries JSDoc for the variable. */
	readonly initializer: number | undefined
}

/**
 * What only the syntax tree can tell. Built lazily, for the few files that need it.
 */
type SyntaxDetails = {
	/** Start of the first decorator of decorated `export class` statements, by statement start. */
	readonly decoratorStarts: ReadonlyMap<number, number>
	/** Spans of `export { … }` statements without a source. */
	readonly exportLists: readonly (readonly [number, number])[]
	/** Starts of `export = value` statements. */
	readonly exportEquals: readonly number[]
	/** Declarators of exported variable statements, by statement start. */
	readonly variables: ReadonlyMap<number, readonly Declarator[]>
}

function syntaxDetails(program: Program): SyntaxDetails {
	const decoratorStarts = new Map<number, number>()
	const exportLists: (readonly [number, number])[] = []
	const exportEquals: number[] = []
	const variables = new Map<number, Declarator[]>()
	for (const statement of program.body) {
		switch (statement.type) {
			case "ExportNamedDeclaration":
			case "ExportDefaultDeclaration": {
				const { declaration } = statement
				if (declaration?.type === "ClassDeclaration") {
					const first = declaration.decorators[0]
					if (first !== undefined && first.start < statement.start) {
						decoratorStarts.set(statement.start, first.start)
					}
				} else if (declaration?.type === "VariableDeclaration") {
					variables.set(
						statement.start,
						declaration.declarations.map(({ start, end, init }) => ({
							start,
							end,
							initializer: init && jsDocInitializers.has(init.type) ? init.start : undefined,
						})),
					)
				} else if (declaration === null) {
					exportLists.push([statement.start, statement.end])
				}
				break
			}
			case "TSExportAssignment":
				exportEquals.push(statement.start)
				break
		}
	}
	return { decoratorStarts, exportLists, exportEquals, variables }
}

export function createModuleExports(
	fileName: string,
	text: string,
	comments: readonly Comment[],
	names: ReadonlyMap<string, readonly ExportEntry[]> | undefined,
	stars: readonly string[],
	details?: () => SyntaxDetails,
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
		// A variable. TypeScript gives the statement's last JSDoc block to the first declarator only,
		// and reads JSDoc on each declarator and on function-like initializers. That only matters
		// with JSDoc inside the statement or several JSDoc blocks before it.
		const statementTags = tagsAt(entry.statementStart, false)
		const inner = comments.some(
			(comment) =>
				comment.start > entry.statementStart &&
				comment.end <= own.statementEnd &&
				comment.value.startsWith("*"),
		)
		if (!inner && statementTags.all.length === statementTags.own.length) {
			return statementTags.own
		}
		const declarators = details!().variables.get(entry.statementStart)!
		const index = declarators.findIndex(
			({ start, end }) => start <= own.nameStart && own.nameStart < end,
		)
		const declarator = declarators[index]!
		return [
			...(declarator.initializer === undefined ? [] : tagsAt(declarator.initializer, true).own),
			...tagsAt(declarator.start, true).own,
			...(index === 0 ? statementTags.own : []),
		]
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
 * Mostly oxc-parser's module record and comments are read. The syntax tree, several times
 * slower to get, is only used for files with decorators, `export =`, re-exported imports
 * or JSDoc inside variable statements.
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
	let cachedDetails: SyntaxDetails | undefined
	const details = () => (cachedDetails ??= syntaxDetails(result.program))
	const decorated = mayHaveDecorators(text, comments)

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
			let statementStart = statement.start
			if (!text.startsWith("export", statementStart)) {
				// oxc-parser files `import { a } from "./a"; export { a }` under the *import* statement
				// (an indirect export of `./a`); the JSDoc that matters is on the `export { … }`.
				statementStart = details().exportLists.find(
					([start, end]) => start <= entry.start && entry.start < end,
				)![0]
			}
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
				// JSDoc of a decorated class goes before its first decorator.
				statementStart: decorated
					? (details().decoratorStarts.get(statementStart) ?? statementStart)
					: statementStart,
				own,
			})
		}
	}
	if (exportEqualsHint.test(text)) {
		for (const start of details().exportEquals) {
			add(EXPORT_EQUALS, { checked: true, statementStart: start, own: { kind: "statement" } })
		}
	}

	return createModuleExports(fileName, text, comments, names, stars, details)
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
		let text: string
		try {
			text = readFileSync(fileName, "utf8")
		} catch {
			return undefined
		}
		const exports = parseModuleExports(fileName, text, assumeAllPublic)
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
