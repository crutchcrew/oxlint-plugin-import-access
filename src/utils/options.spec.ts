import { expect, it } from "vitest"

import { defaultOptions, normalizeOptions } from "./options.ts"

it("fills in defaults", () => {
	expect(normalizeOptions(undefined, "/project")).toEqual({
		...defaultOptions,
		packageDirectory: undefined,
		projectDirectory: "/project",
	})
})

it("keeps given options and ignores explicit undefined", () => {
	expect(
		normalizeOptions(
			{
				indexLoophole: false,
				filenameLoophole: true,
				defaultImportability: "package",
				treatSelfReferenceAs: "internal",
				excludeSourcePatterns: ["gen/**"],
				packageDirectory: ["**"],
			},
			"/project",
		),
	).toEqual({
		indexLoophole: false,
		filenameLoophole: true,
		defaultImportability: "package",
		treatSelfReferenceAs: "internal",
		excludeSourcePatterns: ["gen/**"],
		packageDirectory: ["**"],
		projectDirectory: "/project",
	})
	expect(normalizeOptions({ indexLoophole: undefined } as never, "/p").indexLoophole).toBe(true)
})
