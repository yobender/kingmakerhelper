import { useMemo, useState } from "react";
import { Badge, Button, Checkbox, Grid, Group, Paper, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import CompactMetaStrip from "../components/CompactMetaStrip";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import {
  CAPTURE_KIND_OPTIONS,
  COMPANION_QUEST_STAGE_OPTIONS,
  COMPANION_SPOTLIGHT_OPTIONS,
  COMPANION_STATUS_OPTIONS,
  COMPANION_TRAVEL_STATE_OPTIONS,
  DEFAULT_AI_CONFIG,
  EVENT_ADVANCE_OPTIONS,
  EVENT_CATEGORY_OPTIONS,
  EVENT_IMPACT_SCOPE_OPTIONS,
  EVENT_STATUS_OPTIONS,
  LOCATION_STATUS_OPTIONS,
  LOCATION_TYPE_OPTIONS,
  NPC_DISPOSITION_OPTIONS,
  NPC_IMPORTANCE_OPTIONS,
  NPC_STATUS_OPTIONS,
  QUEST_PRIORITY_OPTIONS,
  QUEST_STATUS_OPTIONS,
} from "../lib/campaignState";
import { formatGolarionDate } from "../lib/golarion";
import {
  buildKnowledgeGraph,
  buildKnowledgeGraphPromptBlock,
  detectAskIntent,
  isPlayerBuildQuestion,
  resolveAiRoute,
  selectAnswerMode,
  selectContextBuckets,
} from "../lib/knowledgeGraph";
import { buildKingdomModel } from "../lib/kingdom";
import { getActiveStoryPhase, shouldSurfaceRecordForFocus } from "../lib/kingmakerFlow";
import { getActiveEvents, getActiveQuests, getLatestSession, getTrackedCompanions } from "../lib/selectors";

const SCOPE_OPTIONS = Object.freeze([
  {
    id: "app",
    tag: "@app",
    label: "Whole App",
    activeTab: "dashboard",
    taskType: "general_prep",
    description: "Campaign records, PDFs, rules, and vault context when enabled.",
  },
  {
    id: "graph",
    tag: "@graph",
    label: "Knowledge Graph",
    activeTab: "graph",
    taskType: "graph_question",
    description: "Deterministic NPC, quest, location, source, and PDF bucket routing.",
  },
  {
    id: "campaign",
    tag: "@campaign",
    label: "Campaign",
    activeTab: "dashboard",
    taskType: "campaign_question",
    description: "Sessions, quests, events, NPCs, locations, and companions.",
  },
  {
    id: "kingdom",
    tag: "@kingdom",
    label: "Kingdom",
    activeTab: "kingdom",
    taskType: "kingdom_question",
    description: "Kingdom sheet, calendar, turns, leaders, settlements, and regions.",
  },
  {
    id: "pdf",
    tag: "@pdf",
    label: "PDF Sources",
    activeTab: "pdf",
    taskType: "source_question",
    description: "Indexed Kingmaker PDFs through local RAG retrieval.",
  },
  {
    id: "rules",
    tag: "@rules",
    label: "Rules",
    activeTab: "rules",
    taskType: "rules_question",
    description: "AON lookup plus manual rulings and canon memory.",
  },
  {
    id: "vault",
    tag: "@vault",
    label: "Vault",
    activeTab: "obsidian",
    taskType: "vault_question",
    description: "Obsidian markdown notes when Vault Sync is configured.",
  },
]);

const SCOPE_ALIASES = Object.freeze({
  ai: "app",
  app: "app",
  graph: "graph",
  kg: "graph",
  knowledge: "graph",
  campaign: "campaign",
  kingdom: "kingdom",
  ap: "graph",
  adventure: "graph",
  lore: "graph",
  map: "graph",
  maps: "graph",
  pdf: "pdf",
  source: "pdf",
  sources: "pdf",
  rules: "rules",
  rule: "rules",
  aon: "rules",
  vault: "vault",
  obsidian: "vault",
});

const TOOL_OPTIONS = Object.freeze([
  {
    id: "answer",
    label: "Answer Only",
    mode: "assistant",
    resultType: "answer",
    description: "Ask a direct question without creating a record.",
  },
  {
    id: "summary",
    label: "Summarize Notes",
    mode: "session",
    resultType: "summary",
    description: "Turn rough notes into a clean table note with prep actions.",
  },
  {
    id: "quest",
    label: "Create Quest",
    mode: "quest",
    resultType: "quest",
    description: "Draft a new objective, stakes, and next beat.",
  },
  {
    id: "update-quest",
    label: "Update Quest",
    mode: "prep",
    resultType: "update-quest",
    description: "Patch an existing quest after review.",
  },
  {
    id: "event",
    label: "Create Event",
    mode: "event",
    resultType: "event",
    description: "Draft a new pressure clock or kingdom/party event.",
  },
  {
    id: "update-event",
    label: "Update Event",
    mode: "prep",
    resultType: "update-event",
    description: "Patch an existing event clock or consequence.",
  },
  {
    id: "npc",
    label: "Create NPC",
    mode: "npc",
    resultType: "npc",
    description: "Draft a new NPC record with agenda, leverage, and next scene.",
  },
  {
    id: "update-npc",
    label: "Update NPC",
    mode: "prep",
    resultType: "update-npc",
    description: "Patch an existing NPC after review.",
  },
  {
    id: "location",
    label: "Create Location",
    mode: "location",
    resultType: "location",
    description: "Draft a new landmark, settlement, lair, route, or wilderness site.",
  },
  {
    id: "update-location",
    label: "Update Location",
    mode: "prep",
    resultType: "update-location",
    description: "Patch an existing location after review.",
  },
  {
    id: "update-companion",
    label: "Update Companion",
    mode: "prep",
    resultType: "update-companion",
    description: "Patch an existing companion after review.",
  },
  {
    id: "table-note",
    label: "Write Table Note",
    mode: "prep",
    resultType: "table-note",
    description: "Turn the prompt into a saved Table Notes entry.",
  },
]);

const INTENT_LABELS = Object.freeze({
  player_build: "Player Build",
  rules_question: "Rules",
  gm_prep: "GM Prep",
  world_lore: "Lore",
  campaign_recall: "Recall",
  create_or_update_content: "Create / Update",
  session_start_or_opening: "Opening",
  general_chat: "General",
});

const ANSWER_MODE_LABELS = Object.freeze({
  advice: "Advice",
  rules: "Rules",
  prep: "Prep",
  recall: "Recall",
  create: "Create",
  narration: "Narration",
});

const AI_WORKSPACE_MODES = Object.freeze([
  {
    id: "ask",
    label: "Ask",
    kicker: "Direct Advice",
    description: "Use for class help, rules questions, recommendations, and general Pathfinder guidance.",
    defaultScopeId: "app",
    starterPrompt: "@app What class fits our party?",
    helper: "Direct question mode. Best for advice, rules, and quick answers without drafting records.",
    examples: [
      "@app What class fits our party?",
      "@rules How do kingdom turns work?",
      "@graph Tell me about Jamandi Aldori.",
    ],
  },
  {
    id: "prep",
    label: "Prep",
    kicker: "GM Prep",
    description: "Use for session planning, hooks, pacing, encounter framing, and what to prep next.",
    defaultScopeId: "campaign",
    starterPrompt: "@campaign What should I prep next?",
    helper: "Prep mode biases ambiguous prompts toward practical session guidance instead of lore or narration.",
    examples: [
      "@campaign What should I prep next?",
      "@campaign Give me three hooks for the next session.",
      "@kingdom How should I run the next kingdom turn at the table?",
    ],
  },
  {
    id: "recall",
    label: "Recall",
    kicker: "Campaign Recall",
    description: "Use for recaps, current status, unresolved threads, and stored campaign state.",
    defaultScopeId: "campaign",
    starterPrompt: "@campaign What happened last session?",
    helper: "Recall mode favors stored campaign notes and avoids inventing missing events.",
    examples: [
      "@campaign What happened last session?",
      "@campaign Where are we right now?",
      "@kingdom What is our current kingdom status?",
    ],
  },
  {
    id: "create",
    label: "Create",
    kicker: "Reviewable Drafts",
    description: "Use for NPCs, quests, events, locations, summaries, and patch drafts that you review before saving.",
    defaultScopeId: "campaign",
    starterPrompt: "@campaign Create an NPC tied to the current bandit pressure.",
    helper: "Create mode exposes draft tools and reviewable patches. Nothing saves until you apply the draft.",
    examples: [
      "@campaign Create an NPC tied to the current bandit pressure.",
      "@campaign Update an existing quest. Target: Secure Oleg's Trading Post.",
      "@campaign Write this as a saved table note for next session prep:",
    ],
  },
]);

const DEFAULT_WORKSPACE_MODE = AI_WORKSPACE_MODES[0];

const NON_CREATE_TOOL_IDS = Object.freeze(["answer"]);
const DEFAULT_CREATE_TOOL_ID = "summary";

const TOOL_RECIPES = Object.freeze([
  {
    toolId: "npc",
    scopeId: "campaign",
    title: "NPC",
    prompt: "@campaign Create an NPC tied to the current bandit pressure. Give them a motive, leverage, secret, rumor, and next scene.",
  },
  {
    toolId: "update-npc",
    scopeId: "campaign",
    title: "Update NPC",
    prompt: "@campaign Update an existing NPC. Target: Oleg Leveton. Change pressure and nextScene based on the current bandit threat.",
  },
  {
    toolId: "quest",
    scopeId: "campaign",
    title: "Quest",
    prompt: "@campaign Create a quest that points the party toward securing Oleg's Trading Post and gives a clear next beat.",
  },
  {
    toolId: "update-quest",
    scopeId: "campaign",
    title: "Update Quest",
    prompt: "@campaign Update an existing quest. Target: Secure Oleg's Trading Post. Set status, nextBeat, and notes for the current table state.",
  },
  {
    toolId: "event",
    scopeId: "campaign",
    title: "Event",
    prompt: "@campaign Create an event clock for bandit pressure escalating if the party delays.",
  },
  {
    toolId: "update-event",
    scopeId: "campaign",
    title: "Update Event",
    prompt: "@campaign Update an existing event. Target: First Bandit Collection Run. Advance the pressure and adjust fallout if the party delays.",
  },
  {
    toolId: "location",
    scopeId: "campaign",
    title: "Location",
    prompt: "@campaign Create a frontier location the party can discover near the current route, with risks and opportunities.",
  },
  {
    toolId: "update-location",
    scopeId: "campaign",
    title: "Update Location",
    prompt: "@campaign Update an existing location. Target: Oleg's Trading Post. Add a danger, opportunity, and current scene texture.",
  },
  {
    toolId: "summary",
    scopeId: "campaign",
    title: "Summary",
    prompt: "@campaign Summarize these rough notes into a clean table note with key facts, action items, and next prep:",
  },
  {
    toolId: "table-note",
    scopeId: "campaign",
    title: "Table Note",
    prompt: "@campaign Write this as a saved table note for next session prep:",
  },
]);

const UPDATE_TARGET_CONFIGS = Object.freeze({
  "update-npc": {
    recordType: "npc",
    label: "NPC",
    collectionKey: "npcs",
    labelField: "name",
    path: "/world/npcs",
    upsertAction: "upsertNpc",
    fields: [
      "name",
      "role",
      "faction",
      "status",
      "disposition",
      "importance",
      "creatureLevel",
      "location",
      "hex",
      "agenda",
      "leverage",
      "pressure",
      "firstImpression",
      "rumor",
      "secret",
      "nextScene",
      "linkedQuest",
      "linkedEvent",
      "kingdomRole",
      "kingdomNotes",
      "notes",
      "folder",
    ],
    numericFields: ["creatureLevel"],
    hexFields: ["hex"],
    choiceFields: {
      status: NPC_STATUS_OPTIONS,
      disposition: NPC_DISPOSITION_OPTIONS,
      importance: NPC_IMPORTANCE_OPTIONS,
    },
    candidateFields: ["role", "faction", "status", "location", "linkedQuest", "pressure", "nextScene"],
  },
  "update-quest": {
    recordType: "quest",
    label: "Quest",
    collectionKey: "quests",
    labelField: "title",
    path: "/world/quests",
    upsertAction: "upsertQuest",
    fields: [
      "title",
      "status",
      "objective",
      "giver",
      "folder",
      "stakes",
      "priority",
      "chapter",
      "hex",
      "linkedCompanion",
      "linkedEvent",
      "nextBeat",
      "blockers",
      "reward",
      "notes",
    ],
    hexFields: ["hex"],
    choiceFields: {
      status: QUEST_STATUS_OPTIONS,
      priority: QUEST_PRIORITY_OPTIONS,
    },
    candidateFields: ["status", "priority", "chapter", "giver", "hex", "objective", "nextBeat"],
  },
  "update-event": {
    recordType: "event",
    label: "Event",
    collectionKey: "events",
    labelField: "title",
    path: "/world/events",
    upsertAction: "upsertEvent",
    fields: [
      "title",
      "folder",
      "category",
      "status",
      "urgency",
      "hex",
      "linkedQuest",
      "linkedCompanion",
      "clock",
      "clockMax",
      "advancePerTurn",
      "advanceOn",
      "impactScope",
      "trigger",
      "fallout",
      "consequenceSummary",
      "notes",
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
    ],
    numericFields: [
      "urgency",
      "clock",
      "clockMax",
      "advancePerTurn",
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
    ],
    hexFields: ["hex"],
    choiceFields: {
      category: EVENT_CATEGORY_OPTIONS,
      status: EVENT_STATUS_OPTIONS,
      advanceOn: EVENT_ADVANCE_OPTIONS,
      impactScope: EVENT_IMPACT_SCOPE_OPTIONS,
    },
    candidateFields: ["category", "status", "urgency", "hex", "linkedQuest", "clock", "clockMax", "trigger"],
  },
  "update-location": {
    recordType: "location",
    label: "Location",
    collectionKey: "locations",
    labelField: "name",
    path: "/world/locations",
    upsertAction: "upsertLocation",
    fields: [
      "name",
      "type",
      "status",
      "hex",
      "controllingFaction",
      "linkedQuest",
      "linkedEvent",
      "linkedNpc",
      "folder",
      "whatChanged",
      "sceneTexture",
      "opportunities",
      "risks",
      "rumor",
      "notes",
    ],
    hexFields: ["hex"],
    choiceFields: {
      type: LOCATION_TYPE_OPTIONS,
      status: LOCATION_STATUS_OPTIONS,
    },
    candidateFields: ["type", "status", "hex", "controllingFaction", "linkedQuest", "whatChanged", "risks"],
  },
  "update-companion": {
    recordType: "companion",
    label: "Companion",
    collectionKey: "companions",
    labelField: "name",
    path: "/world/companions",
    upsertAction: "upsertCompanion",
    fields: [
      "name",
      "status",
      "influence",
      "currentHex",
      "recruitment",
      "influenceNotes",
      "relationshipHooks",
      "friction",
      "travelState",
      "campRole",
      "campNotes",
      "kingdomRole",
      "kingdomNotes",
      "personalQuest",
      "questStage",
      "questTrigger",
      "nextScene",
      "linkedQuest",
      "linkedEvent",
      "spotlight",
      "notes",
      "folder",
    ],
    numericFields: ["influence"],
    hexFields: ["currentHex"],
    choiceFields: {
      status: COMPANION_STATUS_OPTIONS,
      travelState: COMPANION_TRAVEL_STATE_OPTIONS,
      questStage: COMPANION_QUEST_STAGE_OPTIONS,
      spotlight: COMPANION_SPOTLIGHT_OPTIONS,
    },
    candidateFields: ["status", "travelState", "kingdomRole", "personalQuest", "questStage", "nextScene"],
  },
});

const TOOL_SCHEMAS = Object.freeze({
  summary: {
    title: "Short summary title",
    summary: "Clean 1-3 paragraph summary",
    keyFacts: ["Fact to preserve"],
    actionItems: ["Prep or follow-up item"],
    unresolvedQuestions: ["Open question"],
    nextPrep: "Recommended next prep handoff",
  },
  quest: {
    title: "Quest title",
    status: "open",
    priority: "Soon",
    chapter: "Chapter or arc",
    folder: "AI Drafts",
    giver: "Quest giver if known",
    hex: "Optional hex like D4",
    linkedCompanion: "",
    linkedEvent: "",
    objective: "What the party must do",
    stakes: "What changes if ignored or failed",
    nextBeat: "The next actionable scene or clue",
    blockers: "Known blockers or unknowns",
    reward: "Reward or reason to care",
    notes: "GM-facing notes grounded in PF2e Kingmaker context",
  },
  event: {
    title: "Event title",
    folder: "AI Drafts",
    category: "story",
    status: "seeded",
    urgency: 3,
    hex: "Optional hex like D4",
    linkedQuest: "",
    linkedCompanion: "",
    clock: 0,
    clockMax: 4,
    advancePerTurn: 1,
    advanceOn: "manual",
    impactScope: "none",
    trigger: "What makes the event visible",
    fallout: "What changes after it fires",
    consequenceSummary: "Short consequence summary",
    notes: "GM-facing notes",
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
  },
  npc: {
    name: "NPC name",
    role: "Campaign role",
    faction: "Faction if known",
    status: "neutral",
    disposition: "indifferent",
    importance: "supporting",
    creatureLevel: 0,
    folder: "AI Drafts",
    location: "",
    hex: "",
    firstImpression: "What the party notices first",
    agenda: "What this NPC wants",
    leverage: "What gives them power",
    pressure: "What is pushing them now",
    rumor: "Useful rumor or table hook",
    secret: "Hidden truth or complication",
    nextScene: "How to use them next",
    linkedQuest: "",
    linkedEvent: "",
    kingdomRole: "",
    kingdomNotes: "",
    notes: "GM-facing notes",
  },
  location: {
    name: "Location name",
    type: "landmark",
    status: "active",
    hex: "Optional hex like D4",
    controllingFaction: "",
    linkedQuest: "",
    linkedEvent: "",
    linkedNpc: "",
    folder: "AI Drafts",
    whatChanged: "Current state or recent change",
    sceneTexture: "Sensory details and table texture",
    opportunities: "What the party can gain or learn",
    risks: "Dangers, costs, or complications",
    rumor: "Rumor that points here",
    notes: "GM-facing notes",
  },
  "table-note": {
    kind: "Note",
    note: "Clean table note text",
  },
  "update-npc": {
    targetId: "Use the existing NPC id if known from candidates",
    targetName: "Exact existing NPC name",
    confidence: "high",
    reason: "Why this record and these fields should change",
    patch: {
      pressure: "Only include fields that should change",
      nextScene: "Example update field",
      notes: "Optional appended or replacement note text",
    },
  },
  "update-quest": {
    targetId: "Use the existing quest id if known from candidates",
    targetName: "Exact existing quest title",
    confidence: "high",
    reason: "Why this record and these fields should change",
    patch: {
      status: "in-progress",
      nextBeat: "Example update field",
      notes: "Optional appended or replacement note text",
    },
  },
  "update-event": {
    targetId: "Use the existing event id if known from candidates",
    targetName: "Exact existing event title",
    confidence: "high",
    reason: "Why this record and these fields should change",
    patch: {
      clock: 1,
      status: "active",
      fallout: "Example update field",
    },
  },
  "update-location": {
    targetId: "Use the existing location id if known from candidates",
    targetName: "Exact existing location name",
    confidence: "high",
    reason: "Why this record and these fields should change",
    patch: {
      whatChanged: "Example update field",
      risks: "Example update field",
      notes: "Optional appended or replacement note text",
    },
  },
  "update-companion": {
    targetId: "Use the existing companion id if known from candidates",
    targetName: "Exact existing companion name",
    confidence: "high",
    reason: "Why this record and these fields should change",
    patch: {
      influence: 1,
      travelState: "with-party",
      nextScene: "Example update field",
    },
  },
});

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function clipText(value, limit = 900) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function normalizeRouteDebug(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const included = Array.isArray(value.included)
    ? value.included
    : Array.isArray(value.includedBuckets)
      ? value.includedBuckets
      : [];
  const excluded = Array.isArray(value.excluded)
    ? value.excluded
    : Array.isArray(value.excludedBuckets)
      ? value.excludedBuckets
      : [];
  const reasons = Array.isArray(value.reasons) ? value.reasons : Array.isArray(value.reason) ? value.reason : [];

  const normalized = {
    intent: stringValue(value.intent),
    answerMode: stringValue(value.answerMode),
    included: included.map(stringValue).filter(Boolean),
    excluded: excluded.map(stringValue).filter(Boolean),
    reasons: reasons.map(stringValue).filter(Boolean),
  };
  return normalized.intent || normalized.answerMode || normalized.included.length || normalized.excluded.length || normalized.reasons.length ? normalized : null;
}

function pickFields(record, fields) {
  const out = {};
  fields.forEach((field) => {
    const value = record?.[field];
    if (value == null || value === "") return;
    out[field] = typeof value === "string" ? clipText(value, 700) : value;
  });
  return out;
}

function intValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeChoice(value, options, fallback) {
  const clean = stringValue(value);
  if (!clean) return fallback;
  const match = options.find((option) => option.toLowerCase() === clean.toLowerCase());
  return match || fallback;
}

function normalizeHex(value) {
  return stringValue(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stringValue(entry)).filter(Boolean);
  }
  const clean = stringValue(value);
  return clean ? [clean] : [];
}

