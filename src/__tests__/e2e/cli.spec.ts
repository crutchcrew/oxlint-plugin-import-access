import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

const repoRoot = path.resolve(import.meta.dirname, "../../..")
const projectRoot = path.join(repoRoot, "src/__tests__/fixtures/project")
// `OXLINT_BIN` runs the suite against another oxlint, e.g. the oldest supported version.
const oxlint = process.env["OXLINT_BIN"] ?? path.join(repoRoot, "node_modules/.bin/oxlint")
const dist = path.join(repoRoot, "dist/index.js")

type JsonDiagnostic = {
	message: string
	code: string
	filename: string
	labels: { span: { line: number; column: number } }[]
}

let tmp: string
beforeAll(() => {
	if (!existsSync(dist)) {
		throw new Error("Run `bun run build` before the e2e tests.")
	}
	tmp = mkdtempSync(path.join(tmpdir(), "import-access-e2e-"))
})
afterAll(() => {
	rmSync(tmp, { recursive: true, force: true })
})

function lint(options: object, files: string[] = ["src"]): string[] {
	const config = path.join(tmp, `oxlintrc-${Math.random().toString(36).slice(2)}.json`)
	writeFileSync(
		config,
		JSON.stringify({
			jsPlugins: [dist],
			categories: { correctness: "off" },
			rules: { "import-access/jsdoc": ["error", options] },
		}),
	)
	const result = spawnSync(oxlint, ["-c", config, "--format", "json", ...files], {
		cwd: projectRoot,
		encoding: "utf8",
	})
	// Older oxlint versions print a warning that JS plugins are experimental; anything else is an error.
	expect(
		result.stderr.replace(
			/^WARNING: JS plugins are experimental[^\n]*\n(?:Breaking changes[^\n]*\n)?/,
			"",
		),
	).toBe("")
	const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: JsonDiagnostic[] }
	return diagnostics
		.map(({ filename, labels, message, code }) => {
			expect(code).toBe("import-access(jsdoc)")
			return `${filename}:${labels[0]!.span.line}:${labels[0]!.span.column} ${message}`
		})
		.toSorted()
}

describe("oxlint CLI with the built plugin", () => {
	it("reports violations across the fixture project", () => {
		expect(lint({}, ["src/reexport", "src/directory-structure", "src/default-export"]))
			.toMatchInlineSnapshot(`
			[
			  "src/default-export/foo.ts:1:8 Cannot import a package-private export 'default'",
			  "src/default-export/foo.ts:4:10 Cannot import a package-private export 'default'",
			  "src/directory-structure/sub/sub3/siblingUser.ts:1:10 Cannot import a package-private export 'subsubVar'",
			  "src/directory-structure/subsubUser.ts:1:10 Cannot import a package-private export 'subsubVar'",
			  "src/reexport/useBaz.ts:1:10 Cannot import a private export 'subBaz'",
			  "src/reexport/useFoo.ts:1:18 Cannot import a private export 'subFooPrivate'",
			]
		`)
	})

	it("passes options through", () => {
		expect(lint({ defaultImportability: "private" }, ["src/self-reference"])).toEqual([])
		expect(
			lint({ defaultImportability: "private", treatSelfReferenceAs: "internal" }, [
				"src/self-reference",
			]),
		).toEqual(["src/self-reference/user.ts:1:10 Cannot import a private export 'exportedValue'"])
	})

	it("lints the whole fixture project", () => {
		expect(lint({ defaultImportability: "package" }).length).toBeGreaterThan(50)
	})
})

describe("published package", () => {
	it("contains the bundle, types and docs only", () => {
		const [pack] = JSON.parse(
			execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
				cwd: repoRoot,
				encoding: "utf8",
			}),
		) as [{ files: { path: string }[] }]
		const files = pack.files.map((file) => file.path).toSorted()
		expect(files).toContain("dist/index.js")
		expect(files).toContain("dist/index.d.ts")
		expect(files).toContain("dist/utils/options.d.ts")
		expect(files).toContain("README.md")
		expect(files).toContain("LICENSE")
		expect(
			files.filter((file) => /spec|__tests__|fixtures|\.ts$/.test(file) && !file.endsWith(".d.ts")),
		).toEqual([])
	})

	it("loads as an ES module with the plugin as default export", async () => {
		const { default: plugin } = (await import(dist)) as {
			default: { meta: { name: string }; rules: object }
		}
		expect(plugin.meta.name).toBe("import-access")
		expect(Object.keys(plugin.rules)).toEqual(["jsdoc"])
	})
})
