import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, chmodSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const scanner = resolve('scripts/sanitize-check.sh');
const term = ['velvet', 'badger'].join(' ');
const normalized = value => (value.normalize('NFKC').toLowerCase().replace(/\p{Cf}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
const policy = words => ({ version: 1, salt: 'a1'.repeat(16), maxWords: 4,
  hashes: words.map(value => createHash('sha256').update('a1'.repeat(16) + '\0' + normalized(value)).digest('hex')) });
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'gate-fixture-'));
  const root = join(base, 'tree');
  mkdirSync(root);
  const extra = join(base, 'policy.json');
  writeFileSync(extra, JSON.stringify(policy([term])));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const run = (...args) => spawnSync('bash', [scanner, '--denylist', extra, root, ...args], { encoding: 'utf8' });
  return { base, root, extra, run };
}
function blocked(result) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /blocked/i);
}

test('passes plain text and blocks a digest match until removed', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'note.txt'), 'public sample');
  assert.equal(f.run().status, 0);
  writeFileSync(join(f.root, 'note.txt'), term);
  const result = f.run();
  blocked(result);
  assert.ok(!(result.stdout + result.stderr).includes(term));
  writeFileSync(join(f.root, 'note.txt'), 'public sample');
  assert.equal(f.run().status, 0);
});
for (const [name, value] of [
  ['case folding', () => term.toUpperCase()],
  ['punctuation and lines', () => term.replace(' ', '---\n')],
  ['compatibility letters', () => [...term].map(c => /[a-z]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0xfee0) : c).join('')],
  ['format characters', () => term.replace('e', 'e\u200b')],
]) test(name, t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'note.txt'), value());
  blocked(f.run());
});

test('checks whole words without substring matches', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'note.txt'), 'x' + term + 'x');
  assert.equal(f.run().status, 0);
});
test('checks filenames and hidden files', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, term.replace(' ', '-') + '.txt'), 'sample');
  blocked(f.run());
  rmSync(join(f.root, term.replace(' ', '-') + '.txt'));
  writeFileSync(join(f.root, '.hidden'), term);
  blocked(f.run());
});
test('skips only root git metadata, including worktree pointer files', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git'), term);
  assert.equal(f.run().status, 0);
  mkdirSync(join(f.root, 'nested'));
  writeFileSync(join(f.root, 'nested', '.git'), term);
  blocked(f.run());
});
const shapes = {
  'mail address': () => ['sample', 'example.invalid'].join('@'),
  'desktop home': () => '/' + ['Users', 'sample', 'notes'].join('/'),
  'unix home': () => '/' + ['home', 'sample', 'notes'].join('/'),
  'drive home': () => ['C:', 'Users', 'sample', 'notes'].join('\\'),
  'tilde home': () => '~' + '/notes',
  'opaque identifier': () => ['12345678', '1234', '4234', '8234', '123456789012'].join('-'),
  'routine identifier': () => ['routine', 'abcdefgh1234'].join('-'),
  'artifact identifier': () => ['artifact', 'abcdefgh1234'].join('_'),
  'bare change number': () => 'Fixes ' + '#' + '42',
  'change reference': () => ['P', 'R'].join('') + ' #' + '42',
  'change URL': () => ['pull', '42'].join('/'),
  'short routine identifier': () => ['rtn', 'abcdefgh1234'].join('_'),
  'short alternate identifier': () => ['rt', 'abcdefgh1234'].join('_'),
  'short artifact identifier': () => ['art', 'abcdefgh1234'].join('_'),
  'labelled identifier': () => ['routine', 'id:', 'abcdefgh1234'].join(' '),
  'mixed opaque token': () => ['aB2cD3eF4g', 'H5iJ6kL7mN8'].join(''),
  'work item': () => ['SYN', '42'].join('-'),
};
for (const [name, value] of Object.entries(shapes)) test('blocks ' + name, t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'note.txt'), value());
  const result = f.run();
  blocked(result);
  assert.ok(!(result.stdout + result.stderr).includes(value()));
});
test('custom policy cannot disable mandatory shapes or baseline digests', t => {
  const f = fixture(t);
  writeFileSync(f.extra, JSON.stringify(policy([])));
  writeFileSync(join(f.root, 'note.txt'), shapes['mail address']());
  blocked(f.run());
  const clone = join(f.base, 'clone');
  mkdirSync(join(clone, 'scripts'), { recursive: true });
  mkdirSync(join(clone, 'config'));
  copyFileSync(resolve('scripts/sanitize-check.mjs'), join(clone, 'scripts', 'sanitize-check.mjs'));
  writeFileSync(join(clone, 'config', 'denylist.json'), JSON.stringify(policy([term])));
  writeFileSync(join(f.root, 'note.txt'), term);
  const invoke = () => spawnSync('node', [join(clone, 'scripts', 'sanitize-check.mjs'), '--denylist', f.extra, f.root],
    { encoding: 'utf8', env: { ...process.env, SANITIZE_DENYLIST: f.extra } });
  blocked(invoke());
  rmSync(join(clone, 'config', 'denylist.json'));
  blocked(invoke());
});

