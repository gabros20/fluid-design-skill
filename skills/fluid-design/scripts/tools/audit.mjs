#!/usr/bin/env node
// audit.mjs — static scanner for a fluid-design codebase (greenfield or
// brownfield). Every finding carries a rule id, file:line, the offending
// snippet, a one-line why, and a fix. This is a regex/heuristic scanner, not
// a type-checker: it is deliberately conservative (false negatives over
// false positives) because a noisy linter gets ignored.
//
// Usage:
//   node audit.mjs [srcDir] [--desktop-variant lg] [--prefix fluid] [--json]
//   node audit.mjs --selftest
//
// With a fluid.config.json at or above srcDir, the class prefix, the roles,
// the stack and the generated folder come from it (flags still win).
// Programmatic: runAudit({ root, prefix, desktopVariant, rules, … }) — the
// same rules `fluid check` runs (CHECK_RULES) with the project's context.
//
// srcDir defaults to "." (the current directory / project root) -- walk()
// already skips node_modules, .git, .next, dist, build, .turbo, .cache and
// out, so running with no argument from a project root is the normal case,
// not just "src/".
//
// Exit codes: 0 = no error-severity findings, 1 = at least one error-severity
// finding, 2 = usage/invocation error.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, extname, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname_ = fileURLToPath(new URL('.', import.meta.url))

// ── CLI ─────────────────────────────────────────────────────────────────

const USAGE = `audit.mjs — static scanner for a fluid-design codebase (greenfield or brownfield).

Usage:
  node audit.mjs [srcDir] [--desktop-variant lg] [--prefix fluid] [--json]
  node audit.mjs --selftest

srcDir defaults to "." (a project root, not just "src/" -- walk() already
skips node_modules/.git/.next/dist/build/.turbo/.cache/out).

With a fluid.config.json at or above srcDir, the class prefix, roles, stack
and generated folder come from it.

Options:
  --desktop-variant <bp>  the desktop breakpoint variant (default: lg)
  --prefix <p>            the utility class prefix (default: the config's, else fluid)
  --json                  print { srcDir, findings } instead of the readable table
  --selftest              run every rule against the repository's tests/fixtures/audit/<rule-id>/{positive,negative}
                          (repository only: an installed skill has no fixtures and exits 2)
  -h, --help              print this message and exit

Exit codes: 0 = no error-severity findings, 1 = at least one error-severity
finding, 2 = usage/invocation error. --selftest exits 0/1 on pass/fail.`

function parseArgs(argv) {
  const out = { _: [], desktopVariant: undefined, prefix: undefined, json: false, selftest: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--json') out.json = true
    else if (a === '--selftest') out.selftest = true
    // --engage: the v1 name, kept as a silent alias
    else if (a === '--desktop-variant' || a === '--engage') out.desktopVariant = argv[++i]
    else if (a.startsWith('--desktop-variant=') || a.startsWith('--engage=')) out.desktopVariant = a.slice(a.indexOf('=') + 1)
    else if (a === '--prefix') out.prefix = argv[++i]
    else if (a.startsWith('--prefix=')) out.prefix = a.slice(9)
    else if (a.startsWith('--')) { console.error(`[audit] unknown flag ${a}`); process.exit(2) }
    else out._.push(a)
  }
  return out
}

// ── file walking ────────────────────────────────────────────────────────

const SCAN_EXT = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.css', '.scss', '.html', '.vue', '.astro', '.svelte', '.mdx'])
const SKIP_DIR = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.cache', 'out', '.vercel', 'coverage'])

function walk(dir, acc = [], skip = null) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue
    const p = join(dir, e.name)
    if (skip && resolvePath(p) === skip) continue
    if (e.isDirectory()) walk(p, acc, skip)
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
// dark-variant) need to read attribute string content itself.
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

  for (const f of files) {
    const ext = extname(f)
    const c = contents.get(f)
    if (ext === '.css' || ext === '.scss') {
      if (/@custom-variant\s+dark\b/.test(c)) hasCustomVariantDark = true
      if (/--radius-[\w-]*\s*:\s*0\b/.test(c)) hasZeroRadiusToken = true
    }
  }

  return { hasCustomVariantDark, hasZeroRadiusToken }
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

