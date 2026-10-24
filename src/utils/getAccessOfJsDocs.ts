import type { Tag } from "./jsdoc.ts"
import type { Importability } from "./options.ts"

/**
 * Access level declared by JSDoc tags: the first of `@package`, `@private`, `@public`
 * or `@access <level>` wins, otherwise `defaultImportability`.
 */
export function getAccessOfJsDocs(
	tags: readonly Tag[],
	defaultImportability: Importability,
): Importability {
	for (const { name, text } of tags) {
		if (name === "package" || name === "private" || name === "public") {
			return name
		}
		if (name === "access" && (text === "package" || text === "private" || text === "public")) {
			return text
		}
	}
	return defaultImportability
}
