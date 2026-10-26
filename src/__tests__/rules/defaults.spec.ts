import { testFixtures } from "../harness.ts"

// This rule's own defaults: unlike upstream's, exports without an access tag are package-private.
testFixtures(
	"defaults",
	[
		{
			name: "defaults > untagged exports can be imported from their own package",
			file: "src/reexport/useBar.ts",
		},
		{
			name: "defaults > untagged exports are package-private",
			file: "src/reexport3/sub.ts",
			errors: [
				{
					messageId: "package",
					data: { identifier: "subBar" },
					line: 2,
					column: 10,
					endLine: 2,
					endColumn: 16,
				},
			],
		},
		{
			name: "defaults > untagged default exports are package-private",
			file: "src/default-export/foo.ts",
			errors: [
				{
					messageId: "package",
					data: { identifier: "default" },
					line: 1,
					column: 8,
					endLine: 1,
					endColumn: 12,
				},
				{
					messageId: "package",
					data: { identifier: "default" },
					line: 2,
					column: 8,
					endLine: 2,
					endColumn: 11,
				},
				{
					messageId: "package",
					data: { identifier: "default" },
					line: 4,
					column: 10,
					endLine: 4,
					endColumn: 25,
				},
			],
		},
		{
			name: "defaults > packages in node_modules are not checked",
			file: "src/reexport3/sub3/sub.ts",
			errors: [
				{
					messageId: "package",
					data: { identifier: "subBar" },
					line: 2,
					column: 10,
					endLine: 2,
					endColumn: 16,
				},
			],
		},
	],
	{},
)
