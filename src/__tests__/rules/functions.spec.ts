import { testFixtures } from "../harness.ts"

testFixtures("functions", [
	{
		name: "function declaration > Can import from same directory",
		file: "src/function/fooUser.ts",
	},
	{
		name: "function declaration > Cannot import from sub directory",
		file: "src/function/barUser.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "barAccessPackage" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 26,
			},
			{
				messageId: "package",
				data: { identifier: "barPackage" },
				line: 1,
				column: 28,
				endLine: 1,
				endColumn: 38,
			},
			{
				messageId: "package",
				data: { identifier: "barPackage" },
				line: 1,
				column: 40,
				endLine: 1,
				endColumn: 61,
			},
		],
	},
	{
		name: "function declaration > Cannot default-import package-private function",
		file: "src/function/bazUser.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "default" },
				line: 1,
				column: 8,
				endLine: 1,
				endColumn: 18,
			},
		],
	},
])
