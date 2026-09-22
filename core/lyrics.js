// abc2svg - lyrics.js - lyrics
//
// Copyright (C) 2014-2026 Jean-François Moine
//
// This file is part of abc2svg-core.
//
// abc2svg-core is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// abc2svg-core is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with abc2svg-core.  If not, see <http://www.gnu.org/licenses/>.

// parse a symbol line (s:)
function get_sym(p, cont) {
	var s, c, i, j, d

	if (curvoice.ignore)
		return

	// get the starting symbol of the lyrics
	if (cont) {					// +:
		s = curvoice.sym_cont
		if (!s) {
			syntax(1, "+: symbol line without music")
			return
		}
	} else {
		if (curvoice.sym_restart) {		// new music
			curvoice.sym_start = curvoice.sym_restart;
			curvoice.sym_restart = null
		}
		s = curvoice.sym_start
		if (!s)
			s = curvoice.sym
		if (!s) {
			syntax(1, "s: without music")
			return
		}
	}

	/* scan the symbol line */
	i = 0
	while (1) {
		while (p[i] == ' ' || p[i] == '\t')
			i++;
		c = p[i]
		if (!c)
			break
		switch (c) {
		case '|':
			while (s && s.type != C.BAR)
				s = s.next
			if (!s) {
				syntax(1, "Not enough measure bars for symbol line")
				return
			}
			s = s.next;
			i++
			continue
		case '!':
		case '"':
			j = ++i
			i = p.indexOf(c, j)
			if (i < 0) {
				syntax(1, c == '!' ?
					"No end of decoration" :
					"No end of chord symbol/annotation");
				i = p.length
				continue
			}
			d = p.slice(j - 1, i + 1)
			break
		case '*':
			break
		default:
			d = c.charCodeAt(0)
			if (d < 128) {
				d = char_tb[d]
				if (d.length > 1
				 && (d[0] == '!' || d[0] == '"')) {
					c = d[0]
					break
				}
			}
			syntax(1, errs.bad_char, c)
			break
		}

		/* store the element in the next note */
		while (s && s.type != C.NOTE)
			s = s.next
		if (!s) {
			syntax(1, "Too many elements in symbol line")
			return
		}
		switch (c) {
		default:
//		case '*':
			break
		case '!':
			a_dcn.push(d.slice(1, -1))
			deco_cnv(s, s.prev)
			break
		case '"':
			parse.line.index = j + 2	// (+ 's:')
			parse_gchord(d)
			if (a_gch)			// if no error
				csan_add(s)
			break
		}
		s = s.next;
		i++
	}
	curvoice.sym_cont = s
}

