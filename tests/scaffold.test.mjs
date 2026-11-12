import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
test('entry points are executable bash scripts', () => {
  for (const name of ['sanitize-check', 'test', 'demo']) {
    const path = 'scripts/' + name + '.sh';
    assert.match(read(path), /^#!\/usr\/bin\/env bash\nset -euo pipefail/m);
    assert.ok(statSync(path).mode & 0o111);
  }
});
test('make targets run shell entry points', () => {
  const source = read('Makefile');
  for (const name of ['test', 'demo']) assert.match(source, new RegExp(name + ':\\n\\tbash scripts/' + name + '\\.sh'));
  assert.match(read('scripts/test.sh'), /shellcheck/);
  assert.match(read('scripts/test.sh'), /sanitize-check/);
  assert.match(read('scripts/test.sh'), /node --test/);
});
test('workflow uses pinned actions and minimal permissions', () => {
  const source = read('.github/workflows/ci.yml');
  assert.match(source, /permissions:\n  contents: read\n/);
  assert.match(source, /runs-on: ubuntu-latest/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /node-version: ['"]?22['"]?/);
  assert.match(source, /shellcheck/);
  assert.match(source, /run: make test/);
  const actions = [...source.matchAll(/uses: ([^\s]+)@([^\s]+)/g)];
  assert.equal(actions.length, 2);
  assert.deepEqual(actions.map(match => match[1]), ['actions/checkout', 'actions/setup-node']);
  for (const action of actions) assert.match(action[2], /^[0-9a-f]{40}$/);
  assert.ok(!/\t/.test(source));
});
test('license and README document runnable checks and their limits', () => {
  assert.match(read('LICENSE'), /MIT License/);
  assert.match(read('LICENSE'), /Copyright \(c\) 2026 contributors/);
  const source = read('README.md');
  for (const word of ['Node.js 22', 'shellcheck', 'make test', 'make demo', 'false positives', 'hash']) assert.ok(source.includes(word), word);
  assert.match(source, /\[walkthrough\]\(docs\/walkthrough\.md\)/);
  assert.match(source, /^## What this does not stop$/m);
  assert.doesNotMatch(source, /\bplaceholder\b/i);
});
