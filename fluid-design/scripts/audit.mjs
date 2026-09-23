#!/usr/bin/env node
// audit.mjs — static scanner for a fluid-design codebase (greenfield or
// brownfield). Every finding carries a rule id, file:line, the offending
// snippet, a one-line why, and a fix. This is a regex/heuristic scanner, not
// a type-checker: it is deliberately conservative (false negatives over
// false positives) because a noisy linter gets ignored.
//
// Usage:
//   node audit.mjs [srcDir] [--engage lg] [--json]
//   node audit.mjs --selftest
//
// srcDir defaults to "." (the current directory / project root) -- walk()
// already skips node_modules, .git, .next, dist, build, .turbo, .cache and
// out, so running with no argument from a project root is the normal case,
// not just "src/".
//
// Exit codes: 0 = no error-severity findings, 1 = at least one error-severity
// finding, 2 = usage/invocation error.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname_ = fileURLToPath(new URL('.', import.meta.url))

// ── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { _: [], engage: 'lg', json: false, selftest: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') out.json = true
    else if (a === '--selftest') out.selftest = true
    else if (a === '--engage') out.engage = argv[++i]
    else if (a.startsWith('--')) { console.error(`[audit] unknown flag ${a}`); process.exit(2) }
    else out._.push(a)
  }
  return out
}

// ── file walking ────────────────────────────────────────────────────────

const SCAN_EXT = new Set(['.tsx', '.jsx', '.ts', '.js', '.css', '.scss', '.html', '.vue', '.astro'])
const SKIP_DIR = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.cache', 'out'])

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (e.isFile() && SCAN_EXT.has(extname(e.name))) acc.push(p)
  }
  return acc
}

function lineOf(content, index) {
  let line = 1
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++
  return line
}

function snippetAt(content, index, matchLen) {
  const start = content.lastIndexOf('\n', index) + 1
  let end = content.indexOf('\n', index + matchLen)
  if (end === -1) end = content.length
  return content.slice(start, end).trim().slice(0, 160)
}

// Blank out comments before any rule sees the content, so a rule pattern
// mentioned in prose (a `//` explainer, a JSX `{/* ... */}` aside, a CSS/JS
// docblock) never counts as a hit. Every masked character becomes a space
// EXCEPT newlines, which are kept as-is -- so `.length`, every index, and
// therefore every line number stay identical to the original. `//` and `/*`
// inside a string or template literal (a URL like `https://…`) are not
// comment starts: the state machine tracks string/template state and only
// treats `//`/`/*` as comments while in plain code.
//
// `blankStrings` (used for .css/.scss, where a rule pattern quoted inside a
// Sass @error message string is otherwise readable to every rule below --
// see rule `length-times-unit`'s false positive on the generator's own
// `_fluid-assert-unitless` @error text, `64px * var(--fluid)`) also blanks
// the CONTENT of string/template literals, not just skips over it. This is
// deliberately NOT done for .tsx/.jsx/.html -- several rules there (img-svg,
// video-attrs, dark-variant) need to read attribute string content itself.
function maskComments(content, { blankStrings = false } = {}) {
  const chars = Array.from(content)
  const n = chars.length
  let i = 0
  let state = 'code' // code | line | block | sq | dq | tpl | html
  while (i < n) {
    const c = chars[i]
    const c2 = i + 1 < n ? chars[i + 1] : ''
    if (state === 'code') {
      if (c === '/' && c2 === '/') { chars[i] = ' '; chars[i + 1] = ' '; state = 'line'; i += 2; continue }
      if (c === '/' && c2 === '*') { chars[i] = ' '; chars[i + 1] = ' '; state = 'block'; i += 2; continue }
      if (c === '<' && chars.slice(i, i + 4).join('') === '<!--') {
        for (let k = 0; k < 4; k++) chars[i + k] = ' '
        state = 'html'
        i += 4
        continue
      }
      if (c === "'") { state = 'sq'; i++; continue }
      if (c === '"') { state = 'dq'; i++; continue }
      if (c === '`') { state = 'tpl'; i++; continue }
      i++
      continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; i++; continue }
      chars[i] = ' '
      i++
      continue
    }
    if (state === 'block') {
      if (c === '*' && c2 === '/') { chars[i] = ' '; chars[i + 1] = ' '; state = 'code'; i += 2; continue }
      if (c !== '\n') chars[i] = ' '
      i++
      continue
    }
    if (state === 'html') {
      if (c === '-' && chars.slice(i, i + 3).join('') === '-->') {
        chars[i] = ' '; chars[i + 1] = ' '; chars[i + 2] = ' '; state = 'code'; i += 3; continue
      }
      if (c !== '\n') chars[i] = ' '
      i++
      continue
    }
    if (state === 'sq' || state === 'dq') {
      const quote = state === 'sq' ? "'" : '"'
      if (c === '\\') { if (blankStrings) { chars[i] = ' '; chars[i + 1] = ' ' } i += 2; continue }
      if (c === quote) { state = 'code'; i++; continue }
      if (c === '\n') { state = 'code'; i++; continue } // unterminated -- bail safely, don't eat the rest of the file
      if (blankStrings) chars[i] = ' '
      i++
      continue
    }
    if (state === 'tpl') {
      // Comments cannot start inside a template literal's static text, and we
      // don't attempt to parse `${...}` interpolations separately -- a `//`
      // or `/*` written inside one would be a very unusual thing to write and
      // is not worth the added state for.
      if (c === '\\') { if (blankStrings) { chars[i] = ' '; chars[i + 1] = ' ' } i += 2; continue }
      if (c === '`') { state = 'code'; i++; continue }
      if (blankStrings) chars[i] = ' '
      i++
      continue
    }
    i++
  }
  return chars.join('')
}

