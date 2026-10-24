import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { normalizeOptions } from "../utils/options.ts"
import { ImportabilityChecker, ImportabilityPolicy } from "./checkImportability.ts"

let dir: string
let user: string
let other: string
let exporter: string

function writeExporter(tag: string): void {
	writeFileSync(exporter, `/** ${tag} */\nexport const value = 1\n`)
	// Make sure the modification time differs even on coarse file systems.
	const time = new Date(Date.now() + Math.random() * 100_000)
	utimesSync(exporter, time, time)
}

beforeEach(() => {
	dir = mkdtempSync(path.join(tmpdir(), "import-access-"))
	mkdirSync(path.join(dir, "sub"))
	exporter = path.join(dir, "sub/exporter.ts")
	user = path.join(dir, "user.ts")
	other = path.join(dir, "other.ts")
	writeExporter("@package")
})
afterEach(() => {
	rmSync(dir, { recursive: true, force: true })
})

function policy(): ImportabilityPolicy {
	return new ImportabilityPolicy(normalizeOptions(undefined, dir))
}

describe("ImportabilityChecker", () => {
	it("reads each file once in a one-shot run, and re-validates once files are linted again", () => {
		const checker = new ImportabilityChecker(false)
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/exporter", "value")).toEqual({
			access: "package",
			identifier: "value",
		})

		writeExporter("@public")
		// Still the first pass over the files: the snapshot is kept.
		checker.nextFile(other)
		expect(policy().check(checker, other, "./sub/exporter", "value")?.access).toBe("package")

		// Linting `user.ts` again means files can change under us: re-validate.
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/exporter", "value")).toBeUndefined()
	})

	it("re-validates for every file in a language server", () => {
		const checker = new ImportabilityChecker(true)
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/exporter", "value")?.access).toBe("package")
		writeExporter("@private")
		checker.nextFile(other)
		expect(policy().check(checker, other, "./sub/exporter", "value")?.access).toBe("private")
	})

	it("picks up files created after a failed resolution in a language server", () => {
		const checker = new ImportabilityChecker(true)
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/later", "value")).toBeUndefined()
		writeFileSync(path.join(dir, "sub/later.ts"), "/** @package */\nexport const value = 1\n")
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/later", "value")?.access).toBe("package")
	})

	it("detects the language server from the command line by default", () => {
		const argv = process.argv
		process.argv = [...argv, "--lsp"]
		try {
			const checker = new ImportabilityChecker()
			checker.nextFile(user)
			expect(policy().check(checker, user, "./sub/exporter", "value")?.access).toBe("package")
			writeExporter("@private")
			checker.nextFile(other)
			expect(policy().check(checker, other, "./sub/exporter", "value")?.access).toBe("private")
		} finally {
			process.argv = argv
		}
	})
})

function write(file: string, text: string): void {
	mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
	writeFileSync(path.join(dir, file), text)
}

describe("ImportabilityChecker#findExport", () => {
	it("follows `export *` chains, through cycles, to the declaring file", () => {
		write("sub/impl.ts", "/** @package */\nexport const deep = 1\n")
		write(
			"sub/cycleA.ts",
			'export * from "./cycleB"\nexport * from "node:path"\nexport * from "./missing"\nexport * from "./impl"\n',
		)
		write("sub/cycleB.ts", 'export * from "./cycleA"\n')
		const checker = new ImportabilityChecker(false)
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/cycleA", "deep")).toEqual({
			access: "package",
			identifier: "deep",
		})
		expect(policy().check(checker, user, "./sub/cycleA", "missing")).toBeUndefined()
		// Memoized per module and name.
		expect(policy().check(checker, user, "./sub/cycleA", "deep")?.access).toBe("package")
	})

	it("never re-exports the default export through `export *`", () => {
		write("sub/defaults.ts", "/** @package */\nexport default 1\n")
		write("sub/barrel.ts", 'export * from "./defaults"\n')
		const checker = new ImportabilityChecker(false)
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/defaults", "default")?.access).toBe("package")
		expect(policy().check(checker, user, "./sub/barrel", "default")).toBeUndefined()
	})

	it("imports the `export=` symbol with a default import", () => {
		write("sub/cjs.ts", "const value = 1\n/** @package */\nexport = value\n")
		const checker = new ImportabilityChecker(false)
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/cjs", "default")).toEqual({
			access: "package",
			identifier: "export=",
		})
	})

	it("forgets everything on clear()", () => {
		const checker = new ImportabilityChecker(false)
		checker.nextFile(user)
		expect(policy().check(checker, user, "./sub/exporter", "value")?.access).toBe("package")
		writeExporter("@private")
		checker.clear()
		expect(policy().check(checker, user, "./sub/exporter", "value")?.access).toBe("private")
	})
})
