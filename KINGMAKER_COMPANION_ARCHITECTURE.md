# Kingmaker Companion Architecture

This document is the first-pass information architecture for turning `kingmaker-gm-studio` into a purpose-built standalone Kingmaker app.

It is based on the PDFs in:

- `C:\Users\Chris Bender\Downloads\PathfinderKingmakerAdventurePathPDF-SingleFile`

The companion assumptions in this document come from the actual book split:

- one main GM campaign book
- one companion/camping/weather supplement
- one player-safe guide
- one kingdom tracker pack
- one kingdom management quick-reference
- two map packs

## Core Design Decision

Do not treat Kingmaker as a generic campaign notebook.

The app should separate:

1. `Source canon`
2. `Campaign state`
3. `Player-safe handouts`
4. `GM-only prep`

That split matters because this PDF set already contains both spoiler-heavy GM material and explicitly player-safe material. If the app flattens everything into one search bucket, it becomes harder to trust and harder to share at the table.

## Recommended Product Shape

The standalone app should be a `campaign cockpit`, not just a document viewer.

Top-level layout:

1. `Command Center`
   - Latest session state
   - Current chapter / current objective
   - Kingdom turn pressure
   - Party location / travel status
   - Open companion beats
   - Quick links into the exact book sections needed tonight
2. `Adventure`
   - Campaign chapters and parts
   - Story milestones
   - Quest threads
   - Scene/encounter prep
   - GM-only chapter notes
3. `Atlas`
   - Stolen Lands hex layer
   - Settlements and landmarks
   - Map assets
   - Location state tracking
4. `Companions`
   - Companion roster
   - Influence notes
   - Personal quests
   - Camp dialogue prompts
   - Kingdom-role synergies
5. `Kingdom`
   - Kingdom sheet
   - Turn workflow
   - Settlements
   - Region records
   - Kingdom events
   - Warfare / armies
6. `Library`
   - Source browser
   - PDF search
   - Page-linked citations
   - Rule / appendix lookups
7. `Player Pack`
   - Player-safe guide material
   - Shareable regional maps
   - Backgrounds and kingdom primer
8. `Exports`
   - Session packet
   - Foundry/Obsidian handoff
   - Player handout export

## Why This Layout Fits The Books

### 1. The main campaign book is the spine

`Adventure Path.pdf` is not just lore. It contains:

- introduction and campaign assumptions
- chapter-by-chapter story flow
- hexploration structure
- appendices for kingdoms, warfare, treasure, NPCs, and monsters

That means the app needs a first-class `Adventure` module and cannot bury the campaign spine inside a generic PDF tab.

### 2. The Companion Guide is its own subsystem

`Companion Guide.pdf` contains:

- companion recruitment/use
- personal quests
- camping systems
- special meals
- weather

That is enough material to justify a dedicated `Companions` area instead of stuffing companions into the generic NPC list.

### 3. The Player's Guide is a permission boundary

`Players Guide.pdf` is the clean player-safe package.

It contains:

- character guidance
- spoiler-free kingdom rules
- spoiler-free warfare rules
- blank maps and sheets

This should become the basis of a `Player Pack` section and a future `share/export without spoilers` workflow.

### 4. The tracker pack defines the kingdom UI

`Kingdom Tracker.pdf` is effectively a paper prototype for the kingdom workflow:

- kingdom info
- settlements
- relations
- events
- buildings
- urban grid
- kingdom quick reference
- army quick reference

The digital kingdom experience should mirror that shape instead of improvising from scratch.

### 5. Maps are separate assets, not side notes

The map folio and interactive maps should feed:

- the hex atlas
- settlement views
- encounter map launches
- player-safe map exports

They are an asset library, not just more searchable text.

## Source Organization

The PDF library should be organized into four trust zones.

### GM Canon

- `Kingmaker Adventure Path`
- `Kingmaker Companion Guide`
- `Kingmaker Interactive Maps`

### Table Reference

- `Kingdom Tracker`
- `Kingdom Management Screen`

### Player-Safe Reference

- `Kingmaker Player's Guide`
- player-safe pieces of the map folio

### Mixed / Share Carefully

- `Kingmaker Map Folio`

## Normalized Data Model

The app should normalize PDF content into records instead of relying on raw PDF search for everything.

Recommended collections:

- `sources`
  - PDF metadata, audience, role, outline, page-linked sections
- `adventureChapters`
  - chapter, part, milestone, source page
- `storyThreads`
  - quest-like arcs derived from chapters, companion quests, and kingdom pressure
- `locations`
  - named places, settlement pages, dungeon nodes, source links
- `hexes`
  - hex id, terrain, discoveries, claimed status, source links
- `npcs`
  - recurring figures, faction ties, chapter appearances, kingdom roles
- `companions`
  - influence notes, meeting hooks, camp scenes, personal quest stages
- `kingdomRules`
  - quick references, turn steps, leadership roles, activities, settlement/building data
- `warfareRules`
  - army creation, tactics, conditions, actions
- `maps`
  - file/page references, map type, player-safe flag, linked location or encounter
- `playerResources`
  - backgrounds, kingdom primer, warfare primer, blank sheets, shareable maps

## Storage Split

Keep a hard separation between `canon` and `campaign progress`.

System-owned canon:

- source manifest
- normalized source records
- extracted chapter/section references

Campaign-owned progress:

- sessions
- discovered hexes
- chapter progress
- active story threads
- kingdom turns
- settlement build history
- companion influence/progress
- table rulings and local overrides

This prevents us from mixing editable campaign notes with reusable source truth.

## Ingestion Order

Do not ingest everything at once.

Phase 1:

- source manifest
- chapter / part navigator
- player-safe vs GM-only source partition
- better starter campaign defaults

Phase 2:

- normalize chapter milestones
- normalize named locations and recurring NPCs
- turn appendices into fast lookup collections

Phase 3:

- companion roster and personal-quest states
- map asset linking
- chapter-to-hex crosslinks

Phase 4:

- player handout export
- encounter packet generation
- spoiler-aware sharing

## Directory Recommendation

If we start storing normalized content on disk, keep it under a dedicated app-local knowledge tree:

```text
kingmaker-gm-studio/
  knowledge/
    kingmaker/
      sources/
        kingmaker-source-manifest.json
      adventure/
      companions/
      kingdom/
      warfare/
      maps/
      player-pack/
```

## Immediate Implementation Direction

The current app already has usable building blocks:

- sessions
- NPCs
- quests
- locations
- kingdom sheet
- hex map
- PDF indexing

The right near-term move is not a rewrite. It is to reshape the existing app around Kingmaker-specific defaults and then let the normalized source layer drive the next UI pass.

That means:

1. Rename and isolate the app as `Kingmaker Companion`.
2. Point the default PDF folder at the Kingmaker source bundle.
3. Keep the current world-state tooling.
4. Add a source manifest so every future feature can cite the books cleanly.
5. Build future tabs and entities from the source model above rather than adding more generic campaign utilities.
