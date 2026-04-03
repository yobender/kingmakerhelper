const ACTIVE_QUEST_STATUSES = new Set(["open", "in-progress", "watch"]);
const QUEST_PRIORITY_RANK = Object.freeze({ now: 0, soon: 1, later: 2, someday: 3 });

export const QUEST_SOURCE_ANCHORS = Object.freeze([
  {
    label: "Running Kingmaker",
    page: 7,
    source: "Adventure Path",
    note: "How the campaign cadence turns visible pressure into concrete next moves and quest momentum.",
  },
  {
    label: "Chapter 1: A Call for Heroes",
    page: 16,
    source: "Adventure Path",
    note: "The opening charter, first mission structure, and what early Greenbelt objectives are meant to teach.",
  },
  {
    label: "Hexploring the Stolen Lands",
    page: 45,
    source: "Adventure Path",
    note: "The exploration engine that keeps frontier quests tied to map progress, rumors, and visible consequences.",
  },
  {
    label: "Using Companions",
    page: 6,
    source: "Companion Guide",
    note: "Companion beats and personal arcs should intersect with the main quest stack instead of living off to the side.",
  },
]);

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function matchesName(left, right) {
  return stringValue(left).toLowerCase() === stringValue(right).toLowerCase();
}

function priorityRank(quest) {
  return QUEST_PRIORITY_RANK[stringValue(quest?.priority).toLowerCase()] ?? 99;
}

function statusRank(quest) {
  const status = stringValue(quest?.status).toLowerCase();
  if (status === "open") return 0;
  if (status === "in-progress") return 1;
  if (status === "watch") return 2;
  if (status === "blocked") return 3;
  if (status === "completed") return 4;
  if (status === "failed") return 5;
  return 6;
}

function buildQuestSummary(entry) {
  return (
    stringValue(entry?.nextBeat)
    || stringValue(entry?.objective)
    || stringValue(entry?.stakes)
    || stringValue(entry?.notes)
    || "No next beat recorded yet."
  );
}

export function buildQuestsModel(campaign) {
  const quests = [...(campaign?.quests || [])].sort((left, right) => {
    const statusDelta = statusRank(left) - statusRank(right);
    if (statusDelta !== 0) return statusDelta;
    const priorityDelta = priorityRank(left) - priorityRank(right);
    if (priorityDelta !== 0) return priorityDelta;
    return stringValue(left?.title).localeCompare(stringValue(right?.title));
  });

  const activeQuests = quests.filter((entry) => ACTIVE_QUEST_STATUSES.has(stringValue(entry?.status).toLowerCase()));
  const urgentQuests = quests.filter(
    (entry) =>
      stringValue(entry?.priority).toLowerCase() === "now"
      || stringValue(entry?.status).toLowerCase() === "in-progress"
  );
  const linkedEventQuests = quests.filter((entry) => Boolean(stringValue(entry?.linkedEvent)));
  const frontierQuests = quests.filter((entry) => Boolean(stringValue(entry?.hex)));
  const chapterOptions = [...new Set(quests.map((entry) => stringValue(entry?.chapter)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const giverOptions = [...new Set([
    ...quests.map((entry) => stringValue(entry?.giver)),
    ...(campaign?.npcs || []).map((entry) => stringValue(entry?.name)),
  ].filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const companionOptions = [...(campaign?.companions || [])]
    .map((entry) => stringValue(entry?.name))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const eventOptions = [...(campaign?.events || [])]
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));

  return {
    quests,
    activeQuests,
    urgentQuests,
    linkedEventQuests,
    frontierQuests,
    chapterOptions,
    giverOptions,
    companionOptions,
    eventOptions,
    sourceAnchors: [...QUEST_SOURCE_ANCHORS],
    companions: [...(campaign?.companions || [])],
    events: [...(campaign?.events || [])],
    npcs: [...(campaign?.npcs || [])],
    locations: [...(campaign?.locations || [])],
    summaryCards: [
      {
        label: "Tracked Quests",
        value: `${quests.length}`,
        helper: activeQuests[0] ? `${activeQuests[0].title} / ${buildQuestSummary(activeQuests[0])}` : "No active quest is currently tracked.",
        valueTone: "number",
      },
      {
        label: "Priority Now",
        value: `${urgentQuests.length}`,
        helper: urgentQuests[0] ? `${urgentQuests[0].title} / ${stringValue(urgentQuests[0].priority)}` : "Nothing is marked as urgent right now.",
        valueTone: "number",
      },
      {
        label: "Event-Linked",
        value: `${linkedEventQuests.length}`,
        helper: linkedEventQuests[0] ? `${linkedEventQuests[0].title} / ${stringValue(linkedEventQuests[0].linkedEvent)}` : "No quest is explicitly tied to an event front yet.",
        valueTone: "number",
      },
      {
        label: "Frontier Hexes",
        value: `${frontierQuests.length}`,
        helper: frontierQuests[0] ? `${frontierQuests[0].title} / ${stringValue(frontierQuests[0].hex)}` : "No quest currently points to a specific hex.",
        valueTone: "number",
      },
    ],
  };
}

export function collectLinkedQuestEvents(campaign, questDraft) {
  const questTitle = stringValue(questDraft?.title);
  const linkedEventTitle = stringValue(questDraft?.linkedEvent);
  const questHex = stringValue(questDraft?.hex).toUpperCase();
  return [...(campaign?.events || [])].filter(
    (entry) =>
      stringValue(entry?.title) === linkedEventTitle
      || stringValue(entry?.linkedQuest) === questTitle
      || (questHex && stringValue(entry?.hex).toUpperCase() === questHex)
  );
}

export function collectLinkedQuestCompanions(campaign, questDraft) {
  const linkedCompanion = stringValue(questDraft?.linkedCompanion);
  const questTitle = stringValue(questDraft?.title);
  return [...(campaign?.companions || [])].filter(
    (entry) =>
      matchesName(entry?.name, linkedCompanion)
      || stringValue(entry?.linkedQuest) === questTitle
  );
}

export function collectLinkedQuestNpcs(campaign, questDraft) {
  const giver = stringValue(questDraft?.giver);
  const questHex = stringValue(questDraft?.hex).toUpperCase();
  return [...(campaign?.npcs || [])].filter(
    (entry) =>
      matchesName(entry?.name, giver)
      || stringValue(entry?.linkedQuest) === stringValue(questDraft?.title)
      || (questHex && stringValue(entry?.hex).toUpperCase() === questHex)
  );
}

export function collectQuestLocations(campaign, questDraft) {
  const questHex = stringValue(questDraft?.hex).toUpperCase();
  return [...(campaign?.locations || [])].filter((entry) => questHex && stringValue(entry?.hex).toUpperCase() === questHex);
}
