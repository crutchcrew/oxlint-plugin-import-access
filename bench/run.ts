// Benchmark: lint a generated project with oxlint, with and without this plugin.
//
//   bun run build && bun run bench [modules=5000]
//
// The project has nested feature directories, barrels (`index.ts` with `export *`),
// re-exports and a mix of public, `@package` and `@private` exports.
import { spawnSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const repoRoot = path.resolve(import.meta.dirname, "..")
// Outside the repository, so no .gitignore or parent config applies.
const projectRoot = path.join(tmpdir(), "oxlint-plugin-import-access-bench")
const moduleCount = Number(process.argv[2] ?? 5000)
const oxlint = path.join(repoRoot, "node_modules/.bin/oxlint")

/** Deterministic pseudo-random numbers, so every run lints the same project. */
let seed = 42
function random(max: number): number {
	// Park–Miller: the product stays below 2^53, so it is exact in floating point.
	seed = (seed * 48_271) % 2_147_483_647
	return seed % max
}

function generate(): void {
	rmSync(projectRoot, { recursive: true, force: true })
	const featureCount = Math.max(1, Math.round(moduleCount / 25))
	const modules: { dir: string; name: string }[] = []
	for (let i = 0; i < moduleCount; i++) {
		const feature = `feature${i % featureCount}`
		const dir = i % 3 === 0 ? `src/${feature}/internal` : `src/${feature}`
		modules.push({ dir, name: `module${i}` })
	}
	for (const [i, { dir, name }] of modules.entries()) {
		const imports: string[] = []
		const importedNames: string[] = []
		for (let k = 0; k < 6; k++) {
			const j = random(moduleCount)
			if (j === i) {
				continue
			}
			const target = modules[j]!
			// Every other import goes through the feature's barrel (`export *`) when possible.
			const viaBarrel = k % 2 === 1 && !target.dir.endsWith("/internal")
			let specifier = path.relative(
				path.join(projectRoot, dir),
				viaBarrel
					? path.join(projectRoot, target.dir)
					: path.join(projectRoot, target.dir, target.name),
			)
			if (!specifier.startsWith(".")) {
				specifier = `./${specifier}`
			}
			const exportName = ["value", "packageValue", "privateValue", "Type"][random(4)]
			imports.push(`import { ${exportName}${j} as imported${k} } from "${specifier}"`)
			importedNames.push(`imported${k}`)
		}
		const body = `${imports.join("\n")}

/** Public export. */
export const value${i} = ${i}

/**
 * Package-private export.
 * @package
 */
export const packageValue${i} = ${i}

/** @private */
export function privateValue${i}(): number {
	return ${i}
}

/** @access package */
export type Type${i} = { id: ${i} }

export const used${i} = [${importedNames.join(", ")}]
`
		mkdirSync(path.join(projectRoot, dir), { recursive: true })
		writeFileSync(path.join(projectRoot, dir, `${name}.ts`), body)
	}
	for (let f = 0; f < featureCount; f++) {
		writeFileSync(
			path.join(projectRoot, `src/feature${f}/index.ts`),
			modules
				.filter(({ dir }) => dir === `src/feature${f}`)
				.map(({ name }) => `export * from "./${name}"\n`)
				.join(""),
		)
	}
	writeFileSync(
		path.join(projectRoot, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: { strict: true, module: "nodenext", noEmit: true },
			include: ["src"],
		}),
	)
	writeFileSync(
		path.join(projectRoot, "package.json"),
		JSON.stringify({ name: "bench-project", private: true }),
	)
}

function time(label: string, config: object): void {
	const configPath = path.join(projectRoot, ".oxlintrc.json")
	writeFileSync(configPath, JSON.stringify(config))
	const runs: number[] = []
	let diagnostics = 0
	for (let run = 0; run < 3; run++) {
		const start = performance.now()
		const result = spawnSync(oxlint, ["-c", configPath, "--format", "json", "src"], {
			cwd: projectRoot,
			encoding: "utf8",
			maxBuffer: 1 << 30,
		})
		runs.push(performance.now() - start)
		diagnostics = (JSON.parse(result.stdout) as { diagnostics: unknown[] }).diagnostics.length
	}
	const best = Math.min(...runs)
	console.log(
		`${label.padEnd(40)} ${(best / 1000).toFixed(2)} s  (${diagnostics} diagnostics, best of 3)`,
	)
}

generate()
console.log(`${moduleCount} modules, ${moduleCount * 6} imports\n`)
time("oxlint (no rules)", { categories: { correctness: "off" } })
for (const defaultImportability of ["public", "package"]) {
	time(`oxlint + import-access (${defaultImportability})`, {
		categories: { correctness: "off" },
		jsPlugins: [path.join(repoRoot, "dist/index.js")],
		rules: { "import-access/jsdoc": ["error", { defaultImportability }] },
	})
}
