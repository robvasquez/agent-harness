import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// These payloads are freshly authored synthetic metadata, never copied from real events.
const checker = resolve('gates/check-event.mjs');
const title = 'Repair the lantern latch';
const body = 'Replaced the bent pin and checked that the hinge moves freely.';
const local = '/' + ['home', 'sample', 'draft.txt'].join('/');
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'event-fixture-'));
  const path = join(directory, 'event.json');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  function raw(eventName, text, args = [path]) {
    writeFileSync(path, text);
    const env = { ...process.env };
    delete env.GITHUB_EVENT_NAME;
    if (eventName !== undefined) env.GITHUB_EVENT_NAME = eventName;
    return spawnSync(process.execPath, [checker, ...args], { env, encoding: 'utf8' });
  }
  const run = (eventName, payload) => raw(eventName, JSON.stringify(payload));
  return { directory, path, run, raw };
}
function expectStatus(result, status, sensitive = []) {
  assert.equal(result.status, status, result.stdout + result.stderr);
  if (status === 2) {
    assert.match(result.stdout + result.stderr, /block|invalid|unsupported|error|missing|unable|unreadable/i);
    for (const text of sensitive) assert.ok(!(result.stdout + result.stderr).includes(text), 'diagnostic exposed payload');
  }
}
for (const [eventName, field] of [['pull_request', 'pull_request'], ['issues', 'issue']]) {
  test('accepts clean ' + eventName + ' metadata', t => {
    const f = fixture(t);
    expectStatus(f.run(eventName, { [field]: { title, body } }), 0);
  });
  test('accepts empty body for ' + eventName, t => {
    const f = fixture(t);
    expectStatus(f.run(eventName, { [field]: { title, body: '' } }), 0);
  });
  test('accepts null body for ' + eventName, t => {
    const f = fixture(t);
    expectStatus(f.run(eventName, { [field]: { title, body: null } }), 0);
  });
  test('blocks hidden bad title for ' + eventName, t => {
    const f = fixture(t);
    expectStatus(f.run(eventName, { [field]: { title: local, body } }), 2, [local, f.path]);
  });
  test('blocks edited body for ' + eventName, t => {
    const f = fixture(t);
    expectStatus(f.run(eventName, { action: 'edited', [field]: { title, body: local } }), 2, [local, f.path]);
  });
  for (const [name, value] of [
    ['missing title', { body }], ['missing body', { title }],
    ['numeric title', { title: 5, body }], ['numeric body', { title, body: 5 }],
    ['array entity', []],
  ]) test('rejects ' + name + ' for ' + eventName, t => {
    const f = fixture(t);
    expectStatus(f.run(eventName, { [field]: value }), 2, [f.path]);
  });
}
test('accepts clean push messages', t => {
  const f = fixture(t);
  expectStatus(f.run('push', { head_commit: { message: title }, commits: [{ message: title }, { message: body }] }), 0);
});
test('accepts empty push commit list and null head for deletion', t => {
  const f = fixture(t);
  expectStatus(f.run('push', { deleted: true, head_commit: null, commits: [] }), 0);
});
test('checks push head message separately from commit array', t => {
  const f = fixture(t);
  expectStatus(f.run('push', { head_commit: { message: local }, commits: [{ message: body }] }), 2, [local, f.path]);
});
test('checks every push commit message', t => {
  const f = fixture(t);
  expectStatus(f.run('push', { head_commit: { message: title }, commits: [{ message: body }, { message: local }] }), 2, [local, f.path]);
});
for (const [name, payload] of [
  ['empty nondeleted event', { deleted: false, head_commit: null, commits: [] }],
  ['missing head', { commits: [] }],
  ['missing head with populated messages', { commits: [{ message: title }] }],
  ['missing commits', { head_commit: { message: title } }],
  ['nonarray commits', { head_commit: null, commits: {} }],
  ['missing head message', { head_commit: {}, commits: [] }],
  ['numeric commit message', { head_commit: null, commits: [{ message: 5 }] }],
  ['missing commit message', { head_commit: null, commits: [{}] }],
]) test('rejects push ' + name, t => {
  const f = fixture(t);
  expectStatus(f.run('push', payload), 2, [f.path]);
});
for (const [name, eventName, payload] of [
  ['missing event name', undefined, { pull_request: { title, body } }],
  ['unsupported event', 'workflow_dispatch', {}],
  ['missing entity', 'pull_request', {}],
  ['null payload', 'issues', null],
  ['array payload', 'issues', []],
]) test('rejects ' + name, t => {
  const f = fixture(t);
  expectStatus(f.run(eventName, payload), 2, [f.path]);
});
for (const [name, text] of [['malformed JSON', '{'], ['EOF', ''], ['trailing data', '{} garbage']]) {
  test('rejects ' + name, t => {
    const f = fixture(t);
    expectStatus(f.raw('issues', text), 2, [f.path]);
  });
}
test('rejects missing payload file without exposing its location', t => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [checker, f.path], { env: { ...process.env, GITHUB_EVENT_NAME: 'push' }, encoding: 'utf8' });
  expectStatus(result, 2, [f.path]);
});
test('rejects missing CLI argument', t => {
  const f = fixture(t);
  expectStatus(f.raw('issues', '{}', []), 2);
});
