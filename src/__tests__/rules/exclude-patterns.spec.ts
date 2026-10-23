import { testFixtures } from "../harness.ts"

testFixtures("exclude-patterns", [
	{
		name: "Importing from generated package is disallowed by default",
		file: "src/exclude-patterns/generated-type-user.ts",
		options: { defaultImportability: "package" },
		errors: [
			{
				messageId: "package",
				data: { identifier: "someValue" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 19,
			},
		],
	},
	{
		name: "Importing from generated package is allowed with excludeSourcePatterns targeting the file path (relative path)",
		file: "src/exclude-patterns/generated-type-user.ts",
		options: {
			defaultImportability: "package",
			excludeSourcePatterns: ["src/exclude-patterns/types/**"],
		},
	},
])
