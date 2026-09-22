// The hyphen between two syllables of a word - see FORK.md.
//
// It is a stroke of its own rather than the font's hyphen glyph, so what is
// asserted here is its geometry: where it stands, how long it is, how thick,
// how high; and around that, what happens where the line has no room for it -
// the syllables pulled into one word, and the Hungarian doubling undone with
// them.
//
// The headless harness measures strings with abc2svg's own Times tables, so
// the widths of the syllables are the fallback ones; the hyphen's own numbers
// are exact, being multiples of the lyric size and of the .45 x-height that is
// Times' as well.

import test from 'node:test'
import assert from 'node:assert/strict'

import { noteXs, render, syllables, syllableText } from './harness.mjs'

/**
 * The defaults of the five lengths, as core/format.js sets them: multiples of
 * the lyric size, save POS, which is one of the face's x-height.
 */
const MINLEN = .17, MAXLEN = .33, WIDTH = .04, SPACE = .05, POS = .55

/** What lyric_xheight() returns with no DOM to measure in: Times' own. */
const XHEIGHT = .45

/**
 * The room the shortest stroke wants: its own length and the air that keeps
 * it off the letters on either side.
 */
const hyphenRoom = (size) => (MINLEN + SPACE * 2) * size

/** The vocal font at `size`, which is all most of these fixtures set. */
const at = (size, family = 'serif') => `%%vocalfont "${family}" ${size}\n`

/**
 * The directives of a score that never drops a hyphen: the spacing then buys
 * the room outright and spreads the notes to give it.  A hymnal is set so.
 */
const keepHyphens = (size, family = 'serif') =>
	at(size, family) + '%%lyrichyphenremove 0\n'

// The reported fault.  Its lyrics are wide enough to drive the spacing, which
// is the case upstream's rule fails in: it asks for a whole em between the
// syllables before it will print a hyphen, which no syllabic setting leaves,
// so the hyphens are dropped and the syllables glued into one word.  Nothing
// but the first syllable of each word then stands under its own note.
const HYMN = 'X:1\nK:Eb\nL:1/4\n'
	+ 'E F G G | G A c2 | B4 | E F G G | G A B2 | G4 | B B c B | A G F G |'
	+ ' B A G2 | F4 | B B c B | A G F G | A G F2 | E4 |]\n'
	+ 'w: Áld-jad em-ber e nagy Jó-dat, Ke-nyér-szín-ben Meg-vál-tó-dat.'
	+ ' Itt je-len van szent tes-té-vel é-des Jé-zus, Je-len va-gyon szent'
	+ ' vé-ré-vel ál-dott Jé-zus.\n'

/** The syllables of the hymn, in order, with nothing glued. */
const SYL = ('Áld jad em ber e nagy Jó dat, Ke nyér szín ben Meg vál tó dat.'
	+ ' Itt je len van szent tes té vel é des Jé zus, Je len va gyon szent'
	+ ' vé ré vel ál dott Jé zus.').split(' ')

/** Three notes and one word: the smallest case the rule shows itself in. */
const WORD = 'X:1\nK:Eb\nL:1/4\nC D E\nw: Meg-vál-tó\n'

/** The syllables engraved, hyphens and line-break repeats dropped. */
function syl(directives, tune = HYMN) {
	return syllableText(directives, tune).filter((t) => t != '-')
}

/**
 * The syllables and hyphens engraved, a run of strokes - which a long gap
 * gets, one every four bodies - counted as the one hyphen it reads as.
 */
function shape(directives, tune) {
	return syllableText(directives, tune)
		.filter((t, i, a) => t != '-' || a[i - 1] != '-')
}

test('every syllable of the hymn stands on its own', () => {
	assert.deepEqual(syl(keepHyphens(36)), SYL)
})

// The hyphen goes between the two syllables, so all three are in order and
// none of them shares a place with another.
test('a hyphen is set between the syllables it joins', () => {
	const line = syllables(keepHyphens(36),
		'X:1\nK:C\nL:1/4\ncdec|\nw: Áld-jad em-ber\n')[0]

	assert.deepEqual(line.map((s) => s.t), ['Áld', '-', 'jad', 'em', '-', 'ber'])
	for (let i = 1; i < line.length; i++)
		assert.ok(line[i].x > line[i - 1].x,
			`${line[i].t} at ${line[i].x} is not past`
			+ ` ${line[i - 1].t} at ${line[i - 1].x}`)
})

