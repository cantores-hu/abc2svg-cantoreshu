// The small note head, !head-small! - see FORK.md.
//
// The head is drawn at .7 of its size, shrunk toward the stem so that it
// meets the stem as a full head does, whichever side of the stem it is on;
// a head with no stem is shrunk toward its center.  What is asserted is the
// origin of the scaled head against the stem and the note.

import test from 'node:test'
import assert from 'node:assert/strict'

import { engrave, render } from './harness.mjs'

/** The distance from a head's center to its stem. */
const STEM_XOFF = 3.5

/** How far the small head's origin moves toward the stem. */
const SHIFT = (1 - .7) * STEM_XOFF

const tune = (notes) => `X:1\nL:1/4\nK:C\n${notes}|\n`

/** The origins of the small heads, in engraving order. */
const smallHeads = (svg) =>
	[...svg.matchAll(/<g transform="translate\(([-\d.]+),([-\d.]+)\) scale\(0\.7\)">/g)]
		.map(m => ({ x: +m[1], y: +m[2] }))

/** The x of the stems, in engraving order. */
const stems = (svg) =>
	[...svg.matchAll(/<path class="sW" d="M([-\d.]+) /g)].map(m => +m[1])

/** Numbers as printed, to one decimal. */
const near = (a, b, what) =>
	assert.ok(Math.abs(a - b) <= .06, `${what}: ${a} is not ${b}`)

test('only the marked note of a chord is small', () => {
	const svg = engrave('', tune('[!head-small!CF] [CF]'))
	assert.equal(smallHeads(svg).length, 1)
})

test('a chord-level !head-small! makes every note small', () => {
	const svg = engrave('', tune('!head-small![CEG]'))
	assert.equal(smallHeads(svg).length, 3)
})

test('with the stem up, the small head is shrunk toward the stem', () => {
	const svg = engrave('', tune('[!head-small!CF]'))
	const [head] = smallHeads(svg), [stem] = stems(svg)
	near(stem - head.x, STEM_XOFF - SHIFT, 'stem up')
})

test('with the stem down, the small head is shrunk toward the stem', () => {
	const svg = engrave('', tune('[c!head-small!f]'))
	const [head] = smallHeads(svg), [stem] = stems(svg)
	near(head.x - stem, STEM_XOFF - SHIFT, 'stem down')
})

test('a head beyond the stem in a second is shrunk back toward it', () => {
	// stem up: the F of E-F stands right of the stem
	let svg = engrave('', tune('[E!head-small!F]'))
	near(smallHeads(svg)[0].x - stems(svg)[0], STEM_XOFF - SHIFT,
		'stem up, right of the stem')

	// stem down: the e of e-f stands left of the stem
	svg = engrave('', tune('[!head-small!ef]'))
	near(stems(svg)[0] - smallHeads(svg)[0].x, STEM_XOFF - SHIFT,
		'stem down, left of the stem')
})

test('a head with no stem is shrunk toward its center', () => {
	const svg = engrave('', tune('!head-small!C4'))
	const plain = engrave('', tune('C4'))

	// the full head is the last glyph (after the clef), drawn 5.2 left of
	// the note's center
	const x = +plain.match(/<text x="([\d.,]+)"/)[1].split(',').pop()
	near(smallHeads(svg)[0].x, x + 5.2, 'whole note')
})

test('!head-small! is refused on a rest', () => {
	const errors = []
	render('', tune('!head-small!z'), { errors })
	assert.ok(errors.some(e => e.includes('!head-small! must be on a note')),
		errors.join('\n'))
})
