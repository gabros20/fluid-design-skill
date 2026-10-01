// readme.mjs — the generated README in output.dir: how to use what is in
// this folder, in plain words. The reasoning lives in the skill's references.

import { SKILL_VERSION, bandBlurb } from '../spec.mjs'
import { exclusiveMedia } from '../model.mjs'

const CLI = 'npx fluid-design-cli@2'

/** One row per type role: what it is for, in the words a designer uses. */
function roleUse(role, index) {
  if (role === 'display') return 'headlines and big numbers: shrinks less than the layout, so it stays readable on small screens'
  if (role === 'copy') return 'body text, labels, button text: shrinks least of all'
  return index === 0 ? 'large type on its own curve' : `${role} type on its own curve`
}

export function readmeMd(structure, fileList) {
  const p = structure.prefix
  const stack = structure.output.stack
  const tw = stack === 'tailwind-v4'
  const ex = exclusiveMedia(structure)
  const bands = ['phone', 'tablet', 'landscape', 'desktop'].filter((b) => ex[b])
  const roles = structure.roles
  const label = roles.includes('copy') ? 'copy' : roles[roles.length - 1]
  const big = roles.includes('display') ? 'display' : roles[0]
  const imp = tw
    ? `@import 'tailwindcss';\n@import './fluid/fluid.css';`
    : stack === 'scss'
      ? `/* main.ts (or any global CSS) */\nimport './styles/fluid/fluid.css'\n\n// any .scss file (with the folder that holds fluid/ on Sass loadPaths)\n@use 'fluid' as fd;`
      : `@import './fluid/fluid.css';`

  const variantBands = structure.tailwind.variants ? bands.filter((b) => b !== 'desktop') : []
  const camel = (r) => r.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase())
  const stylexFn = (r) => `fluid${camel(r)[0].toUpperCase()}${camel(r).slice(1)}`
  const zoomSetup = !structure.zoom
    ? ''
    : `
Browser zoom needs one script in \`<head>\`, before first paint:
${structure.output.integration === 'next' ? `
${'```tsx'}
// app/layout.tsx
import { FluidHead } from '@/styles/fluid/integrations/next'
<html><head><FluidHead /></head>…
${'```'}` : structure.output.integration === 'vite' ? `
${'```ts'}
// vite.config.ts
import { fluidPlugin } from './src/styles/fluid/integrations/vite'
export default defineConfig({ plugins: [fluidPlugin()] })
${'```'}` : `
${'```html'}
<!-- first thing in <head>; a classic script, not type="module" -->
<script src="/…/runtime/zoom.classic.js"></script>
${'```'}`}

Under a strict CSP, ${structure.output.integration === 'next' ? 'pass a nonce (`<FluidHead nonce={…} />`)' : structure.output.integration === 'vite' ? 'pass a nonce (`fluidPlugin({ nonce })`)' : 'put your nonce on that `<script>`'} or allow
\`FLUID_ZOOM_SHA256\` (in \`runtime/zoom.js\`) in \`script-src\`.
`

  const twTable = `| You are sizing | Use | Example |
|---|---|---|
| spacing, sizes, positions | \`${p}-p-*\`, \`${p}-w-*\`, \`${p}-gap-*\`, \`${p}-top-*\`… | \`${p}-py-120\` |
${roles.map((r, i) => `| ${roleUse(r, i)} | \`${p}-${r}-*\` (size/line) | \`${p}-${r}-${r === big ? '64/72' : '16/24'}\` |`).join('\n')}
| a button, chip or icon around ${label} text | \`${p}-${label}-h-*\`, \`-px-*\`, \`-size-*\`… | \`${p}-${label}-h-56\` |
| text inside a box that scales with the layout | \`${p}-text-*\` | \`${p}-text-18/24\` |
${structure.ui ? `| the header, nav and footer | \`${p}-ui-*\` (text, h, px, gap…) | \`${p}-ui-h-48\` |\n` : ''}| the page wrapper (once per section) | \`${p}-container\` | |
| a strip that reaches the window edges | \`${p}-bleed-x\` | a carousel track |
${variantBands.length ? `| a tweak for one band below desktop | ${variantBands.map((b) => `\`${p}-${b}:\``).join(', ')} (desktop is \`lg:\`) | \`${p}-${variantBands.includes('tablet') ? 'tablet' : variantBands[0]}:${p}-px-32\` |\n` : ''}| part of the page that stops scaling | \`${p}-grow-until-*\`, \`${p}-shrink-until-*\`, \`${p}-off\` | \`${p}-grow-until-1680\` |

Write the number as drawn: \`${p}-py-120\` is 120px at your design frame's size. Bare numbers
in 0.25 steps work (\`${p}-p-37\`, \`${p}-p-8.5\`), anything else in brackets (\`${p}-p-[8.3]\`).
Not scaled, on purpose: border widths, letter-spacing (use \`em\`), text measures.`

  const otherTable = `| Unit | Use it for | Example |
|---|---|---|
| \`--fluid\` | spacing, sizes, positions | ${stack === 'scss' ? '`padding: fd.fluid(24)`' : stack === 'stylex' ? '`padding: fluid(24)`' : '`padding: calc(24 * var(--fluid))`'} |
${roles.map((r, i) => `| \`--fluid-${r}\` | ${roleUse(r, i)}; also a control around that text | ${stack === 'scss' ? `\`font-size: fd.${p}-${r}(16)\`` : stack === 'stylex' ? `\`fontSize: ${stylexFn(r)}(16)\`` : `\`font-size: calc(16 * var(--fluid-${r}))\``} |`).join('\n')}
${structure.ui ? `| \`--fluid-ui\` | the header, nav and footer | |\n` : ''}| \`--fluid-container-width\` / \`-padding\` | the page wrapper (\`.${p}-container\`) | |

Multiply a unitless drawn number: \`calc(64 * var(--fluid))\`, never \`64px * var(--fluid)\`
(the browser drops that silently). Not scaled, on purpose: border widths, letter-spacing
(use \`em\`), text measures.`

  return `<!-- fluid-design ${SKILL_VERSION} · GENERATED — do not edit. Run \`fluid generate\`. -->

# fluid

Generated by fluid-design from \`fluid.config.json\`. Don't edit this folder: change the config
and run \`fluid generate\`, or change a setting (below), which needs no regenerate.

## The idea

You write every size as drawn in the design. One unit, \`--fluid\`, is exactly 1px when the
window matches your design frame and grows or shrinks with the window, so the page scales as
one drawing. Each band (${bands.join(', ')}) scales its own design, and type shrinks more
gently than the layout so it stays readable.

## Set up

${'```css'}
${imp}
${'```'}
${zoomSetup}
## Which class for what

${tw ? twTable : otherTable}

## Tuning

Every number you tune is a CSS variable with a default. Set the ones you want to change in your
own \`:root\`, next to your tokens. Changes apply live, no regenerate:

${'```css'}
:root {
  --fluid-desktop-container-padding: 108; /* wider page margins */
  --fluid-phone-scale-min: 0.8;           /* how small the smallest phones get */
}
${'```'}

## The CLI

${'```bash'}
${CLI} settings          # every setting, its default and what it does
${CLI} explain 390x844   # what every unit is at a window size, and where each value came from
${CLI} check             # config, generated files and settings; put it in CI
${CLI} generate          # after editing fluid.config.json
${'```'}

(\`fluid init\` adds \`"fluid": "${CLI}"\` to your package.json scripts, so \`npm run fluid -- check\` works too.)

## Bands

${bands.map((b) => `- **${b}**: ${bandBlurb(structure, b).replace(/^\S+ — /, '')}.`).join('\n')}

## Files

${fileList.map((f) => `- \`${f}\``).join('\n')}
`
}
