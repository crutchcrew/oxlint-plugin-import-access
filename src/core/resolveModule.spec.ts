import path from "node:path"

import { describe, expect, it } from "vitest"

import { projectRoot } from "../__tests__/harness.ts"
import { ImportabilityChecker } from "./checkImportability.ts"
import { ModuleResolver } from "./resolveModule.ts"

const importer = path.join(projectRoot, "src/library/workspaceModules.ts")

describe("ModuleResolver", () => {
	const resolver = new ModuleResolver()

	it.each([
		["node:path", "external"],
		["path", "external"],
		["@fixture-package-workspace/has-sub-module", "external"],
		["@fixture-package-workspace/has-sub-module/sub", "external"],
		["@fixture-package-third-party/with-exports-field", "external"],
		["../edge/sub/data.json", "external"],
		["../edge/assets/logo.svg", "unresolved"],
		["generated-package", "unresolved"],
		["../reexport/sub", "internal"],
		["../reexport/sub/foo.js", "internal"],
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
		resolver.clear()
		expect(resolver.resolve(importer, "../reexport/sub")).not.toBe(first)
	})

	it("checks that the workspace fixtures are really symlinked into node_modules", () => {
		// Guards against vacuous passes: an unresolved workspace import would also be skipped.
		const checker = new ImportabilityChecker()
		expect(
			checker.resolver.resolve(importer, "@fixture-package-workspace/missing-entrypoint"),
		).toEqual({
			kind: "external",
		})
		checker.clear()
	})
})
