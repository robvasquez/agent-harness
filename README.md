# Agent harness

An agent can produce a plausible handoff and pass tests while changing behavior
that nobody tested. This repository shows how explicit handoffs, independent
review and executable checks help catch those gaps.

The [walkthrough](docs/walkthrough.md) traces a shared work-order extraction where
the first green suite missed a mutation timing regression. Independent review
caught it; a targeted test checked the ordering requirement. Each artifact is
labelled by its source and reconstruction limits.

The [token accounting method note](docs/case-study.md) uses one local usage
sample and explains why it cannot establish savings from knowledge grounding.

```text
Scope and completion criteria
             |
     Checked context envelope
             |
      Agent implementation <---- Correction
             |                       ^
      Checked delivery report        |
             |                       |
   Independent review + tests -------+
             |
       Owner merge decision
```

The diagram sketches the intended workflow; the walkthrough labels what the
retained record supports. The runnable demos exercise the prose gate and
handoff validators with synthetic examples.

## Quickstart

Use Bash 3.2 or newer, Node.js 22 or newer, and Make. Install shellcheck to run
the full test suite. The demos need no accounts, credentials or package installs.

After cloning this repository, enter its directory:

```sh
cd agent-harness
make demo
make test
```

`make demo` blocks a proposed pull request body with readable reasons, then
accepts a revised body. It also accepts a valid envelope and report, rejects a
malformed envelope, and catches a report that claims completion while listing
blockers. It sends nothing and does not install hooks.

`make test` runs shellcheck, the repository sanitization check and all regression
tests. Both commands exit successfully when the expected blocks and passes hold.

## What the checks enforce

| Check | What it checks | Details |
| --- | --- | --- |
| Outbound prose | Supported proposed commands and extracted text for local paths, internal markers and writing-policy violations | [Prose gate](gates/README.md) |
| Delegation | Required fields, allowed path syntax and explicit contradictions in envelopes and delivery reports | [Delegation contract](delegation/README.md) |
| Repository sanitization | File contents and relative names against hashed restricted terms and identifier patterns | [Scanner](scripts/sanitize-check.sh), [policy implementation](scripts/sanitize-check.mjs) |

The local prose adapter checks proposed commands without executing them. A tool
integration must cancel the operation when it returns a blocking exit status.
The supplied CI workflows run tests and sanitization, and separately check
supported event text with the prose policy. The owner must enable Actions and
configure required checks and review rules in the destination repository.

## What this does not stop

- A caller can skip a validator, ignore its exit status, disable a hook or use
  another terminal, API or web interface. This repository does not configure
  those integrations or repository protections.
- A valid report can contain false claims. The coordinator must inspect the
  actual diff, compare it with scope and run completion checks independently.
  The public demo does not rerun the historical product tests in the walkthrough.
- Pattern checks can miss unknown identifiers, encoded text and unmapped Unicode
  look-alikes. The sanitization policy's hashes are a screening mechanism, not
  encryption; writing rules can produce false positives.
- Content can change between checking and sending. Server event checks happen
  after publication, cover only supported event fields and can become stale
  after edits. They cannot retract exposed content or scan every past message.

The owner controls workflow and policy changes, review requirements and any
publication decision. See the detailed [prose bypasses](gates/README.md#bypasses-and-limits)
and [delegation boundary](delegation/README.md#enforcement-boundary) before
integrating these checks. Sanitization supplements secret scanning and human
review; it does not establish that a repository is safe to publish.

[MIT license](LICENSE).