// ── markup scanner: class strings per element ───────────────────────────
// A small tag scanner for JSX/HTML/Vue/Svelte/Astro, used by the class-string
// rules. It respects quotes, template literals and balanced {} (so an arrow
// function `onClick={() => x > 1}` in an earlier attribute does not end the
// tag), and it reads class strings ONLY from class/className attribute values
// and from cn()/clsx()-style call arguments -- never from data-* or other
// attributes.

const esc = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

// Skip a JS string/template starting at i (content[i] is the quote). Returns
// the index just past it, and pushes its static text into `pieces`.
function skipJsString(content, i, pieces) {
  const q = content[i]
  let j = i + 1
  let from = j
  while (j < content.length) {
    const c = content[j]
    if (c === '\\') { j += 2; continue }
    if (c === q) break
    if (q !== '`' && c === '\n') break
    if (q === '`' && c === '$' && content[j + 1] === '{') {
      if (pieces && j > from) pieces.push({ text: content.slice(from, j), index: from })
      j = skipBalanced(content, j + 1, '{', '}', pieces)
      from = j
      continue
    }
    j++
  }
  if (pieces && j > from) pieces.push({ text: content.slice(from, j), index: from })
  return j + 1
}

// content[i] === open. Returns the index just past the matching close, with
// every string literal inside pushed into `pieces`.
function skipBalanced(content, i, open, close, pieces) {
  let depth = 0
  let j = i
  const limit = Math.min(content.length, i + 20000)
  while (j < limit) {
    const c = content[j]
    if (c === '"' || c === "'" || c === '`') { j = skipJsString(content, j, pieces); continue }
    if (c === open) depth++
    else if (c === close && --depth === 0) return j + 1
    j++
  }
  return j
}

/** Every tag `<name …>` whose name matches `nameRe`: { name, index, end,
 * attrs: [{ name, index, value, valueIndex, pieces: [{ text, index }] }] }.
 * `pieces` are the string literals in the value (the value itself when quoted). */
function scanTags(content, nameRe = /[A-Za-z][\w.:-]*/) {
  const tags = []
  const re = new RegExp(`<(${nameRe.source})(?=[\\s/>])`, 'g')
  let m
  while ((m = re.exec(content))) {
    const prev = content[m.index - 1]
    if (prev && /[\w$)\]]/.test(prev)) continue // a generic: Array<string>
    const tag = { name: m[1], index: m.index, end: -1, attrs: [] }
    let i = m.index + m[0].length
    const limit = Math.min(content.length, i + 20000)
    while (i < limit) {
      while (i < limit && /\s/.test(content[i])) i++
      const c = content[i]
      if (c === '>') { tag.end = i + 1; break }
      if (c === '/' && content[i + 1] === '>') { tag.end = i + 2; break }
      if (c === '{') { i = skipBalanced(content, i, '{', '}', null); continue } // {...spread}
      const nm = /^[^\s=>/{}"'`]+/.exec(content.slice(i, i + 200))
      if (!nm) { i++; continue }
      const attr = { name: nm[0], index: i, value: null, valueIndex: -1, pieces: [] }
      i += nm[0].length
      let k = i
      while (k < limit && /\s/.test(content[k])) k++
      if (content[k] === '=') {
        k++
        while (k < limit && /\s/.test(content[k])) k++
        const v = content[k]
        attr.valueIndex = k
        if (v === '"' || v === "'") {
          let e = content.indexOf(v, k + 1)
          if (e === -1) e = limit
          attr.value = content.slice(k + 1, e)
          attr.pieces.push({ text: attr.value, index: k + 1 })
          i = e + 1
        } else if (v === '{') {
          const e = skipBalanced(content, k, '{', '}', attr.pieces)
          attr.value = content.slice(k, e)
          i = e
        } else {
          const bare = /^[^\s>]+/.exec(content.slice(k, k + 500))
          attr.value = bare ? bare[0] : ''
          attr.pieces.push({ text: attr.value, index: k })
          i = k + attr.value.length
        }
      }
      tag.attrs.push(attr)
    }
    tags.push(tag)
  }
  return tags
}

