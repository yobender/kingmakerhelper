# Kingmaker Companion Project Handoff

Last updated: 2026-04-24

This repo is the current Kingmaker GM helper app. The app is an Electron + React desktop workspace for running Pathfinder 2e Kingmaker with local campaign state, local source indexing, and a campaign-aware AI assistant.

## Repo

- Local folder on this machine: `D:\LoreBound\kingmaker-gm-studio`
- Git branch used today: `main`
- Primary remote: `origin https://github.com/yobender/kingmakerhelper.git`
- Secondary remote still configured: `dm-helper https://github.com/yobender/DM-Helper.git`

## Current Product Direction

The app should help a DM run Kingmaker chapter-by-chapter without flooding every page or AI answer with the whole AP.

Core rules:

- The DM activates the current AP chapter/phase.
- Reference material stays advisory until activated by the DM.
- Live campaign records are the source of truth.
- The AI should answer campaign/rules/prep questions from the current chapter context, not invent broad campaign state.
- Opening narration, Jamandi feast setup, and Oleg startup context should only appear when explicitly requested.

## Major Work Completed In This Pass

### 1. AI Routing And Prompt Assembly

The backend AI flow was refactored around explicit intent routing and smaller prompt payloads.

Implemented routing functions include:

- `detectIntent(userMessage, selectedPageMode, scopeTag)`
- `selectAnswerMode(intent, selectedPageMode)`
- `selectContextBuckets(intent, selectedPageMode, scopeTag)`
- `buildSystemPrompt(answerMode)`
- `buildContextBlock(contextBuckets)`
- `buildAiUserPrompt(userMessage, routeResult, contextBlock)`

Intent precedence now prioritizes:

1. `player_build`
2. `rules_question`
3. `gm_prep`
4. `world_lore`
5. `campaign_recall`
6. `create_or_update_content`
7. `session_start_or_opening`
8. `general_chat`

Important AI behavior:

- Ask mode defaults to normal advice.
- Prep mode defaults to GM prep.
- Recall mode defaults to campaign/session recall.
- Create mode is the only page mode that defaults to create/update behavior.
- Explicit create language can still route to create mode.
- Player build questions override Kingmaker/opening language.
- Opening notes are excluded unless the user explicitly asks for opening narration, first session, Jamandi feast intro, Oleg arrival, or read-aloud text.
- Debug route preview returns intent, answer mode, included buckets, excluded buckets, and reasons.

### 2. Local AP Source Manifest

The app now refreshes a source-safe AP manifest from local owned PDFs.

Command:

```powershell
npm run refresh:library
```

Current local PDF shelf:

```text
C:\Users\Chris Bender\Downloads\PathfinderKingmakerAdventurePathPDF-SingleFile
```

The manifest is stored in:

```text
kingmaker-source-manifest.json
```

The manifest contains source metadata, chapter titles, section titles, page starts, source hashes, source roles, and audience categories. It does not copy AP body text into the repo.

### 3. Kingmaker AP Flow Alignment

`src/renderer/lib/kingmakerFlow.js` was rebuilt around the actual PF2e Kingmaker AP chapter outline:

- Chapter 1: A Call for Heroes
- Chapter 2: Into the Wild
- Chapter 3: Stolen Lands
- Kingdom Founding app phase
- Chapter 4: Rivers Run Red
- Chapter 5: Cult of the Bloom
- Chapter 6: The Varnhold Vanishing
- Chapter 7: Blood for Blood
- Chapter 8: War of the River Kings
- Chapter 9: They Lurk Below
- Chapter 10: Sound of a Thousand Screams
- Chapter 11: Curse of the Lantern King

Each phase now has:

- label
- short label
- source page start
- summary
- DM brief
- run beats
- keep-handy tags
- focus terms for filtering reference records
- legacy IDs where older saved campaign state used outdated phase IDs

### 4. Reference Library Realignment

`src/renderer/lib/kingmakerCanonLibrary.js` was updated so embedded reference cards no longer use the older six-chapter structure.

Key corrections:

- Oleg, Stag Lord, Thorn River, and bandit stronghold material moved to Chapter 3: Stolen Lands.
- Old Sycamore, Sootscale, wilderness discoveries, and hexcrawl material moved to Chapter 2: Into the Wild.
- Troll Trouble moved to Chapter 4: Rivers Run Red.
- Cult of the Bloom received chapter-level quest/location anchors.
- Varnhold/Vordakai material moved to Chapter 6.
- Drelev/Armag material moved to Chapter 7.
- Pitax material moved to Chapter 8.
- They Lurk Below received chapter-level quest/location anchors.
- Nyrissa/House/Thousandbreaths material moved to Chapter 10.
- Lantern King material moved to Chapter 11.

### 5. Starter State Cleanup

`src/renderer/lib/campaignState.js` was changed so the old baked-in `Session 00 - Jamandi's Charter` no longer appears as a real logged session by default.

Reference records are now marked with:

- `recordSource: "kingmaker-reference"`
- `confirmed: false`

This matters because the app can now distinguish:

- reference/canon shelf material
- activated table truth
- actual user-created campaign state

The old starter session signatures are filtered on load so legacy starter data does not keep leaking into recall/AI.

