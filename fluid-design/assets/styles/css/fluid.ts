// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.
// fluid.ts — the structure as typed constants.

// The structure, as typed constants. Numbers you tune (settings) are CSS
// variables — SETTINGS lists them with their defaults.

export const FLUID_VERSION = '2.0.0'

export type BandName = 'phone' | 'tablet' | 'landscape' | 'desktop'
export type RoleName = 'display' | 'copy'
export type FluidUnit = 'fluid' | 'display' | 'copy' | 'ui'

export const BANDS = ['phone', 'tablet', 'landscape', 'desktop'] as const
export const ROLES = ['display', 'copy'] as const

/** One matchMedia query per band; exactly one matches at any viewport. */
export const MEDIA: Record<BandName, string> = {
  phone: '(width < 600px) and (not ((orientation: landscape) and (height <= 500px)))',
  tablet: '(600px <= width < 1024px) and (not ((orientation: landscape) and (height <= 500px)))',
  landscape: '(width < 1024px) and (orientation: landscape) and (height <= 500px)',
  desktop: '(width >= 1024px)'
}

/** Where the desktop design takes over (bands.desktop.minWidth). */
export const DESKTOP_PX = 1024
export const DESKTOP_QUERY = '(min-width: 1024px)'
/** v1 names for the same thing. */
export const ENGAGE_PX = DESKTOP_PX
export const ENGAGE_QUERY = DESKTOP_QUERY

/** Utility / class names. */
export const PREFIX = 'fluid'
export const CONTAINER_CLASS = 'fluid-container'

export type FluidSetting = keyof typeof SETTINGS
/** Every setting: set any of them on :root (e.g. in globals.css) to override. */
export const SETTINGS = {
  '--fluid-phone-base-width': { band: 'phone', default: 390, doc: "viewport width where 1 drawn px = 1 CSS px (the artboard width)" },
  '--fluid-phone-scale-min': { band: 'phone', default: 0.82, doc: "the unit never goes below this (smallest phones stop shrinking)" },
  '--fluid-phone-scale-max': { band: 'phone', default: 1.1, doc: "the unit never goes above this" },
  '--fluid-phone-display-damping': { band: 'phone', default: 0.85, doc: "display type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-phone-display-floor': { band: 'phone', default: null, doc: "optional hard minimum for display type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-phone-copy-damping': { band: 'phone', default: 0.6, doc: "copy type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-phone-copy-floor': { band: 'phone', default: null, doc: "optional hard minimum for copy type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-phone-container-width': { band: 'phone', default: 560, doc: "page container max width, drawn px (holds the phone design to a column on wide screens)" },
  '--fluid-phone-container-padding': { band: 'phone', default: 24, doc: "page container side padding, drawn px" },
  '--fluid-phone-header-height': { band: 'phone', default: 34, doc: "header row height, CSS px (not scaled on mobile)" },
  '--fluid-tablet-base-width': { band: 'tablet', default: 700, doc: "viewport width where the phone design is drawn 1:1 in this band" },
  '--fluid-tablet-scale-min': { band: 'tablet', default: 1.1, doc: "the unit never goes below this (smallest phones stop shrinking)" },
  '--fluid-tablet-scale-max': { band: 'tablet', default: 1.3, doc: "the unit never goes above this" },
  '--fluid-tablet-display-damping': { band: 'tablet', default: 0.85, doc: "display type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-tablet-display-floor': { band: 'tablet', default: null, doc: "optional hard minimum for display type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-tablet-copy-damping': { band: 'tablet', default: 0.6, doc: "copy type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-tablet-copy-floor': { band: 'tablet', default: null, doc: "optional hard minimum for copy type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-tablet-container-width': { band: 'tablet', default: 560, doc: "page container max width, drawn px (holds the phone design to a column on wide screens)" },
  '--fluid-tablet-container-padding': { band: 'tablet', default: 24, doc: "page container side padding, drawn px" },
  '--fluid-tablet-header-height': { band: 'tablet', default: 34, doc: "header row height, CSS px (not scaled on mobile)" },
  '--fluid-landscape-base-width': { band: 'landscape', default: 780, doc: "viewport width where the phone design is drawn 1:1 in this band" },
  '--fluid-landscape-scale-min': { band: 'landscape', default: 1, doc: "the unit never goes below this (smallest phones stop shrinking)" },
  '--fluid-landscape-scale-max': { band: 'landscape', default: 1.2, doc: "the unit never goes above this" },
  '--fluid-landscape-display-damping': { band: 'landscape', default: 0.85, doc: "display type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-landscape-display-floor': { band: 'landscape', default: null, doc: "optional hard minimum for display type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-landscape-copy-damping': { band: 'landscape', default: 0.6, doc: "copy type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-landscape-copy-floor': { band: 'landscape', default: null, doc: "optional hard minimum for copy type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-landscape-container-width': { band: 'landscape', default: 560, doc: "page container max width, drawn px (holds the phone design to a column on wide screens)" },
  '--fluid-landscape-container-padding': { band: 'landscape', default: 24, doc: "page container side padding, drawn px" },
  '--fluid-landscape-header-height': { band: 'landscape', default: 34, doc: "header row height, CSS px (not scaled on mobile)" },
  '--fluid-desktop-base-width': { band: 'desktop', default: 1440, doc: "viewport width where 1 drawn px = 1 CSS px (the artboard width)" },
  '--fluid-desktop-base-height': { band: 'desktop', default: 900, doc: "artboard height: at this window height a 1:1 section fits exactly" },
  '--fluid-desktop-fit-height': { band: 'desktop', default: 1, doc: "1 = a section drawn as tall as the artboard always fits the window; 0 = scale by width only" },
  '--fluid-desktop-scale-min': { band: 'desktop', default: 0.58, doc: "the unit never goes below this (small, short windows stop shrinking)" },
  '--fluid-desktop-scale-max': { band: 'desktop', default: null, doc: "optional ceiling: stop growing on huge screens (unset = no ceiling)" },
  '--fluid-desktop-display-damping': { band: 'desktop', default: 0.62, doc: "display type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-desktop-display-floor': { band: 'desktop', default: null, doc: "optional hard minimum for display type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-desktop-copy-damping': { band: 'desktop', default: 0.33, doc: "copy type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size" },
  '--fluid-desktop-copy-floor': { band: 'desktop', default: null, doc: "optional hard minimum for copy type, as a scale factor (unset = none; the damping already holds type up)" },
  '--fluid-desktop-container-width': { band: 'desktop', default: 1680, doc: "page container max width, drawn px (grows with the unit, never narrows below this in CSS px)" },
  '--fluid-desktop-container-padding': { band: 'desktop', default: 80, doc: "page container side padding, drawn px" },
  '--fluid-desktop-header-height': { band: 'desktop', default: 48, doc: "header row height, drawn px (scaled by --fluid-ui)" },
  '--fluid-header-inset': { band: null, default: 24, doc: "space above the header row, drawn px (plus the safe-area inset)" }
} as const

/** Set a setting at runtime (e.g. a dev tuning panel). null removes the override. */
export function setFluidSetting(name: FluidSetting, value: number | null, el: HTMLElement = document.documentElement) {
  if (value === null) el.style.removeProperty(name)
  else el.style.setProperty(name, String(value))
}

export { fluidPx, fluidUnits, onFluidChange } from './runtime/units.js'
