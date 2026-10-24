import { testFixtures } from "../harness.ts"

testFixtures("default-export", [
	{
		name: "default export > Cannot import a package-default-export from sub directory",
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
				line: 4,
				column: 10,
				endLine: 4,
				endColumn: 25,
			},
		],
	},
	{
		name: "default export > Cannot import package when jsDoc is not declared from sub directory with defaultImportability=package",
		file: "src/default-export/foo.ts",
		options: { defaultImportability: "package" },
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
		name: "default export > Cannot import package when jsDoc is not declared from sub directory with defaultImportability=private",
		file: "src/default-export/foo.ts",
		options: { defaultImportability: "private" },
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
				messageId: "private",
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
])
