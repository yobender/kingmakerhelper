import { getActiveStoryPhase, isLiveCampaignRecord, recordMatchesActiveStoryPhase, shouldSurfaceRecordForFocus } from "./kingmakerFlow";

const ACTIVE_LOCATION_STATUSES = new Set(["active", "secured", "threatened", "unstable", "rumor"]);

export const LOCATION_SOURCE_ANCHORS = Object.freeze([
  {
    label: "Running Kingmaker",
    page: 7,
    source: "Adventure Path",
    note: "Location records should serve tonight's run: pressure, consequence, and what the players learn by going there.",
  },
  {
    label: "Chapter 1: A Call for Heroes",
    page: 16,
    source: "Adventure Path",
    note: "The opening campaign locations establish the charter, the first frontier hub, and the stakes of the Greenbelt.",
  },
  {
    label: "Hexploring the Stolen Lands",
    page: 45,
    source: "Adventure Path",
    note: "Hexes matter when locations answer map choices with discovery, danger, and concrete opportunity.",
  },
]);

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function matchesName(left, right) {
  return stringValue(left).toLowerCase() === stringValue(right).toLowerCase();
}

function statusRank(location) {
  const status = stringValue(location?.status).toLowerCase();
  if (status === "threatened") return 0;
  if (status === "unstable") return 1;
  if (status === "active") return 2;
  if (status === "secured") return 3;
  if (status === "rumor") return 4;
  if (status === "cleared") return 5;
  return 6;
}

function typeRank(location) {
  const type = stringValue(location?.type).toLowerCase();
  if (type === "settlement") return 0;
  if (type === "landmark") return 1;
  if (type === "ruin") return 2;
  if (type === "lair") return 3;
  if (type === "dungeon") return 4;
  if (type === "route") return 5;
  if (type === "camp") return 6;
  return 7;
}

function buildLocationSummary(entry) {
  return (
    stringValue(entry?.whatChanged)
    || stringValue(entry?.risks)
    || stringValue(entry?.opportunities)
    || stringValue(entry?.notes)
    || "No location read recorded yet."
  );
}

