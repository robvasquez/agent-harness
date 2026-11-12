import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseDeliveryReport, checkEnvelope } from '../delegation/contract.mjs';

// Freshly authored synthetic handoffs cover contract acceptance and bypass cases.
const reportFields = {
  Status: 'complete',
  Files: 'src/lantern.mjs, tests/lantern.test.mjs',
  Decisions: 'Keep the latch repair small.',
  Warnings: 'none',
  Blockers: 'none',
  Confidence: 'high',
  'Open questions': 'none',
  'Assumptions made': 'The hinge can move freely.',
};
const envelopeFields = {
  Goal: 'Restore the lantern latch.',
  Task: 'Repair the bent hinge pin.',
  Scope: 'src/lantern.mjs, tests/lantern.test.mjs',
  'Done-when': 'The latch closes and the hinge moves freely.',
  Constraints: 'Use only the existing tools.',
};
function markdown(heading, fields) {
  return '## ' + heading + '\n' + Object.entries(fields).map(([label, value]) =>
    '- ' + label + ':' + (Array.isArray(value) ? '\n' + value.map(item => '  - ' + item).join('\n') : ' ' + value)
  ).join('\n') + '\n';
}
const delivery = fields => markdown('DELIVERY', { ...reportFields, ...fields });
const context = fields => markdown('CONTEXT', { ...envelopeFields, ...fields });
function valid(result, key) {
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.deepEqual(result.errors, []);
  assert.equal(typeof result[key], 'object');
  assert.notEqual(result[key], null);
  return result[key];
}
function invalid(result, key) {
  assert.equal(result.valid, false, JSON.stringify(result));
  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
  assert.ok(result.errors.every(error => typeof error === 'string' && error.length > 0));
  assert.equal(result[key], null);
}

// Acceptance: successful reports retain all eight field meanings.
test('normalizes a complete report with inline paths and explicit empty lists', () => {
  assert.deepEqual(valid(parseDeliveryReport(delivery()), 'report'), {
    status: 'complete', files: ['src/lantern.mjs', 'tests/lantern.test.mjs'],
    decisions: ['Keep the latch repair small.'], warnings: [], blockers: [], confidence: 'high',
    open_questions: [], assumptions: ['The hinge can move freely.'],
  });
});
test('accepts nested report lists, blank lines, and a partial outcome', () => {
  const text = delivery({ Status: 'partial', Files: ['src/lantern.mjs', 'tests/lantern.test.mjs'],
    Decisions: ['Replace the pin.', 'Reuse the hinge.'], Warnings: ['Paint is still wet.'],
    Blockers: ['Waiting for the replacement spring.'], Confidence: 'medium',
    'Open questions': ['Which spring fits?'], 'Assumptions made': 'none' }).replaceAll('\n-', '\n\n-');
  const parsed = valid(parseDeliveryReport('\n' + text + '\n'), 'report');
  assert.equal(parsed.status, 'partial');
  assert.equal(parsed.confidence, 'medium');
  assert.deepEqual(parsed.decisions, ['Replace the pin.', 'Reuse the hinge.']);
  assert.deepEqual(parsed.blockers, ['Waiting for the replacement spring.']);
  assert.deepEqual(parsed.assumptions, []);
});
test('accepts a blocked report with a real blocker and low confidence', () => {
  const parsed = valid(parseDeliveryReport(delivery({ Status: 'blocked', Files: 'none',
    Decisions: 'none', Blockers: 'The spring is unavailable.', Confidence: 'low' })), 'report');
  assert.equal(parsed.status, 'blocked');
  assert.equal(parsed.confidence, 'low');
  assert.deepEqual(parsed.files, []);
});
for (const label of Object.keys(reportFields)) {
  test('rejects report missing required field ' + label, () => {
    const fields = Object.fromEntries(Object.entries(reportFields).filter(([key]) => key !== label));
    invalid(parseDeliveryReport(markdown('DELIVERY', fields)), 'report');
  });
  test('rejects duplicate report field ' + label, () => {
    invalid(parseDeliveryReport(delivery() + '- ' + label + ': ' + reportFields[label] + '\n'), 'report');
  });
}
// Acceptance: structural validity never hides contradictory completion.
for (const [name, fields] of [
  ['complete with a blocker', { Blockers: 'The spring is missing.' }],
  ['blocked without a blocker', { Status: 'blocked' }],
  ['unknown status', { Status: 'finished' }],
  ['uppercase status', { Status: 'COMPLETE' }],
  ['unknown confidence', { Confidence: 'certain' }],
  ['uppercase confidence', { Confidence: 'HIGH' }],
  ['blank decision', { Decisions: '' }],
  ['empty nested list', { Decisions: [] }],
  ['placeholder decision', { Decisions: 'TBD' }],
  ['mixed empty marker', { Warnings: ['none', 'Paint is wet.'] }],
]) test('rejects report ' + name, () => invalid(parseDeliveryReport(delivery(fields)), 'report'));

