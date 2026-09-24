// bin-entry.mjs — the entry `bun build --compile` bundles into the standalone
// `fluid` binary (scripts/build-bin.mjs). bin/fluid is the same thing for node.
import { run } from './cli.mjs'
await run(process.argv.slice(2))
