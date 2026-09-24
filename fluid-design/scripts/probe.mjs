#!/usr/bin/env node
// probe.mjs — kept for old commands: `fluid probe` is now
// `fluid explain <W>x<H> --url <url> --brief` (one live-page reader,
// lib/live.mjs). Verdicts OK / STALE / MISMATCH / V1 / MISSING; exit codes
// 0 · 1 · 2.
//
//   node probe.mjs <url> [--config f] [--width 1440] [--height 900]

import { run } from './cli.mjs'

await run(['probe', ...process.argv.slice(2)])