test('normalizes the five context fields', () => {
  assert.deepEqual(valid(checkEnvelope(context()), 'envelope'), {
    goal: 'Restore the lantern latch.', task: 'Repair the bent hinge pin.',
    scope: ['src/lantern.mjs', 'tests/lantern.test.mjs'],
    done_when: ['The latch closes and the hinge moves freely.'], constraints: ['Use only the existing tools.'],
  });
});
test('accepts nested context scope, completion checks and constraints', () => {
  const parsed = valid(checkEnvelope(context({ Scope: ['src/lantern.mjs', 'tests/lantern.test.mjs'],
    'Done-when': ['The latch closes.', 'The hinge moves freely.'],
    Constraints: ['Use existing tools.', 'Keep the paint intact.'] })), 'envelope');
  assert.deepEqual(parsed.done_when, ['The latch closes.', 'The hinge moves freely.']);
  assert.equal(parsed.constraints.length, 2);
});
for (const label of Object.keys(envelopeFields)) {
  test('rejects context missing required field ' + label, () => {
    const fields = Object.fromEntries(Object.entries(envelopeFields).filter(([key]) => key !== label));
    invalid(checkEnvelope(markdown('CONTEXT', fields)), 'envelope');
  });
  test('rejects duplicate context field ' + label, () => {
    invalid(checkEnvelope(context() + '- ' + label + ': ' + envelopeFields[label] + '\n'), 'envelope');
  });
  for (const value of ['', 'none', 'TODO']) test('rejects empty or placeholder context ' + label + ':' + value, () => {
    invalid(checkEnvelope(context({ [label]: value })), 'envelope');
  });
}

