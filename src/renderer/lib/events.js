function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const IMPACT_KEYS = Object.freeze([
  "rpImpact",
  "unrestImpact",
  "renownImpact",
  "fameImpact",
  "infamyImpact",
  "foodImpact",
  "lumberImpact",
  "luxuriesImpact",
  "oreImpact",
  "stoneImpact",
  "corruptionImpact",
  "crimeImpact",
  "decayImpact",
  "strifeImpact",
]);

export const EVENT_SOURCE_ANCHORS = Object.freeze([
  {
    label: "Running Kingmaker",
    page: 7,
    source: "Adventure Path",
    note: "The GM-side cadence for surfacing pressure and choosing what matters next.",
  },
  {
    label: "Hexploring the Stolen Lands",
    page: 45,
    source: "Adventure Path",
    note: "The sandbox engine that generates travel trouble, discoveries, and visible consequences.",
  },
  {
    label: "Camping Activities",
    page: 110,
    source: "Companion Guide",
    note: "Camp-facing trouble, preparation, and overnight complications.",
  },
  {
    label: "Stolen Lands Weather",
    page: 122,
    source: "Companion Guide",
    note: "Weather as a daily pressure source, especially for travel and camp events.",
  },
  {
    label: "Events Sheet",
    page: 6,
    source: "Kingdom Tracker",
    note: "The table-facing reminder that events deserve their own tracking surface.",
  },
  {
    label: "Kingdom Quick Reference",
    page: 13,
    source: "Kingdom Tracker",
    note: "Monthly kingdom turns are where unresolved kingdom pressure should advance or hit.",
  },
]);

export function createEmptyEventImpactFields() {
  return {
    rpImpact: 0,
    unrestImpact: 0,
    renownImpact: 0,
    fameImpact: 0,
    infamyImpact: 0,
    foodImpact: 0,
    lumberImpact: 0,
    luxuriesImpact: 0,
    oreImpact: 0,
    stoneImpact: 0,
    corruptionImpact: 0,
    crimeImpact: 0,
    decayImpact: 0,
    strifeImpact: 0,
  };
}

export function buildEventImpactSnapshot(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const out = {};
  for (const key of IMPACT_KEYS) {
    out[key] = Math.trunc(numberValue(source[key], 0));
  }
  return out;
}

export function hasEventImpact(eventItem) {
  return Object.values(buildEventImpactSnapshot(eventItem)).some((value) => value !== 0);
}

export function getEventClockMax(eventItem) {
  return Math.max(1, Math.trunc(numberValue(eventItem?.clockMax, 4)));
}

export function getEventClockValue(eventItem) {
  return Math.max(0, Math.min(getEventClockMax(eventItem), Math.trunc(numberValue(eventItem?.clock, 0))));
}

export function getEventAdvancePerTurn(eventItem) {
  return Math.max(0, Math.trunc(numberValue(eventItem?.advancePerTurn, 1)));
}

export function getEventTurnsToConsequence(eventItem) {
  if (stringValue(eventItem?.advanceOn).toLowerCase() !== "turn") return null;
  const step = getEventAdvancePerTurn(eventItem);
  if (step <= 0) return null;
  const remaining = Math.max(0, getEventClockMax(eventItem) - getEventClockValue(eventItem));
  return Math.ceil(remaining / step);
}

export function formatEventClockSummary(eventItem) {
  return `${getEventClockValue(eventItem)}/${getEventClockMax(eventItem)}`;
}

function formatSignedValue(value) {
  const amount = Math.trunc(numberValue(value, 0));
  if (amount > 0) return `+${amount}`;
  return String(amount);
}

export function describeEventImpactSummary(eventItem) {
  const impact = buildEventImpactSnapshot(eventItem);
  const labels = {
    rpImpact: "RP",
    unrestImpact: "Unrest",
    renownImpact: "Renown",
    fameImpact: "Fame",
    infamyImpact: "Infamy",
    foodImpact: "Food",
    lumberImpact: "Lumber",
    luxuriesImpact: "Luxuries",
    oreImpact: "Ore",
    stoneImpact: "Stone",
    corruptionImpact: "Corruption",
    crimeImpact: "Crime",
    decayImpact: "Decay",
    strifeImpact: "Strife",
  };

  const parts = Object.entries(impact)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => `${labels[key] || key} ${formatSignedValue(value)}`);

  return parts.join(" / ");
}

export function shouldApplyEventImpact(eventItem, regions = []) {
  const scope = stringValue(eventItem?.impactScope).toLowerCase();
  if (scope === "always") return true;
  if (scope === "none") return false;
  if (scope !== "claimed-hex") return false;
  const targetHex = stringValue(eventItem?.hex).toUpperCase();
  if (!targetHex) return false;
  return regions.some((entry) => {
    if (stringValue(entry?.hex).toUpperCase() !== targetHex) return false;
    const status = stringValue(entry?.status).toLowerCase();
    return status === "claimed" || status === "work site" || status === "work-site" || status === "settlement";
  });
}

