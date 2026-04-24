import { formatGolarionDate } from "./golarion";
import { isLiveCampaignRecord } from "./kingmakerFlow";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function clipText(value, limit = 180) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function liveRecords(records = []) {
  return (Array.isArray(records) ? records : []).filter(isLiveCampaignRecord);
}

function openLiveQuests(campaign) {
  return liveRecords(campaign?.quests).filter((entry) => !["completed", "failed"].includes(stringValue(entry?.status).toLowerCase()));
}

function activeLiveEvents(campaign) {
  return liveRecords(campaign?.events).filter((entry) => ["active", "escalated", "seeded", "cooldown"].includes(stringValue(entry?.status).toLowerCase()));
}

function foundryId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let index = 0; index < 16; index += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlBlock(title, body) {
  const text = stringValue(body);
  return `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(text || "None recorded.")}</p>`;
}

function htmlList(title, items) {
  const rows = (Array.isArray(items) ? items : []).map((entry) => stringValue(entry)).filter(Boolean);
  if (!rows.length) {
    return htmlBlock(title, "None recorded.");
  }
  return `<h2>${escapeHtml(title)}</h2><ul>${rows.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`;
}

function toFoundryActor(npc) {
  return {
    _id: foundryId(),
    name: stringValue(npc?.name) || "Unnamed NPC",
    type: "npc",
    img: "icons/svg/mystery-man.svg",
    system: {},
    prototypeToken: {},
    flags: {
      kingmakerCompanion: {
        source: "kingmaker-companion-standalone",
        exportType: "npc",
        exportDate: new Date().toISOString(),
        faction: stringValue(npc?.faction),
        role: stringValue(npc?.role),
        status: stringValue(npc?.status),
        disposition: stringValue(npc?.disposition),
        location: stringValue(npc?.location),
        hex: stringValue(npc?.hex),
        linkedQuest: stringValue(npc?.linkedQuest),
        linkedEvent: stringValue(npc?.linkedEvent),
      },
    },
    folder: null,
  };
}

function toFoundryJournal(name, type, sections, extraFlags = {}) {
  return {
    _id: foundryId(),
    name: stringValue(name) || "Untitled Entry",
    pages: [
      {
        _id: foundryId(),
        name: stringValue(name) || "Untitled Entry",
        type: "text",
        text: {
          content: sections.join(""),
          format: 1,
        },
      },
    ],
    flags: {
      kingmakerCompanion: {
        source: "kingmaker-companion-standalone",
        exportType: type,
        exportDate: new Date().toISOString(),
        ...extraFlags,
      },
    },
    folder: null,
  };
}

function toQuestJournal(entry) {
  return toFoundryJournal(
    entry?.title,
    "quest",
    [
      htmlBlock("Objective", entry?.objective),
      htmlBlock("Stakes", entry?.stakes),
      htmlBlock("Next Beat", entry?.nextBeat),
      htmlBlock("Blockers", entry?.blockers),
      htmlBlock("Reward", entry?.reward),
      htmlBlock("Notes", entry?.notes),
    ],
    {
      status: stringValue(entry?.status),
      priority: stringValue(entry?.priority),
      chapter: stringValue(entry?.chapter),
      hex: stringValue(entry?.hex),
      linkedEvent: stringValue(entry?.linkedEvent),
      linkedCompanion: stringValue(entry?.linkedCompanion),
    }
  );
}

function toLocationJournal(entry) {
  return toFoundryJournal(
    entry?.name,
    "location",
    [
      htmlBlock("Type", entry?.type),
      htmlBlock("Status", entry?.status),
      htmlBlock("What Changed", entry?.whatChanged),
      htmlBlock("Scene Texture", entry?.sceneTexture),
      htmlBlock("Opportunities", entry?.opportunities),
      htmlBlock("Risks", entry?.risks),
      htmlBlock("Rumor", entry?.rumor),
      htmlBlock("Notes", entry?.notes),
    ],
    {
      hex: stringValue(entry?.hex),
      controllingFaction: stringValue(entry?.controllingFaction),
      linkedQuest: stringValue(entry?.linkedQuest),
      linkedEvent: stringValue(entry?.linkedEvent),
      linkedNpc: stringValue(entry?.linkedNpc),
    }
  );
}