const MARKUP_EXT = new Set(['.tsx', '.jsx', '.html', '.vue', '.svelte', '.astro', '.mdx'])
const CLASS_ATTR = /^(?:class|className|:class|v-bind:class|class:list)$/
const CLASS_CALL = /\b(?:cn|clsx|cx|twMerge|twJoin|classNames|classnames|cva|tv)\s*\(/g

/** One group per element (its class/className value) or per cn()/clsx()
 * call outside one: { index, tag, classes: [{ raw, index, variants, base }] }. */
function classGroups(content) {
  const groups = []
  const covered = []
  for (const tag of scanTags(content)) {
    for (const a of tag.attrs) {
      if (!CLASS_ATTR.test(a.name) || a.value == null) continue
      covered.push([a.valueIndex, a.valueIndex + a.value.length])
      groups.push({ index: a.valueIndex, tag: tag.name, classes: tokensOf(a.pieces) })
    }
  }
  CLASS_CALL.lastIndex = 0
  let m
  while ((m = CLASS_CALL.exec(content))) {
    if (covered.some(([s, e]) => m.index >= s && m.index < e)) continue
    const open = m.index + m[0].length - 1
    const pieces = []
    const end = skipBalanced(content, open, '(', ')', pieces)
    covered.push([m.index, end])
    groups.push({ index: m.index, tag: null, classes: tokensOf(pieces) })
  }
  return groups
}

function tokensOf(pieces) {
  const out = []
  for (const p of pieces) {
    const re = /\S+/g
    let m
    while ((m = re.exec(p.text))) out.push({ raw: m[0], index: p.index + m.index, ...parseClass(m[0]) })
  }
  return out
}

/** `md:hover:!fluid-p-4` -> { variants: ['md', 'hover'], base: 'fluid-p-4' }
 * (important marks, leading or trailing, dropped). Splits on ':' outside []. */
function parseClass(tok) {
  const parts = []
  let depth = 0
  let from = 0
  for (let i = 0; i < tok.length; i++) {
    const c = tok[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === ':' && depth === 0) { parts.push(tok.slice(from, i)); from = i + 1 }
  }
  let base = tok.slice(from)
  base = base.replace(/^!/, '').replace(/!$/, '')
  return { variants: parts, base }
}

const BREAKPOINT_VARIANT = /^(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl|3xl)$|^(?:max|min)-\[[^\]]+\]$/
const DISPLAY = new Set(['hidden', 'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'table', 'flow-root', 'list-item', 'table-row', 'table-cell'])
const VALUE_TAIL = /-(?:\[[^\]]*\]|\([^)]*\)|\d[\w.]*|px|full|auto|screen|none|min|max|fit|xs|sm|md|lg|xl|svh|dvh|lvh|svw|dvw|lvw)$/

/** The CSS property a utility sets, roughly: `p-4`, `fluid-p-24` -> 'p';
 * `hidden`, `flex` -> 'display'; every fluid type family -> 'text'. */
function propKey(base, opts) {
  let b = base.replace(/^-/, '')
  if (!b.includes('[')) b = b.replace(/\/[^/]*$/, '')
  if (DISPLAY.has(b)) return 'display'
  const pre = `${opts.prefix}-`
  if (b.startsWith(pre)) {
    b = b.slice(pre.length)
    const fam = b.replace(VALUE_TAIL, '')
    if (fam === 'text' || fam === 'ui-text' || opts.roles.includes(fam)) return 'text'
    b = b.replace(/^ui-/, '')
  }
  return b.replace(VALUE_TAIL, '')
}

