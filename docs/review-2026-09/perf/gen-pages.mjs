// Generates three test pages: fluid (var()+calc()), px (literal), clamp (Utopia-style per-decl clamp).
// Each page: ~1500 elements, each with 4 sized declarations (padding, font-size, width, gap/margin),
// drawn from a cycling set of 30 "design sizes" so the CSS resembles a real atomic-class sheet
// (30 distinct classes reused ~50x each) rather than 1500 unique rules.

import fs from 'node:fs';

const N_ELEMENTS = 1500;
const N_SIZES = 30;
const REFERENCE_W = 1440;
const REFERENCE_H = 900;

// Design numbers (unitless, "design px at reference") for each of the 30 size classes.
// Spread across a plausible real range: padding 8-64, font 12-72, width 60-400, gap 4-32.
function sizesFor(i) {
  const t = i / (N_SIZES - 1);
  return {
    pad: Math.round(8 + t * 56),
    font: Math.round(12 + t * 60),
    width: Math.round(60 + t * 340),
    gap: Math.round(4 + t * 28),
  };
}

function fluidRootCSS() {
  return `
:root {
  --fluid: 1px;
}
@media (width >= 1024px) {
  :root {
    --fluid: max(0.58px, min(calc(100svh / ${REFERENCE_H}), calc(100vw / ${REFERENCE_W})));
  }
}
`;
}

function genFluidCSS() {
  let css = fluidRootCSS();
  for (let i = 0; i < N_SIZES; i++) {
    const s = sizesFor(i);
    css += `.sz-${i} { padding: calc(${s.pad} * var(--fluid)); font-size: calc(${s.font} * var(--fluid)); width: calc(${s.width} * var(--fluid)); margin-bottom: calc(${s.gap} * var(--fluid)); }\n`;
  }
  return css;
}

function genPxCSS() {
  // Literal px equivalents computed AT the reference viewport (1440x900 -> fluid=1px there),
  // i.e. identical visual result at reference, but no calc/var indirection at all.
  let css = '';
  for (let i = 0; i < N_SIZES; i++) {
    const s = sizesFor(i);
    css += `.sz-${i} { padding: ${s.pad}px; font-size: ${s.font}px; width: ${s.width}px; margin-bottom: ${s.gap}px; }\n`;
  }
  return css;
}

function genClampCSS() {
  // Utopia-style: one clamp() per declaration, min/max computed at two breakpoints (1024 and 1920),
  // using vw directly (no custom property indirection).
  const MIN_VW = 1024, MAX_VW = 1920;
  let css = '';
  for (let i = 0; i < N_SIZES; i++) {
    const s = sizesFor(i);
    css += `.sz-${i} { ${clampDecl('padding', s.pad, MIN_VW, MAX_VW)} ${clampDecl('font-size', s.font, MIN_VW, MAX_VW)} ${clampDecl('width', s.width, MIN_VW, MAX_VW)} ${clampDecl('margin-bottom', s.gap, MIN_VW, MAX_VW)} }\n`;
  }
  return css;

  function clampDecl(prop, designPx, minVw, maxVw) {
    // scale factor identical to our system: value_at_1440 = designPx (i.e. designPx IS the value at 1440).
    // Utopia formula: slope = (max - min) / (maxVw - minVw); here we just use fluid ratio design directly,
    // min value = designPx * (minVw/1440), max value = designPx * (maxVw/1440) -- same proportional system,
    // just resolved as a literal clamp with vw instead of var(--fluid).
    const minPx = designPx * (minVw / REFERENCE_W);
    const maxPx = designPx * (maxVw / REFERENCE_W);
    const slope = (maxPx - minPx) / (maxVw - minVw);
    const intercept = minPx - slope * minVw;
    const slopeVw = (slope * 100).toFixed(6);
    const interceptPx = intercept.toFixed(4);
    return `${prop}: clamp(${minPx.toFixed(3)}px, ${interceptPx}px + ${slopeVw}vw, ${maxPx.toFixed(3)}px);`;
  }
}

