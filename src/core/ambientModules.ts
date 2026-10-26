import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { parseSync } from "oxc-parser"
import type { Declaration, ModuleExportName, Statement } from "oxc-parser"

import type { ExportEntry, ModuleExports } from "./exportTable.ts"
import { createModuleExports, EXPORT_EQUALS } from "./exportTable.ts"

const declarationFilePattern = /\.d\.[cm]?ts$/
const ambientModulePattern = /\bdeclare\s+module\s+["']/

function exportNameOf(name: ModuleExportName): string {
	return name.type === "Literal" ? name.value : name.name
}

function isCheckedDeclaration(declaration: Declaration): boolean {
	switch (declaration.type) {
		case "VariableDeclaration":
		case "FunctionDeclaration":
		case "TSDeclareFunction":
		case "ClassDeclaration":
		case "TSTypeAliasDeclaration":
		case "TSInterfaceDeclaration":
			return true
		default:
			return false
	}
}

/**
 * Names bound by a declaration, including destructuring patterns.
 */
function declaredNames(declaration: Declaration): string[] {
	if (declaration.type === "VariableDeclaration") {
		const names: string[] = []
		const visit = (pattern: unknown): void => {
			const node = pattern as { type: string; [key: string]: unknown }
			switch (node.type) {
				case "Identifier":
					names.push(node["name"] as string)
					break
				case "ObjectPattern":
					for (const property of node["properties"] as unknown[]) {
						visit(property)
					}
					break
				case "Property":
					visit(node["value"])
					break
				case "ArrayPattern":
					for (const element of node["elements"] as unknown[]) {
						if (element !== null) {
							visit(element)
						}
					}
					break
				case "AssignmentPattern":
					visit(node["left"])
					break
				case "RestElement":
					visit(node["argument"])
					break
			}
		}
		for (const declarator of declaration.declarations) {
			visit(declarator.id)
		}
		return names
	}
	const id = (declaration as { id?: { type: string; name?: string } | null }).id
	return id?.type === "Identifier" && id.name !== undefined ? [id.name] : []
}

/**
 * Export table of the body of an ambient `declare module "…" { … }`.
 */
function moduleBlockExports(
	fileName: string,
	text: string,
	comments: Parameters<typeof createModuleExports>[2],
	body: readonly Statement[],
): ModuleExports {
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
	for (const statement of body) {
		switch (statement.type) {
			case "ExportNamedDeclaration": {
				const { declaration } = statement
				if (declaration) {
					const checked = isCheckedDeclaration(declaration)
					for (const name of declaredNames(declaration)) {
						add(name, { checked, statementStart: statement.start, own: { kind: "statement" } })
					}
				}
				for (const specifier of statement.specifiers) {
					add(exportNameOf(specifier.exported), {
						checked: true,
						statementStart: statement.start,
						own: { kind: "specifier", start: specifier.start },
					})
				}
				break
			}
			case "ExportDefaultDeclaration":
				add("default", {
					checked: true,
					statementStart: statement.start,
					own: { kind: "statement" },
				})
				break
			case "TSExportAssignment":
				add(EXPORT_EQUALS, {
					checked: true,
					statementStart: statement.start,
					own: { kind: "statement" },
				})
				break
			case "ExportAllDeclaration":
				if (statement.exported) {
					add(exportNameOf(statement.exported), {
						checked: true,
						statementStart: statement.start,
						own: { kind: "none" },
					})
				} else {
					stars.push(statement.source.value)
				}
				break
		}
	}
	return createModuleExports(fileName, text, comments, names, stars)
}

/**
 * Collect `declare module "name" { … }` blocks of a declaration file that is a script
 * (in a module file the same syntax is a module augmentation, not an ambient module).
 */
export function parseAmbientModules(fileName: string, text: string): Map<string, ModuleExports> {
	const modules = new Map<string, ModuleExports>()
	const result = parseSync(fileName, text)
	if (result.module.hasModuleSyntax) {
		return modules
	}
	for (const statement of result.program.body) {
		if (
			statement.type === "TSModuleDeclaration" &&
			statement.id.type === "Literal" &&
			statement.body?.type === "TSModuleBlock"
		) {
			const name = statement.id.value
			if (!modules.has(name)) {
				modules.set(name, moduleBlockExports(fileName, text, result.comments, statement.body.body))
			}
		}
	}
	return modules
}

function* declarationFiles(dir: string): Generator<string> {
	let entries
	try {
		entries = readdirSync(dir, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") {
			continue
		}
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			yield* declarationFiles(fullPath)
		} else if (declarationFilePattern.test(entry.name)) {
			yield fullPath
		}
	}
}

type Pattern = {
	readonly prefix: string
	readonly suffix: string
	readonly exports: ModuleExports
}

type Index = {
	readonly exact: Map<string, ModuleExports>
	readonly patterns: Pattern[]
}

/**
 * Index of ambient modules declared in the project's declaration files, built lazily on first use.
 */
export class AmbientModuleIndex {
	readonly #roots = new Map<string, Index>()

	#indexOf(rootDir: string): Index {
		let index = this.#roots.get(rootDir)
		if (index === undefined) {
			index = { exact: new Map(), patterns: [] }
			for (const fileName of declarationFiles(rootDir)) {
				let text: string
				try {
					text = readFileSync(fileName, "utf8")
				} catch {
					// Dangling symlinks, unreadable files: TypeScript wouldn't see them either.
					continue
				}
				if (!ambientModulePattern.test(text)) {
					continue
				}
				for (const [name, exports] of parseAmbientModules(fileName, text)) {
					const star = name.indexOf("*")
					if (star === -1) {
						if (!index.exact.has(name)) {
							index.exact.set(name, exports)
						}
					} else {
						index.patterns.push({
							prefix: name.slice(0, star),
							suffix: name.slice(star + 1),
							exports,
						})
					}
				}
			}
			this.#roots.set(rootDir, index)
		}
		return index
	}

	/**
	 * The ambient module named exactly `specifier`. TypeScript prefers these over resolved files.
	 */
	exact(rootDir: string, specifier: string): ModuleExports | undefined {
		return this.#indexOf(rootDir).exact.get(specifier)
	}

	/**
	 * The wildcard ambient module (`declare module "*.svg"`) matching `specifier`;
	 * like TypeScript, the pattern with the longest prefix wins.
	 */
	pattern(rootDir: string, specifier: string): ModuleExports | undefined {
		let best: Pattern | undefined
		for (const pattern of this.#indexOf(rootDir).patterns) {
			if (
				specifier.length >= pattern.prefix.length + pattern.suffix.length &&
				specifier.startsWith(pattern.prefix) &&
				specifier.endsWith(pattern.suffix) &&
				(best === undefined || pattern.prefix.length > best.prefix.length)
			) {
				best = pattern
			}
		}
		return best?.exports
	}

	clear(): void {
		this.#roots.clear()
	}
}