function toCompanionJournal(entry) {
  return toFoundryJournal(
    entry?.name,
    "companion",
    [
      htmlBlock("Recruitment", entry?.recruitment),
      htmlBlock("Influence Notes", entry?.influenceNotes),
      htmlBlock("Travel And Camp", `${stringValue(entry?.travelState)} / ${stringValue(entry?.campRole)}`),
      htmlBlock("Kingdom Fit", `${stringValue(entry?.kingdomRole)} / ${stringValue(entry?.kingdomNotes)}`),
      htmlBlock("Personal Quest", entry?.personalQuest),
      htmlBlock("Next Scene", entry?.nextScene),
      htmlBlock("Notes", entry?.notes),
    ],
    {
      status: stringValue(entry?.status),
      influence: Number(entry?.influence || 0),
      currentHex: stringValue(entry?.currentHex),
      questStage: stringValue(entry?.questStage),
      linkedQuest: stringValue(entry?.linkedQuest),
      linkedEvent: stringValue(entry?.linkedEvent),
    }
  );
}

function toEventJournal(entry) {
  return toFoundryJournal(
    entry?.title,
    "event",
    [
      htmlBlock("Trigger", entry?.trigger),
      htmlBlock("Fallout", entry?.fallout),
      htmlBlock("Consequence Summary", entry?.consequenceSummary),
      htmlBlock("Clock", `${Number(entry?.clock || 0)}/${Number(entry?.clockMax || 0)}`),
      htmlBlock("Notes", entry?.notes),
    ],
    {
      category: stringValue(entry?.category),
      status: stringValue(entry?.status),
      urgency: Number(entry?.urgency || 0),
      hex: stringValue(entry?.hex),
      linkedQuest: stringValue(entry?.linkedQuest),
      linkedCompanion: stringValue(entry?.linkedCompanion),
      advanceOn: stringValue(entry?.advanceOn),
    }
  );
}

function toKingdomJournal(kingdom) {
  const settlements = Array.isArray(kingdom?.settlements)
    ? kingdom.settlements.map((entry) => `${stringValue(entry?.name)} (${stringValue(entry?.status || "active")})`)
    : [];
  const leaders = Array.isArray(kingdom?.leaders)
    ? kingdom.leaders.map((entry) => `${stringValue(entry?.role)}: ${stringValue(entry?.name || "Unfilled")}`)
    : [];

  return toFoundryJournal(
    "Kingdom Snapshot",
    "kingdom",
    [
      htmlBlock("Current Date", formatGolarionDate(kingdom?.currentDate)),
      htmlBlock("Kingdom", `${stringValue(kingdom?.name)} / Level ${Number(kingdom?.level || 1)}`),
      htmlBlock("Resource Points", Number(kingdom?.resourcePoints || 0)),
      htmlBlock("Unrest", Number(kingdom?.unrest || 0)),
      htmlList("Leadership", leaders),
      htmlList("Settlements", settlements),
      htmlBlock("Recent Turn", stringValue(kingdom?.turns?.[0]?.summary)),
    ],
    {
      level: Number(kingdom?.level || 1),
      unrest: Number(kingdom?.unrest || 0),
      renown: Number(kingdom?.renown || 0),
      fame: Number(kingdom?.fame || 0),
      infamy: Number(kingdom?.infamy || 0),
    }
  );
}

function toHexMapJournal(hexMap) {
  const markers = Array.isArray(hexMap?.markers)
    ? hexMap.markers.slice(0, 24).map((entry) => `${stringValue(entry?.hex)} / ${stringValue(entry?.type)} / ${stringValue(entry?.title)}`)
    : [];
  const forces = Array.isArray(hexMap?.forces)
    ? hexMap.forces.slice(0, 18).map((entry) => `${stringValue(entry?.hex)} / ${stringValue(entry?.type)} / ${stringValue(entry?.name)}`)
    : [];

  return toFoundryJournal(
    "Hex Map Snapshot",
    "hex-map",
    [
      htmlBlock("Map Name", hexMap?.mapName),
      htmlBlock("Party Position", `${stringValue(hexMap?.party?.label || "Charter Party")} / ${stringValue(hexMap?.party?.hex) || "Not set"}`),
      htmlList("Markers", markers),
      htmlList("Forces", forces),
    ],
    {
      partyHex: stringValue(hexMap?.party?.hex),
      markerCount: markers.length,
      forceCount: forces.length,
    }
  );
}

