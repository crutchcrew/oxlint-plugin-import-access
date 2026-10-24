import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["src/**/*.spec.ts"],
					exclude: [
						"**/node_modules/**",
						"**/dist/**",
						"src/__tests__/fixtures/**",
						"src/__tests__/e2e/**",
					],
				},
			},
			{
				// End-to-end tests run the real `oxlint` binary against the built `dist/` output.
				test: {
					name: "e2e",
					environment: "node",
					include: ["src/__tests__/e2e/**/*.spec.ts"],
					testTimeout: 30_000,
				},
			},
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
