<<<<<<< HEAD
# MuseScore MIDI Lejupielādētājs

Šis ir vienkāršs rīks, kas ļauj iegūt lejupielādējamu MIDI failu no MuseScore notis lapas.

## Kā tas darbojas?

Projekts ir sadalīts divās daļās:

1.  **Priekšgals (Frontend):** Tā ir `index.html` lapa, ko lietotājs redz savā pārlūkprogrammā. Šeit lietotājs var ielīmēt saiti uz MuseScore notīm.
2.  **Aizmugure (Backend):** Tas ir `api/get-midi.js` fails, kas darbojas kā "serverless" funkcija uz [Vercel](https://vercel.com/) platformas. Šī funkcija saņem MuseScore saiti no priekšgala.

**Darbības process:**

1.  Lietotājs ievada MuseScore URL adresi `index.html` lapā un nospiež pogu "Iegūt MIDI".
2.  Lapa nosūta šo URL uz `api/get-midi.js` funkciju, kas darbojas uz Vercel servera.
3.  Aizmugures funkcija, izmantojot "headless" pārlūkprogrammu (piemēram, Chromium), atver norādīto MuseScore lapu fonā.
4.  Tā analizē (scrape) lapas saturu, lai atrastu tiešo saiti uz MIDI failu, kas parasti nav publiski redzama.
5.  Kad saite ir atrasta, tā tiek nosūtīta atpakaļ uz priekšgalu.
6.  `index.html` lapa parāda lietotājam lejupielādes saiti.

## Izvietošana (Deployment)

Šo projektu var viegli izvietot uz Vercel platformas:

1.  Izveidojiet jaunu projektu savā Vercel kontā un savienojiet to ar šo GitHub repozitoriju.
2.  Vercel automātiski atpazīs `api` mapi un konfigurēs `get-midi.js` kā serverless funkciju.
3.  `index.html` tiks publicēts kā galvenā lapa.

Nekāda papildu konfigurācija nav nepieciešama.
=======
# musescore-scraper

Web app that takes a MuseScore score URL and returns a downloadable MIDI file link from a hosted serverless API.

## Project Structure

- `index.html`: frontend UI where users paste a MuseScore link.
- `api/get-midi.js`: serverless API that resolves MIDI URLs and can proxy the MIDI file download.
- `vercel.json`: function runtime config for API duration/memory.

## Install

```bash
npm install
```

## Run Locally

This project uses Playwright and requires a local Chromium binary path.

1. Install a Chromium binary for Playwright:

```bash
npx playwright-core install chromium
```

2. Set `CHROMIUM_PATH` to the downloaded Chromium binary path.

You can find it with:

```bash
find ~/.cache/ms-playwright -type f -name chrome | head -n 1
```

3. Run with your serverless runtime (for example `vercel dev`).

Example:

```bash
export CHROMIUM_PATH="$(find ~/.cache/ms-playwright -type f -name chrome | head -n 1)"
npx vercel dev
```

Note: `vercel dev` may require Vercel authentication in local environments.

Then open `index.html` via your local web server and call:

`/api/get-midi?scoreUrl=<encoded_musescore_url>`

## Deploy For Public Use

To make this work for everyone without any user installation:

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Deploy.
4. Share the Vercel domain.

After deployment, users only need to:

1. Open your website.
2. Paste a MuseScore URL.
3. Click Download MIDI File.

No browser extensions or local setup are required for users.

## Anti-Bot Reliability (Important)

MuseScore can block some server environments with anti-bot checks (Cloudflare). For best public reliability, connect this API to a managed remote browser provider.

Set these environment variables in your deployment:

- `BROWSER_WS_ENDPOINT`: Playwright or CDP websocket endpoint from your browser provider.
- `BROWSER_WS_PROTOCOL`: `playwright` (default) or `cdp`.

When `BROWSER_WS_ENDPOINT` is set, the API uses that remote browser instead of local Chromium.

## API Behavior

- `GET /api/get-midi?scoreUrl=...` returns JSON with:
	- `midiUrl`: detected source URL
	- `downloadUrl`: API proxy download URL for direct file download
- `GET /api/get-midi?scoreUrl=...&download=1` returns the MIDI file as an attachment.

## Notes

- The frontend uses same-origin API by default. You can set `window.MIDI_API_BASE` to point to a different API host.
- Some MuseScore pages are protected by anti-bot checks; if you receive a `403` response, configure `BROWSER_WS_ENDPOINT`.
>>>>>>> adec18883b13557d94b90cebe324540aa392c2e4
