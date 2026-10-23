import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.spec.ts"],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"src/__tests__/fixtures/**",
			"src/__tests__/e2e/**",
		],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.spec.ts", "src/__tests__/**"],
			reporter: ["text", "lcov", "json-summary"],
			thresholds: {
				lines: 100,
				branches: 100,
				functions: 100,
				statements: 100,
			},
		},
	},
})