for (const [name, change] of [
  ['invalid JSON', () => '{'],
  ['unknown field', p => JSON.stringify({ ...p, disabled: true })],
  ['invalid version', p => JSON.stringify({ ...p, version: 2 })],
  ['empty salt', p => JSON.stringify({ ...p, salt: '' })],
  ['nonhex salt', p => JSON.stringify({ ...p, salt: 'xyz' })],
  ['zero window', p => JSON.stringify({ ...p, maxWords: 0 })],
  ['fractional window', p => JSON.stringify({ ...p, maxWords: 1.5 })],
  ['bad digest', p => JSON.stringify({ ...p, hashes: ['bad'] })],
  ['missing hashes', () => JSON.stringify({ version: 1, salt: 'aa', maxWords: 1 })],
]) test('rejects policy: ' + name, t => {
  const f = fixture(t);
  writeFileSync(f.extra, change(policy([term])));
  blocked(f.run());
});
test('rejects missing policy and invalid root without absolute path output', t => {
  const f = fixture(t);
  rmSync(f.extra);
  const result = f.run();
  blocked(result);
  assert.ok(!(result.stdout + result.stderr).includes(f.base));
  writeFileSync(f.extra, JSON.stringify(policy([term])));
  rmSync(f.root, { recursive: true });
  blocked(f.run());
});
test('rejects symlink files and directories without following them', t => {
  const f = fixture(t);
  writeFileSync(join(f.base, 'outside'), 'sample');
  symlinkSync(join(f.base, 'outside'), join(f.root, 'link'));
  blocked(f.run());
  rmSync(join(f.root, 'link'));
  symlinkSync(f.base, join(f.root, 'link'));
  blocked(f.run());
});
test('rejects a symlink root and external policy', t => {
  const f = fixture(t);
  symlinkSync(f.root, join(f.base, 'alias'));
  blocked(spawnSync('bash', [scanner, join(f.base, 'alias')], { encoding: 'utf8' }));
  symlinkSync(f.extra, join(f.base, 'policy-link'));
  blocked(spawnSync('bash', [scanner, '--denylist', join(f.base, 'policy-link'), f.root], { encoding: 'utf8' }));
});
test('rejects binary, invalid UTF8 and unreadable files', t => {
  const f = fixture(t);
  const path = join(f.root, 'note.txt');
  for (const bytes of [Buffer.from([97, 0, 98]), Buffer.from([0xff]), Buffer.from([1, 2, 3])]) {
    writeFileSync(path, bytes);
    blocked(f.run());
  }
  writeFileSync(path, 'sample');
  chmodSync(path, 0);
  try { blocked(f.run()); } finally { chmodSync(path, 0o600); }
});
for (const args of [['--unknown'], ['--denylist'], ['--denylist', '--help'], ['one', 'two']]) {
  test('rejects invalid CLI ' + args.length + ':' + args[0], () => {
    const result = spawnSync('bash', [scanner, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stdout + result.stderr);
  });
}
test('help prints usage', () => {
  const result = spawnSync('bash', [scanner, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});
test('passes action pins and ordinary long lowercase words', t => {
  const f = fixture(t);
  const pin = ['actions', 'checkout'].join('/') + '@' + 'a1'.repeat(20);
  writeFileSync(join(f.root, 'note.txt'), pin + '\n' + 'abcdefghijklmnopqrstuvwxyz');
  assert.equal(f.run().status, 0);
});

test('shipped baseline blocks its synthetic sentinel with an empty extra policy', t => {
  const f = fixture(t);
  const sentinel = ['ma', 'ple'].join('') + ' ' + ['ot', 'ter'].join('');
  writeFileSync(f.extra, JSON.stringify(policy([])));
  const note = join(f.root, 'note.txt');
  writeFileSync(note, 'public sample');
  assert.equal(f.run().status, 0);
  writeFileSync(note, sentinel);
  const result = f.run();
  blocked(result);
  assert.ok(!(result.stdout + result.stderr).includes(sentinel));
  blocked(spawnSync('bash', [scanner, f.root], { encoding: 'utf8' }));
  writeFileSync(note, 'public sample');
  assert.equal(f.run().status, 0);
});
test('rejects an empty mandatory policy while external policies may be empty', t => {
  const f = fixture(t);
  const clone = join(f.base, 'clone');
  mkdirSync(join(clone, 'scripts'), { recursive: true });
  mkdirSync(join(clone, 'config'));
  copyFileSync(resolve('scripts/sanitize-check.mjs'), join(clone, 'scripts', 'sanitize-check.mjs'));
  writeFileSync(join(clone, 'config', 'denylist.json'), JSON.stringify(policy([])));
  writeFileSync(f.extra, JSON.stringify(policy([])));
  writeFileSync(join(f.root, 'note.txt'), 'public sample');
  blocked(spawnSync('node', [join(clone, 'scripts', 'sanitize-check.mjs'), '--denylist', f.extra, f.root],
    { encoding: 'utf8' }));
});
