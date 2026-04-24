# Kingmaker Companion AI Review Handoff

## What this app is

Kingmaker Companion is a standalone Electron + React desktop app for running the PF2e Kingmaker Adventure Path.

The rebuilt workspace is organized into these route groups:

- Campaign
  - `/campaign/command-center`
  - `/campaign/adventure-log`
  - `/campaign/table-notes`
  - `/campaign/scene-forge`
- World
  - `/world/kingdom`
  - `/world/hex-map`
  - `/world/companions`
  - `/world/events`
  - `/world/npcs`
  - `/world/quests`
  - `/world/locations`
- Reference
  - `/reference/rules`
  - `/reference/ai-chat`
  - `/reference/source-library`
  - `/reference/ai-rag`
- Links
  - `/links/vault-sync`
  - `/links/exports`
- System
  - `/system/settings`

Route definitions live in `src/renderer/lib/routes.js`.

## Current shell and layout

The app shell is intentionally Obsidian-inspired and currently has these layers:

1. Header bar
   - File: `src/renderer/components/ShellHeader.jsx`
   - Shows campaign name, current page, date, save status, desktop badge, command palette button, and sidebar toggle.
2. Left navigation zone
   - Files: `src/renderer/components/ObsidianRibbon.jsx`, `src/renderer/components/AppSidebar.jsx`
   - Supports sidebar modes: explorer, pinned, recent, workspace.
   - Sidebar is resizable and collapsible.
3. Workspace strip
   - File: `src/renderer/components/WorkspaceStrip.jsx`
   - Handles tabs, breadcrumbs, split toggle, pin, and command palette shortcut.
4. Optional split-pane workspace
   - File: `src/renderer/components/WorkspacePane.jsx`
   - Left and right panes with focus state, swap, close split, and per-pane command palette.
5. Page-level content
   - Each page is now presented more like a working note than a dashboard full of unrelated cards.

Shell orchestration lives in `src/renderer/App.jsx`.

## Layout review

### What is working

- The app now has a coherent standalone shell instead of feeling attached to the DM helper.
- Sidebar resizing and collapse are implemented.
- Split view exists and is conceptually in the right direction.
- Command Center has been moved closer to a note/workbench layout instead of a decorative dashboard.
- Ask AI is now a first-class reference page instead of a hidden helper.

### Layout problems still present

1. There are still too many navigation layers competing at once.
   - Header title
   - Ribbon/sidebar mode buttons
   - Folder-style sidebar navigation
   - Workspace tabs
   - Breadcrumbs
   - Page-local quick links inside pages
   - Result: the app can still feel busy even when the visual chrome is darker and flatter.

2. The Ask AI page is trying to do too many jobs on one screen.
   - File: `src/renderer/pages/AIChatPage.jsx`
   - It combines:
     - chat
     - AI actions
     - create/update recipes
     - scope education
     - access explanation
     - metadata strip
   - Result: the user has to interpret the page instead of just asking something.

3. Command Center still reads as dense in places.
   - File: `src/renderer/pages/CommandCenterPage.jsx`
   - The note layout is better, but the main note and right rail can still feel compact and text-heavy.
   - The page has page-local quick links even though the shell already provides navigation.

4. The shell is closer to Obsidian visually than behaviorally.
   - The structure is there.
   - The interaction model still needs simplification.
   - The app should feel like:
     - one place to open pages
     - one place to switch tabs
     - one place to ask AI
   - Right now, those responsibilities overlap.

## AI system overview

The local AI flow currently combines:

- app records
- AI memory
- indexed PDFs / RAG
- rules matches
- optional Obsidian vault context
- a knowledge graph route layer
- prompt templates that try to shape the output by task type

Core files:

- `src/renderer/pages/AIChatPage.jsx`
- `src/renderer/lib/knowledgeGraph.js`
- `main.js`

## Current AI problems

### Severity 1

#### 1. Intent routing is too hard-set

