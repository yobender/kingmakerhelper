const ACTIVE_NPC_STATUSES = new Set(["ally", "neutral", "watch", "rival", "hostile"]);
const PRESSURE_NPC_STATUSES = new Set(["watch", "rival", "hostile"]);
const KINGDOM_SIGNAL_FIELDS = ["kingdomRole", "kingdomNotes"];

export const NPC_SOURCE_ANCHORS = Object.freeze([
  {
    label: "Running Kingmaker",
    page: 7,
    source: "Adventure Path",
    note: "How to keep recurring figures active as pressure, support, and consequence delivery tools.",
  },
  {
    label: "Chapter 1: A Call for Heroes",
    page: 16,
    source: "Adventure Path",
    note: "The early campaign actor set: patrons, frontier locals, and the first pressure-facing NPCs.",
  },
  {
    label: "Appendix 5: NPC and Monsters",
    page: 591,
    source: "Adventure Path",
    note: "Encounter-facing NPC reference material and the reminder that major campaign actors need table-ready hooks.",
  },
]);

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function importanceRank(npc) {
  const importance = stringValue(npc?.importance).toLowerCase();
  if (importance === "pillar") return 0;
  if (importance === "major") return 1;
  if (importance === "supporting") return 2;
  return 3;
}

function statusRank(npc) {
  const status = stringValue(npc?.status).toLowerCase();
  if (status === "hostile") return 0;
  if (status === "rival") return 1;
  if (status === "watch") return 2;
  if (status === "neutral") return 3;
  if (status === "ally") return 4;
  if (status === "offstage") return 5;
  return 6;
}

function formatDisposition(value) {
  return stringValue(value)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function matchesNpcName(npc, targetName) {
  return stringValue(npc?.name).toLowerCase() === stringValue(targetName).toLowerCase();
}

function buildNpcSummary(entry) {
  return (
    stringValue(entry?.pressure)
    || stringValue(entry?.agenda)
    || stringValue(entry?.nextScene)
    || stringValue(entry?.notes)
    || "No active read recorded yet."
  );
}

export function buildNpcsModel(campaign) {
  const npcs = [...(campaign?.npcs || [])].sort((left, right) => {
    const statusDelta = statusRank(left) - statusRank(right);
    if (statusDelta !== 0) return statusDelta;
    const importanceDelta = importanceRank(left) - importanceRank(right);
    if (importanceDelta !== 0) return importanceDelta;
    const levelDelta = numberValue(right?.creatureLevel, 0) - numberValue(left?.creatureLevel, 0);
    if (levelDelta !== 0) return levelDelta;
    return stringValue(left?.name).localeCompare(stringValue(right?.name));
  });

  const activeNpcs = npcs.filter((entry) => ACTIVE_NPC_STATUSES.has(stringValue(entry?.status).toLowerCase()));
  const pressureRoster = npcs.filter(
    (entry) =>
      PRESSURE_NPC_STATUSES.has(stringValue(entry?.status).toLowerCase())
      || Boolean(stringValue(entry?.pressure))
      || Boolean(stringValue(entry?.linkedEvent))
  );
  const kingdomActors = npcs.filter((entry) => KINGDOM_SIGNAL_FIELDS.some((key) => Boolean(stringValue(entry?.[key]))));
  const frontierContacts = npcs.filter((entry) => Boolean(stringValue(entry?.location)) || Boolean(stringValue(entry?.hex)));
  const factionOptions = [...new Set(npcs.map((entry) => stringValue(entry?.faction)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const locationOptions = [...new Set([
    ...npcs.map((entry) => stringValue(entry?.location)),
    ...(campaign?.locations || []).map((entry) => stringValue(entry?.name)),
  ].filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const questOptions = [...(campaign?.quests || [])]
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const eventOptions = [...(campaign?.events || [])]
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));

  return {
    npcs,
    activeNpcs,
    pressureRoster,
    kingdomActors,
    frontierContacts,
    factionOptions,
    locationOptions,
    questOptions,
    eventOptions,
    sourceAnchors: [...NPC_SOURCE_ANCHORS],
    locations: [...(campaign?.locations || [])],
    events: [...(campaign?.events || [])],
    quests: [...(campaign?.quests || [])],
    summaryCards: [
      {
        label: "Tracked NPCs",
        value: `${npcs.length}`,
        helper: activeNpcs[0] ? `${activeNpcs[0].name} / ${stringValue(activeNpcs[0].role) || "No role"}` : "No active NPC records are being tracked yet.",
        valueTone: "number",
      },
      {
        label: "Pressure Nodes",
        value: `${pressureRoster.length}`,
        helper: pressureRoster[0] ? `${pressureRoster[0].name} / ${buildNpcSummary(pressureRoster[0])}` : "No pressure-facing NPC is queued right now.",
        valueTone: "number",
      },
      {
        label: "Kingdom Actors",
        value: `${kingdomActors.length}`,
        helper: kingdomActors[0] ? `${kingdomActors[0].name} / ${stringValue(kingdomActors[0].kingdomRole) || stringValue(kingdomActors[0].kingdomNotes)}` : "No NPC has explicit kingdom relevance recorded yet.",
        valueTone: "number",
      },
      {
        label: "Frontier Contacts",
        value: `${frontierContacts.length}`,
        helper: frontierContacts[0] ? `${frontierContacts[0].name} / ${stringValue(frontierContacts[0].location) || stringValue(frontierContacts[0].hex)}` : "No location-facing NPC contact is recorded yet.",
        valueTone: "number",
      },
    ],
  };
}

export function collectLinkedNpcQuests(campaign, npcDraft) {
  const npcName = stringValue(npcDraft?.name);
  const linkedQuestTitle = stringValue(npcDraft?.linkedQuest);
  return [...(campaign?.quests || [])].filter(
    (entry) =>
      stringValue(entry?.title) === linkedQuestTitle
      || matchesNpcName({ name: entry?.giver }, npcName)
      || stringValue(entry?.hex).toUpperCase() === stringValue(npcDraft?.hex).toUpperCase()
  );
}

export function collectLinkedNpcEvents(campaign, npcDraft) {
  const linkedEventTitle = stringValue(npcDraft?.linkedEvent);
  return [...(campaign?.events || [])].filter(
    (entry) =>
      stringValue(entry?.title) === linkedEventTitle
      || stringValue(entry?.hex).toUpperCase() === stringValue(npcDraft?.hex).toUpperCase()
  );
}

export function collectNpcLocations(campaign, npcDraft) {
  const location = stringValue(npcDraft?.location).toLowerCase();
  const hex = stringValue(npcDraft?.hex).toUpperCase();
  return [...(campaign?.locations || [])].filter((entry) => {
    const entryName = stringValue(entry?.name).toLowerCase();
    const entryHex = stringValue(entry?.hex).toUpperCase();
    return (location && entryName === location) || (hex && entryHex === hex);
  });
}

export function formatNpcStatus(value) {
  return formatDisposition(value);
}

export function formatNpcDisposition(value) {
  return formatDisposition(value);
}