/* -- parse a lyric (vocal) line (w:) -- */
function get_lyrics(p, cont) {
    var s, word, i, j, ly, dfnt, ln, c, cf, hard_hyphen

	if (curvoice.ignore)
		return
	if ((curvoice.pos.voc & 0x07) != C.SL_HIDDEN)
		curvoice.have_ly = true

	// get the starting symbol of the lyrics
	if (cont) {					// +:
		s = curvoice.lyric_cont
		if (!s) {
			syntax(1, "+: lyric without music")
			return
		}
		if (p[0] == '~') {			// +:~next~words
			while (!s.a_ly)
				s = s.prev
			ly = s.a_ly[curvoice.lyric_line]
			p = ly.t.replace(/ /g,'~') + p
		}
		dfnt = get_font("vocal")
		if (gene.deffont != dfnt) {	// if vocalfont change
			if (gene.curfont == gene.deffont)
				gene.curfont = dfnt
			gene.deffont = dfnt
		}
	} else {
		set_font("vocal")
		if (curvoice.lyric_restart) {		// new music
			curvoice.lyric_start = s = curvoice.lyric_restart;
			curvoice.lyric_restart = null;
			curvoice.lyric_line = 0
		} else {
			curvoice.lyric_line++;
			s = curvoice.lyric_start
		}
		if (!s)
			s = curvoice.sym
		if (!s) {
			syntax(1, "w: without music")
			return
		}
	}

	/* scan the lyric line */
	i = 0
	cf = gene.curfont
	while (1) {
		while (p[i] == ' ' || p[i] == '\t')
			i++
		if (!p[i])
			break
		ln = 0
		hard_hyphen = false
		j = parse.istart + i + 2	// start index
		switch (p[i]) { 
		case '|':
			while (s && s.type != C.BAR)
				s = s.next
			if (!s) {
				syntax(1, "Not enough measure bars for lyric line")
				return
			}
			s = s.next;
			i++
			continue
		case '-':
			if (ly?.ln != 3)
				word = '-', ln = 2
			else
				word = '_', ln = 3
			break
		case '_':
			if (ly && ly.ln && ly.ln != 3)
				word = '-', ln = 2
			else
				word = '_', ln = 3
			break
		case '*':
			word = ""
			break
		default:
			word = "";
			while (1) {
				if (!p[i])
					break
				switch (p[i]) {
				case '_':
				case '*':
				case '|':
					i--
				case ' ':
				case '\t':
					break
				case '~':
					word += ' '
					i++
					continue
				case '-':
					ln = 1		// start of line
					break
				case '\\':
					if (!p[++i])
						continue
					if (p[i] == '-') {
						ln = 1
						hard_hyphen = true
						break
					}
					word += p[i++]
					continue
				case '$':
					word += p[i++]
					c = p[i]
					if (c == '0')
						gene.curfont = gene.deffont
					else if (c >= '1' && c <= '9')
						gene.curfont = get_font("u" + c)
					// fall thru
				default:
					word += p[i++]
					continue
				}
				break
			}
			break
		}

		/* store the word in the next note */
		while (s && s.type != C.NOTE)
			s = s.next
		if (!s) {
			syntax(1, "Too many words in lyric line")
			return
		}
		if (word
		 && (s.pos.voc & 0x07) != C.SL_HIDDEN) {
			ly = {
				t: word,
				font: cf,
				istart: j,
				iend: j + word.length
			}
			if (ln)
				ly.ln = ln
			if (hard_hyphen)
				ly.hard_hyphen = true
			if (!s.a_ly)
				s.a_ly = []
			s.a_ly[curvoice.lyric_line] = ly
			cf = gene.curfont
		}
		s = s.next;
		i++
	}
	curvoice.lyric_cont = s
}

// -- the geometry of the hyphen between two syllables of a word --
// The hyphen is not the font's hyphen glyph but a stroke drawn between the
// syllables, so that it answers to the size of the lyrics and to nothing else:
// a glyph carries side bearings of its own, differs from face to face, and at
// a singable size draws a mark the engraver never asked for.  Everything here
// is a multiple of the lyric size, save the height, which is of the face's
// x-height - the stroke belongs in the middle of the lower-case letters.
//
// The length gives way to the room there is, between %%lyrichyphenminlen and
// %%lyrichyphenmaxlen, so a stretched line draws a long stroke and a tight one
// a short one without either of them moving a notehead.
// (the caller has set gene.curfont to the font of the syllable)
function hyphen_geom(s) {
    var	f = s.fmt,
	sz = gene.curfont.size,
	g = {
		min: f.lyrichyphenminlen * sz,
		max: f.lyrichyphenmaxlen * sz,
		sp: f.lyrichyphenspace * sz,	// air between stroke and letters
		th: f.lyrichyphenwidth * sz,	// the stroke's thickness
		dy: f.lyrichyphenpos * lyric_xheight(gene.curfont)
	}

	if (g.max < g.min)
		g.max = g.min
	return g
} // hyphen_geom()

// -- the room a hyphen is given between two syllables --
// The shortest stroke it may be drawn as, and the air on either side that
// keeps it from touching the letters.  Under that there is no hyphen to draw,
// and what happens then is %%lyrichyphenremove: the stroke goes and the two
// syllables are pulled into one word, or - where the score says no - the room
// is bought from the spacing and the noteheads spread to give it.
//
// `s` is the note the *first* of the two syllables is on.
// (the caller has set gene.curfont to the font of the syllable)
function hyphen_room(s) {
    var	g = hyphen_geom(s)

	return g.min + g.sp * 2
} // hyphen_room()

