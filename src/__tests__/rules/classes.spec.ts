import { testFixtures } from "../harness.ts"

testFixtures("classes", [
	{
		name: "class declaration > Can import from same directory",
		file: "src/class/fooUser.ts",
	},
	{
		name: "class declaration > Cannot import from sub directory",
		file: "src/class/barUser.ts",
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
		name: "class declaration > Cannot default-import package-private function",
		file: "src/class/bazUser.ts",
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