// The size of the lyrics is what upstream's threshold - a whole em and more -
// is measured against, so the fault grows with it.  A score that has said its
// hyphens may not go keeps every one of them at every size.
test('the room bought keeps the hyphens at any lyric size', () => {
	for (const size of [10, 14, 24, 36, 48])
		assert.deepEqual(syl(keepHyphens(size)), SYL, `at ${size}pt`)
})

// A word broken over a line break keeps its hyphen on both sides: the tail of
// the word starts the next system with one before it.
test('a word broken over a system keeps its hyphen', () => {
	const systems = syllables(keepHyphens(36), HYMN)
	let broken = 0

	for (const line of systems.slice(1))
		if (line[0].t == '-') {
			broken++
			assert.ok(line[1] && line[1].x > line[0].x,
				'the syllable follows the hyphen')
		}
	assert.ok(broken > 0, 'the hymn does break a word over a system')
})

// -- the stroke itself --
//
// It is not the font's hyphen: nothing of the face decides how it looks, only
// the lyric size and the five lengths that answer to it.

/** The one hyphen of `tune`, with the geometry it was drawn with. */
const hyphen = (directives, tune = WORD) =>
	syllables(directives, tune).flat().find((s) => s.t == '-')

test('the hyphen is a stroke, not a glyph of the lyric font', () => {
	const texts = syllableText(keepHyphens(24, 'Liberation Serif'), WORD)

	assert.deepEqual(texts, ['Meg', '-', 'vál', '-', 'tó'])
	assert.ok(!syllables(keepHyphens(24, 'Liberation Serif'), WORD)[0]
			.some((s) => s.t == '-' && s.w === undefined),
		'every hyphen came back as a stroke with a length of its own')
})

test('its thickness is %%lyrichyphenwidth of the lyric size', () => {
	for (const size of [12, 24, 48])
		assert.ok(Math.abs(hyphen(keepHyphens(size)).th - WIDTH * size) < .06,
			`at ${size}pt it is ${hyphen(keepHyphens(size)).th} thick`)

	assert.ok(Math.abs(hyphen(keepHyphens(24) + '%%lyrichyphenwidth 0.25\n').th
				- 6) < .06,
		'and the directive is what sets it')
})

// The stroke hangs in the middle of the lower-case letters, which is where an
// x-height puts it - a measurement of the face, not a fixed part of the body.
test('its height is %%lyrichyphenpos of the x-height', () => {
	const line = syllables(keepHyphens(24), WORD)[0]
	const base = line.find((s) => s.t != '-').y
	const dy = (d) => base - hyphen(keepHyphens(24) + d).y

	assert.ok(Math.abs(base - line.find((s) => s.t == '-').y
				- POS * XHEIGHT * 24) < .06,
		`the default puts it ${POS} of an x-height over the baseline`)
	assert.ok(Math.abs(dy('%%lyrichyphenpos 0\n')) < .06,
		'0 puts it on the baseline')
	assert.ok(Math.abs(dy('%%lyrichyphenpos 1\n') - XHEIGHT * 24) < .06,
		'1 puts it on top of the lower-case letters')
})

// The length is what gives way to the room there is: a stretched line draws a
// long stroke and a tight one a short stroke, and neither moves a notehead.
test('the length lies between the two bounds, and follows the room', () => {
	const size = 24
	const wide = hyphen('%%pagewidth 250px\n%%stretchlast 1\n' + at(size),
			'X:1\nK:C\nL:1/4\ncc|\nw: la-la\n')
	const tight = hyphen(keepHyphens(size))

	assert.ok(Math.abs(wide.w - MAXLEN * size) < .06,
		`a stretched line draws the longest stroke, ${wide.w} of`
		+ ` ${MAXLEN * size}`)
	assert.ok(tight.w >= MINLEN * size - .06 && tight.w < MAXLEN * size,
		`a line at its own advance draws a shorter one: ${tight.w},`
		+ ` between ${MINLEN * size} and ${MAXLEN * size}`)
})

test('and the bounds are what the directives say', () => {
	const d = '%%lyrichyphenminlen 1\n%%lyrichyphenmaxlen 1\n'

	assert.ok(Math.abs(hyphen(keepHyphens(24) + d).w - 24) < .06,
		'a fixed length is drawn at any room')
	assert.ok(Math.abs(hyphen(keepHyphens(24)
				+ '%%lyrichyphenmaxlen 0.1\n').w
			- MINLEN * 24) < .06,
		'a maximum under the minimum gives way: the minimum is a floor')
})

