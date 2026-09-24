// tailwind.mjs — the Tailwind v4 layer: @theme breakpoints, band variants,
// and the @utility vocabulary that spends the units. Utilities take the
// DRAWN number: lg:fluid-py-120 is 120 design px of block padding, scaled.

import { exclusiveMedia } from '../model.mjs'
import { textUnitExpr, num } from './engine.mjs'

// Tailwind v4 sorts variants by comparing breakpoint LENGTHS, and cannot
// compare a px override with its own rem defaults (measured: a lone px
// --breakpoint-lg sorted the whole lg: block before sm:). So the whole
// ladder is emitted in px, lg pinned to the desktop band, the stock rungs
// nudged only if the desktop band collides with them.
export function breakpointLadder(desktopMin) {
  const lg = desktopMin
  let sm = 640
  let md = 768
  let xl = 1280
  let xxl = 1536
  const notes = []
  if (md >= lg) {
    md = Math.max(1, lg - 1)
    notes.push(`md narrowed to ${md}px to stay below lg`)
  }
  if (sm >= md) {
    sm = Math.max(1, md - 1)
    notes.push(`sm narrowed to ${sm}px to stay below md`)
  }
  if (xl <= lg) {
    xl = lg + 1
    notes.push(`xl widened to ${xl}px to stay above lg`)
  }
  if (xxl <= xl) {
    xxl = xl + 1
    notes.push(`2xl widened to ${xxl}px to stay above xl`)
  }
  return { sm, md, lg, xl, xxl, notes }
}

export function themeCss(structure) {
  const p = structure.prefix
  const out = []
  if (structure.tailwind.breakpoints === 'ladder') {
    const l = breakpointLadder(structure.bands.desktop.minWidth)
    out.push(`/* Breakpoints: the whole ladder in px (Tailwind v4 cannot sort px against its rem
   defaults), lg = the desktop band (bands.desktop.minWidth). Change it there. */
@theme {
  --breakpoint-sm: ${num(l.sm)}px;
  --breakpoint-md: ${num(l.md)}px;
  --breakpoint-lg: ${num(l.lg)}px;
  --breakpoint-xl: ${num(l.xl)}px;
  --breakpoint-2xl: ${num(l.xxl)}px;${l.notes.length ? `\n  /* ${l.notes.join('; ')} */` : ''}
}`)
  }
  if (structure.tailwind.variants) {
    const m = exclusiveMedia(structure)
    const order = ['phone', 'tablet', 'landscape', 'desktop'].filter((b) => m[b])
    out.push(`/* Band variants: exactly one matches at any viewport. ${p}-desktop: equals lg:. */
${order.map((b) => `@custom-variant ${p}-${b} {\n  @media ${m[b]} {\n    @slot;\n  }\n}`).join('\n')}`)
  }
  return out.join('\n\n')
}

// ── utilities ───────────────────────────────────────────────────────────

const CORE = [
  // [name, property | [properties]]
  ['p', 'padding'], ['px', 'padding-inline'], ['py', 'padding-block'], ['pt', 'padding-top'], ['pb', 'padding-bottom'], ['pl', 'padding-left'], ['pr', 'padding-right'],
  ['m', 'margin'], ['mx', 'margin-inline'], ['my', 'margin-block'], ['mt', 'margin-top'], ['mb', 'margin-bottom'], ['ml', 'margin-left'], ['mr', 'margin-right'],
  ['gap', 'gap'], ['gap-x', 'column-gap'], ['gap-y', 'row-gap'],
  ['w', 'width'], ['h', 'height'], ['size', ['width', 'height']], ['min-w', 'min-width'], ['min-h', 'min-height'], ['max-h', 'max-height'],
  ['inset', 'inset'], ['top', 'top'], ['right', 'right'], ['bottom', 'bottom'], ['left', 'left']
]
export const EXTRA_FAMILIES = {
  logical: [['ps', 'padding-inline-start'], ['pe', 'padding-inline-end'], ['ms', 'margin-inline-start'], ['me', 'margin-inline-end'], ['start', 'inset-inline-start'], ['end', 'inset-inline-end'], ['inset-x', 'inset-inline'], ['inset-y', 'inset-block']],
  basis: [['basis', 'flex-basis']],
  scroll: [['scroll-mt', 'scroll-margin-top'], ['scroll-pt', 'scroll-padding-top'], ['scroll-mb', 'scroll-margin-bottom'], ['scroll-pb', 'scroll-padding-bottom']],
  rounded: [['rounded', 'border-radius'], ['rounded-t', ['border-top-left-radius', 'border-top-right-radius']], ['rounded-b', ['border-bottom-left-radius', 'border-bottom-right-radius']], ['rounded-l', ['border-top-left-radius', 'border-bottom-left-radius']], ['rounded-r', ['border-top-right-radius', 'border-bottom-right-radius']]]
}
const NEGATABLE = ['m', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'inset', 'top', 'right', 'bottom', 'left']
const NEGATABLE_LOGICAL = ['ms', 'me', 'start', 'end', 'inset-x', 'inset-y']
// The ui unit gets a small family of its own: the header, nav and footer
// are a handful of boxes and their type.
const UI_FAMILY = [['p', 'padding'], ['px', 'padding-inline'], ['py', 'padding-block'], ['gap', 'gap'], ['w', 'width'], ['h', 'height'], ['size', ['width', 'height']]]

