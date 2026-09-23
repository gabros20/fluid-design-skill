// Measures style-recalc / layout cost for the three test pages (fluid var()+calc(),
// literal px, and per-declaration clamp()) during viewport resize sweeps, using
// Chromium's CDP Performance domain (cumulative counters: RecalcStyleDuration,
// LayoutDuration, RecalcStyleCount, LayoutCount, TaskDuration).
//
// Usage: node measure.mjs <baseUrl>
// e.g.   node measure.mjs http://127.0.0.1:52567

import { chromium } from 'playwright';

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('usage: node measure.mjs <baseUrl>');
  process.exit(1);
}

const PAGES = process.argv[3]
  ? process.argv.slice(3)
  : ['page-fluid.html', 'page-px.html', 'page-clamp.html'];

function metricsToMap(metrics) {
  const m = {};
  for (const { name, value } of metrics) m[name] = value;
  return m;
}
function diffMetrics(a, b) {
  const out = {};
  for (const k of Object.keys(b)) {
    if (typeof b[k] === 'number' && typeof a[k] === 'number') out[k] = b[k] - a[k];
  }
  return out;
}

async function forceLayout(page) {
  await page.evaluate(() => {
    // force synchronous style recalc + layout
    return document.body.getBoundingClientRect().height + document.getElementById('grid').offsetWidth;
  });
}

async function widthSweep(page, steps = 20) {
  const t0 = Date.now();
  for (let i = 0; i <= steps; i++) {
    const w = Math.round(1024 + (1920 - 1024) * (i / steps));
    await page.setViewportSize({ width: w, height: 900 });
    await forceLayout(page);
  }
  return Date.now() - t0;
}

async function heightSweep(page, steps = 20) {
  const t0 = Date.now();
  for (let i = 0; i <= steps; i++) {
    const h = Math.round(700 + (1200 - 700) * (i / steps));
    await page.setViewportSize({ width: 1440, height: h });
    await forceLayout(page);
  }
  return Date.now() - t0;
}

async function measurePage(browser, file) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');

  // --- time to first layout / paint ---
  const navStart = Date.now();
  await page.goto(`${baseUrl}/${file}`, { waitUntil: 'load' });
  await forceLayout(page);
  const loadWallMs = Date.now() - navStart;

  const paintTimings = await page.evaluate(() => {
    const entries = performance.getEntriesByType('paint').map((e) => ({ name: e.name, startTime: e.startTime }));
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      entries,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      loadEventEnd: nav ? nav.loadEventEnd : null,
      responseEnd: nav ? nav.responseEnd : null,
    };
  });

  // Baseline metrics right after initial load+layout settle.
  const base = metricsToMap((await client.send('Performance.getMetrics')).metrics);

  // --- WIDTH sweep ---
  const widthWallMs = await widthSweep(page);
  const afterWidth = metricsToMap((await client.send('Performance.getMetrics')).metrics);
  const widthDelta = diffMetrics(base, afterWidth);

  // --- HEIGHT sweep (fresh baseline so it isn't polluted by width sweep) ---
  await page.setViewportSize({ width: 1440, height: 900 });
  await forceLayout(page);
  const baseForHeight = metricsToMap((await client.send('Performance.getMetrics')).metrics);
  const heightWallMs = await heightSweep(page);
  const afterHeight = metricsToMap((await client.send('Performance.getMetrics')).metrics);
  const heightDelta = diffMetrics(baseForHeight, afterHeight);

  await context.close();

  return {
    file,
    loadWallMs,
    paintTimings,
    widthWallMs,
    widthDelta,
    heightWallMs,
    heightDelta,
  };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const file of PAGES) {
  // warmup run (font/GPU/caches), then N measured trials, report median
  await measurePage(browser, file);
  const trials = [];
  for (let i = 0; i < 4; i++) trials.push(await measurePage(browser, file));

  const summary = {
    file,
    loadWallMs_median: median(trials.map((t) => t.loadWallMs)),
    paintTimings: trials[0].paintTimings,
    widthWallMs_median: median(trials.map((t) => t.widthWallMs)),
    width_RecalcStyleDuration_ms_median: median(trials.map((t) => t.widthDelta.RecalcStyleDuration)),
    width_LayoutDuration_ms_median: median(trials.map((t) => t.widthDelta.LayoutDuration)),
    width_RecalcStyleCount_median: median(trials.map((t) => t.widthDelta.RecalcStyleCount)),
    width_LayoutCount_median: median(trials.map((t) => t.widthDelta.LayoutCount)),
    width_TaskDuration_ms_median: median(trials.map((t) => t.widthDelta.TaskDuration)),
    heightWallMs_median: median(trials.map((t) => t.heightWallMs)),
    height_RecalcStyleDuration_ms_median: median(trials.map((t) => t.heightDelta.RecalcStyleDuration)),
    height_LayoutDuration_ms_median: median(trials.map((t) => t.heightDelta.LayoutDuration)),
    height_RecalcStyleCount_median: median(trials.map((t) => t.heightDelta.RecalcStyleCount)),
    height_LayoutCount_median: median(trials.map((t) => t.heightDelta.LayoutCount)),
    height_TaskDuration_ms_median: median(trials.map((t) => t.heightDelta.TaskDuration)),
    raw_trials: trials,
  };
  results.push(summary);
  console.log(`done: ${file} (4 trials)`);
}
await browser.close();

console.log(JSON.stringify(results, null, 2));