function buildFoundryExports(campaign) {
  const npcs = liveRecords(campaign?.npcs);
  const quests = openLiveQuests(campaign);
  const locations = liveRecords(campaign?.locations);
  const companions = liveRecords(campaign?.companions);
  const events = activeLiveEvents(campaign);
  const kingdom = campaign?.kingdom || {};
  const hexMap = campaign?.hexMap || {};

  const npcActors = npcs.map(toFoundryActor);
  const questJournals = quests.map(toQuestJournal);
  const locationJournals = locations.map(toLocationJournal);
  const companionJournals = companions.map(toCompanionJournal);
  const eventJournals = events.map(toEventJournal);
  const kingdomJournal = [toKingdomJournal(kingdom)];
  const hexMapJournal = [toHexMapJournal(hexMap)];

  return {
    "npc-actors": {
      id: "npc-actors",
      label: "NPC Actors",
      description: "PF2e actor shells for tracked NPCs, with Kingmaker metadata in flags for later refinement inside Foundry.",
      count: npcActors.length,
      data: npcActors,
      fileName: "kingmaker-companion-npc-actors-foundry",
    },
    "quest-journals": {
      id: "quest-journals",
      label: "Quest Journals",
      description: "Quest objectives, stakes, blockers, next beats, and reward notes as Foundry journal entries.",
      count: questJournals.length,
      data: questJournals,
      fileName: "kingmaker-companion-quest-journals-foundry",
    },
    "location-journals": {
      id: "location-journals",
      label: "Location Journals",
      description: "Location state, rumor texture, opportunities, and risks exported as journals.",
      count: locationJournals.length,
      data: locationJournals,
      fileName: "kingmaker-companion-location-journals-foundry",
    },
    "companion-journals": {
      id: "companion-journals",
      label: "Companion Journals",
      description: "Influence, travel state, kingdom fit, and personal quest notes for the companion cast.",
      count: companionJournals.length,
      data: companionJournals,
      fileName: "kingmaker-companion-companion-journals-foundry",
    },
    "event-journals": {
      id: "event-journals",
      label: "Event Journals",
      description: "Pressure clocks, triggers, and fallout exported as Foundry journals for live GM reference.",
      count: eventJournals.length,
      data: eventJournals,
      fileName: "kingmaker-companion-event-journals-foundry",
    },
    "kingdom-snapshot": {
      id: "kingdom-snapshot",
      label: "Kingdom Snapshot",
      description: "A single journal entry with the current kingdom date, leaders, settlements, and latest turn state.",
      count: kingdomJournal.length,
      data: kingdomJournal,
      fileName: "kingmaker-companion-kingdom-snapshot-foundry",
    },
    "hex-map-snapshot": {
      id: "hex-map-snapshot",
      label: "Hex Map Snapshot",
      description: "Party position, markers, and force notes exported as a single Foundry journal.",
      count: hexMapJournal.length,
      data: hexMapJournal,
      fileName: "kingmaker-companion-hex-map-snapshot-foundry",
    },
    "full-pack": {
      id: "full-pack",
      label: "Full Foundry Pack",
      description: "One combined JSON export for confirmed live campaign actors plus journal-style table state.",
      count:
        npcActors.length +
        questJournals.length +
        locationJournals.length +
        companionJournals.length +
        eventJournals.length +
        kingdomJournal.length +
        hexMapJournal.length,
      data: [
        ...npcActors,
        ...questJournals,
        ...locationJournals,
        ...companionJournals,
        ...eventJournals,
        ...kingdomJournal,
        ...hexMapJournal,
      ],
      fileName: "kingmaker-companion-full-foundry-pack",
    },
  };
}

function buildBridgePack(campaign) {
  return {
    exportedAt: new Date().toISOString(),
    campaign: {
      name: stringValue(campaign?.meta?.campaignName) || "Kingmaker",
      currentDate: stringValue(campaign?.kingdom?.currentDate),
      currentDateLabel: formatGolarionDate(campaign?.kingdom?.currentDate),
    },
    latestSession: campaign?.sessions?.[0] || null,
    storyFocus: campaign?.meta?.storyFocus || {},
    openQuests: openLiveQuests(campaign),
    activeEvents: activeLiveEvents(campaign),
    activeCompanions: liveRecords(campaign?.companions).filter((entry) => !["departed"].includes(stringValue(entry?.status).toLowerCase())),
    kingdom: campaign?.kingdom || {},
    hexMap: {
      mapName: stringValue(campaign?.hexMap?.mapName),
      party: campaign?.hexMap?.party || {},
      markers: Array.isArray(campaign?.hexMap?.markers) ? campaign.hexMap.markers : [],
      forces: Array.isArray(campaign?.hexMap?.forces) ? campaign.hexMap.forces : [],
    },
  };
}

