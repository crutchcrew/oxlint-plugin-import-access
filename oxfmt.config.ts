import { defineConfig } from "oxfmt"

export default defineConfig({
	semi: false,
	singleQuote: false,
	tabWidth: 2,
	useTabs: true,
	trailingComma: "all",
	printWidth: 100,
	arrowParens: "always",
	sortImports: true,
	sortPackageJson: {
		sortScripts: true,
	},
	// Fixture files are test inputs: their exact text (line/column) is part of the expectations.
	ignorePatterns: ["src/__tests__/fixtures/**", "CHANGELOG.md"],
})
