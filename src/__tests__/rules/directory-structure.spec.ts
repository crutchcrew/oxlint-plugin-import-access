import { testFixtures } from "../harness.ts"

testFixtures("directory-structure", [
	{
		name: "directory structure > Canot import from subsub directory",
		file: "src/directory-structure/subsubUser.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "subsubVar" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 19,
			},
		],
	},
	{
		name: "directory structure > Can import from sub/index.ts",
		file: "src/directory-structure/subIndexUser.ts",
	},
	{
		name: "directory structure > Can import from ../pkg",
		file: "src/directory-structure/sub/sub2/parentUser.ts",
	},
	{
		name: "directory structure > Cannot import from sibling sub-package",
		file: "src/directory-structure/sub/sub3/siblingUser.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "subsubVar" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 19,
			},
		],
	},
])
