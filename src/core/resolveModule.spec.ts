import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ModuleResolver } from "./resolveModule.ts"

const projectRoot = path.resolve(import.meta.dirname, "../__tests__/fixtures/project")
const importer = path.join(projectRoot, "src/library/workspaceModules.ts")

describe("ModuleResolver with the fixture project", () => {
	const resolver = new ModuleResolver()

	it.each([
		["node:path", "external"],
		["path", "external"],
		// Symlinked into node_modules: external, like TypeScript's external library imports.
		// This also guards against vacuous passes: an unresolved import would be skipped too.
		["@fixture-package-workspace/has-sub-module", "external"],
		["@fixture-package-workspace/has-sub-module/sub", "external"],
		["@fixture-package-workspace/missing-entrypoint", "external"],
		["@fixture-package-third-party/with-exports-field", "external"],
		["generated-package", "unresolved"],
		["../reexport/sub", "internal"],
		["../reexport/sub/foo.js", "internal"],
		["@uhyo/project/self-reference", "internal"],
	])("classifies %s as %s", (specifier, kind) => {
		expect(resolver.resolve(importer, specifier).kind).toBe(kind)
	})

	it("returns real paths for internal files and memoizes per directory", () => {
		const first = resolver.resolve(importer, "../reexport/sub")
		expect(first).toEqual({
			kind: "internal",
			fileName: path.join(projectRoot, "src/reexport/sub/index.ts"),
		})
		expect(
			resolver.resolve(path.join(projectRoot, "src/library/other.ts"), "../reexport/sub"),
		).toBe(first)
		// Relative specifiers from other directories share the resolution of the same target.
		expect(resolver.resolve(path.join(projectRoot, "src/reexport/other.ts"), "./sub")).toBe(first)
		resolver.clear()
		expect(resolver.resolve(importer, "../reexport/sub")).not.toBe(first)
	})
})

describe("ModuleResolver with files of other kinds", () => {
	let dir: string
	beforeAll(() => {
		dir = mkdtempSync(path.join(tmpdir(), "import-access-"))
		mkdirSync(path.join(dir, "lib/foo"), { recursive: true })
		writeFileSync(path.join(dir, "lib/foo.ts"), "export const x = 1\n")
		writeFileSync(path.join(dir, "lib/foo/index.ts"), "export const x = 2\n")
		writeFileSync(path.join(dir, "data.json"), "{}\n")
		writeFileSync(path.join(dir, "logo.svg"), "<svg/>\n")
	})
	afterAll(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it("treats JSON as external and non-module files as unresolved", () => {
		const resolver = new ModuleResolver()
		const user = path.join(dir, "user.ts")
		expect(resolver.resolve(user, "./data.json").kind).toBe("external")
		// Only a wildcard ambient module (`declare module "*.svg"`) can declare these.
		expect(resolver.resolve(user, "./logo.svg").kind).toBe("unresolved")
	})

	it("keeps `./foo` (foo.ts) and `./foo/` (foo/index.ts) apart", () => {
		const resolver = new ModuleResolver()
		const user = path.join(dir, "user.ts")
		expect(resolver.resolve(user, "./lib/foo/")).toEqual({
			kind: "internal",
			fileName: path.join(dir, "lib/foo/index.ts"),
		})
		expect(resolver.resolve(user, "./lib/foo")).toEqual({
			kind: "internal",
			fileName: path.join(dir, "lib/foo.ts"),
		})
	})
})
