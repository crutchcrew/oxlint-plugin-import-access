// `tsc` keeps the `.ts` extensions of relative imports in declaration files;
// published declarations must point at the emitted `.js` files instead.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const dist = path.resolve(import.meta.dirname, "../dist")

for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
	if (!entry.isFile() || !entry.name.endsWith(".d.ts")) {
		continue
	}
	const file = path.join(entry.parentPath, entry.name)
	const text = readFileSync(file, "utf8")
	const fixed = text.replace(/((?:from\s+|import\()["']\.{1,2}\/[^"']*)\.ts(["'])/g, "$1.js$2")
	if (fixed !== text) {
		writeFileSync(file, fixed)
	}
}
