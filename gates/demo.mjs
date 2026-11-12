import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { badBody, cleanBody } from './fixtures.mjs';

const guard = fileURLToPath(new URL('./prose-guard.mjs', import.meta.url));
for (const [label, body, expected] of [['Bad PR body', badBody, 2], ['Revised PR body', cleanBody, 0]]) {
  const command = 'gh pr create --title "Show saved count" --body ' + "'" + body + "'";
  const result = spawnSync(process.execPath, [guard, '--hook'], {
    input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8',
  });
  assert.equal(result.status, expected, 'Unexpected gate result');
  console.log(label + ': ' + (result.stderr || result.stdout).trim());
}
console.log('Replay complete. No command was sent.');