// The air on either side is the parameter's, so the stroke never touches the
// letters: what the gap leaves over the stroke is at least twice that.
test('%%lyrichyphenspace is kept clear on either side', () => {
	const size = 24
	const gap = (d) => {
		const line = syllables(keepHyphens(size, 'Liberation Serif') + d,
					WORD)[0]
		const i = line.findIndex((s) => s.t == '-')

		return { air: line[i].x - line[i - 1].x, len: line[i].w }
	}

	// the stroke is centered, so the air on the left is what is left of
	// the gap, halved - and the syllable's own width is in it too, which
	// only makes the reading safer
	for (const d of ['', '%%lyrichyphenspace 0.3\n']) {
		const { air, len } = gap(d)
		const sp = (d ? .3 : SPACE) * size

		assert.ok(air > len + sp, `${d || 'the default'}: ${air} of air`)
	}
})

// -- a run of strokes --
//
// A gap too wide for one stroke - a long melisma, or a word broken over a
// system - is filled with a run of them, and what makes the run read as the
// one hyphen it is, is even spacing: as much air at either end of the run as
// between any two of its strokes.
test('a run of strokes is spread evenly across the gap', () => {
	const tune = 'X:1\nK:C\nL:1/1\nC C C |\nw: \u00c1ld-jad\n'
	const line = syllables('%%stretchlast 1\n' + at(12), tune)[0]
	const run = line.filter((s) => s.t == '-')
	const last = run[run.length - 1]
	const next = line[line.lastIndexOf(last) + 1]
	const pitch = run[1].x - run[0].x

	assert.ok(run.length > 2,
		`the gap is filled with a run: ${run.length} strokes`)
	for (let i = 1; i < run.length; i++)
		assert.ok(Math.abs(run[i].x - run[i - 1].x - pitch) < .11,
			`stroke ${i} keeps the pitch: ${run[i].x - run[i - 1].x}`
			+ ` of ${pitch}`)
	assert.ok(Math.abs(next.x - last.x - pitch) < .11,
		`the air before the next syllable is the air between two`
		+ ` strokes: ${next.x - last.x} of ${pitch}`)
})

// -- what the noteheads are moved for, and what they are not --
//
// The syllables: two of them may not be set one over another, so the spacing
// carries them.  The hyphen between two of them: no, while
// %%lyrichyphenremove stands.  It is set in the room the spacing happens to
// leave, and where that is too little it goes and the two syllables are pulled
// into one word - the setting giving in rather than the noteheads coming off
// their advance to hold a stroke.
//
// Four notes and two words on a page four times as wide as they need.  The
// music's own advance carries `Áld-jad` up to about 15pt; past that the
// hyphen would have to push the second notehead, so it is dropped instead.

const SHORT = 'X:1\nK:Eb\nL:1/4\nE F G G |\nw: Áld-jad em-ber\n'

test('a hyphen that would spread the noteheads is dropped first', () => {
	const at16 = (tune) =>
		syllableText(at(16, 'Liberation Serif'), tune).flat().join(' ')

	assert.equal(syllableText(at(12, 'Liberation Serif'), SHORT)
			.flat().join(' '), 'Áld - jad em - ber',
		'at 12pt the advance of a crotchet holds both hyphens')
	assert.equal(at16(SHORT), 'Áldjad ember',
		'at 16pt it holds neither, and the words are set whole')
	assert.equal(at16(WORD), 'Megvál - tó',
		'the room a dropped hyphen gives back may still hold the next')
})

// But where the notes are spread already - by justification, which runs after
// the spacing and before the drawing - the hyphen costs nothing and is kept.
// The same four notes, the same sizes, on a line stretched to the page.
test('a hyphen the line has room for is kept, however large the lyrics', () => {
	for (const size of [12, 16, 20, 24, 36, 48])
		assert.deepEqual(shape('%%stretchlast 1\n'
					+ at(size, 'Liberation Serif'), SHORT),
			['Áld', '-', 'jad', 'em', '-', 'ber'], `at ${size}pt`)
})

