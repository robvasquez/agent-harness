# Publication threat model

This repository contains small local validators, synthetic examples and a
reconstructed account of work on an owner-controlled product. The assets at
risk are private identities, implementation details, credibility and credentials.
The publication boundary includes file names, contents, Git history and metadata.
An accidental disclosure can persist in clones after a file is removed.

| Risk | Exposure route | Mitigation | Remaining limit |
| --- | --- | --- | --- |
| Customer identifiers | Names, addresses, local paths or work references enter examples, docs or history | Write examples from scratch; screen names and text with the hashed denylist and identifier patterns; review history and every file before publication | Unknown names, paraphrases and encodings can escape patterns. Hashes with a public salt can be guessed; they are not confidential storage. |
| Proprietary logic | A copied implementation or private operational document reveals behavior or business rules | Keep the public implementation small and generic; inspect its provenance; reconstruct the walkthrough in new prose and pseudocode; keep original evidence outside this repository | Similarity checks cannot prove ownership. The owner must confirm rights and review the described behavior. |
| Reputational exposure | Reconstructed history reads as captured proof; a passing gate is presented as a guarantee; engineering copy implies an unrelated purpose | Label artifact sources and missing evidence; state bypasses and historical-test limits; retain engineering framing; require owner read-through | Readers can infer more than the evidence supports. Automated editorial checks cannot establish intent or accuracy. |
| Secrets | A credential enters a file, fixture, commit or scanner report | Run two secret scanners locally with credential verification and updates disabled; inspect all reachable publication history; keep raw scan logs outside the repository; rotate any real exposed credential before publishing | Detection depends on signatures and decoding. A clean scan does not prove absence, and deleting a credential does not revoke it. |

The local hook depends on its caller honoring a blocking result. Validators
check structure and patterns; they do not establish that reports are true.
CI checks event text after publication, so a failed check cannot retract it.
An owner can disable checks, change workflows or publish through another path.
The prose reader rejects a symlink at the file itself, but can follow symlinks
in parent directories. Concurrent writes can also change checked content.
Review workflow and policy changes separately, and enable required checks in the
destination repository before accepting contributions.

Working-history attribution can disclose personal contact details even when
every tracked file passes. The local working history contains such metadata.
Publication must use the separate bundle retained with the audit evidence:
one fresh root commit, generic attribution and the exact reviewed tree, with
no parent links or extra refs to the working history. Direct publication of
the working clone is outside this gate's approval scope.

The [sanitization report](sanitization-gate.md) records the automated audit and
its file inventory. Owner read-through and publication remain separate owner
steps. Rerun the audit after any content or history change and check that the
inventory still matches the intended publication tree.
