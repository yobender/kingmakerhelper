# Setup On Another PC

Use this checklist to move `DM Helper` to a second Windows PC with the same campaign data and PF2e local models.

## Option A: Fastest path

Use this if you just want the app running quickly.

1. Copy the portable app:
   - `dist\DM Helper 0.1.0.exe`
2. Run the `.exe` on the other PC.
3. In the current app, export your campaign:
   - `Export Campaign JSON`
4. In the other PC app, import it:
   - `Import Campaign JSON`
5. Copy your PDF library to the other PC.
6. In `PDF Intel`, point to that folder and re-index once.

## Option B: Full source setup

Use this if you want the repo and local build workflow on the other PC.

1. Install:
   - Node.js
   - Ollama
   - Git
2. Clone the repo:
   - `git clone https://github.com/yobender/DM-Helper.git`
3. Open the repo folder:
   - `cd DM-Helper`
4. Install app dependencies:
   - `npm install`
5. Start the desktop app:
   - `npm run start`

## Build the portable app on the other PC

If you want a fresh `.exe` there:

1. From the repo root:
   - `npm run dist`
2. Output:
   - `dist\DM Helper 0.1.0.exe`

## Restore campaign data

Recommended:

1. On the current PC, use:
   - `Export Campaign JSON`
2. On the other PC, use:
   - `Import Campaign JSON`

Optional advanced copy:

- Indexed PDF summary cache:
  - `C:\Users\Chris Bender\AppData\Roaming\dm-helper\pdf-index-cache.v1.json`

You do not need that cache file if you are fine re-indexing and re-summarizing PDFs.

## Restore PDF access

1. Copy your PDF folder to the other PC.
2. Open `PDF Intel`.
3. Set the PDF folder path.
4. Click `Index PDFs`.
5. Summarize books again only if you did not copy the cache file above.

## Restore PF2e local AI models

From the repo root on the other PC:

1. Pull the base models:
   - `ollama pull gpt-oss:20b`
   - `ollama pull qwen2.5-coder:1.5b-base`
   - `ollama pull qwen2.5:3b`
2. Build the custom models:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\setup-ollama-models.ps1`

This builds:

- `gpt-oss-20b-optimized:latest`
- `lorebound-pf2e:latest`
- `lorebound-pf2e-fast:latest`
- `lorebound-pf2e-ultra-fast:latest`
- `lorebound-pf2e-pure:latest`

## Which model to use

- Best quality:
  - `lorebound-pf2e:latest`
- Better speed/quality balance:
  - `lorebound-pf2e-fast:latest`
- Weak laptop / fastest fallback:
  - `lorebound-pf2e-ultra-fast:latest`

## First-run checklist on the other PC

1. Open `AI Settings`
2. Click `Test AI`
3. Pick your preferred model
4. Import campaign JSON
5. Reconnect your PDF folder
6. Run one quick PDF search
7. Ask Loremaster a short PF2e prompt to confirm it is responding

## If something fails

- App opens but AI fails:
  - confirm Ollama is running
  - click `Test AI`
- PDFs do not answer correctly:
  - re-index in `PDF Intel`
  - verify the correct folder path
- Large 20b model is too slow:
  - switch to `lorebound-pf2e-fast:latest`
  - or `lorebound-pf2e-ultra-fast:latest`

## Recommended long-term workflow

1. Use GitHub for source sync
2. Use `Export Campaign JSON` for campaign backup
3. Use repo model files + setup script for PF2e AI rebuild
4. Keep PDFs in a dedicated folder you can mirror between machines