// Two notes, two syllables of the same width, one hyphen: whatever that width
// is, if each syllable is centered on its notehead then the space left between
// them is centered between the noteheads too - so a hyphen centered in that
// space stands exactly midway between the two notes.  Nothing here needs to
// know how wide 'la' is, and the reading catches both faults at once: a
// syllable set off its note (upstream takes .4 of the width to the left of the
// note, and never more than 14 units) moves the hyphen off the midpoint, and
// so does a hyphen set off the middle of the gap (upstream offsets it by 8
// units and 2, which is its own width only at about 14pt).
test('the hyphen stands midway between the two noteheads', () => {
	for (const size of [10, 14, 24, 36, 48]) {
		const directives = keepHyphens(size, 'Liberation Serif')
		const tune = 'X:1\nK:C\nL:1/4\ncc|\nw: la-la\n'
		const [notes] = noteXs(directives, tune)
		const line = syllables(directives, tune)[0]
		const hy = line.find((s) => s.t == '-')

		assert.equal(notes.length, 2, 'two noteheads')
		assert.ok(hy, `at ${size}pt the hyphen is printed`)
		assert.ok(Math.abs(hy.x + hy.w / 2
					- (notes[0] + notes[1]) / 2) < .11,
			`at ${size}pt the hyphen is centered on`
			+ ` ${hy.x + hy.w / 2},`
			+ ` the notes on ${(notes[0] + notes[1]) / 2}`)
	}
})

// The same reading for a word of its own: half of it stands left of the note.
test('a syllable is centered on its notehead', () => {
	const directives = at(36, 'Liberation Serif')
	const tune = 'X:1\nK:C\nL:1/4\ncc|\nw: la la\n'
	const [notes] = noteXs(directives, tune)
	const line = syllables(directives, tune)[0]

	assert.equal(line.length, 2, 'two syllables, no hyphen')
	assert.ok(Math.abs((notes[0] - line[0].x) - (notes[1] - line[1].x)) < .11,
		'the same syllable stands the same way under either note')

	// with a wider syllable the overhang grows by half the extra width
	const wide = syllables(directives, 'X:1\nK:C\nL:1/4\ncc|\nw: lala la\n')[0]
	const [wideNotes] = noteXs(directives, 'X:1\nK:C\nL:1/4\ncc|\nw: lala la\n')

	assert.ok(wideNotes[0] - wide[0].x > (notes[0] - line[0].x) * 1.9,
		'twice the letters, twice the overhang')
})

// -- %%lyrichyphenremove --
//
// The one directive that moves a notehead: with it off, the spacing buys the
// room the shortest stroke wants and the notes are spread by exactly that.
test('%%lyrichyphenremove 0 buys the room, and the notes are spread by it', () => {
	const size = 24
	const spread = (directives) => {
		const x = noteXs(at(size, 'Liberation Serif') + directives,
					WORD)[0]

		return x[1] - x[0]
	}
	const bought = spread('%%lyrichyphenremove 0\n') - spread('')

	assert.ok(Math.abs(bought - hyphenRoom(size)) < .11,
		`the notes were spread by ${bought} for a stroke and its air`
		+ ` of ${hyphenRoom(size)}`)
})

test('and the bounds are what decide how much that is', () => {
	const size = 24
	const spread = (directives) => {
		const x = noteXs(at(size, 'Liberation Serif')
				+ '%%lyrichyphenremove 0\n' + directives,
				WORD)[0]

		return x[1] - x[0]
	}
	const wider = spread('%%lyrichyphenminlen 1\n') - spread('')

	assert.ok(Math.abs(wider - (1 - MINLEN) * size) < .11,
		`a longer shortest stroke costs ${wider} more`)
})

test('the parameters take a number, and refuse a negative', () => {
	const xs = (directives, errors) =>
		syllables(at(24, 'Liberation Serif') + directives,
				WORD, { errors })[0].map((s) => s.x)
	const errors = []

	assert.deepEqual(xs('%%lyrichyphenminlen -1\n', errors), xs(''),
		'a negative leaves the default standing')
	assert.ok(errors.length, 'and is reported')
})

/** Every run of 2 to 4 syllables of the hymn, set as one word. */
const GLUED = []

for (let i = 0; i < SYL.length - 1; i++)
	for (let n = 2; n <= 4 && i + n <= SYL.length; n++)
		GLUED.push(SYL.slice(i, i + n).join(''))

// The default: lyrics too big for the width lose their hyphens one by one and
// the syllables are set as one word.  Each dropped hyphen gives back the room
// it would have taken, so the next hyphen of the word may still be printed.
test('with no room at all the syllables are pulled together', () => {
	const out = syllableText('%%pagewidth 300px\n' + at(44), HYMN)

	assert.ok(out.some((t) => GLUED.includes(t)),
		`no two syllables were set as one: ${out.join(' ')}`)
	assert.ok(out.some((t) => t == '-'),
		'and hyphens are still printed where there is room')
})