// -- the room the spacing buys between two syllables of a word --
// Nothing, while %%lyrichyphenremove stands: the notes keep the advance the
// music gives them, the hyphen is set in whatever the spacing happens to leave
// - justification most often leaves it - and where that is too little the
// hyphen goes rather than the noteheads coming off their advance to hold a
// stroke.  A score that turns the directive off buys the room outright
// instead, and no hyphen of it is ever dropped, at the cost of fewer notes to
// the system.  A hymnal is set that way.
// (this runs while the music is generated, where the current font is the
//  music's own, so the syllable's is put on for the measurement)
function hyphen_bought(s, ly) {
    var	w,
	cf = gene.curfont

	if (s.fmt.lyrichyphenremove && !ly.hard_hyphen)
		return 0
	gene.curfont = ly.font
	w = hyphen_room(s)
	gene.curfont = cf
	return w
} // hyphen_bought()

// -- the doubled digraphs Hungarian writes across a hyphen --
// A long consonant spelt with two or three letters is written out whole on
// both sides of the hyphen that splits it - asz-szony, pogy-gyász,
// brid-dzsel - where the word itself has it only once and a half: asszony,
// poggyász, briddzsel.  So a syllable break undone has to undo the doubling
// with it, or the word comes back a letter too long.
// (longest first, so 'dzs' is seen before the 'dz' inside it)
var hu_digraphs = ['dzs', 'cs', 'dz', 'gy', 'ly', 'ny', 'sz', 'ty', 'zs']

// -- glue two syllables of a word into the one word they came from --
// The letters are all there is to read here, and they cannot tell the doubling
// apart from a compound whose two parts happen to meet at the same digraph -
// kulcs-csomó is written kulcscsomó, with both of them kept - so such a word
// would come out a letter short.  The doubling is much the commoner, and the
// seam of a compound is a hyphen the score wants kept anyway: writing `\\-`
// buys its room, and a hyphen that is printed is never glued.
function ly_glue(left, right) {
    var	i, d, n

	left = left.toString()
	right = right.toString()
	for (i = 0; i < hu_digraphs.length; i++) {
		d = hu_digraphs[i]
		n = d.length
		if (left.length >= n
		 && right.length >= n
		 && left.slice(-n).toLowerCase() == d
		 && right.slice(0, n).toLowerCase() == d)

			// the digraph the left syllable ends with is left
			// standing as its first letter alone
			return left.slice(0, left.length - n + 1) + right
	}
	return left + right
} // ly_glue()

