const MAX_BYTES = 65536;
const reportLabels = ['Status', 'Files', 'Decisions', 'Warnings', 'Blockers', 'Confidence', 'Open questions', 'Assumptions made'];
const envelopeLabels = ['Goal', 'Task', 'Scope', 'Done-when', 'Constraints'];
const placeholder = /^(?:none|todo|tbd|n\/a|\.\.\.|…|<.*>|\{.*\})$/i;

// Parse only the documented grammar. Never search for a plausible block inside prose.
function readBlock(input, heading, labels) {
  const errors = [];
  const fields = new Map();
  if (typeof input !== 'string' || Buffer.byteLength(input) > MAX_BYTES) {
    return { fields, errors: ['Input must be a string of at most 64 KiB.'] };
  }
  const text = input.replaceAll('\r\n', '\n');
  if (/[\p{Cc}\p{Cf}\p{Cs}\uFFFD]/u.test(text.replaceAll('\n', ''))) {
    return { fields, errors: ['Control, invisible format or malformed characters are not allowed.'] };
  }
  const lines = text.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines.at(-1).trim() === '') lines.pop();
  if (lines.shift() !== '## ' + heading) errors.push('Expected exactly one ## ' + heading + ' block.');
  let current;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const field = /^- ([A-Za-z][A-Za-z -]*):(?: (.*))?$/.exec(line);
    if (field) {
      current = undefined;
      const label = field[1];
      if (!labels.includes(label)) {
        errors.push('Unknown field.');
      } else if (fields.has(label)) {
        errors.push('Duplicate field: ' + label + '.');
      } else {
        current = { inline: (field[2] ?? '').trim(), items: [] };
        fields.set(label, current);
      }
      continue;
    }
    const item = /^ {2}- (.+)$/.exec(line);
    if (item && current && !current.inline && item[1].trim()) {
      current.items.push(item[1].trim());
    } else {
      errors.push('Unexpected line or mixed inline and nested values.');
    }
  }
  for (const label of labels) {
    if (!fields.has(label)) errors.push('Missing field: ' + label + '.');
  }
  return { fields, errors };
}
function single(fields, errors, label) {
  const field = fields.get(label);
  if (!field) return '';
  if (!field.inline || field.items.length || placeholder.test(field.inline)) {
    errors.push(label + ' requires one non-placeholder value.');
  }
  return field.inline;
}
function list(fields, errors, label, { paths = false, required = false, directory = false } = {}) {
  const field = fields.get(label);
  if (!field) return [];
  const values = field.inline ? (paths ? field.inline.split(',').map(value => value.trim()) : [field.inline]) : field.items;
  if (values.length === 1 && values[0] === 'none' && !required) return [];
  if (!values.length || values.some(value => !value || placeholder.test(value))) {
    errors.push(label + ' requires values or an allowed empty marker.');
  }
  if (paths && values.some(value => !safePath(value, directory))) {
    errors.push(label + ' requires safe repository-relative paths.');
  }
  return [...values];
}
function safePath(value, directory) {
  const path = directory && value.endsWith('/') ? value.slice(0, -1) : value;
  return /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path) &&
    path.split('/').every(part => part !== '.' && part !== '..');
}
function result(key, parsed, errors) {
  return { valid: errors.length === 0, errors, [key]: errors.length ? null : parsed };
}
export function parseDeliveryReport(input) {
  const { fields, errors } = readBlock(input, 'DELIVERY', reportLabels);
  const status = single(fields, errors, 'Status');
  const confidence = single(fields, errors, 'Confidence');
  if (!['complete', 'partial', 'blocked'].includes(status)) errors.push('Status must be complete, partial or blocked.');
  if (!['high', 'medium', 'low'].includes(confidence)) errors.push('Confidence must be high, medium or low.');
  const report = {
    status,
    files: list(fields, errors, 'Files', { paths: true }),
    decisions: list(fields, errors, 'Decisions'),
    warnings: list(fields, errors, 'Warnings'),
    blockers: list(fields, errors, 'Blockers'),
    confidence,
    open_questions: list(fields, errors, 'Open questions'),
    assumptions: list(fields, errors, 'Assumptions made'),
  };
  if (status === 'complete' && report.blockers.length) errors.push('A complete report cannot list blockers.');
  if (status === 'blocked' && !report.blockers.length) errors.push('A blocked report must explain its blockers.');
  return result('report', report, errors);
}
export function checkEnvelope(input) {
  const { fields, errors } = readBlock(input, 'CONTEXT', envelopeLabels);
  const envelope = {
    goal: single(fields, errors, 'Goal'),
    task: single(fields, errors, 'Task'),
    scope: list(fields, errors, 'Scope', { paths: true, required: true, directory: true }),
    done_when: list(fields, errors, 'Done-when', { required: true }),
    constraints: list(fields, errors, 'Constraints', { required: true }),
  };
  return result('envelope', envelope, errors);
}