The AI is overfitting to campaign-start logic.

Observed failure:

- User asks for class advice.
- The model answers with Jamandi Aldori, charter ceremony, mansion opening, or Oleg’s Trading Post setup.

Why this happens:

- `isCampaignOpeningQuestion()` in `src/renderer/lib/knowledgeGraph.js` is broad.
- `isCampaignOpeningRequest()` in `main.js` is broad.
- `buildAiChatContext()` in `src/renderer/pages/AIChatPage.jsx` computes campaign-opening state before or alongside player-build state.
- `buildAiUserPrompt()` in `main.js` injects a hard campaign opening override.

Relevant code:

- `src/renderer/lib/knowledgeGraph.js:180`
- `src/renderer/lib/knowledgeGraph.js:208`
- `src/renderer/pages/AIChatPage.jsx:996`
- `src/renderer/pages/AIChatPage.jsx:1003`
- `src/renderer/pages/AIChatPage.jsx:1005`
- `main.js:3866`
- `main.js:3919`
- `main.js:3999`
- `main.js:4791`

Practical effect:

- A normal conversational question gets interpreted as a hard workflow route.
- The app is answering the router, not the user.

#### 2. The prompt payload is too opinionated and too large

`buildAiUserPrompt()` in `main.js` is doing too much.

It currently injects:

- mode guide
- persona
- app role
- workflow role
- task class
- save target
- route reason
- tab context
- knowledge graph prompt block
- latest session
- tracked quest, NPC, companion, event, location, kingdom summaries
- AI memory summaries
- retrieval summaries
- PDF snippets
- rules matches
- vault notes
- behavioral rules

Result:

- The model often latches onto the strongest scaffold instead of the actual user message.
- Replies become template-driven.
- Follow-up questions get pulled back into the previous larger framework.

Relevant code:

- `main.js:3866`
- `main.js:3970`
- `main.js:3980`
- `main.js:3999`
- `main.js:4005`

#### 3. Player-build questions are not winning routing priority

There is a player-build route, but it is not reliably dominant.

Observed failures:

- “What class should I play?” becomes Kingmaker opening advice.
- “What about an int based caster?” repeats the previous generic answer or ignores the follow-up.

Why this happens:

- Opening detection and build detection can both fire.
- Follow-up memory exists, but the higher-level prompt still drags the answer back to the old route.
- Fallback order in `generateAssistantFallbackAnswer()` still checks opening before build.

Relevant code:

- `src/renderer/lib/knowledgeGraph.js:198`
- `src/renderer/lib/knowledgeGraph.js:210`
- `src/renderer/pages/AIChatPage.jsx:962`
- `src/renderer/pages/AIChatPage.jsx:1003`
- `src/renderer/pages/AIChatPage.jsx:1005`
- `main.js:4823`
- `main.js:5144`
- `main.js:5179`
- `main.js:5183`
- `main.js:5325`

### Severity 2

#### 4. The AI is still too “format first”

The user wants an assistant with personality and judgment.

Current output still often feels like:

- a canned answer block
- a prep worksheet
- a rigid template

What the user wants instead:

- a table helper
- clear opinions
- short direct advice by default
- expanded structure only when they ask for prep, scenes, or record work

#### 5. Ask AI mixes “conversation” and “record editing” too closely

The page supports:

- Answer Only
- create draft
- update draft
- summary generation
- table note generation

This is good functionally, but the screen does not separate those modes strongly enough.

Relevant code:

- `src/renderer/pages/AIChatPage.jsx:1990`
- `src/renderer/pages/AIChatPage.jsx:2080`
- `src/renderer/pages/AIChatPage.jsx:2143`

### Severity 3

#### 6. The app records are useful, but can become “loud”

The AI is sometimes over-reading saved campaign state and under-reading the actual AP order.

Observed failure:

- It keeps drifting toward Oleg’s Trading Post because live app records are strong and recent.
- Early AP content like the Jamandi opening or mansion/manor intro can get overshadowed.