const limitClassRe = (prefix) => new RegExp(`^${esc(prefix)}-(?:(?:ui-)?grow-until|shrink-until)-\\[?\\d+(?:\\.\\d+)?\\]?$|^${esc(prefix)}-off$|^\\[--fluid-(?:ui-grow-until|grow-until|shrink-until|off):[^\\]]*\\]$`)

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
      const engage = opts.desktopVariant
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
      // A px radius on a scaling box: warn. The corner is part of the box's
      // shape, so it scales with it (fluid-rounded-*); a hairline radius
      // (<= 2px) is a deliberate crispness choice like a border width.
      const radius = new RegExp(`\\b${engage}:(rounded(?:-[tblr])?)-\\[(\\d+(?:\\.\\d+)?)px\\]`, 'g')
      while ((m = radius.exec(content))) {
        if (Number(m[2]) <= 2) continue
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'warn',
          why: 'A fixed px radius on a box that scales: the corner is part of the box\'s shape, so it reads sharp on a large screen and blunt on a small one (section-recipe.md step 11).',
          fix: `Use ${engage}:${opts.prefix}-${m[1]}-${m[2]} (utilities.rounded, on by default). Leave it fixed only for a deliberately constant corner.`
        })
      }
      // Deliberate exclusions (info, not error): border/stroke widths,
      // tracking, and max-w-* text measures are off the scale on purpose.
      const allow = new RegExp(`\\b${engage}:(border(-[tlbrxy])?|stroke|tracking|max-w)-\\[(-?\\d+(?:\\.\\d+)?)(px|em)?\\]`, 'g')
      while ((m = allow.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'info',
          why: 'Deliberately off the fluid scale: border/stroke widths, tracking and max-w-* text measures are excluded per fluid-scale.md §4.',
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
    // real SCSS-based build).
    id: 'fixed-px-at-engage-scss',
    ext: (e) => ['.css', '.scss'].includes(e),
    run(content, file, ctx, acc, opts) {
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
          fix: `Route the drawn number through the fluid function: ${m[1]}: ${opts.prefix}(${m[2]}) (or ${opts.prefix}-display()/${opts.prefix}-copy() for font-size/line-height).`
        })
      }
      // A px radius inside an engaged block: warn (see fixed-px-at-engage).
      const radiusRe = /\bborder(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*(\d+(?:\.\d+)?)px\s*;/g
      while ((m = radiusRe.exec(content))) {
        if (!inRange(m.index) || Number(m[1]) <= 2) continue
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'warn',
          why: 'A fixed px radius on a box that scales reads sharp on a large screen and blunt on a small one: the corner is part of the box\'s shape.',
          fix: `border-radius: ${opts.prefix}(${m[1]}). Leave it fixed only for a deliberately constant corner.`
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
          why: 'dvh resizes mid-scroll as mobile chrome collapses/expands, which recomputes type and layout under the reader\'s thumb — the worst possible surface for a resize (fluid-scale.md §2), and worst of all over a pinned or scrubbed section.',
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
          why: 'overflow-x:hidden on an ancestor makes the other axis compute to auto, turning that ancestor into a scroll container with zero range — it silently kills every position: sticky element beneath it (SKILL.md\'s invariants), pinned scroll scenes included.',
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
    id: 'double-fluid-same-prop',
    ext: (e) => ['.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc, opts) {
      for (const cls of extractClassNames(content)) {
        const seen = new Map()
        const re = new RegExp(`(?<![\\w-])${esc(opts.desktopVariant)}:${esc(opts.prefix)}-(${PROP_CORE})-`, 'g')
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
            why: `Two ${opts.desktopVariant}:${opts.prefix}-${family}-* classes appear in one className string literal (${hits.join(', ')}...). A plain string never passes through cn(), so stylesheet order — not intent — decides which wins (fluid-scale.md §8.6).`,
            fix: `Keep one ${opts.desktopVariant}:${opts.prefix}-${family}-* per className literal, or route the value through cn() so the later call wins deterministically.`
          })
        }
      }
    }
  },

  {
    // Tailwind v4 sorts breakpoint variants by comparing their `--breakpoint-*`
    // lengths and cannot compare px against rem. A project that overrides only
    // SOME of the standard rungs (typically just `lg`, to match the desktop band) in
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
        fix: 'Define the FULL breakpoint ladder in one unit (px): sm 640, md 768, lg = bands.desktop.minWidth, xl 1280, 2xl 1536. The generated fluid/fluid.css does this for you (tailwind.breakpoints: "ladder"); remove the partial override. See references/stacks.md.'
      })
    }
  },

  {
    id: 'type-unit-mismatch',
    ext: (e) => ['.tsx', '.jsx'].includes(e),
    run(content, file, ctx, acc, opts) {
      const p = esc(opts.prefix)
      for (const cls of extractClassNames(content)) {
        if (!new RegExp(`(?<![\\w-])${p}-display-`).test(cls.value)) continue
        if (!new RegExp(`(?<![\\w-])${p}-(w|size)-`).test(cls.value)) continue
        pushFinding(acc, {
          rule: this.id, file, content, index: cls.index, matchLen: cls.value.length, severity: 'info',
          why: `${opts.prefix}-display-* (the gentle-damping type unit) sits on an element whose own box is also on ${opts.prefix}-w-*/${opts.prefix}-size-* (the base unit). The container already scales, so the type inside it can use the steeper ${opts.prefix}-text-* unit instead (fluid-scale.md §5).`,
          fix: `If this box genuinely scales with the layout, prefer ${opts.prefix}-text-* for the type inside it; keep ${opts.prefix}-display-* only for type inside a fixed-width container.`
        })
      }
    }
  },

  // ── class-string rules (also run by `fluid check`) ─────────────────────

  {
    // A limit class on the site header limits the header's units, but not
    // the page's --fluid-header-h, which anchor offsets and hero padding read
    // on :root. The root ui limit keeps both in step.
    id: 'header-limit',
    ext: (e) => MARKUP_EXT.has(e),
    run(content, file, ctx, acc, opts) {
      const re = new RegExp(`^${esc(opts.prefix)}-(?:ui-)?grow-until-\\[?(\\d+(?:\\.\\d+)?)\\]?$`)
      for (const tag of scanTags(content, /header/)) {
        for (const a of tag.attrs) {
          if (!CLASS_ATTR.test(a.name) || a.value == null) continue
          for (const cls of tokensOf(a.pieces)) {
            const m = re.exec(cls.base)
            if (!m) continue
            pushFinding(acc, {
              rule: this.id, file, content, index: cls.index, matchLen: cls.raw.length, severity: 'warn',
              why: `A grow-until limit on <header> limits the header but not the page's --fluid-header-h (anchor offsets and hero padding read it on :root), so the two drift apart past ${m[1]}px.`,
              fix: `For the site header, set :root { --fluid-ui-grow-until: ${m[1]}; } instead: it holds the header's ui units and --fluid-header-h together.`
            })
          }
        }
      }
    }
  },

  {
    // A project's own tailwind-merge (shadcn's lib/utils.ts, a local cn) that
    // does not know the fluid utilities: cn('lg:fluid-p-40', 'lg:fluid-p-24')
    // keeps both, and stylesheet order picks the winner.
    id: 'cn-without-withfluid',
    ext: (e) => ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(e),
    run(content, file, ctx, acc, opts) {
      if (opts.stack && opts.stack !== 'tailwind-v4') return
      const imp = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]tailwind-merge['"]/.exec(content)
      if (!imp || /\bwithFluid\b/.test(content)) return
      pushFinding(acc, {
        rule: this.id, file, content, index: imp.index, matchLen: imp[0].length, severity: 'warn',
        why: `This file builds a tailwind-merge without withFluid, so fluid classes don't merge here: cn('lg:${opts.prefix}-p-40', 'lg:${opts.prefix}-p-24') keeps both and stylesheet order decides.`,
        fix: 'Add the plugin: extendTailwindMerge(withFluid) (import { withFluid } from the generated cn.ts), or use the generated cn.'
      })
    }
  },

  {
    // Tailwind orders every @custom-variant after every breakpoint variant,
    // so a band variant always beats a breakpoint on the same property.
    id: 'band-variant-with-breakpoint',
    ext: (e) => MARKUP_EXT.has(e) || ['.ts', '.js', '.mjs'].includes(e),
    run(content, file, ctx, acc, opts) {
      const band = new RegExp(`^${esc(opts.prefix)}-(?:phone|tablet|landscape|desktop)$`)
      // Breakpoints at or above the desktop band (lg:, xl:, 2xl:) start where
      // the band variants stop matching, so they can't collide with them.
      const atDesktop = new Set([opts.desktopVariant, 'xl', '2xl'])
      const overlaps = (v) => BREAKPOINT_VARIANT.test(v) && !atDesktop.has(v)
      for (const g of classGroups(content)) {
        const seen = new Map() // key -> { band: [], bp: [] }
        for (const cls of g.classes) {
          const b = cls.variants.filter((v) => band.test(v))
          const bp = cls.variants.filter(overlaps)
          if (b.length && bp.length) continue
          if (!b.length && !bp.length) continue
          const rest = cls.variants.filter((v) => !band.test(v) && !BREAKPOINT_VARIANT.test(v)).join(':')
          const key = `${rest}|${propKey(cls.base, opts)}`
          if (!seen.has(key)) seen.set(key, { band: [], bp: [] })
          seen.get(key)[b.length ? 'band' : 'bp'].push(cls)
        }
        for (const { band: bs, bp } of seen.values()) {
          if (!bs.length || !bp.length) continue
          const first = bs[0]
          pushFinding(acc, {
            rule: this.id, file, content, index: first.index, matchLen: first.raw.length, severity: 'warn',
            why: `${bs.map((c) => c.raw).join(' ')} and ${bp.map((c) => c.raw).join(' ')} set the same property on one element. Tailwind v4 emits every band variant after every breakpoint variant, so the band variant always wins, whatever the widths say.`,
            fix: `Use one system for this property: breakpoints (max-${opts.desktopVariant}:, md:max-${opts.desktopVariant}:) or the band variants alone.`
          })
        }
      }
    }
  },

  {
    // fluid-desktop: was byte-for-byte lg: (the ladder sets lg to the desktop
    // band), and mixed badly with xl:/2xl:. It is removed.
    id: 'fluid-desktop-variant',
    ext: (e) => MARKUP_EXT.has(e) || ['.ts', '.js', '.mjs', '.css', '.scss'].includes(e),
    run(content, file, ctx, acc, opts) {
      const p = esc(opts.prefix)
      const css = ['.css', '.scss'].includes(extname(file))
      const re = css ? new RegExp(`@variant\\s+${p}-desktop\\b`, 'g') : new RegExp(`(?<=^|[\\s"'\`:!{(,])${p}-desktop:(?=[\\w!\\[(-])`, 'g')
      let m
      while ((m = re.exec(content))) {
        pushFinding(acc, {
          rule: this.id, file, content, index: m.index, matchLen: m[0].length, severity: 'error',
          why: `${opts.prefix}-desktop: was removed: it was exactly ${opts.desktopVariant}: (the breakpoint ladder puts ${opts.desktopVariant} at the desktop band), and it compiles to nothing now.`,
          fix: `Replace ${opts.prefix}-desktop: with ${opts.desktopVariant}:.`
        })
      }
    }
  },

  {
    // `*:fluid-off` puts the class on the parent but the rule on the children,
    // and the scope selector matches the element that carries the class.
    id: 'limit-on-children',
    ext: (e) => MARKUP_EXT.has(e) || ['.ts', '.js', '.mjs'].includes(e),
    run(content, file, ctx, acc, opts) {
      const limit = limitClassRe(opts.prefix)
      for (const g of classGroups(content)) {
        for (const cls of g.classes) {
          if (!limit.test(cls.base)) continue
          const child = cls.variants.find((v) => v === '*' || v === '**' || /^\[&[\s_>+~]/.test(v))
          if (!child) continue
          pushFinding(acc, {
            rule: this.id, file, content, index: cls.index, matchLen: cls.raw.length, severity: 'warn',
            why: `${cls.raw}: the class sits on the parent but ${child}: applies the rule to its children, so the children get the setting without being a scope, and the limit does nothing.`,
            fix: `Put the limit on the element itself (${cls.base} on each child), or add ${opts.prefix}-scope to the children as well.`
          })
        }
      }
    }
  },

  {
    // The line-height modifier is drawn px like every other number:
    // fluid-text-48/1.1 is a 1.1px line box, not a ratio.
    id: 'fluid-leading-ratio',
    ext: (e) => MARKUP_EXT.has(e) || ['.ts', '.js', '.mjs'].includes(e),
    run(content, file, ctx, acc, opts) {
      const fams = ['text', 'ui-text', ...opts.roles].map(esc).join('|')
      const re = new RegExp(`^${esc(opts.prefix)}-(?:${fams})-[^/]+/\\[?(\\d*\\.?\\d+)\\]?$`)
      for (const g of classGroups(content)) {
        for (const cls of g.classes) {
          const m = re.exec(cls.base)
          if (!m || Number(m[1]) >= 4) continue
          pushFinding(acc, {
            rule: this.id, file, content, index: cls.index, matchLen: cls.raw.length, severity: 'warn',
            why: `${cls.raw}: the modifier is ${m[1]} drawn px of line height, like every number in the system, not a ratio.`,
            fix: `Write the drawn line height (${cls.base.replace(/\/.*$/, '')}/<px>), or for a ratio use leading-[${m[1]}] next to it.`
          })
        }
      }
    }

  }
]

