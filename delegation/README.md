# Delegation contract

A lead sends a context envelope before a specialist starts work. The specialist returns a delivery report. Both use a small Markdown format so a person can read the handoff and a program can check it.

Run `make demo` to see a valid envelope, a malformed envelope, a valid report and a contradictory report. Every example was written for this repository. Nothing needs an account or an external service.

## Context envelope

```markdown
## CONTEXT
- Goal: Keep the sample formatter deterministic.
- Task: Handle empty input in the formatter.
- Scope: src/format.mjs, tests/format.test.mjs
- Done-when:
  - Empty input produces an empty string.
  - The formatter tests pass.
- Constraints:
  - Keep the exported function signature.
  - Use the existing test runner.
```

Goal describes the outcome. Task states the work to do. Scope lists allowed repository paths; a trailing slash means a directory prefix. Done-when gives observable completion conditions. Constraints records limits that the specialist must follow. All five fields must be present and nonempty.

## Delivery report

```markdown
## DELIVERY
- Status: complete
- Files: src/format.mjs, tests/format.test.mjs
- Decisions: Return an empty string for empty input.
- Warnings: none
- Blockers: none
- Confidence: high
- Open questions: none
- Assumptions made: Input is a string.
```

All eight fields are required, including fields whose value is `none`. Status is exactly `complete`, `partial` or `blocked`. Confidence is exactly `high`, `medium` or `low`. A complete report with blockers fails validation. A blocked report must describe at least one blocker. Partial reports can have blockers or none.

Files, decisions, warnings, blockers, open questions and assumptions become arrays in the JSON result. A valid report can still describe blocked work; its coordinator must inspect status before continuing.

## Syntax and commands

Save one block to a file and pass it on standard input:

```bash
bash delegation/envelope-check.sh < context.md
bash delegation/delivery-report-parser.sh < delivery.md
```

The commands accept no arguments. They print one JSON object with `valid`, `errors`, and either `envelope` or `report`. The parsed object is `null` when validation fails. Exit codes are 0 for valid input, 1 for invalid input, and 2 for a bad invocation. No input is executed or written to disk.

Use the exact headings and field names shown above, each once. Fields start with `- `. A field can have a value on the same line, or list items on following lines indented by two spaces. Inline path lists use commas. Other inline list fields contain one item. Write `none` alone for an empty report list. Scope, Done-when and Constraints cannot be empty; Goal and Task are single-line values.

Blank lines and CRLF line endings are accepted. Surrounding prose, extra headings, unknown fields, duplicate fields, code fences, copied placeholders and control or invisible format characters are rejected. Input is limited to 64 KiB of UTF8. Paths use ASCII letters, digits, dots, underscores, hyphens and forward slashes. Absolute paths, dot segments, empty segments, encoded paths and wildcards are rejected. Files must name a path without a trailing slash.

## Enforcement boundary

These checks port the delivery fields used by the local harness into a standalone Node implementation. The public version is stricter than a prose extractor: it fails on malformed input and contradictions instead of recording a partial parse. It needs only the repository's existing Bash and Node runtime.

Validation checks structure and a few explicit consistency rules. It cannot prove that tests ran, that the listed files changed, that scope was respected, or that a constraint was followed. A plausible but false report can pass. The checks do not compare reports with envelopes or inspect filesystem targets, so a safe-looking path can still refer through a symlink. They reject the whole document to keep fields inside fenced examples from satisfying a real handoff.

The coordinator must compare the actual diff with scope and run the completion checks independently. CI runs the parser and checker regression tests through `make test`; it does not intercept every future handoff. A caller can bypass validation by skipping these commands or ignoring their exit codes. Integrations own the decision to stop work on a failed check.
