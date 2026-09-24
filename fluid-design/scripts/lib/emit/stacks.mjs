// stacks.mjs — the per-stack authoring layers that sit on top of the engine:
// vanilla CSS classes, SCSS functions and mixins, StyleX helpers, and the
// framework-agnostic fluid.ts every stack gets.

import { exclusiveMedia, bandMedia } from '../model.mjs'
import { settingsSpec, SKILL_VERSION } from '../spec.mjs'
import { num } from './engine.mjs'

// ── vanilla CSS ─────────────────────────────────────────────────────────

export function vanillaClassesCss(structure) {
  const p = structure.prefix
  const container = `width: 100%;
  margin-inline: auto;
  max-width: var(--fluid-container-width);
  padding-inline: var(--fluid-container-padding);`
  return `/* The page container: centred, max width and side padding from the active band.
   Apply once per section, to that section's own inner wrapper. */
.${p}-container {
  ${container}
}${structure.tailwind.aliases ? `
/* v1 name (tailwind.aliases). */
.${p}-frame {
  ${container}
}` : ''}`
}

// ── SCSS ────────────────────────────────────────────────────────────────

export function scss(structure, header) {
  const p = structure.prefix
  const m = exclusiveMedia(structure)
  const bands = ['phone', 'tablet', 'landscape', 'desktop'].filter((b) => m[b])
  const roleFns = structure.roles
    .map((r) => `@function ${p}-${r}($n) {\n  @return calc(#{_${p}-unitless($n, '${p}-${r}')} * var(--fluid-${r}));\n}`)
    .join('\n\n')
  return `${header}// The units, settings and base styles are in fluid.css — import it once,
// globally (from your JS entry, or @import in plain CSS). This module adds
// the authoring side: functions that spend the units and band mixins.
//
//   @use 'fluid' as fd;   (with the folder that holds fluid/ on Sass loadPaths)
//   .hero { @include fd.${p}-desktop { padding-block: fd.${p}(120); @include fd.${p}-type(64, 72); } }
@use 'sass:math';

// Every function takes the DRAWN number, unitless. \`${p}(64px)\` would be
// calc(64px * var(--fluid)), length × length, which the browser drops
// silently; the @error turns that into a build failure.
@function _${p}-unitless($n, $fn) {
  @if math.is-unitless($n) == false {
    @error "fluid-design: #{$fn}() expects a unitless drawn number, got \`#{$n}\`.";
  }
  @return $n;
}

@function ${p}($n) {
  @return calc(#{_${p}-unitless($n, '${p}')} * var(--fluid));
}

${roleFns}
${structure.ui ? `
@function ${p}-ui($n) {
  @return calc(#{_${p}-unitless($n, '${p}-ui')} * var(--fluid-ui));
}
` : ''}
// Type on the base unit, for type in a box that scales with it. $size is
// the FONT size its share of browser zoom is read from; pass it for a
// line-height so the line box zooms with its text (${p}-type does).
@function ${p}-text($n, $size: $n) {
  $n: _${p}-unitless($n, '${p}-text');
${structure.zoom ? `  @return calc(#{$n} * (var(--fluid) + (var(--fluid-z) - var(--fluid)) * max(0, min(1, (var(--fluid-zoom-text-none, 48) - #{$size}) / (var(--fluid-zoom-text-none, 48) - var(--fluid-zoom-text-full, 24))))));` : `  @return calc(#{$n} * var(--fluid));`}
}

// A max-width that only grows.
@function ${p}-cap($n) {
  $n: _${p}-unitless($n, '${p}-cap');
  @return max(#{$n}px, calc(#{$n} * var(--fluid)));
}

// Band mixins: exactly one matches at any viewport.
${bands.map((b) => `@mixin ${p}-${b} {\n  @media ${m[b]} {\n    @content;\n  }\n}`).join('\n')}

// v1 name for the desktop band.
@mixin ${p}-up {
  @include ${p}-desktop {
    @content;
  }
}

// font-size + line-height together. $unit: ${[...structure.roles, 'text', ...(structure.ui ? ['ui'] : [])].join(', ')}.
@mixin ${p}-type($size, $lh, $unit: ${structure.roles[0]}) {
${[...structure.roles.map((r) => [r, `${p}-${r}($size)`, `${p}-${r}($lh)`]), ['text', `${p}-text($size)`, `${p}-text($lh, $size)`], ...(structure.ui ? [['ui', `${p}-ui($size)`, `${p}-ui($lh)`]] : [])]
  .map(([u, fs, lh], i) => `  ${i === 0 ? '@if' : '} @else if'} $unit == ${u} {\n    font-size: ${fs};\n    line-height: ${lh};`)
  .join('\n')}
  } @else {
    @error "fluid-design: ${p}-type() unit must be one of ${[...structure.roles, 'text', ...(structure.ui ? ['ui'] : [])].join(', ')}, got \`#{$unit}\`.";
  }
}

// The page container: once per section, on its inner wrapper.
@mixin ${p}-container {
  width: 100%;
  margin-inline: auto;
  max-width: var(--fluid-container-width);
  padding-inline: var(--fluid-container-padding);
}
${structure.tailwind.aliases ? `
// v1 names (tailwind.aliases).
@mixin ${p}-frame {
  @include ${p}-container;
}
${structure.ui ? `@function ${p}-chrome($n) {
  @return ${p}-ui($n);
}
` : ''}` : ''}`
}

// ── StyleX ──────────────────────────────────────────────────────────────

export function stylex(structure, header) {
  const fn = (name, unit) => `export function ${name}(n: number): string {\n  return \`calc(\${finite(n, '${name}')} * var(${unit}))\`\n}`
  const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
  const cap = (s) => s[0].toUpperCase() + s.slice(1)
  return `${header}// Typed helpers that build calc() strings against the fluid units, for
// plain values in stylex.create(). The units themselves are global CSS:
// import fluid.css once at your app root. (StyleX's defineVars cannot
// express a var whose formula reads a sibling var, which every unit does.)

function finite(n: number, fn: string): number {
  if (!Number.isFinite(n)) throw new Error(\`fluid-design: \${fn}() expects a unitless drawn number, got \${n}.\`)
  return n
}

${fn('fluid', '--fluid')}

${structure.roles.map((r) => fn(`fluid${cap(camel(r))}`, `--fluid-${r}`)).join('\n\n')}
${structure.ui ? `\n${fn('fluidUi', '--fluid-ui')}\n` : ''}
/** Type on the base unit; \`size\` is the font size its zoom share is read from. */
export function fluidText(n: number, size: number = n): string {
  finite(n, 'fluidText')
${structure.zoom ? `  return \`calc(\${n} * (var(--fluid) + (var(--fluid-z) - var(--fluid)) * max(0, min(1, (var(--fluid-zoom-text-none, 48) - \${size}) / (var(--fluid-zoom-text-none, 48) - var(--fluid-zoom-text-full, 24))))))\`` : '  return `calc(${n} * var(--fluid))`'}
}

/** A max-width that only grows. */
export function fluidCap(n: number): string {
  return \`max(\${finite(n, 'fluidCap')}px, calc(\${n} * var(--fluid)))\`
}

/** The page container, as a style object. */
export const fluidContainer = {
  width: '100%',
  marginInline: 'auto',
  maxWidth: 'var(--fluid-container-width)',
  paddingInline: 'var(--fluid-container-padding)'
} as const
`
}

// ── fluid.ts (every stack) ──────────────────────────────────────────────

export function fluidTs(structure, header) {
  const ex = exclusiveMedia(structure)
  const cascade = bandMedia(structure)
  const bands = ['phone', 'tablet', 'landscape', 'desktop'].filter((b) => ex[b])
  const specs = settingsSpec(structure)
  const settingRows = specs.map((s) => `  '${s.name}': { band: ${s.band ? `'${s.band}'` : 'null'}, default: ${s.default === null ? 'null' : num(s.default)}, doc: ${JSON.stringify(s.doc)} }`).join(',\n')
  const units = ['fluid', ...structure.roles, ...(structure.ui ? ['ui'] : [])]
  return `${header}// The structure, as typed constants. Numbers you tune (settings) are CSS
// variables — SETTINGS lists them with their defaults.

export const FLUID_VERSION = '${SKILL_VERSION}'

export type BandName = ${bands.map((b) => `'${b}'`).join(' | ')}
export type RoleName = ${structure.roles.map((r) => `'${r}'`).join(' | ')}
export type FluidUnit = ${units.map((u) => `'${u}'`).join(' | ')}

export const BANDS = [${bands.map((b) => `'${b}'`).join(', ')}] as const
export const ROLES = [${structure.roles.map((r) => `'${r}'`).join(', ')}] as const

/** One matchMedia query per band; exactly one matches at any viewport. */
export const MEDIA: Record<BandName, string> = {
${bands.map((b) => `  ${b}: '${ex[b]}'`).join(',\n')}
}

/** Where the desktop design takes over (bands.desktop.minWidth). */
export const DESKTOP_PX = ${num(structure.bands.desktop.minWidth)}
export const DESKTOP_QUERY = '${cascade.desktop.replace('width >= ', 'min-width: ')}'
/** v1 names for the same thing. */
export const ENGAGE_PX = DESKTOP_PX
export const ENGAGE_QUERY = DESKTOP_QUERY

/** Utility / class names. */
export const PREFIX = '${structure.prefix}'
export const CONTAINER_CLASS = '${structure.prefix}-container'

export type FluidSetting = keyof typeof SETTINGS
/** Every setting: set any of them on :root (e.g. in globals.css) to override. */
export const SETTINGS = {
${settingRows}
} as const

/** Set a setting at runtime (e.g. a dev tuning panel). null removes the override. */
export function setFluidSetting(name: FluidSetting, value: number | null, el: HTMLElement = document.documentElement) {
  if (value === null) el.style.removeProperty(name)
  else el.style.setProperty(name, String(value))
}

export { fluidPx, fluidUnits, onFluidChange } from './runtime/units.js'
`
}
