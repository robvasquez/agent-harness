import { parseDeliveryReport, checkEnvelope } from './contract.mjs';

const kind = process.argv[2];
if (process.argv.length !== 3 || !['report', 'envelope'].includes(kind)) {
  console.log(JSON.stringify({ valid: false, errors: ['Usage: check.mjs report|envelope (stdin only)'] }));
  process.exitCode = 2;
} else {
  let outcome;
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 65536) throw new Error('Input exceeds 64 KiB.');
      chunks.push(chunk);
    }
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
    outcome = kind === 'report' ? parseDeliveryReport(text) : checkEnvelope(text);
  } catch {
    outcome = { valid: false, errors: ['Unreadable, malformed or oversized input.'], [kind]: null };
  }
  console.log(JSON.stringify(outcome));
  process.exitCode = outcome.valid ? 0 : 1;
}