export function extraFamilies(u) {
  return [...(u.logical ? EXTRA_FAMILIES.logical : []), ...(u.basis ? EXTRA_FAMILIES.basis : []), ...(u.scroll ? EXTRA_FAMILIES.scroll : []), ...(u.rounded ? EXTRA_FAMILIES.rounded : [])]
}

// Values resolve through a SUGGESTION scale first, then any number: the
// scale (a `@theme inline reference` namespace, so it emits no CSS and the
// value is inlined) is what editor autocomplete lists — without it Tailwind
// IntelliSense can offer none of these utilities. Any other drawn number
// (fluid-p-37.5) still works through `number`.
export const STEPS = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112, 120, 128, 144, 160, 180, 200, 240]
export const LIMIT_WIDTHS = [375, 390, 430, 768, 1024, 1280, 1366, 1440, 1536, 1680, 1920, 2560]
const V = '--value(--fluid-step-*, number)'
const M = '--modifier(--fluid-step-*, number)'
const W = '--value(--fluid-width-*, integer, [integer])'
// One line per utility: the vocabulary reads as a table.
const util = (name, props, expr) => `@utility ${name} { ${(Array.isArray(props) ? props : [props]).map((pr) => `${pr}: ${expr};`).join(' ')} }`

export function utilitiesCss(structure) {
  const p = structure.prefix
  const u = structure.tailwind.utilities
  const out = []
  out.push(`/* Autocomplete scale (not emitted: reference + inline). */
@theme inline reference {
  ${STEPS.map((n) => `--fluid-step-${n}: ${n};`).join(' ')}
  ${LIMIT_WIDTHS.map((n) => `--fluid-width-${n}: ${n};`).join(' ')}
}`)
  out.push(`/* Limits: this element and everything inside it stop scaling at a window
   width. ${p}-grow-until-1680 keeps the size it had at a 1680 window; ${p}-shrink-until-1280
   the size at 1280 as a minimum; ${p}-ui-grow-until-* limits only --fluid-ui; ${p}-off
   turns scaling off inside (drawn px = CSS px). Each makes the element a scope. A
   width applies in the band that contains it. */
@utility ${p}-grow-until-* { --fluid-grow-until: ${W}; }
@utility ${p}-shrink-until-* { --fluid-shrink-until: ${W}; }
${structure.ui ? `@utility ${p}-ui-grow-until-* { --fluid-ui-grow-until: ${W}; }
` : ''}@utility ${p}-off { --fluid-off: 1; }`)
  out.push(`/* Utilities: the drawn number, scaled. ${p}-py-120 = 120 design px of block padding.
   Not scaled, on purpose: border widths, tracking (use em), text measures. */
${CORE.map(([name, props]) => util(`${p}-${name}-*`, props, `calc(${V} * var(--fluid))`)).join('\n')}`)
  out.push(`/* A max-width that only grows: the drawn number in CSS px below the artboard, scaled above it. */
@utility ${p}-cap-* { max-width: max(calc(${V} * 1px), calc(${V} * var(--fluid))); }`)
  out.push(`/* translate, not transform, so it composes with a transform a motion library writes. */
@utility ${p}-translate-x-* { --tw-translate-x: calc(${V} * var(--fluid)); translate: var(--tw-translate-x) var(--tw-translate-y); }
@utility ${p}-translate-y-* { --tw-translate-y: calc(${V} * var(--fluid)); translate: var(--tw-translate-x) var(--tw-translate-y); }`)
  out.push(`/* The page container: centred, max width and side padding from the active band
   (--fluid-<band>-container-width / -padding). Apply once per section, to its inner wrapper. */
@utility ${p}-container {
  width: 100%;
  margin-inline: auto;
  max-width: var(--fluid-container-width);
  padding-inline: var(--fluid-container-padding);
}`)
  // Type: every role, plus text on the base unit. The / modifier is the line box.
  const text = textUnitExpr(structure, V)
  out.push(`/* Type. ${p}-<role>-64/72 = 64px on a 72px line box, both on the role's damped unit.
   ${p}-text-* is on the base unit, for type inside a box that scales with it.${structure.zoom ? `
   Under browser zoom it takes a share of the zoom by size (--fluid-zoom-text-full / -none).` : ''} */
${structure.roles.map((r) => `@utility ${p}-${r}-* { font-size: calc(${V} * var(--fluid-${r})); line-height: calc(${M} * var(--fluid-${r})); }`).join('\n')}
@utility ${p}-text-* {
  font-size: calc(${V} * ${text});
  line-height: calc(${M} * ${text});
}`)
  if (structure.ui) {
    out.push(`/* The ui unit (header, nav, footer): follows the width, never shrinks for a short window. */
${UI_FAMILY.map(([n, props]) => util(`${p}-ui-${n}-*`, props, `calc(${V} * var(--fluid-ui))`)).join('\n')}
@utility ${p}-ui-text-* { font-size: calc(${V} * var(--fluid-ui)); line-height: calc(${M} * var(--fluid-ui)); }`)
  }
  const fams = extraFamilies(u)
  if (fams.length) out.push(`/* Optional families (tailwind.utilities). */\n${fams.map(([n, props]) => util(`${p}-${n}-*`, props, `calc(${V} * var(--fluid))`)).join('\n')}`)
  if (u.space) {
    out.push(`@utility ${p}-space-x-* {
  :where(& > :not(:last-child)) {
    margin-inline-end: calc(${V} * var(--fluid));
  }
}
@utility ${p}-space-y-* {
  :where(& > :not(:last-child)) {
    margin-block-end: calc(${V} * var(--fluid));
  }
}`)
  }
  if (u.negative) {
    const neg = []
    const byName = Object.fromEntries([...CORE, ...EXTRA_FAMILIES.logical])
    for (const n of [...NEGATABLE, ...(u.logical ? NEGATABLE_LOGICAL : [])]) neg.push(util(`-${p}-${n}-*`, byName[n], `calc(${V} * -1 * var(--fluid))`))
    neg.push(`@utility -${p}-translate-x-* { --tw-translate-x: calc(${V} * -1 * var(--fluid)); translate: var(--tw-translate-x) var(--tw-translate-y); }`)
    neg.push(`@utility -${p}-translate-y-* { --tw-translate-y: calc(${V} * -1 * var(--fluid)); translate: var(--tw-translate-x) var(--tw-translate-y); }`)
    out.push(`/* Negatives: -${p}-mt-8. */\n${neg.join('\n')}`)
  }
  return out.join('\n\n')
}