This is not only a prompt problem.

It is a retrieval-weighting problem:

- live records
- opening guard
- knowledge graph route
- PDF retrieval

need clearer precedence rules.

## Latest known RAG state

Based on the last verified UI state:

- 9 PDFs indexed
- 5634 chunks
- 5634 embedded
- hybrid retrieval enabled

This means the raw index coverage is no longer the main bottleneck.

The current bottleneck is answer routing and prompt control.

## What another AI should help redesign

### Goal

Redesign the Companion AI prompt stack so it behaves like a practical GM assistant, not a hard-routed workflow bot.

### Desired behavior

1. Answer the exact question first.
2. Keep answers short by default.
3. Only expand into prep structure when the user explicitly asks for prep, scenes, opening flow, or session planning.
4. Give opinions and recommendations, not just neutral summaries.
5. Use app records, PDFs, rules, and graph data as support, not as the answer’s personality.
6. Treat follow-up questions as continuations of the current topic.
7. For class/build questions, do not inject campaign opening guidance.
8. For campaign-opening questions, do not let later saved records override the AP opening order.

## Recommended intent hierarchy

This should be the routing priority, from strongest to weakest:

1. Explicit create/update action chosen in the UI
2. Explicit scope tag like `@rules`, `@pdf`, `@kingdom`
3. Direct conversational intent from the message
   - class/build advice
   - rules question
   - lore question
   - campaign prep question
   - record update request
4. Follow-up intent from recent conversation
5. Broad fallback routes

Important rule:

- A player-build question should override campaign-opening detection.
- A follow-up question should inherit the previous topic unless the new question clearly changes scope.

## Recommended answer modes

The assistant should behave differently based on the user’s intent.

### Mode A: conversational advice

Use when the user asks normal questions.

Examples:

- what class should I play
- what should I prep next
- is wizard a good fit
- how dangerous is this hex

Default answer shape:

- one short “my read”
- one short explanation
- one short alternatives or next-step block if useful

Do not include:

- At the table
- record updates
- opening scene template
- campaign workflow

unless the user asked for those.

### Mode B: prep guidance

Use when the user asks:

- how should I start
- what should I prep for session 1
- help me run the opening
- what should happen at the table

This is the only mode that should use sections like:

- opening scene
- immediate pressure
- what to prep next

### Mode C: structured create/update

Use only when:

- the user selects a create/update action
- the system is generating a reviewable patch

This should stay separate from normal conversation.

## Recommended personality brief

Use a light persona, not a roleplay gimmick.

Suggested target:

"You are Kingmaker Companion, a practical PF2e Kingmaker GM aide. You answer like a sharp table assistant: clear opinion first, short explanation second, source-aware when it matters, and only as structured as the question requires."

What it should feel like:

- confident
- conversational
- helpful
- slightly opinionated
- not chatty
- not robotic
- not a bullet-point machine unless the question calls for it

## Recommended prompt changes

### Remove or reduce

- large always-on tab context dumps
- always-on tracked record summaries
- always-on “save target” framing for Answer Only
- automatic “At the table” sections
- automatic “record update” sections
- hard opening override unless the message clearly asks about starting Kingmaker

### Keep

- scope tags
- knowledge graph route
- PDF / rules / vault access
- create/update draft flow
- source-aware fallback behavior

### Reframe

Instead of:

- “Campaign opening override”
- “Player build advice override”

Use:

- “Primary user intent”
- “Only answer this intent unless the user asks to expand”

## Layout recommendations

### Shell

Keep:

- sidebar resize/collapse
- workspace tabs
- split view

Reduce:

- page-local quick-link bars inside content pages
- duplicate navigation hints when the shell already provides that affordance

### Ask AI page

Recommended redesign:

1. Left/main column
   - chat
   - input
   - current scope chip
2. Right rail
   - mode switch
     - Ask
     - Create
     - Update
   - optional source visibility
   - optional access summary

