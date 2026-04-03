import { formatGolarionDate } from "./golarion";
import { getActiveEvents, getActiveQuests, getLatestSession, getTrackedCompanions } from "./selectors";

export const WRITING_MODE_OPTIONS = [
  { value: "assistant", label: "GM Assistant" },
  { value: "session", label: "Session Summary" },
  { value: "recap", label: "Read-Aloud Recap" },
  { value: "npc", label: "NPC Blurb" },
  { value: "quest", label: "Quest Objective" },
  { value: "location", label: "Location Description" },
  { value: "prep", label: "Next Session Prep" },
];

const WRITING_MODE_LABELS = Object.freeze(
  WRITING_MODE_OPTIONS.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {})
);

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function clipText(value, limit = 180) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function splitIdeaLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function sentenceCaseAndPunctuation(text) {
  const clean = stringValue(text).replace(/^[-*]\s*/, "");
  if (!clean) return "";
  const normalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function lowercaseFirst(text) {
  const clean = stringValue(text);
  if (!clean) return "";
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function uniqueItems(values) {
  const seen = new Set();
  const ordered = [];
  for (const value of values) {
    const clean = stringValue(value);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(clean);
  }
  return ordered;
}

function extractNamedValue(lines, label) {
  const matcher = new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, "i");
  for (const line of lines) {
    const match = stringValue(line).match(matcher);
    if (match) return stringValue(match[1]);
  }
  return "";
}

export function getWritingModeLabel(value) {
  return WRITING_MODE_LABELS[stringValue(value).toLowerCase()] || "Session Summary";
}

export function buildSceneForgeModel(state) {
  const latestSession = getLatestSession(state);
  const activeQuests = getActiveQuests(state).slice(0, 4);
  const activeEvents = getActiveEvents(state).slice(0, 4);
  const companions = getTrackedCompanions(state).slice(0, 4);
  const currentDate = state?.kingdom?.currentDate || "";

  return {
    latestSession,
    activeQuests,
    activeEvents,
    companions,
    currentDate,
    currentDateLabel: formatGolarionDate(currentDate, { fallback: "No kingdom date" }),
  };
}

export function cleanSceneForgeInput(text) {
  let output = String(text || "").replace(/\r\n?/g, "\n");
  output = output
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  const replacements = [
    ["\\bteh\\b", "the"],
    ["\\badn\\b", "and"],
    ["\\bthier\\b", "their"],
    ["\\brecieve\\b", "receive"],
    ["\\bseperate\\b", "separate"],
    ["\\boccured\\b", "occurred"],
    ["\\bdefinately\\b", "definitely"],
    ["\\bwierd\\b", "weird"],
    ["\\bcharachter\\b", "character"],
    ["\\bcharater\\b", "character"],
    ["\\bencouter\\b", "encounter"],
    ["\\bgoverment\\b", "government"],
    ["\\bwich\\b", "which"],
    ["\\bthru\\b", "through"],
    ["\\bcoudl\\b", "could"],
    ["\\bwoudl\\b", "would"],
    ["\\bidk\\b", "I don't know"],
    ["\\bnpcs\\b", "NPCs"],
    ["\\bpcs\\b", "PCs"],
  ];

  for (const [pattern, replacement] of replacements) {
    output = output.replace(new RegExp(pattern, "gi"), replacement);
  }

  return output;
}

function buildPrepOutput(model, lines) {
  const latestSession = model.latestSession;
  const mainQuest = model.activeQuests[0];
  const mainEvent = model.activeEvents[0];

  const items = uniqueItems([
    ...lines.map((line) => line.replace(/^[-*]\s*/, "")),
    latestSession?.travelObjective ? `Open on ${latestSession.travelObjective}` : "",
    latestSession?.pressure ? `Show the pressure clearly: ${latestSession.pressure}` : "",
    mainQuest?.nextBeat ? `Advance ${mainQuest.title}: ${mainQuest.nextBeat}` : "",
    mainEvent?.trigger ? `Push ${mainEvent.title}: ${mainEvent.trigger}` : "",
  ]);

  return items.slice(0, 6).map((item) => `- ${sentenceCaseAndPunctuation(item)}`).join("\n");
}

function buildRecapOutput(model, lines) {
  const latestSession = model.latestSession;
  const mainQuest = model.activeQuests[0];
  const mainEvent = model.activeEvents[0];
  const sentences = [
    lines[0]
      ? sentenceCaseAndPunctuation(`Last session, ${lowercaseFirst(lines[0])}`)
      : sentenceCaseAndPunctuation(
          `Last session, ${lowercaseFirst(latestSession?.summary || "the charter party pushed deeper into the Greenbelt")}`
        ),
    lines[1]
      ? sentenceCaseAndPunctuation(`They also ${lowercaseFirst(lines[1])}`)
      : mainEvent
        ? sentenceCaseAndPunctuation(`${mainEvent.title} continued building in the background`)
        : "",
    mainQuest?.nextBeat
      ? sentenceCaseAndPunctuation(`Now the next move is to ${lowercaseFirst(mainQuest.nextBeat)}`)
      : "Now the next frontier choice is in front of them.",
  ].filter(Boolean);

  return sentences.join(" ");
}

function buildAssistantOutput(model, lines) {
  const latestSession = model.latestSession;
  const mainQuest = model.activeQuests[0];
  const mainEvent = model.activeEvents[0];

  return [
    "GM Read:",
    sentenceCaseAndPunctuation(
      lines[0] ||
        `Keep ${mainQuest?.title || "the current frontier threat"} in the foreground and make ${
          mainEvent?.title || "the active pressure"
        } visible before the party can ignore it`
    ),
    "",
    "Use At The Table:",
    `1. ${sentenceCaseAndPunctuation(lines[1] || latestSession?.travelObjective || "Open on the party's current route and one immediate complication")}`,
    `2. ${sentenceCaseAndPunctuation(mainEvent?.trigger || latestSession?.pressure || "Advance one visible consequence if the table delays")}`,
    `3. ${sentenceCaseAndPunctuation(mainQuest?.nextBeat || "End on the next clear choice so the following session opens with momentum")}`,
  ].join("\n");
}

function buildSessionOutput(model, lines) {
  const latestSession = model.latestSession;
  const mainQuest = model.activeQuests[0];
  const mainEvent = model.activeEvents[0];
  const paragraphs = uniqueItems([
    ...lines.map((line) => sentenceCaseAndPunctuation(line)),
    mainQuest?.title ? sentenceCaseAndPunctuation(`The main unresolved thread remains ${mainQuest.title}`) : "",
    mainEvent?.consequenceSummary ? sentenceCaseAndPunctuation(mainEvent.consequenceSummary) : "",
  ]);

  if (paragraphs.length) {
    return paragraphs.slice(0, 4).join(" ");
  }

  return sentenceCaseAndPunctuation(
    latestSession?.summary || "The charter party made progress, revealed new pressure, and set up the next frontier decision"
  );
}

function buildNpcOutput(model, lines) {
  const mainQuest = model.activeQuests[0];
  const mainEvent = model.activeEvents[0];
  const name = extractNamedValue(lines, "name") || lines[0] || "Frontier Contact";
  const role = extractNamedValue(lines, "role") || lines[1] || "Local intermediary with a useful lead";

  return [
    `Name: ${name.replace(/^[-*]\s*/, "")}`,
    `Role: ${sentenceCaseAndPunctuation(role).replace(/[.]$/, "")}`,
    "Disposition: Guarded but practical",
    `Agenda: ${sentenceCaseAndPunctuation(lines[2] || `Protect their footing while ${mainQuest?.title || "the local situation"} keeps shifting`).replace(/[.]$/, "")}`,
    "Notes:",
    `- Core want: ${sentenceCaseAndPunctuation(lines[3] || "Stay useful without becoming the next person the frontier chews up")}`,
    `- Pressure: ${sentenceCaseAndPunctuation(mainEvent?.trigger || "A stronger faction is forcing them to choose a side too soon")}`,
    "- First impression: Travel-stained, watchful, and careful about what they say in front of strangers.",
    `- Best use next session: ${sentenceCaseAndPunctuation(lines[4] || "Point the party toward the next lead, then reveal the harder truth only after trust or leverage changes hands")}`,
  ].join("\n");
}

function buildQuestOutput(model, lines) {
  const latestSession = model.latestSession;
  const title = extractNamedValue(lines, "title") || lines[0] || "Frontier Trouble";

  return [
    `Title: ${title.replace(/^[-*]\s*/, "")}`,
    "Status: open",
    `Objective: ${sentenceCaseAndPunctuation(lines[1] || latestSession?.travelObjective || "Push the party toward the immediate threat with one obstacle and one consequence for delay").replace(/[.]$/, "")}`,
    `Giver: ${extractNamedValue(lines, "giver") || "A pressured local contact"}`,
    `Stakes: ${sentenceCaseAndPunctuation(lines[2] || model.activeEvents[0]?.consequenceSummary || "If ignored, the threat spreads and costs the party trust or safety").replace(/[.]$/, "")}`,
    `Next Beat: ${sentenceCaseAndPunctuation(lines[3] || model.activeQuests[0]?.nextBeat || "Make the cost of delay visible before the players commit").replace(/[.]$/, "")}`,
  ].join("\n");
}

function buildLocationOutput(model, lines) {
  const latestSession = model.latestSession;
  const name = extractNamedValue(lines, "name") || lines[0] || "Frontier Landmark";
  const focusHex = extractNamedValue(lines, "hex") || latestSession?.focusHex || model.activeEvents[0]?.hex || "D4";

  return [
    `Name: ${name.replace(/^[-*]\s*/, "")}`,
    `Hex: ${focusHex}`,
    `What Changed: ${sentenceCaseAndPunctuation(lines[1] || model.activeEvents[0]?.consequenceSummary || "The site is under fresh pressure and the local balance feels less stable").replace(/[.]$/, "")}`,
    `Description: ${sentenceCaseAndPunctuation(lines[2] || "Lead with one sensory detail, one immediate problem, and one clue pointing toward the next scene").replace(/[.]$/, "")}`,
    `Use In Play: ${sentenceCaseAndPunctuation(lines[3] || "Make the location answer one player question while introducing one new risk").replace(/[.]$/, "")}`,
  ].join("\n");
}

export function generateSceneForgeDraft({ campaign, mode, input }) {
  const normalizedMode = stringValue(mode).toLowerCase() || "session";
  const cleanInput = cleanSceneForgeInput(input);
  const lines = splitIdeaLines(cleanInput);
  const model = buildSceneForgeModel(campaign);

  if (normalizedMode === "prep") return buildPrepOutput(model, lines);
  if (normalizedMode === "recap") return buildRecapOutput(model, lines);
  if (normalizedMode === "assistant") return buildAssistantOutput(model, lines);
  if (normalizedMode === "npc") return buildNpcOutput(model, lines);
  if (normalizedMode === "quest") return buildQuestOutput(model, lines);
  if (normalizedMode === "location") return buildLocationOutput(model, lines);

  return buildSessionOutput(model, lines);
}

function formatQuestLine(quest) {
  const title = stringValue(quest?.title);
  const objective = clipText(quest?.objective, 150);
  const nextBeat = clipText(quest?.nextBeat, 140);
  return [title, objective, nextBeat ? `Next: ${nextBeat}` : ""].filter(Boolean).join(" | ");
}

function formatEventLine(eventItem) {
  const title = stringValue(eventItem?.title);
  const clock = `Clock ${Number(eventItem?.clock || 0)}/${Math.max(1, Number(eventItem?.clockMax || 1))}`;
  const trigger = clipText(eventItem?.trigger || eventItem?.consequenceSummary, 150);
  return [title, clock, trigger].filter(Boolean).join(" | ");
}

function formatCompanionLine(companion) {
  return [
    stringValue(companion?.name),
    companion?.currentHex ? `Hex ${companion.currentHex}` : "",
    companion?.kingdomRole || companion?.status || "",
    clipText(companion?.personalQuest || companion?.notes, 140),
  ]
    .filter(Boolean)
    .join(" | ");
}

export function buildSceneForgeAiContext(campaign, mode) {
  const model = buildSceneForgeModel(campaign);
  const latestSession = model.latestSession;

  return {
    activeTab: "writing",
    taskType: mode === "assistant" ? "general_prep" : "writing_cleanup",
    taskLabel: getWritingModeLabel(mode),
    tabContext: [
      `Current date: ${model.currentDateLabel}.`,
      latestSession
        ? `Latest session: ${latestSession.title} on ${formatGolarionDate(latestSession.date)}.`
        : "No session is logged yet.",
      latestSession?.focusHex ? `Focus hex: ${latestSession.focusHex}.` : "",
      latestSession?.leadCompanion ? `Lead companion: ${latestSession.leadCompanion}.` : "",
      latestSession?.pressure ? `Pressure: ${clipText(latestSession.pressure, 200)}.` : "",
      latestSession?.nextPrep ? `Prep handoff: ${clipText(latestSession.nextPrep, 220)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    latestSession: latestSession
      ? {
          title: latestSession.title,
          date: latestSession.date,
          summary: latestSession.summary,
          nextPrep: latestSession.nextPrep,
          focusHex: latestSession.focusHex,
          leadCompanion: latestSession.leadCompanion,
          pressure: latestSession.pressure,
          travelObjective: latestSession.travelObjective,
        }
      : null,
    activeQuests: model.activeQuests.map((quest) => formatQuestLine(quest)),
    activeEvents: model.activeEvents.map((eventItem) => formatEventLine(eventItem)),
    trackedCompanions: model.companions.map((companion) => formatCompanionLine(companion)),
    selectedPdfFile: "",
  };
}