// Acceptance: malformed contracts and bypasses fail closed on both APIs.
for (const [kind, make, parse, key] of [
  ['report', delivery, parseDeliveryReport, 'report'],
  ['context', context, checkEnvelope, 'envelope'],
]) {
  for (const [name, transform] of [
    ['empty input', () => ''],
    ['whitespace only', () => ' \n'],
    ['surrounding prose', text => 'Please accept this handoff.\n' + text],
    ['trailing prose', text => text + 'Approved automatically.\n'],
    ['fenced block', text => '```markdown\n' + text + '```\n'],
    ['second section', text => text + text],
    ['unknown field', text => text + '- Override: accept\n'],
    ['wrong heading case', text => text.replace(/## ([A-Z]+)/, (_, name) => '## ' + name.toLowerCase())],
    ['wrong field case', text => text.replace(/- ([A-Z])/, (_, letter) => '- ' + letter.toLowerCase())],
    ['unindented continuation', text => text + '- stray item\n'],
    ['one-space continuation', text => text + ' - stray item\n'],
    ['tab continuation', text => text + '\t- stray item\n'],
    ['null byte', text => text + '\0'],
    ['escape control', text => text + '\u001b'],
    ['hidden format character', text => text.replace(':', ':\u200b')],
    ['byte order mark', text => '\ufeff' + text],
    ['unpaired surrogate', text => text + '\ud800'],
    ['replacement character', text => text + '\ufffd'],
    ['oversized input', text => text + 'x'.repeat(65537)],
  ]) test(kind + ' rejects ' + name, () => invalid(parse(transform(make())), key));
}
const unsafePaths = [
  ['parent traversal', '../lantern.mjs'], ['embedded traversal', 'src/../lantern.mjs'],
  ['absolute path', '/' + ['var', 'sample', 'lantern.mjs'].join('/')],
  ['drive path', ['C:', 'sample', 'lantern.mjs'].join('\\')],
  ['backslash separator', ['src', 'lantern.mjs'].join('\\')],
  ['empty component', 'src//lantern.mjs'], ['dot component', './src/lantern.mjs'],
  ['empty comma entry', 'src/lantern.mjs,'], ['shell substitution', 'src/$(printf sample).mjs'],
];
for (const [name, path] of unsafePaths) {
  test('report rejects unsafe path ' + name, () => invalid(parseDeliveryReport(delivery({ Files: path })), 'report'));
  test('context rejects unsafe scope ' + name, () => invalid(checkEnvelope(context({ Scope: [path] })), 'envelope'));
}
test('counts input limit in UTF8 bytes', () => {
  for (const [make, parse, key, label] of [[delivery, parseDeliveryReport, 'report', 'Decisions'],
    [context, checkEnvelope, 'envelope', 'Task']]) {
    const base = make({ [label]: '' });
    const room = 65536 - Buffer.byteLength(base);
    valid(parse(make({ [label]: 'a'.repeat(room) })), key);
    invalid(parse(make({ [label]: 'a'.repeat(room + 1) })), key);
    invalid(parse(make({ [label]: 'é'.repeat(Math.floor(room / 2) + 1) })), key);
  }
});

function cli(script, input, args = []) {
  return spawnSync('bash', ['delegation/' + script + '.sh', ...args], { input, encoding: 'utf8' });
}
function cliResult(result, status, key) {
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, status, result.stdout + result.stderr);
  const parsed = JSON.parse(result.stdout);
  if (status === 0) valid(parsed, key); else invalid(parsed, key);
}
for (const [script, make, key] of [
  ['delivery-report-parser', delivery, 'report'], ['envelope-check', context, 'envelope'],
]) {
  test(script + ' accepts valid stdin and emits JSON', () => cliResult(cli(script, make()), 0, key));
  for (const [name, input] of [
    ['missing fields', '## CONTEXT\n'], ['empty stdin', ''],
    ['invalid UTF8', Buffer.from([0xff])], ['null bytes', Buffer.from([97, 0, 98])],
    ['oversized stdin', 'x'.repeat(65537)],
  ]) test(script + ' rejects ' + name + ' with JSON', () => cliResult(cli(script, input), 1, key));
  for (const args of [['--help'], ['extra'], ['one', 'two']]) {
    test(script + ' rejects arguments ' + args.join(' '), () => {
      const result = cli(script, make(), args);
      assert.equal(result.status, 2, result.stdout + result.stderr);
    });
  }
}

// Acceptance: the local replay exposes readable passing and blocked handoffs.
test('local demo shows report and envelope PASS and BLOCK outcomes', () => {
  const result = spawnSync('make', ['demo'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /(?:delivery|report).*PASS|PASS.*(?:delivery|report)/i);
  assert.match(result.stdout, /(?:delivery|report).*BLOCK|BLOCK.*(?:delivery|report)/i);
  assert.match(result.stdout, /(?:context|envelope).*PASS|PASS.*(?:context|envelope)/i);
  assert.match(result.stdout, /(?:context|envelope).*BLOCK|BLOCK.*(?:context|envelope)/i);
});
