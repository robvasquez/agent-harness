import { constants, lstatSync, openSync, fstatSync, readFileSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const decoder = new TextDecoder('utf-8', { fatal: true });
const maximumBytes = 1024 * 1024;
const lookAlikes = new Map([
  ['а', 'a'], ['ɑ', 'a'], ['α', 'a'], ['с', 'c'], ['ϲ', 'c'], ['е', 'e'],
  ['ε', 'e'], ['і', 'i'], ['ι', 'i'], ['ј', 'j'], ['κ', 'k'], ['к', 'k'],
  ['ο', 'o'], ['о', 'o'], ['р', 'p'], ['ρ', 'p'], ['ѕ', 's'], ['τ', 't'],
  ['т', 't'], ['υ', 'u'], ['х', 'x'], ['χ', 'x'], ['у', 'y'], ['ν', 'v'],
]);
function canonical(text) {
  return [...text.normalize('NFKC').toLowerCase().replace(/\p{Cf}/gu, '')]
    .map(character => lookAlikes.get(character) ?? character).join('');
}
const rules = [
  ['pipeline-reference', /(?:^|[^\w/])\/dev(?![\w/])|\bf-[1-4]\b/u],
  ['local-path', /(?:^|[^\w])~[\w.-]*[\\/]|\/(?:users|home|tmp|private\/(?:tmp|var)|var\/folders)\/|\.(?:claude|worktrees)\/|\$(?:tmpdir|home)\b|\b[a-z]:[\\/](?:users|documents and settings)[\\/]/u],
  ['ai-reference', /(?:https?:\/\/)?(?:claude\.ai|chatgpt\.com)\/|\b(?:claude|codex|chatgpt)-session\s*:|co-authored-by:[^\n]*(?:claude|codex|chatgpt)|generated (?:with|by)\s*\[?(?:claude|codex|chatgpt)/u],
  ['humanizer', /\b(?:it['’]?s worth noting|importantly,|in conclusion|in summary,|great question|certainly!|i hope this helps|comprehensive(?:ly)?|delv(?:e|es|ing)|seamless(?:ly)?|leverag(?:e|es|ing))(?=$|\W)/u],
];

export function inspectProse(text) {
  if (typeof text !== 'string') throw new Error('invalid text');
  const normalized = canonical(text);
  const categories = rules.filter(([, expression]) => expression.test(normalized)).map(([category]) => category);
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  const dashCount = (text.match(/—/gu) ?? []).length;
  if (/[“”‘’]|\p{Extended_Pictographic}/u.test(text) || dashCount > Math.max(1, Math.floor(words / 150))) {
    categories.push('humanizer');
  }
  return [...new Set(categories)];
}

export function readText(path) {
  const descriptor = path === '-' ? 0 : openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (path !== '-') {
      const before = lstatSync(path);
      const opened = fstatSync(descriptor);
      if (!before.isFile() || !opened.isFile() || (opened.mode & 0o444) === 0 ||
          before.ino !== opened.ino || before.dev !== opened.dev || opened.size > maximumBytes) throw new Error('invalid file');
    }
    const bytes = readFileSync(descriptor);
    if (bytes.length > maximumBytes) throw new Error('input too large');
    const text = decoder.decode(bytes);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new Error('binary input');
    return text;
  } finally {
    if (path !== '-') closeSync(descriptor);
  }
}

// This accepts literal arguments, not a shell language. Never eval or spawn them.
function literalWords(command, limit = Infinity) {
  const words = [];
  let word = '', quote = '', active = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote === "'") {
      if (character === quote) quote = '';
      else word += character;
    } else if (character === '\\') {
      const next = command[++index];
      if (next === undefined || next === '\n') throw new Error('unsupported escape');
      if (quote === '"' && !['$', '`', '"', '\\'].includes(next)) word += '\\';
      word += next;
      active = true;
    } else if (quote === '"') {
      if (character === quote) quote = '';
      else if (character === '$' || character === '`') throw new Error('dynamic shell text');
      else word += character;
    } else if (character === '"' || character === "'") {
      quote = character;
      active = true;
    } else if (character === '\n' || character === '\r') {
      throw new Error('multiple commands');
    } else if (/\s/u.test(character)) {
      if (active) words.push(word);
      if (words.length === limit) return words;
      word = ''; active = false;
    } else {
      if (limit === 1 && active && /[;|&<>]/u.test(character)) return [word];
      if (/[;$`|&<>()#*?\[\]{}~]/u.test(character)) throw new Error('unsupported shell syntax');
      word += character; active = true;
    }
  }
  if (quote) throw new Error('unclosed quote');
  if (active) words.push(word);
  return words;
}

function extractHeredoc(command) {
  const opening = /<<(-)?\s*(['"]?)([A-Za-z_][A-Za-z_0-9]*)\2[ \t]*\n/u.exec(command);
  if (!opening) return { command, body: null, substitution: false };
  const prefix = command.slice(0, opening.index);
  const rest = command.slice(opening.index + opening[0].length);
  const lines = rest.split('\n');
  const end = lines.findIndex(line => (opening[1] ? line.replace(/^\t+/u, '') : line) === opening[3]);
  if (end < 0) throw new Error('unterminated heredoc');
  const body = lines.slice(0, end).map(line => opening[1] ? line.replace(/^\t+/u, '') : line).join('\n');
  if (!opening[2] && /[$`\\]/u.test(body)) throw new Error('expanding heredoc');
  const tail = lines.slice(end + 1).join('\n').trim();
  const cat = /"\$\(cat[ \t]*$/u.exec(prefix);
  if (cat) {
    if (tail !== ')"') throw new Error('unsupported heredoc tail');
    return { command: prefix.slice(0, cat.index) + "'__LITERAL_HEREDOC__'", body, substitution: true };
  }
  if (tail) throw new Error('unsupported heredoc tail');
  return { command: prefix, body, substitution: false };
}

const proseFlags = new Set(['-m', '-b', '-t', '--message', '--body', '--title', '--subject', '--description', '--notes', '--summary']);
const fileFlags = new Set(['-F', '--file', '--body-file']);
const switches = new Set(['-a', '--annotate', '--amend', '--no-edit', '--allow-empty', '--no-verify', '--signoff', '-s', '--draft', '--approve', '--request-changes', '--comment', '--squash', '--merge', '--rebase', '--delete-branch']);
const valueFlags = new Set(['--base', '--head', '--repo', '-R', '--author', '--date']);
const writes = 'create|edit|comment|review|merge';
const outbound = new RegExp('\\b(?:git\\s+(?:commit|tag)|gh\\s+(?:pr|issue)\\s+(?:' + writes + '))\\b', 'u');

export function inspectCommand(command) {
  if (typeof command !== 'string') throw new Error('invalid command');
  const scopeHint = command.replace(/\\\r?\n/gu, '').replace(/['"\\]/gu, '');
  if (!/\b(?:git|gh)\b/u.test(scopeHint)) return [];
  const executable = literalWords(command.trim(), 1)[0];
  if (!['git', 'gh'].includes(executable)) {
    if (outbound.test(scopeHint)) throw new Error('unsupported command prefix');
    return [];
  }
  const heredoc = extractHeredoc(command);
  const tokens = literalWords(heredoc.command.trim());
  const git = tokens[0] === 'git' && ['commit', 'tag'].includes(tokens[1]);
  const gh = tokens[0] === 'gh' && ['pr', 'issue'].includes(tokens[1]) && new RegExp('^(?:' + writes + ')$', 'u').test(tokens[2]);
  if (!git && !gh) {
    if (outbound.test(scopeHint)) throw new Error('unsupported command prefix');
    return [];
  }
  let heredocUsed = false;
  const prose = [];
  for (let index = git ? 2 : 3; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('-')) {
      // Numeric selectors, URLs, tag names and commit paths are not prose.
      if (git && tokens[1] === 'tag') prose.push(token);
      continue;
    }
    const match = /^(--[a-z-]+)=(.*)$|^(-[mbtF])(.+)$/u.exec(token);
    const flag = match ? match[1] ?? match[3] : token;
    const attached = match ? match[2] ?? match[4] : undefined;
    const template = git && tokens[1] === 'commit' && ['-t', '--template'].includes(flag);
    if (switches.has(flag) && attached === undefined) continue;
    if (!proseFlags.has(flag) && !fileFlags.has(flag) && !valueFlags.has(flag) && !template) throw new Error('unsupported flag');
    const value = attached ?? tokens[++index];
    if (value === undefined) throw new Error('missing value');
    if (valueFlags.has(flag)) continue;
    if (fileFlags.has(flag) || template) {
      if (template && value === '-') throw new Error('literal dash template unsupported');
      if (value === '-') {
        if (heredoc.body === null || heredoc.substitution) throw new Error('missing stdin body');
        prose.push(heredoc.body); heredocUsed = true;
      } else {
        if (value.includes('$') || value.startsWith('~')) throw new Error('dynamic filename');
        prose.push(readText(value));
      }
    } else if (value === '__LITERAL_HEREDOC__' && heredoc.substitution) {
      prose.push(heredoc.body); heredocUsed = true;
    } else prose.push(value);
  }
  if (heredoc.body !== null && !heredocUsed) throw new Error('unused heredoc');
  if (prose.length === 0) throw new Error('no explicit prose');
  return inspectProse(prose.join('\n'));
}

export function report(categories) {
  if (categories.length) {
    console.error('BLOCKED: ' + categories.join(', ') + '. Revise the text before sending.');
    return 2;
  }
  console.log('PASS: prose check.');
  return 0;
}

function main(args) {
  try {
    if (args.length === 1 && args[0] === '--hook') {
      const payload = JSON.parse(readText('-'));
      return report(inspectCommand(payload?.tool_input?.command));
    }
    if (args.length === 1 && args[0] === '--text') return report(inspectProse(readText('-')));
    if (args.length === 2 && args[0] === '--text-file') return report(inspectProse(readText(args[1])));
    throw new Error('invalid arguments');
  } catch {
    console.error('BLOCKED: invalid-input (unreadable data or unsupported command syntax).');
    return 2;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
