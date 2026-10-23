import { readFileSync } from "node:fs"
import path from "node:path"

import type { Rule } from "@oxlint/plugins"
import { RuleTester } from "oxlint/plugins-dev"
import { afterAll, describe, it } from "vitest"

import plugin from "../index.ts"
import type { JSDocRuleOptions } from "../utils/options.ts"

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

/** Root of the fixture project; also the linter's working directory. */
export const projectRoot: string = path.resolve(import.meta.dirname, "fixtures/project")

export type ExpectedError = {
	readonly messageId: "package" | "package:reexport" | "private" | "private:reexport"
	readonly data: { readonly identifier: string }
	readonly line: number
	readonly column: number
	readonly endLine: number
	readonly endColumn: number
}

export type FixtureCase = {
	readonly name: string
	/** Path of the file to lint, relative to `projectRoot`. */
	readonly file: string
	readonly options?: Partial<JSDocRuleOptions>
	/** Expected diagnostics; omitted or empty means the file is valid. */
	readonly errors?: readonly ExpectedError[]
}

/**
 * Lint fixture files with the real oxlint `RuleTester` and compare the diagnostics.
 *
 * `eslintCompat` keeps ESLint's 1-based columns, so expectations match upstream's snapshots.
 */
export function testFixtures(suite: string, cases: readonly FixtureCase[]): void {
	const toTestCase = ({ name, file, options }: FixtureCase) => {
		const filename = path.join(projectRoot, file)
		return {
			name,
			filename,
			code: readFileSync(filename, "utf8"),
			// RuleTester wants mutable JSON; the options are only read.
			options: options === undefined ? [] : [options as Record<string, never>],
		}
	}
	const valid = cases.filter((c) => !c.errors?.length).map(toTestCase)
	const invalid = cases
		.filter((c) => c.errors?.length)
		.map((c) => Object.assign(toTestCase(c), { errors: c.errors as ExpectedError[] }))

	new RuleTester({ eslintCompat: true, cwd: projectRoot }).run(suite, plugin.rules.jsdoc as Rule, {
		valid,
		invalid,
	})
}

afterAll(() => {
	// Each spec file runs in its own worker, but keep caches from leaking between suites regardless.
})
