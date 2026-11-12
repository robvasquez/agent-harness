import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// All examples are newly authored synthetic prose; restricted shapes are assembled at runtime.
const guard = resolve('gates/prose-guard.mjs');
const clean = 'Repair the lantern latch and verify the hinge moves freely.';
const local = '/' + ['Users', 'sample', 'draft.txt'].join('/');
const phase = ['F', '1'].join('-');
const run = (args, input = '') => spawnSync(process.execPath, [guard, ...args], { input, encoding: 'utf8' });
const hook = command => run(['--hook'], JSON.stringify({ tool_input: { command } }));
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
function expectStatus(result, status, sensitive = []) {
  assert.equal(result.status, status, result.stdout + result.stderr);
  assert.equal(result.signal, null);
  if (status === 2) {
    assert.match(result.stdout + result.stderr, /block|invalid|unsupported|error|unable|unreadable/i);
    for (const value of sensitive) assert.ok(!(result.stdout + result.stderr).includes(value), 'diagnostic exposed input');
  }
}
function fixture(t, content = clean) {
  const directory = mkdtempSync(join(tmpdir(), 'prose-fixture-'));
  const path = join(directory, 'note with spaces.txt');
  writeFileSync(path, content);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, path };
}

for (const [name, text] of [
  ['plain prose', clean],
  ['ordinary product words', 'Compare ChatGPT, Claude and Gemini in the settings help.'],
  ['one short dash', 'The latch sticks — replace the pin.'],
  ['device sink', 'Redirect diagnostic output to /dev/null.'],
  ['long prose dash budget', Array(310).fill('lantern').join(' ') + ' — hinge — latch'],
]) test('direct text accepts ' + name, () => expectStatus(run(['--text'], text), 0));

const forbidden = [
  ['desktop home', local, 'local-path'],
  ['unix home', '/' + ['home', 'sample', 'note'].join('/'), 'local-path'],
  ['temporary file', '/' + ['tmp', 'sample-note'].join('/'), 'local-path'],
  ['private temporary file', '/' + ['private', 'tmp', 'sample-note'].join('/'), 'local-path'],
  ['folder cache', '/' + ['var', 'folders', 'aa', 'sample', 'T', 'note'].join('/'), 'local-path'],
  ['tilde home', '~' + '/draft.txt', 'local-path'],
  ['drive home', ['C:', 'Users', 'sample', 'draft.txt'].join('\\'), 'local-path'],
  ['private configuration', '.' + ['claude', 'draft.txt'].join('/'), 'local-path'],
  ['worktree path', ['.worktrees', 'sample', 'draft.txt'].join('/'), 'local-path'],
  ['temporary variable', '$' + 'TMPDIR' + '/draft.txt', 'local-path'],
  ['AI chat link', 'https://' + ['chatgpt.com', 'share', 'synthetic-example'].join('/'), 'ai-reference'],
  ['AI attribution', 'Co-authored-by: Claude <' + ['synthetic', 'example.invalid'].join('@') + '>', 'ai-reference'],
  ['pipeline invocation', '/' + 'dev', 'pipeline-reference'],
  ['pipeline marker', 'Completed ' + phase + ' today.', 'pipeline-reference'],
  ['curly quotes', 'Replace the “loose” latch.', 'humanizer'],
  ['emoji', 'The lantern works again. 🏮', 'humanizer'],
  ['short dash overflow', 'The latch — the hinge — the pin.', 'humanizer'],
  ['stock opener', 'Great question! The latch needs oil.', 'humanizer'],
  ['filler', "It's worth noting that the latch needs oil.", 'humanizer'],
];
for (const [name, text, category] of forbidden) test('direct text blocks ' + name, () => {
  const result = run(['--text'], text);
  expectStatus(result, 2, [text]);
  assert.ok((result.stdout + result.stderr).includes(category), 'expected category: ' + category);
});
for (const [name, transform] of [
  ['uppercase', text => text.toUpperCase()],
  ['compatibility letters', text => [...text].map(c => /[A-Za-z]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0xfee0) : c).join('')],
  ['format characters', text => text.replace('Users', 'U\u200bsers')],
  ['common lookalikes', text => text.replace('Users', 'Us\u0435rs')],
]) test('normalization blocks ' + name, () => expectStatus(run(['--text'], transform(local)), 2, [transform(local)]));

test('policy export reports categories without source text', async () => {
  const { inspectProse } = await import('../gates/prose-guard.mjs');
  assert.deepEqual(inspectProse(clean), []);
  const findings = inspectProse('Review ' + local + ' after ' + phase + '.');
  assert.ok(findings.includes('local-path'));
  assert.ok(findings.includes('pipeline-reference'));
  assert.ok(findings.every(value => ['local-path', 'ai-reference', 'pipeline-reference', 'humanizer'].includes(value)));
});