// ── repo-wide context (facts a single-file scan cannot know) ─────────────

function buildContext(files, contents) {
  let hasCustomVariantDark = false
  let hasZeroRadiusToken = false
  let hasLazyMotionStrict = false
  let hasSmoothScrollBehavior = false

  for (const f of files) {
    const ext = extname(f)
    const c = contents.get(f)
    if (ext === '.css' || ext === '.scss') {
      if (/@custom-variant\s+dark\b/.test(c)) hasCustomVariantDark = true
      if (/--radius-[\w-]*\s*:\s*0\b/.test(c)) hasZeroRadiusToken = true
      // Anywhere, not just on html/:root -- scroll-behavior only meaningfully
      // applies to the scrolling root, and this skill's own shared/base.css
      // sets it there. False positives on an unrelated element's rule are
      // harmless: the finding below is informational, not an error.
      if (/scroll-behavior\s*:\s*smooth\b/.test(c)) hasSmoothScrollBehavior = true
    }
    if (/<LazyMotion\b[^>]*\bstrict\b/.test(c)) hasLazyMotionStrict = true
  }

  return { hasCustomVariantDark, hasZeroRadiusToken, hasLazyMotionStrict, hasSmoothScrollBehavior }
}

// ── rule helpers ────────────────────────────────────────────────────────

function pushFinding(acc, { rule, file, content, index, matchLen, severity, why, fix }) {
  acc.push({
    rule,
    file,
    line: lineOf(content, index),
    snippet: snippetAt(content, index, matchLen),
    severity,
    why,
    fix
  })
}

// Extract className="...", className='...' or className={`...`} bodies with
// their offset in the file, so downstream rules can reason about "one
// className string literal" per the contract's wording.
function extractClassNames(content) {
  const out = []
  const re = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g
  let m
  while ((m = re.exec(content))) {
    const value = m[1] ?? m[2] ?? m[3] ?? ''
    out.push({ value, index: m.index, matchLen: m[0].length })
  }
  return out
}

// Extract top-level JSX-ish tags (from `<Tag` to its `>`), non-nesting, for
// rules that need "does this one opening tag carry both X and Y".
function extractTags(content) {
  const out = []
  const re = /<[A-Za-z][\w.]*(?:\s[^<>]*?)?\/?>/g
  let m
  while ((m = re.exec(content))) out.push({ text: m[0], index: m.index })
  return out
}

// ── rules ───────────────────────────────────────────────────────────────
// Each rule: { id, ext: (extname)=>bool, run(content, file, ctx, acc, opts) }

