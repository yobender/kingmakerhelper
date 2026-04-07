import { KINGMAKER_DEFAULT_START_DATE, normalizeGolarionDate } from "./golarion";
import {
  HEX_MAP_BACKGROUND_SCALE_MAX,
  HEX_MAP_BACKGROUND_SCALE_MIN,
  HEX_MAP_COLUMNS_MAX,
  HEX_MAP_COLUMNS_MIN,
  HEX_MAP_FORCE_TYPES,
  HEX_MAP_HEX_SIZE_MAX,
  HEX_MAP_HEX_SIZE_MIN,
  HEX_MAP_MARKER_TYPES,
  HEX_MAP_ROWS_MAX,
  HEX_MAP_ROWS_MIN,
  HEX_MAP_SITE_CATEGORY_OPTIONS,
  HEX_MAP_ZOOM_MAX,
  HEX_MAP_ZOOM_MIN,
  clampHexMapViewport,
  getDefaultHexMarkerIconId,
  normalizeHexCoordinate,
} from "./hexmap";
import { KINGMAKER_EVENT_LIBRARY, KINGMAKER_EVENT_LIBRARY_VERSION } from "./kingmakerEventLibrary";

export const STORAGE_KEY = "kingmaker_companion_v1";
export const DEFAULT_PDF_FOLDER = "C:\\Users\\Chris Bender\\Downloads\\PathfinderKingmakerAdventurePathPDF-SingleFile";
export const KINGMAKER_DEFAULT_START_LABEL = "Restov charter issued";

export const SESSION_TYPE_OPTIONS = ["expedition", "travel", "settlement", "kingdom", "companion", "downtime", "crisis"];
export const SESSION_TYPE_LABELS = Object.freeze({
  expedition: "Expedition",
  travel: "Travel",
  settlement: "Settlement",
  kingdom: "Kingdom Turn",
  companion: "Companion Beat",
  downtime: "Downtime",
  crisis: "Crisis",
});
export const QUEST_STATUS_OPTIONS = ["open", "in-progress", "watch", "blocked", "completed", "failed"];
export const QUEST_PRIORITY_OPTIONS = ["Now", "Soon", "Later", "Someday"];
export const COMPANION_STATUS_OPTIONS = ["prospective", "recruited", "traveling", "kingdom-role", "departed"];
export const COMPANION_TRAVEL_STATE_OPTIONS = ["with-party", "at-camp", "at-settlement", "kingdom-duty", "scouting", "away"];
export const COMPANION_QUEST_STAGE_OPTIONS = ["seeded", "available", "active", "resolved", "declined"];
export const COMPANION_SPOTLIGHT_OPTIONS = ["low", "medium", "high", "urgent"];
export const EVENT_CATEGORY_OPTIONS = ["kingdom", "companion", "quest", "travel", "threat", "story"];
export const EVENT_STATUS_OPTIONS = ["seeded", "active", "escalated", "cooldown", "library", "resolved", "failed"];
export const EVENT_ADVANCE_OPTIONS = ["turn", "manual"];
export const EVENT_IMPACT_SCOPE_OPTIONS = ["always", "claimed-hex", "none"];
export const NPC_STATUS_OPTIONS = ["ally", "neutral", "watch", "rival", "hostile", "offstage", "departed"];
export const NPC_DISPOSITION_OPTIONS = ["helpful", "friendly", "indifferent", "unfriendly", "hostile"];
export const NPC_IMPORTANCE_OPTIONS = ["minor", "supporting", "major", "pillar"];
export const LOCATION_TYPE_OPTIONS = ["settlement", "landmark", "ruin", "lair", "route", "camp", "wilderness", "dungeon"];
export const LOCATION_STATUS_OPTIONS = ["active", "secured", "threatened", "unstable", "rumor", "cleared", "lost"];
export const CAPTURE_KIND_OPTIONS = ["Hook", "NPC", "Rule", "Loot", "Retcon", "Scene", "Combat", "Note"];
export const RULE_STORE_KIND_OPTIONS = ["accepted_ruling", "house_rule", "canon_memory", "official_note"];
export const RULE_STORE_KIND_LABELS = Object.freeze({
  accepted_ruling: "Accepted Ruling",
  house_rule: "House Rule",
  canon_memory: "Canon Memory",
  official_note: "Official Note",
});
export const DEFAULT_AI_CONFIG = Object.freeze({
  endpoint: "http://127.0.0.1:11434",
  model: "llama3.1:8b",
  temperature: 0.2,
  maxOutputTokens: 320,
  timeoutSec: 120,
  compactContext: true,
  autoRunTabs: true,
  usePdfContext: true,
  useAonRules: true,
  aiProfile: "fast",
});

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePdfSummaries(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    const fileKey = stringValue(key);
    if (!fileKey) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const summary = stringValue(value.summary).slice(0, 24000);
      if (!summary) continue;
      out[fileKey] = {
        fileName: stringValue(value.fileName) || fileKey,
        path: stringValue(value.path),
        summary,
        updatedAt: stringValue(value.updatedAt),
      };
      continue;
    }
    const summary = stringValue(value).slice(0, 24000);
    if (!summary) continue;
    out[fileKey] = {
      fileName: fileKey,
      path: "",
      summary,
      updatedAt: "",
    };
  }
  return out;
}

function normalizeHex(value) {
  return stringValue(value).replace(/\s+/g, "").toUpperCase();
}