// ── engine ──────────────────────────────────────────────────────────────

// Any file whose header carries both these words is this skill's OWN
// generator output (every file `fluid generate` writes starts with
// "fluid-design <version> · GENERATED from fluid.config.json"). Exempt from every
// PER-FILE rule below -- scanning generated output for hand-authoring
// mistakes is never meaningful, and its own @error message text is what
// produced a false `length-times-unit` positive before this existed. Checked
// against a prefix of the RAW file, before any masking.
//
// It still feeds buildContext(): buildContext computes repo-wide FACTS (is
// `@custom-variant dark` declared, is a `--radius-*: 0` token defined, ...),
// and a generated stylesheet is a legitimate place either could live (e.g.
// a project's generated fluid.css). Filtering generated files
// out of buildContext too would make `dark-variant`/`rounded-with-zero-
// token` blind to a project that only ever declared these tokens inside
// generated output. Generated files are excluded from the PER-FILE loop
// only; buildContext always sees every file.
const GENERATED_HEADER_RE = /generated/i
const GENERATED_SKILL_RE = /fluid-design/i
function isGeneratedFile(raw) {
  const head = raw.slice(0, 400)
  return GENERATED_HEADER_RE.test(head) && GENERATED_SKILL_RE.test(head)
}

/** Every rule id, and the ones `fluid check` runs: the source scans that
 * used to live in check, and the rules on class strings the fluid layer owns. */