// Sorted longest-first so alternation can't shadow a more specific family
// with a shorter prefix of it (e.g. `gap` swallowing `gap-x`/`gap-y`, or `m`
// swallowing `min-w`) -- regex alternation takes the first alternative that
// lets the rest of the pattern match, not the longest one, so order matters.
const PROP_FAMILIES = ['p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'gap', 'gap-x', 'gap-y', 'w', 'h', 'size', 'min-h', 'min-w', 'max-h', 'top', 'left', 'right', 'bottom', 'inset', 'text']
const PROP_CORE = [...PROP_FAMILIES].sort((a, b) => b.length - a.length).join('|')

const rules = [
  {
    id: 'fixed-px-at-engage',
    ext: (e) => ['.tsx', '.jsx', '.vue', '.astro', '.html'].includes(e),
    run(content, file, ctx, acc, opts) {
      const engage = opts.engage
      const core = new RegExp(`\\b${engage}:(${PROP_CORE})-\\[(\\d+(?:\\.\\d+)?)px\\]`, 'g')
      let m
      while ((m = core.exec(content))) {
        const value = Number(m[2])
        if (value <= 2) {
          // A hairline seam (e.g. a 1-2px gap standing in for a border) is a
          // deliberate exclusion in the same family as border/stroke widths:
          // a scaled hairline blurs rather than reading as a crisp line, so
          // this is a judgement call, not the bug the rule otherwise catches.
          pushFinding(acc, {
            rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'info',
            why: 'A hairline-scale value (≤ 2px) is likely standing in for a border/seam. Scaled, a hairline blurs rather than staying crisp -- the same reason border/stroke widths are off the scale.',
            fix: `If this is genuinely a layout gap that should grow with the viewport, use ${engage}:${opts.prefix}-${m[1]}-${m[2]}; if it's a seam/hairline, leave it fixed.`
          })
          continue
        }
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'error',
          why: `A fixed px value on a ${engage}: property does not answer to the viewport — it is the exact bug the fluid scale exists to prevent (see fluid-scale.md §1).`,
          fix: `Write the drawn number through the fluid utility: ${engage}:${opts.prefix}-${m[1]}-${m[2]} (or the matching --fluid-display/--fluid-copy twin if this is type inside a fixed-width box).`
        })
      }
      // Deliberate exclusions (info, not error): border/stroke widths, radii,
      // tracking, and max-w-* text measures are off the scale on purpose.
      const allow = new RegExp(`\\b${engage}:(border(-[tlbrxy])?|stroke|rounded(-\\w+)?|tracking|max-w)-\\[(-?\\d+(?:\\.\\d+)?)(px|em)?\\]`, 'g')
      while ((m = allow.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'info',
          why: 'Deliberately off the fluid scale: border/stroke widths, radii, tracking and max-w-* text measures are excluded per fluid-scale.md §4.',
          fix: 'No action needed unless this value was meant to scale — if so it belongs on a different property family.'
        })
      }
    }
  },

  {
    // The SCSS/vanilla-CSS twin of `fixed-px-at-engage`: on those stacks
    // there is no `lg:` class string to grep for, so the same mistake
    // (a fixed px value that should have answered to the viewport) instead
    // shows up as a bare `Npx` INSIDE an engaged block -- a `@include
    // fluid-up { }` (or any `<prefix>-up` mixin) body, or a plain
    // `@media (width >= Npx)` / `(min-width: Npx)` block. Without this, "0
    // errors" from a SCSS/vanilla project said almost nothing about the one
    // thing this skill most wants checked (measured: entirely blind on a
    // real SCSS+GSAP build).
    id: 'fixed-px-at-engage-scss',
    ext: (e) => ['.css', '.scss'].includes(e),
    run(content, file, ctx, acc) {
      const openers = [
        /@include\s+[\w.$-]*-up\s*\{/g,
        /@media\s*\(\s*(?:width\s*>=|min-width\s*:)\s*\d+(?:\.\d+)?px\s*\)\s*\{/g
      ]
      const ranges = []
      for (const re of openers) {
        re.lastIndex = 0
        let om
        while ((om = re.exec(content))) {
          let depth = 1
          let i = om.index + om[0].length
          while (i < content.length && depth > 0) {
            if (content[i] === '{') depth++
            else if (content[i] === '}') depth--
            i++
          }
          ranges.push([om.index + om[0].length, i - 1])
        }
      }
      if (ranges.length === 0) return
      const inRange = (idx) => ranges.some(([s, e]) => idx >= s && idx < e)

      // Same family list as fixed-px-at-engage's PROP_CORE, spelled as real
      // CSS property names rather than Tailwind class fragments. Values
      // <= 2px are the same deliberate hairline exclusion; border/radius/
      // letter-spacing are never matched because they are not in this list.
      const propRe = /\b(padding(?:-(?:inline|block)?(?:-(?:start|end))?|-top|-bottom|-left|-right)?|margin(?:-(?:inline|block)?(?:-(?:start|end))?|-top|-bottom|-left|-right)?|gap|row-gap|column-gap|width|height|min-width|min-height|max-width|max-height|top|left|right|bottom|inset|font-size|line-height)\s*:\s*(-?\d+(?:\.\d+)?)px\b/g
      let m
      while ((m = propRe.exec(content))) {
        if (!inRange(m.index)) continue
        const value = Math.abs(Number(m[2]))
        if (value <= 2) {
          pushFinding(acc, {
            rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'info',
            why: 'A hairline-scale value (≤ 2px) is likely standing in for a border/seam -- the same deliberate exclusion fixed-px-at-engage makes for Tailwind.',
            fix: 'If this is genuinely a layout value that should grow with the viewport, scale it; if it is a seam/hairline, leave it fixed.'
          })
          continue
        }
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'error',
          why: `A fixed px value on "${m[1]}" inside an engaged block (an @include *-up mixin, or an @media width>=/min-width engage query) does not answer to the viewport -- the SCSS/CSS-stack form of the bug fixed-px-at-engage catches for Tailwind (fluid-scale.md §1).`,
          fix: `Route the drawn number through the fluid function: ${m[1]}: fluid(${m[2]}) (or fluid-display()/fluid-copy() for font-size/line-height).`
        })
      }
    }
  },

  {
    id: 'length-times-unit',
    ext: (e) => ['.css', '.scss', '.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc) {
      // Literal length * var(--fluid...) is invalid regardless of anything
      // else — a number-with-unit times a length is not a valid calc().
      const literalRe = /\d+(?:\.\d+)?(px|rem|em)\s*\*\s*var\(--[\w-]*fluid[\w-]*/g
      let m
      while ((m = literalRe.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'error',
          why: 'A length (has a unit) multiplied by another length inside calc() is invalid CSS. The custom property goes guaranteed-invalid and the declaration silently reverts to its initial value (fluid-scale.md §4).',
          fix: 'The multiplied number must be unitless: store it as a bare number custom property (e.g. --mark-h-n: 64;) and multiply that, not a px/rem/em length.'
        })
      }

      // var(--x) * var(--fluid...) — only an error if --x is assigned a px
      // (or rem/em) value ANYWHERE in this file; a unitless assignment is fine.
      const varRe = /var\((--[\w-]+)\)\s*\*\s*var\(--[\w-]*fluid[\w-]*/g
      while ((m = varRe.exec(content))) {
        const varName = m[1]
        if (/--fluid/.test(varName)) continue // multiplying two fluid units together is a different concern
        const assignRe = new RegExp(`${varName.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\s*:\\s*['"]?(-?\\d+(?:\\.\\d+)?)(px|rem|em)['"]?`)
        const assign = content.match(assignRe)
        if (assign) {
          pushFinding(acc, {
            rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'error',
            why: `${varName} is assigned a px/rem/em length elsewhere in this file, so this multiplication is a length times a length — invalid, and the declaration silently goes guaranteed-invalid (fluid-scale.md §4, the footer compliance-row bug).`,
            fix: `Store ${varName} as a bare unitless number (drop the ${assign[2]}) if it is only ever multiplied by a fluid unit, or keep two tokens — one px twin for below-lg, one bare-number twin for the multiplication.`
          })
        }
      }
    }
  },

  {
    id: 'dvh-on-scaled',
    ext: (e) => ['.css', '.scss', '.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc) {
      const re = /dvh\b/g
      let m
      while ((m = re.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'warn',
          why: 'dvh resizes mid-scroll as mobile chrome collapses/expands, which recomputes type and layout over a scrubbed video or pin — the worst possible surface for a resize (fluid-scale.md §2).',
          fix: 'Use svh for the fluid scale itself, or lvh specifically for a pin that must not shrink under a collapsing toolbar.'
        })
      }
    }
  },

  {
    id: 'overflow-hidden-x',
    ext: (e) => ['.css', '.scss', '.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc) {
      const re = /overflow-x-hidden|overflow-x\s*:\s*hidden/g
      let m
      while ((m = re.exec(content))) {
        const lineText = snippetAt(content, m.index, m[0].length)
        if (/<html[\s>]/.test(lineText)) continue // the one allowed place
        // CSS: skip when the nearest enclosing selector is exactly `html` or `:root`.
        const before = content.slice(0, m.index)
        const openBrace = before.lastIndexOf('{')
        if (openBrace !== -1) {
          const selStart = before.lastIndexOf('}', openBrace) + 1
          const selector = before.slice(selStart, openBrace).trim()
          if (/^(html|:root)$/.test(selector)) continue
        }
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'warn',
          why: 'overflow-x:hidden on an ancestor makes the other axis compute to auto, turning that ancestor into a scroll container with zero range — it silently kills every sticky pin beneath it (motion-design-system.md §8).',
          fix: 'Use overflow-x: clip instead (or overflow: clip on both axes), and keep overflow-x:hidden reserved for the root html rule only.'
        })
      }
    }
  },

  {
    id: 'dark-variant',
    ext: (e) => ['.tsx', '.jsx', '.css', '.scss', '.vue', '.astro', '.html'].includes(e),
    run(content, file, ctx, acc) {
      if (ctx.hasCustomVariantDark) return
      // A Tailwind variant, not an object key: preceded by start-of-string,
      // whitespace, a quote or a backtick (so it's sitting inside a class
      // string, not `dark: {` or `dark: 'brightness-0 invert'`), and
      // immediately followed by a utility character with no space after the
      // colon.
      const re = /(?<=^|[\s"'`])dark:(?=[a-z!\[-])/g
      let m
      while ((m = re.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'warn',
          why: 'No @custom-variant dark is declared anywhere in this project\'s CSS, so dark: silently becomes a prefers-color-scheme media query that fires for any visitor on a dark system theme rather than a deliberate dark mode (fluid-scale.md tokens trap list).',
          fix: 'Declare @custom-variant dark in the stylesheet if a real dark mode is intended, or remove the dark: variant if it was not.'
        })
      }
    }
  },

  {
    id: 'rounded-with-zero-token',
    ext: (e) => ['.tsx', '.jsx', '.vue', '.astro', '.html'].includes(e),
    run(content, file, ctx, acc) {
      if (!ctx.hasZeroRadiusToken) return
      const re = /\brounded(-(?:sm|md|lg|xl|2xl|3xl|full))?\b/g
      let m
      while ((m = re.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'info',
          why: 'A --radius-*: 0 token is defined in this project. That ADDS a zero-radius utility; it does not reset the rounded-* scale, so this class still rounds.',
          fix: 'Use the zero-radius utility/token explicitly if a square corner is intended, rather than relying on rounded-* resolving to zero.'
        })
      }
    }
  },

  {
    id: 'motion-strict',
    ext: (e) => ['.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc) {
      if (!ctx.hasLazyMotionStrict) return
      const re = /\bmotion\.[a-z]+/g
      let m
      while ((m = re.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'error',
          why: 'LazyMotion with strict is present in this project. Under strict mode, motion.* throws at runtime — only the m namespace is permitted.',
          fix: `Import m from motion/react and use m.${m[0].split('.')[1]} instead of ${m[0]}.`
        })
      }
    }
  },

  {
    // A page-wide `scroll-behavior: smooth` (the shared base layer sets this
    // on `html` by default) means the scroll well's own per-frame
    // `behavior: 'instant'` writes cancel any smooth scroll passing through
    // its target one rAF at a time -- an anchor click that should land 900px
    // further away instead stalls at the well (references/scroll-scenes.md
    // §8; `verify-matrix.mjs --reveal` failed in every cell this way on a
    // real build). Both engines' scrollPull now suspend automatically on a
    // same-page hash click/hashchange, and expose `suspend(ms)` for a
    // caller driving its own programmatic scroll -- this rule is
    // informational, not an error, as a reminder to call it for any OTHER
    // kind of scroll (a router push, an imperative scrollIntoView outside a
    // click handler) that would not be caught by those two listeners.
    id: 'scroll-well-vs-smooth-scroll',
    ext: (e) => ['.tsx', '.jsx', '.vue', '.astro', '.html'].includes(e),
    run(content, file, ctx, acc) {
      if (!ctx.hasSmoothScrollBehavior) return
      const re = /<PullToCentre\b|\bdata-pull-to-centre\b|\bcreateScrollPull\s*\(|\binitPullToCentre\s*\(/g
      let m
      while ((m = re.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'info',
          why: 'This project sets scroll-behavior: smooth somewhere and also uses a scroll well (PullToCentre/scrollPull). The well auto-suspends for a same-page hash click and hashchange, but any OTHER programmatic/smooth scroll (a router navigation, an imperative scrollIntoView outside a click handler) that passes through the well\'s target will still be cancelled one rAF at a time unless you call suspend() around it (references/scroll-scenes.md §8).',
          fix: 'Call the returned controller\'s suspend(ms) immediately before driving any scroll of your own through this target, or confirm the only programmatic scrolls in this tree are same-page hash clicks/hashchange, which are already covered automatically.'
        })
      }
    }
  },

  {
    id: 'fractional-amount',
    ext: (e) => ['.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc) {
      const blockRe = /\b(whileInView|viewport)\s*=\s*\{\{([^]*?)\}\}/g
      let bm
      while ((bm = blockRe.exec(content))) {
        const amountRe = /amount\s*:\s*0?\.\d+/g
        let am
        while ((am = amountRe.exec(bm[2]))) {
          const index = bm.index + bm[0].indexOf(am[0], bm[1].length)
          pushFinding(acc, {
            rule: this.id, file, content, index, matchLen: am[0].length, severity: 'warn',
            why: 'A fractional viewport.amount is unsatisfiable once the element is taller than the viewport — the trigger can never see that fraction of the element at once, so it never fires on tall content (motion-design-system.md §8).',
            fix: 'Use amount: "some" for a coarse trigger, or drive the reveal from a margin-based rootMargin instead of a fraction.'
          })
        }
      }
    }
  },

  {
    id: 'contents-reveal',
    ext: (e) => ['.tsx', '.jsx', '.css', '.scss'].includes(e),
    run(content, file, ctx, acc) {
      const ext = extname(file)
      if (ext === '.css' || ext === '.scss') {
        const re = /display\s*:\s*contents\b/g
        let m
        while ((m = re.exec(content))) {
          pushFinding(acc, {
            rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'error',
            why: 'display: contents generates no box, so IntersectionObserver has nothing to observe. If the element carrying this rule also has whileInView, data-stage or is a Stage, its reveal never fires (motion-design-system.md §8).',
            fix: 'Give the element a real box (e.g. display: flex/block) or move the reveal trigger to an ancestor that does generate one.'
          })
        }
        return
      }
      for (const tag of extractTags(content)) {
        const hasContents = /\bcontents\b/.test(tag.text) && /className\s*=/.test(tag.text)
        if (!hasContents) continue
        const hasTrigger = /whileInView|data-stage\b|<Stage\b/.test(tag.text)
        if (!hasTrigger) continue
        pushFinding(acc, {
          rule: this.id, file, content, index: tag.index, matchLen: tag.text.length, severity: 'error',
          why: 'This element carries a contents class alongside a reveal trigger (whileInView/data-stage/Stage). display: contents generates no box, so the trigger never fires — a whole stat grid has shipped stuck at opacity 0 this way.',
          fix: 'Drop contents from this element, or move whileInView/data-stage to a wrapping element that keeps a real box.'
        })
      }
    }
  },

  {
    id: 'img-svg',
    ext: (e) => ['.tsx', '.jsx', '.vue', '.astro', '.html'].includes(e),
    run(content, file, ctx, acc) {
      const re = /<img\b[^>]*\bsrc\s*=\s*["'{][^"'}]*\.svg["'}]?[^>]*>/g
      let m
      while ((m = re.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'warn',
          why: 'An <img src="…svg"> does not paint reliably in Safari (clipPath, caching) and cannot be styled with currentColor.',
          fix: 'Import the SVG as a component (svgr) and render it inline instead of through an <img> tag.'
        })
      }
    }
  },

  {
    id: 'video-attrs',
    ext: (e) => ['.tsx', '.jsx', '.vue', '.astro', '.html'].includes(e),
    run(content, file, ctx, acc) {
      const re = /<video\b[^>]*>/gi
      let m
      while ((m = re.exec(content))) {
        const tag = m[0]
        const missing = []
        if (!/\bmuted\b/.test(tag)) missing.push('muted')
        if (!/\bplaysInline\b/i.test(tag)) missing.push('playsInline')
        if (!/\bpreload\s*=/.test(tag)) missing.push('preload')
        if (missing.length === 0) continue
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'warn',
          why: `Missing ${missing.join(', ')}. Autoplay/scrub video needs all three to behave consistently across browsers (muted+playsInline for iOS autoplay, preload to control initial buffering).`,
          fix: `Add the missing attribute(s): ${missing.join(', ')}.`
        })
      }
    }
  },

  {
    id: 'double-fluid-same-prop',
    ext: (e) => ['.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc) {
      for (const cls of extractClassNames(content)) {
        const seen = new Map()
        const re = new RegExp(`\\blg:${'fluid'}-(${PROP_CORE})-`, 'g')
        let m
        while ((m = re.exec(cls.value))) {
          const family = m[1]
          if (!seen.has(family)) seen.set(family, [])
          seen.get(family).push(m[0])
        }
        for (const [family, hits] of seen) {
          if (hits.length < 2) continue
          pushFinding(acc, {
            rule: this.id, file, content, index: cls.index, matchLen: cls.value.length, severity: 'warn',
            why: `Two lg:fluid-${family}-* classes appear in one className string literal (${hits.join(', ')}...). A plain string never passes through cn(), so stylesheet order — not intent — decides which wins (fluid-scale.md §8.6).`,
            fix: `Keep one lg:fluid-${family}-* per className literal, or route the value through cn() so the later call wins deterministically.`
          })
        }
      }
    }
  },

  {
    // Tailwind v4 sorts breakpoint variants by comparing their `--breakpoint-*`
    // lengths and cannot compare px against rem. A project that overrides only
    // SOME of the standard rungs (typically just `lg`, to match `engageAt`) in
    // px while the rest stay on Tailwind's rem defaults gets its whole `lg:`
    // block sorted before `sm:` regardless of pixel width -- see
    // references/stacks.md and tokens-and-theming.md's trap list. This rule
    // flags either symptom statically: mixed units across the declared
    // `--breakpoint-*` tokens in one file, or a px override that covers only
    // part of the standard sm/md/lg/xl/2xl set (the rest silently fall back
    // to rem).
    id: 'tw-breakpoint-units',
    ext: (e) => ['.css', '.scss'].includes(e),
    run(content, file, ctx, acc) {
      const re = /--breakpoint-([\w-]+)\s*:\s*(-?\d+(?:\.\d+)?)(px|rem|em)\b/g
      const found = new Map() // name -> unit
      const matches = []
      let m
      while ((m = re.exec(content))) {
        found.set(m[1], m[3])
        matches.push({ name: m[1], unit: m[3], index: m.index, len: m[0].length })
      }
      if (matches.length === 0) return

      const STANDARD = ['sm', 'md', 'lg', 'xl', '2xl']
      const units = new Set(found.values())
      const definedStandard = STANDARD.filter((n) => found.has(n))
      const missingStandard = STANDARD.filter((n) => !found.has(n))
      const mixedUnits = units.size > 1
      const partialPx =
        !mixedUnits &&
        units.has('px') &&
        definedStandard.length > 0 &&
        missingStandard.length > 0

      if (!mixedUnits && !partialPx) return

      const first = matches[0]
      const why = mixedUnits
        ? `--breakpoint-* tokens mix units in this file (${[...units].sort().join(', ')}). Tailwind v4 sorts breakpoint variants by comparing their lengths and cannot compare px against rem, so the block on one unit is emitted out of min-width order relative to the other -- measured: sm:text-[64px] beat lg:fluid-display-112 because only --breakpoint-lg was in px while sm stayed on Tailwind's rem default (tokens-and-theming.md's trap list).`
        : `Only some standard breakpoints (${definedStandard.join(', ')}) are overridden in px while the rest (${missingStandard.join(', ')}) stay on Tailwind's rem defaults -- the same mixed-unit ordering bug by omission.`
      pushFinding(acc, {
        rule: this.id, file, content, index: first.index, matchLen: first.len, severity: 'error',
        why,
        fix: 'Define the FULL breakpoint ladder in one unit (px): sm 640, md 768, lg = engageAt, xl 1280, 2xl 1536 (nudge to stay monotonic if engageAt collides with a default rung). See assets/styles/tailwind-v4/fluid.css\'s generated @theme block, and references/stacks.md.'
      })
    }
  },

  {
    id: 'type-unit-mismatch',
    ext: (e) => ['.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc) {
      for (const cls of extractClassNames(content)) {
        if (!/\bfluid-display-/.test(cls.value)) continue
        if (!/\bfluid-(w|size)-/.test(cls.value)) continue
        pushFinding(acc, {
          rule: this.id, file, content, index: cls.index, matchLen: cls.value.length, severity: 'info',
          why: 'fluid-display-* (the gentle-damping type unit) sits on an element whose own box is also on fluid-w-*/fluid-size-* (the base unit). The container already scales, so the type inside it can use the steeper fluid-text-* unit instead (fluid-scale.md §5).',
          fix: 'If this box genuinely scales with the layout, prefer fluid-text-* for the type inside it; keep fluid-display-* only for type inside a fixed-width container.'
        })
      }
    }
  }
]

