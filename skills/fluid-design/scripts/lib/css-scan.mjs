// css-scan.mjs — a small, zero-dependency CSS/SCSS block tokenizer.
//
// Not a CSS parser: it only needs to know where blocks open and close, which
// at-rules and selectors enclose a declaration, and where the statements at
// the top of a file end. Comments (/* */, and // in SCSS) and string contents
// are blanked first with newlines kept, so every index and line survives.
//
//   maskCss(css, { scss })            comments and string contents blanked
//   parseCss(css, { scss })           { text, root } — a tree of blocks
//   cssDeclarations(css, opts)        every declaration with its selectors, at-rules, scope flag
//   splitSelectorList(prelude)        'a, :is(b, c)' -> ['a', ':is(b, c)']
//   findImportInsertion(css)          index after @charset and leading @import/@use/@forward/@layer x;
//   findRootBlock(css)                { openIndex, closeIndex } of the first depth-0 `:root {`, or null
//   hasBaseRules(css)                 a top-level (or @layer-nested) rule on html/body, qualified or not

/** Blank comments and string contents (quotes kept), newlines kept. SCSS
 * also has `//` line comments, but not right after a `:` (a url's `//`). */
export function maskCss(css, { scss = false, strings = true } = {}) {
  const ch = css.split('')
  const n = ch.length
  let i = 0
  while (i < n) {
    const c = ch[i]
    const c2 = ch[i + 1]
    if (c === '/' && c2 === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      for (let k = i; k < stop; k++) if (ch[k] !== '\n') ch[k] = ' '
      i = stop
      continue
    }
    if (scss && c === '/' && c2 === '/' && ch[i - 1] !== ':') {
      while (i < n && ch[i] !== '\n') ch[i++] = ' '
      continue
    }
    if (c === '"' || c === "'") {
      i++
      while (i < n && ch[i] !== c && ch[i] !== '\n') {
        if (ch[i] === '\\' && i + 1 < n && ch[i + 1] !== '\n') {
          if (strings) ch[i] = ' '
          i++
        }
        if (strings) ch[i] = ' '
        i++
      }
      i++
      continue
    }
    i++
  }
  return ch.join('')
}

/** Split a selector list on top-level commas (not inside () or []). */
export function splitSelectorList(prelude) {
  const out = []
  let depth = 0
  let from = 0
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      out.push(prelude.slice(from, i))
      from = i + 1
    }
  }
  out.push(prelude.slice(from))
  return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** Resolve a nested rule's selectors against its parent's (SCSS / CSS nesting). */
function resolveNested(parents, own) {
  if (!parents) return own
  const out = []
  for (const p of parents) for (const o of own) out.push(o.includes('&') ? o.replace(/&/g, p) : `${p} ${o}`)
  return out
}

/**
 * Parse into a tree. Every block node: { type: 'root'|'rule'|'at', prelude,
 * name (at-rules, lowercase, without '@'), params, selectors (rules, as
 * written), start (prelude start), open ('{' index), close ('}' index),
 * children: [block], stmts: [{ kind: 'decl', name, value, index } |
 * { kind: 'at', name, params, index }] }.
 */
export function parseCss(css, { scss = false } = {}) {
  const text = maskCss(css, { scss })
  // Structure comes from `text`; what is shown (preludes, values) from
  // `shown`, which keeps string contents: `html[data-theme="dark"]`.
  const shown = maskCss(css, { scss, strings: false })
  const root = { type: 'root', prelude: '', children: [], stmts: [], start: 0, open: -1, close: text.length }
  const stack = [root]
  let from = 0
  const firstNonWs = (a, b) => {
    while (a < b && /\s/.test(text[a])) a++
    return a
  }
  const statement = (a, b) => {
    const s = firstNonWs(a, b)
    const raw = text.slice(s, b).trim()
    if (!raw) return
    const top = stack[stack.length - 1]
    if (raw[0] === '@') {
      const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(raw)
      if (m) top.stmts.push({ kind: 'at', name: m[1].toLowerCase(), params: shown.slice(s, b).trim().slice(raw.length - m[2].length).trim(), index: s })
      return
    }
    const m = /^(--[\w-]+|-?[a-zA-Z][\w-]*)\s*:([\s\S]*)$/.exec(raw)
    if (m) {
      const value = shown.slice(s, b).trim().slice(raw.length - m[2].length)
      top.stmts.push({ kind: 'decl', name: m[1], value: value.replace(/!\s*important\s*$/i, '').trim(), index: s })
    }
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '#' && text[i + 1] === '{') {
      // SCSS interpolation: part of the surrounding text, not a block.
      let d = 0
      for (i = i + 1; i < text.length; i++) {
        if (text[i] === '{') d++
        else if (text[i] === '}' && --d === 0) break
      }
      continue
    }
    if (c === '{') {
      const s = firstNonWs(from, i)
      const prelude = shown.slice(s, i).trim().replace(/\s+/g, ' ')
      const parent = stack[stack.length - 1]
      let node
      if (prelude[0] === '@') {
        const m = /^@([\w-]+)\s*(.*)$/.exec(prelude)
        node = { type: 'at', prelude, name: (m?.[1] ?? '').toLowerCase(), params: m?.[2] ?? '' }
      } else node = { type: 'rule', prelude, selectors: splitSelectorList(prelude) }
      Object.assign(node, { start: s, open: i, close: -1, children: [], stmts: [] })
      parent.children.push(node)
      stack.push(node)
      from = i + 1
    } else if (c === ';') {
      statement(from, i)
      from = i + 1
    } else if (c === '}') {
      statement(from, i)
      if (stack.length > 1) stack.pop().close = i
      from = i + 1
    }
  }
  statement(from, text.length)
  return { text, root }
}

