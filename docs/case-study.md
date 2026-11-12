# Grounding and token accounting: a method note

Local logs contain measurable token usage, but the records inspected do not
support a fair before-and-after comparison of the knowledge-grounding rule.
This note reports one accounting example and the experiment still needed to
measure the rule's effect. It makes no claim about token savings.

Status: local draft. The owner must approve the figures and text before
publication. Raw logs and source references remain in private audit evidence.

## The rule being evaluated

Before a broad repository read, search retained project knowledge for relevant
decisions and prior work. Verify recent or conflicting claims against current
source. If retrieval misses or is unavailable, continue with local exploration
and record that fallback. The intended benefit is less repeated investigation;
this repository's runnable demos do not measure that benefit.

## One measured accounting example

The sample is one worker session preparing explanatory documentation after a
README change in this repository. It includes that worker's local investigation,
tool responses and writing. It excludes the parent coordinator, sibling workers,
reviews in other sessions and the earlier README work. It is neither a complete
task budget nor a grounding experiment.

The session began on November 12, 2026 at 18:58:16 UTC. Its final usage event is
at 19:01:39 UTC. The log records model `gpt-6.1-sol` and CLI version `0.167.0`.
That is the recorded model label; the log supplies no immutable backend model
revision. No other model occurs in this sample's turn-context records.

| Logged field | Tokens | Counting relationship |
| --- | ---: | --- |
| Input | 516,190 | Includes the reported cached input |
| Cached input | 492,416 | Subset of input; do not add it again |
| Output | 8,724 | Includes reported reasoning output |
| Reasoning output | 902 | Subset of output; do not add it again |
| Total | 524,914 | Input plus output |

The arithmetic remainder after subtracting reported cached input is 23,774
input tokens. This is an accounting distinction, not avoided work or evidence
of grounding savings. Repeated context can count again on subsequent calls;
these counts do not describe the size of unique source text read.

## Counting method and source boundary

Read the local session's structured usage events and use the final
`info.total_token_usage` record once. There are ten usage events in this sample.
Do not sum cumulative snapshots, or add the final `last_token_usage` to the
cumulative total. Check that cumulative counters never decrease and that the
first event's cumulative reading equals its per-call reading. Those checks
passed here. Counter resets or an inherited baseline require separate handling
before using this method elsewhere.

Check that total equals input plus output and that cache and reasoning counts
fit within their parent counts. These checks also passed. The numbers are
runtime-reported token counts; no character-to-token estimate was used.

Private evidence retains the extraction script, exact source byte length and
sha256 digest, event timestamps, model labels and extracted fields. The public
tree omits transcript text, computer paths and session identifiers. A reader can
check the arithmetic here but cannot independently reproduce the source
extraction from this repository alone.

## Why this cannot establish savings

- The inspected records provide no matched pair of equivalent tasks with
  grounding enabled and disabled. This sample has no control run or recorded
  treatment assignment.
- A private narrative draft is not an underlying usage trace. A separate local
  utility ledger mixes jobs and model aliases without a matched-task identifier
  or grounding assignment. Neither establishes a baseline for this sample.
- Task size, repository state, prompt history, model revision, effort, tool
  output length, caching, retries and parallel workers can change token use.
  Retrieval also consumes tokens and may move work into another process.
- The scope is one session. Missing sessions or unreported retrieval/indexing
  usage are unknown, not zero. The log alone does not establish that grounding
  occurred or that the resulting work met equivalent quality criteria.

There is no measured before/after reduction, ratio or percentage to publish
from this sample.

## A comparison worth running

Use equivalent, independently initialized tasks against the same source
revision and completion criteria. Keep the recorded model version, effort,
prompt and available tools fixed; vary the grounding rule. Record retrieval
availability and misses. Randomize run order and repeat both conditions so
cache state and task variation do not decide the result.

Capture input, cached input and output across the coordinator and every worker,
including failed attempts and retrieval calls. Report indexing work separately
with its scope and reuse assumptions. Keep cache and reasoning subsets separate
from additive totals. Retain source hashes and disclose missing usage.

Run the same correctness checks in both conditions. Report per-task counts,
variation and quality outcomes before drawing a conclusion. The owner reviews
the supporting records and chooses which figures, if any, to publish.
