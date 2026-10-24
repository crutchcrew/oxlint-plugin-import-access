import { testFixtures } from "../harness.ts"

testFixtures("types", [
	{
		name: "types > Can import from same directory",
		file: "src/type/fooUser.ts",
	},
	{
		name: "types > Cannot import from sub directory",
		file: "src/type/barUser.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "barInterface" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 22,
			},
			{
				messageId: "package",
				data: { identifier: "barType" },
				line: 1,
				column: 24,
				endLine: 1,
				endColumn: 31,
			},
		],
	},
])
