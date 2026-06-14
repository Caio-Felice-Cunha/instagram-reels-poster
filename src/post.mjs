// Post ONE Reel to instagram.com by driving the Create flow in your attached
// Chrome. Instagram's web app has no scheduling, so this posts immediately.
//
//   node src/post.mjs --video ./videos/reel.mp4 --caption "My caption" --location "New York, NY"
//
// Notes:
//  - The video is injected straight into the file input via CDP (no OS dialog).
//  - The crop is set to "Original" so the full frame shows (good for 9:16 video).
//  - The caption box is a Lexical editor: we type real keystrokes and READ THE
//    FIELD BACK, refusing to Share if the caption did not land (Instagram's
//    insertText path can render text without committing it -> a blank caption).
import fs from 'node:fs';
import path from 'node:path';
import { connectCDP, parseArgs, sleep } from './browser.mjs';
import { config, resolveVideoPath } from './config.mjs';

async function setCaption(page, caption) {
  const cap = page.locator('div[aria-label="Write a caption..."], div[contenteditable="true"][role="textbox"]').first();
  await cap.waitFor({ state: 'visible', timeout: 15000 });
  await cap.click();
  await sleep(300);
  await page.keyboard.type(caption, { delay: 4 });
  await sleep(800);
  const got = String((await cap.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const probe = caption.replace(/\s+/g, ' ').trim().slice(0, 25);
  if (probe && (!got || !got.includes(probe))) {
    throw new Error(`CAPTION_NOT_SET (typed ${caption.length} chars, field shows ${got.length})`);
  }
}

// Best-effort location tag — never blocks the post. Location matching is fuzzy:
// we type your string and pick the exact suggestion if present, else the first.
async function setLocation(page, location) {
  const input = page.locator('input[name="creation-location-input"]').first();
  if (!(await input.count())) return false;
  await input.click().catch(() => {});
  await page.keyboard.type(location, { delay: 25 });
  await sleep(2800);
  const exact = page.getByText(location, { exact: true }).first();
  if (await exact.count()) {
    await exact.click({ timeout: 5000 }).catch(() => {});
  } else {
    const firstToken = location.split(',')[0].trim();
    if (firstToken) await page.getByText(firstToken, { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
  }
  await sleep(900);
  return /\S/.test(await input.inputValue().catch(() => ''));
}

export async function postReel(context, entry) {
  const { file, caption = '', location = '', crop = 'original' } = entry;
  const videoPath = path.resolve(file);
  if (!fs.existsSync(videoPath)) throw new Error(`video not found: ${videoPath}`);

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    // Create -> Post
    await page.locator('svg[aria-label="New post"]').first().click({ timeout: 15000 })
      .catch(async () => { await page.getByRole('link', { name: /create/i }).first().click().catch(() => {}); });
    await sleep(1500);
    await page.getByText('Post', { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await sleep(2500);
    // inject the video
    const client = await page.context().newCDPSession(page);
    await client.send('DOM.enable');
    const { root } = await client.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type="file"]' });
    if (!nodeId) throw new Error('file input not found');
    await client.send('DOM.setFileInputFiles', { nodeId, files: [videoPath] });
    await sleep(6000);
    await page.getByRole('button', { name: /^OK$/ }).first().click({ timeout: 4000 }).catch(() => {});
    await sleep(2000);
    // full-frame crop
    if (crop === 'original') {
      await page.locator('svg[aria-label="Select crop"]').first().click({ timeout: 8000 }).catch(() => {});
      await sleep(1200);
      await page.getByText('Original', { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
      await sleep(1200);
    }
    // advance to the share step
    for (let i = 0; i < 2; i += 1) {
      await page.getByText('Next', { exact: true }).first().click({ timeout: 10000 }).catch(() => {});
      await sleep(4000);
    }
    // caption (skip if empty) then optional location
    if (caption && caption.trim()) await setCaption(page, caption);
    let locationSet = false;
    if (location && location.trim()) locationSet = await setLocation(page, location).catch(() => false);

    // Share — the submit control is a VISIBLE div[role="button"] whose text is "Share"
    const shareBtn = page.locator('div[role="button"]:visible').filter({ hasText: /^Share$/ }).first();
    await shareBtn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await shareBtn.click({ timeout: 15000 })
      .catch(async () => { await page.getByRole('button', { name: 'Share', exact: true }).first().click({ timeout: 10000 }); });

    // wait until the upload truly finishes, or detect an action-block
    let posted = false;
    for (let w = 0; w < 75; w += 1) { // up to ~150s
      await sleep(2000);
      const body = String(await page.evaluate(() => document.body.innerText || '').catch(() => ''));
      if (/Action Blocked|Try Again Later|restrict certain activity/i.test(body)) throw new Error('ACTION_BLOCKED');
      if (/has been shared/i.test(body)) { posted = true; break; }
      const stillBusy = /Sharing|New reel|New post/i.test(body)
        || (await page.locator('div[aria-label="Write a caption..."]').count().catch(() => 0)) > 0;
      if (!stillBusy && w > 4) { posted = true; break; }
    }
    await sleep(2000);
    return { ok: posted, file: path.basename(videoPath), locationSet };
  } finally {
    await page.close().catch(() => {});
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.basename(process.argv[1]) === 'post.mjs') {
  const a = parseArgs(process.argv);
  if (!a.video) {
    console.error('usage: node src/post.mjs --video <path> [--caption "..."] [--location "City, ST"]');
    process.exit(2);
  }
  const { context } = await connectCDP();
  try {
    const res = await postReel(context, {
      file: resolveVideoPath(a.video),
      caption: a.caption || '',
      location: a.location || config.defaultLocation,
    });
    console.log(JSON.stringify(res));
    process.exit(res.ok ? 0 : 1);
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: (err && err.message) || String(err) }));
    process.exit(1);
  }
}
