import { testFixtures } from "../harness.ts"

testFixtures("library", [
	{
		name: "library > Node.js builtin modules > No error with defaultImportability=package ",
		file: "src/library/nodeBuiltinModules.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Third party modules > No error with defaultImportability=package",
		file: "src/library/thirdPartyModules.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Third party modules > Entrypoint is missing > No error with defaultImportability=package",
		file: "src/library/thirdPartyModules/missingEntrypoint.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Third party modules > Importing sub module > No error with defaultImportability=package",
		file: "src/library/thirdPartyModules/hasSubModule.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Third party modules > With exports field > No error with defaultImportability=package",
		file: "src/library/thirdPartyModules/withExportsField.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Workspace modules (symlink) > No error with defaultImportability=package",
		file: "src/library/workspaceModules.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Workspace modules (symlink) > Entrypoint is missing > No error with defaultImportability=package",
		file: "src/library/workspaceModules/missingEntrypoint.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Workspace modules (symlink) > Importing sub module > No error with defaultImportability=package",
		file: "src/library/workspaceModules/hasSubModule.ts",
		options: { defaultImportability: "package" },
	},
	{
		name: "library > Workspace modules (symlink) > With exports field > No error with defaultImportability=package",
		file: "src/library/workspaceModules/withExportsField.ts",
		options: { defaultImportability: "package" },
	},
])