// install the words under a note
// (this function is called during the generation)
function ly_set(s) {
    var	i, j, ly, d, s1, s2, p, w, spw, xx, sz, shift, dw, r,
	s3 = s,				// start of the current time sequence
	wx = 0,
	wl = 0,
	n = 0,
	dx = 0,
	a_ly = s.a_ly,
	left = s.ti1 || (s.sls && s.sls.some(function(sl) {
		return sl.ss == s && sl.se != s
	})),
	// Match the drawn head's left edge, including chord displacement
	// and music scaling (lyrics themselves are not scaled).
	leftshift = left ? ([3.7, 3.8, 5.2, 7, 6][s.head]
		- Math.min.apply(null, s.notes.map(function(nt) {
			return nt.shhd || 0
		}))) * s.p_v.scale
		* (staff_tb[s.st].staffscale || cur_sy.staves[s.st].staffscale) : 0,
	align = 0

	// get the available horizontal space before the next lyric words
	for (s2 = s.ts_next; s2; s2 = s2.ts_next) {
		if (s2.seqst) {
			dx += s2.shrink
			n++			// number of symbols without word
		}
		if (s2.bar_type) {		// stop on a bar
			dx += 3			// and take some of its spacing
			break
		}
		if (!s2.a_ly)
			continue
		i = s2.a_ly.length
		while (--i >= 0) {
			ly = s2.a_ly[i]
			if (!ly)
				continue
			if (!ly.ln || ly.ln < 2)
				break
		}
		if (i >= 0)
			break
	}

	// define the offset of the words
	for (i = 0; i < a_ly.length; i++) {
		ly = a_ly[i]
		if (!ly)
			continue
		gene.curfont = ly.font
		ly.t = str2svg(ly.t)
		p = ly.t.replace(/<[^>]*>/g, '')	// remove the XML tags
		if (ly.ln >= 2) {
			ly.shift = 0
			continue
		}
		spw = cwid(' ') * ly.font.swfac
		w = ly.t.wh[0]
		r = abc2svg.lypre.exec(p)

		// A prefix is what stands *before* a syllable - a verse
		// number, a part name, a bracket - so a match that eats the
		// whole word is not one.  `jad:` is a syllable that happens to
		// end in a colon, not a label with nothing left to label, and
		// hanging it to the left of the note would set the letters to
		// the right of the notehead instead of over it.
		if (r && r[0].length >= p.length)
			r = null
		if (s.type == C.GRACE) {		// %%graceword
			shift = s.wl
		} else if (r) {
			r = r[0]
			if (p[0] == '(') {
				sz = spw
			} else {
				set_font(ly.font)
				if (p[r.length] == ' '
				 || r.slice(-1) == ':')
					sz = strwh(p.slice(0, r.length))[0]
				else
					sz = w * .2
			}

			// the prefix - a verse number, a bracket - hangs to
			// the left of the note, and what follows it is what
			// follows the syllable's alignment
			shift = sz + (left ? leftshift : (w - sz) * .5)
			if (p[0] >= '0' && p[0] <= '9') {
				if (shift > align)
					align = shift
			}
		} else {

			// A syllable is centered on the notehead, so half of
			// it stands left of the note.  (upstream takes .4 of
			// it, and no more than 14 units whatever the size:
			// that leaves anything wider than 35 units - which at
			// a singable size is every syllable there is - hanging
			// to the right of its note by the rest)
			// Slurs and ties anchor the syllable's left edge to
			// their first notehead's left edge instead.
			shift = left ? leftshift : w * .5
		}
		ly.shift = shift
		if (shift > wl)
			wl = shift		// max left space

		// A syllable is followed by room for whatever comes next: a
		// space before the next word, and before a hyphen nothing at
		// all while %%lyrichyphenremove stands.  The syllables
		// themselves are what the notes are moved for - they may not
		// be set one over another - and a hyphen is not: it is set in
		// the room the spacing happens to leave, and where that is too
		// little it is dropped and the two syllables pulled into one
		// word rather than the noteheads pushed off their advance to
		// hold a stroke.  Justification is what most often leaves the
		// room, and it runs after this and before the drawing, so a
		// hyphen on a stretched line is kept even where the spacing
		// here could not have paid for it.  %%lyrichyphenremove 0 is
		// how a score buys the room outright: the notes are then
		// spread for the hyphen too, and no hyphen is dropped, at the
		// cost of fewer notes to the system. A hard lyric hyphen (\\-)
		// makes the same bargain for that one word.
		w += ly.ln == 1 ? hyphen_bought(s, ly) : spw
		w -= shift			// right width
		if (w > wx)
			wx = w			// max width
	}

	// set the left space
	while (!s3.seqst)
		s3 = s3.ts_prev
	if (s3.ts_prev && s3.ts_prev.bar_type)
		wl -= 4			// don't move too much the measure bar
	if (s3.wl < wl) {
		s3.shrink += wl - s3.wl
		s3.wl = wl
	}

	// if not room enough, shift the following notes to the right
	dx -= 6
	if (dx < wx && s2) {
		dx = (wx - dx) / n
		s1 = s.ts_next
		while (1) {
			if (s1.seqst) {
				s1.shrink += dx
				s3.wr += dx	// (needed for end of line)
				s3 = s1
			}
			if (s1 == s2)
				break
			s1 = s1.ts_next
		}
	}

	if (align > 0) {
		for (i = 0; i < a_ly.length; i++) {
			ly = a_ly[i]
			if (ly && ly.t[0] >= '0' && ly.t[0] <= '9')
				ly.shift = align
		}
	}
} // ly_set()