export const RULE_IDS = rules.map((r) => r.id)
export const CHECK_RULES = ['header-limit', 'cn-without-withfluid', 'band-variant-with-breakpoint', 'fluid-desktop-variant', 'limit-on-children', 'fluid-leading-ratio']

/**
 * Run the audit rules over a project.
 *   root            folder to scan (walks it, skipping node_modules, .next, dist, …)
 *   prefix          utility class prefix (structure.prefix), default 'fluid'
 *   desktopVariant  the desktop breakpoint variant, default 'lg'
 *   rules           rule ids to run (default: all); e.g. CHECK_RULES
 *   roles           type roles (structure.roles), default ['display', 'copy']
 *   stack           structure.output.stack; cn-without-withfluid runs only for 'tailwind-v4' (or when unset)
 *   outDir          the generated folder, skipped entirely
 * Returns [{ rule, file, rel, line, snippet, severity: 'error'|'warn'|'info', why, fix }],
 * `file` as walked (root-joined), `rel` relative to root.
 */
export function runAudit({ root = '.', prefix = 'fluid', desktopVariant = 'lg', rules: only, roles = ['display', 'copy'], stack, outDir } = {}) {
  if (only) {
    const unknown = only.filter((id) => !rules.some((r) => r.id === id))
    if (unknown.length) throw new Error(`[audit] unknown rule(s): ${unknown.join(', ')}`)
  }
  const active = only ? rules.filter((r) => only.includes(r.id)) : rules
  const options = { desktopVariant, engage: desktopVariant, prefix, roles, stack }
  const files = walk(root, [], outDir ? resolvePath(outDir) : null)
  const raw = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]))
  const generated = new Map(files.map((f) => [f, isGeneratedFile(raw.get(f))]))
  // Every rule sees comments blanked out (newlines preserved, so line numbers
  // are unaffected) -- a rule pattern mentioned in a docblock or JSX aside
  // must never count as a hit. Repo-wide context is built from the same
  // masked text, so a commented-out @custom-variant/radius line
  // doesn't count either. .css/.scss additionally blank STRING CONTENT (not
  // just skip over it) -- see maskComments' docblock.
  const contents = new Map(
    files.map((f) => {
      const ext = extname(f)
      const blankStrings = ext === '.css' || ext === '.scss'
      return [f, maskComments(raw.get(f), { blankStrings })]
    })
  )
  // buildContext runs over ALL files, generated included -- see the docblock
  // above isGeneratedFile.
  const ctx = buildContext(files, contents)

  const findings = []
  for (const file of files) {
    if (generated.get(file)) continue
    const ext = extname(file)
    const content = contents.get(file)
    for (const rule of active) {
      if (!rule.ext(ext)) continue
      rule.run(content, file, ctx, findings, options)
    }
  }
  for (const f of findings) f.rel = relative(root, f.file).split(sep).join("/")
  return findings
}