function normalizeLookup(value) {
  return stringValue(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getUpdateTargetConfig(type) {
  return UPDATE_TARGET_CONFIGS[type] || null;
}

function isUpdateToolType(type) {
  return Boolean(getUpdateTargetConfig(type));
}

function getRecordLabel(record, config) {
  return stringValue(record?.[config?.labelField || "name"] || record?.name || record?.title);
}

function buildUpdateCandidateLines(campaign, config) {
  const records = Array.isArray(campaign?.[config.collectionKey]) ? campaign[config.collectionKey] : [];
  if (!records.length) return [`No ${config.label.toLowerCase()} records exist yet.`];

  return records.slice(0, 80).map((record) => {
    const details = config.candidateFields
      .map((field) => {
        const value = record?.[field];
        if (value == null || value === "") return "";
        return `${field}: ${clipText(value, 90)}`;
      })
      .filter(Boolean)
      .join(" | ");
    return `- id: ${record.id} | ${config.label}: ${getRecordLabel(record, config)}${details ? ` | ${details}` : ""}`;
  });
}

function normalizeUpdateFieldValue(config, field, value) {
  if (value == null) return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  if (config.numericFields?.includes(field)) return intValue(value, 0);
  if (config.hexFields?.includes(field)) return normalizeHex(value);
  const choices = config.choiceFields?.[field];
  if (choices) return normalizeChoice(value, choices, choices[0]);
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean).join("\n");
  if (typeof value === "object") return JSON.stringify(value);
  return stringValue(value);
}

function normalizeUpdatePatch(config, patchSource) {
  const allowed = new Set(config.fields);
  const source = patchSource && typeof patchSource === "object" && !Array.isArray(patchSource) ? patchSource : {};
  const patch = {};
  for (const [field, value] of Object.entries(source)) {
    if (!allowed.has(field)) continue;
    const normalized = normalizeUpdateFieldValue(config, field, value);
    if (normalized === undefined) continue;
    patch[field] = normalized;
  }
  return patch;
}

function normalizeRecordUpdateDraft(type, data) {
  const config = getUpdateTargetConfig(type);
  if (!config) return data;
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const patchSource =
    source.patch && typeof source.patch === "object" && !Array.isArray(source.patch)
      ? source.patch
      : source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)
        ? source.fields
        : source.updates && typeof source.updates === "object" && !Array.isArray(source.updates)
          ? source.updates
          : source.changes && typeof source.changes === "object" && !Array.isArray(source.changes)
            ? source.changes
            : Object.fromEntries(Object.entries(source).filter(([field]) => config.fields.includes(field)));

  return {
    targetType: config.recordType,
    targetId: stringValue(source.targetId || source.id || source.recordId),
    targetName: stringValue(source.targetName || source.target || source.recordName || source.name || source.title),
    confidence: stringValue(source.confidence) || "medium",
    reason: stringValue(source.reason || source.rationale || source.notes),
    patch: normalizeUpdatePatch(config, patchSource),
  };
}

