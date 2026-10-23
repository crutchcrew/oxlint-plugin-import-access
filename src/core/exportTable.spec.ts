import { chmodSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { EXPORT_EQUALS, ExportTableCache, parseModuleExports, skipTrivia } from "./exportTable.ts"

function tableOf(text: string) {
	const module = parseModuleExports("/virtual/module.ts", text, false)
	const summary: Record<string, { checked: boolean; tags: string[] }> = {}
	for (const [name, entries] of module.names!) {
		summary[name] = {
			checked: entries[0]!.checked,
			tags: module.tagsOf(entries).map((tag) => (tag.text ? `${tag.name} ${tag.text}` : tag.name)),
		}
	}
	return { summary, stars: module.stars }
}

describe("parseModuleExports", () => {
	it("classifies declarations like upstream's findExportableDeclaration", () => {
		const { summary } = tableOf(`
export const a = 1
export let b = 1
export var c = 1
export function d() {}
export async function e() {}
export class F {}
export abstract class G {}
export type H = 1
export interface I {}
export declare const j: number
export enum K {}
export const enum L {}
export namespace M {}
export declare namespace N {}
export import O = M
`)
		expect(
			Object.fromEntries(Object.entries(summary).map(([name, { checked }]) => [name, checked])),
		).toEqual({
			a: true,
			b: true,
			c: true,
			d: true,
			e: true,
			F: true,
			G: true,
			H: true,
			I: true,
			j: true,
			K: false,
			L: false,
			M: false,
			N: false,
			O: false,
		})
	})

	it("collects own tags of every declaration, then all tags of the first statement", () => {
		const { summary } = tableOf(`
/** @private */
/** @package */
export function overloaded(a: string): void
/** @public */
export function overloaded(a: unknown) {}
`)
		expect(summary["overloaded"]!.tags).toEqual(["package", "public", "private", "package"])
	})

	it("reads specifier JSDoc, also on the same line", () => {
		const { summary } = tableOf(`
const a = 1, b = 2
/** @private */
export { /** @package */ a, b as c }
`)
		expect(summary["a"]!.tags).toEqual(["package", "private"])
		expect(summary["c"]!.tags).toEqual(["private"])
	})

	it("reads declarator JSDoc in variable statements", () => {
		const { summary } = tableOf(`
/** @private */
export const first = 1, /** @package */ second = 2
/** @public */
export const /** @package */ only = 1
export const { /** @package */ destructured } = { destructured: 1 }
`)
		// The statement's last JSDoc block belongs to the first declarator only.
		expect(summary["first"]!.tags).toEqual(["private", "private"])
		expect(summary["second"]!.tags).toEqual(["package", "private"])
		expect(summary["only"]!.tags).toEqual(["package", "public", "public"])
		expect(summary["destructured"]!.tags).toEqual([])
	})

	it("ignores plain comments inside variable statements", () => {
		const { summary } = tableOf(`/** @package */\nexport const a = /* plain */ 1`)
		expect(summary["a"]!.tags).toEqual(["package", "package"])
	})

	it("finds the export statement of re-exported imports, skipping `export` in comments", () => {
		const { summary } = tableOf(`
import { a } from "./a"
/** @package */
export /* export */ { a }
// export
`)
		expect(summary["a"]).toEqual({ checked: true, tags: ["package"] })
	})

	it("skips `export` inside longer identifiers when looking for the statement", () => {
		const { summary } = tableOf(`
import { a } from "./a"
/** @package */
export { a }; const reexport = 1
`)
		expect(summary["a"]!.tags).toEqual(["package"])
	})

	it("records namespace re-exports, star exports, defaults and `export =`", () => {
		const { summary, stars } = tableOf(`
/** @package */
export * as ns from "./ns"
export * from "./star"
export type * from "./types"
/** @private */
export default 1
/** @package */
export = value
// export = notThis
const x = { export: 1 }.export == 1
`)
		expect(stars).toEqual(["./star", "./types"])
		expect(summary["ns"]).toEqual({ checked: true, tags: ["package"] })
		expect(summary["default"]).toEqual({ checked: true, tags: ["private", "private"] })
		expect(summary[EXPORT_EQUALS]).toEqual({ checked: true, tags: ["package", "package"] })
	})

	it("recognizes `export type { … }` and comments after `export` as specifier lists", () => {
		const { summary } = tableOf(`
type T = 1
const v = 1
export type { /** @package */ T }
export // comment
{ /** @private */ v }
`)
		expect(summary["T"]!.tags).toEqual(["package"])
		expect(summary["v"]!.tags).toEqual(["private"])
	})

	it("takes the fast path for files without access tags or star exports", () => {
		const fast = parseModuleExports("/virtual/a.ts", "/** @public */ export const a = 1", true)
		expect(fast.names).toBeUndefined()
		expect(
			parseModuleExports("/virtual/a.ts", "/** @package */ export const a = 1", true).names,
		).toBeDefined()
		for (const star of [
			'export * from "./b"',
			'export*from"./b"',
			'export /**/ * from "./b"',
			'export type*from"./b"',
			'export // x\n* from "./b"',
		]) {
			expect(parseModuleExports("/virtual/a.ts", star, true).names, star).toBeDefined()
		}
		expect(
			parseModuleExports("/virtual/a.ts", "/** @package-internal */ export const a = 1", true)
				.names,
		).toBeUndefined()
		expect(parseModuleExports("/virtual/a.ts", "export const a = 1", false).names).toBeDefined()
	})
})

describe("skipTrivia", () => {
	it("skips whitespace and comments", () => {
		const text = " \t\n\r\v\f// line\n/* block */x"
		expect(skipTrivia(text, 0)).toBe(text.indexOf("x"))
	})

	it("stops at the end of unterminated comments", () => {
		expect(skipTrivia("// to the end", 0)).toBe(13)
		expect(skipTrivia("/* to the end", 0)).toBe(13)
	})
})

describe("ExportTableCache", () => {
	let dir: string
	beforeEach(() => {
		dir = mkdtempSync(path.join(tmpdir(), "import-access-"))
	})
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it("returns undefined for unreadable files", () => {
		expect(new ExportTableCache().get(path.join(dir, "missing.ts"), false)).toBeUndefined()
	})

	it("returns undefined for files that exist but can't be read", () => {
		const file = path.join(dir, "locked.ts")
		writeFileSync(file, "/** @package */ export const a = 1")
		chmodSync(file, 0o000)
		try {
			expect(new ExportTableCache().get(file, false)).toBeUndefined()
		} finally {
			chmodSync(file, 0o644)
		}
	})

	it("re-validates once per generation and re-parses changed files", () => {
		const file = path.join(dir, "a.ts")
		writeFileSync(file, "/** @package */ export const a = 1")
		const cache = new ExportTableCache()
		const first = cache.get(file, false)!
		expect(cache.get(file, false)).toBe(first)

		// Same generation: the change is not seen yet.
		writeFileSync(file, "/** @private */ export const b = 1")
		utimesSync(file, new Date(), new Date(Date.now() + 10_000))
		expect(cache.get(file, false)).toBe(first)

		cache.nextGeneration()
		const second = cache.get(file, false)!
		expect(second).not.toBe(first)
		expect([...second.names!.keys()]).toEqual(["b"])

		// Unchanged file in a new generation: same table.
		cache.nextGeneration()
		expect(cache.get(file, false)).toBe(second)

		cache.clear()
		expect(cache.get(file, false)).not.toBe(second)
	})

	it("only reuses fast-path tables for lookups that assume all exports public", () => {
		const file = path.join(dir, "a.ts")
		writeFileSync(file, "export const a = 1")
		const cache = new ExportTableCache()
		const fast = cache.get(file, true)!
		expect(fast.names).toBeUndefined()
		expect(cache.get(file, true)).toBe(fast)
		const full = cache.get(file, false)!
		expect(full.names).toBeDefined()
		expect(cache.get(file, true)).toBe(full)
	})
})
