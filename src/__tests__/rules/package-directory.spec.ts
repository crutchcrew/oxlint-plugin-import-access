import { testFixtures } from "../harness.ts"

testFixtures("package-directory", [
	{
		name: "packageDirectory option > without packageDirectory option (default behavior) > Cannot import from _internal subdirectory",
		file: "src/package-directory/user.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "internalHelper" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 24,
			},
		],
	},
	{
		name: "packageDirectory option > without packageDirectory option (default behavior) > Cannot import from sub/_internal subdirectory",
		file: "src/package-directory/sub/subUser.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "subInternalHelper" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 27,
			},
		],
	},
	{
		name: "packageDirectory option > with packageDirectory: ['**', '!**/_internal'] > Can import from _internal subdirectory (treated as same package)",
		file: "src/package-directory/user.ts",
		options: { packageDirectory: ["**", "!**/_internal"] },
	},
	{
		name: "packageDirectory option > with packageDirectory: ['**', '!**/_internal'] > Can import from sub/_internal subdirectory (treated as same package)",
		file: "src/package-directory/sub/subUser.ts",
		options: { packageDirectory: ["**", "!**/_internal"] },
	},
	{
		name: "packageDirectory option > with packageDirectory: ['**', '!**/_internal'] > Can import from ancestor package (child can import from parent)",
		file: "src/package-directory/sub/descendantUser.ts",
		options: { packageDirectory: ["**", "!**/_internal"] },
	},
	{
		name: "packageDirectory option > with packageDirectory: ['**', '!**/_internal'] > Cannot import from different package even with _internal exclusion",
		file: "src/package-directory/crossPackageUser.ts",
		options: { packageDirectory: ["**", "!**/_internal"] },
		errors: [
			{
				messageId: "package",
				data: { identifier: "subInternalHelper" },
				line: 3,
				column: 10,
				endLine: 3,
				endColumn: 27,
			},
		],
	},
	{
		name: "packageDirectory option > with packageDirectory: ['**'] > Cannot import from _internal subdirectory (all dirs are packages)",
		file: "src/package-directory/user.ts",
		options: { packageDirectory: ["**"] },
		errors: [
			{
				messageId: "package",
				data: { identifier: "internalHelper" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 24,
			},
		],
	},
	{
		name: "packageDirectory option > filenameLoophole with packageDirectory > Can import from directory matching filename (filenameLoophole works with packageDirectory)",
		file: "src/package-directory/filenameLoophole/sub.ts",
		options: { packageDirectory: ["**", "!**/_internal"], filenameLoophole: true },
	},
	{
		name: "packageDirectory option > with packageDirectory: ['src/package-directory/packages/*'] (specific directory pattern) > Can import from deep subdirectory within same package",
		file: "src/package-directory/packages/packageA/user.ts",
		options: { packageDirectory: ["src/package-directory/packages/*"] },
	},
	{
		name: "packageDirectory option > with packageDirectory: ['src/package-directory/packages/*'] (specific directory pattern) > Cannot import from sibling package",
		file: "src/package-directory/packages/packageB/crossUser.ts",
		options: { packageDirectory: ["src/package-directory/packages/*"] },
		errors: [
			{
				messageId: "package",
				data: { identifier: "packageAHelper" },
				line: 2,
				column: 10,
				endLine: 2,
				endColumn: 24,
			},
		],
	},
])
