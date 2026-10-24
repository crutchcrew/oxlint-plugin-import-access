import { defineConfig } from "oxlint"

// The rule fixtures break lint rules on purpose, so the main config ignores them; this config only
// type-checks them against their own tsconfig.
export default defineConfig({
	categories: { correctness: "off" },
	options: { typeAware: true, typeCheck: true },
})
