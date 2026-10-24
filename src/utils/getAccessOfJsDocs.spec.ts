import { expect, it } from "vitest"

import { getAccessOfJsDocs } from "./getAccessOfJsDocs.ts"

const tag = (name: string, text = "") => ({ name, text })

it("returns the first access tag", () => {
	expect(getAccessOfJsDocs([tag("package")], "public")).toBe("package")
	expect(getAccessOfJsDocs([tag("private"), tag("package")], "public")).toBe("private")
	expect(getAccessOfJsDocs([tag("deprecated"), tag("public")], "private")).toBe("public")
})

it("reads @access with an exact level", () => {
	expect(getAccessOfJsDocs([tag("access", "package")], "public")).toBe("package")
	expect(getAccessOfJsDocs([tag("access", "private")], "public")).toBe("private")
	expect(getAccessOfJsDocs([tag("access", "public")], "private")).toBe("public")
	expect(getAccessOfJsDocs([tag("access", "package more")], "public")).toBe("public")
})

it("falls back to the default", () => {
	expect(getAccessOfJsDocs([], "package")).toBe("package")
	expect(getAccessOfJsDocs([tag("param", "x")], "private")).toBe("private")
})
