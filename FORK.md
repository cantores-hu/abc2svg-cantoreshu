# abc2svg-cantoreshu — differences from upstream

This is an unofficial mirror and fork of
[abc2svg](https://chiselapp.com/user/moinejf/repository/abc2svg), maintained
for [cantores.hu](https://cantores.hu). `upstream` is a pristine, commit-for-
check-in mirror of upstream Fossil trunk; this working tree contains the
changes described here. To see the exact current delta:

```sh
git diff upstream
```

Upstream is LGPL-3.0-or-later, and so is this fork. Upstream copyright notices
remain intact. This document is the prominent notice of modification requested
by [the license](LICENSE).

## Engraving and lyrics

The fork changes lyric layout for large, singable type.

- Syllables are centered on their noteheads, without upstream's fixed-width
  cap. At the start of a slur or tie, the syllable's left edge aligns with the
  left edge of the first notehead instead. Recognized lyric prefixes (such as
  verse numbers) remain to the left.
- The first lyric line clears the lowest musical ink; subsequent stanzas use a
  measured lyric-line advance. The calculation follows staff and beam scaling,
  and pairs each first-stanza syllable's measured ascent with the music above
  its horizontal span, then chooses a shared baseline that clears every pair.
  Browser ink metrics are used, with conservative fallback for inline markup.
- `%%lyricfirstskipfac` sets the clearance above the first lyric line in beam
  gaps (default `1`), and `%%lyricskipfac` sets the stanza advance as a multiple
  of the measured line height (default `1.2`). Both accept `0`.
- Hyphens between syllables are drawn as short strokes, rather than taken from
  the lyric font's hyphen glyph. This makes their dimensions independent of
  font side bearings and keeps them appropriate at large lyric sizes.
- Ordinary lyric hyphens may be omitted when a line has insufficient room; the
  adjoining syllables are then rendered as one word. Hard lyric hyphens
  (`\\-`) reserve their room and are never omitted. This lets a score preserve
  an intentional compound seam.
- When omitted hyphens join Hungarian doubled digraphs, the spelling is
  repaired: for example, `asz-szony` becomes `asszony`, while a hard hyphen
  preserves a compound such as `kulcs\\-cso-mó`.
- With an `anno_start`/`anno_stop` hook set, a hyphen carried over to a line
  that opens on a symbol without a syllable (a bar, a rest) no longer crashes
  upstream's `out_ly()`; that carried hyphen is simply left unannotated.

Hyphen appearance and behaviour are controlled by these fork-specific format
parameters. Lengths and thickness are multiples of the lyric font size;
`lyrichyphenpos` is in x-heights of the lyric face.

| Parameter | Meaning |
| --- | --- |
| `%%lyrichyphenminlen` | Minimum drawable stroke length |
| `%%lyrichyphenmaxlen` | Maximum stroke length |
| `%%lyrichyphenwidth` | Stroke thickness |
| `%%lyrichyphenspace` | Space on either side of a stroke |
| `%%lyrichyphenpos` | Stroke height above the baseline |
| `%%lyrichyphenremove` | Allow ordinary hyphens to be omitted when tight |

The lyric implementation is in `core/format.js`, `core/lyrics.js`, and
`core/svg.js`. `test/lyrics.test.mjs` and `test/hyphens.test.mjs` cover it;
`test/preview.html` and `test/hyphens.html` provide browser previews using real
font metrics.

## Hungarian chord symbols

`modules/huchords.js` engraves chord roots the Hungarian way: B natural is `H`,
in the root and in the slash bass note alike. B flat is engraved `B♭` rather
than the bare `B` of a Hungarian chart, an explicit spelling either notation
reads the same way. What a tune spells is otherwise kept as written — `F#` stays
`F#`, and so does a `Cb`.

A root abc2svg has transposed is not the tune's spelling, and that one is
renamed by pitch class, on the side its accidentals came from
(`C C# D D# E F F# G G# A A# H`, or `C Db D Eb E F Gb G Ab A Bb H`). Upstream
transposes along the line of fifths, so it writes roots no chart carries — a
semitone up from B it writes `B#`, which is engraved here as `C`. A transposed
root a chart can carry is engraved as upstream spelt it. The chord symbols
upstream respells are marked with `gch.trsp`: in `csan_add` (`core/gchord.js`)
for a transposition, and in `modules/capo.js` for a capo line.

### Input in Hungarian notation

Chord symbols are read as English names, so `B` is B natural and `H` is no note
name at all — upstream engraves it verbatim, never transposes it, and the play
accompaniment (`util/chord.js`) cannot sound it.

`%%huchords` says the tune writes its chord symbols in Hungarian: an `H` is then
read as B natural, and a `B` carrying no accidental as B flat (a `B♭` or `B#` is
unambiguous as it stands and is left alone). The root and the slash bass note
are both read. The rewrite happens in `parse_gchord` (`core/gchord.js`) as the
symbol is parsed — before transposition, and before the text is saved for the
accompaniment — so the whole engine sees the English name, and only the
engraved spelling is Hungarian. It is a boolean format parameter like any
other: off by default, settable per tune or inside one.

```abc
%%huchords 1
X:1
K:C
"H"C "B"C "H7/D"C	% engraved H, B♭, H7/D; played B, Bb, B7/D
```

The module is linked into the core build, rather than loaded on demand. The
directive only says how to read the input: the engraved spelling is Hungarian
either way.

## Small note heads

`!head-small!` draws a note head at 70% of its size, the other notes of a
chord and the stem, ledger lines, dots and accidentals keeping theirs. Written
before a note inside a chord it applies to that note only; before the chord or
a single note, to all its heads:

```abc
X:1
L:1/4
K:C
[!head-small!CF] !head-small![ce] !head-small!G2|
```

The head is shrunk toward the stem, so that it meets the stem as a full head
does, with the stem up or down and also when a second puts it on the other
side of the stem; a head without a stem is shrunk toward its center. It works
with every head shape, including those set by `%%map`. The decoration is
refused on rests.

The decoration is function 46 in `core/deco.js`, which flags the note; the
head is drawn by `draw_basic_note()` in `core/draw.js`.
`test/smallhead.test.mjs` covers it.

## Distribution and build

- The package is published as `@cantoreshu/abc2svg`. It is a browser global,
  not an ES/CommonJS module; load `abc2svg-1.js` as a script.
- `package.json` records the upstream release as `upstream.version`; the npm
  package version is maintained independently.
- The build can minify with Node through `tools/jsmin-node.js` when neither
  `jsmin` nor QuickJS is available.
- The fork adds a Node test harness and tests for lyrics, hyphens, Hungarian
  chord spelling, and small note heads. Run `npm test` to build and execute them.

## Repository maintenance

- `tools/update-from-upstream.sh --merge` updates the pristine `upstream`
  mirror from Fossil and merges it into `main`; details are in
  [tools/README.md](tools/README.md).
- Fork-specific issue templates, a `.gitignore`, and README guidance identify
  this repository and route upstream bugs appropriately.
- The `Scc1t2/` SoundFont data is omitted. It is not needed for the fork's
  default build or cantores.hu playback use; retrieve it from upstream if
  needed.
