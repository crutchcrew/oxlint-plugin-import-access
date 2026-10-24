import type { Plugin } from "@oxlint/plugins"

import jsdoc from "./rules/jsdoc.ts"

/** @public */
export type { Importability, JSDocRuleOptions } from "./utils/options.ts"

/**
 * Shape of the plugin object. Declared here so the published types don't depend on
 * `@oxlint/plugins`; it is checked against oxlint's `Plugin` type below.
 * @public
 */
export type ImportAccessPlugin = {
	readonly meta: { readonly name: "import-access" }
	readonly rules: { readonly jsdoc: object }
}

/**
 * Oxlint JS plugin restricting imports of `@package` and `@private` exports.
 *
 * @example
 * ```json
 * {
 *   "jsPlugins": ["@crutchcrew/oxlint-plugin-import-access"],
 *   "rules": { "import-access/jsdoc": "error" }
 * }
 * ```
 */
const plugin: ImportAccessPlugin = {
	meta: { name: "import-access" as const },
	rules: { jsdoc },
} satisfies Plugin

/** @public */
export default plugin
