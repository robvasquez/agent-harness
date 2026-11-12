import { parseDeliveryReport, checkEnvelope } from './contract.mjs';
import { goodEnvelope, badEnvelope, goodReport, badReport } from './fixtures.mjs';

console.log('\nDelegation contract replay (synthetic examples)');
for (const [label, check, input, expected] of [
  ['Envelope with bounded scope', checkEnvelope, goodEnvelope, true],
  ['Envelope with scope hidden in a fenced example', checkEnvelope, badEnvelope, false],
  ['Delivery report with no blockers', parseDeliveryReport, goodReport, true],
  ['Delivery report claiming completion with a blocker', parseDeliveryReport, badReport, false],
]) {
  const outcome = check(input);
  console.log((outcome.valid ? 'PASS' : 'BLOCK') + ': ' + label);
  if (outcome.valid) console.log('  Required fields and consistency checks passed.');
  for (const error of outcome.errors) console.log('  ' + error);
  if (outcome.valid !== expected) throw new Error('Replay outcome differed from its expected result.');
}