for (const command of [
  'git commit -m ' + quote(clean),
  'git commit --message=' + quote(clean),
  'git commit -m' + quote(clean),
  'git tag -a lantern -m ' + quote(clean),
  'gh pr create --title ' + quote('Repair lantern latch') + ' --body ' + quote(clean),
  'gh issue edit 7 -t ' + quote('Repair lantern latch') + ' -b ' + quote(clean),
  'gh pr comment 7 --body=' + quote(clean),
  'gh pr review 7 --approve --body ' + quote(clean),
  'gh pr merge 7 --squash --subject ' + quote('Repair lantern latch') + ' --body ' + quote(clean),
]) test('hook accepts literal command ' + command.split(' ').slice(0, 3).join(' '), () => expectStatus(hook(command), 0));
for (const command of [
  'git commit -m ' + quote(local),
  'git tag -a lantern --message=' + quote(local),
  'gh pr create --title ' + quote(local) + ' --body ' + quote(clean),
  'gh issue create --title ' + quote('Repair lantern latch') + ' --body ' + quote(local),
  'gh pr edit 7 --body ' + quote(local),
  'gh issue comment 7 -b' + quote(local),
  'gh pr review 7 --body ' + quote(local),
  'gh pr merge 7 --body ' + quote(local),
  'gh pr merge 7 --subject ' + quote(local) + ' --body ' + quote(clean),
  'gh pr merge 7 --subject=' + quote(local) + ' --body ' + quote(clean),
]) test('hook blocks outbound field ' + command.split(' ').slice(0, 3).join(' '), () => expectStatus(hook(command), 2, [local]));

test('hook checks every repeated message field', () => expectStatus(hook('git commit -m ' + quote(clean) + ' -m ' + quote(local)), 2, [local]));
for (const command of [
  'gh pr view 7', 'gh issue list', 'gh pr checks 7', 'gh pr diff 7', 'gh pr status',
  'printf ' + quote(local), 'custom-publisher --body ' + quote(local),
]) test('hook skips out-of-scope command ' + command.split(' ').slice(0, 3).join(' '), () => expectStatus(hook(command), 0));

for (const [name, command] of [
  ['variable', 'git commit -m "$SYNTHETIC_BODY"'],
  ['backticks', 'git commit -m "`printf sample`"'],
  ['substitution', 'git commit -m "$(printf sample)"'],
  ['chaining', 'git commit -m ' + quote(clean) + ' && printf sample'],
  ['semicolon', 'gh pr create --body ' + quote(clean) + '; printf sample'],
  ['unterminated quote', "git commit -m 'sample"],
]) test('hook blocks unsupported ' + name, () => expectStatus(hook(command), 2));

for (const prefix of ['git commit --file ', 'git commit -F ', 'gh pr create --body-file ', 'gh issue comment 7 -F ']) {
  test('hook reads quoted file with ' + prefix.trim(), t => {
    const f = fixture(t);
    expectStatus(hook(prefix + quote(f.path)), 0);
    writeFileSync(f.path, local);
    expectStatus(hook(prefix + quote(f.path)), 2, [local, f.path]);
  });
}
test('direct file mode checks content and suppresses path', t => {
  const f = fixture(t);
  expectStatus(run(['--text-file', f.path]), 0);
  writeFileSync(f.path, local);
  expectStatus(run(['--text-file', f.path]), 2, [local, f.path]);
});
for (const [name, content] of [['binary', Buffer.from([97, 0, 98])], ['invalid UTF8', Buffer.from([255])]]) {
  test('file-backed hook blocks ' + name, t => {
    const f = fixture(t, content);
    expectStatus(hook('gh pr create --body-file ' + quote(f.path)), 2, [f.path]);
  });
}
test('file-backed hook blocks missing file', t => {
  const f = fixture(t);
  rmSync(f.path);
  expectStatus(hook('git commit -F ' + quote(f.path)), 2, [f.path]);
});
test('file-backed hook blocks unreadable file', t => {
  const f = fixture(t);
  chmodSync(f.path, 0);
  try { expectStatus(hook('git commit -F ' + quote(f.path)), 2, [f.path]); }
  finally { chmodSync(f.path, 0o600); }
});
for (const [name, makeCommand] of [
  ['stdin heredoc', text => "gh pr create --body-file - <<'END'\n" + text + '\nEND'],
  ['cat heredoc', text => "git commit -m \"$(cat <<'END'\n" + text + '\nEND\n)"'],
]) test('hook parses ' + name, () => {
  expectStatus(hook(makeCommand(clean)), 0);
  expectStatus(hook(makeCommand(local)), 2, [local]);
});
test('hook never evaluates inspected commands', t => {
  const f = fixture(t);
  const target = join(f.directory, 'sentinel');
  expectStatus(hook('git commit -m "$(touch ' + quote(target) + ')"'), 2, [target]);
  assert.equal(existsSync(target), false);
});
for (const input of ['', '{', 'null', '{}', '{"tool_input":{}}', '{"tool_input":{"command":7}}']) {
  test('hook rejects malformed envelope ' + JSON.stringify(input), () => expectStatus(run(['--hook'], input), 2));
}
for (const args of [[], ['--unknown'], ['--text-file'], ['--text', '--hook']]) {
  test('guard rejects invalid arguments ' + args.join(' '), () => expectStatus(run(args), 2));
}
test('bash hook exposes the same integration contract', () => {
  const input = JSON.stringify({ tool_input: { command: 'git commit -m ' + quote(local) } });
  const result = spawnSync('bash', [resolve('gates/hook.sh')], { input, encoding: 'utf8' });
  expectStatus(result, 2, [local]);
});