// ── engine ──────────────────────────────────────────────────────────────

// Any file whose header carries both these words is this skill's OWN
// generator output (`generate-fluid.mjs`'s cssHeader/scssHeader/tsHeader,
// e.g. "GENERATED by fluid-design's generate-fluid.mjs"). Skipped outright
// -- scanning generated output for hand-authoring mistakes is never
// meaningful, and its own @error message text is what produced a false
// `length-times-unit` positive before this existed. Checked against a
// prefix of the RAW file, before any masking.
const GENERATED_HEADER_RE = /generated/i
const GENERATED_SKILL_RE = /fluid-design/i
function isGeneratedFile(raw) {
  const head = raw.slice(0, 400)
  return GENERATED_HEADER_RE.test(head) && GENERATED_SKILL_RE.test(head)
}

export function scan(srcDir, opts = {}) {
  const options = { engage: opts.engage ?? 'lg', prefix: opts.prefix ?? 'fluid' }
  const files = walk(srcDir).filter((f) => !isGeneratedFile(readFileSync(f, 'utf8')))
  // Every rule sees comments blanked out (newlines preserved, so line numbers
  // are unaffected) -- a rule pattern mentioned in a docblock or JSX aside
  // must never count as a hit. Repo-wide context is built from the same
  // masked text, so a commented-out @custom-variant/radius/LazyMotion line
  // doesn't count either. .css/.scss additionally blank STRING CONTENT (not
  // just skip over it) -- see maskComments' docblock.
  const contents = new Map(
    files.map((f) => {
      const ext = extname(f)
      const blankStrings = ext === '.css' || ext === '.scss'
      return [f, maskComments(readFileSync(f, 'utf8'), { blankStrings })]
    })
  )
  const ctx = buildContext(files, contents)

  const findings = []
  for (const file of files) {
    const ext = extname(file)
    const content = contents.get(file)
    for (const rule of rules) {
      if (!rule.ext(ext)) continue
      rule.run(content, file, ctx, findings, options)
    }
  }
  return findings
}

