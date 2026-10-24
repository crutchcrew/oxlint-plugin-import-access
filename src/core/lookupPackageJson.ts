import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Cache of directory → name of the closest package.json (`null` when there is none or it has no name).
 */
const packageNameCache = new Map<string, string | null>()

function readPackageName(packageJsonPath: string): string | null | undefined {
	let text: string
	try {
		text = readFileSync(packageJsonPath, "utf8")
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return undefined
		}
		throw error
	}
	let packageJson: unknown
	try {
		packageJson = JSON.parse(text)
	} catch {
		// Like upstream: a malformed package.json is skipped and the search continues upwards.
		return undefined
	}
	const name = (packageJson as { name?: unknown } | null)?.name
	return typeof name === "string" ? name : null
}

/**
 * Name of the closest `package.json` above `file`, or `null`.
 */
export function lookupPackageName(file: string): string | null {
	const visited: string[] = []
	let result: string | null = null
	const { root } = path.parse(path.resolve(file))
	for (let dir = path.dirname(path.resolve(file)); dir !== root; dir = path.dirname(dir)) {
		const cached = packageNameCache.get(dir)
		if (cached !== undefined) {
			result = cached
			break
		}
		visited.push(dir)
		const name = readPackageName(path.join(dir, "package.json"))
		if (name !== undefined) {
			result = name
			break
		}
	}
	for (const dir of visited) {
		packageNameCache.set(dir, result)
	}
	return result
}

/**
 * Forget cached package.json lookups (for long-running processes and tests).
 */
export function clearPackageNameCache(): void {
	packageNameCache.clear()
}
