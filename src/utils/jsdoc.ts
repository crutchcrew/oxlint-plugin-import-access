/**
 * A JSDoc tag such as `@package` or `@access package`.
 */
export type Tag = {
	readonly name: string
	readonly text: string
}

/**
 * Minimal comment shape shared by oxc-parser and oxlint's `sourceCode`.
 * `value` excludes the `/*` and `*\/` delimiters.
 */
export type Comment = {
	readonly type: "Line" | "Block"
	readonly value: string
	readonly start: number
	readonly end: number
}

const LF = 10
const CR = 13

function isWhitespace(code: number): boolean {
	return (
		code === 32 || // space
		code === 9 || // tab
		code === 11 || // vertical tab
		code === 12 || // form feed
		code === LF ||
		code === CR ||
		code === 0xa0 ||
		code === 0xfeff ||
		code === 0x2028 ||
		code === 0x2029
	)
}

function isLineBreak(code: number): boolean {
	return code === LF || code === CR || code === 0x2028 || code === 0x2029
}

/**
 * Index of the last comment whose `end` is `<= pos`, or -1.
 * `comments` must be sorted by position (as parsers return them).
 */
function lastCommentEndingBefore(comments: readonly Comment[], pos: number): number {
	let lo = 0
	let hi = comments.length - 1
	let found = -1
	while (lo <= hi) {
		const mid = (lo + hi) >> 1
		if (comments[mid]!.end <= pos) {
			found = mid
			lo = mid + 1
		} else {
			hi = mid - 1
		}
	}
	return found
}

/**
 * Find the JSDoc comments attached to a node starting at `nodeStart`, following TypeScript's rules:
 *
 * - only block comments starting with `/**` (but not the empty `/**\/`) count,
 * - they must sit in the trivia between the previous token and the node,
 * - for statements, comments on the same line as the previous token belong to that token
 *   (`includeSameLine: false`); export specifiers and variable declarators take them too.
 */
export function findJsDocComments(
	sourceText: string,
	comments: readonly Comment[],
	nodeStart: number,
	includeSameLine = false,
): Comment[] {
	const attached: Comment[] = []
	let pos = nodeStart
	let index = lastCommentEndingBefore(comments, pos)
	// Walk backwards over whitespace and comments to the end of the previous token.
	for (;;) {
		while (pos > 0 && isWhitespace(sourceText.charCodeAt(pos - 1))) {
			pos--
		}
		const comment = index >= 0 ? comments[index] : undefined
		if (comment === undefined || comment.end !== pos) {
			break
		}
		attached.push(comment)
		pos = comment.start
		index--
	}
	attached.reverse()

	let firstCollectable = 0
	if (pos > 0 && !includeSameLine) {
		// Comments before the first line break after the previous token are its trailing comments.
		firstCollectable = pos
		while (firstCollectable < nodeStart && !isLineBreak(sourceText.charCodeAt(firstCollectable))) {
			firstCollectable++
		}
	}

	return attached.filter(
		(comment) =>
			comment.start >= firstCollectable &&
			comment.type === "Block" &&
			comment.value.startsWith("*") &&
			comment.value !== "*",
	)
}

const tagNameStart = /[\p{ID_Start}$_]/u
// TypeScript's JSDoc scanner also takes `-` in tag names (`@private-api` is not `@private`).
const tagNamePart = /[-\p{ID_Continue}$\u200c\u200d]/u

/**
 * Parse the block tags of a JSDoc comment the way TypeScript does.
 *
 * A tag starts with `@` followed by its name, at the beginning of a line (after the optional `*`
 * margin) or after a space or tab, but not inside backticks. Its text runs until the next tag.
 */
export function parseJsDocTags(comment: Comment): Tag[] {
	// `value` of `/** ... */` starts with the second `*` of the opening delimiter.
	const text = comment.value
	const tags: Tag[] = []
	let current: { name: string; text: string } | undefined
	let lineStart = true
	let afterWhitespace = true
	let inBackticks = false
	let pos = 1
	while (pos < text.length) {
		const char = text[pos]!
		if (isLineBreak(char.charCodeAt(0))) {
			if (current) {
				current.text += "\n"
			}
			lineStart = true
			afterWhitespace = true
			inBackticks = false
			pos++
			// Skip the margin: indentation and one `*`.
			while (pos < text.length && (text[pos] === " " || text[pos] === "\t")) {
				pos++
			}
			if (text[pos] === "*") {
				pos++
			}
			continue
		}
		if (
			char === "@" &&
			!inBackticks &&
			(lineStart || afterWhitespace) &&
			tagNameStart.test(text[pos + 1] ?? "")
		) {
			let end = pos + 2
			while (end < text.length && tagNamePart.test(text[end]!)) {
				end++
			}
			if (current) {
				tags.push({ name: current.name, text: current.text.trim() })
			}
			current = { name: text.slice(pos + 1, end), text: "" }
			pos = end
			// A tag can follow a tag name directly (`@package@private`).
			lineStart = true
			continue
		}
		if (char === "`") {
			inBackticks = !inBackticks
		}
		afterWhitespace = char === " " || char === "\t"
		lineStart = false
		if (current) {
			current.text += char
		}
		pos++
	}
	if (current) {
		tags.push({ name: current.name, text: current.text.trim() })
	}
	return tags
}

/**
 * Tags as TypeScript reports them for a node: `symbol.getJsDocTags()` only sees the last JSDoc block
 * (`own`), while the declaration's `jsDoc` holds every block (`all`).
 */
export type NodeTags = {
	readonly own: readonly Tag[]
	readonly all: readonly Tag[]
}

export function jsDocTagsAt(
	sourceText: string,
	comments: readonly Comment[],
	nodeStart: number,
	includeSameLine = false,
): NodeTags {
	const blocks = findJsDocComments(sourceText, comments, nodeStart, includeSameLine)
	const last = blocks.at(-1)
	return {
		own: last === undefined ? [] : parseJsDocTags(last),
		all: blocks.flatMap(parseJsDocTags),
	}
}
