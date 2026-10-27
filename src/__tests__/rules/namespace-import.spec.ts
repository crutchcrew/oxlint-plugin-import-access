import { testFixtures } from "../harness.ts"

// Upstream doesn't check namespace imports; this rule checks the members accessed through them.
testFixtures("namespace-import", [
	{
		name: "namespace-import > members can be accessed from their own package",
		file: "src/namespace-import/sub/useLib.ts",
	},
	{
		name: "namespace-import > package-private and private members",
		file: "src/namespace-import/useLib.ts",
		errors: [
			{
				messageId: "package",
				data: { identifier: "packageMethod" },
				line: 5,
				column: 5,
				endLine: 5,
				endColumn: 18,
			},
			{
				messageId: "private",
				data: { identifier: "privateMethod" },
				line: 6,
				column: 6,
				endLine: 6,
				endColumn: 19,
			},
			{
				messageId: "private",
				data: { identifier: "privateMethod" },
				line: 7,
				column: 5,
				endLine: 7,
				endColumn: 20,
			},
			{
				messageId: "private",
				data: { identifier: "default" },
				line: 9,
				column: 17,
				endLine: 9,
				endColumn: 24,
			},
			{
				messageId: "private",
				data: { identifier: "PrivateType" },
				line: 10,
				column: 18,
				endLine: 10,
				endColumn: 29,
			},
		],
	},
])
