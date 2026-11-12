# A shared work-order domain, and a timing regression

GaragePulse needed the same work-order logic on web and mobile. The extraction
moved hooks, types and validation into a shared domain, with a small transport
adapter for each platform. The first implementation changed when a successful
mutation completed. Independent review caught the regression and prompted a
test that the initial suite was missing.

This account traces that work through its merge. Rob approved the task choice
and this account's attribution limits on November 12, 2026. He will read every
file again before public publication.

## How to read the artifacts

**Captured** means a retained task document, code revision, test or verification
report from the work. **Distilled** means a later memory of a decision.
**Reconstructed** means an explanation or example written for this walkthrough.

Captured sources remain private. Their summaries below are reconstructed;
they are not verbatim excerpts or public links to the originals. The private
evidence index maps each source to its retained location and revision. No
original handoff envelope or standalone review transcript was recovered.

| Step | Source artifact | Form shown here |
| --- | --- | --- |
| Written scope | Captured extraction task and parent plan | Reconstructed scope summary |
| Delegation and routing | Distilled architecture and role decisions | Reconstructed envelope and role definitions |
| Agent output | Captured initial code revision | Reconstructed behavior sketch |
| Caught mistake | Captured review-remediation report and corrective patch | Reconstructed finding and test sequence |
| Rob's decision | Distilled architecture decision | Reconstructed decision summary |
| Final verification | Captured verification report | Reconstructed results table |
| Merge | Captured merge object and commit ancestry | Reconstructed inclusion summary |

## Written scope

Artifact: **reconstructed from the captured task**.

Move work-order hooks, types and schemas into one domain package. Keep web
behavior, including mutation completion timing. Give web and mobile narrow
transport adapters. Prove the shared hooks can render real work orders on the
simulator.

The extraction was meant to share behavior across platforms. Existing query
keys and mutation behavior were part of the contract to preserve.

## Delegation and routing

Artifact: **reconstructed envelope from the task and distilled decisions**.
The paths are generic examples created here, not original source paths. This
uses the public [delegation contract](../delegation/README.md).

```markdown
## CONTEXT
- Goal: Share work-order behavior between web and mobile.
- Task: Extract the domain and connect each platform through a transport adapter.
- Scope: domain/work-orders/, web/work-order-adapter.ts, mobile/work-order-adapter.ts
- Done-when:
  - Web keeps its existing query keys and mutation completion behavior.
  - Both adapters use the shared domain.
  - A simulator renders work orders obtained through the mobile adapter.
- Constraints:
  - Keep platform dependencies outside the shared domain.
  - Have independent review examine behavioral parity before merge.
```

Only the roles supported by the retained record are included. The original
agent prompts and exact reviewer model are unavailable; these definitions and
routing rows are **reconstructed**, not a recovered runtime configuration.

| Role definition | Routing for this task | Evidence limit |
| --- | --- | --- |
| Implementation agent: extract the domain and wire adapters within scope | Shared logic and platform integration go to implementation | A later memory records delegated implementation; the original envelope is missing |
| Independent review role: compare behavior with the prior implementation and require proof for gaps | Behavioral parity goes to review, separately from implementation | The retained remediation report records the findings; exact reviewer identity is unknown |

Rob owns the shared-domain architecture and the separation of implementation
and review. That decision is supported by a distilled record, not a captured
conversation.

## Agent output

Artifact: **reconstructed sketch from the captured initial revision**.
This is pseudocode written for this page, not copied application code.

```text
after a successful save:
    request cache invalidation
    return its pending promise
```

The extracted domain and adapters existed, and the initial tests passed. But
returning that promise tied mutation completion to cache invalidation. Other
callbacks explicitly awaited invalidation, with the same timing effect.

## The mistake and the independent review

Artifact: **reconstructed finding from the captured remediation report and
corrective patch**.

A save could succeed while its mutation still appeared pending because cache
invalidation had not finished. The original behavior let the mutation settle
without waiting for invalidation. The extraction introduced that extra wait.

Independent review found the fidelity gap. The corrective change kept the
invalidation calls but stopped returning or awaiting their promises from the
success callbacks. No captured owner correction for this timing fix exists.

Artifact: **reconstructed test sequence from the captured regression test**.

```text
make the save succeed
hold the invalidation promise unresolved
start the create mutation
require it to settle before releasing invalidation
confirm invalidation was requested
release invalidation and finish cleanup
```

The retained create regression races completion against a short timeout while
invalidation is held pending. The report also records coverage for item mutation
timing. This targeted test checks the missing ordering requirement; a suite that
lets invalidation finish immediately can miss it.

## Rob's decision

Artifact: **reconstructed summary of the distilled architecture decision**.

Keep one shared domain and narrow platform adapters. Keep implementation and
review in separate roles. The timing correction preserved that architecture
while restoring the previous completion behavior.

The retained evidence attributes discovery of the timing mistake to independent
review. It does not establish that Rob personally diagnosed it or instructed
the specific fix. His architecture decision and his approval of this account
are the owner decisions claimed here.

## Final gate run and merge

Artifact: **reconstructed results from the captured verification report**.
These are historical results recorded after remediation, not tests rerun by
this public repository.

| Surface | Recorded result |
| --- | --- |
| Shared domain | 4 suites, 20 tests passed; type check passed |
| Web | 100 suites, 887 tests passed; type check and production build passed |
| Mobile | 12 suites, 62 tests passed; type check passed |
| Simulator | Report records work orders rendered through the native adapter; original capture remains private |

The report includes other corrections from the same review. These totals cover
the whole extraction after remediation, not just the timing regression.

Artifact: **reconstructed merge summary from captured Git objects**.
The initial implementation and corrective commits are ancestors of the retained
merge dated September 14, 2026. That merge is included in the local main-history
snapshot checked for the trace. It merged the larger mobile branch; it does not
prove deployment or the current remote state.

## Replay the public checks

Artifact: **reconstructed demonstration using newly written synthetic fixtures**.

```bash
make demo
make test
```

The demo blocks an unsuitable proposed change description, accepts a clean one,
and checks valid and invalid delegation artifacts. The tests exercise those
public mechanisms. They do not run GaragePulse or reproduce its historical
product tests. See the [prose gate boundary](../gates/README.md#bypasses-and-limits)
and [delegation boundary](../delegation/README.md#enforcement-boundary): a valid
report cannot prove a behavioral claim. Here, independent review and a targeted
regression test supplied the proof missing from the first green suite.