function buildLatestSessionHandoff(campaign) {
  const latestSession = campaign?.sessions?.[0] || null;
  return {
    exportedAt: new Date().toISOString(),
    latestSession,
    storyFocus: campaign?.meta?.storyFocus || {},
    openQuests: openLiveQuests(campaign),
    activeEvents: activeLiveEvents(campaign),
    highlightedNpcs: liveRecords(campaign?.npcs).slice(0, 8),
    highlightedLocations: liveRecords(campaign?.locations).slice(0, 8),
    kingdomDate: stringValue(campaign?.kingdom?.currentDate),
    kingdomDateLabel: formatGolarionDate(campaign?.kingdom?.currentDate),
  };
}

export function buildExportsLinksModel(campaign) {
  const foundryExports = buildFoundryExports(campaign);
  const activeEvents = activeLiveEvents(campaign);
  const openQuests = openLiveQuests(campaign);
  const latestSession = campaign?.sessions?.[0] || null;

  return {
    summaryCards: [
      {
        label: "Foundry Scope",
        value: `${Object.keys(foundryExports).length} packs`,
        helper: `${foundryExports["full-pack"].count} confirmed live records ready for Foundry JSON export.`,
        valueTone: "compact",
      },
      {
        label: "Bridge State",
        value: campaign?.meta?.obsidian?.vaultPath ? "Vault Linked" : "JSON Ready",
        helper: campaign?.meta?.obsidian?.vaultPath
          ? "Vault Sync is configured, so markdown export is available alongside JSON bridges."
          : "The app can still bridge cleanly through exported JSON even without Obsidian configured.",
        valueTone: "compact",
      },
      {
        label: "Latest Session",
        value: stringValue(latestSession?.title) || "No Session",
        helper: stringValue(latestSession?.nextPrep) || "No prep handoff recorded yet.",
        valueTone: "long",
      },
      {
        label: "Open Pressure",
        value: `${openQuests.length} Quests / ${activeEvents.length} Events`,
        helper: "These are the main live threads most external tools need in a bridge or handoff export.",
        valueTone: "compact",
      },
    ],
    foundryExports,
    bridgeExports: {
      "campaign-snapshot": {
        id: "campaign-snapshot",
        label: "Campaign Snapshot JSON",
        description: "Full standalone campaign state. Best export for backups or exact re-import into another Kingmaker Companion instance.",
        data: campaign,
        fileName: "kingmaker-companion-campaign-snapshot",
      },
      "bridge-pack": {
        id: "bridge-pack",
        label: "Bridge Pack JSON",
        description: "Trimmed cross-tool export for DM Helper or other external utilities: latest session, live quests, active events, kingdom, and map state.",
        data: buildBridgePack(campaign),
        fileName: "kingmaker-companion-bridge-pack",
      },
      "latest-session-handoff": {
        id: "latest-session-handoff",
        label: "Latest Session Handoff",
        description: "A lighter prep-focused export centered on the latest session, current pressure, and spotlight NPC/location context.",
        data: buildLatestSessionHandoff(campaign),
        fileName: "kingmaker-companion-latest-session-handoff",
      },
    },
    linkCards: [
      {
        id: "foundry",
        title: "Foundry",
        body: "Use the Foundry packs when you want actors and journals in a VTT-facing format. Import destination folders first, then spot-check one actor and one journal before session day.",
      },
      {
        id: "vault",
        title: "Vault Sync",
        body: "Use Vault Sync when the bridge needs readable markdown, indexed note context, or long-form campaign records that stay usable outside the app.",
      },
      {
        id: "dm-helper",
        title: "DM Helper",
        body: "Use the Bridge Pack or Latest Session Handoff when you want the standalone Kingmaker app to stay authoritative while another app consumes only current state and spotlight threads.",
      },
    ],
    importChecklist: [
      "Create Foundry destination folders before import so actors and journals land in the right place.",
      "Import one smaller pack first, then verify names, journal formatting, and any images or icons you intend to replace later.",
      "For cross-app links, prefer JSON bridge files or Vault Sync rather than sharing live runtime state between apps.",
      "After any major kingdom or hex-map update, export a fresh bridge file so external tools do not drift behind the authoritative campaign state.",
    ],
  };
}
