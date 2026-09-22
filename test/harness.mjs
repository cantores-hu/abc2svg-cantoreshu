// Test harness for the abc2svg-cantoreshu fork.
//
// Evaluates the *built* abc2svg-1.js in a fresh vm context per render, so a
// test sees exactly the file the package ships - not the sources it was made
// from.  Run `./build` first (`npm test` does).
//
// There is no DOM here, so lyric_ascent() cannot measure a real face and
// always takes its .78-of-the-line-height fallback.  That is what makes the
// numbers below reproducible; for real metrics, open test/preview.html.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ENGINE = readFileSync(
	fileURLToPath(new URL('../abc2svg-1.js', import.meta.url)), 'utf8')

/** Point size the fixtures engrave their lyrics at. */
export const LYRIC_SIZE = 36

/** What lyric_ascent() returns with no DOM: .78 of the line height. */
export const FALLBACK_ASCENT = LYRIC_SIZE * .78		// 28.08

/** Engrave `directives + tune` and return the whole SVG. */
export function engrave(directives, tune, opts = {}) {
	return render(directives, tune, opts).svg
}

/** Engrave `directives + tune`, keeping the engine that did it. */
export function render(directives, tune, opts = {}) {
	const sandbox = { abc2svg: {} }

	if (opts.document)
		sandbox.document = opts.document
	vm.createContext(sandbox)
	vm.runInContext(ENGINE, sandbox)

	let svg = ''
	const abc = new sandbox.abc2svg.Abc({
		img_out: (str) => { svg += str },
		errmsg: (msg) => { if (opts.errors) opts.errors.push(msg) },
		read_file: () => null,
		...opts.user
	})
	abc.tosvg('test',
		'%%pagewidth 642.52px\n%%pagescale 1\n'
		+ `%%vocalfont "Merriweather" ${LYRIC_SIZE}\n`
		+ '%%musicspace 0\n%%topspace 0\n%%vocalspace 0\n'
		+ directives + tune)
	return { svg, abc }
}

/**
 * The chord symbols of a tune in engraving order, each as it is engraved and
 * as the play accompaniment reads it - `util/chord.js` sounds `otext`, and
 * only ever in English names.
 *
 * abc.tunes holds `[tsfirst, voice_tb, info, cfmt]` per tune, which is what
 * the players walk; the symbols are gone from the engine itself by then.
 *
 * @return {Array<{text: string, otext: string}>}
 */
export function chordSymbols(directives, tune, ix = 0) {
	const { abc } = render(directives, tune)
	const gchs = []

	for (let s = abc.tunes[ix][0]; s; s = s.ts_next) {
		for (const gch of s.a_gch || [])
			if (gch.type == 'g')
				gchs.push({ text: gch.text, otext: gch.otext })
	}
	return gchs
}

/**
 * Per system, the baseline of each lyric line, as a distance below that
 * system's bottom staff line.
 *
 * abc2svg wraps a system's music in a <g> translated to the staff's bottom
 * line, so a lyric <text>'s own y is that distance already.
 *
 * @return {Array<Array<number>>} one array of baselines per engraved system
 */
export function lyricBaselines(directives, tune, opts) {
	const systems = []

	for (const [, body] of engrave(directives, tune, opts)
				.matchAll(/<g transform="translate\(0,[\d.]+\)">([\s\S]*?)<\/g>/g)) {
		const ys = [...new Set([...body.matchAll(
			/<text class="f\d+" x="[\d.]+" y="([-\d.]+)"[^>]*>([^<]*)/g)]
				.filter((m) => m[2].trim())
				.map((m) => +m[1]))]
		if (ys.length)
			systems.push(ys)
	}
	return systems
}

/** The first lyric baseline of every system. */
export function firstBaselines(directives, tune, opts) {
	return lyricBaselines(directives, tune, opts).map((ys) => ys[0])
}

/**
 * A syllable <text>, or a hyphen stroke - the `lyhy` path out_hyph() draws
 * between two syllables of a word.  Alternation keeps them in engraving order.
 */
const LY_ITEM = new RegExp([
	/<text class="f\d+" x="([\d.,]+)" y="([-\d.]+)"[^>]*>([^<]*)/.source,
	/<path class="stroke lyhy" stroke-width="([\d.]+)"\s+d="m([-\d.]+) ([-\d.]+)h([-\d.]+)"/.source
].join('|'), 'g')

/**
 * Per system, the lyric line's syllables and hyphens in engraving order.
 *
 * A syllable comes back as `{t, x, y}`; a hyphen - which is a stroke of its
 * own since 2026-09-11, not the font's glyph - as `{t: '-', x, y, w, th}`,
 * where `w` is the length of the stroke and `th` its thickness.  A long gap
 * gets a run of strokes, and each of those is an item of its own.
 *
 * @return {Array<Array<{t: string, x: number, y: number}>>} one per system
 */
export function syllables(directives, tune, opts) {
	const systems = []

	for (const [, body] of engrave(directives, tune, opts)
				.matchAll(/<g transform="translate\(0,[\d.]+\)">([\s\S]*?)<\/g>/g)) {
		const line = [...body.matchAll(LY_ITEM)]
			.map((m) => m[1] !== undefined
				? { t: m[3], x: +m[1].split(',')[0], y: +m[2] }
				: { t: '-', x: +m[5], y: +m[6],
				    w: +m[7], th: +m[4] })
			.filter((s) => s.t.trim())
		if (line.length)
			systems.push(line)
	}
	return systems
}

/**
 * Per system, the x of every notehead.
 *
 * abc2svg draws the stem 3.5 units off the middle of the head, on the left of
 * a note whose stem goes down - which every note of the fixtures here does, so
 * the stems give the noteheads away.
 *
 * @return {Array<Array<number>>} one array per engraved system
 */
export function noteXs(directives, tune, opts) {
	const systems = []

	for (const [body] of engrave(directives, tune, opts)
				.matchAll(/<svg[\s\S]*?<\/svg>/g)) {
		const xs = [...body.matchAll(/class="sW" d="([^"]+)"/g)]
			.flatMap((m) => [...m[1].matchAll(/M([\d.]+) /g)])
			.map((m) => +m[1] + 3.5)
		if (xs.length)
			systems.push(xs)
	}
	return systems
}

/** The syllables and hyphens of every system, flattened, as strings. */
export function syllableText(directives, tune, opts) {
	return syllables(directives, tune, opts)
		.flat()
		.map((s) => s.t)
}

/**
 * Every laid-out string in engraving order.  abc2svg numbers its font classes
 * per tune, so a fixture that wants only its chord symbols back must carry no
 * title and no lyrics.
 */
export function texts(directives, tune) {
	return [...engrave(directives, tune)
			.matchAll(/<text class="f\d+"[^>]*>([^<]*)/g)].map((m) => m[1])
}

/**
 * A `document` just complete enough for lyric_ascent(): one canvas whose
 * measureText() answers with `metrics`, and a font set that says `loaded`.
 * Passing one makes the engine take its measured path instead of the .78
 * fallback, which is otherwise unreachable outside a browser.
 */
export function fakeDocument(metrics, loaded = true) {
	return {
		createElement: () => ({
			getContext: () => ({ font: '', measureText: () => metrics })
		}),
		fonts: { check: () => loaded }
	}
}

/** Baselines are sums of float text heights, so compare them as such. */
export function near(actual, expected, what) {
	if (!Number.isFinite(actual) || !Number.isFinite(expected)
	 || Math.abs(actual - expected) >= 0.11)
		throw new Error(`${what}: ${actual} vs ${expected}`)
}
