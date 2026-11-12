import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectProse, inspectCommand } from '../gates/prose-guard.mjs';

test('policy permits ordinary technical prose and device paths', () => {
  assert.deepEqual(inspectProse('Redirect failed jobs to ' + '/' + 'dev/null. Plain Claude and Codex names are fine.'), []);
});
test('policy reports categories without retaining the original text', () => {
  const body = 'Read ' + '/' + ['home', 'sample', 'draft.md'].join('/') + '. Great question!';
  const result = inspectProse(body);
  assert.ok(result.includes('local-path'));
  assert.ok(result.includes('humanizer'));
  assert.ok(!JSON.stringify(result).includes('sample'));
});
test('policy catches compatibility letters and common look-alikes', () => {
  const link = 'https://claude.ai/share/synthetic';
  const wide = [...link].map(c => /[a-z]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0xfee0) : c).join('');
  for (const value of [wide, link.replace('a', '\u0430'), link.replace('l', 'l\u200b')]) {
    assert.ok(inspectProse(value).includes('ai-reference'));
  }
});
test('em dash density has a word-based budget', () => {
  assert.ok(inspectProse('One — two — three').includes('humanizer'));
  assert.deepEqual(inspectProse('word '.repeat(300) + 'one — two — three'), []);
});
test('unquoted expanding heredocs block instead of approving the unevaluated text', () => {
  for (const text of ['$BODY', '`printf sample`', '$(printf sample)', 'safe\\\n$BODY']) {
    assert.throws(() => inspectCommand('gh pr create --body-file - <<END\n' + text + '\nEND'));
  }
});
test('quoted heredocs treat dollar text as literal data', () => {
  assert.deepEqual(inspectCommand("gh pr create --body-file - <<'END'\nThe cost is $5.\nEND"), []);
});
test('newline command chains block even without a second outbound verb', () => {
  assert.throws(() => inspectCommand("git commit -m 'Update latch'\nprintf sample"));
});
test('unquoted pathname, brace and tilde expansions block in outbound prose', () => {
  for (const fragment of ['G*', 'G?', '[Gg]reat', '{Great,Good}', '~']) {
    for (const prefix of ['git commit -m ', 'gh pr edit 7 --body ']) {
      assert.throws(() => inspectCommand(prefix + fragment), fragment);
      assert.deepEqual(inspectCommand(prefix + "'" + fragment + "'"), []);
    }
  }
});
test('message density checks the combined repeated message paragraphs', () => {
  assert.ok(inspectCommand("git commit -m 'Latch — pin' -m 'Hinge — screw'").includes('humanizer'));
});
test('literal quotes in command names do not bypass recognition', () => {
  const body = '/' + ['home', 'sample', 'draft'].join('/');
  for (const prefix of ["git 'commit' -m ", 'git comm"it" -m ', 'g"it" commit -m ', 'gh pr cre"ate" --body ']) {
    assert.ok(inspectCommand(prefix + "'" + body + "'").includes('local-path'));
  }
});
test('Git template options read content while gh short title stays inline', t => {
  const directory = mkdtempSync(join(tmpdir(), 'prose-template-'));
  const path = join(directory, 'message.txt');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const flags = ["-t '", "-t'", "--template '", "--template='"];
  writeFileSync(path, 'Great question! The latch is fixed.');
  for (const flag of flags) assert.ok(inspectCommand('git commit --no-edit ' + flag + path + "'").includes('humanizer'));
  for (const flag of flags) assert.throws(() => inspectCommand('git commit --no-edit ' + flag + path + "-missing'"));
  chmodSync(path, 0);
  assert.throws(() => inspectCommand("git commit -t '" + path + "'"));
  chmodSync(path, 0o600);
  const link = join(directory, 'link.txt');
  symlinkSync(path, link);
  assert.throws(() => inspectCommand("git commit -t '" + link + "'"));
  writeFileSync(path, 'The latch is fixed.');
  for (const flag of flags) assert.deepEqual(inspectCommand('git commit --no-edit ' + flag + path + "'"), []);
  assert.deepEqual(inspectCommand("gh pr create -t 'The latch is fixed.' -b 'Checked the pin.'"), []);
});
test('Git template dash is not accepted as heredoc stdin', () => {
  for (const flag of ['-t -', '-t-', '--template -', '--template=-']) {
    assert.throws(() => inspectCommand('git commit --no-edit ' + flag + " <<'END'\nThe latch is fixed.\nEND"));
  }
  assert.deepEqual(inspectCommand("git commit -F - <<'END'\nThe latch is fixed.\nEND"), []);
});
test('unrelated commands can mention command names without being shell-parsed', () => {
  for (const command of ['printf git | cat', 'rg git . > result.txt', 'printf gh && printf sample']) {
    assert.deepEqual(inspectCommand(command), []);
  }
});