/* -- draw the lyrics under (or above) notes -- */
/* (the staves are not yet defined) */
function draw_lyric_line(p_voice, j, y) {
    var	p, lastx, w, s, ly, lyl, ln,
	lflag, x0, shift, hyw, hg, gap, glue, drop,
	hyflag = {}

	// output a syllable
	// (a hyphen carried over from the previous line starts at a symbol
	//  that may have no syllable of its own - nothing to annotate then)
	function out_ly(s, w, p) {
		var	s2

		if ((user.anno_start || user.anno_stop)
		 && s.a_ly && s.a_ly[j]) {
			s2 = {
				p_v: s.p_v,
				st: s.st,
				istart: s.a_ly[j].istart,
				iend: s.a_ly[j].iend,
				ts_prev: s,
				ts_next: s.ts_next,
				x: lastx,
				y: y,
				ymn: y,
				ymx: y + gene.curfont.size,
				wl: 0,
				wr: w
			}
			anno_start(s2, 'lyrics')
		}
		xy_str(lastx, y, p)
		if (s2)
			anno_stop(s2, 'lyrics')
	} // out_ly()

	function set_hy(v) {
		if (v) {
			hyflag.s = s
			hyflag.p = p
			hyflag.w = w
		} else {
			hyflag.s = null
			hyflag.p = ""
			hyflag.w = 0
		}
	} // set_hy()

	for (s = p_voice.sym; /*s*/; s = s.next)
		if (s.type != C.CLEF
		 && s.type != C.KEY && s.type != C.METER)
			break
	x0 = s.x - s.wl - 10
	lastx = 0
	set_hy(0)
	if (p_voice.hy_st & (1 << j)) {
		hyflag.s = s
		p_voice.hy_st &= ~(1 << j)
	}
	for ( ; s; s = s.next) {
		if (s.a_ly)
			ly = s.a_ly[j]
		else
			ly = null
		if (!ly) {
			switch (s.type) {
			case C.REST:
			case C.MREST:
				if (lflag) {
					out_wln(lflag, y, x0 - lflag)
					lflag = 0
					lastx = s.x + s.wr
				}
			}
			continue
		}
		if (ly.font != gene.curfont)		/* font change */
			gene.curfont = ly.font
		p = ly.t;
		ln = ly.ln || 0
		w = p.wh[0]
		shift = ly.shift

		if (ln == 3) {				// if '_'
			if (!lflag)
				lflag = x0 + 3
			x0 = s.x - shift + w
			continue
		}
		if (lflag) {
			out_wln(lflag, y, x0 - lflag)
			lflag = 0
		}
		x0 = s.x - shift
		if (ln == 1				// first '-'
		 && !hyflag.s) {
			set_hy(1)
			lastx = x0
			continue
		}
		if (ln == 2)				// more '-'
			continue
		if (hyflag.s) {

			// The room the shortest stroke wants, which is what
			// ly_set() asked the spacing for where the score said
			// no hyphen may go: the two agree, so a line the page
			// can hold keeps every hyphen of such a score.
			// (upstream compares against swfac here, a whole em and
			//  more, which no syllabic setting ever leaves - which
			//  is why its hyphens all but vanish under a large
			//  lyric font)
			hg = hyphen_geom(hyflag.s)
			hyw = hg.min + hg.sp * 2
			gap = x0 - hyflag.w - lastx

			// Short of it, the hyphen goes - unless the score has
			// said it may not, in which case the gap is opened to
			// hold the shortest stroke.  That is normally already
			// paid for by the spacing; it is not only where the
			// page is too narrow for the lyrics at all.
			if (gap < hyw && (!hyflag.s.fmt.lyrichyphenremove
						 || hyflag.s.a_ly[j].hard_hyphen)) {
				x0 = lastx + hyflag.w + hyw
				gap = hyw
			}
			if (gap >= hyw) {
				if (!lastx)
					lastx = x0 - ly.font.size
				out_ly(hyflag.s, hyflag.w, hyflag.p)
				lastx += hyflag.w
				out_hyph(lastx, y, x0 - lastx, hg)
				set_hy(0)
				lastx = x0
			} else {

				// no room for the hyphen at all: drop it and
				// pull the syllables together into one word.
				// That gives back the room it would have taken,
				// so the next hyphen of the word has more.
				x0 = lastx
			}
			if (hyflag.p) {			// concatenate

				// what is glued is one word, so a doubled
				// digraph is written the once it is written
				// in the word - and the word is then shorter
				// than the two syllables measured apart
				glue = ly_glue(hyflag.p, p)
				w += hyflag.w
				drop = hyflag.p.length + p.length - glue.length
				if (drop)
					w -= strwh(hyflag.p.slice(-drop))[0]
				p = glue
			}
			set_hy(ln)			// (set or reset)
			if (ln)
				continue
		}
		lastx = x0
		out_ly(s, w, p)
		x0 += w
	}
	if (hyflag.s) {
		out_ly(hyflag.s, hyflag.w, hyflag.p)
		lastx += hyflag.w
		x0 = realwidth - 10
		if (x0 < lastx + 10)
			x0 = lastx + 10;
		out_hyph(lastx, y, x0 - lastx, hyphen_geom(hyflag.s))
		if (p_voice.s_next && p_voice.s_next.fmt.hyphencont)
			p_voice.hy_st |= (1 << j)
	}

	/* see if any underscore in the next line */
    if (lflag) {
	for (s = p_voice.s_next; s; s = s.next) {
		if (s.type == C.NOTE) {
			if (!s.a_ly)
				break
			ly = s.a_ly[j]
			if (ly && ly.ln == 3) {		 // '_'
				if (x0 < realwidth - 15)
					x0 = realwidth - 15
			}
			break
		}
	}
	out_wln(lflag, y, x0 - lflag)
    }
}