// With the directive off, nothing of that: the stroke is drawn whatever the
// page, the gap being opened for it where the spacing could not pay.
test('%%lyrichyphenremove 0 keeps the hyphen on any page', () => {
	const out = syllableText('%%pagewidth 400px\n' + keepHyphens(36), HYMN)

	assert.ok(!out.some((t) => GLUED.includes(t)),
		`a word was set glued after all: ${out.join(' ')}`)
})

// -- what is glued back into one word --
//
// Hungarian writes a long consonant spelt with two or three letters out whole
// on both sides of the hyphen that splits it - asz-szony for asszony,
// pogy-gyász for poggyász - so pulling the two syllables together has to undo
// that doubling as well, or the word comes back a letter too long.

/** The word as it is engraved when the two notes leave no room for a hyphen. */
const glued = (word, notes = 'C D', size = 16) =>
	syllableText(at(size, 'Liberation Serif'),
			`X:1\nK:C\nL:1/4\n${notes}\nw: ${word}\n`).join(' ')

test('a doubled digraph is written the once in the glued word', () => {
	assert.equal(glued('asz-szony'), 'asszony')
	assert.equal(glued('pogy-gyász'), 'poggyász')
	assert.equal(glued('brid-dzsel'), 'briddzsel',
		"'dzs' is seen before the 'dz' inside it")
	assert.equal(glued('ASZ-SZONY'), 'ASSZONY',
		'the letter kept is the one the syllable had')
})

test('and only where the same digraph meets itself', () => {
	assert.equal(glued('asz-tal', 'C D', 20), 'asztal',
		'the syllable after it begins with something else')
	assert.equal(glued('meg-gyet', 'C D', 20), 'meggyet',
		'and the one before it ends with something else')
	assert.equal(glued('nagy-sá-god', 'C D E', 20), 'nagyságod')
})

// The letter that goes is room given back, like the stroke's own: the next
// hyphen of the word is then printed where it would not have been.
test('the letter dropped is room the next hyphen may have', () => {
	assert.equal(glued('asz-szony-nyal', 'C D E', 12), 'asszony - nyal')
	assert.equal(glued('pogy-gyász-szal', 'C D E', 12), 'poggyász - szal')
})

// Nothing of this touches a word the line has room to hyphenate: the doubling
// is the poet's, and it stands wherever the hyphen does.
test('a word that keeps its hyphen keeps its doubling', () => {
	assert.deepEqual(syllableText(keepHyphens(24, 'Liberation Serif'),
					'X:1\nK:C\nL:1/4\nC D\nw: asz-szony\n'),
		['asz', '-', 'szony'])
})

// -- keeping one hyphen --
//
// The doubling cannot be told from a compound whose two parts meet at the same
// digraph - kulcscsomó is written with both of them and broken kulcs-cso-mó -
// so the score has to say which it is. A backslash makes that one lyric
// hyphen hard (kulcs\\-cso-mó), without affecting the next one.

/** `kulcs\\-cso-mó` over three notes, the music given as written. */
const seam = (music, size = 24, word = 'kulcs\\-cso-mó') =>
	syllableText(at(size, 'Liberation Serif'),
			`X:1\nK:C\nL:1/4\n${music}\nw: ${word}\n`).join(' ')

test('a hard lyric hyphen is kept, and the compound keeps its letters', () => {
	for (const size of [16, 24, 36, 48]) {
		assert.equal(seam('C D E', size),
			'kulcs - csomó',
			`at ${size}pt the hard seam is kept whole`)
	}
})

test('a hard hyphen only keeps its own seam', () => {
	assert.equal(seam('C D E', 24, 'Meg\\-vál-tó'), 'Meg - váltó',
		'the hard first seam is kept')
	assert.equal(seam('C D E', 24, 'Meg-vál\\-tó'), 'Megvál - tó',
		'the hard second seam is kept')
})

test('a hyphen carried onto a line that opens with a bar survives annotation', () => {
	const annotated = []
	const errors = []
	const { svg } = render('', 'X:1\nL:1/4\nK:C\nC D E F|G A B c|\nw:a b c d e f g ho-\n|c B A G|\nw:ly a b c\n', {
		errors,
		user: { anno_stop: (type, istart, iend) => { if (type == 'lyrics') annotated.push([istart, iend]) } }
	})

	assert.deepEqual(errors, [])
	assert.match(svg, />ly</)
	assert.equal(annotated.length, 12, 'every syllable is annotated once, the carried hyphen not at all')
})