function lineIndex(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return (idx) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= idx) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

const esc = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

/** What makes an element a fluid scope, for a class prefix. */
export function scopeMarkers(prefix = 'fluid') {
  const ps = [...new Set([prefix, 'fluid'])].map(esc).join('|')
  return {
    // in a selector: the scope class, the attribute, or a limit class
    selector: new RegExp(`(?:${ps})-scope\\b|data-fluid-scope|(?:${ps})-(?:ui-)?grow-until|(?:${ps})-shrink-until|(?:${ps})-off(?![\\w-])`),
    // an @include of the scope or a limit mixin, namespaced or not
    include: new RegExp(`^(?:[\\w-]+\\.)?(?:${ps})-(?:scope|grow-until|shrink-until|ui-grow-until|off)\\b`)
  }
}

/**
 * Every declaration (all of them; filter by name yourself), in source order:
 * { name, value, file, line, index, selectorList: [resolved selectors of the
 *   innermost rule, or [] outside any rule], atRules: [{ name, params }…
 *   outermost first], inScopeBlock, context: [every enclosing prelude] }.
 * `inScopeBlock`: the innermost rule's selector names a scope marker, or its
 * block @includes the scope or a limit mixin.
 */
export function cssDeclarations(css, { file = '<css>', scss = /\.s[ac]ss$/.test(file), prefix = 'fluid' } = {}) {
  const { text, root } = parseCss(css, { scss })
  const lineAt = lineIndex(text)
  const markers = scopeMarkers(prefix)
  const out = []
  const visit = (node, chain, selectors, ruleNode) => {
    for (const st of node.stmts) {
      if (st.kind !== 'decl') continue
      const scoped =
        !!ruleNode &&
        (selectors.some((s) => markers.selector.test(s)) ||
          ruleNode.stmts.some((x) => x.kind === 'at' && x.name === 'include' && markers.include.test(x.params)))
      out.push({
        name: st.name,
        value: st.value,
        file,
        line: lineAt(st.index),
        index: st.index,
        selectorList: selectors ?? [],
        atRules: chain.filter((n) => n.type === 'at').map((n) => ({ name: n.name, params: n.params })),
        inScopeBlock: scoped,
        context: chain.map((n) => n.prelude)
      })
    }
    for (const child of node.children) {
      if (child.type === 'rule') visit(child, [...chain, child], resolveNested(selectors, child.selectors), child)
      else visit(child, [...chain, child], selectors, ruleNode)
    }
  }
  visit(root, [], null, null)
  return out.sort((a, b) => a.index - b.index)
}

/** Index where a new @import goes: after @charset and after any leading
 * @import / @use / @forward / `@layer a, b;` statements (never above
 * @charset). 0 when the file starts with none of them. When the last one
 * ends a line, the index is at the start of the next line. */
export function findImportInsertion(css) {
  const text = maskCss(css, { scss: true })
  let i = 0
  let at = 0
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++
    const m = /^@(charset|import|use|forward|layer)\b/i.exec(text.slice(i, i + 10))
    if (!m) break
    // A statement, not a block (`@layer x { … }` ends the header).
    let j = i
    let depth = 0
    while (j < text.length) {
      const c = text[j]
      if (c === '(') depth++
      else if (c === ')') depth--
      else if (depth === 0 && (c === ';' || c === '{')) break
      j++
    }
    if (text[j] !== ';') break
    i = j + 1
    at = i
    if (text[at] === '\n') at++
    else if (text[at] === '\r' && text[at + 1] === '\n') at += 2
  }
  return at
}

const TRANSPARENT = new Set(['layer'])

/** The first `:root {` at nesting depth 0 (not inside @media, @layer, …). */
export function findRootBlock(css) {
  const { root } = parseCss(css, { scss: true })
  for (const n of root.children) {
    if (n.type === 'rule' && n.selectors.length === 1 && n.selectors[0] === ':root') return { openIndex: n.open, closeIndex: n.close }
  }
  return null
}

/** True when a top-level rule, or one inside @layer blocks, styles html or
 * body (qualified or not: `html[data-x]`, `body.dark`, `html, body`). */
export function hasBaseRules(css) {
  const { root } = parseCss(css, { scss: true })
  const walk = (nodes) =>
    nodes.some((n) => {
      if (n.type === 'rule') return n.selectors.some((s) => /^(html|body)(?![\w-])/i.test(s))
      if (n.type === 'at' && TRANSPARENT.has(n.name)) return walk(n.children)
      return false
    })
  return walk(root.children)
}