The current page is functional but cognitively dense.

### Command Center

Keep the note/workbench direction.

Improve:

- slightly more whitespace
- slightly shorter right-rail items
- fewer decorative section labels
- fewer quick links inside the page body

## Concrete examples of current bad behavior

### Example 1

User asks:

"i think im going to be starting a new game what would be some classes you think would be good for this ap. as of right now we have a fighter and a healer"

Bad answer:

- starts talking about Jamandi Aldori
- campaign opening
- charter scene
- prep tasks

What it should do instead:

- answer with party composition advice
- recommend 2 to 4 classes
- explain why they fit Kingmaker and that party

### Example 2

User asks:

"what about an int based caster?"

Bad answer:

- repeats prior template
- ignores follow-up intent

What it should do instead:

- recognize this is a follow-up to class advice
- answer Wizard, Witch, Magus, Psychic, or Investigator depending question framing
- compare them briefly

### Example 3

User asks:

"what should I prep next?"

Current problem:

- answer may over-index to saved app records or a repeated Oleg setup

What it should do instead:

- answer from current campaign state if the campaign is already underway
- answer from AP opening only if the campaign is actually at the start

## Files another AI should inspect first

- `main.js`
- `src/renderer/pages/AIChatPage.jsx`
- `src/renderer/lib/knowledgeGraph.js`
- `src/renderer/App.jsx`
- `src/renderer/components/AppSidebar.jsx`
- `src/renderer/components/WorkspaceStrip.jsx`
- `src/renderer/components/WorkspacePane.jsx`
- `src/renderer/pages/CommandCenterPage.jsx`

## Bottom line

The app is no longer blocked by missing structure.

The shell is in decent shape.
The routes are in place.
The AI data access is broad enough.
The RAG coverage is broadly sufficient.

The main problem now is this:

The AI is being over-directed by routing and prompt scaffolding, so it keeps answering the workflow instead of the actual question.

That is the next thing to fix.

## Copy/Paste Brief For Another AI

Use this as the starting prompt:

---

I am working on a standalone Electron + React desktop app called Kingmaker Companion for running the PF2e Kingmaker Adventure Path.

The app already has:

- a rebuilt Obsidian-style shell
- route groups for Campaign, World, Reference, Links, and System
- an Ask AI page
- local Ollama integration
- PDF RAG
- knowledge graph routing
- create/update AI drafts for quests, events, NPCs, locations, companions, summaries, and table notes

The current problem is not raw data access. The current problem is prompt/routing behavior.

The AI is too hard-set on workflow rules and keeps misrouting normal conversational questions.

Examples of bad behavior:

- If the user asks for class advice for a new Kingmaker game, the AI answers with Jamandi Aldori, charter ceremony, mansion opening, or Oleg’s Trading Post prep instead of class recommendations.
- If the user asks a follow-up like “what about an int based caster?”, the AI often ignores the follow-up and repeats the previous answer template.
- The AI often does too much per reply and adds sections like “At the table,” “What to prep next,” or “Record update” even when the user only asked a normal question.

What I want instead:

- The AI should answer the exact question first.
- It should be conversational, useful, and slightly opinionated.
- It should feel like a sharp GM assistant, not a workflow bot.
- It should keep answers short by default.
- It should only switch into prep structure when the user explicitly asks for prep, opening scene advice, session planning, or record updates.
- Player-build questions must override campaign-opening routing.
- Follow-up questions must continue the previous topic unless the user clearly changes topics.
- Campaign-opening guidance should only appear when the user is actually asking how to start Kingmaker.

Please help me redesign:

1. intent routing hierarchy
2. the system/developer prompt strategy
3. answer modes for conversational advice vs prep guidance vs create/update drafts
4. a lighter AI personality brief
5. guardrails that stop over-formatting without making the assistant dumb

The key constraint is:

Do not solve this by adding more hard-coded templates. I need a prompt and routing design that is more flexible, not more rigid.

---
