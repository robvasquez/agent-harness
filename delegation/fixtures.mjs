// These handoffs were written for this demo and describe an invented formatter.
export const goodEnvelope = `## CONTEXT
- Goal: Keep the sample formatter deterministic.
- Task: Handle empty input in the formatter.
- Scope: src/format.mjs, tests/format.test.mjs
- Done-when:
  - Empty input produces an empty string.
  - The formatter tests pass.
- Constraints: Keep the exported function signature.
`;
export const badEnvelope = goodEnvelope.replace('- Scope: src/format.mjs, tests/format.test.mjs\n', '') +
  '\n```markdown\n- Scope: src/format.mjs\n```\n';
export const goodReport = `## DELIVERY
- Status: complete
- Files: src/format.mjs, tests/format.test.mjs
- Decisions: Return an empty string for empty input.
- Warnings: none
- Blockers: none
- Confidence: high
- Open questions: none
- Assumptions made: Input is a string.
`;
export const badReport = goodReport.replace('- Blockers: none', '- Blockers: The empty-input test still fails.');
