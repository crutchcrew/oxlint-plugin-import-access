import { describe, expect, it } from "vitest"

import { type Comment, findJsDocComments, jsDocTagsAt, parseJsDocTags } from "./jsdoc.ts"

function block(source: string): Comment {
	return { type: "Block", value: source.slice(2, -2), start: 0, end: source.length }
}

/** Comments of `text`, like a parser would report them (no strings/regexps in these inputs). */
function commentsOf(text: string): Comment[] {
	const comments: Comment[] = []
	const pattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
	for (const match of text.matchAll(pattern)) {
		const source = match[0]
		comments.push(
			source.startsWith("//")
				? {
						type: "Line",
						value: source.slice(2),
						start: match.index,
						end: match.index + source.length,
					}
				: {
						type: "Block",
						value: source.slice(2, -2),
						start: match.index,
						end: match.index + source.length,
					},
		)
	}
	return comments
}

function attached(text: string, includeSameLine = false): string[] {
	const start = text.indexOf("export")
	return findJsDocComments(text, commentsOf(text), start, includeSameLine).map(
		(c) => `/*${c.value}*/`,
	)
}

describe("parseJsDocTags", () => {
	// Expected values were produced by TypeScript's own JSDoc parser (`ts.getJSDocTags`).
	const typescriptResults: [string, { name: string; text: string }[]][] = [
		["/** @package */", [{ name: "package", text: "" }]],
		["/**@package*/", [{ name: "package", text: "" }]],
		["/** text @package */", [{ name: "package", text: "" }]],
		["/**\n * text @package\n */", [{ name: "package", text: "" }]],
		["/**\n * text@package\n */", []],
		["/**\n * text @ package\n */", []],
		["/**\n * see `@package` here\n */", []],
		["/**\n * `a\n * @package\n */", [{ name: "package", text: "" }]],
		["/**\n * {@link foo} @package\n */", [{ name: "package", text: "" }]],
		["/**\n * a\t@package\n */", [{ name: "package", text: "" }]],
		["/** @access package more */", [{ name: "access", text: "package more" }]],
		["/** @access\n * package */", [{ name: "access", text: "package" }]],
		["/** @access   package   */", [{ name: "access", text: "package" }]],
		["/**\r\n * @access\r\n * private\r\n */", [{ name: "access", text: "private" }]],
		["/**\r * @private\r */", [{ name: "private", text: "" }]],
		[
			"/**\n * @deprecated text @package\n */",
			[
				{ name: "deprecated", text: "text" },
				{ name: "package", text: "" },
			],
		],
		["/**\n * @deprecated text @ package\n */", [{ name: "deprecated", text: "text @ package" }]],
		["/** foo@bar.com @private */", [{ name: "private", text: "" }]],
		["/**\n *   ** @package\n */", [{ name: "package", text: "" }]],
		["/**\n @package\n */", [{ name: "package", text: "" }]],
		[
			"/** @package@private */",
			[
				{ name: "package", text: "" },
				{ name: "private", text: "" },
			],
		],
		["/** (@package) */", []],
		["/** @$x */", [{ name: "$x", text: "" }]],
	]

	it.each(typescriptResults)("parses %j like TypeScript", (source, expected) => {
		expect(parseJsDocTags(block(source))).toEqual(expected)
	})

	it("reads hyphenated tag names whole, like TypeScript", () => {
		expect(parseJsDocTags(block("/** @private-api @package */"))).toEqual([
			{ name: "private-api", text: "" },
			{ name: "package", text: "" },
		])
	})

	it("ignores a lone `@` at the end of the comment", () => {
		expect(parseJsDocTags(block("/** text @*/"))).toEqual([])
	})

	it("handles U+2028/U+2029 line separators", () => {
		expect(parseJsDocTags(block("/** a\u2028 * @package\u2029 * @private */"))).toEqual([
			{ name: "package", text: "" },
			{ name: "private", text: "" },
		])
	})
})

describe("findJsDocComments", () => {
	it("takes JSDoc blocks between the previous token and the node", () => {
		expect(attached("let a\n/** one */\n// line\n/** two */\nexport const x = 1")).toEqual([
			"/** one */",
			"/** two */",
		])
	})

	it("ignores comments after the node", () => {
		expect(attached("/** before */\nexport const x = 1 /** after */\n/** later */")).toEqual([
			"/** before */",
		])
	})

	it("takes comments at the very start of the file", () => {
		expect(attached("/** first */ export const x = 1")).toEqual(["/** first */"])
	})

	it("ignores plain block comments and the empty `/**/`", () => {
		expect(attached("let a\n/* plain */\n/**/\nexport const x = 1")).toEqual([])
	})

	it("leaves comments on the previous token's line to that token", () => {
		expect(attached("let a /** trailing */\nexport const x = 1")).toEqual([])
		expect(attached("let a; /** same line */ export const x = 1")).toEqual([])
	})

	it("takes same-line comments for specifiers and declarators", () => {
		expect(attached("let a; /** same line */ export const x = 1", true)).toEqual([
			"/** same line */",
		])
	})

	it("stops at the previous token", () => {
		expect(attached("/** earlier */ let a; export const x = 1", true)).toEqual([])
	})

	it("treats CR, LS and PS as line breaks", () => {
		expect(attached("let a\r/** cr */ export const x = 1")).toEqual(["/** cr */"])
		expect(attached("let a\u2028/** ls */ export const x = 1")).toEqual(["/** ls */"])
		expect(attached("let a\u2029/** ps */ export const x = 1")).toEqual(["/** ps */"])
	})

	it("skips all kinds of whitespace", () => {
		expect(attached("let a\n/** ws */\t\v\f\u00a0\ufeff export const x = 1")).toEqual(["/** ws */"])
	})
})

describe("jsDocTagsAt", () => {
	it("returns the last block's tags as own tags and all blocks' tags", () => {
		const text = "/** @private */\n/** @package */\nexport const x = 1"
		expect(jsDocTagsAt(text, commentsOf(text), text.indexOf("export"))).toEqual({
			own: [{ name: "package", text: "" }],
			all: [
				{ name: "private", text: "" },
				{ name: "package", text: "" },
			],
		})
	})

	it("returns no tags without JSDoc", () => {
		expect(jsDocTagsAt("export const x = 1", [], 0)).toEqual({ own: [], all: [] })
	})
})
