import { defineConfig } from "oxlint"

export default defineConfig({
	plugins: ["unicorn", "typescript", "oxc", "import"],
	categories: {
		correctness: "error",
		suspicious: "warn",
		perf: "warn",
	},
	rules: {
		"no-console": "off",
		"no-unused-vars": "error",
		eqeqeq: "error",
		"no-var": "error",
		"prefer-const": "warn",
		"unicorn/no-null": "off",
		"typescript/no-unsafe-type-assertion": "off",
	},
	overrides: [
		{
			// oxc-parser types its string-valued kinds as `const enum`s, which can't be referenced at
			// runtime under `verbatimModuleSyntax`; comparing with the string values is intended.
			files: ["src/core/exportTable.ts"],
			rules: { "typescript/no-unsafe-enum-comparison": "off" },
		},
	],
	ignorePatterns: ["dist", "node_modules", "coverage", "src/__tests__/fixtures"],
	options: {
		typeAware: true,
		typeCheck: true,
	},
})
