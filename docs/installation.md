# Installation

`fluid-design` ships from one repository, `gabros20/fluid-design-skill`, through three channels.
All three run the same `fluid` CLI and generate the same files, so pick by who does the work:

| You are | Channel | Section |
|---|---|---|
| An agent (Claude Code, Codex, Cursor, …) | the skill folder | [The agent skill](#the-agent-skill) |
| A developer in a Node project | the npm package `fluid-design-cli` | [npm](#npm-fluid-design-cli) |
| A developer without Node (Rails, Django, Laravel, Phoenix, Hugo, plain HTML) | the standalone binary | [The standalone binary](#the-standalone-binary) |

A project needs the CLI only when it changes the structure (`fluid.config.json`) and in CI. The
generated files are committed, and nothing is added to the project's dependencies.

## Prerequisites

- **The agent skill:** an Agent Skills-compatible client, and Node 20 or newer on the machine (the
  agent runs `node <skill>/bin/fluid`).
- **npm:** Node 20 or newer.
- **The binary:** nothing. macOS (arm64, x64), Linux (x64, arm64) and Windows (x64).
- **Only for `fluid verify` and `fluid explain --url` / `fluid probe`:** Node and Playwright in the
  project, with Chromium for the browser-zoom row:

  ```bash
  npm i -D playwright && npx playwright install chromium
  ```

  `verify --browser webkit` and `--browser firefox` need those browsers installed too
  (`npx playwright install webkit firefox`).

## The agent skill

With skills.sh:

```bash
npx skills add gabros20/fluid-design-skill
```

Or clone and install for a specific client:

```bash
git clone https://github.com/gabros20/fluid-design-skill.git
cd fluid-design-skill
./install.sh claude
```

| Argument | Destination |
|---|---|
| `claude` (the default) | `~/.claude/skills/fluid-design/` |
| `codex` | `${CODEX_HOME:-$HOME/.codex}/skills/fluid-design/` |
| `agents` | `~/.agents/skills/fluid-design/` |
| `cursor` | `~/.cursor/skills/fluid-design/` |
| `antigravity` | `~/.gemini/config/skills/` and `~/.gemini/antigravity-cli/skills/` |
| `opencode` | `~/.config/opencode/skills/fluid-design/` |
| `grok` | `~/.grok/skills/fluid-design/` |
| `hermes` | `~/.hermes/skills/fluid-design/` |
| `all` | Claude, Codex, and the cross-agent path |

The installer copies only the runtime pack (`SKILL.md`, `references/`, `assets/`, `bin/`,
`scripts/`, `agents/`). It stages a complete copy before replacing an existing installation and
restores the previous copy if the replacement fails.

**Verify.** Start a new client session and invoke it the way your client supports: `$fluid-design`
in Codex, `/fluid-design` in slash-command clients, or an `@` mention, skill tool or plain request
elsewhere. Check the CLI from the installed folder:

```bash
node ~/.claude/skills/fluid-design/bin/fluid --version
```

If the project already uses `npx fluid-design-cli` or the binary, the agent uses that one rather
than installing a second.

## npm: `fluid-design-cli`

Nothing to install. Run it through `npx`, pinned to the major version:

```bash
npx fluid-design-cli@2 init
npx fluid-design-cli@2 check
```

The package's command is `fluid`, so a project that adds it as a dev dependency
(`npm i -D fluid-design-cli@2`) can run `npx fluid …` or call `fluid` from its `package.json`
scripts.

## The standalone binary

macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.ps1 | iex
```

The installer picks the build for your OS and CPU, checks it against the release's `SHA256SUMS`, and
refuses to install on a mismatch. It installs to `~/.local/bin/fluid` (Windows:
`%LOCALAPPDATA%\fluid`) and tells you if that folder is not on your `PATH`. Environment variables:

| Variable | Default | Effect |
|---|---|---|
| `FLUID_VERSION` | the latest release | a release tag to install, e.g. `v2.0.0` |
| `FLUID_INSTALL_DIR` | `~/.local/bin` (Windows: `%LOCALAPPDATA%\fluid`) | where the binary goes |
| `FLUID_DOWNLOAD_BASE` | the GitHub release | a mirror to download from (`install-cli.sh` only) |

The binaries are also attached to every
[GitHub Release](https://github.com/gabros20/fluid-design-skill/releases) as `fluid-darwin-arm64`,
`fluid-darwin-x64`, `fluid-linux-x64`, `fluid-linux-arm64` and `fluid-windows-x64.exe`.

**What the binary cannot do.** `fluid verify`, `fluid explain --url` and `fluid probe` drive a real
browser through Playwright, a Node library. The binary stops with exit code 2 and prints the
equivalent `npx fluid-design-cli@2 …` command. Everything else (`init`, `generate`, `check`,
`settings`, `explain` without `--url`, `migrate`, `calc`, `audit`) works without Node.

## Pinning and upgrades

- **Pin one version across the team.** `fluid check` warns when the generated folder was written by
  a different version of the CLI. Use the same `npx fluid-design-cli@2` (or an exact `@2.0.0`) in CI
  and in scripts, and install the same binary release (`FLUID_VERSION=v2.0.0`) on every laptop.
- **Upgrade the npm channel** by changing the version in the command; `npx` fetches it.
- **Upgrade the binary** by running the installer again; it replaces the old binary.
- **Upgrade the skill** from the clone:

  ```bash
  cd fluid-design-skill
  git pull --ff-only
  ./install.sh claude
  ```

  or run `npx skills add gabros20/fluid-design-skill` again.
- **After any upgrade,** run `fluid generate` in each project and commit the regenerated folder;
  then `fluid check`.
- **From fluid-design v1:** `fluid migrate --write` (see [usage.md](usage.md#6-change-the-structure)).

Version history: [CHANGELOG.md](../CHANGELOG.md) and the
[GitHub Releases](https://github.com/gabros20/fluid-design-skill/releases). The runtime `SKILL.md`
carries no version metadata.

## Uninstall

The skill (use the destination for your client from the table above):

```bash
rm -rf ~/.claude/skills/fluid-design
```

The binary:

```bash
rm ~/.local/bin/fluid    # or your FLUID_INSTALL_DIR
```

On Windows, delete `%LOCALAPPDATA%\fluid` (or your `FLUID_INSTALL_DIR`) and, if you added it,
remove it from your user `PATH`.

The npm channel leaves nothing behind except `npx`'s cache (or the dev dependency, if you added
one: `npm rm fluid-design-cli`).

A project keeps working without the CLI: the generated folder is plain CSS (and TypeScript), and
`fluid.config.json` only matters when you regenerate.
