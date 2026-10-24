import { defineConfig } from "vitest/config"

// End-to-end tests run the real `oxlint` binary against the built `dist/` output.
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/__tests__/e2e/**/*.spec.ts"],
		testTimeout: 30_000,
	},
})
