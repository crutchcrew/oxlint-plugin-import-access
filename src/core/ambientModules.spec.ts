import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { AmbientModuleIndex, parseAmbientModules } from "./ambientModules.ts"

function summarize(text: string) {
	const result: Record<string, Record<string, { checked: boolean; tags: string[] }>> = {}
	for (const [moduleName, module] of parseAmbientModules("/virtual/types.d.ts", text)) {
		const names: Record<string, { checked: boolean; tags: string[] }> = {}
		for (const [name, entries] of module.names!) {
			names[name] = {
				checked: entries[0]!.checked,
				tags: module.tagsOf(entries).map((tag) => tag.name),
			}
		}
		result[moduleName] = names
		expect(module.stars).toEqual(moduleName === "stars" ? ["./a", "b"] : [])
	}
	return result
}

describe("parseAmbientModules", () => {
	it("reads the exports of `declare module` blocks", () => {
		expect(
			summarize(`
declare module "kinds" {
  /** @package */
  export const a: number, b: string
  export let c: number
  export var { d, e: [f, , g = 1, ...h], ...i }: any
  export function j(): void
  export function j(a: number): void
  export namespace Qualified.Name {}
  export class K {}
  export type L = 1
  export interface M {}
  export enum N {}
  export namespace O {}
  const notExported: number
  /** @private */
  export { notExported as "quoted", notExported as P }
  /** @package */
  export default notExported
  export * as ns from "./ns"
}
declare module "stars" {
  export * from "./a"
  export * from "b"
}
declare module "kinds" {
  export const ignoredDuplicate: number
}
declare module "shorthand"
declare namespace NotAModule {}
`),
		).toEqual({
			kinds: {
				a: { checked: true, tags: ["package", "package"] },
				b: { checked: true, tags: ["package", "package"] },
				c: { checked: true, tags: [] },
				d: { checked: true, tags: [] },
				f: { checked: true, tags: [] },
				g: { checked: true, tags: [] },
				h: { checked: true, tags: [] },
				i: { checked: true, tags: [] },
				j: { checked: true, tags: [] },
				K: { checked: true, tags: [] },
				L: { checked: true, tags: [] },
				M: { checked: true, tags: [] },
				N: { checked: false, tags: [] },
				O: { checked: false, tags: [] },
				quoted: { checked: true, tags: ["private"] },
				P: { checked: true, tags: ["private"] },
				default: { checked: true, tags: ["package", "package"] },
				ns: { checked: true, tags: [] },
			},
			stars: {},
		})
	})

	it("ignores module files, where `declare module` is an augmentation", () => {
		expect(summarize(`export {}\ndeclare module "augmented" { export const a: number }`)).toEqual(
			{},
		)
	})
})

describe("AmbientModuleIndex", () => {
	let dir: string
	beforeEach(() => {
		dir = mkdtempSync(path.join(tmpdir(), "import-access-"))
		mkdirSync(path.join(dir, "types/nested"), { recursive: true })
		mkdirSync(path.join(dir, "node_modules/pkg"), { recursive: true })
		mkdirSync(path.join(dir, ".hidden"), { recursive: true })
		writeFileSync(
			path.join(dir, "types/nested/assets.d.ts"),
			`declare module "*.svg" { export default content }\ndeclare module "virtual:*" { export const v: 1 }\ndeclare module "virtual:deep/*" { export const deep: 1 }\ndeclare module "exact" { export const e: 1 }`,
		)
		writeFileSync(
			path.join(dir, "types/second.d.mts"),
			`declare module "exact" { export const second: 1 }`,
		)
		writeFileSync(path.join(dir, "types/plain.d.ts"), `declare const notAModule: number`)
		writeFileSync(path.join(dir, "types/source.ts"), `declare module "from-ts" {}`)
		writeFileSync(path.join(dir, "node_modules/pkg/index.d.ts"), `declare module "from-deps" {}`)
		writeFileSync(path.join(dir, ".hidden/index.d.ts"), `declare module "hidden" {}`)
	})
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it("finds exact and wildcard modules, preferring the longest prefix", () => {
		const index = new AmbientModuleIndex()
		expect([...index.exact(dir, "exact")!.names!.keys()]).toEqual(["e"])
		expect(index.exact(dir, "missing")).toBeUndefined()
		expect([...index.pattern(dir, "./logo.svg")!.names!.keys()]).toEqual(["default"])
		expect([...index.pattern(dir, "virtual:x")!.names!.keys()]).toEqual(["v"])
		expect([...index.pattern(dir, "virtual:deep/x")!.names!.keys()]).toEqual(["deep"])
		expect(index.pattern(dir, "virtual")).toBeUndefined()
		expect(index.pattern(dir, ".svg")).toBeDefined()
		expect(index.pattern(dir, "x.png")).toBeUndefined()
	})

	it("only scans declaration files outside node_modules and hidden directories", () => {
		const index = new AmbientModuleIndex()
		for (const name of ["from-ts", "from-deps", "hidden"]) {
			expect(index.exact(dir, name)).toBeUndefined()
		}
	})

	it("builds the index once per root until cleared", () => {
		const index = new AmbientModuleIndex()
		expect(index.exact(dir, "late")).toBeUndefined()
		writeFileSync(path.join(dir, "types/late.d.ts"), `declare module "late" {}`)
		expect(index.exact(dir, "late")).toBeUndefined()
		index.clear()
		expect(index.exact(dir, "late")).toBeDefined()
	})

	it("skips unreadable directories", () => {
		const locked = path.join(dir, "types/locked")
		mkdirSync(locked)
		chmodSync(locked, 0o000)
		try {
			expect(new AmbientModuleIndex().exact(dir, "exact")).toBeDefined()
		} finally {
			chmodSync(locked, 0o755)
		}
	})

	it("skips declaration files it can't read, such as dangling symlinks", () => {
		symlinkSync(path.join(dir, "missing.d.ts"), path.join(dir, "types/dangling.d.ts"))
		expect(new AmbientModuleIndex().exact(dir, "exact")).toBeDefined()
	})

	it("handles a missing root", () => {
		expect(new AmbientModuleIndex().exact(path.join(dir, "missing"), "exact")).toBeUndefined()
	})
})