var lyric_asc_tb = {},		// ascent per font and text
	lyric_xh_tb = {},	// x-height per font

// The beam geometry of draw_beams(), which the clearance between the music and
// the lyrics is measured in: the deepest ink of a line sets the lyric plane for
// the whole line, one beam gap above the top of the letters.
//
// draw_beams() advances BEAM_PITCH from beam to beam and divides BEAM_TH by the
// graphic scale, so the gap it draws is BEAM_PITCH - BEAM_TH / scale in the
// staff's own units.  Lyrics are laid out unscaled, and that gap converts as
// (BEAM_PITCH - BEAM_TH / scale) * scale, hence beam_gap() below.  Both are 1.7
// at the default scale.
	BEAM_PITCH = 3.5,	// draw_beams(): bshift
	BEAM_TH = 1.8		// draw_beams(): bh

// -- the gap between two beams, in the unscaled units the lyrics are set in --
function beam_gap(p_voice) {
    var	g = BEAM_PITCH * (p_voice.scale || 1)
			* staff_tb[p_voice.st].staffscale - BEAM_TH

	// abc2svg keeps the beams a constant thickness however small the staff,
	// so under about .52 they would touch; no negative clearance from that
	return g > 0 ? g : 0
} // beam_gap()

// -- baseline to the top of the letters actually present --
// Measure each system's first stanza instead of reserving an accented capital
// on every line. Marked-up strings retain the conservative sample; without
// canvas metrics, retain the headless .78 line-height fallback.
function lyric_ascent(font, a_h, str) {
    var	c, m,
	f = st_font(font),
	t = str && !/[<&]/.test(str) ? str.toString() : "\u00c1y",
	key = f + "\n" + t,
	r = lyric_asc_tb[key]

	if (r != undefined)
		return r
	r = a_h * .78
	if (typeof document != "undefined" && document.createElement) {
	    try {
		c = document.createElement("canvas").getContext("2d");
		c.font = f;
		m = c.measureText(t)
		if (m.actualBoundingBoxAscent)
			r = m.actualBoundingBoxAscent
		else if (m.fontBoundingBoxAscent)
			r = m.fontBoundingBoxAscent

		// cache only a really loaded face, so that a render started
		// while a webfont is in flight cannot pin the fallback metrics
		if (document.fonts && document.fonts.check(f))
			lyric_asc_tb[key] = r
	    } catch (e) {
	    }
	}
	return r
} // lyric_ascent()

