import { inspectProse, readText, report } from './prose-guard.mjs';

function text(value, nullable = false) {
  if (nullable && value === null) return '';
  if (typeof value !== 'string') throw new Error('missing text');
  return value;
}
function eventText(event, name) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('invalid event');
  if (name === 'pull_request' || name === 'issues') {
    const item = name === 'pull_request' ? event.pull_request : event.issue;
    return [text(item?.title), text(item?.body, true)];
  }
  if (name !== 'push' || !Array.isArray(event.commits) || !Object.hasOwn(event, 'head_commit')) throw new Error('unsupported event');
  const messages = event.commits.map(commit => text(commit?.message));
  if (event.head_commit !== null && event.head_commit !== undefined) messages.push(text(event.head_commit.message));
  if (!messages.length && event.deleted !== true) throw new Error('missing commits');
  return messages;
}
try {
  if (process.argv.length !== 3) throw new Error('missing file');
  const event = JSON.parse(readText(process.argv[2]));
  const categories = eventText(event, process.env.GITHUB_EVENT_NAME).flatMap(inspectProse);
  process.exitCode = report([...new Set(categories)]);
} catch {
  console.error('BLOCKED: invalid-input (invalid or unsupported event data).');
  process.exitCode = 2;
}