function findUpdateRecord(campaign, config, draft) {
  const records = Array.isArray(campaign?.[config.collectionKey]) ? campaign[config.collectionKey] : [];
  const targetId = stringValue(draft?.targetId);
  if (targetId) {
    const byId = records.find((record) => stringValue(record.id) === targetId);
    if (byId) return byId;
  }

  const targetName = normalizeLookup(draft?.targetName);
  if (!targetName) return null;
  const exact = records.find((record) => normalizeLookup(getRecordLabel(record, config)) === targetName);
  if (exact) return exact;
  const loose = records.filter((record) => {
    const label = normalizeLookup(getRecordLabel(record, config));
    return label && (label.includes(targetName) || targetName.includes(label));
  });
  return loose.length === 1 ? loose[0] : null;
}

function getUpdatePossibleMatches(campaign, config, draft) {
  const records = Array.isArray(campaign?.[config.collectionKey]) ? campaign[config.collectionKey] : [];
  const targetName = normalizeLookup(draft?.targetName);
  if (!targetName) return [];
  const terms = targetName.split(/\s+/).filter((term) => term.length > 2);
  return records
    .map((record) => {
      const label = normalizeLookup(getRecordLabel(record, config));
      const score = terms.reduce((total, term) => total + (label.includes(term) ? 1 : 0), 0);
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || getRecordLabel(a.record, config).localeCompare(getRecordLabel(b.record, config)))
    .slice(0, 4)
    .map((entry) => ({
      id: entry.record.id,
      label: getRecordLabel(entry.record, config),
    }));
}

function resolveRecordUpdateDraft(type, draft, campaign) {
  const config = getUpdateTargetConfig(type);
  if (!config) return draft;
  const record = findUpdateRecord(campaign, config, draft);
  const patchKeys = Object.keys(draft.patch || {});
  return {
    ...draft,
    resolvedId: stringValue(record?.id),
    resolvedName: record ? getRecordLabel(record, config) : "",
    unresolved: !record,
    emptyPatch: patchKeys.length === 0,
    possibleMatches: record ? [] : getUpdatePossibleMatches(campaign, config, draft),
    before: record ? pickFields(record, patchKeys) : {},
  };
}

function buildRecordUpdateDraft(type, parsedData, campaign) {
  return resolveRecordUpdateDraft(type, normalizeRecordUpdateDraft(type, parsedData), campaign);
}

function formatList(value) {
  return normalizeList(value).map((entry) => `- ${entry}`).join("\n");
}

function summarizeSession(session) {
  if (!session) return null;
  return pickFields(session, [
    "id",
    "title",
    "date",
    "type",
    "arc",
    "chapter",
    "focusHex",
    "travelObjective",
    "pressure",
    "summary",
    "nextPrep",
  ]);
}

function summarizeQuest(quest) {
  return pickFields(quest, ["id", "title", "status", "priority", "recordSource", "confirmed", "objective", "stakes", "nextBeat", "hex", "chapter"]);
}

function summarizeEvent(eventItem) {
  return pickFields(eventItem, [
    "id",
    "title",
    "category",
    "status",
    "recordSource",
    "confirmed",
    "urgency",
    "clock",
    "clockMax",
    "trigger",
    "consequenceSummary",
    "hex",
  ]);
}

function summarizeCompanion(companion) {
  return pickFields(companion, ["id", "name", "status", "recordSource", "confirmed", "travelState", "influence", "personalQuest", "spotlight", "notes"]);
}

function summarizeNpc(npc) {
  return pickFields(npc, ["id", "name", "status", "recordSource", "confirmed", "disposition", "importance", "role", "location", "agenda", "notes"]);
}

function summarizeLocation(location) {
  return pickFields(location, ["id", "name", "type", "status", "recordSource", "confirmed", "hex", "region", "summary", "threat", "notes"]);
}

function summarizeKingdom(kingdom, campaign) {
  if (!kingdom) return null;
  const kingdomModel = buildKingdomModel({ ...(campaign || {}), kingdom });
  const profile = kingdomModel.profile || {};
  return {
    name: stringValue(kingdom.kingdomName),
    currentDate: kingdom.currentDate,
    currentDateLabel: formatGolarionDate(kingdom.currentDate),
    currentTurnLabel: stringValue(kingdom.currentTurnLabel),
    level: kingdom.level,
    size: kingdom.size,
    controlDC: kingdom.controlDC || kingdom.controlDc,
    controlDc: kingdom.controlDC || kingdom.controlDc,
    rulesProfile: {
      id: stringValue(profile.id),
      label: stringValue(profile.label),
      shortLabel: stringValue(profile.shortLabel),
      summary: clipText(profile.summary, 700),
      turnStructure: Array.isArray(profile.turnStructure) ? profile.turnStructure.slice(0, 8) : [],
      aiContextSummary: Array.isArray(profile.aiContextSummary) ? profile.aiContextSummary.slice(0, 8) : [],
      sources: Array.isArray(profile.sources) ? profile.sources.slice(0, 8) : [],
    },
    unrest: kingdom.unrest,
    renown: kingdom.renown,
    fame: kingdom.fame,
    infamy: kingdom.infamy,
    resourcePoints: kingdom.resourcePoints,
    ruin: kingdom.ruin,
    leaders: (kingdom.leaders || []).slice(0, 12).map((leader) => pickFields(leader, ["role", "name", "skill", "status"])),
    settlements: (kingdom.settlements || []).slice(0, 12).map((settlement) => pickFields(settlement, ["name", "hex", "level", "notes"])),
    regions: (kingdom.regions || []).slice(0, 16).map((region) =>
      pickFields(region, ["hex", "status", "terrain", "siteCategory", "workSite", "kingdomValue", "danger", "notes"]),
    ),
    pendingProjects: Array.isArray(kingdom.pendingProjects) ? kingdom.pendingProjects.slice(0, 10) : [],
    recentTurns: (kingdom.turns || []).slice(0, 5).map((turn) => pickFields(turn, ["title", "date", "summary", "risks", "eventSummary"])),
  };
}

function getScopeById(scopeId) {
  return SCOPE_OPTIONS.find((entry) => entry.id === scopeId) || SCOPE_OPTIONS[0];
}

function inferScopeFromInput(input, fallbackId) {
  const match = stringValue(input).match(/^@([a-z-]+)/i);
  if (!match) return getScopeById(fallbackId);
  return getScopeById(SCOPE_ALIASES[match[1].toLowerCase()] || fallbackId);
}

function stripKnownScopeTags(input) {
  const clean = stringValue(input);
  const match = clean.match(/^@([a-z-]+)\s*/i);
  if (!match) return clean;
  if (!SCOPE_ALIASES[match[1].toLowerCase()]) return clean;
  return clean.slice(match[0].length).trim() || clean;
}

function getPdfSummaryBriefs(meta) {
  const summaries = meta?.pdfSummaries && typeof meta.pdfSummaries === "object" ? meta.pdfSummaries : {};
  return Object.values(summaries)
    .slice(0, 8)
    .map((entry) => ({
      fileName: stringValue(entry?.fileName),
      summary: clipText(entry?.summary, 900),
      updatedAt: stringValue(entry?.updatedAt),
    }))
    .filter((entry) => entry.fileName || entry.summary);
}

function buildHistoryForAi(messages) {
  return messages
    .slice(-8)
    .map((message) => ({
      role: message.role,
      tabId: "ai-chat",
      text: clipText(message.text, 900),
      at: message.at,
    }))
    .filter((message) => message.text);
}

function isPlayerBuildFollowup(prompt, history) {
  const cleanPrompt = stringValue(prompt).toLowerCase();
  if (!/\b(what about|how about|instead|alternative|caster|spellcaster|spell caster|int|intelligence|str|strength|dex|dexterity|wis|wisdom|cha|charisma|class|build)\b/.test(cleanPrompt)) {
    return false;
  }
  const recent = Array.isArray(history)
    ? history
        .slice(-6)
        .map((entry) => stringValue(entry?.text))
        .join(" ")
        .toLowerCase()
    : "";
  return isPlayerBuildQuestion(`${cleanPrompt} ${recent}`);
}

function getWorkspaceModeById(modeId) {
  return AI_WORKSPACE_MODES.find((entry) => entry.id === modeId) || AI_WORKSPACE_MODES[0];
}

function resolveAskRouting(prompt, history, workspaceModeId = "ask", scopeTag = "@app") {
  const detectedRoute = resolveAiRoute(prompt, workspaceModeId, scopeTag);
  const playerBuildFollowup = isPlayerBuildFollowup(prompt, history);
  const intent = playerBuildFollowup ? "player_build" : detectedRoute.intent;
  const contextPlan = selectContextBuckets(intent, workspaceModeId, scopeTag);
  return {
    intent,
    answerMode: selectAnswerMode(intent, workspaceModeId),
    contextPlan,
    reasons: playerBuildFollowup ? ["follow-up to recent player-build chat", ...detectedRoute.reasons] : detectedRoute.reasons,
    playerBuildRequested: intent === "player_build",
    campaignOpeningRequested: intent === "session_start_or_opening",
  };
}

function buildScopeContextSummary(scope, campaign) {
  const latestSession = getLatestSession(campaign);
  const activeQuests = getActiveQuests(campaign);
  const activeEvents = getActiveEvents(campaign);
  const companions = getTrackedCompanions(campaign);
  const kingdomModel = buildKingdomModel(campaign);
  const storyPhase = getActiveStoryPhase(campaign);

  const lines = [
    `Scope: ${scope.tag} ${scope.label}.`,
    `Story focus: ${storyPhase.label}. Treat Kingmaker reference records as prep context, not confirmed campaign history unless marked confirmed.`,
    `Ruleset: Pathfinder 2e Remastered plus the active Kingmaker kingdom rules profile "${kingdomModel.profile?.label || "Kingmaker profile"}". Prefer saved local rulings and canon memory before generic assumptions.`,
    latestSession?.title ? `Latest session: ${latestSession.title}.` : "No latest session is recorded.",
    activeQuests.length ? `Active quests: ${activeQuests.slice(0, 4).map((quest) => quest.title).join(", ")}.` : "No active quests are recorded.",
    activeEvents.length ? `Active events: ${activeEvents.slice(0, 4).map((eventItem) => eventItem.title).join(", ")}.` : "No active events are recorded.",
    companions.length ? `Tracked companions: ${companions.slice(0, 4).map((companion) => companion.name).join(", ")}.` : "No tracked companions are recorded.",
  ];

  return lines.filter(Boolean).join(" ");
}

function buildAiChatContext({ campaign, scope, messages, prompt, obsidianContext, workspaceModeId }) {
  const latestSession = getLatestSession(campaign);
  const activeQuests = getActiveQuests(campaign);
  const activeEvents = getActiveEvents(campaign);
  const companions = getTrackedCompanions(campaign);
  const meta = campaign.meta || {};
  const storyPhase = getActiveStoryPhase(campaign);
  const includeReference = meta.storyFocus?.includeReferenceInAi !== false;
  const focusedRecords = (records = []) => records.filter((record) => shouldSurfaceRecordForFocus(record, campaign, { includeReference }));
  const conversationHistory = [...(Array.isArray(meta.aiHistory) ? meta.aiHistory.slice(-8) : []), ...buildHistoryForAi(messages)].slice(-12);
  const workspaceMode = getWorkspaceModeById(workspaceModeId);
  const routing = resolveAskRouting(prompt, conversationHistory, workspaceMode.id, scope.tag);
  const knowledgeGraph = buildKnowledgeGraph(campaign, prompt, scope.id, workspaceMode.id);
  const campaignOpeningRequested = routing.campaignOpeningRequested;
  const playerBuildRequested = routing.playerBuildRequested;

  return {
    activeTab: scope.activeTab,
    tabLabel: scope.label,
    tabContext: campaignOpeningRequested
      ? `Scope: ${scope.tag} ${scope.label}. Opening-route override: answer from the Kingmaker campaign opening first. Do not treat saved trading-post or bandit-pressure records as the starting scene unless the GM explicitly says the opening is complete.`
      : buildScopeContextSummary(scope, campaign),
    taskType:
      routing.intent === "player_build"
        ? "player_build_advice"
        : routing.intent === "rules_question"
          ? "rules_question"
          : routing.intent === "campaign_recall"
            ? "campaign_recall"
            : scope.taskType,
    taskLabel: `Ask AI ${scope.tag}`,
    taskSaveTarget: "AI Chat answer",
    routeReason:
      routing.intent === "session_start_or_opening"
        ? "User explicitly asked for opening narration or first-session framing. Prioritize the Kingmaker opening before later live campaign records."
        : routing.intent === "player_build"
          ? "User asked for player class or party-composition advice. Prioritize PF2e role fit and keep opening or session-prep scaffolding out."
          : routing.intent === "rules_question"
            ? "User asked a rules question. Prefer direct PF2e Remastered rules explanation over story or prep framing."
            : routing.intent === "campaign_recall"
              ? "User asked for recall. Summarize stored campaign state and do not invent missing events."
              : routing.intent === "gm_prep"
                ? "User asked for GM prep help. Use campaign state quietly and keep the answer table-practical."
                : routing.intent === "world_lore"
                  ? "User asked for lore. Answer from setting context without switching into prep or narration."
                  : `User asked a ${scope.label} question from the Ask AI workspace.`,
    entityType: scope.id,
    latestSession: summarizeSession(latestSession),
    recentSessions: [...(campaign.sessions || [])].slice(0, 6).map(summarizeSession).filter(Boolean),
    openQuests: activeQuests.slice(0, 8).map(summarizeQuest),
    quests: focusedRecords(campaign.quests || []).slice(0, 12).map(summarizeQuest),
    companions: focusedRecords(campaign.companions || []).slice(0, 10).map(summarizeCompanion),
    events: focusedRecords(campaign.events || []).slice(0, 12).map(summarizeEvent),
    npcs: focusedRecords(campaign.npcs || []).slice(0, 14).map(summarizeNpc),
    locations: focusedRecords(campaign.locations || []).slice(0, 14).map(summarizeLocation),
    kingdom: summarizeKingdom(campaign.kingdom || {}, campaign),
    aiMemory: meta.aiMemory || {},
    aiHistory: campaignOpeningRequested
      ? conversationHistory.filter((entry) => entry.role !== "assistant").slice(-4)
      : conversationHistory,
    selectedPdfFile: "",
    pdfIndexedFiles: Array.isArray(meta.pdfIndexedFiles) ? meta.pdfIndexedFiles.slice(0, 24) : [],
    pdfIndexedFileCount: Number(meta.pdfIndexedCount || 0),
    pdfSummaryBriefs: getPdfSummaryBriefs(meta),
    obsidianContextEnabled: Boolean(obsidianContext),
    obsidianContext: obsidianContext?.summary || "",
    obsidianVaultNotes: Array.isArray(obsidianContext?.notes) ? obsidianContext.notes : [],
    obsidianContextNoteCount: Number(obsidianContext?.noteCount || 0),
    knowledgeGraph,
    knowledgeGraphPrompt: buildKnowledgeGraphPromptBlock(knowledgeGraph, 18),
    storyFocus: {
      id: storyPhase.id,
      label: storyPhase.label,
      summary: storyPhase.summary,
      includeReferenceInAi: includeReference,
    },
    aiPersona: meta.aiConfig?.aiPersona || "kingmaker-steward",
    workspaceModeId: workspaceMode.id,
    workspaceModeLabel: workspaceMode.label,
    scopeId: scope.id,
    scopeTag: scope.tag,
    askIntent: routing.intent,
    answerMode: routing.answerMode,
    contextPlan: routing.contextPlan,
    routeDebug: {
      intent: routing.intent,
      answerMode: routing.answerMode,
      included: routing.contextPlan.included,
      excluded: routing.contextPlan.excluded,
      reasons: Array.isArray(routing.reasons) ? routing.reasons.slice(0, 5) : [],
    },
    campaignOpeningRequested,
    playerBuildRequested,
    userQuestion: prompt,
  };
}

function buildMetaItems({ aiReady, aiConfig, pdfCount, obsidian, selectedScope, lastStatus, knowledgeGraph }) {
  const graphStats = knowledgeGraph?.stats || {};
  const routeLabels = Array.isArray(knowledgeGraph?.sourceTypes)
    ? knowledgeGraph.sourceTypes.map((source) => source.label || source.id).filter(Boolean)
    : [];
  return [
    {
      label: "Local AI",
      value: aiReady ? "Ollama Bridge" : "Unavailable",
      helper: aiReady
        ? `${aiConfig.model} @ ${aiConfig.endpoint}. Ask AI answers auto-route to a faster local model when needed.`
        : "Open the desktop build to talk to local AI.",
      valueTone: "compact",
    },
    {
      label: "Scope Tag",
      value: selectedScope.tag,
      helper: selectedScope.description,
      valueTone: "compact",
    },
    {
      label: "Knowledge Graph",
      value: `${Number(graphStats.nodeCount || 0)} / ${Number(graphStats.edgeCount || 0)}`,
      helper: routeLabels.length ? `Route: ${routeLabels.slice(0, 4).join(", ")}.` : "Live records are mapped before PDF retrieval.",
      valueTone: "compact",
    },
    {
      label: "PDF RAG",
      value: `${pdfCount}`,
      helper: pdfCount ? "Indexed PDFs available to @pdf and @app." : "Index PDFs in Source Library first.",
      valueTone: "number",
    },
    {
      label: "Vault",
      value: stringValue(obsidian?.vaultPath) ? "Configured" : "Not Set",
      helper: stringValue(obsidian?.vaultPath) ? "Vault context can be pulled into @vault and @app." : "Set a vault in Vault Sync.",
      valueTone: "compact",
    },
    {
      label: "Last Run",
      value: lastStatus || "Idle",
      helper: "AI proposes create/update drafts. You approve before anything saves.",
      valueTone: "compact",
    },
  ];
}

function getToolById(toolId) {
  return TOOL_OPTIONS.find((entry) => entry.id === toolId) || TOOL_OPTIONS[0];
}

function buildToolPrompt(tool, prompt, campaign) {
  if (tool.resultType === "answer") {
    return prompt;
  }
  const updateConfig = getUpdateTargetConfig(tool.resultType);
  if (updateConfig) {
    const schema = TOOL_SCHEMAS[tool.resultType] || {};
    const choiceLines = Object.entries(updateConfig.choiceFields || {}).map(
      ([field, options]) => `${field}: ${options.join(", ")}`,
    );
    return [
      `Create a reviewable ${updateConfig.label} update patch for Kingmaker Companion.`,
      "Return only one valid JSON object. Do not wrap it in markdown fences. Do not include commentary outside JSON.",
      "Use the candidate list to choose one existing record. Prefer exact id when the correct record is clear.",
      "Only include fields that should change inside patch. Do not include unchanged fields.",
      "Do not create a new record. If no target is clear, return targetName as the best guess, confidence as low, and an empty patch.",
      "If updating notes, write the full note text you want saved. The app will show a before/after patch before applying.",
      "",
      `Allowed patch fields for ${updateConfig.label}: ${updateConfig.fields.join(", ")}`,
      choiceLines.length ? "Allowed choice values:" : "",
      ...choiceLines,
      "",
      "Existing candidates:",
      ...buildUpdateCandidateLines(campaign, updateConfig),
      "",
      "JSON schema:",
      JSON.stringify(schema, null, 2),
      "",
      "GM update request:",
      prompt,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const kingdomModel = buildKingdomModel(campaign);
  const schema = TOOL_SCHEMAS[tool.resultType] || {};
  const allowedLines = [
    `Quest statuses: ${QUEST_STATUS_OPTIONS.join(", ")}`,
    `Quest priorities: ${QUEST_PRIORITY_OPTIONS.join(", ")}`,
    `Event categories: ${EVENT_CATEGORY_OPTIONS.join(", ")}`,
    `Event statuses: ${EVENT_STATUS_OPTIONS.join(", ")}`,
    `Event advance modes: ${EVENT_ADVANCE_OPTIONS.join(", ")}`,
    `Event impact scopes: ${EVENT_IMPACT_SCOPE_OPTIONS.join(", ")}`,
    `NPC statuses: ${NPC_STATUS_OPTIONS.join(", ")}`,
    `NPC dispositions: ${NPC_DISPOSITION_OPTIONS.join(", ")}`,
    `NPC importance: ${NPC_IMPORTANCE_OPTIONS.join(", ")}`,
    `Location types: ${LOCATION_TYPE_OPTIONS.join(", ")}`,
    `Location statuses: ${LOCATION_STATUS_OPTIONS.join(", ")}`,
    `Table note kinds: ${CAPTURE_KIND_OPTIONS.join(", ")}`,
  ];

  return [
    `Create a ${tool.label} draft for Kingmaker Companion.`,
    "Return only one valid JSON object. Do not wrap it in markdown fences. Do not include commentary outside JSON.",
    "Use empty strings for unknown text fields and 0 for unknown numeric impact fields.",
    "Do not invent unsupported official lore. If you infer, say so in notes.",
    "Ruleset requirement: use Pathfinder 2e Remastered framing and the active Kingmaker kingdom profile from context. Do not use Pathfinder 1e or CRPG mechanics unless the GM explicitly asks.",
    `Active kingdom rules profile: ${kingdomModel.profile?.label || "Kingmaker profile"}.`,
    kingdomModel.profile?.summary ? `Rules profile summary: ${kingdomModel.profile.summary}` : "",
    "",
    "Allowed values:",
    ...allowedLines,
    "",
    "JSON schema:",
    JSON.stringify(schema, null, 2),
    "",
    "GM input:",
    prompt,
  ]
    .filter(Boolean)
    .join("\n");
}

function shouldUsePdfContextForAsk(scope, prompt, aiConfig, workspaceModeId = "ask") {
  if (aiConfig?.usePdfContext === false) return false;
  const intent = detectAskIntent(prompt, workspaceModeId, scope?.tag || "@app");
  if (intent === "player_build") return false;
  if (intent === "campaign_recall") return false;
  if (intent === "session_start_or_opening") return true;
  if (scope.id === "pdf" || scope.id === "graph") return true;
  const lower = stringValue(prompt).toLowerCase();
  if (intent === "rules_question") {
    return /\b(pdf|source|book|chapter|page|player guide|companion guide|adventure path|kingdom rule)\b/.test(lower);
  }
  return /\b(pdf|source|book|chapter|page|adventure path|greenbelt|stolen lands|kingmaker text|indexed|mansion|manor|jamandi|aldori|restov|banquet|opening encounter|lore|hex|map|companion guide|player guide)\b/.test(lower);
}

function buildAiRequestConfig({ aiConfig, selectedTool, scope, prompt, workspaceModeId = "ask" }) {
  const graphAwareLimit = Math.max(Number(aiConfig.retrievalLimit || 4), scope.id === "pdf" || scope.id === "graph" ? 5 : 4);
  if (selectedTool.resultType !== "answer") {
    return {
      ...aiConfig,
      preferFastModel: true,
      compactContext: true,
      retrievalLimit: Math.min(graphAwareLimit, 6),
      maxOutputTokens: Math.max(900, Number(aiConfig.maxOutputTokens || 0)),
      temperature: Math.min(Number(aiConfig.temperature ?? 0.2), 0.25),
      timeoutSec: Math.max(90, Math.min(Number(aiConfig.timeoutSec || 120), 180)),
    };
  }

  return {
    ...aiConfig,
    preferFastModel: true,
    compactContext: true,
    usePdfContext: shouldUsePdfContextForAsk(scope, prompt, aiConfig, workspaceModeId),
    retrievalLimit: Math.min(graphAwareLimit, 6),
    maxOutputTokens: Math.max(720, Math.min(Math.max(Number(aiConfig.maxOutputTokens || 0), 760), 1000)),
    timeoutSec: Math.max(90, Math.min(Number(aiConfig.timeoutSec || 120), 180)),
  };
}

function extractJsonObject(text) {
  const raw = stringValue(text);
  if (!raw) return null;
  const withoutFence = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(withoutFence);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    // Continue with a best-effort object extraction below.
  }

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(withoutFence.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeSummaryDraft(data) {
  return {
    title: stringValue(data?.title) || "AI Summary",
    summary: stringValue(data?.summary),
    keyFacts: normalizeList(data?.keyFacts),
    actionItems: normalizeList(data?.actionItems),
    unresolvedQuestions: normalizeList(data?.unresolvedQuestions),
    nextPrep: stringValue(data?.nextPrep),
  };
}

function normalizeQuestToolDraft(data) {
  return {
    title: stringValue(data?.title) || "Untitled AI Quest",
    status: normalizeChoice(data?.status, QUEST_STATUS_OPTIONS, "open"),
    priority: normalizeChoice(data?.priority, QUEST_PRIORITY_OPTIONS, "Soon"),
    chapter: stringValue(data?.chapter),
    folder: stringValue(data?.folder) || "AI Drafts",
    giver: stringValue(data?.giver),
    hex: normalizeHex(data?.hex),
    linkedCompanion: stringValue(data?.linkedCompanion),
    linkedEvent: stringValue(data?.linkedEvent),
    objective: stringValue(data?.objective),
    stakes: stringValue(data?.stakes),
    nextBeat: stringValue(data?.nextBeat),
    blockers: stringValue(data?.blockers),
    reward: stringValue(data?.reward),
    notes: stringValue(data?.notes),
  };
}

function normalizeEventToolDraft(data) {
  return {
    title: stringValue(data?.title) || "Untitled AI Event",
    folder: stringValue(data?.folder) || "AI Drafts",
    category: normalizeChoice(data?.category, EVENT_CATEGORY_OPTIONS, "story"),
    status: normalizeChoice(data?.status, EVENT_STATUS_OPTIONS, "seeded"),
    urgency: Math.max(1, Math.min(5, intValue(data?.urgency, 3))),
    hex: normalizeHex(data?.hex),
    linkedQuest: stringValue(data?.linkedQuest),
    linkedCompanion: stringValue(data?.linkedCompanion),
    clock: Math.max(0, intValue(data?.clock, 0)),
    clockMax: Math.max(1, intValue(data?.clockMax, 4)),
    advancePerTurn: Math.max(0, intValue(data?.advancePerTurn, 1)),
    advanceOn: normalizeChoice(data?.advanceOn, EVENT_ADVANCE_OPTIONS, "manual"),
    impactScope: normalizeChoice(data?.impactScope, EVENT_IMPACT_SCOPE_OPTIONS, "none"),
    trigger: stringValue(data?.trigger),
    fallout: stringValue(data?.fallout),
    consequenceSummary: stringValue(data?.consequenceSummary),
    notes: stringValue(data?.notes),
    rpImpact: intValue(data?.rpImpact, 0),
    unrestImpact: intValue(data?.unrestImpact, 0),
    renownImpact: intValue(data?.renownImpact, 0),
    fameImpact: intValue(data?.fameImpact, 0),
    infamyImpact: intValue(data?.infamyImpact, 0),
    foodImpact: intValue(data?.foodImpact, 0),
    lumberImpact: intValue(data?.lumberImpact, 0),
    luxuriesImpact: intValue(data?.luxuriesImpact, 0),
    oreImpact: intValue(data?.oreImpact, 0),
    stoneImpact: intValue(data?.stoneImpact, 0),
    corruptionImpact: intValue(data?.corruptionImpact, 0),
    crimeImpact: intValue(data?.crimeImpact, 0),
    decayImpact: intValue(data?.decayImpact, 0),
    strifeImpact: intValue(data?.strifeImpact, 0),
  };
}

function normalizeNpcToolDraft(data) {
  return {
    name: stringValue(data?.name) || "Unnamed AI NPC",
    role: stringValue(data?.role),
    faction: stringValue(data?.faction),
    status: normalizeChoice(data?.status, NPC_STATUS_OPTIONS, "neutral"),
    disposition: normalizeChoice(data?.disposition, NPC_DISPOSITION_OPTIONS, "indifferent"),
    importance: normalizeChoice(data?.importance, NPC_IMPORTANCE_OPTIONS, "supporting"),
    creatureLevel: Math.max(-1, intValue(data?.creatureLevel, 0)),
    folder: stringValue(data?.folder) || "AI Drafts",
    location: stringValue(data?.location),
    hex: normalizeHex(data?.hex),
    firstImpression: stringValue(data?.firstImpression),
    agenda: stringValue(data?.agenda),
    leverage: stringValue(data?.leverage),
    pressure: stringValue(data?.pressure),
    rumor: stringValue(data?.rumor),
    secret: stringValue(data?.secret),
    nextScene: stringValue(data?.nextScene),
    linkedQuest: stringValue(data?.linkedQuest),
    linkedEvent: stringValue(data?.linkedEvent),
    kingdomRole: stringValue(data?.kingdomRole),
    kingdomNotes: stringValue(data?.kingdomNotes),
    notes: stringValue(data?.notes),
  };
}

function normalizeLocationToolDraft(data) {
  return {
    name: stringValue(data?.name) || "Unnamed AI Location",
    type: normalizeChoice(data?.type, LOCATION_TYPE_OPTIONS, "landmark"),
    status: normalizeChoice(data?.status, LOCATION_STATUS_OPTIONS, "active"),
    hex: normalizeHex(data?.hex),
    controllingFaction: stringValue(data?.controllingFaction),
    linkedQuest: stringValue(data?.linkedQuest),
    linkedEvent: stringValue(data?.linkedEvent),
    linkedNpc: stringValue(data?.linkedNpc),
    folder: stringValue(data?.folder) || "AI Drafts",
    whatChanged: stringValue(data?.whatChanged),
    sceneTexture: stringValue(data?.sceneTexture),
    opportunities: stringValue(data?.opportunities),
    risks: stringValue(data?.risks),
    rumor: stringValue(data?.rumor),
    notes: stringValue(data?.notes),
  };
}

function normalizeTableNoteToolDraft(data) {
  return {
    kind: normalizeChoice(data?.kind, CAPTURE_KIND_OPTIONS, "Note"),
    note: stringValue(data?.note),
  };
}

function normalizeToolDraft(type, data, campaign) {
  if (isUpdateToolType(type)) return buildRecordUpdateDraft(type, data, campaign);
  switch (type) {
    case "summary":
      return normalizeSummaryDraft(data);
    case "quest":
      return normalizeQuestToolDraft(data);
    case "event":
      return normalizeEventToolDraft(data);
    case "npc":
      return normalizeNpcToolDraft(data);
    case "location":
      return normalizeLocationToolDraft(data);
    case "table-note":
      return normalizeTableNoteToolDraft(data);
    default:
      return data;
  }
}

function getDraftTitle(type, data) {
  const updateConfig = getUpdateTargetConfig(type);
  if (updateConfig) return `Update ${updateConfig.label}: ${data?.resolvedName || data?.targetName || "Unresolved target"}`;
  if (type === "npc") return data?.name || "NPC draft";
  if (type === "summary") return data?.title || "Summary draft";
  if (type === "table-note") return data?.kind || "Table note";
  return data?.title || data?.name || "AI draft";
}

function formatSummaryAsTableNote(draft) {
  return [
    `# ${draft.title}`,
    "",
    draft.summary,
    draft.keyFacts.length ? ["", "Key facts:", formatList(draft.keyFacts)].join("\n") : "",
    draft.actionItems.length ? ["", "Action items:", formatList(draft.actionItems)].join("\n") : "",
    draft.unresolvedQuestions.length ? ["", "Unresolved questions:", formatList(draft.unresolvedQuestions)].join("\n") : "",
    draft.nextPrep ? `\nNext prep:\n${draft.nextPrep}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function formatDraftValue(value) {
  if (Array.isArray(value)) return value.join("\n");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function DraftPreview({ draft, onApply, onDiscard }) {
  if (!draft) return null;
  const updateConfig = getUpdateTargetConfig(draft.type);
  const isUpdate = Boolean(updateConfig);
  const patch = draft.data?.patch && typeof draft.data.patch === "object" ? draft.data.patch : {};
  const patchEntries = Object.entries(patch);
  const canApply = !draft.data?.unresolved && !draft.data?.emptyPatch && (!isUpdate || patchEntries.length > 0);
  const entriesSource = isUpdate
    ? {
        targetType: draft.data?.targetType,
        targetName: draft.data?.resolvedName || draft.data?.targetName,
        targetId: draft.data?.resolvedId || draft.data?.targetId,
        confidence: draft.data?.confidence,
        reason: draft.data?.reason,
      }
    : draft.data || {};
  const entries = Object.entries(entriesSource).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== "" && value != null;
  });

  return (
    <Paper className="km-panel km-content-panel km-ai-draft-panel">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Text className="km-section-kicker">Reviewable Draft</Text>
            <Title order={3}>{getDraftTitle(draft.type, draft.data)}</Title>
            <Text c="dimmed" size="sm">
              Nothing is saved until you apply this draft.
            </Text>
          </div>
          <Group gap="sm">
            <Button color="moss" onClick={onApply} disabled={!canApply}>
              Apply Draft
            </Button>
            <Button variant="default" onClick={onDiscard}>
              Discard
            </Button>
          </Group>
        </Group>
        <div className="km-ai-draft-grid">
          {entries.map(([key, value]) => (
            <div key={key} className="km-ai-draft-field">
            <Text className="km-section-kicker">{key}</Text>
              <Text className="km-ai-draft-value">{formatDraftValue(value)}</Text>
            </div>
          ))}
        </div>
        {isUpdate ? (
          <Stack gap="sm">
            {draft.data?.unresolved ? (
              <Text c="red" size="sm">
                The AI could not resolve an exact {updateConfig.label.toLowerCase()} target. Try naming the record exactly or choose a candidate:{" "}
                {(draft.data?.possibleMatches || []).map((match) => match.label).join(", ") || "none found"}.
              </Text>
            ) : null}
            {draft.data?.emptyPatch ? (
              <Text c="red" size="sm">
                No update fields were returned. Adjust the prompt and regenerate.
              </Text>
            ) : null}
            {patchEntries.length ? (
              <div className="km-ai-draft-grid">
                {patchEntries.map(([field, nextValue]) => (
                  <div key={field} className="km-ai-draft-field">
                    <Text className="km-section-kicker">{field}</Text>
                    <Text c="dimmed" size="sm">
                      Current
                    </Text>
                    <Text className="km-ai-draft-value">{formatDraftValue(draft.data?.before?.[field] ?? "Blank")}</Text>
                    <Text c="dimmed" size="sm">
                      Proposed
                    </Text>
                    <Text className="km-ai-draft-value">{formatDraftValue(nextValue)}</Text>
                  </div>
                ))}
              </div>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

function renderInlineAiText(text) {
  const parts = stringValue(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <span key={`${part}-${index}`} className="km-ai-message__strong">
          {boldMatch[1]}
        </span>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function splitAiLabeledLine(line) {
  const clean = stringValue(line).trim();
  const markdownMatch = clean.match(/^\*\*([^*]{2,64})\*\*:?\s*(.*)$/);
  if (markdownMatch) {
    return {
      label: markdownMatch[1].trim(),
      body: markdownMatch[2].trim(),
    };
  }
  const plainMatch = clean.match(/^([A-Z][A-Za-z0-9' /&-]{2,42}):\s*(.+)$/);
  if (plainMatch) {
    return {
      label: plainMatch[1].trim(),
      body: plainMatch[2].trim(),
    };
  }
  return null;
}

function AiMessageText({ text, role }) {
  const lines = stringValue(text).split(/\r?\n/);
  let bulletIndex = 0;

  return (
    <div className={`km-ai-message__text km-ai-message__text--${role}`}>
      {lines.map((rawLine, index) => {
        const line = stringValue(rawLine).trim();
        if (!line) {
          return <span key={`spacer-${index}`} className="km-ai-message__spacer" aria-hidden="true" />;
        }

        const bulletMatch = line.match(/^[-*]\s+(.+)$/);
        if (bulletMatch) {
          const tone = bulletIndex % 5;
          bulletIndex += 1;
          const labeled = splitAiLabeledLine(bulletMatch[1]);
          return (
            <div key={`bullet-${index}`} className={`km-ai-message__bullet km-ai-message__bullet--tone-${tone}`}>
              <span className="km-ai-message__bullet-dot" aria-hidden="true" />
              <span className="km-ai-message__bullet-copy">
                {labeled ? (
                  <>
                    <span className="km-ai-message__label">{labeled.label}</span>
                    {labeled.body ? <span className="km-ai-message__label-body"> {renderInlineAiText(labeled.body)}</span> : null}
                  </>
                ) : (
                  renderInlineAiText(bulletMatch[1])
                )}
              </span>
            </div>
          );
        }

        const standaloneHeading = line.match(/^([A-Z][A-Za-z0-9' /&-]{2,44}):$/);
        if (standaloneHeading) {
          return (
            <div key={`heading-${index}`} className="km-ai-message__section">
              {standaloneHeading[1]}
            </div>
          );
        }

        const labeled = splitAiLabeledLine(line);
        if (labeled) {
          const isAdvice = /^my read$/i.test(labeled.label);
          return (
            <p key={`line-${index}`} className={isAdvice ? "km-ai-message__advice" : "km-ai-message__labeled-line"}>
              <span className="km-ai-message__label">{labeled.label}</span>
              {labeled.body ? <span className="km-ai-message__label-body"> {renderInlineAiText(labeled.body)}</span> : null}
            </p>
          );
        }

        return (
          <p key={`para-${index}`} className="km-ai-message__paragraph">
            {renderInlineAiText(line)}
          </p>
        );
      })}
    </div>
  );
}

function ChatMessage({ message }) {
  const routeDebug = message.role === "assistant" ? normalizeRouteDebug(message.routeDebug) : null;
  const routeReason = routeDebug?.reasons?.[0] || "";

  return (
    <div className={`km-ai-message km-ai-message--${message.role}`}>
      <Group justify="space-between" gap="sm" className="km-ai-message__header">
        <Text className="km-section-kicker">{message.role === "user" ? "You" : "Companion AI"}</Text>
        {message.scope ? (
          <Badge color="moss" variant="light">
            {message.scope}
          </Badge>
        ) : null}
      </Group>
      {routeDebug ? (
        <div className="km-ai-message__route">
          <Group gap="xs" wrap="wrap">
            {routeDebug.intent ? (
              <Badge color="moss" variant="light">
                {INTENT_LABELS[routeDebug.intent] || routeDebug.intent}
              </Badge>
            ) : null}
            {routeDebug.answerMode ? <Badge variant="light">{ANSWER_MODE_LABELS[routeDebug.answerMode] || routeDebug.answerMode}</Badge> : null}
          </Group>
          <Text size="xs" c="dimmed">
            Context: {routeDebug.included.slice(0, 4).join(", ") || "none"}. Held back: {routeDebug.excluded.slice(0, 4).join(", ") || "none"}.
          </Text>
          {routeReason ? (
            <Text size="xs" c="dimmed">
              Route reason: {routeReason}
            </Text>
          ) : null}
        </div>
      ) : null}
      <AiMessageText text={message.text} role={message.role} />
    </div>
  );
}

export default function AIChatPage() {
  const navigate = useNavigate();
  const { campaign, desktopApi, actions } = useCampaign();
  const aiConfig = campaign.meta?.aiConfig || DEFAULT_AI_CONFIG;
  const obsidian = campaign.meta?.obsidian || {};
  const [workspaceModeId, setWorkspaceModeId] = useState(DEFAULT_WORKSPACE_MODE.id);
  const [scopeId, setScopeId] = useState(DEFAULT_WORKSPACE_MODE.defaultScopeId);
  const [toolId, setToolId] = useState("answer");
  const [input, setInput] = useState(DEFAULT_WORKSPACE_MODE.starterPrompt);
  const [messages, setMessages] = useState(() =>
    (Array.isArray(campaign.meta?.aiHistory) ? campaign.meta.aiHistory.slice(-6) : [])
      .map((entry) => ({
        id: `${entry?.role || "message"}-${entry?.at || Math.random()}`,
        role: entry?.role === "assistant" ? "assistant" : "user",
        text: stringValue(entry?.text),
        at: entry?.at || new Date().toISOString(),
        scope: entry?.scope || "",
        routeDebug: normalizeRouteDebug(entry?.routeDebug),
      }))
      .filter((entry) => entry.text),
  );
  const [busy, setBusy] = useState(false);
  const [includeVault, setIncludeVault] = useState(obsidian.useForAiContext !== false);
  const [status, setStatus] = useState("");
  const [pendingDraft, setPendingDraft] = useState(null);

  const aiReady = Boolean(desktopApi?.generateLocalAiText);
  const selectedWorkspaceMode = getWorkspaceModeById(workspaceModeId);
  const activeToolId = workspaceModeId === "create" ? toolId : NON_CREATE_TOOL_IDS[0];
  const selectedScope = getScopeById(scopeId);
  const selectedTool = getToolById(activeToolId);
  const pdfCount = Number(campaign.meta?.pdfIndexedCount || 0);
  const canAsk = Boolean(input.trim()) && aiReady && !busy;
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const previewPrompt = stripKnownScopeTags(input);
  const previewConversationHistory = useMemo(
    () => [...(Array.isArray(campaign.meta?.aiHistory) ? campaign.meta.aiHistory.slice(-8) : []), ...buildHistoryForAi(messages)].slice(-12),
    [campaign.meta?.aiHistory, messages],
  );
  const previewRouting = useMemo(
    () => resolveAskRouting(previewPrompt, previewConversationHistory, workspaceModeId, selectedScope.tag),
    [previewPrompt, previewConversationHistory, workspaceModeId, selectedScope.tag],
  );
  const previewKnowledgeGraph = useMemo(
    () => buildKnowledgeGraph(campaign, previewPrompt, selectedScope.id, workspaceModeId),
    [campaign, previewPrompt, selectedScope.id, workspaceModeId],
  );
  const previewUsesPdfContext = useMemo(
    () => shouldUsePdfContextForAsk(selectedScope, previewPrompt, aiConfig, workspaceModeId),
    [selectedScope, previewPrompt, aiConfig, workspaceModeId],
  );

  const metaItems = useMemo(
    () =>
      buildMetaItems({
        aiReady,
        aiConfig,
        pdfCount,
        obsidian,
        selectedScope,
        lastStatus: status,
        knowledgeGraph: previewKnowledgeGraph,
      }),
    [aiReady, aiConfig, pdfCount, obsidian, selectedScope, status, previewKnowledgeGraph],
  );

  const handleWorkspaceModeChange = (nextModeId) => {
    const nextMode = getWorkspaceModeById(nextModeId);
    const nextScope = getScopeById(nextMode.defaultScopeId);
    setWorkspaceModeId(nextMode.id);
    if (nextMode.id === "create" && toolId === "answer") {
      setToolId(DEFAULT_CREATE_TOOL_ID);
    }
    setScopeId(nextScope.id);
    setInput((current) => {
      const withoutTag = stripKnownScopeTags(current);
      if (!withoutTag) return nextMode.starterPrompt;
      return `${nextScope.tag} ${withoutTag}`;
    });
    setPendingDraft(null);
  };

  const handleTagClick = (scope) => {
    setScopeId(scope.id);
    setInput((current) => {
      const withoutTag = stripKnownScopeTags(current);
      if (!withoutTag) return `${scope.tag} `;
      return `${scope.tag} ${withoutTag}`;
    });
  };

  const handleRecipeClick = (recipe) => {
    setWorkspaceModeId("create");
    setToolId(recipe.toolId);
    setScopeId(recipe.scopeId);
    setInput(recipe.prompt);
    setPendingDraft(null);
  };

  const handleCopyLastAnswer = async () => {
    if (!lastAssistantMessage?.text) return;
    try {
      await navigator.clipboard.writeText(lastAssistantMessage.text);
      notifications.show({
        color: "moss",
        title: "Answer copied",
        message: "The latest AI answer was copied to the clipboard.",
      });
    } catch {
      notifications.show({
        color: "ember",
        title: "Copy failed",
        message: "Clipboard access was not available.",
      });
    }
  };

  const handleApplyDraft = () => {
    if (!pendingDraft) return;
    let saved = null;
    let targetPath = "";
    let title = "";
    const updateConfig = getUpdateTargetConfig(pendingDraft.type);

    if (updateConfig) {
      if (pendingDraft.data?.unresolved || !pendingDraft.data?.resolvedId) {
        notifications.show({
          color: "ember",
          title: "Update target unresolved",
          message: "The AI patch did not match one exact existing record. Regenerate with the exact record name.",
        });
        return;
      }
      if (pendingDraft.data?.emptyPatch || !Object.keys(pendingDraft.data?.patch || {}).length) {
        notifications.show({
          color: "ember",
          title: "No fields to update",
          message: "The AI patch did not include any valid fields.",
        });
        return;
      }
      const action = actions[updateConfig.upsertAction];
      saved = typeof action === "function" ? action(pendingDraft.data.patch, pendingDraft.data.resolvedId) : null;
      targetPath = updateConfig.path;
      title = pendingDraft.data.resolvedName || pendingDraft.data.targetName || updateConfig.label;
    }

    if (!saved && pendingDraft.type === "summary") {
      const note = formatSummaryAsTableNote(pendingDraft.data);
      saved = actions.addCaptureEntry({
        kind: "Note",
        note,
      });
      targetPath = "/campaign/table-notes";
      title = pendingDraft.data.title || "AI Summary";
    }

    if (!saved && pendingDraft.type === "quest") {
      saved = actions.upsertQuest(pendingDraft.data);
      targetPath = "/world/quests";
      title = saved?.title || pendingDraft.data.title;
    }

    if (!saved && pendingDraft.type === "event") {
      saved = actions.upsertEvent(pendingDraft.data);
      targetPath = "/world/events";
      title = saved?.title || pendingDraft.data.title;
    }

    if (!saved && pendingDraft.type === "npc") {
      saved = actions.upsertNpc(pendingDraft.data);
      targetPath = "/world/npcs";
      title = saved?.name || pendingDraft.data.name;
    }

    if (!saved && pendingDraft.type === "location") {
      saved = actions.upsertLocation(pendingDraft.data);
      targetPath = "/world/locations";
      title = saved?.name || pendingDraft.data.name;
    }

    if (!saved && pendingDraft.type === "table-note") {
      saved = actions.addCaptureEntry({
        kind: pendingDraft.data.kind,
        note: pendingDraft.data.note,
      });
      targetPath = "/campaign/table-notes";
      title = pendingDraft.data.kind || "Table Note";
    }

    if (!saved) {
      notifications.show({
        color: "ember",
        title: "Draft not applied",
        message: "The generated draft did not contain enough data to save.",
      });
      return;
    }

    notifications.show({
      color: "moss",
      title: "AI draft saved",
      message: `${title || "Draft"} was saved into Kingmaker Companion.`,
    });
    setPendingDraft(null);
    if (targetPath) navigate(targetPath);
  };

  const handleAsk = async () => {
    if (!aiReady) {
      notifications.show({
        color: "ember",
        title: "Local AI unavailable",
        message: "Ask AI requires the desktop app with the local Ollama bridge.",
      });
      return;
    }

    const rawInput = input.trim();
    if (!rawInput) {
      notifications.show({
        color: "ember",
        title: "Question required",
        message: "Type a question or use a scope tag like @app or @rules.",
      });
      return;
    }

    const scope = inferScopeFromInput(rawInput, scopeId);
    const prompt = stripKnownScopeTags(rawInput);
    const toolPrompt = buildToolPrompt(selectedTool, prompt, campaign);
    const now = new Date().toISOString();
    const userMessage = {
      id: `user-${now}`,
      role: "user",
      text: prompt,
      at: now,
      scope: scope.tag,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setBusy(true);
    setStatus("Preparing context");

    try {
      let obsidianContext = null;
      const shouldPullVault =
        includeVault &&
        Boolean(obsidian?.vaultPath) &&
        Boolean(desktopApi?.getObsidianVaultContext) &&
        (scope.id === "vault" || scope.id === "app" || scope.id === "campaign" || scope.id === "graph");

      if (shouldPullVault) {
        setStatus("Reading vault");
        obsidianContext = await desktopApi.getObsidianVaultContext({
          vaultPath: obsidian.vaultPath,
          baseFolder: obsidian.baseFolder,
          readWholeVault: obsidian.readWholeVault,
          maxNotes: obsidian.aiContextNoteLimit,
          maxChars: obsidian.aiContextCharLimit,
          query: prompt,
        });
      }

      setStatus("Asking Ollama");
      const response = await desktopApi.generateLocalAiText({
        mode: selectedTool.mode,
        input: toolPrompt,
        context: buildAiChatContext({
          campaign,
          scope,
          messages,
          prompt,
          obsidianContext,
          workspaceModeId,
        }),
        config: buildAiRequestConfig({ aiConfig, selectedTool, scope, prompt, workspaceModeId }),
      });

      const responseText = stringValue(response?.text) || "The local model returned an empty response.";
      let assistantText = responseText;
      let nextDraft = null;
      const messageScopeLabel = selectedTool.resultType === "answer" ? `${scope.tag} ${selectedWorkspaceMode.label}` : `${scope.tag} ${selectedTool.label}`;

      if (selectedTool.resultType !== "answer") {
        const parsedDraft = extractJsonObject(responseText);
        if (parsedDraft) {
          nextDraft = {
            type: selectedTool.resultType,
            data: normalizeToolDraft(selectedTool.resultType, parsedDraft, campaign),
            raw: responseText,
            at: new Date().toISOString(),
          };
          assistantText = `Generated a reviewable ${selectedTool.label.toLowerCase()} draft: ${getDraftTitle(nextDraft.type, nextDraft.data)}. Review it below, then Apply Draft to save it.`;
          setPendingDraft(nextDraft);
        } else {
          setPendingDraft(null);
          notifications.show({
            color: "ember",
            title: "Draft parse failed",
            message: "The AI answered, but it did not return valid JSON. The raw answer was kept in chat.",
          });
        }
      }

      const assistantMessage = {
        id: `assistant-${new Date().toISOString()}`,
        role: "assistant",
        text: assistantText,
        at: new Date().toISOString(),
        scope: messageScopeLabel,
        routeDebug: normalizeRouteDebug(response?.routeDebug),
      };
      const finalMessages = [...nextMessages, assistantMessage].slice(-24);
      setMessages(finalMessages);
      actions.updateMeta({
        aiHistory: finalMessages.map((message) => ({
          role: message.role,
          tabId: "ai-chat",
          text: clipText(message.text, 2200),
          at: message.at,
          scope: message.scope,
          routeDebug: normalizeRouteDebug(message.routeDebug),
        })),
      });
      const responseModel = stringValue(response?.model);
      const fallbackReason = stringValue(response?.fallbackReason);
      setStatus(fallbackReason ? `Complete via ${responseModel || "fallback"}` : "Complete");
      setInput(`${scope.tag} `);
    } catch (error) {
      const message = stringValue(error?.message || error) || "AI request failed.";
      const failureMessage = {
        id: `assistant-error-${new Date().toISOString()}`,
        role: "assistant",
        text: [
          `AI request failed: ${message}`,
          "",
          "Try one of these:",
          "- Use AI / RAG Settings to switch to a faster model like lorebound-pf2e-pure:latest or llama3.1:8b.",
          "- Temporarily turn off PDF context if the failure happened during retrieval.",
          "- Ask a shorter question, then retry.",
        ].join("\n"),
        at: new Date().toISOString(),
        scope: selectedTool.resultType === "answer" ? `${scope.tag} ${selectedWorkspaceMode.label}` : `${scope.tag} ${selectedTool.label}`,
      };
      const failedMessages = [...nextMessages, failureMessage].slice(-24);
      setMessages(failedMessages);
      actions.updateMeta({
        aiHistory: failedMessages.map((entry) => ({
          role: entry.role,
          tabId: "ai-chat",
          text: clipText(entry.text, 2200),
          at: entry.at,
          scope: entry.scope,
          routeDebug: normalizeRouteDebug(entry.routeDebug),
        })),
      });
      setStatus("Failed");
      notifications.show({
        color: "ember",
        title: "AI request failed",
        message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="lg" className="km-ai-chat-page">
      <PageHeader
        eyebrow="Reference"
        title="Ask AI"
        description="Pick one mode at a time: ask a question, prep the next session, recall campaign state, or generate reviewable drafts."
        actions={
          <>
            <Button variant="default" onClick={() => navigate("/reference/ai-rag")}>
              AI / RAG Settings
            </Button>
            <Button variant="default" onClick={() => navigate("/reference/source-library")}>
              Source Library
            </Button>
            <Button color="moss" onClick={() => navigate("/links/vault-sync")}>
              Vault Sync
            </Button>
          </>
        }
      />

      <CompactMetaStrip items={metaItems} />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <Paper className="km-panel km-content-panel km-ai-chat__panel">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <div>
                  <Text className="km-section-kicker">Conversation</Text>
                  <Title order={3}>{selectedWorkspaceMode.kicker}</Title>
                  <Text c="dimmed" size="sm">
                    {selectedWorkspaceMode.description}
                  </Text>
                </div>
                <Group gap="sm">
                  <Button variant="default" onClick={handleCopyLastAnswer} disabled={!lastAssistantMessage}>
                    Copy Last Answer
                  </Button>
                  <Button variant="default" onClick={() => setMessages([])} disabled={!messages.length || busy}>
                    Clear Chat
                  </Button>
                </Group>
              </Group>

              <div className="km-ai-mode-grid">
                {AI_WORKSPACE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`km-ai-mode-button${workspaceModeId === mode.id ? " is-active" : ""}`}
                    onClick={() => handleWorkspaceModeChange(mode.id)}
                  >
                    <span>{mode.label}</span>
                    <strong>{mode.kicker}</strong>
                    <small>{mode.description}</small>
                  </button>
                ))}
              </div>

              <div className="km-ai-chat__messages">
                {messages.length ? (
                  messages.map((message) => <ChatMessage key={message.id} message={message} />)
                ) : (
                  <div className="km-ai-chat__empty">
                    <Text className="km-section-kicker">No Chat Yet</Text>
                    <Title order={4}>Start in {selectedWorkspaceMode.label}</Title>
                    <Text c="dimmed">
                      Try{" "}
                      {selectedWorkspaceMode.examples.slice(0, 3).map((example, index) => (
                        <span key={example}>
                          {index ? index === selectedWorkspaceMode.examples.length - 1 ? " or " : ", " : ""}
                          <strong>{example}</strong>
                        </span>
                      ))}
                      .
                    </Text>
                  </div>
                )}
              </div>

              <DraftPreview draft={pendingDraft} onApply={handleApplyDraft} onDiscard={() => setPendingDraft(null)} />

              <Stack gap="sm">
                <Group justify="space-between" align="center" wrap="wrap">
                  {workspaceModeId === "create" ? (
                    <Select
                      label="Create / update action"
                      value={toolId}
                      onChange={(value) => setToolId(value || DEFAULT_CREATE_TOOL_ID)}
                      data={TOOL_OPTIONS.filter((tool) => tool.id !== "answer").map((tool) => ({ value: tool.id, label: tool.label }))}
                      maw={260}
                    />
                  ) : (
                    <Paper withBorder radius="md" p="sm" className="km-ai-mode-summary">
                      <Text className="km-section-kicker">Current Mode</Text>
                      <Text fw={700}>{selectedWorkspaceMode.kicker}</Text>
                      <Text size="sm" c="dimmed">
                        {selectedWorkspaceMode.helper}
                      </Text>
                    </Paper>
                  )}
                  <Select
                    label={workspaceModeId === "create" ? "Draft scope" : "Read scope"}
                    value={scopeId}
                    onChange={(value) => handleTagClick(getScopeById(value || "app"))}
                    data={SCOPE_OPTIONS.map((scope) => ({ value: scope.id, label: `${scope.tag} ${scope.label}` }))}
                    maw={300}
                  />
                  <Checkbox
                    checked={includeVault}
                    onChange={(event) => setIncludeVault(event.currentTarget.checked)}
                    label="Pull Obsidian vault context when relevant"
                  />
                </Group>
                {selectedTool.resultType === "answer" ? (
                  <Paper withBorder radius="md" p="sm">
                    <Stack gap={6}>
                      <Text className="km-section-kicker">Route Preview</Text>
                      <Group gap="xs" wrap="wrap">
                        <Badge color="gray" variant="light">
                          {selectedWorkspaceMode.label}
                        </Badge>
                        <Badge color="moss" variant="light">
                          {INTENT_LABELS[previewRouting.intent] || "General"}
                        </Badge>
                        <Badge variant="light">{ANSWER_MODE_LABELS[previewRouting.answerMode] || "Advice"}</Badge>
                        <Badge variant="light" color={previewUsesPdfContext ? "moss" : "gray"}>
                          {previewUsesPdfContext ? "PDF Context On" : "PDF Context Off"}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        Context in: {previewRouting.contextPlan.included.join(", ")}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Held back: {previewRouting.contextPlan.excluded.join(", ")}
                      </Text>
                      {Array.isArray(previewKnowledgeGraph?.route?.reasons) && previewKnowledgeGraph.route.reasons.length ? (
                        <Text size="xs" c="dimmed">
                          Why this route: {previewKnowledgeGraph.route.reasons.slice(0, 3).join("; ")}
                        </Text>
                      ) : null}
                    </Stack>
                  </Paper>
                ) : null}
                <Textarea
                  minRows={4}
                  autosize
                  maxRows={9}
                  value={input}
                  onChange={(event) => setInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      void handleAsk();
                    }
                  }}
                  placeholder={selectedWorkspaceMode.starterPrompt}
                  disabled={busy}
                />
                <Group justify="space-between" gap="sm" wrap="wrap">
                  <Text size="sm" c="dimmed">
                    {busy
                      ? status || "Working"
                      : workspaceModeId === "create"
                        ? `${selectedTool.description} Use the create/update cards on the right for ready-made prompts.`
                        : selectedWorkspaceMode.helper}
                  </Text>
                  <Button color="moss" onClick={handleAsk} loading={busy} disabled={!canAsk}>
                    {selectedTool.resultType === "answer" ? `Run ${selectedWorkspaceMode.label}` : "Generate Draft"}
                  </Button>
                </Group>
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Stack gap="lg">
            {workspaceModeId === "create" ? (
              <Paper className="km-panel km-content-panel km-ai-chat__panel">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Create / Update</Text>
                    <Title order={3}>Change Records With AI</Title>
                    <Text c="dimmed" size="sm">
                      Click one, adjust the prompt, then Generate Draft. Review creates or before/after patches before saving.
                    </Text>
                  </div>
                  <div className="km-ai-recipe-grid">
                    {TOOL_RECIPES.map((recipe) => {
                      const tool = getToolById(recipe.toolId);
                      return (
                        <button
                          key={recipe.toolId}
                          type="button"
                          className={`km-ai-recipe-button${selectedTool.id === recipe.toolId ? " is-active" : ""}`}
                          onClick={() => handleRecipeClick(recipe)}
                        >
                          <span>{recipe.title}</span>
                          <strong>{tool.label}</strong>
                          <small>{tool.description}</small>
                        </button>
                      );
                    })}
                  </div>
                </Stack>
              </Paper>
            ) : (
              <Paper className="km-panel km-content-panel km-ai-chat__panel">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Mode Guide</Text>
                    <Title order={3}>{selectedWorkspaceMode.kicker}</Title>
                    <Text c="dimmed" size="sm">
                      {selectedWorkspaceMode.helper}
                    </Text>
                  </div>
                  <div className="km-ai-mode-example-grid">
                    {selectedWorkspaceMode.examples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        className="km-ai-mode-example"
                        onClick={() => {
                          const exampleScope = inferScopeFromInput(example, selectedWorkspaceMode.defaultScopeId);
                          setScopeId(exampleScope.id);
                          setInput(example);
                        }}
                      >
                        <span>Use Prompt</span>
                        <strong>{example}</strong>
                      </button>
                    ))}
                  </div>
                </Stack>
              </Paper>
            )}

            <Paper className="km-panel km-content-panel km-ai-chat__panel">
              <Stack gap="md">
                <div>
                  <Text className="km-section-kicker">Context</Text>
                  <Title order={3}>Choose A Scope</Title>
                </div>
                <div className="km-ai-tag-grid">
                  {SCOPE_OPTIONS.map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      className={`km-ai-tag-button${selectedScope.id === scope.id ? " is-active" : ""}`}
                      onClick={() => handleTagClick(scope)}
                    >
                      <span>{scope.tag}</span>
                      <strong>{scope.label}</strong>
                      <small>{scope.description}</small>
                    </button>
                  ))}
                </div>
              </Stack>
            </Paper>

            <Paper className="km-panel km-content-panel km-ai-chat__panel">
              <Stack gap="md">
                <div>
                  <Text className="km-section-kicker">Access</Text>
                  <Title order={3}>What AI Can Touch</Title>
                </div>
                <div className="km-ai-access-list">
                  <div>
                    <strong>Readable now</strong>
                    <Text c="dimmed">
                      Campaign records, kingdom state, active quests, events, companions, NPCs, locations, the knowledge graph, AI memory, indexed
                      PDF chunks, AON rule matches, and configured vault notes.
                    </Text>
                  </div>
                  <div>
                    <strong>How to create or update records</strong>
                    <Text c="dimmed">
                      In Create mode, choose a draft tool or click a Create / Update card, edit the prompt, click Generate Draft, review the fields
                      or patch diff, then Apply Draft to save it into quests, events, NPCs, locations, companions, summaries, or table notes.
                    </Text>
                  </div>
                  <div>
                    <strong>How answer modes work</strong>
                    <Text c="dimmed">
                      Ask, Prep, and Recall all use Answer Only, but the route preview shows which intent and context buckets will be used before the
                      prompt is sent.
                    </Text>
                  </div>
                </div>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
