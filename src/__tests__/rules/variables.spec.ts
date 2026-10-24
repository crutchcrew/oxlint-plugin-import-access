import { testFixtures } from "../harness.ts"

testFixtures("variables", [
	{
		name: "variables > Can import from same directory",
		file: "src/variable/fooUser.ts",
	},
	{
		name: "variables > Cannot import from sub directory",
		file: "src/variable/barUser.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "barDestructed" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 23,
			},
			{
				messageId: "package",
				data: { identifier: "barValue" },
				line: 1,
				column: 25,
				endLine: 1,
				endColumn: 33,
			},
			{
				messageId: "package",
				data: { identifier: "barValue2" },
				line: 1,
				column: 35,
				endLine: 1,
				endColumn: 44,
			},
		],
	},
])