// ── cn.ts ───────────────────────────────────────────────────────────────

export function cnTs(structure, header) {
  const p = structure.prefix
  const u = structure.tailwind.utilities
  const key = (g) => (/^[a-z]+$/.test(g) ? g : `'${g}'`)
  const groups = []
  const add = (group, ...names) => groups.push(`      ${key(group)}: [${names.map((n) => `fluid('${p}-${n}')`).join(', ')}]`)
  for (const [n] of CORE) add(n === 'size' ? 'size' : n, n, ...(structure.ui && UI_FAMILY.some(([x]) => x === n) ? [`ui-${n}`] : []))
  add('max-w', 'cap')
  add('font-size', 'text', ...structure.roles, ...(structure.ui ? ['ui-text'] : []))
  add('translate-x', 'translate-x')
  add('translate-y', 'translate-y')
  for (const [n] of extraFamilies(u)) add(n, n)
  if (u.space) {
    add('space-x', 'space-x')
    add('space-y', 'space-y')
  }
  add(`${p}-grow-until`, 'grow-until')
  add(`${p}-shrink-until`, 'shrink-until')
  if (structure.ui) add(`${p}-ui-grow-until`, 'ui-grow-until')
  groups.push(`      '${p}-off': ['${p}-off']`)
  return `${header}import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge, mergeConfigs } from 'tailwind-merge'

// tailwind-merge does not know ${p}-* utilities, so without this it keeps BOTH
// of 'lg:${p}-p-40 lg:${p}-p-24' and CSS source order picks the winner. Each
// family joins the Tailwind group its property already belongs to (${p}-p joins
// p, every font-size family joins font-size), so the last class wins, as a
// caller passing className expects.
//
// ALREADY HAVE A cn (shadcn's lib/utils.ts, or your own)? Keep it and add the
// plugin — it composes with any extension you already have:
//
//   import { extendTailwindMerge } from 'tailwind-merge'
//   import { withFluid } from '@/styles/fluid/cn'
//   const twMerge = extendTailwindMerge(withFluid)            // was: import { twMerge } from 'tailwind-merge'
//   const twMerge = extendTailwindMerge({ extend: … }, withFluid)   // if you already extend it
//
// No cn yet? Use the one exported below.
const isFluidValue = (value: string) => /^(\\d+(\\.\\d+)?(\\/\\d+(\\.\\d+)?)?|\\[\\d+\\])$/.test(value)
const fluid = (name: string) => ({ [name]: [isFluidValue] })

type AnyConfig = Parameters<typeof mergeConfigs>[0]

/** tailwind-merge plugin: teaches any twMerge the ${p}-* utilities. */
export function withFluid(config: AnyConfig): AnyConfig {
  return mergeConfigs<string>(config, {
    extend: {
      classGroups: {
${groups.map((g) => '  ' + g).join(',\n')}
      }
    }
  })
}

export const twMerge = extendTailwindMerge(withFluid)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
}
