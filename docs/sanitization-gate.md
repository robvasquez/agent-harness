# Sanitization gate

Update after the original audit: the token accounting method note and its README
link were added later. The case study's figures and text await owner approval.
The 34-file inventory and publication bundle below describe the earlier audited
snapshot; they exclude these later changes. Prepare a new publication bundle,
refresh the inventory and rerun the publication gate before publishing the
current tree. Local slice verification does not refresh that bundle.

Audit date: November 12, 2026. Scope: the complete local publication tree,
including hidden configuration files, and the separate publication bundle.
The two documentation files added by this audit are included in the final
tree checks. Runtime logs and private evidence stay outside the repository.

Automated result: pass for the reviewed publication bundle. Owner read-through and publication
are pending owner steps; this report does not approve publication.

## Checks

| Check | Scope and method | Result |
| --- | --- | --- |
| Gitleaks | Version 8.30.1, default rules, redacted output, inline allow comments ignored; filesystem and publication history | Pass |
| TruffleHog | Version 3.96.0, all detectors; filesystem and publication history; no credential verification, updates or remote calls; fail on findings and scan errors | Pass |
| Denylist | Mandatory repository policy over relative names and contents; no extra exclusions | Pass |
| Provenance | Inspect every file, local creation history, dependencies, license notices and fixture declarations | Pass |
| Independent security review | Separate reviewer reads the whole tree, audit claims and enforcement limits | Pass |
| Repository verification | `make test`: 323 passed; `make demo`: expected blocks and passes; whitespace and 34-file inventory checks | Pass |

Scanner commands, versions, exit statuses and the exact file hashes are retained
in local audit evidence. No finding suppression or custom scanner allowlist is
part of this gate. Scanners use their built-in rules and filtering; findings
were not restricted to credentials that could be verified online.

## Publication artifact and findings

Independent review found personal contact details in working-history author
metadata. File sanitization deliberately excludes Git administrative data;
secret scanners do not treat an ordinary contact address as a credential.
The working clone must not be pushed directly.

The publication source is `agent-harness-publication.bundle`, retained with
the local audit evidence. It contains one fresh root commit with generic
attribution and the exact reviewed files, without the working history, extra
refs or tags. Its restored contents and metadata receive the final checks.
The retained manifest records the bundle digest and each file digest. Any
later change requires a new bundle and gate run.

Review also confirmed two documented limits: a public salted denylist permits
dictionary membership guesses, and the prose file reader can follow a symlink
in a parent directory even though it rejects a symlink at the leaf file.
Concurrent writes remain possible. These are screening tools, not a filesystem
isolation or confidentiality guarantee.

## Provenance assessment

The local history starts with the repository scaffold and adds the public
mechanisms, their tests and the walkthrough. The prose guard adapts the owner's
private guard concept into a new implementation. The delegation checker
implements the owner's handoff fields in new Node.js code. Tests and fixtures
were written for this repository; real change descriptions and work items were
not copied. The walkthrough identifies its prose, pseudocode and role examples
as reconstructions, with original evidence kept private.

The tree contains no vendored package, lockfile, downloaded asset, bundled
library, copied skill pack or additional license header. Runtime imports use
Node.js built-ins and local modules. The MIT license is standard license text,
not an assertion of exclusive authorship of that text. CI references external
actions by immutable revision; Node.js, Bash, Make and shellcheck are external
tools, not redistributed source. The existing documentation link is a
reference, not reproduced documentation.

This assessment checks the retained local record and source. It does not prove
exclusive authorship or grant rights over private source material. The owner
must confirm those rights during read-through.

## Files reviewed

The inventory below covers every publication file, including this report.
Git administrative files and local audit outputs are outside the publication
tree. No additional files may be added without refreshing this gate.

| File | Review focus |
| --- | --- |
| `.github/workflows/ci.yml` | Local execution, dependency references and enforcement boundary |
| `.github/workflows/prose.yml` | Local execution, dependency references and enforcement boundary |
| `.gitignore` | Local execution, dependency references and enforcement boundary |
| `LICENSE` | Standard license text and owner attribution |
| `Makefile` | Local execution, dependency references and enforcement boundary |
| `README.md` | Publication claims, attribution and limits |
| `config/denylist.json` | Hashed policy format; no readable restricted terms |
| `delegation/README.md` | Publication claims, attribution and limits |
| `delegation/check.mjs` | Local execution, dependency references and enforcement boundary |
| `delegation/contract.mjs` | Local execution, dependency references and enforcement boundary |
| `delegation/delivery-report-parser.sh` | Local execution, dependency references and enforcement boundary |
| `delegation/demo.mjs` | Local execution, dependency references and enforcement boundary |
| `delegation/envelope-check.sh` | Local execution, dependency references and enforcement boundary |
| `delegation/fixtures.mjs` | Synthetic inputs and adversarial assertions |
| `docs/sanitization-gate.md` | Publication claims, attribution and limits |
| `docs/threat-model.md` | Publication claims, attribution and limits |
| `docs/walkthrough.md` | Publication claims, attribution and limits |
| `gates/README.md` | Publication claims, attribution and limits |
| `gates/check-event.mjs` | Local execution, dependency references and enforcement boundary |
| `gates/demo.mjs` | Local execution, dependency references and enforcement boundary |
| `gates/fixtures.mjs` | Synthetic inputs and adversarial assertions |
| `gates/hook.sh` | Local execution, dependency references and enforcement boundary |
| `gates/prose-guard.mjs` | Local execution, dependency references and enforcement boundary |
| `gates/self-test.sh` | Local execution, dependency references and enforcement boundary |
| `scripts/demo.sh` | Local execution, dependency references and enforcement boundary |
| `scripts/sanitize-check.mjs` | Local execution, dependency references and enforcement boundary |
| `scripts/sanitize-check.sh` | Local execution, dependency references and enforcement boundary |
| `scripts/test.sh` | Local execution, dependency references and enforcement boundary |
| `tests/delegation.test.mjs` | Synthetic inputs and adversarial assertions |
| `tests/event-guard.test.mjs` | Synthetic inputs and adversarial assertions |
| `tests/prose-guard.test.mjs` | Synthetic inputs and adversarial assertions |
| `tests/prose-policy.test.mjs` | Synthetic inputs and adversarial assertions |
| `tests/sanitize-check.test.mjs` | Synthetic inputs and adversarial assertions |
| `tests/scaffold.test.mjs` | Synthetic inputs and adversarial assertions |

## Owner steps

1. Read every file in the inventory and confirm the provenance and disclosure
   decisions, including reconstructed artifacts and the hashed term policy.
2. Verify the separate publication bundle against the retained audit evidence,
   then inspect its restored tree and generic attribution. Use that bundle,
   not the local working history; rerun the gate after any change.
3. Create the destination repository and publish personally from the reviewed
   bundle. Configure required checks and review rules there. No agent has created a hosted repository,
   configured a remote or pushed as part of this audit.

These steps remain pending. A clean automated gate is evidence for the owner,
not a substitute for the publication decision. See the
[threat model](threat-model.md) for mitigations and residual risks.
