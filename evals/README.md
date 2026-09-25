# Evaluation fixtures

Four layers, each answering one question about `skills/fluid-design`, so a regression points at
the part that broke: the description, the route table, the method, or a compression pass.

| Layer | Question | What the cases exercise here |
|---|---|---|
| `activation/` | Should the skill trigger? | 9 should-trigger prompts, most never saying "fluid" (a 1440 frame on every laptop, a hero that overflows a 13-inch MacBook, a page floating on a 5K monitor, a huge header on 2560, iOS `100vh`, a stale stylesheet after a restart) plus two explicit `$fluid-design` calls; 7 near misses owned by neighbours (a pinned scroll scene and scroll reveals → `scroll-animation`, breakpoint-only responsive CSS, a Utopia `clamp()` type scale, a colour theme, a component library, a z-index bug). |
| `traversal/` | Did the skill read the smallest sufficient reference set? | Each case names `expected_references` (paths under `skills/fluid-design/`, derived from SKILL.md's route table and each reference's *Read when* / *Skip when*) and `forbidden_references` whose reading would signal a routing miss. Cases on an already-set-up project leave `preflight.md` out, per its *Skip when*. |
| `output/` | Did the work satisfy the artifact and completion contracts? | Six end-to-end cases (greenfield Next + Tailwind, Vite + SCSS with non-default settings, stale-stylesheet diagnosis, browser zoom, an existing shadcn `cn`, a header that stops scaling), each with its assertions. |
| `compression-ablation/` | Does a shorter SKILL.md keep quality relative to the current one and a no-skill baseline? | Four prompts that each hinge on one load-bearing instruction (`load_bearing_instruction`): the header limit as a `:root` setting, never hand-editing the generated folder, type through roles with the drawn px, and running the verification gates before claiming done. |

`scripts/check-sync` (through `scripts/lint-skill`) validates every layer: each file is a
non-empty JSON array with no placeholders, activation has both trigger values, and every traversal
path exists in the pack. Update a traversal case whenever a reference is renamed or a route moves.

## Running the output layer

`output/cases.json` is the portable fixture shape (`id`, `prompt`, `expected_output`,
`assertions`, `source`). `output/evals.json` keeps the same six cases in the skill-creator format
this repository used before the template, and is what a skill-creator run consumes.

Cases 1–4 are graded against their assertions by a reviewer (the generated engine, utility counts,
`fluid check`, `fluid audit`, `fluid verify`). Cases 5 and 6 (`shadcn-cn-with-fluid`,
`header-stops-scaling`) have a scripted grader:

```bash
node evals/output/grade.mjs <workspace>/iteration-N
```

It expects each `eval-5-…/with_skill` and `eval-6-…/with_skill` run to hold `project/` (the
fixture, git-initialised before the run) and `outputs/response.md`, runs the pack's own
`skills/fluid-design/bin/fluid check` inside each project, and writes `grading.json` next to the
run.
