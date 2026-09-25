# Installation

Install the `fluid-design` runtime pack from the independently versioned
`gabros20/fluid-design-skill` repository.

## Prerequisites

- An Agent Skills-compatible client.
- TODO: Add only real skill-specific tools, credentials, or runtime requirements.

## Install with skills.sh

```bash
npx skills add gabros20/fluid-design-skill
```

## Clone and install

```bash
git clone https://github.com/gabros20/fluid-design-skill.git
cd fluid-design-skill
./install.sh codex
```

Available targets:

| Argument | Destination |
|---|---|
| `codex` | `${CODEX_HOME:-$HOME/.codex}/skills/fluid-design/` |
| `agents` | `~/.agents/skills/fluid-design/` |
| `claude` | `~/.claude/skills/fluid-design/` |
| `cursor` | `~/.cursor/skills/fluid-design/` |
| `antigravity` | Gemini IDE and Antigravity CLI skill paths |
| `opencode` | `~/.config/opencode/skills/fluid-design/` |
| `grok` | `~/.grok/skills/fluid-design/` |
| `hermes` | `~/.hermes/skills/fluid-design/` |
| `all` | Claude, Codex, and the cross-agent path |

The installer stages a complete copy before replacing an existing installation. If replacement
fails, it restores the previous copy.

## Verify

Start a new client session and use the client's supported invocation form:

- Codex: `$fluid-design`
- Slash-command clients: `/fluid-design`
- Other clients: an `@` mention, skill tool, or natural-language trigger

For Codex, verify the installed files directly:

```bash
test -f "${CODEX_HOME:-$HOME/.codex}/skills/fluid-design/SKILL.md"
```

## Update

```bash
cd fluid-design-skill
git pull --ff-only
./install.sh codex
```

Review `CHANGELOG.md` and GitHub Releases for version history. Version metadata intentionally stays
outside runtime `SKILL.md`.

## Uninstall

```bash
rm -rf "${CODEX_HOME:-$HOME/.codex}/skills/fluid-design"
```
