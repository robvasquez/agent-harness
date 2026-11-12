import { constants, lstatSync, openSync, fstatSync, readFileSync, closeSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const usage = 'Usage: sanitize-check.sh [--denylist PATH] [ROOT]';
const baselinePath = resolve(dirname(fileURLToPath(import.meta.url)), '../config/denylist.json');
const decoder = new TextDecoder('utf-8', { fatal: true });
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/\p{Cf}/gu, '');
const words = text => normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
const digest = (salt, text) => createHash('sha256').update(salt + '\0' + text).digest('hex');

function readRegular(path) {
  const before = lstatSync(path);
  if (!before.isFile() || (before.mode & 0o444) === 0) throw new Error('unreadable or unsupported entry');
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const after = fstatSync(descriptor);
    if (!after.isFile() || after.ino !== before.ino || after.dev !== before.dev) throw new Error('entry changed');
    const value = decoder.decode(readFileSync(descriptor));
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new Error('binary entry');
    return value;
  } finally {
    closeSync(descriptor);
  }
}
function readPolicy(path, mandatory = false) {
  const value = JSON.parse(readRegular(path));
  const keys = ['hashes', 'maxWords', 'salt', 'version'];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys) ||
      value.version !== 1 || typeof value.salt !== 'string' || !/^(?:[0-9a-f]{2})+$/.test(value.salt) ||
      !Number.isSafeInteger(value.maxWords) || value.maxWords < 1 ||
      !Array.isArray(value.hashes) || (mandatory && value.hashes.length === 0) || !value.hashes.every(item => typeof item === 'string' && /^[0-9a-f]{64}$/.test(item))) {
    throw new Error('invalid policy');
  }
  return { salt: value.salt, maxWords: value.maxWords, hashes: new Set(value.hashes) };
}
const patterns = [
  /#\d+\b/u,
  /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?\.[\p{L}]{2,}/iu,
  /(?:^|[^\p{L}\p{N}])\/(?:users|home)\/(?:[^\s/]+)/iu,
  /\b[a-z]:[\\/](?:users|documents and settings)[\\/][^\s\\/]+/iu,
  /(?:^|[^\p{L}\p{N}])~(?:[\p{L}\p{N}._-]*)[\\/]/u,
  /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/iu,
  /\b(?:rtn|rt|art|routine|artifact)[_-][a-z0-9][a-z0-9_-]{5,}\b/iu,
  /\b(?:routine|artifact)(?:\s+id)?\s*[:=]\s*[a-z0-9_-]{6,}\b/iu,
  /\b(?:pr\s*#?\s*\d+|pull\/\d+|pull\s+request\s*#?\s*\d+)\b/iu,
  /\b[A-Z][A-Z\d]{1,9}-\d+\b/u,
  /\b(?=[a-zA-Z\d]{20,32}\b)(?=[a-zA-Z\d]*[a-z])(?=[a-zA-Z\d]*[A-Z])(?=[a-zA-Z\d]*\d)[a-zA-Z\d]+\b/u,
];
function restricted(text, policies) {
  const canonical = text.normalize('NFKC').replace(/\p{Cf}/gu, '');
  if (patterns.some(pattern => pattern.test(canonical))) return true;
  const tokens = words(text);
  return policies.some(policy => {
    for (let start = 0; start < tokens.length; start += 1) {
      for (let count = 1; count <= policy.maxWords && start + count <= tokens.length; count += 1) {
        if (policy.hashes.has(digest(policy.salt, tokens.slice(start, start + count).join(' ')))) return true;
      }
    }
    return false;
  });
}
function scan(root, policies) {
  const rootInfo = lstatSync(root);
  if (!rootInfo.isDirectory() || (rootInfo.mode & 0o444) === 0) throw new Error('invalid root');
  let count = 0;
  function walk(directory, relative = '') {
    const entries = readdirSync(directory).sort();
    for (const entry of entries) {
      if (relative === '' && entry === '.git') continue;
      const path = join(directory, entry);
      const name = relative ? relative + '/' + entry : entry;
      if (restricted(name, policies)) throw new Error('restricted filename');
      const info = lstatSync(path);
      if (info.isDirectory()) {
        if ((info.mode & 0o444) === 0) throw new Error('unreadable directory');
        walk(path, name);
      } else {
        if (restricted(readRegular(path), policies)) throw new Error('restricted content');
        count += 1;
      }
    }
  }
  walk(root);
  return count;
}
function main(args) {
  let extra;
  let root;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' && args.length === 1) {
      console.log(usage);
      return 0;
    }
    if (argument === '--denylist' && extra === undefined && args[index + 1] && !args[index + 1].startsWith('-')) {
      extra = args[++index];
    } else if (argument.startsWith('-') || root !== undefined) {
      console.error(usage);
      return 2;
    } else {
      root = argument;
    }
  }
  try {
    const policies = [readPolicy(baselinePath, true)];
    if (extra !== undefined) policies.push(readPolicy(resolve(extra)));
    const count = scan(resolve(root ?? '.'), policies);
    console.log('Sanitize check passed (' + count + ' files).');
    return 0;
  } catch {
    console.error('Sanitize check blocked: restricted data, invalid policy, or unreadable entry.');
    return 1;
  }
}
process.exitCode = main(process.argv.slice(2));
