import { realpathSync } from "node:fs"

import type { Context, CreateOnceRule, ESTree } from "@oxlint/plugins"

import { ImportabilityChecker, ImportabilityPolicy } from "../core/checkImportability.ts"
import { type JSDocRuleOptions, normalizeOptions } from "../utils/options.ts"

/**
 * Process-wide caches shared by every file and every options object.
 */
export const checker: ImportabilityChecker = new ImportabilityChecker()

/** Policies by options and working directory (options may be a new object for every file). */
const policies = new Map<string, ImportabilityPolicy>()

function policyFor(
	options: Partial<JSDocRuleOptions> | undefined,
	cwd: string,
): ImportabilityPolicy {
	const key = `${cwd}\0${JSON.stringify(options ?? {})}`
	let policy = policies.get(key)
	if (policy === undefined) {
		policy = new ImportabilityPolicy(normalizeOptions(options, cwd))
		policies.set(key, policy)
	}
	return policy
}

function realFileName(fileName: string): string {
	try {
		return realpathSync.native(fileName)
	} catch {
		return fileName
	}
}

function nameOf(
	node: ESTree.IdentifierName | ESTree.IdentifierReference | ESTree.StringLiteral,
): string {
	return node.type === "Literal" ? node.value : node.name
}

type MessageId = "package" | "package:reexport" | "private" | "private:reexport"

const rule: CreateOnceRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Prohibit importing package-private and private exports.",
			url: "https://github.com/crutchcrew/oxlint-plugin-import-access/blob/main/docs/rule-jsdoc.md",
		},
		messages: {
			package: "Cannot import a package-private export '{{ identifier }}'",
			"package:reexport": "Cannot re-export a package-private export '{{ identifier }}'",
			private: "Cannot import a private export '{{ identifier }}'",
			"private:reexport": "Cannot re-export a private export '{{ identifier }}'",
		} satisfies Record<MessageId, string>,
		schema: [
			{
				type: "object",
				properties: {
					indexLoophole: { type: "boolean" },
					filenameLoophole: { type: "boolean" },
					defaultImportability: { type: "string", enum: ["public", "package", "private"] },
					treatSelfReferenceAs: { type: "string", enum: ["external", "internal"] },
					excludeSourcePatterns: { type: "array", items: { type: "string" } },
					packageDirectory: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
	},
	createOnce(context: Context) {
		let policy: ImportabilityPolicy
		let importer: string

		const check = (node: ESTree.Node, specifier: string, name: string, reexport: boolean) => {
			const violation = policy.check(checker, importer, specifier, name)
			if (violation !== undefined) {
				context.report({
					node,
					messageId: reexport ? `${violation.access}:reexport` : violation.access,
					data: { identifier: violation.identifier },
				})
			}
		}

		return {
			before() {
				// Without `from`, the file has no import or re-export to check.
				if (!context.sourceCode.text.includes("from")) {
					return false
				}
				policy = policyFor(context.options[0] as Partial<JSDocRuleOptions> | undefined, context.cwd)
				importer = realFileName(context.filename)
				checker.nextFile(importer)
				return true
			},
			ImportSpecifier(node) {
				check(
					node,
					(node.parent as ESTree.ImportDeclaration).source.value,
					nameOf(node.imported),
					false,
				)
			},
			ImportDefaultSpecifier(node) {
				check(node, (node.parent as ESTree.ImportDeclaration).source.value, "default", false)
			},
			ExportSpecifier(node) {
				const { source } = node.parent as ESTree.ExportNamedDeclaration
				if (source !== null) {
					check(node, source.value, nameOf(node.local), true)
				}
			},
		}
	},
}

export default rule