export function buildEventReferenceLine(eventItem) {
  const turnsToConsequence = getEventTurnsToConsequence(eventItem);
  return [
    stringValue(eventItem?.category),
    stringValue(eventItem?.status),
    `clock ${formatEventClockSummary(eventItem)}`,
    turnsToConsequence == null ? "" : `${turnsToConsequence} turn(s)`,
    stringValue(eventItem?.hex),
  ]
    .filter(Boolean)
    .join(" / ");
}

function priorityRank(eventItem) {
  const status = stringValue(eventItem?.status).toLowerCase();
  if (status === "escalated") return 0;
  if (status === "active") return 1;
  if (status === "seeded") return 2;
  if (status === "cooldown") return 3;
  if (status === "library") return 4;
  if (status === "resolved") return 5;
  if (status === "failed") return 6;
  return 7;
}

function categoryRank(eventItem) {
  const category = stringValue(eventItem?.category).toLowerCase();
  if (category === "kingdom") return 0;
  if (category === "threat") return 1;
  if (category === "travel") return 2;
  if (category === "quest") return 3;
  if (category === "companion") return 4;
  return 5;
}

export function buildEventsModel(campaign) {
  const events = [...(campaign?.events || [])].sort((left, right) => {
    const statusDelta = priorityRank(left) - priorityRank(right);
    if (statusDelta !== 0) return statusDelta;
    const urgencyDelta = Math.trunc(numberValue(right?.urgency, 0)) - Math.trunc(numberValue(left?.urgency, 0));
    if (urgencyDelta !== 0) return urgencyDelta;
    const turnDelta = (getEventTurnsToConsequence(left) ?? 99) - (getEventTurnsToConsequence(right) ?? 99);
    if (turnDelta !== 0) return turnDelta;
    const categoryDelta = categoryRank(left) - categoryRank(right);
    if (categoryDelta !== 0) return categoryDelta;
    return stringValue(left?.title).localeCompare(stringValue(right?.title));
  });

  const activeEvents = events.filter((entry) => {
    const status = stringValue(entry?.status).toLowerCase();
    return status === "seeded" || status === "active" || status === "escalated" || status === "cooldown";
  });
  const kingdomEvents = activeEvents.filter(
    (entry) => stringValue(entry?.category).toLowerCase() === "kingdom" || shouldApplyEventImpact(entry, campaign?.kingdom?.regions || [])
  );
  const partyEvents = activeEvents.filter((entry) => !kingdomEvents.includes(entry));
  const imminentEvents = activeEvents.filter((entry) => {
    const turns = getEventTurnsToConsequence(entry);
    return turns === 0 || turns === 1 || getEventClockValue(entry) >= getEventClockMax(entry) - 1 || Math.trunc(numberValue(entry?.urgency, 0)) >= 5;
  });
  const categories = [...new Set(events.map((entry) => stringValue(entry?.category)).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const folderOptions = [...new Set(events.map((entry) => stringValue(entry?.folder)).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const questOptions = [...(campaign?.quests || [])]
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const companionOptions = [...(campaign?.companions || [])]
    .map((entry) => stringValue(entry?.name))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const recentHistory = [...(campaign?.kingdom?.eventHistory || [])]
    .sort((left, right) => String(right?.at || "").localeCompare(String(left?.at || "")))
    .slice(0, 12);

  return {
    events,
    activeEvents,
    kingdomEvents,
    partyEvents,
    imminentEvents,
    recentHistory,
    categories,
    folderOptions,
    questOptions,
    companionOptions,
    summaryCards: [
      {
        label: "Active Fronts",
        value: `${activeEvents.length}`,
        helper: activeEvents[0] ? `${activeEvents[0].title} / ${buildEventReferenceLine(activeEvents[0])}` : "No active event fronts are recorded.",
        valueTone: "number",
      },
      {
        label: "Kingdom Pressure",
        value: `${kingdomEvents.length}`,
        helper: kingdomEvents[0] ? `${kingdomEvents[0].title} / ${stringValue(kingdomEvents[0].consequenceSummary || kingdomEvents[0].fallout)}` : "No kingdom-facing event clocks are currently live.",
        valueTone: "number",
      },
      {
        label: "Party Pressure",
        value: `${partyEvents.length}`,
        helper: partyEvents[0] ? `${partyEvents[0].title} / ${stringValue(partyEvents[0].trigger || partyEvents[0].notes)}` : "No travel, quest, or companion pressure is currently live.",
        valueTone: "number",
      },
      {
        label: "Due Soon",
        value: `${imminentEvents.length}`,
        helper: imminentEvents[0] ? `${imminentEvents[0].title} / ${buildEventReferenceLine(imminentEvents[0])}` : "Nothing is about to break this turn.",
        valueTone: "number",
      },
    ],
  };
}