// -- baseline to the top of the lower-case letters --
// Where the hyphen between two syllables is hung: %%lyrichyphenpos counts from
// the baseline in x-heights, so .5 puts the stroke across the middle of the
// letters it stands between and 1 on top of them.  A face's x-height is a real
// measurement and not a fixed part of the body - .44 of it in Times, .55 in
// Merriweather - so a hyphen reckoned in x-heights sits in the same place in
// the letters of any face, where one reckoned in the body would ride up and
// down with the face.
// (measured in a browser - elsewhere, Times' own .45, which is the face the
//  string widths fall back to as well)
function lyric_xheight(font) {
    var	c, m,
	f = st_font(font),
	r = lyric_xh_tb[f]

	if (r != undefined)
		return r
	r = font.size * .45
	if (typeof document != "undefined" && document.createElement) {
	    try {
		c = document.createElement("canvas").getContext("2d");
		c.font = f;
		m = c.measureText("x")
		if (m.actualBoundingBoxAscent)
			r = m.actualBoundingBoxAscent

		// cache only a really loaded face, so that a render started
		// while a webfont is in flight cannot pin the fallback metrics
		if (document.fonts && document.fonts.check(f))
			lyric_xh_tb[f] = r
	    } catch (e) {
	    }
	}
	return r
} // lyric_xheight()

function draw_lyrics(p_voice, nly, a_h, y,
				incr,	/* 1: below, -1: above */
				std) {	/* a lyric voice is already under the staff */
	var	j, top, asc, yg, yl, s, ly,
		sc = staff_tb[p_voice.st].staffscale,
		lsf = tsfirst.fmt.lyricskipfac,		// between lyric lines
		lff = tsfirst.fmt.lyricfirstskipfac	// clearance, in beam gaps

// (0 is a meaningful setting for either - the letters then touch what they
//  clear - so test for the value being there, not for it being true)
	if (lsf == undefined)
		lsf = 1.2
	if (lff == undefined)
		lff = 1

	set_font("vocal")
	if (incr > 0) {				/* under the staff */
		if (std) {

			// the incoming y is the previous voice's lyrics, not
			// the music: stack under them with a full advance
			y *= sc;
			y -= a_h[0] * lff
		} else {

			// Pair each syllable's ascent with the music over its own
			// horizontal span, then take the lowest required baseline.
			// A tall letter elsewhere must not add height under a stem
			// that only overlaps a shorter syllable.
			yl = -tsfirst.fmt.vocalspace * sc
			yg = Infinity
			for (s = p_voice.sym; s; s = s.next) {
				ly = s.a_ly && s.a_ly[0]
				if (!ly || ly.ln >= 2)
					continue
				asc = lyric_ascent(ly.font, ly.t.wh[1], ly.t)
				top = y_get(p_voice.st, 0,
					s.x - ly.shift, ly.t.wh[0], true) * sc
				yg = Math.min(yg, Math.min(yl, top) - asc)
			}
			if (yg == Infinity)
				yg = Math.min(yl, y * sc)
					- lyric_ascent(gene.curfont, a_h[0])
			y = yg - lff * beam_gap(p_voice) - a_h[0] * .22
		}
		for (j = 0; j < nly; j++) {
			if (j)
				y -= a_h[j] * lsf;
			draw_lyric_line(p_voice, j,
				y + a_h[j] * .22)	// (descent)
		}
		return y / sc
	}

	/* above the staff */
	top = staff_tb[p_voice.st].topbar + tsfirst.fmt.vocalspace
	if (y < top)
		y = top;
	y *= sc
	for (j = nly; --j >= 0;) {
		draw_lyric_line(p_voice, j, y + a_h[j] * .22)
		y += a_h[j] * lsf
	}
	return y / sc
}

