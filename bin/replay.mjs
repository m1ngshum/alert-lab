#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {parseSuite, replay, markdown, maxBytes} from '../web/replay.js';

let file;
try {
  const args = process.argv.slice(2);
  if (![1,3].includes(args.length) || args[0].startsWith('-') || (args.length === 3 && (args[1] !== '--format' || !['json','markdown'].includes(args[2])))) throw new Error('Usage: node bin/replay.mjs <file> [--format json|markdown]');
  file = await open(args[0], 'r');
  if (!(await file.stat()).isFile()) throw new Error('Input must be a regular file.');
  const buffer = Buffer.alloc(maxBytes + 1);
  let length = 0;
  while (length < buffer.length) {
    const {bytesRead} = await file.read(buffer, length, buffer.length-length, null);
    if (!bytesRead) break;
    length += bytesRead;
  }
  if (length > maxBytes) throw new Error('Replay file exceeds 1 MiB.');
  const report = replay(parseSuite(buffer.subarray(0,length).toString('utf8')));
  console.log(args[2] === 'markdown' ? markdown(report) : JSON.stringify(report,null,2));
  process.exitCode = report.totals.failed ? 1 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
} finally {
  await file?.close();
}