function genBody() {
  let body = '<div id="grid" style="display:flex; flex-wrap:wrap; align-items:flex-start;">\n';
  for (let i = 0; i < N_ELEMENTS; i++) {
    const sz = i % N_SIZES;
    body += `<div class="item sz-${sz}">Item ${i}</div>\n`;
  }
  body += '</div>\n';
  return body;
}

function wrap(name, css) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${name}</title>
<style>
html, body { margin:0; padding:0; }
.item { box-sizing: border-box; border: 1px solid #ccc; background:#f5f5f5; overflow:hidden; }
${css}
</style>
</head>
<body>
${genBody()}
<script>
window.__ready = true;
</script>
</body>
</html>`;
}

fs.writeFileSync(new URL('./page-fluid.html', import.meta.url), wrap('fluid', genFluidCSS()));
fs.writeFileSync(new URL('./page-px.html', import.meta.url), wrap('px', genPxCSS()));
fs.writeFileSync(new URL('./page-clamp.html', import.meta.url), wrap('clamp', genClampCSS()));

console.log('Generated page-fluid.html, page-px.html, page-clamp.html —', N_ELEMENTS, 'elements,', N_SIZES, 'size classes each.');

// --- "worst case" variant: every element gets a UNIQUE declaration set (defeats
// Blink's matched-property-cache / style-sharing that the 30-shared-class pages
// above benefit from). Tests whether per-element uniqueness — closer to a literal
// reading of "1500 elements each with their own calc()s" — changes the recalc cost.

function genUniqueBody(cssBuilder) {
  let css = '';
  let body = '<div id="grid" style="display:flex; flex-wrap:wrap; align-items:flex-start;">\n';
  for (let i = 0; i < N_ELEMENTS; i++) {
    const s = sizesFor(i % N_SIZES); // same value range, but every element gets its OWN class/rule
    css += cssBuilder(i, s);
    body += `<div class="u-${i}">Item ${i}</div>\n`;
  }
  return { css, body };
}

function fluidUniqueCSS() {
  const { css, body } = genUniqueBody(
    (i, s) =>
      `.u-${i} { padding: calc(${s.pad} * var(--fluid)); font-size: calc(${s.font} * var(--fluid)); width: calc(${s.width} * var(--fluid)); margin-bottom: calc(${s.gap} * var(--fluid)); }\n`
  );
  return { css: fluidRootCSS() + css, body };
}

function clampUniqueCSS() {
  const MIN_VW = 1024, MAX_VW = 1920;
  function clampDecl(prop, designPx, minVw, maxVw) {
    const minPx = designPx * (minVw / REFERENCE_W);
    const maxPx = designPx * (maxVw / REFERENCE_W);
    const slope = (maxPx - minPx) / (maxVw - minVw);
    const intercept = minPx - slope * minVw;
    return `${prop}: clamp(${minPx.toFixed(3)}px, ${intercept.toFixed(4)}px + ${(slope * 100).toFixed(6)}vw, ${maxPx.toFixed(3)}px);`;
  }
  const { css, body } = genUniqueBody(
    (i, s) =>
      `.u-${i} { ${clampDecl('padding', s.pad, MIN_VW, MAX_VW)} ${clampDecl('font-size', s.font, MIN_VW, MAX_VW)} ${clampDecl('width', s.width, MIN_VW, MAX_VW)} ${clampDecl('margin-bottom', s.gap, MIN_VW, MAX_VW)} }\n`
  );
  return { css, body };
}

function wrapUnique(name, css, body) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${name}</title>
<style>
html, body { margin:0; padding:0; }
.item, [class^="u-"] { box-sizing: border-box; border: 1px solid #ccc; background:#f5f5f5; overflow:hidden; }
${css}
</style>
</head>
<body>
${body}
<script>window.__ready = true;</script>
</body>
</html>`;
}

const fu = fluidUniqueCSS();
const cu = clampUniqueCSS();
fs.writeFileSync(new URL('./page-fluid-unique.html', import.meta.url), wrapUnique('fluid-unique', fu.css, fu.body));
fs.writeFileSync(new URL('./page-clamp-unique.html', import.meta.url), wrapUnique('clamp-unique', cu.css, cu.body));
console.log('Generated page-fluid-unique.html, page-clamp-unique.html — 1500 elements, each with its OWN rule (no shared classes).');