export function formatLocationValue(value) {
  return stringValue(value)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function buildLocationsModel(campaign) {
  const storyPhase = getActiveStoryPhase(campaign);
  const locations = [...(campaign?.locations || [])].sort((left, right) => {
    const statusDelta = statusRank(left) - statusRank(right);
    if (statusDelta !== 0) return statusDelta;
    const typeDelta = typeRank(left) - typeRank(right);
    if (typeDelta !== 0) return typeDelta;
    return stringValue(left?.name).localeCompare(stringValue(right?.name));
  });

  const activeLocations = locations.filter((entry) => isLiveCampaignRecord(entry) && ACTIVE_LOCATION_STATUSES.has(stringValue(entry?.status).toLowerCase()));
  const focusReferenceLocations = locations.filter((entry) => !isLiveCampaignRecord(entry) && recordMatchesActiveStoryPhase(entry, campaign));
  const visibleLocations = [...activeLocations, ...focusReferenceLocations].filter(
    (entry, index, list) => list.findIndex((candidate) => stringValue(candidate?.id) === stringValue(entry?.id)) === index
  );
  const focusedRecords = (records = []) => records.filter((entry) => shouldSurfaceRecordForFocus(entry, campaign));
  const threatenedLocations = activeLocations.filter(
    (entry) =>
      stringValue(entry?.status).toLowerCase() === "threatened"
      || stringValue(entry?.status).toLowerCase() === "unstable"
      || Boolean(stringValue(entry?.risks))
      || Boolean(stringValue(entry?.linkedEvent))
  );
  const mapBoundLocations = activeLocations.filter((entry) => Boolean(stringValue(entry?.hex)));
  const hubLocations = activeLocations.filter((entry) => stringValue(entry?.type).toLowerCase() === "settlement" || stringValue(entry?.type).toLowerCase() === "camp");
  const factionOptions = [...new Set(visibleLocations.map((entry) => stringValue(entry?.controllingFaction)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const questOptions = focusedRecords(campaign?.quests)
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const eventOptions = focusedRecords(campaign?.events)
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const npcOptions = focusedRecords(campaign?.npcs)
    .map((entry) => stringValue(entry?.name))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));

  return {
    locations: visibleLocations,
    allLocations: locations,
    storyPhase,
    activeLocations,
    focusReferenceLocations,
    threatenedLocations,
    mapBoundLocations,
    hubLocations,
    factionOptions,
    questOptions,
    eventOptions,
    npcOptions,
    sourceAnchors: [...LOCATION_SOURCE_ANCHORS],
    quests: focusedRecords(campaign?.quests),
    events: focusedRecords(campaign?.events),
    npcs: focusedRecords(campaign?.npcs),
    companions: focusedRecords(campaign?.companions),
    markers: [...(campaign?.hexMap?.markers || [])],
    regions: [...(campaign?.kingdom?.regions || [])],
    summaryCards: [
      {
        label: "Tracked Locations",
        value: `${activeLocations.length}`,
        helper: activeLocations[0]
          ? `${activeLocations[0].name} / ${buildLocationSummary(activeLocations[0])}`
          : `No live location records yet. ${focusReferenceLocations.length} ${storyPhase.shortLabel} reference location(s) are available.`,
        valueTone: "number",
      },
      {
        label: "Threatened Sites",
        value: `${threatenedLocations.length}`,
        helper: threatenedLocations[0] ? `${threatenedLocations[0].name} / ${stringValue(threatenedLocations[0].risks || threatenedLocations[0].whatChanged)}` : "No location is currently flagged as unstable or threatened.",
        valueTone: "number",
      },
      {
        label: "Mapped Hexes",
        value: `${mapBoundLocations.length}`,
        helper: mapBoundLocations[0] ? `${mapBoundLocations[0].name} / ${stringValue(mapBoundLocations[0].hex)}` : "No location currently points at a specific hex.",
        valueTone: "number",
      },
      {
        label: "Hubs",
        value: `${hubLocations.length}`,
        helper: hubLocations[0] ? `${hubLocations[0].name} / ${stringValue(hubLocations[0].type)}` : "No settlement or camp hub is recorded yet.",
        valueTone: "number",
      },
    ],
  };
}

export function collectLocationQuests(campaign, locationDraft) {
  const locationName = stringValue(locationDraft?.name);
  const hex = stringValue(locationDraft?.hex).toUpperCase();
  const linkedQuest = stringValue(locationDraft?.linkedQuest);
  return [...(campaign?.quests || [])].filter(
    (entry) =>
      shouldSurfaceRecordForFocus(entry, campaign) &&
      (stringValue(entry?.title) === linkedQuest
        || matchesName(entry?.giver, locationDraft?.linkedNpc)
        || (hex && stringValue(entry?.hex).toUpperCase() === hex)
        || stringValue(entry?.objective).toLowerCase().includes(locationName.toLowerCase()))
  );
}

export function collectLocationEvents(campaign, locationDraft) {
  const hex = stringValue(locationDraft?.hex).toUpperCase();
  const linkedEvent = stringValue(locationDraft?.linkedEvent);
  const locationName = stringValue(locationDraft?.name).toLowerCase();
  return [...(campaign?.events || [])].filter(
    (entry) =>
      shouldSurfaceRecordForFocus(entry, campaign) &&
      (stringValue(entry?.title) === linkedEvent
        || (hex && stringValue(entry?.hex).toUpperCase() === hex)
        || stringValue(entry?.trigger).toLowerCase().includes(locationName)
        || stringValue(entry?.fallout).toLowerCase().includes(locationName))
  );
}

export function collectLocationNpcs(campaign, locationDraft) {
  const linkedNpc = stringValue(locationDraft?.linkedNpc);
  const hex = stringValue(locationDraft?.hex).toUpperCase();
  const locationName = stringValue(locationDraft?.name);
  return [...(campaign?.npcs || [])].filter(
    (entry) =>
      shouldSurfaceRecordForFocus(entry, campaign) &&
      (matchesName(entry?.name, linkedNpc)
        || matchesName(entry?.location, locationName)
        || (hex && stringValue(entry?.hex).toUpperCase() === hex))
  );
}

export function collectLocationCompanions(campaign, locationDraft) {
  const hex = stringValue(locationDraft?.hex).toUpperCase();
  return [...(campaign?.companions || [])].filter((entry) => shouldSurfaceRecordForFocus(entry, campaign) && hex && stringValue(entry?.currentHex).toUpperCase() === hex);
}

export function collectLocationMarkers(campaign, locationDraft) {
  const hex = stringValue(locationDraft?.hex).toUpperCase();
  return [...(campaign?.hexMap?.markers || [])].filter((entry) => hex && stringValue(entry?.hex).toUpperCase() === hex);
}

export function collectLocationRegion(campaign, locationDraft) {
  const hex = stringValue(locationDraft?.hex).toUpperCase();
  return [...(campaign?.kingdom?.regions || [])].find((entry) => hex && stringValue(entry?.hex).toUpperCase() === hex) || null;
}
