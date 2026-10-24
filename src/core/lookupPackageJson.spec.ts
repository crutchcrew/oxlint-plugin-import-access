import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, expect, it } from "vitest"

import { clearPackageNameCache, lookupPackageName } from "./lookupPackageJson.ts"

let dir: string
beforeEach(() => {
	dir = mkdtempSync(path.join(tmpdir(), "import-access-"))
	clearPackageNameCache()
})
afterEach(() => {
	rmSync(dir, { recursive: true, force: true })
})

it("finds the closest package.json name and caches it per directory", () => {
	writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "root" }))
	mkdirSync(path.join(dir, "a/b"), { recursive: true })
	expect(lookupPackageName(path.join(dir, "a/b/file.ts"))).toBe("root")
	writeFileSync(path.join(dir, "a/package.json"), JSON.stringify({ name: "a" }))
	// Cached from the first lookup.
	expect(lookupPackageName(path.join(dir, "a/b/other.ts"))).toBe("root")
	clearPackageNameCache()
	expect(lookupPackageName(path.join(dir, "a/b/other.ts"))).toBe("a")
})

it("skips malformed package.json files like upstream", () => {
	writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "root" }))
	mkdirSync(path.join(dir, "broken"))
	writeFileSync(path.join(dir, "broken/package.json"), "{ not json")
	expect(lookupPackageName(path.join(dir, "broken/file.ts"))).toBe("root")
})

it("returns null for a package.json without a name", () => {
	writeFileSync(path.join(dir, "package.json"), JSON.stringify({ private: true }))
	expect(lookupPackageName(path.join(dir, "file.ts"))).toBeNull()
	writeFileSync(path.join(dir, "package.json"), "null")
	clearPackageNameCache()
	expect(lookupPackageName(path.join(dir, "file.ts"))).toBeNull()
})

it("rethrows unexpected read errors", () => {
	const file = path.join(dir, "package.json")
	writeFileSync(file, "{}")
	chmodSync(file, 0o000)
	try {
		expect(() => lookupPackageName(path.join(dir, "file.ts"))).toThrow(/EACCES/)
	} finally {
		chmodSync(file, 0o644)
	}
})

it("returns null when no package.json exists up to the root", () => {
	expect(lookupPackageName("/file.ts")).toBeNull()
})
