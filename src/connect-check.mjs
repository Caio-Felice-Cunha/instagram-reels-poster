// Quick sanity check: can we attach to your Chrome, and are you signed into
// Instagram? Run this once after the "One-time setup" in the README.
//   node src/connect-check.mjs
import { connectCDP, sleep } from './browser.mjs';

const { context } = await connectCDP();
const page = await context.newPage();
try {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const signedOut = await page.getByRole('link', { name: /log in/i }).count().catch(() => 0);
  console.log(JSON.stringify({
    attached: true,
    signedOut: signedOut > 0,
    hint: signedOut > 0
      ? 'Log into Instagram once in the Chrome window you launched, then re-run.'
      : 'Looks good — you are attached and signed in.',
  }, null, 2));
} finally {
  await page.close().catch(() => {});
  process.exit(0);
}