// ── output ──────────────────────────────────────────────────────────────

function printTable(findings, root) {
  if (findings.length === 0) {
    console.log('audit: no findings.')
    return
  }
  const order = { error: 0, warn: 1, info: 2 }
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.line - b.line)
  for (const f of sorted) {
    const loc = `${relative(root, f.file)}:${f.line}`
    console.log(`[${f.severity.toUpperCase()}] ${f.rule}  ${loc}`)
    console.log(`  ${f.snippet}`)
    console.log(`  why: ${f.why}`)
    console.log(`  fix: ${f.fix}`)
    console.log('')
  }
  const counts = { error: 0, warn: 0, info: 0 }
  for (const f of findings) counts[f.severity]++
  console.log(`${findings.length} finding(s) — ${counts.error} error, ${counts.warn} warn, ${counts.info} info.`)
}

// ── selftest ────────────────────────────────────────────────────────────

function selftest() {
  const fixturesRoot = join(__dirname_, 'fixtures', 'audit')
  let pass = 0
  let fail = 0
  let caseCount = 0
  for (const rule of rules) {
    const ruleDir = join(fixturesRoot, rule.id)
    let entries
    try {
      entries = readdirSync(ruleDir, { withFileTypes: true }).filter((e) => e.isDirectory())
    } catch {
      entries = []
    }
    // Every subdirectory whose name starts with "positive" or "negative" is
    // its own isolated scan root (its own repo-wide context), which lets a
    // rule that needs more than one negative case -- e.g. "no @custom-variant
    // dark declared" vs "an object key that only looks like the variant" --
    // test them independently instead of one polarity masking the other.
    const cases = entries
      .map((e) => e.name)
      .filter((name) => name.startsWith('positive') || name.startsWith('negative'))
      .sort()
    if (cases.length === 0) {
      console.error(`[selftest] MISSING fixture dirs under: ${relative(fixturesRoot, ruleDir)}`)
      fail++
      continue
    }
    for (const name of cases) {
      caseCount++
      const dir = join(ruleDir, name)
      const findings = scan(dir, { engage: 'lg', prefix: 'fluid' })
      const hit = findings.some((f) => f.rule === rule.id)
      const expected = name.startsWith('positive')
      if (hit === expected) {
        pass++
      } else {
        fail++
        console.error(`[selftest] FAIL ${rule.id}/${name}: expected ${expected ? 'a hit' : 'no hit'}, got ${hit ? 'a hit' : 'no hit'}`)
      }
    }
  }
  console.log(`[selftest] ${pass} passed, ${fail} failed (${caseCount} cases across ${rules.length} rules).`)
  return fail === 0
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.selftest) {
    const ok = selftest()
    process.exit(ok ? 0 : 1)
  }

  // Default to the current directory -- a PROJECT ROOT, not a src/ folder --
  // now that walk()'s SKIP_DIR already excludes node_modules/.git/.next/
  // dist/build/.turbo/.cache/out. Requiring an explicit <srcDir> meant
  // "node audit.mjs src" silently missed markup living outside src/ (a Vite
  // layout's root index.html, a monorepo's root-level HTML), which is
  // exactly what let a bug through unscanned on a real build.
  const srcDir = args._[0] ?? '.'

  const findings = scan(srcDir, { engage: args.engage, prefix: 'fluid' })

  if (args.json) {
    console.log(JSON.stringify({ srcDir, findings }, null, 2))
  } else {
    printTable(findings, srcDir)
  }

  const hasError = findings.some((f) => f.severity === 'error')
  process.exit(hasError ? 1 : 0)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exit(2)
  })
}
