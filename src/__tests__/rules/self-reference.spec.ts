import { testFixtures } from "../harness.ts"

testFixtures("self-reference", [
	{
		name: "Self-reference via package.json exports is treated as external by default",
		file: "src/self-reference/user.ts",
		options: { defaultImportability: "private" },
	},
	{
		name: "Self-reference via package.json exports is treated as internal when treatSelfReferenceAs: internal",
		file: "src/self-reference/user.ts",
		options: { defaultImportability: "private", treatSelfReferenceAs: "internal" },
		errors: [
			{
				messageId: "private",
				data: { identifier: "exportedValue" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 23,
			},
		],
	},
	{
		name: "Self-reference via package.json exports is treated as external when treatSelfReferenceAs: external",
		file: "src/self-reference/user.ts",
		options: { defaultImportability: "private", treatSelfReferenceAs: "external" },
	},
])