// -- draw all the lyrics --
/* (the staves are not yet defined) */
function draw_all_lyrics() {
	var	p_voice, s, v, nly, i, x, y, w, a_ly, ly,
		lyst_tb = new Array(nstaff + 1),
		nv = voice_tb.length,
		h_tb = new Array(nv),
		nly_tb = new Array(nv),
		above_tb = new Array(nv),
		rv_tb = new Array(nv),
		top = 0,
		bot = 0,
		st = -1

	/* compute the number of lyrics per voice - staff
	 * and their y offset on the staff */
	for (v = 0; v < nv; v++) {
		p_voice = voice_tb[v]
		if (!p_voice.sym)
			continue
		if (p_voice.st != st) {
			top = 0;
			bot = 0;
			st = p_voice.st
		}
		nly = 0
		if (p_voice.have_ly) {
			if (!h_tb[v])
				h_tb[v] = []
			for (s = p_voice.sym; s; s = s.next) {
				a_ly = s.a_ly
				if (!a_ly)
					continue
/*fixme:should get the real width*/
				x = s.x;
				w = 10
				for (i = 0; i < a_ly.length; i++) {
					ly = a_ly[i]
					if (ly) {
						x -= ly.shift;
						w = ly.t.wh[0]
						break
					}
				}
				y = y_get(p_voice.st, 1, x, w)
				if (top < y)
					top = y;
				y = y_get(p_voice.st, 0, x, w, true)
				if (bot > y)
					bot = y
				while (nly < a_ly.length)
					h_tb[v][nly++] = 0
				for (i = 0; i < a_ly.length; i++) {
					ly = a_ly[i]
					if (!ly)
						continue
					if (!h_tb[v][i]
					 || ly.t.wh[1] > h_tb[v][i])
						h_tb[v][i] = ly.t.wh[1]
				}
			}
		} else {
			y = y_get(p_voice.st, 1, 0, realwidth)
			if (top < y)
				top = y;
			y = y_get(p_voice.st, 0, 0, realwidth, true)
			if (bot > y)
				bot = y
		}
		if (!lyst_tb[st])
			lyst_tb[st] = {}
		lyst_tb[st].top = top;
		lyst_tb[st].bot = bot;
		nly_tb[v] = nly
		if (nly == 0)
			continue
		if (p_voice.pos.voc)
			above_tb[v] = (p_voice.pos.voc & 0x07) == C.SL_ABOVE
		else if (voice_tb[v + 1]
/*fixme:%%staves:KO - find an other way..*/
		      && voice_tb[v + 1].st == st
		      && voice_tb[v + 1].have_ly)
			above_tb[v] = true
		else
			above_tb[v] = false
		if (above_tb[v])
			lyst_tb[st].a = true
		else
			lyst_tb[st].b = true
	}

	/* draw the lyrics under the staves */
	i = 0
	for (v = 0; v < nv; v++) {
		p_voice = voice_tb[v]
		if (!p_voice.sym)
			continue
		if (!p_voice.have_ly)
			continue
		if (above_tb[v]) {
			rv_tb[i++] = v
			continue
		}
		st = p_voice.st;
// don't scale the lyrics
		set_dscale(st, true)
		if (nly_tb[v] > 0) {
			lyst_tb[st].bot = draw_lyrics(p_voice, nly_tb[v],
							h_tb[v],
							lyst_tb[st].bot, 1,
							lyst_tb[st].lyd);
			lyst_tb[st].lyd = 1
		}
	}

	/* draw the lyrics above the staff */
	while (--i >= 0) {
		v = rv_tb[i];
		p_voice = voice_tb[v];
		st = p_voice.st;
		set_dscale(st, true);
		lyst_tb[st].top = draw_lyrics(p_voice, nly_tb[v],
						h_tb[v],
						lyst_tb[st].top, -1)
	}

	/* set the max y offsets of all symbols */
	for (v = 0; v < nv; v++) {
		p_voice = voice_tb[v]
		if (!p_voice.sym)
			continue
		st = p_voice.st;
		if (lyst_tb[st].a) {
			top = lyst_tb[st].top + 2
			for (s = p_voice.sym; s; s = s.next) {
/*fixme: may have lyrics crossing a next symbol*/
				if (s.a_ly) {
/*fixme:should set the real width*/
					y_set(st, 1, s.x - 2, 10, top)
				}
			}
		}
		if (lyst_tb[st].b) {
			bot = lyst_tb[st].bot - 2
			if (nly_tb[p_voice.v] > 0) {
				for (s = p_voice.sym; s; s = s.next) {
					if (s.a_ly) {
/*fixme:should set the real width*/
						y_set(st, 0, s.x - 2, 10, bot)
					}
				}
			} else {
				y_set(st, 0, 0, realwidth, bot)
			}
		}
	}
}
