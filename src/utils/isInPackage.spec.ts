import { describe, expect, it } from "vitest"

import { PackageBoundaries } from "./isInPackage.ts"
import { normalizeOptions, type JSDocRuleOptions } from "./options.ts"

const root = "/project"

function boundaries(options: Partial<JSDocRuleOptions> = {}): PackageBoundaries {
	return new PackageBoundaries(normalizeOptions(options, root))
}

describe("PackageBoundaries#isInPackage", () => {
	it("allows the same directory and ancestor packages", () => {
		const b = boundaries()
		expect(b.isInPackage("/project/src/a.ts", "/project/src/b.ts")).toBe(true)
		expect(b.isInPackage("/project/src/sub/a.ts", "/project/src/b.ts")).toBe(true)
		expect(b.isInPackage("/project/src/a.ts", "/project/src/sub/b.ts")).toBe(false)
		expect(b.isInPackage("/project/src/a/x.ts", "/project/src/b/y.ts")).toBe(false)
	})

	it("treats sub/index.ts like sub.ts with indexLoophole", () => {
		expect(boundaries().isInPackage("/project/src/a.ts", "/project/src/sub/index.ts")).toBe(true)
		expect(boundaries().isInPackage("/project/src/a.ts", "/project/src/sub/index.mjs")).toBe(true)
		expect(
			boundaries({ indexLoophole: false }).isInPackage(
				"/project/src/a.ts",
				"/project/src/sub/index.ts",
			),
		).toBe(false)
		// Only one level up.
		expect(boundaries().isInPackage("/project/a.ts", "/project/src/sub/index.ts")).toBe(false)
	})

	it("lets foo.ts import from foo/ with filenameLoophole", () => {
		const b = boundaries({ filenameLoophole: true })
		expect(b.isInPackage("/project/src/foo.ts", "/project/src/foo/bar.ts")).toBe(true)
		expect(b.isInPackage("/project/src/baz.ts", "/project/src/foo/bar.ts")).toBe(false)
		expect(boundaries().isInPackage("/project/src/foo.ts", "/project/src/foo/bar.ts")).toBe(false)
	})

	it("uses packageDirectory patterns, with negations, for package boundaries", () => {
		const b = boundaries({ packageDirectory: ["**", "!**/_internal"] })
		expect(b.isInPackage("/project/src/feature/a.ts", "/project/src/feature/_internal/b.ts")).toBe(
			true,
		)
		expect(b.isInPackage("/project/src/a.ts", "/project/src/feature/_internal/b.ts")).toBe(false)
	})

	it("matches packageDirectory patterns against paths relative to the project", () => {
		const b = boundaries({ packageDirectory: ["src/packages/*"] })
		expect(b.isInPackage("/project/src/packages/a/x.ts", "/project/src/packages/a/deep/y.ts")).toBe(
			true,
		)
		expect(b.isInPackage("/project/src/packages/b/x.ts", "/project/src/packages/a/y.ts")).toBe(
			false,
		)
	})
})

describe("PackageBoundaries#packageDirectoryOf", () => {
	it("is the file's directory without patterns, also for an empty list", () => {
		expect(boundaries().packageDirectoryOf("/project/src/a.ts")).toBe("/project/src")
		expect(boundaries({ packageDirectory: [] }).packageDirectoryOf("/project/src/a.ts")).toBe(
			"/project/src",
		)
	})

	it("is the closest matching ancestor, memoized per directory", () => {
		const b = boundaries({ packageDirectory: ["src/packages/*"] })
		expect(b.packageDirectoryOf("/project/src/packages/a/deep/x.ts")).toBe(
			"/project/src/packages/a",
		)
		expect(b.packageDirectoryOf("/project/src/packages/a/deep/y.ts")).toBe(
			"/project/src/packages/a",
		)
	})

	it("falls back to the file's directory when no ancestor matches", () => {
		const b = boundaries({ packageDirectory: ["does-not-exist"] })
		expect(b.packageDirectoryOf("/project/src/a.ts")).toBe("/project/src")
	})
})
