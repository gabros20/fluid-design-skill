# Evaluation fixtures

These fixtures test four different questions independently:

- `activation/`: should the skill trigger?
- `traversal/`: did the selected skill read the smallest sufficient reference set?
- `output/`: did the work satisfy its artifact and completion contracts?
- `compression-ablation/`: does a shorter candidate preserve quality relative to the current skill
  and a no-skill baseline?

Replace every placeholder case with realistic prompts before release. Keep expected and forbidden
reads explicit so routing regressions are diagnosable.

`output/` also keeps the skill-creator format this repository used before the template:
`output/evals.json` (six end-to-end cases with shell-checkable assertions) and `output/grade.mjs`
(the scripted grader for cases 5 and 6: `node evals/output/grade.mjs <workspace>/iteration-N`).
`output/cases.json` carries the same six cases in the portable fixture shape.
