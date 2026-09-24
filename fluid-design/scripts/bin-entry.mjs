// bin-entry.mjs — the entry `bun build --compile` bundles into the standalone
// `fluid` binary (scripts/build-bin.mjs). bin/fluid is the same thing for node.
//
// The flag is set BEFORE cli.mjs loads (a dynamic import, not a hoisted
// static one): the CLI must know it is the binary without guessing from its
// module URL, which is /$bunfs/… on macOS and Linux but B:/~BUN/… on Windows.
globalThis.__fluidBinary = true
const { run } = await import('./cli.mjs')
await run(process.argv.slice(2))
