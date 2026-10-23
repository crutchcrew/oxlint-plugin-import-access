import { testFixtures } from "../harness.ts"

testFixtures("reexport", [
	{
		name: "reexports > Can import a re-exported variable",
		file: "src/reexport/useFoo.ts",
		errors: [
			{
				messageId: "private",
				data: { identifier: "subFooPrivate" },
				line: 1,
				column: 18,
				endLine: 1,
				endColumn: 31,
			},
		],
	},
	{
		name: "reexports > Can import a re-exported value (export from)",
		file: "src/reexport/useBar.ts",
	},
	{
		name: "reexports > Can import a re-exported private variable (export from)",
		file: "src/reexport/useBaz.ts",
		errors: [
			{
				messageId: "private",
				data: { identifier: "subBaz" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 16,
			},
		],
	},
	{
		name: "reexports > Cannot re-export a package-private variable",
		file: "src/reexport4/indexLoophole/reexportFromSubFoo.ts",
		errors: [
			{
				messageId: "package:reexport",
				data: { identifier: "subFoo" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 16,
			},
		],
	},
	{
		name: "reexports > Can re-export a variable exported from index.ts",
		file: "src/reexport4/indexLoophole/reexportFromSubIndex.ts",
	},
	{
		name: "reexports > indexLoophole = false > Cannot import a package-private variable from sub/index.ts",
		file: "src/reexport/useFoo.ts",
		options: { indexLoophole: false },
		errors: [
			{
				messageId: "package",
				data: { identifier: "subFoo" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 16,
			},
			{
				messageId: "private",
				data: { identifier: "subFooPrivate" },
				line: 1,
				column: 18,
				endLine: 1,
				endColumn: 31,
			},
		],
	},
	{
		name: "reexports > indexLoophole = false > Cannot re-export a package-private variable",
		file: "src/reexport4/indexLoophole/reexportFromSubIndex.ts",
		options: { indexLoophole: false },
		errors: [
			{
				messageId: "package:reexport",
				data: { identifier: "subFoo" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 16,
			},
		],
	},
	{
		name: "reexports > filenameLoophole = true > Can import from sub directory of same name",
		file: "src/reexport2/sub.ts",
		options: { indexLoophole: false, filenameLoophole: true },
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
		name: "reexports > filenameLoophole = true > Can re-export from sub directory of same name",
		file: "src/reexport4/filenameLoophole/sub.ts",
		options: { indexLoophole: false, filenameLoophole: true },
	},
	{
		name: "reexports > filenameLoophole = true > Cannot re-export from sub directory of different name",
		file: "src/reexport4/filenameLoophole/sub2.ts",
		options: { indexLoophole: false, filenameLoophole: true },
		errors: [
			{
				messageId: "package:reexport",
				data: { identifier: "subFoo" },
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 16,
			},
		],
	},
	{
		name: "reexports > defaultImportability=package > Cannot import no JSDocs from sub directory",
		file: "src/reexport3/sub.ts",
		options: { defaultImportability: "package" },
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
		name: "reexports > No error for node_modules with defaultImportability=package",
		file: "src/reexport3/sub3/sub.ts",
		options: { defaultImportability: "package" },
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
])