### 6. Run Kingmaker Workspace

The Run Kingmaker page is now meant to be the DM's chapter control room.

Current behavior:

- The DM can select the active AP chapter from visible chapter cards.
- Selecting a chapter updates `meta.storyFocus.activePhaseId`.
- The page shows a chapter brief for the active chapter.
- The page shows DM run beats for that chapter.
- The page shows keep-handy tags for the chapter.
- The page shows local PDF source anchors from the source manifest.
- The page shows live campaign records.
- The page shows focused reference records that match the active chapter.
- Activating reference records promotes them into confirmed table state.

Latest fix:

- Chapter cards previously changed focus quietly, which looked like nothing happened.
- They now show a selected state, display a footer action, scroll to the chapter brief, and show a notification when clicked.

### 7. UI Redesign Direction

The app moved toward a more Kingmaker-specific visual language:

- darker frontier-green base
- brass/gold accents
- rounded/bubbly panels
- bigger chapter/home presentation
- consolidated top navigation categories
- less tab overload
- more distinct page identity

Important UI goal going forward:

- Each major page should feel like a different DM tool, not a clone of the same dashboard.
- The home page and Run Kingmaker page should feel like the core command table.
- Internal pages should be more focused and less crowded.

### 8. Text And Responsive Fixes

A global text-resilience pass was added in `src/renderer/styles.css`.

Goals:

- reduce clipping at different window sizes
- allow long AP titles and record titles to wrap safely
- make buttons, badges, cards, tables, and panels less likely to overflow

Known caveat:

- Some dense content pages still need page-by-page cleanup, especially where old layouts use many cards at once.

## Files Most Relevant To Recent Work

- `main.js`
- `preload.js`
- `src/shared/aiRouting.cjs`
- `tests/aiRouting.test.cjs`
- `src/renderer/pages/AIChatPage.jsx`
- `src/renderer/pages/RunKingmakerPage.jsx`
- `src/renderer/lib/runKingmaker.js`
- `src/renderer/lib/kingmakerFlow.js`
- `src/renderer/lib/kingmakerCanonLibrary.js`
- `src/renderer/lib/kingmakerEventLibrary.js`
- `src/renderer/lib/campaignState.js`
- `src/renderer/lib/knowledgeGraph.js`
- `src/renderer/lib/routes.js`
- `src/renderer/styles.css`
- `kingmaker-source-manifest.json`

## Build And Verification Commands

Use these after pulling on another machine:

```powershell
npm install
npm run build:renderer
npm test
node --check main.js
```

To refresh the source manifest after connecting local PDFs:

```powershell
npm run refresh:library
```

To run the desktop app:

```powershell
npm run start
```

To rebuild an unpacked Windows app:

```powershell
npx electron-builder --win dir --config.directories.output=dist-ui-refresh
```

## Current Verification Status

As of this handoff:

- `npm run build:renderer` passes.
- `npm test` passes.
- `node --check main.js` passes.
- `node --check src\renderer\lib\runKingmaker.js` passes.
- `node --check src\renderer\lib\kingmakerFlow.js` passes.

Note:

- `node --check` does not work directly on `.jsx` files in this repo because Node does not understand the `.jsx` extension without the build tool. Use `npm run build:renderer` for JSX validation.

## How To Continue At Home

1. Pull the latest branch:

```powershell
git pull origin main
```

2. Install dependencies if needed:

```powershell
npm install
```

3. Run verification:

```powershell
npm run build:renderer
npm test
node --check main.js
```

4. Run the app:

```powershell
npm run start
```

5. Reconnect local-only resources if needed:

- PDF folder
- Ollama endpoint/model
- Obsidian vault
- exported campaign state JSON

## Important Local Data Boundary

The repo stores source-safe metadata and app code.

The repo should not store:

- AP body text copied from PDFs
- private campaign saves unless intentionally exported
- local app cache
- generated unpacked app folders
- `dist-*` build artifacts

The current `.gitignore` ignores `dist-hotfix*` but not all `dist-*` folders. For this push, generated `dist-*` folders were intentionally left untracked.

## Known Follow-Ups

Recommended next work:

- Verify the Run Kingmaker chapter-card interaction in the actual Electron window after pulling.
- Add an obvious "Active Chapter" sticky mini-header so the selected chapter is visible even lower on the page.
- Add direct "Open PDF folder/source" behavior if we want source anchors to do more than open Source Library.
- Continue page-by-page UI cleanup for Campaign Desk, World Atlas, Kingdom Table, Council, and Tools.
- Make every clickable card use consistent hover/focus/pressed states.
- Add tests for story phase filtering so old chapter labels cannot regress.
- Add chapter-specific source cards for companion-guide material where relevant.
- Add an import/setup wizard for users to point the app at their local Kingmaker PDFs.

## Short Summary

The app is now much closer to a true Kingmaker DM runner:

- source manifest is local and chapter-aware
- story focus is chapter-aware
- reference records are separated from live campaign truth
- AI routing is narrower and safer
- Run Kingmaker is now the chapter control workspace
- the old baked Session 00 problem is filtered out
- UI direction is more Kingmaker-specific and less generic dashboard