function timestamp(value) {
  return stringValue(value) || new Date().toISOString();
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSessionType(value) {
  const normalized = stringValue(value).toLowerCase();
  return SESSION_TYPE_OPTIONS.includes(normalized) ? normalized : "expedition";
}

function normalizeQuestStatus(value) {
  const normalized = stringValue(value).toLowerCase();
  return QUEST_STATUS_OPTIONS.includes(normalized) ? normalized : "open";
}

function normalizeQuestPriority(value) {
  const normalized = stringValue(value);
  const matched = QUEST_PRIORITY_OPTIONS.find((option) => option.toLowerCase() === normalized.toLowerCase());
  return matched || "Soon";
}

function normalizeCompanionStatus(value) {
  const normalized = stringValue(value).toLowerCase();
  return COMPANION_STATUS_OPTIONS.includes(normalized) ? normalized : "prospective";
}

function normalizeCompanionTravelState(value) {
  const normalized = stringValue(value).toLowerCase();
  return COMPANION_TRAVEL_STATE_OPTIONS.includes(normalized) ? normalized : "with-party";
}

function normalizeCompanionQuestStage(value) {
  const normalized = stringValue(value).toLowerCase();
  return COMPANION_QUEST_STAGE_OPTIONS.includes(normalized) ? normalized : "seeded";
}

function normalizeCompanionSpotlight(value) {
  const normalized = stringValue(value).toLowerCase();
  return COMPANION_SPOTLIGHT_OPTIONS.includes(normalized) ? normalized : "medium";
}

function normalizeNpcStatus(value) {
  const normalized = stringValue(value).toLowerCase();
  return NPC_STATUS_OPTIONS.includes(normalized) ? normalized : "neutral";
}

function normalizeNpcDisposition(value) {
  const normalized = stringValue(value).toLowerCase();
  return NPC_DISPOSITION_OPTIONS.includes(normalized) ? normalized : "indifferent";
}

function normalizeNpcImportance(value) {
  const normalized = stringValue(value).toLowerCase();
  return NPC_IMPORTANCE_OPTIONS.includes(normalized) ? normalized : "supporting";
}

function normalizeLocationType(value) {
  const normalized = stringValue(value).toLowerCase();
  return LOCATION_TYPE_OPTIONS.includes(normalized) ? normalized : "landmark";
}

function normalizeLocationStatus(value) {
  const normalized = stringValue(value).toLowerCase();
  return LOCATION_STATUS_OPTIONS.includes(normalized) ? normalized : "active";
}

function normalizeEventStatus(value) {
  const normalized = stringValue(value).toLowerCase();
  return EVENT_STATUS_OPTIONS.includes(normalized) ? normalized : "seeded";
}

function normalizeEventCategory(value) {
  const normalized = stringValue(value).toLowerCase();
  return EVENT_CATEGORY_OPTIONS.includes(normalized) ? normalized : "story";
}

function normalizeEventAdvanceMode(value, fallback = "manual") {
  const normalized = stringValue(value).toLowerCase();
  return EVENT_ADVANCE_OPTIONS.includes(normalized) ? normalized : fallback;
}

function normalizeEventImpactScope(value, fallback = "none") {
  const normalized = stringValue(value).toLowerCase();
  return EVENT_IMPACT_SCOPE_OPTIONS.includes(normalized) ? normalized : fallback;
}

function normalizeCaptureKind(value) {
  const normalized = stringValue(value);
  const matched = CAPTURE_KIND_OPTIONS.find((option) => option.toLowerCase() === normalized.toLowerCase());
  return matched || "Note";
}

export function getSessionTypeLabel(value) {
  return SESSION_TYPE_LABELS[normalizeSessionType(value)] || "Expedition";
}

export function normalizeAiConfig(raw = {}) {
  const source = ensureObject(raw);
  const temperatureRaw = Number.parseFloat(String(source.temperature ?? DEFAULT_AI_CONFIG.temperature));
  const maxOutputTokensRaw = Number.parseInt(String(source.maxOutputTokens ?? DEFAULT_AI_CONFIG.maxOutputTokens), 10);
  const timeoutSecRaw = Number.parseInt(String(source.timeoutSec ?? DEFAULT_AI_CONFIG.timeoutSec), 10);

  return {
    endpoint: stringValue(source.endpoint) || DEFAULT_AI_CONFIG.endpoint,
    model: stringValue(source.model) || DEFAULT_AI_CONFIG.model,
    temperature: Number.isFinite(temperatureRaw) ? Math.max(0, Math.min(temperatureRaw, 2)) : DEFAULT_AI_CONFIG.temperature,
    maxOutputTokens: Number.isFinite(maxOutputTokensRaw)
      ? Math.max(64, Math.min(maxOutputTokensRaw, 2048))
      : DEFAULT_AI_CONFIG.maxOutputTokens,
    timeoutSec: Number.isFinite(timeoutSecRaw) ? Math.max(15, Math.min(timeoutSecRaw, 1200)) : DEFAULT_AI_CONFIG.timeoutSec,
    compactContext: source.compactContext === false ? false : true,
    autoRunTabs: source.autoRunTabs === false ? false : true,
    usePdfContext: source.usePdfContext === false ? false : true,
    useAonRules: source.useAonRules === false ? false : true,
    aiProfile: ["fast", "deep", "custom"].includes(stringValue(source.aiProfile).toLowerCase())
      ? stringValue(source.aiProfile).toLowerCase()
      : DEFAULT_AI_CONFIG.aiProfile,
  };
}

export function normalizeSessionRecord(raw = {}) {
  const source = ensureObject(raw);
  const createdAt = timestamp(source.createdAt);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    title: stringValue(source.title) || "Untitled Session",
    date: normalizeGolarionDate(source.date, KINGMAKER_DEFAULT_START_DATE),
    type: normalizeSessionType(source.type || (stringValue(source.kingdomTurn) ? "kingdom" : "expedition")),
    arc: stringValue(source.arc),
    chapter: stringValue(source.chapter),
    kingdomTurn: stringValue(source.kingdomTurn),
    focusHex: normalizeHex(source.focusHex || source.hex),
    leadCompanion: stringValue(source.leadCompanion),
    travelObjective: stringValue(source.travelObjective),
    weather: stringValue(source.weather),
    pressure: stringValue(source.pressure),
    summary: stringValue(source.summary),
    nextPrep: stringValue(source.nextPrep),
    createdAt,
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeQuestRecord(raw = {}) {
  const source = ensureObject(raw);
  const createdAt = timestamp(source.createdAt);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    title: stringValue(source.title) || "Untitled Quest",
    status: normalizeQuestStatus(source.status),
    objective: stringValue(source.objective),
    giver: stringValue(source.giver),
    folder: stringValue(source.folder),
    stakes: stringValue(source.stakes),
    priority: normalizeQuestPriority(source.priority),
    chapter: stringValue(source.chapter),
    hex: normalizeHex(source.hex),
    linkedCompanion: stringValue(source.linkedCompanion),
    linkedEvent: stringValue(source.linkedEvent),
    nextBeat: stringValue(source.nextBeat),
    blockers: stringValue(source.blockers),
    reward: stringValue(source.reward),
    notes: stringValue(source.notes),
    createdAt,
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeCompanionRecord(raw = {}) {
  const source = ensureObject(raw);
  const createdAt = timestamp(source.createdAt);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    name: stringValue(source.name) || "Unnamed Companion",
    status: normalizeCompanionStatus(source.status),
    influence: numberValue(source.influence, 0),
    currentHex: normalizeHex(source.currentHex),
    recruitment: stringValue(source.recruitment),
    influenceNotes: stringValue(source.influenceNotes),
    relationshipHooks: stringValue(source.relationshipHooks),
    friction: stringValue(source.friction),
    travelState: normalizeCompanionTravelState(source.travelState),
    campRole: stringValue(source.campRole),
    campNotes: stringValue(source.campNotes),
    kingdomRole: stringValue(source.kingdomRole),
    kingdomNotes: stringValue(source.kingdomNotes),
    personalQuest: stringValue(source.personalQuest),
    questStage: normalizeCompanionQuestStage(source.questStage),
    questTrigger: stringValue(source.questTrigger),
    nextScene: stringValue(source.nextScene),
    linkedQuest: stringValue(source.linkedQuest),
    linkedEvent: stringValue(source.linkedEvent),
    spotlight: normalizeCompanionSpotlight(source.spotlight),
    notes: stringValue(source.notes),
    folder: stringValue(source.folder),
    createdAt,
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeEventRecord(raw = {}) {
  const source = ensureObject(raw);
  const createdAt = timestamp(source.createdAt);
  const category = normalizeEventCategory(source.category);
  const status = normalizeEventStatus(source.status);
  const baseAdvanceOn = status === "active" || status === "escalated" || category === "kingdom" ? "turn" : "manual";
  const baseImpactScope = category === "kingdom" ? "always" : stringValue(source.hex) ? "claimed-hex" : "none";
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    title: stringValue(source.title) || "Untitled Event",
    category,
    status,
    urgency: Math.max(1, Math.min(5, numberValue(source.urgency, 3))),
    hex: normalizeHex(source.hex),
    linkedQuest: stringValue(source.linkedQuest),
    linkedCompanion: stringValue(source.linkedCompanion),
    trigger: stringValue(source.trigger),
    fallout: stringValue(source.fallout),
    consequenceSummary: stringValue(source.consequenceSummary),
    clock: Math.max(0, numberValue(source.clock, 0)),
    clockMax: Math.max(1, numberValue(source.clockMax, 4)),
    advancePerTurn: Math.max(0, numberValue(source.advancePerTurn, 1)),
    advanceOn: normalizeEventAdvanceMode(source.advanceOn || source.advanceMode, baseAdvanceOn),
    impactScope: normalizeEventImpactScope(source.impactScope, baseImpactScope),
    rpImpact: numberValue(source.rpImpact, 0),
    unrestImpact: numberValue(source.unrestImpact, 0),
    renownImpact: numberValue(source.renownImpact, 0),
    fameImpact: numberValue(source.fameImpact, 0),
    infamyImpact: numberValue(source.infamyImpact, 0),
    foodImpact: numberValue(source.foodImpact, 0),
    lumberImpact: numberValue(source.lumberImpact, 0),
    luxuriesImpact: numberValue(source.luxuriesImpact, 0),
    oreImpact: numberValue(source.oreImpact, 0),
    stoneImpact: numberValue(source.stoneImpact, 0),
    corruptionImpact: numberValue(source.corruptionImpact, 0),
    crimeImpact: numberValue(source.crimeImpact, 0),
    decayImpact: numberValue(source.decayImpact, 0),
    strifeImpact: numberValue(source.strifeImpact, 0),
    lastTriggeredAt: stringValue(source.lastTriggeredAt),
    lastTriggeredTurn: stringValue(source.lastTriggeredTurn),
    resolvedAt: stringValue(source.resolvedAt),
    notes: stringValue(source.notes),
    folder: stringValue(source.folder),
    createdAt,
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function buildEventLibraryKey(raw = {}) {
  const title = stringValue(raw.title).toLowerCase();
  const folder = stringValue(raw.folder).toLowerCase();
  return title ? `${title}::${folder}` : "";
}

function mergeKingmakerEventLibrary(rawEvents = []) {
  const normalizedEvents = ensureArray(rawEvents).map(normalizeEventRecord);
  const existingIds = new Set(normalizedEvents.map((entry) => stringValue(entry.id)).filter(Boolean));
  const existingKeys = new Set(normalizedEvents.map(buildEventLibraryKey).filter(Boolean));
  const merged = [...normalizedEvents];

  KINGMAKER_EVENT_LIBRARY.forEach((entry) => {
    const normalizedEntry = normalizeEventRecord(entry);
    const eventId = stringValue(normalizedEntry.id);
    const eventKey = buildEventLibraryKey(normalizedEntry);
    if ((eventId && existingIds.has(eventId)) || (eventKey && existingKeys.has(eventKey))) {
      return;
    }
    merged.push(normalizedEntry);
    if (eventId) existingIds.add(eventId);
    if (eventKey) existingKeys.add(eventKey);
  });

  return merged;
}

function normalizeNpcRecord(raw = {}) {
  const source = ensureObject(raw);
  const createdAt = timestamp(source.createdAt);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    name: stringValue(source.name) || "Unnamed NPC",
    role: stringValue(source.role),
    faction: stringValue(source.faction),
    status: normalizeNpcStatus(source.status),
    disposition: normalizeNpcDisposition(source.disposition),
    importance: normalizeNpcImportance(source.importance),
    creatureLevel: numberValue(source.creatureLevel, 0),
    location: stringValue(source.location),
    hex: normalizeHex(source.hex),
    agenda: stringValue(source.agenda),
    leverage: stringValue(source.leverage),
    pressure: stringValue(source.pressure),
    firstImpression: stringValue(source.firstImpression),
    rumor: stringValue(source.rumor),
    secret: stringValue(source.secret),
    nextScene: stringValue(source.nextScene),
    linkedQuest: stringValue(source.linkedQuest),
    linkedEvent: stringValue(source.linkedEvent),
    kingdomRole: stringValue(source.kingdomRole),
    kingdomNotes: stringValue(source.kingdomNotes),
    notes: stringValue(source.notes),
    folder: stringValue(source.folder),
    createdAt,
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeLocationRecord(raw = {}) {
  const source = ensureObject(raw);
  const createdAt = timestamp(source.createdAt);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    name: stringValue(source.name) || "Unnamed Location",
    type: normalizeLocationType(source.type),
    status: normalizeLocationStatus(source.status),
    hex: normalizeHex(source.hex),
    controllingFaction: stringValue(source.controllingFaction),
    linkedQuest: stringValue(source.linkedQuest),
    linkedEvent: stringValue(source.linkedEvent),
    linkedNpc: stringValue(source.linkedNpc),
    folder: stringValue(source.folder),
    whatChanged: stringValue(source.whatChanged),
    sceneTexture: stringValue(source.sceneTexture),
    opportunities: stringValue(source.opportunities),
    risks: stringValue(source.risks),
    rumor: stringValue(source.rumor),
    notes: stringValue(source.notes),
    createdAt,
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

export function normalizeCaptureEntry(raw = {}) {
  const source = ensureObject(raw);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    kind: normalizeCaptureKind(source.kind),
    note: stringValue(source.note || source.text),
    sessionId: stringValue(source.sessionId),
    timestamp: timestamp(source.timestamp || source.createdAt),
  };
}

export function normalizeRulesStoreEntry(raw = {}) {
  const source = ensureObject(raw);
  const kindRaw = stringValue(source.kind).toLowerCase();
  const kind = RULE_STORE_KIND_OPTIONS.includes(kindRaw) ? kindRaw : "accepted_ruling";
  const text = stringValue(source.text || source.body || source.note).slice(0, 8000);
  const title = stringValue(source.title || text.split(/\r?\n+/)[0]).slice(0, 180) || "Saved Rule Entry";
  const tags = Array.isArray(source.tags)
    ? source.tags
    : stringValue(source.tags)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

  return {
    ...source,
    id: stringValue(source.id) || uid(),
    title,
    kind,
    text,
    sourceTitle: stringValue(source.sourceTitle),
    sourceUrl: stringValue(source.sourceUrl),
    sourceOrigin: stringValue(source.sourceOrigin),
    tags: [...new Set(tags.map((entry) => stringValue(entry).toLowerCase()).filter(Boolean))].slice(0, 12),
    createdAt: timestamp(source.createdAt),
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

export function normalizeRulesStore(rawStore) {
  return ensureArray(rawStore).map(normalizeRulesStoreEntry).filter((entry) => entry.text);
}

function normalizeKingdomLeader(raw = {}) {
  const source = ensureObject(raw);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    role: stringValue(source.role),
    name: stringValue(source.name),
    type: stringValue(source.type),
    leadershipBonus: numberValue(source.leadershipBonus, 0),
    relevantSkills: stringValue(source.relevantSkills),
    specializedSkills: stringValue(source.specializedSkills),
    notes: stringValue(source.notes),
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeKingdomSettlement(raw = {}) {
  const source = ensureObject(raw);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    name: stringValue(source.name),
    size: stringValue(source.size),
    influence: numberValue(source.influence, 0),
    civicStructure: stringValue(source.civicStructure),
    resourceDice: numberValue(source.resourceDice, 0),
    consumption: numberValue(source.consumption, 0),
    notes: stringValue(source.notes),
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeKingdomRegion(raw = {}) {
  const source = ensureObject(raw);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    hex: normalizeHex(source.hex),
    status: stringValue(source.status),
    terrain: stringValue(source.terrain),
    siteCategory: HEX_MAP_SITE_CATEGORY_OPTIONS.includes(stringValue(source.siteCategory)) ? stringValue(source.siteCategory) : "",
    workSite: stringValue(source.workSite),
    discovery: stringValue(source.discovery),
    kingdomValue: stringValue(source.kingdomValue),
    danger: stringValue(source.danger),
    improvement: stringValue(source.improvement),
    rumor: stringValue(source.rumor),
    notes: stringValue(source.notes),
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeKingdomTurn(raw = {}) {
  const source = ensureObject(raw);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    title: stringValue(source.title),
    date: normalizeGolarionDate(source.date, KINGMAKER_DEFAULT_START_DATE),
    summary: stringValue(source.summary),
    risks: stringValue(source.risks),
    eventSummary: stringValue(source.eventSummary),
    resourceDelta: numberValue(source.resourceDelta ?? source.rpDelta, 0),
    rpDelta: numberValue(source.rpDelta ?? source.resourceDelta, 0),
    unrestDelta: numberValue(source.unrestDelta, 0),
    renownDelta: numberValue(source.renownDelta, 0),
    fameDelta: numberValue(source.fameDelta, 0),
    infamyDelta: numberValue(source.infamyDelta, 0),
    foodDelta: numberValue(source.foodDelta, 0),
    lumberDelta: numberValue(source.lumberDelta, 0),
    luxuriesDelta: numberValue(source.luxuriesDelta, 0),
    oreDelta: numberValue(source.oreDelta, 0),
    stoneDelta: numberValue(source.stoneDelta, 0),
    corruptionDelta: numberValue(source.corruptionDelta, 0),
    crimeDelta: numberValue(source.crimeDelta, 0),
    decayDelta: numberValue(source.decayDelta, 0),
    strifeDelta: numberValue(source.strifeDelta, 0),
    pendingProject: stringValue(source.pendingProject),
    notes: stringValue(source.notes),
    updatedAt: timestamp(source.updatedAt || source.createdAt),
  };
}

function normalizeKingdomEventHistory(raw = {}) {
  const source = ensureObject(raw);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    eventId: stringValue(source.eventId),
    eventTitle: stringValue(source.eventTitle),
    type: stringValue(source.type),
    turnTitle: stringValue(source.turnTitle),
    hex: normalizeHex(source.hex),
    summary: stringValue(source.summary),
    impactApplied: source.impactApplied === true,
    at: timestamp(source.at || source.createdAt),
  };
}

function normalizeCalendarEntry(raw = {}) {
  const source = ensureObject(raw);
  const startDate = normalizeGolarionDate(source.startDate || source.date, KINGMAKER_DEFAULT_START_DATE);
  const endDate = normalizeGolarionDate(source.endDate || source.date || startDate, startDate);
  return {
    ...source,
    id: stringValue(source.id) || uid(),
    startDate,
    endDate,
    date: normalizeGolarionDate(source.date || endDate, endDate),
    daysAdvanced: Math.max(0, numberValue(source.daysAdvanced, 0)),
    label: stringValue(source.label),
    notes: stringValue(source.notes),
    source: stringValue(source.source) || "manual",
    createdAt: timestamp(source.createdAt || source.date),
  };
}

export function createStarterKingdomState() {
  return {
    profileId: "vk-remastered-stacked",
    name: "Stolen Lands Expedition",
    charter: "Open charter",
    government: "Council",
    heartland: "Grassland",
    capital: "Not Founded Yet",
    currentTurnLabel: "Turn 1",
    currentDate: KINGMAKER_DEFAULT_START_DATE,
    calendarStartDate: KINGMAKER_DEFAULT_START_DATE,
    calendarAnchorLabel: KINGMAKER_DEFAULT_START_LABEL,
    level: 1,
    size: 1,
    controlDC: 14,
    resourceDie: "d4",
    resourcePoints: 0,
    xp: 0,
    abilities: {
      culture: 0,
      economy: 0,
      loyalty: 0,
      stability: 0,
    },
    commodities: {
      food: 0,
      lumber: 0,
      luxuries: 0,
      ore: 0,
      stone: 0,
    },
    consumption: 0,
    renown: 1,
    fame: 0,
    infamy: 0,
    unrest: 0,
    ruin: {
      corruption: 0,
      crime: 0,
      decay: 0,
      strife: 0,
      threshold: 5,
    },
    notes: "Track charter progress, leadership assignments, and monthly kingdom fallout here.",
    leaders: [
      {
        id: uid(),
        role: "Ruler",
        name: "Choose the party ruler",
        type: "PC",
        leadershipBonus: 1,
        relevantSkills: "Diplomacy, Politics Lore",
        specializedSkills: "Industry, Politics, Statecraft",
        notes: "Assign once the table decides who speaks for the charter.",
      },
    ],
    settlements: [
      {
        id: uid(),
        name: "Future Capital Site",
        size: "Village",
        influence: 1,
        civicStructure: "Town Hall",
        resourceDice: 0,
        consumption: 0,
        notes: "Replace this once the party chooses and founds the capital.",
      },
    ],
    regions: [
      {
        id: uid(),
        hex: "D4",
        status: "Claimed",
        terrain: "Plains",
        siteCategory: "Landmark",
        workSite: "",
        discovery: "Oleg's Trading Post",
        kingdomValue: "Trade hub, rumor engine, and the first stable supply point.",
        danger: "Bandit pressure",
        improvement: "",
        rumor: "The Thorn River bandits keep testing the outpost to see whether the new charter can hold ground.",
        notes: "Starting heartland.",
      },
    ],
    turns: [],
    eventHistory: [],
    calendarHistory: [
      {
        id: uid(),
        startDate: KINGMAKER_DEFAULT_START_DATE,
        endDate: KINGMAKER_DEFAULT_START_DATE,
        date: KINGMAKER_DEFAULT_START_DATE,
        daysAdvanced: 0,
        label: KINGMAKER_DEFAULT_START_LABEL,
        notes: "Lady Jamandi Aldori issues the expedition charter and sends the party toward Oleg's Trading Post.",
        source: "campaign-start",
        createdAt: new Date().toISOString(),
      },
    ],
    pendingProjects: [
      "Choose the full leadership slate.",
      "Lock the charter, government, and heartland package.",
      "Replace the placeholder capital entry once the first settlement is founded.",
    ],
  };
}

function normalizeKingdomState(raw = {}) {
  const base = createStarterKingdomState();
  const source = ensureObject(raw);

  return {
    ...base,
    ...source,
    name: stringValue(source.name) || base.name,
    charter: stringValue(source.charter) || base.charter,
    government: stringValue(source.government) || base.government,
    heartland: stringValue(source.heartland) || base.heartland,
    capital: stringValue(source.capital) || base.capital,
    currentTurnLabel: stringValue(source.currentTurnLabel) || base.currentTurnLabel,
    currentDate: normalizeGolarionDate(source.currentDate || source.calendarStartDate, base.currentDate),
    calendarStartDate: normalizeGolarionDate(source.calendarStartDate || source.currentDate, base.calendarStartDate),
    calendarAnchorLabel: stringValue(source.calendarAnchorLabel) || base.calendarAnchorLabel,
    level: Math.max(1, numberValue(source.level, base.level)),
    size: Math.max(1, numberValue(source.size, base.size)),
    controlDC: Math.max(10, numberValue(source.controlDC, base.controlDC)),
    resourceDie: stringValue(source.resourceDie) || base.resourceDie,
    resourcePoints: numberValue(source.resourcePoints, base.resourcePoints),
    xp: numberValue(source.xp, base.xp),
    abilities: {
      culture: numberValue(source.abilities?.culture, base.abilities.culture),
      economy: numberValue(source.abilities?.economy, base.abilities.economy),
      loyalty: numberValue(source.abilities?.loyalty, base.abilities.loyalty),
      stability: numberValue(source.abilities?.stability, base.abilities.stability),
    },
    commodities: {
      food: numberValue(source.commodities?.food, base.commodities.food),
      lumber: numberValue(source.commodities?.lumber, base.commodities.lumber),
      luxuries: numberValue(source.commodities?.luxuries, base.commodities.luxuries),
      ore: numberValue(source.commodities?.ore, base.commodities.ore),
      stone: numberValue(source.commodities?.stone, base.commodities.stone),
    },
    consumption: numberValue(source.consumption, base.consumption),
    renown: numberValue(source.renown, base.renown),
    fame: numberValue(source.fame, base.fame),
    infamy: numberValue(source.infamy, base.infamy),
    unrest: numberValue(source.unrest, base.unrest),
    ruin: {
      corruption: numberValue(source.ruin?.corruption, base.ruin.corruption),
      crime: numberValue(source.ruin?.crime, base.ruin.crime),
      decay: numberValue(source.ruin?.decay, base.ruin.decay),
      strife: numberValue(source.ruin?.strife, base.ruin.strife),
      threshold: Math.max(1, numberValue(source.ruin?.threshold, base.ruin.threshold)),
    },
    notes: stringValue(source.notes) || base.notes,
    leaders: ensureArray(source.leaders).map(normalizeKingdomLeader),
    settlements: ensureArray(source.settlements).map(normalizeKingdomSettlement),
    regions: ensureArray(source.regions).map(normalizeKingdomRegion),
    turns: ensureArray(source.turns).map(normalizeKingdomTurn),
    eventHistory: ensureArray(source.eventHistory).map(normalizeKingdomEventHistory),
    calendarHistory: ensureArray(source.calendarHistory).length
      ? ensureArray(source.calendarHistory).map(normalizeCalendarEntry)
      : base.calendarHistory.map(normalizeCalendarEntry),
    pendingProjects: ensureArray(source.pendingProjects).map(stringValue).filter(Boolean),
  };
}

function normalizeMetaState(raw = {}) {
  const source = ensureObject(raw);
  const obsidian = ensureObject(source.obsidian);
  return {
    ...source,
    campaignName: stringValue(source.campaignName) || "Kingmaker",
    createdAt: timestamp(source.createdAt),
    pdfFolder: stringValue(source.pdfFolder) || DEFAULT_PDF_FOLDER,
    pdfIndexedAt: stringValue(source.pdfIndexedAt),
    pdfIndexedCount: Math.max(0, numberValue(source.pdfIndexedCount, 0)),
    pdfIndexedFiles: ensureArray(source.pdfIndexedFiles),
    pdfSummaries: normalizePdfSummaries(source.pdfSummaries),
    aiConfig: normalizeAiConfig(source.aiConfig),
    aiHistory: ensureArray(source.aiHistory),
    aiMemory: ensureObject(source.aiMemory),
    obsidian: {
      vaultPath: stringValue(obsidian.vaultPath),
      baseFolder: stringValue(obsidian.baseFolder) || "Kingmaker Companion",
      lastSyncAt: stringValue(obsidian.lastSyncAt),
      lastSyncSummary: stringValue(obsidian.lastSyncSummary),
      looksLikeVault: obsidian.looksLikeVault === true,
      useForAiContext: obsidian.useForAiContext !== false,
      readWholeVault: obsidian.readWholeVault !== false,
      aiContextNoteLimit: Math.max(1, numberValue(obsidian.aiContextNoteLimit, 6)),
      aiContextCharLimit: Math.max(800, numberValue(obsidian.aiContextCharLimit, 3600)),
      aiWriteFolder: stringValue(obsidian.aiWriteFolder) || "AI Notes",
      lastAiNoteAt: stringValue(obsidian.lastAiNoteAt),
      lastAiNotePath: stringValue(obsidian.lastAiNotePath),
    },
  };
}

function normalizeHexMapState(raw = {}) {
  const source = ensureObject(raw);
  const party = ensureObject(source.party);
  const viewport = clampHexMapViewport(source);
  const columns = Math.max(HEX_MAP_COLUMNS_MIN, Math.min(HEX_MAP_COLUMNS_MAX, numberValue(source.columns, 12) || 12));
  const rows = Math.max(HEX_MAP_ROWS_MIN, Math.min(HEX_MAP_ROWS_MAX, numberValue(source.rows, 10) || 10));
  const normalizeTrailEntry = (entry) => {
    if (typeof entry === "string") {
      return {
        hex: normalizeHexCoordinate(entry, columns, rows),
        at: "",
      };
    }
    const sourceEntry = ensureObject(entry);
    return {
      hex: normalizeHexCoordinate(sourceEntry.hex, columns, rows),
      at: stringValue(sourceEntry.at),
    };
  };

  return {
    ...source,
    mapName: stringValue(source.mapName) || "Stolen Lands Atlas",
    columns,
    rows,
    hexSize: Math.max(HEX_MAP_HEX_SIZE_MIN, Math.min(HEX_MAP_HEX_SIZE_MAX, numberValue(source.hexSize, 54) || 54)),
    zoom: Math.max(HEX_MAP_ZOOM_MIN, Math.min(HEX_MAP_ZOOM_MAX, viewport.zoom || 1)),
    panX: viewport.panX,
    panY: viewport.panY,
    showLabels: source.showLabels !== false,
    darkBoard: source.darkBoard !== false,
    backgroundPath: stringValue(source.backgroundPath),
    backgroundUrl: stringValue(source.backgroundUrl),
    backgroundName: stringValue(source.backgroundName),
    backgroundNaturalWidth: Math.max(0, numberValue(source.backgroundNaturalWidth, 0)),
    backgroundNaturalHeight: Math.max(0, numberValue(source.backgroundNaturalHeight, 0)),
    backgroundOpacity: Math.max(0, Math.min(0.95, numberValue(source.backgroundOpacity, 0.78) || 0.78)),
    backgroundScale: Math.max(
      HEX_MAP_BACKGROUND_SCALE_MIN,
      Math.min(HEX_MAP_BACKGROUND_SCALE_MAX, numberValue(source.backgroundScale, 1) || 1)
    ),
    backgroundOffsetX: numberValue(source.backgroundOffsetX, 0),
    backgroundOffsetY: numberValue(source.backgroundOffsetY, 0),
    gridFillOpacity: Math.max(0, Math.min(0.65, numberValue(source.gridFillOpacity, 0.32) || 0.32)),
    gridLineOpacity: Math.max(0.15, Math.min(1, numberValue(source.gridLineOpacity, 0.54) || 0.54)),
    partyMoveMode: source.partyMoveMode === true,
    party: {
      ...party,
      hex: normalizeHexCoordinate(party.hex || "D4", columns, rows),
      label: stringValue(party.label || "Charter Party"),
      notes: stringValue(party.notes),
      updatedAt: stringValue(party.updatedAt),
      trail: ensureArray(party.trail)
        .map(normalizeTrailEntry)
        .filter((entry) => entry.hex)
        .slice(0, 30),
    },
    forces: ensureArray(source.forces)
      .map((force) => {
        const sourceForce = ensureObject(force);
        return {
          ...sourceForce,
          id: stringValue(sourceForce.id) || uid(),
          hex: normalizeHexCoordinate(sourceForce.hex, columns, rows),
          type: HEX_MAP_FORCE_TYPES.includes(stringValue(sourceForce.type)) ? stringValue(sourceForce.type) : "Allied Force",
          name: stringValue(sourceForce.name) || "Unnamed force",
          notes: stringValue(sourceForce.notes),
          updatedAt: stringValue(sourceForce.updatedAt || sourceForce.createdAt),
        };
      })
      .filter((force) => force.hex),
    markers: ensureArray(source.markers)
      .map((marker) => {
        const sourceMarker = ensureObject(marker);
        const type = HEX_MAP_MARKER_TYPES.includes(stringValue(sourceMarker.type)) ? stringValue(sourceMarker.type) : "Note";
        return {
          ...sourceMarker,
          id: stringValue(sourceMarker.id) || uid(),
          hex: normalizeHexCoordinate(sourceMarker.hex, columns, rows),
          type,
          icon: stringValue(sourceMarker.icon) || getDefaultHexMarkerIconId(type),
          title: stringValue(sourceMarker.title),
          notes: stringValue(sourceMarker.notes),
          updatedAt: stringValue(sourceMarker.updatedAt || sourceMarker.createdAt),
        };
      })
      .filter((marker) => marker.hex),
  };
}

export function createStarterState() {
  return {
    meta: normalizeMetaState({
      campaignName: "Kingmaker",
      createdAt: new Date().toISOString(),
      eventLibraryVersion: KINGMAKER_EVENT_LIBRARY_VERSION,
      pdfFolder: DEFAULT_PDF_FOLDER,
      pdfIndexedAt: "",
      pdfIndexedCount: 0,
      pdfIndexedFiles: [],
      pdfSummaries: {},
      aiConfig: DEFAULT_AI_CONFIG,
      aiHistory: [],
      aiMemory: {
        campaignSummary: "",
        recentSessionSummary: "",
        activeQuestsSummary: "",
        activeEntitiesSummary: "",
        canonSummary: "",
        rulingsDigest: "",
        manualRulings: "",
        updatedAt: "",
      },
    }),
    rulesStore: [],
    sessions: [
      normalizeSessionRecord({
        id: uid(),
        title: "Session 00 - Jamandi's Charter",
        date: KINGMAKER_DEFAULT_START_DATE,
        type: "expedition",
        arc: "Stolen Lands Opening",
        chapter: "Chapter 1: A Call for Heroes",
        focusHex: "A1",
        leadCompanion: "Linzi",
        travelObjective: "Reach Oleg's Trading Post, decide the first Greenbelt route, and learn what the bandits have already taken.",
        weather: "Late Calistril roads are cold, muddy, and still dangerous to camp on carelessly.",
        pressure: "The Thorn River bandits keep harassing Oleg's supply line until the charter party takes the field.",
        summary: "The party earned a charter from Lady Jamandi Aldori and now heads toward Oleg's Trading Post to begin taming the Greenbelt.",
        nextPrep: "Prepare Oleg and Svetlana, early bandit pressure, Greenbelt rumor threads, and the first exploration choices.",
      }),
    ],
    companions: [
      normalizeCompanionRecord({
        id: uid(),
        name: "Linzi",
        status: "prospective",
        influence: 2,
        currentHex: "A1",
        recruitment: "Met at Jamandi Aldori's feast and immediately started taking notes on the charter party.",
        influenceNotes: "Responds well to bold, hopeful action and to choices that create a good story worth preserving.",
        relationshipHooks: "Wants to chronicle heroes, chase rumors, and keep morale from collapsing on hard travel days.",
        friction: "Loses confidence if the party becomes cruel, cynical, or too passive in the face of frontier suffering.",
        travelState: "with-party",
        campRole: "Storykeeper and morale anchor",
        campNotes: "Ideal for rumor review, recaps, and light camp scenes after travel pressure spikes.",
        kingdomRole: "Chronicler",
        kingdomNotes: "Best used to turn discoveries, treaties, and public wins into momentum for the young kingdom.",
        personalQuest: "Prove the charter party is worth immortalizing in song and story.",
        questStage: "seeded",
        questTrigger: "Advance once the party begins building a public reputation worth writing about.",
        nextScene: "Give Linzi one scene where she reframes danger as a story the kingdom will remember.",
        linkedQuest: "",
        linkedEvent: "Jamandi Wants Results",
        spotlight: "high",
        notes: "Excellent early morale engine and a natural bridge between session notes, rumors, and companion scenes.",
        folder: "Core Companions",
      }),
      normalizeCompanionRecord({
        id: uid(),
        name: "Amiri",
        status: "prospective",
        influence: 1,
        currentHex: "D4",
        recruitment: "Best introduced through direct, practical action rather than courtly talk.",
        influenceNotes: "Respects decisiveness, courage, and visible strength more than politicking.",
        relationshipHooks: "Excels when the frontier pushes back and someone needs to meet violence head on.",
        friction: "Turns cold if the party dithers, postures, or hides behind procedure while people suffer.",
        travelState: "scouting",
        campRole: "Outer watch and threat response",
        campNotes: "Useful to frame predatory signs, hostile tracks, and who is willing to stand first watch.",
        kingdomRole: "General candidate",
        kingdomNotes: "Strong military face for a kingdom that must prove it can hold its borders.",
        personalQuest: "Find something in the Stolen Lands worth fighting for beyond simple survival.",
        questStage: "seeded",
        questTrigger: "Push when the party starts finding causes worth defending, not just enemies worth killing.",
        nextScene: "Let Amiri challenge the group to define what this charter is actually for.",
        linkedQuest: "Secure Oleg's Trading Post",
        linkedEvent: "First Bandit Collection Run",
        spotlight: "medium",
        notes: "Strong fit for early frontier pressure, combat fallout, and later kingdom military roles.",
        folder: "Kingdom Roles",
      }),
    ],
    events: KINGMAKER_EVENT_LIBRARY.map(normalizeEventRecord),
    npcs: [
      normalizeNpcRecord({
        id: uid(),
        name: "Jamandi Aldori",
        role: "Patron",
        faction: "Restov Swordlords",
        status: "ally",
        disposition: "helpful",
        importance: "pillar",
        creatureLevel: 10,
        location: "Restov",
        hex: "A1",
        agenda: "Turn the charter into visible frontier progress without letting the Greenbelt embarrass Restov.",
        leverage: "Charter authority, prestige, and the ability to open or close doors in Brevoy.",
        pressure: "Needs fast proof that this expedition was worth backing.",
        firstImpression: "Composed, dangerous, and measuring every answer for weakness.",
        rumor: "Some in Restov think she chose this charter party because conventional methods were already failing.",
        secret: "She is testing whether the party can succeed where better-resourced rivals stalled.",
        nextScene: "Call in a political favor, demand proof of progress, or pressure the party after a public setback.",
        kingdomRole: "Royal patron and political benchmark",
        kingdomNotes: "Her opinion colors how later nobles interpret the kingdom's legitimacy.",
        notes: "Initial authority behind the charter and an enduring political benchmark.",
        folder: "Restov",
      }),
      normalizeNpcRecord({
        id: uid(),
        name: "Oleg Leveton",
        role: "Outpost owner",
        faction: "Oleg's Trading Post",
        status: "ally",
        disposition: "friendly",
        importance: "major",
        creatureLevel: 1,
        location: "Oleg's Trading Post",
        hex: "D4",
        agenda: "Keep the trading post standing long enough to become useful again instead of a bandit feeding trough.",
        leverage: "Local logistics, honest rumors, and a blunt sense of what the frontier actually costs.",
        pressure: "Bandit tribute and repeated fear are wearing his patience thin.",
        firstImpression: "Tired, suspicious, and relieved if the party looks competent.",
        rumor: "He knows exactly which local names go quiet whenever the bandits are near.",
        secret: "He has already done what he had to do to keep the outpost alive and hates how normal that felt.",
        nextScene: "Supply complaint, rumor handoff, or practical warning about what the party is missing.",
        linkedQuest: "Secure Oleg's Trading Post",
        linkedEvent: "First Bandit Collection Run",
        kingdomRole: "Trading post logistics anchor",
        kingdomNotes: "A stable Oleg means stable rumors, supply lines, and a believable frontier foothold.",
        notes: "The party's first real read on frontier pressure and who the bandits are hurting.",
        folder: "Greenbelt",
      }),
      normalizeNpcRecord({
        id: uid(),
        name: "Svetlana Leveton",
        role: "Trading post co-owner",
        faction: "Oleg's Trading Post",
        status: "ally",
        disposition: "friendly",
        importance: "supporting",
        creatureLevel: 1,
        location: "Oleg's Trading Post",
        hex: "D4",
        agenda: "Keep the people around the post fed, steady, and willing to believe tomorrow can improve.",
        leverage: "Hospitality, practical memory, and a clearer read on fragile morale than most armed NPCs.",
        pressure: "The outpost cannot take many more small losses without people giving up.",
        firstImpression: "Warmer than Oleg, but no less aware of how close things are to breaking.",
        rumor: "She hears who is desperate before they are ready to admit it out loud.",
        secret: "She is already planning what has to be abandoned first if the post falls.",
        nextScene: "Quiet morale check, plea for help, or grounded account of what the bandits changed.",
        linkedQuest: "Secure Oleg's Trading Post",
        kingdomRole: "Community pulse",
        kingdomNotes: "Her read on trust and exhaustion tells you whether the frontier feels protected or merely occupied.",
        notes: "Useful for human-scale fallout and the emotional cost of frontier pressure.",
        folder: "Greenbelt",
      }),
      normalizeNpcRecord({
        id: uid(),
        name: "Kesten Garess",
        role: "Swordlord agent",
        faction: "Restov Swordlords",
        status: "watch",
        disposition: "indifferent",
        importance: "major",
        creatureLevel: 4,
        location: "Greenbelt road",
        hex: "D4",
        agenda: "Restore order with visible force before frontier disorder becomes political humiliation.",
        leverage: "Armed authority, trained guards, and a low tolerance for excuses.",
        pressure: "He reads delays as weakness and weakness as an invitation to escalate.",
        firstImpression: "Capable, impatient, and easier to respect than to like.",
        rumor: "Some think he would rather command than cooperate if given the excuse.",
        secret: "He is balancing duty, pride, and real concern more awkwardly than he wants anyone to notice.",
        nextScene: "Demand a harder response, offer tactical help, or challenge a soft-handed plan.",
        linkedQuest: "Secure Oleg's Trading Post",
        linkedEvent: "Jamandi Wants Results",
        kingdomRole: "Potential military hardliner",
        kingdomNotes: "He is a future test case for how the kingdom handles force, legitimacy, and command.",
        notes: "Use when the campaign needs steel, scrutiny, or a sharper idea of frontier order.",
        folder: "Greenbelt",
      }),
    ],
    quests: [
      normalizeQuestRecord({
        id: uid(),
        title: "Secure Oleg's Trading Post",
        status: "open",
        objective: "End the immediate bandit threat and turn the trading post into a dependable expedition base.",
        giver: "Lady Jamandi Aldori",
        folder: "Greenbelt",
        stakes: "If the trading post falls, the charter starts from a position of weakness.",
        priority: "Now",
        chapter: "Chapter 1: A Call for Heroes",
        hex: "D4",
        linkedEvent: "First Bandit Collection Run",
        nextBeat: "Let the bandits make one visible move so the players feel the clock before they answer it.",
        blockers: "The party still lacks a full read on the bandit routine, local morale, and how close Oleg is to breaking.",
        reward: "A secure supply hub, local trust, and a stable launch point for later hexploration.",
        notes: "This is the first quest that teaches the party the charter only matters if they can visibly protect real people.",
      }),
      normalizeQuestRecord({
        id: uid(),
        title: "Map the Greenbelt",
        status: "open",
        objective: "Explore nearby hexes, identify threats and opportunities, and build the expedition's first reliable route map.",
        giver: "Oleg Leveton",
        folder: "Exploration",
        stakes: "Without local map knowledge, every later kingdom decision stays reactive.",
        priority: "Soon",
        chapter: "Chapter 2: Into the Wild",
        hex: "D4",
        linkedCompanion: "Linzi",
        linkedEvent: "Jamandi Wants Results",
        nextBeat: "Turn the next expedition leg into a choice between safety, speed, and rumor value.",
        blockers: "Too little local intel means every route choice still carries avoidable risk.",
        reward: "Reliable routes, discovered opportunities, and fewer reactive kingdom turns later.",
        notes: "Keep this as the long-haul exploration spine behind the shorter crisis quests.",
      }),
    ],
    locations: [
      normalizeLocationRecord({
        id: uid(),
        name: "Oleg's Trading Post",
        type: "settlement",
        status: "threatened",
        hex: "D4",
        controllingFaction: "Oleg's Trading Post",
        linkedQuest: "Secure Oleg's Trading Post",
        linkedEvent: "First Bandit Collection Run",
        linkedNpc: "Oleg Leveton",
        folder: "Greenbelt",
        whatChanged: "Established as the expedition's first stable frontier foothold.",
        sceneTexture: "Timber walls, anxious merchants, and the feeling that every quiet hour was recently bought at a price.",
        opportunities: "Rumor intake, supply resets, local trust building, and the first durable base of operations.",
        risks: "Bandit retaliation, morale collapse, and overconfidence if the party mistakes a foothold for safety.",
        rumor: "The trading post hears who is scared before the frontier has words for why.",
        notes: "Use as the early campaign hub for rumors, supply issues, and fallout from bandit pressure.",
      }),
      normalizeLocationRecord({
        id: uid(),
        name: "Restov",
        type: "settlement",
        status: "active",
        hex: "A1",
        controllingFaction: "Restov Swordlords",
        linkedNpc: "Jamandi Aldori",
        folder: "Restov",
        whatChanged: "The party's charter was issued here and the political stakes were set.",
        sceneTexture: "Polished steel, public grace, and the sense that every favor is being counted.",
        opportunities: "Political callbacks, patrons, reinforcements, and later legitimacy scenes.",
        risks: "Brevic scrutiny, conflicting agendas, and anyone trying to reframe the party's success as someone else's leverage.",
        rumor: "Every frontier failure eventually becomes a city conversation here.",
        notes: "Best place to attach Brevic politics, Aldori obligations, and future diplomatic callbacks.",
      }),
    ],
    kingdom: createStarterKingdomState(),
    hexMap: normalizeHexMapState({
      mapName: "Stolen Lands Atlas",
      columns: 12,
      rows: 10,
      hexSize: 58,
      zoom: 1,
      panX: 0,
      panY: 0,
      showLabels: true,
      darkBoard: true,
      backgroundPath: "",
      backgroundUrl: "",
      backgroundName: "",
      backgroundNaturalWidth: 0,
      backgroundNaturalHeight: 0,
      backgroundOpacity: 0.78,
      backgroundScale: 1,
      backgroundOffsetX: 0,
      backgroundOffsetY: 0,
      gridFillOpacity: 0.32,
      gridLineOpacity: 0.54,
      party: {
        hex: "D4",
        label: "Charter Party",
        notes: "Based out of Oleg's Trading Post while the first Greenbelt routes are being mapped.",
        trail: [
          { hex: "A1", at: "" },
          { hex: "D4", at: "" },
        ],
      },
      forces: [
        {
          id: uid(),
          hex: "E4",
          type: "Enemy Force",
          name: "Bandit Scouts",
          notes: "Testing the trading post's defenses before the next tribute run.",
          updatedAt: new Date().toISOString(),
        },
      ],
      markers: [
        {
          id: uid(),
          hex: "D4",
          type: "Settlement",
          icon: "house",
          title: "Oleg's Trading Post",
          notes: "Starting hub for rumors, supplies, and the charter's first visible foothold.",
          updatedAt: new Date().toISOString(),
        },
        {
          id: uid(),
          hex: "D4",
          type: "Danger",
          icon: "danger",
          title: "Tribute Pressure",
          notes: "The bandits expect payment soon and escalate if the outpost resists.",
          updatedAt: new Date().toISOString(),
        },
        {
          id: uid(),
          hex: "A1",
          type: "Settlement",
          icon: "capital",
          title: "Restov",
          notes: "Jamandi's charter origin and the expedition's political backer.",
          updatedAt: new Date().toISOString(),
        },
      ],
    }),
    liveCapture: [],
  };
}

export function normalizeCampaignState(raw = {}) {
  const source = ensureObject(raw);
  const starter = createStarterState();
  const sourceMeta = ensureObject(source.meta);
  const sourceEvents = ensureArray(source.events);
  const shouldSeedEventLibrary = stringValue(sourceMeta.eventLibraryVersion) !== KINGMAKER_EVENT_LIBRARY_VERSION;
  const normalizedEvents = sourceEvents.length
    ? shouldSeedEventLibrary
      ? mergeKingmakerEventLibrary(sourceEvents)
      : sourceEvents.map(normalizeEventRecord)
    : starter.events;
  return {
    ...starter,
    ...source,
    meta: normalizeMetaState({ ...starter.meta, ...sourceMeta, eventLibraryVersion: KINGMAKER_EVENT_LIBRARY_VERSION }),
    rulesStore: normalizeRulesStore(source.rulesStore),
    sessions: ensureArray(source.sessions).length ? ensureArray(source.sessions).map(normalizeSessionRecord) : starter.sessions,
    companions: ensureArray(source.companions).length ? ensureArray(source.companions).map(normalizeCompanionRecord) : starter.companions,
    events: normalizedEvents,
    npcs: ensureArray(source.npcs).map(normalizeNpcRecord),
    quests: ensureArray(source.quests).length ? ensureArray(source.quests).map(normalizeQuestRecord) : starter.quests,
    locations: ensureArray(source.locations).length ? ensureArray(source.locations).map(normalizeLocationRecord) : starter.locations,
    kingdom: normalizeKingdomState(source.kingdom),
    hexMap: normalizeHexMapState(source.hexMap),
    liveCapture: ensureArray(source.liveCapture).map(normalizeCaptureEntry).filter((entry) => entry.note),
  };
}

export function createSessionDraft(campaign) {
  const normalized = normalizeCampaignState(campaign);
  const latestSession = normalized.sessions[0];
  return {
    title: "",
    date: normalized.kingdom.currentDate || KINGMAKER_DEFAULT_START_DATE,
    type: latestSession?.type || "expedition",
    arc: stringValue(latestSession?.arc) || "Stolen Lands Opening",
    chapter: stringValue(latestSession?.chapter) || "Chapter 2: Into the Wild",
    focusHex: stringValue(latestSession?.focusHex) || "D4",
    leadCompanion: stringValue(latestSession?.leadCompanion),
    travelObjective: "",
    weather: "",
    pressure: "",
    summary: "",
    nextPrep: "",
  };
}

export async function loadCampaignState(desktopApi) {
  if (desktopApi?.loadCampaignState) {
    const diskPayload = await desktopApi.loadCampaignState();
    if (diskPayload?.state) {
      return normalizeCampaignState(diskPayload.state);
    }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeCampaignState(JSON.parse(raw));
    }
  } catch {
    // Ignore legacy local storage parse failures and fall back below.
  }

  return createStarterState();
}

export async function saveCampaignState(nextState, desktopApi) {
  const normalized = normalizeCampaignState(nextState);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Best effort only. Desktop persistence below is the authoritative store.
  }
  if (desktopApi?.saveCampaignState) {
    await desktopApi.saveCampaignState(normalized);
  }
  return normalized;
}

export function readableError(error) {
  return stringValue(error?.message || error) || "Unknown error";
}
