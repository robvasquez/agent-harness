# Outbound prose gate

`make demo` replays a proposed pull request body twice. The first version is
blocked with category reasons. The revised version passes. Neither command
sends anything. Every example and test body was written for this demo; none
comes from a real change description, work item, or commit.

Run `bash gates/self-test.sh` for the guard tests, or `make test` for all checks.
The source guard had 21 scenarios. This suite exceeds that count for the commit,
pull request, and issue surfaces, with new text and adversarial inputs. Restricted path shapes are assembled
at runtime so fixture source also passes the repository sanitization check.

## Local check

`bash gates/hook.sh` accepts one JSON object on standard input with a
`tool_input.command` string. It checks proposed commands; it never runs them.
Connect it to a tool's before-command hook and make exit status 2 cancel the
operation. This repository does not install a hook into your tools or Git.

The supported literal command forms are:

- `git commit` and `git tag`, with message or file flags. Git template options
  read the template file; a literal dash template filename is unsupported.
  The short title flag on PR/issue commands reads text.
- `gh pr` and `gh issue` create, edit, comment, review, and merge commands, with
  title, body, message, or file flags. The service may reject a flag that this
  conservative adapter accepts as prose.
- Single or double quoted values, equals flags, attached short values, quoted
  file paths, literal quoting in command words, a body-file read from a literal heredoc, and a message supplied
  by a cat heredoc substitution.

Simple view, list, checks, diff, and status calls pass without prose checks.
Other commands containing a recognized outbound operation but using unsupported
syntax block. Shell variables, general substitutions, chained commands, and
unknown flags in an outbound operation require a direct prose check instead.
Unquoted glob, brace, and tilde expansion also block; quoted literal characters
remain data. Unquoted heredocs containing expansion syntax block.
Other programs fall outside this adapter's scope.

For text that has already been extracted, use
`node gates/prose-guard.mjs --text-file body.md`, or pipe it to
`node gates/prose-guard.mjs --text`. Successful checks return 0; blocked content,
invalid input, and read errors return 2. Diagnostics name categories without
echoing input or local filenames.

The policy checks local path shapes, internal command and phase markers,
assistant session links and attribution trailers, and mechanical writing tells
(curly quotes, emoji, repeated em dashes, and a small filler vocabulary).
Plain product names pass. One em dash passes; above that, the limit is one per
150 words. Matching folds case, applies NFKC, removes Unicode format characters,
and maps a finite set of common Greek and Cyrillic look-alikes. Writing checks
are an editorial policy and can reject reasonable prose.

## Server check

The separate `Outbound prose` workflow reads the event JSON as data, never as
shell code. It checks pull request and issue titles and bodies on creation and
edits, and the commit messages provided by push events. It uses the same prose
policy without depending on the local command parser. It runs with read-only
permissions, pinned actions, and no service calls from the checker.

To replay an event locally, run
`GITHUB_EVENT_NAME=pull_request node gates/check-event.mjs event.json`.
The checker also accepts `issues` and `push`. Missing or malformed fields block;
a null body represents an empty body. A deleted branch with no commits has no
prose to check.

The workflow is supplied as code only. The owner must enable Actions and make
the check required in the destination repository. PR workflows can require
approval for outside contributors and may not run on conflicting changes;
issue workflows must exist on the default branch. See GitHub's
[event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
Nothing in this local repository configures a remote or branch protection.

## Bypasses and limits

| Boundary | Bypass or gap | Owner's control |
| --- | --- | --- |
| Tool hook | Disable it, ignore its exit code, use another terminal, wrapper, API, or web UI | Configure tool enforcement; require review and server checks |
| Shell adapter | Unsupported programs, aliases, environment wrappers, and dynamically assembled commands are outside its recognized scope | Check extracted text directly; review outbound operations |
| Body files | Contents can change between checking and sending; symlinks and nonregular files are rejected but concurrent writes remain possible | Send the same reviewed immutable content |
| Text policy | Unmapped confusables, encodings, paraphrases, and unknown identifiers can evade patterns | Extend regressions; retain the separate sanitization and secret checks |
| Workflow trust | A contributor can change the policy or workflow in a proposed change; a maintainer can disable checks or override rules | Protect workflow and policy changes with owner review and repository rules |
| Publication timing | Issue and body edits and pushes are checked after publication, not before; old text is not removed | Review before sending; repair exposed content separately |
| Event coverage | Comments, reviews, releases, tags, old history, and commit messages absent from an event are not scanned by this workflow | Extend event coverage or use a trusted service that reads those surfaces |
| Metadata checks | A passing status can become stale after later edits, or a run can be cancelled or skipped | Verify the latest text before merging; manage required checks and pending runs |

This demo provides a useful early block and a second check. It does not prevent
every disclosure or replace a human publishing decision.
