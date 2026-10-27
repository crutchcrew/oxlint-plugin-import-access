import path from "node:path"

import type { Rule } from "@oxlint/plugins"
import { RuleTester } from "oxlint/plugins-dev"
import { describe, expect, it } from "vitest"

import plugin from "../../index.ts"
import { projectRoot } from "../harness.ts"

const rule = plugin.rules.jsdoc as Rule
const tester = new RuleTester({ eslintCompat: true, cwd: projectRoot })
const inReexport = (name: string) => path.join(projectRoot, "src/reexport", name)

tester.run("jsdoc (inline code)", rule, {
	valid: [
		{
			name: "local export lists have no source to check",
			filename: inReexport("localExport.ts"),
			code: 'const subFoo = 1\nexport { subFoo }\nconst text = "imported from nowhere"',
		},
		{
			name: "files without `from` are skipped",
			filename: inReexport("noImports.ts"),
			code: "export const value = 1",
		},
		{
			name: "namespace imports used as a whole are not checked",
			filename: inReexport("namespace.ts"),
			code: 'import * as sub from "./sub/foo"\nconsole.log(sub)',
		},
	],
	invalid: [
		{
			name: "importer that does not exist on disk",
			filename: inReexport("virtual/notOnDisk.ts"),
			code: 'import { subFoo } from "../sub/foo"',
			errors: [{ messageId: "package", data: { identifier: "subFoo" } }],
		},
		{
			name: "string literal import names",
			filename: inReexport("stringName.ts"),
			code: 'import { "subFoo" as renamed } from "./sub/foo"\nexport { "subFoo" as again } from "./sub/foo"',
			errors: [
				{ messageId: "package", data: { identifier: "subFoo" } },
				{ messageId: "package:reexport", data: { identifier: "subFoo" } },
			],
		},
		{
			name: "private re-exports",
			filename: inReexport("privateReexport.ts"),
			code: 'export { subFooPrivate } from "./sub"',
			errors: [{ messageId: "private:reexport", data: { identifier: "subFooPrivate" } }],
		},
		{
			name: "explicit options",
			filename: inReexport("options.ts"),
			code: 'import { subFoo } from "./sub"',
			options: [{ indexLoophole: false }],
			errors: [{ messageId: "package", data: { identifier: "subFoo" } }],
		},
	],
})

describe("plugin", () => {
	it("is named import-access and exposes the jsdoc rule", () => {
		expect(plugin.meta.name).toBe("import-access")
		expect(Object.keys(plugin.rules)).toEqual(["jsdoc"])
		expect(rule.meta?.docs?.url).toMatch(/docs\/rule-jsdoc\.md$/)
	})
})
