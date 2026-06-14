// Post every Reel in a manifest, spaced out with a little jitter, HARD-STOPPING
// on an Instagram action-block. Resumable: finished posts are recorded in
// .posted.json and skipped on re-run.
//
//   node src/batch.mjs                       # uses ./manifest.json
//   node src/batch.mjs --manifest my.json --spacing 4
import fs from 'node:fs';
import { connectCDP, parseArgs, sleep } from './browser.mjs';
import { config, resolveVideoPath } from './config.mjs';
import { postReel } from './post.mjs';

const a = parseArgs(process.argv);
const MANIFEST = a.manifest || 'manifest.json';
const STATE = a.state || '.posted.json';
const SPACING_MIN = a.spacing ? Number(a.spacing) : config.batchSpacingMinutes;
const log = (...m) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...m);

if (!fs.existsSync(MANIFEST)) {
  console.error(`manifest not found: ${MANIFEST} (copy manifest.example.json to manifest.json and edit it)`);
  process.exit(2);
}
const items = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const prior = fs.existsSync(STATE) ? (JSON.parse(fs.readFileSync(STATE, 'utf8')).done || []) : [];
const doneSet = new Set(prior);

const { context } = await connectCDP();
log(`${items.length} reels; ${doneSet.size} already posted; ~${SPACING_MIN} min apart (+ jitter)`);
let count = 0;
for (let i = 0; i < items.length; i += 1) {
  const it = items[i];
  if (doneSet.has(it.file)) { log(`[${i + 1}/${items.length}] skip (done): ${it.file}`); continue; }
  log(`[${i + 1}/${items.length}] posting: ${it.file}`);
  try {
    const res = await postReel(context, {
      ...it,
      file: resolveVideoPath(it.file),
      location: it.location || config.defaultLocation,
    });
    if (!res || !res.ok) throw new Error('post did not complete');
    doneSet.add(it.file);
    fs.writeFileSync(STATE, JSON.stringify({ done: [...doneSet], updated: new Date().toISOString() }, null, 2));
    count += 1;
    log(`OK ${it.file} — ${count} this run, ${doneSet.size}/${items.length} total`);
  } catch (err) {
    const msg = (err && err.message) || String(err);
    if (/ACTION_BLOCKED/.test(msg)) {
      log('!! Instagram ACTION-BLOCK detected — stopping immediately. Do not retry today.');
    } else {
      log(`FAILED ${it.file}: ${msg} — stopping. Re-run to resume (finished posts are skipped).`);
    }
    break;
  }
  if (i < items.length - 1 && !doneSet.has(items[i + 1]?.file)) {
    const waitMs = Math.round((SPACING_MIN * 60 + Math.random() * 90) * 1000);
    log(`waiting ${Math.round(waitMs / 1000)}s ...`);
    await sleep(waitMs);
  }
}
log(`done — ${count} posted this run, ${doneSet.size}/${items.length} total.`);
process.exit(0);