/** The v1 entry point, kept: scan(srcDir, { engage|desktopVariant, prefix }). */
export function scan(srcDir, opts = {}) {
  return runAudit({ ...opts, root: srcDir, desktopVariant: opts.desktopVariant ?? opts.engage ?? 'lg' })
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
    const loc = `${relative(root, f.file).split(sep).join("/")}:${f.line}`
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

// The fixtures live in the repository (tests/fixtures/audit), four levels up
// from skills/fluid-design/scripts/tools/. An installed skill, the npm package
// and the binary do not ship them.
const SELFTEST_FIXTURES = join(__dirname_, '..', '..', '..', '..', 'tests', 'fixtures', 'audit')

function selftest() {
  const fixturesRoot = SELFTEST_FIXTURES
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
      // A case may carry audit-options.json ({ prefix, desktopVariant, roles, stack }).
      let caseOpts = {}
      try {
        caseOpts = JSON.parse(readFileSync(join(dir, 'audit-options.json'), 'utf8'))
      } catch {}
      const findings = runAudit({ root: dir, prefix: 'fluid', desktopVariant: 'lg', ...caseOpts })
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

/** The `fluid audit` / `node audit.mjs` entry. Exported so a caller that
 * already imported this module (ES modules evaluate once) can still run it. */
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)

  if (args.help) {
    console.log(USAGE)
    process.exit(0)
  }

  if (args.selftest) {
    if (!existsSync(SELFTEST_FIXTURES)) {
      console.error(`[selftest] the self-test runs from the repository (gabros20/fluid-design-skill): its fixtures are in tests/fixtures/audit, which an installed skill does not ship (looked in ${SELFTEST_FIXTURES}).`)
      process.exit(2)
    }
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

  // The project's context, when a fluid.config.json sits at or above srcDir:
  // prefix, roles, stack and the generated folder come from it.
  const project = {}
  try {
    const { findConfig, loadContext } = await import('../lib/context.mjs')
    const configPath = findConfig(srcDir)
    if (configPath) {
      const cx = loadContext(configPath)
      Object.assign(project, { prefix: cx.structure.prefix, roles: cx.structure.roles, stack: cx.structure.output.stack, outDir: cx.outDir })
    }
  } catch (err) {
    if (!args.json) console.error(`[audit] fluid.config.json not used (${String(err.message).split('\n')[0]}); auditing with defaults`)
  }
  const findings = runAudit({ root: srcDir, ...project, prefix: args.prefix ?? project.prefix ?? 'fluid', desktopVariant: args.desktopVariant ?? 'lg' })

  if (args.json) {
    console.log(JSON.stringify({ srcDir, findings }, null, 2))
  } else {
    printTable(findings, srcDir)
  }

  const hasError = findings.some((f) => f.severity === 'error')
  process.exit(hasError ? 1 : 0)
}

const isMain = (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) || globalThis.__fluidTool === 'audit'
if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exit(2)
  })
}
