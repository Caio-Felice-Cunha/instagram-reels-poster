# instagram-reels-poster

Post **Reels** to Instagram by driving **instagram.com** in your own logged-in
Chrome over the Chrome DevTools Protocol (CDP). No Graph API, no Business account,
no OS file dialog — it attaches to a browser you control and clicks through the
real Create flow.

Give it a folder of vertical video files plus a small JSON manifest of captions
(and optional locations), and it posts them one by one.

> ⚠️ **Use responsibly, at your own risk.** This automates your own browser
> session. Automating Instagram may be against the Instagram Terms of Use, and
> Instagram actively restricts accounts that post in automated/bursty patterns.
> Use it only on your own account and content. Provided "as is" (MIT, no warranty).

> ℹ️ **Instagram's web app cannot schedule.** There is no schedule button in the
> Create flow, so this tool posts **immediately**. (Scheduling Reels requires Meta
> Business Suite or the Graph API, which need a linked Facebook Page — out of scope
> here.)

---

## Why a browser?

The Instagram Graph API requires a Business/Creator account linked to a Facebook
Page and app review. Driving the normal website posts exactly as if you did it by
hand, from any account. Two details make it reliable:

1. **Attach, don't launch.** Attaching (`connectOverCDP`) to a Chrome **you**
   launched keeps a clean fingerprint, so your existing Instagram login keeps
   working. (A Playwright-launched browser sets `navigator.webdriver`.)
2. **Inject the file over CDP.** `DOM.setFileInputFiles` hands Chrome the local
   path directly — instant, no OS picker, no size cap.

---

## One-time setup

### 1. Install
```bash
npm install
```

### 2. Launch a debuggable Chrome

Chrome 136+ blocks `--remote-debugging-port` on your **default** profile, so use a
**separate** user-data directory. Close other Chrome windows first, then:

**Windows**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:USERPROFILE\chrome-automation" `
  --profile-directory="Default"
```
**macOS**
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir="$HOME/chrome-automation" --profile-directory="Default"
```
**Linux**
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/chrome-automation" --profile-directory="Default"
```

In that window, **log into Instagram once**. The login persists in that user-data
directory.

### 3. Check the connection
```bash
npm run connect-check     # expect signedOut: false
```

### 4. Configure
```bash
cp .env.example .env       # then edit .env (VIDEOS_DIR, spacing, optional default location)
```

---

## Usage

### One reel
```bash
node src/post.mjs --video ./videos/reel.mp4 --caption "My caption #tags" --location "New York, NY"
```

### A batch
```bash
cp manifest.example.json manifest.json    # then edit it
node src/batch.mjs
```

`manifest.json` is an array; each entry:

| field | required | meaning |
|---|---|---|
| `file` | yes | filename inside `VIDEOS_DIR` (or an absolute path) |
| `caption` | no | the caption (newlines + hashtags kept). Empty string = no caption. |
| `location` | no | a place to tag, e.g. `"Lisbon, Portugal"`. Best-effort match. Falls back to `DEFAULT_LOCATION`. |

Finished posts are recorded in `.posted.json` (gitignored). If the run stops, just
re-run — it skips what's done and continues.

---

## Pacing (read this)

Instagram restricts accounts that post many times in quick succession — this is the
**single biggest risk**. Defaults here are conservative (≈3 min apart, plus jitter),
and the batch **stops immediately** if Instagram shows an action-block. Even so:

- For a brand-new or low-history account, post a **handful per day**, not dozens.
- Spread a large backlog over **days/weeks**, not one sitting.
- If you get blocked, **stop for the day** — re-running into a block makes it worse.

---

## Good to know (hard-won notes)

- **The caption box is a Lexical editor.** Naive `insertText` can render text that
  never commits, so the reel posts **blank**. This tool types real keystrokes and
  then **reads the field back**, refusing to Share if the caption didn't land.
- **The crop is set to "Original"** so a 9:16 video fills the frame.
- **Don't close the browser tab mid-upload** — it aborts the post. The tool waits
  for "Your reel has been shared." before moving on (~70–90s per post).
- **Location matching is fuzzy.** It types your string and picks the top
  suggestion; if it can't, it posts without a location rather than failing.
- **Selectors can change.** This drives Instagram's DOM; a UI change may require a
  selector update. PRs welcome.

---

## License

MIT — see [LICENSE](LICENSE).
