import { createContext, startTransition, useContext, useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import {
  createSessionDraft,
  createStarterState,
  loadCampaignState,
  normalizeAiConfig,
  normalizeCampaignState,
  normalizeCaptureEntry,
  normalizeRulesStoreEntry,
  normalizeSessionRecord,
  normalizeRulesStore,
  readableError,
  saveCampaignState,
  uid,
} from "../lib/campaignState";
import { getDesktopApi } from "../lib/desktop";
import { addDaysToGolarionDate, diffGolarionDates, normalizeGolarionDate, toGolarionOrdinal } from "../lib/golarion";
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
} from "../lib/hexmap";
import {
  buildEventImpactSnapshot,
  describeEventImpactSummary,
  formatEventClockSummary,
  getEventAdvancePerTurn,
  getEventClockMax,
  getEventClockValue,
  hasEventImpact,
  shouldApplyEventImpact,
} from "../lib/events";
import { getControlDcForLevel, getDefaultKingdomProfileId, getKingdomProfileById, normalizeKingdomHex } from "../lib/kingdom";
import { deriveRulesMemoryState } from "../lib/rules";

const CampaignContext = createContext(null);

function sortSessions(left, right) {
  const delta = toGolarionOrdinal(right?.date) - toGolarionOrdinal(left?.date);
  if (delta !== 0) return delta;
  return String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || ""));
}

function getLatestSessionRecord(campaign) {
  return [...(campaign.sessions || [])].sort(sortSessions)[0] || null;
}

function injectOrReplaceLiveCaptureSection(currentText, section) {
  const markerRegex = /<!-- LIVE_CAPTURE_START -->[\s\S]*?<!-- LIVE_CAPTURE_END -->/m;
  const base = String(currentText || "").trim();
  if (markerRegex.test(base)) {
    return base.replace(markerRegex, section).trim();
  }
  return base ? `${base}\n\n${section}` : section;
}

function buildLiveCaptureSection(entries) {
  const lines = entries.map((entry) => {
    const stamp = Date.parse(String(entry?.timestamp || ""));
    const label = Number.isNaN(stamp)
      ? "Unknown time"
      : new Date(stamp).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
    return `- [${entry.kind}] ${label} - ${entry.note}`;
  });

  return `<!-- LIVE_CAPTURE_START -->
### Table Notes Log
${lines.join("\n")}
<!-- LIVE_CAPTURE_END -->`;
}

function mergeSessionText(currentText, nextText, mode = "replace") {
  const incoming = String(nextText || "").trim();
  const existing = String(currentText || "").trim();
  if (!incoming) return existing;
  if (mode !== "append" || !existing) return incoming;
  if (existing.includes(incoming)) return existing;
  return `${existing}\n\n${incoming}`.trim();
}

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function intValue(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n+/)
    .map((entry) => entry.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function buildCalendarEntry({ startDate, endDate, label, notes, source }) {
  const safeStartDate = normalizeGolarionDate(startDate);
  const safeEndDate = normalizeGolarionDate(endDate || safeStartDate, safeStartDate);
  return {
    id: uid(),
    startDate: safeStartDate,
    endDate: safeEndDate,
    date: safeEndDate,
    daysAdvanced: Math.abs(diffGolarionDates(safeStartDate, safeEndDate)),
    label: stringValue(label),
    notes: stringValue(notes),
    source: stringValue(source) || "manual",
    createdAt: new Date().toISOString(),
  };
}

function buildEventHistoryEntry({
  eventId,
  eventTitle,
  type,
  turnTitle,
  hex,
  summary,
  impactApplied,
  impacts,
  clockBefore,
  clockAfter,
  at,
}) {
  return {
    id: uid(),
    eventId: stringValue(eventId),
    eventTitle: stringValue(eventTitle),
    type: stringValue(type) || "note",
    turnTitle: stringValue(turnTitle),
    hex: stringValue(hex),
    summary: stringValue(summary),
    impactApplied: impactApplied === true,
    impacts: buildEventImpactSnapshot(impacts),
    clockBefore: Math.max(0, intValue(clockBefore, 0)),
    clockAfter: Math.max(0, intValue(clockAfter, 0)),
    at: stringValue(at) || new Date().toISOString(),
  };
}

function applyEventImpactToKingdomState(kingdom, eventItem) {
  const impacts = buildEventImpactSnapshot(eventItem);
  return {
    ...kingdom,
    resourcePoints: intValue(kingdom?.resourcePoints, 0) + impacts.rpImpact,
    unrest: Math.max(0, intValue(kingdom?.unrest, 0) + impacts.unrestImpact),
    renown: Math.max(0, intValue(kingdom?.renown, 0) + impacts.renownImpact),
    fame: Math.max(0, intValue(kingdom?.fame, 0) + impacts.fameImpact),
    infamy: Math.max(0, intValue(kingdom?.infamy, 0) + impacts.infamyImpact),
    commodities: {
      food: intValue(kingdom?.commodities?.food, 0) + impacts.foodImpact,
      lumber: intValue(kingdom?.commodities?.lumber, 0) + impacts.lumberImpact,
      luxuries: intValue(kingdom?.commodities?.luxuries, 0) + impacts.luxuriesImpact,
      ore: intValue(kingdom?.commodities?.ore, 0) + impacts.oreImpact,
      stone: intValue(kingdom?.commodities?.stone, 0) + impacts.stoneImpact,
    },
    ruin: {
      ...kingdom?.ruin,
      corruption: Math.max(0, intValue(kingdom?.ruin?.corruption, 0) + impacts.corruptionImpact),
      crime: Math.max(0, intValue(kingdom?.ruin?.crime, 0) + impacts.crimeImpact),
      decay: Math.max(0, intValue(kingdom?.ruin?.decay, 0) + impacts.decayImpact),
      strife: Math.max(0, intValue(kingdom?.ruin?.strife, 0) + impacts.strifeImpact),
      threshold: Math.max(1, intValue(kingdom?.ruin?.threshold, 5)),
    },
  };
}

function loadImageDimensions(fileUrl) {
  return new Promise((resolve) => {
    if (!fileUrl || typeof Image === "undefined") {
      resolve({ width: 0, height: 0 });
      return;
    }

    const image = new Image();
    image.onload = () => {
      resolve({
        width: Number(image.naturalWidth) || 0,
        height: Number(image.naturalHeight) || 0,
      });
    };
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = fileUrl;
  });
}

export function CampaignProvider({ children }) {
  const desktopApi = getDesktopApi();
  const [campaign, setCampaign] = useState(createStarterState());
  const [isHydrating, setIsHydrating] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [persistenceError, setPersistenceError] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const loaded = await loadCampaignState(desktopApi);
        if (!active) return;
        setCampaign(normalizeCampaignState(loaded));
      } catch (error) {
        if (!active) return;
        const message = readableError(error);
        setPersistenceError(message);
        notifications.show({
          color: "red",
          title: "Campaign load failed",
          message,
        });
      } finally {
        if (active) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [desktopApi]);

  useEffect(() => {
    if (isHydrating) return undefined;

    const timer = window.setTimeout(() => {
      void saveCampaignState(campaign, desktopApi)
        .then(() => {
          setLastSavedAt(new Date().toISOString());
          setPersistenceError("");
        })
        .catch((error) => {
          setPersistenceError(readableError(error));
        });
    }, 160);

    return () => {
      window.clearTimeout(timer);
    };
  }, [campaign, isHydrating, desktopApi]);

  const replaceCampaign = (nextCampaign) => {
    startTransition(() => {
      setCampaign(normalizeCampaignState(nextCampaign));
    });
  };

  const updateCampaign = (updater) => {
    startTransition(() => {
      setCampaign((current) => {
        const base = normalizeCampaignState(current);
        const next = typeof updater === "function" ? updater(base) : updater;
        return normalizeCampaignState(next);
      });
    });
  };

  const addSession = (draft) => {
    updateCampaign((current) => ({
      ...current,
      sessions: [
        normalizeSessionRecord({
          ...createSessionDraft(current),
          ...draft,
          id: uid(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        ...current.sessions,
      ],
    }));
  };

  const addCaptureEntry = (draft) => {
    const base = normalizeCampaignState(campaign);
    const entry = normalizeCaptureEntry({
      ...draft,
      id: uid(),
      timestamp: new Date().toISOString(),
    });
    replaceCampaign({
      ...base,
      liveCapture: [entry, ...(base.liveCapture || [])],
    });
    return entry;
  };

  const deleteCaptureEntry = (entryId) => {
    const targetId = String(entryId || "").trim();
    if (!targetId) return false;
    const base = normalizeCampaignState(campaign);
    const nextEntries = (base.liveCapture || []).filter((entry) => entry.id !== targetId);
    if (nextEntries.length === base.liveCapture.length) return false;
    replaceCampaign({
      ...base,
      liveCapture: nextEntries,
    });
    return true;
  };

  const clearCaptureEntries = () => {
    const base = normalizeCampaignState(campaign);
    const count = (base.liveCapture || []).length;
    if (!count) return 0;
    replaceCampaign({
      ...base,
      liveCapture: [],
    });
    return count;
  };

  const appendCaptureToSession = (targetSessionId) => {
    const base = normalizeCampaignState(campaign);
    const sessionId = String(targetSessionId || "").trim() || getLatestSessionRecord(base)?.id || "";
    const session = (base.sessions || []).find((entry) => entry.id === sessionId);
    if (!session) {
      return { ok: false, reason: "missing-session" };
    }

    const relevantEntries = (base.liveCapture || [])
      .filter((entry) => !String(entry.sessionId || "").trim() || String(entry.sessionId || "").trim() === session.id)
      .slice(0, 20);
    if (!relevantEntries.length) {
      return { ok: false, reason: "empty" };
    }

    const section = buildLiveCaptureSection(relevantEntries);
    const nextSessions = (base.sessions || []).map((entry) =>
      entry.id !== session.id
        ? entry
        : normalizeSessionRecord({
            ...entry,
            summary: injectOrReplaceLiveCaptureSection(entry.summary || "", section),
            updatedAt: new Date().toISOString(),
          })
    );

    replaceCampaign({
      ...base,
      sessions: nextSessions,
    });

    return {
      ok: true,
      count: relevantEntries.length,
      sessionTitle: session.title,
    };
  };

  const applyToLatestSession = (field, text, options = {}) => {
    const targetField = field === "summary" ? "summary" : "nextPrep";
    const content = String(text || "").trim();
    if (!content) {
      return { ok: false, reason: "empty" };
    }

    const base = normalizeCampaignState(campaign);
    const latestSession = getLatestSessionRecord(base);
    if (!latestSession) {
      return { ok: false, reason: "missing-session" };
    }

    const mode = options.mode === "append" ? "append" : "replace";
    const nextSessions = (base.sessions || []).map((entry) =>
      entry.id !== latestSession.id
        ? entry
        : normalizeSessionRecord({
            ...entry,
            [targetField]: mergeSessionText(entry[targetField], content, mode),
            updatedAt: new Date().toISOString(),
          })
    );

    replaceCampaign({
      ...base,
      sessions: nextSessions,
    });

    return {
      ok: true,
      field: targetField,
      mode,
      sessionTitle: latestSession.title,
    };
  };

  const updateAiConfig = (patch) => {
    const base = normalizeCampaignState(campaign);
    const nextConfig = normalizeAiConfig({
      ...(base.meta?.aiConfig || {}),
      ...(patch || {}),
    });

    replaceCampaign({
      ...base,
      meta: {
        ...base.meta,
        aiConfig: nextConfig,
      },
    });

    return nextConfig;
  };

  const syncRulesMemory = (base, overrides = {}) => {
    const nextCampaign = normalizeCampaignState(base);
    const nextManualRulings = Object.prototype.hasOwnProperty.call(overrides, "manualRulings")
      ? stringValue(overrides.manualRulings)
      : stringValue(nextCampaign.meta?.aiMemory?.manualRulings);

    nextCampaign.meta = {
      ...nextCampaign.meta,
      aiMemory: {
        ...(nextCampaign.meta?.aiMemory || {}),
        manualRulings: nextManualRulings,
      },
    };

    const derived = deriveRulesMemoryState(nextCampaign);
    nextCampaign.meta.aiMemory = {
      ...(nextCampaign.meta?.aiMemory || {}),
      manualRulings: nextManualRulings,
      rulingsDigest: derived.rulingsDigest,
      canonSummary: derived.canonSummary,
    };

    return nextCampaign;
  };

  const saveRulesMemory = (draft = {}) => {
    const base = normalizeCampaignState(campaign);
    const nextCampaign = syncRulesMemory(base, {
      manualRulings: draft?.manualRulings,
    });
    replaceCampaign(nextCampaign);
    return nextCampaign.meta?.aiMemory || {};
  };

  const upsertRulesStoreEntry = (draft = {}, entryId) => {
    const base = normalizeCampaignState(campaign);
    const cleanId = stringValue(entryId || draft?.id);
    const existing = normalizeRulesStore(base.rulesStore).find((entry) => entry.id === cleanId) || null;
    const now = new Date().toISOString();
    const record = normalizeRulesStoreEntry({
      ...(existing || {}),
      ...(draft || {}),
      id: existing?.id || cleanId || uid(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    const nextRulesStore = existing
      ? normalizeRulesStore((base.rulesStore || []).map((entry) => (entry.id === existing.id ? record : entry)))
      : [record, ...normalizeRulesStore(base.rulesStore)];
    const nextCampaign = syncRulesMemory({
      ...base,
      rulesStore: nextRulesStore,
    });
    const saved = (nextCampaign.rulesStore || []).find((entry) => entry.id === record.id) || null;
    replaceCampaign(nextCampaign);
    return saved;
  };

  const removeRulesStoreEntry = (entryId) => {
    const cleanId = stringValue(entryId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextRulesStore = normalizeRulesStore(base.rulesStore).filter((entry) => entry.id !== cleanId);
    if (nextRulesStore.length === (base.rulesStore || []).length) return false;
    replaceCampaign(
      syncRulesMemory({
        ...base,
        rulesStore: nextRulesStore,
      })
    );
    return true;
  };

  const upsertCompanion = (draft = {}, companionId) => {
    const base = normalizeCampaignState(campaign);
    const cleanId = stringValue(companionId || draft?.id);
    const existing = (base.companions || []).find((entry) => entry.id === cleanId) || null;
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      ...(draft || {}),
      id: existing?.id || cleanId || uid(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const nextCompanions = existing
      ? (base.companions || []).map((entry) => (entry.id === existing.id ? record : entry))
      : [record, ...(base.companions || [])];
    const nextCampaign = normalizeCampaignState({
      ...base,
      companions: nextCompanions,
    });
    const saved = (nextCampaign.companions || []).find((entry) => entry.id === record.id) || null;
    replaceCampaign(nextCampaign);
    return saved;
  };

  const removeCompanion = (companionId) => {
    const cleanId = stringValue(companionId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextCompanions = (base.companions || []).filter((entry) => entry.id !== cleanId);
    if (nextCompanions.length === (base.companions || []).length) return false;
    replaceCampaign({
      ...base,
      companions: nextCompanions,
    });
    return true;
  };

  const upsertNpc = (draft = {}, npcId) => {
    const base = normalizeCampaignState(campaign);
    const cleanId = stringValue(npcId || draft?.id);
    const existing = (base.npcs || []).find((entry) => entry.id === cleanId) || null;
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      ...(draft || {}),
      id: existing?.id || cleanId || uid(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const nextNpcs = existing
      ? (base.npcs || []).map((entry) => (entry.id === existing.id ? record : entry))
      : [record, ...(base.npcs || [])];
    const nextCampaign = normalizeCampaignState({
      ...base,
      npcs: nextNpcs,
    });
    const saved = (nextCampaign.npcs || []).find((entry) => entry.id === record.id) || null;
    replaceCampaign(nextCampaign);
    return saved;
  };

  const removeNpc = (npcId) => {
    const cleanId = stringValue(npcId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextNpcs = (base.npcs || []).filter((entry) => entry.id !== cleanId);
    if (nextNpcs.length === (base.npcs || []).length) return false;
    replaceCampaign({
      ...base,
      npcs: nextNpcs,
    });
    return true;
  };

  const upsertQuest = (draft = {}, questId) => {
    const base = normalizeCampaignState(campaign);
    const cleanId = stringValue(questId || draft?.id);
    const existing = (base.quests || []).find((entry) => entry.id === cleanId) || null;
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      ...(draft || {}),
      id: existing?.id || cleanId || uid(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const nextQuests = existing
      ? (base.quests || []).map((entry) => (entry.id === existing.id ? record : entry))
      : [record, ...(base.quests || [])];
    const nextCampaign = normalizeCampaignState({
      ...base,
      quests: nextQuests,
    });
    const saved = (nextCampaign.quests || []).find((entry) => entry.id === record.id) || null;
    replaceCampaign(nextCampaign);
    return saved;
  };

  const removeQuest = (questId) => {
    const cleanId = stringValue(questId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextQuests = (base.quests || []).filter((entry) => entry.id !== cleanId);
    if (nextQuests.length === (base.quests || []).length) return false;
    replaceCampaign({
      ...base,
      quests: nextQuests,
    });
    return true;
  };

  const upsertLocation = (draft = {}, locationId) => {
    const base = normalizeCampaignState(campaign);
    const cleanId = stringValue(locationId || draft?.id);
    const existing = (base.locations || []).find((entry) => entry.id === cleanId) || null;
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      ...(draft || {}),
      id: existing?.id || cleanId || uid(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const nextLocations = existing
      ? (base.locations || []).map((entry) => (entry.id === existing.id ? record : entry))
      : [record, ...(base.locations || [])];
    const nextCampaign = normalizeCampaignState({
      ...base,
      locations: nextLocations,
    });
    const saved = (nextCampaign.locations || []).find((entry) => entry.id === record.id) || null;
    replaceCampaign(nextCampaign);
    return saved;
  };

  const removeLocation = (locationId) => {
    const cleanId = stringValue(locationId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextLocations = (base.locations || []).filter((entry) => entry.id !== cleanId);
    if (nextLocations.length === (base.locations || []).length) return false;
    replaceCampaign({
      ...base,
      locations: nextLocations,
    });
    return true;
  };

  const appendKingdomEventHistory = (kingdom, draft) => ({
    ...kingdom,
    eventHistory: [buildEventHistoryEntry(draft), ...((kingdom?.eventHistory || []).slice(0, 79))],
  });

  const applyEventConsequenceToCampaign = (base, eventId, options = {}) => {
    const cleanId = stringValue(eventId);
    if (!cleanId) return { campaign: base, result: { triggered: false } };
    const currentEvent = (base.events || []).find((entry) => entry.id === cleanId);
    if (!currentEvent) return { campaign: base, result: { triggered: false } };

    const now = stringValue(options.at) || new Date().toISOString();
    const turnTitle = stringValue(options.turnTitle || base.kingdom?.currentTurnLabel);
    const impactSummary = describeEventImpactSummary(currentEvent);
    const impactApplied = shouldApplyEventImpact(currentEvent, base.kingdom?.regions || []) && hasEventImpact(currentEvent);
    let nextKingdom = base.kingdom || {};
    if (impactApplied) {
      nextKingdom = applyEventImpactToKingdomState(nextKingdom, currentEvent);
    }

    const baseSummary = stringValue(options.summary || currentEvent.consequenceSummary || currentEvent.fallout || "Event consequence triggered.");
    const finalSummary = impactSummary
      ? `${baseSummary} ${impactApplied ? `Applied: ${impactSummary}.` : `Held impact: ${impactSummary}.`}`.trim()
      : baseSummary;

    const nextEvents = (base.events || []).map((entry) =>
      entry.id !== cleanId
        ? entry
        : {
            ...entry,
            clock: getEventClockMax(entry),
            status: "escalated",
            lastTriggeredAt: now,
            lastTriggeredTurn: turnTitle,
            updatedAt: now,
          }
    );

    nextKingdom = appendKingdomEventHistory(nextKingdom, {
      eventId: currentEvent.id,
      eventTitle: currentEvent.title,
      type: "consequence",
      turnTitle,
      hex: currentEvent.hex,
      summary: finalSummary,
      impactApplied,
      impacts: currentEvent,
      clockBefore: getEventClockValue(currentEvent),
      clockAfter: getEventClockMax(currentEvent),
      at: now,
    });

    return {
      campaign: {
        ...base,
        events: nextEvents,
        kingdom: nextKingdom,
      },
      result: {
        triggered: true,
        impactApplied,
        impactSummary,
        summary: finalSummary,
        eventTitle: currentEvent.title,
      },
    };
  };

  const upsertEvent = (draft = {}, eventId) => {
    const base = normalizeCampaignState(campaign);
    const cleanId = stringValue(eventId || draft?.id);
    const existing = (base.events || []).find((entry) => entry.id === cleanId) || null;
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      ...(draft || {}),
      id: existing?.id || cleanId || uid(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const nextEvents = existing
      ? (base.events || []).map((entry) => (entry.id === existing.id ? record : entry))
      : [record, ...(base.events || [])];
    const nextCampaign = normalizeCampaignState({
      ...base,
      events: nextEvents,
    });
    const saved = (nextCampaign.events || []).find((entry) => entry.id === record.id) || null;
    replaceCampaign(nextCampaign);
    return saved;
  };

  const removeEvent = (eventId) => {
    const cleanId = stringValue(eventId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextEvents = (base.events || []).filter((entry) => entry.id !== cleanId);
    if (nextEvents.length === (base.events || []).length) return false;
    replaceCampaign({
      ...base,
      events: nextEvents,
    });
    return true;
  };

  const adjustEventClock = (eventId, amount, options = {}) => {
    const cleanId = stringValue(eventId);
    if (!cleanId) return { changed: false };
    const base = normalizeCampaignState(campaign);
    const currentEvent = (base.events || []).find((entry) => entry.id === cleanId);
    if (!currentEvent) return { changed: false };

    const before = getEventClockValue(currentEvent);
    const after = Math.max(0, Math.min(getEventClockMax(currentEvent), before + intValue(amount, 0)));
    if (after === before) return { changed: false, before, after };

    const now = stringValue(options.at) || new Date().toISOString();
    const turnTitle = stringValue(options.turnTitle || base.kingdom?.currentTurnLabel);
    const nextEvents = (base.events || []).map((entry) =>
      entry.id !== cleanId
        ? entry
        : {
            ...entry,
            clock: after,
            status: stringValue(entry.status).toLowerCase() === "seeded" && after > 0 ? "active" : entry.status,
            updatedAt: now,
          }
    );

    let nextCampaign = {
      ...base,
      events: nextEvents,
      kingdom: appendKingdomEventHistory(base.kingdom || {}, {
        eventId: currentEvent.id,
        eventTitle: currentEvent.title,
        type: stringValue(options.type || (amount >= 0 ? "manual-advance" : "manual-rewind")),
        turnTitle,
        hex: currentEvent.hex,
        summary: stringValue(options.summary || `${currentEvent.title || "Event"} clock ${before}/${getEventClockMax(currentEvent)} -> ${after}/${getEventClockMax(currentEvent)}.`),
        clockBefore: before,
        clockAfter: after,
        at: now,
      }),
    };

    let triggerResult = null;
    const autoTrigger = options.autoTrigger !== false;
    const priorStatus = stringValue(currentEvent.status).toLowerCase();
    if (autoTrigger && after >= getEventClockMax(currentEvent) && before < getEventClockMax(currentEvent) && !["resolved", "failed", "escalated"].includes(priorStatus)) {
      const triggered = applyEventConsequenceToCampaign(nextCampaign, cleanId, {
        at: now,
        turnTitle,
        summary: options.triggerSummary,
      });
      nextCampaign = triggered.campaign;
      triggerResult = triggered.result;
    }

    replaceCampaign(nextCampaign);
    return {
      changed: true,
      before,
      after,
      triggered: triggerResult?.triggered === true,
      triggerSummary: triggerResult?.summary || "",
    };
  };

  const triggerEventConsequence = (eventId, options = {}) => {
    const base = normalizeCampaignState(campaign);
    const next = applyEventConsequenceToCampaign(base, eventId, options);
    if (!next.result.triggered) return next.result;
    replaceCampaign(next.campaign);
    return next.result;
  };

  const resolveEvent = (eventId, outcome = "resolved", summary = "") => {
    const cleanId = stringValue(eventId);
    if (!cleanId) return { resolved: false };
    const base = normalizeCampaignState(campaign);
    const currentEvent = (base.events || []).find((entry) => entry.id === cleanId);
    if (!currentEvent) return { resolved: false };

    const now = new Date().toISOString();
    const status = stringValue(outcome).toLowerCase() === "failed" ? "failed" : "resolved";
    const finalSummary = stringValue(summary || (status === "resolved" ? "Event resolved by the party or kingdom." : "Event failed or broke against the party."));
    const nextEvents = (base.events || []).map((entry) =>
      entry.id !== cleanId
        ? entry
        : {
            ...entry,
            status,
            resolvedAt: now,
            updatedAt: now,
          }
    );

    replaceCampaign({
      ...base,
      events: nextEvents,
      kingdom: appendKingdomEventHistory(base.kingdom || {}, {
        eventId: currentEvent.id,
        eventTitle: currentEvent.title,
        type: status,
        turnTitle: base.kingdom?.currentTurnLabel,
        hex: currentEvent.hex,
        summary: finalSummary,
        clockBefore: getEventClockValue(currentEvent),
        clockAfter: getEventClockValue(currentEvent),
        at: now,
      }),
    });

    return {
      resolved: true,
      status,
      summary: finalSummary,
      eventTitle: currentEvent.title,
    };
  };

  const saveKingdomOverview = (draft) => {
    const base = normalizeCampaignState(campaign);
    const currentKingdom = base.kingdom || {};
    const profileId = stringValue(draft?.profileId) || stringValue(currentKingdom.profileId) || getDefaultKingdomProfileId();
    const profile = getKingdomProfileById(profileId) || getKingdomProfileById(getDefaultKingdomProfileId());
    const nextLevel = Math.max(1, intValue(draft?.level, currentKingdom.level || 1));
    const priorDate = normalizeGolarionDate(currentKingdom.currentDate || currentKingdom.calendarStartDate);
    const nextDate = normalizeGolarionDate(draft?.currentDate || priorDate, priorDate);
    const calendarHistory = [...(currentKingdom.calendarHistory || [])];

    if (nextDate !== priorDate) {
      calendarHistory.unshift(
        buildCalendarEntry({
          startDate: priorDate,
          endDate: nextDate,
          label: "Kingdom sheet date adjusted",
          notes: stringValue(draft?.dateNotes),
          source: "overview",
        })
      );
    }

    replaceCampaign({
      ...base,
      kingdom: {
        ...currentKingdom,
        profileId,
        name: stringValue(draft?.name) || currentKingdom.name,
        charter: stringValue(draft?.charter) || currentKingdom.charter,
        government: stringValue(draft?.government) || currentKingdom.government,
        heartland: stringValue(draft?.heartland) || currentKingdom.heartland,
        capital: stringValue(draft?.capital) || currentKingdom.capital,
        currentTurnLabel: stringValue(draft?.currentTurnLabel) || currentKingdom.currentTurnLabel,
        currentDate: nextDate,
        level: nextLevel,
        size: Math.max(1, intValue(draft?.size, currentKingdom.size || 1)),
        controlDC:
          draft?.controlDC === "" || draft?.controlDC == null
            ? getControlDcForLevel(profile, nextLevel)
            : Math.max(10, intValue(draft?.controlDC, currentKingdom.controlDC || getControlDcForLevel(profile, nextLevel))),
        resourceDie: stringValue(draft?.resourceDie) || currentKingdom.resourceDie,
        resourcePoints: intValue(draft?.resourcePoints, currentKingdom.resourcePoints || 0),
        xp: intValue(draft?.xp, currentKingdom.xp || 0),
        abilities: {
          culture: intValue(draft?.culture, currentKingdom.abilities?.culture || 0),
          economy: intValue(draft?.economy, currentKingdom.abilities?.economy || 0),
          loyalty: intValue(draft?.loyalty, currentKingdom.abilities?.loyalty || 0),
          stability: intValue(draft?.stability, currentKingdom.abilities?.stability || 0),
        },
        commodities: {
          food: intValue(draft?.food, currentKingdom.commodities?.food || 0),
          lumber: intValue(draft?.lumber, currentKingdom.commodities?.lumber || 0),
          luxuries: intValue(draft?.luxuries, currentKingdom.commodities?.luxuries || 0),
          ore: intValue(draft?.ore, currentKingdom.commodities?.ore || 0),
          stone: intValue(draft?.stone, currentKingdom.commodities?.stone || 0),
        },
        consumption: Math.max(0, intValue(draft?.consumption, currentKingdom.consumption || 0)),
        renown: Math.max(0, intValue(draft?.renown, currentKingdom.renown || 0)),
        fame: Math.max(0, intValue(draft?.fame, currentKingdom.fame || 0)),
        infamy: Math.max(0, intValue(draft?.infamy, currentKingdom.infamy || 0)),
        unrest: Math.max(0, intValue(draft?.unrest, currentKingdom.unrest || 0)),
        ruin: {
          corruption: Math.max(0, intValue(draft?.corruption, currentKingdom.ruin?.corruption || 0)),
          crime: Math.max(0, intValue(draft?.crime, currentKingdom.ruin?.crime || 0)),
          decay: Math.max(0, intValue(draft?.decay, currentKingdom.ruin?.decay || 0)),
          strife: Math.max(0, intValue(draft?.strife, currentKingdom.ruin?.strife || 0)),
          threshold: Math.max(1, intValue(draft?.ruinThreshold, currentKingdom.ruin?.threshold || 5)),
        },
        notes: stringValue(draft?.notes),
        pendingProjects: splitLines(draft?.pendingProjects),
        calendarHistory,
      },
    });
  };

  const addKingdomLeader = (draft) => {
    const base = normalizeCampaignState(campaign);
    const profile = getKingdomProfileById(base.kingdom?.profileId) || getKingdomProfileById(getDefaultKingdomProfileId());
    const role = stringValue(draft?.role) || "Leader";
    const roleProfile = (profile?.leadershipRoles || []).find((entry) => stringValue(entry?.role) === role);
    const leader = {
      id: uid(),
      role,
      name: stringValue(draft?.name) || "Unnamed leader",
      type: stringValue(draft?.type) || "NPC",
      leadershipBonus: Math.max(0, intValue(draft?.leadershipBonus, 0)),
      relevantSkills: stringValue(draft?.relevantSkills) || (roleProfile?.relevantSkills || []).join(", "),
      specializedSkills: stringValue(draft?.specializedSkills) || (roleProfile?.specializedSkills || []).join(", "),
      notes: stringValue(draft?.notes),
      updatedAt: new Date().toISOString(),
    };

    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        leaders: [leader, ...(base.kingdom?.leaders || [])],
      },
    });

    return leader;
  };

  const removeKingdomLeader = (entryId) => {
    const cleanId = stringValue(entryId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextLeaders = (base.kingdom?.leaders || []).filter((entry) => entry.id !== cleanId);
    if (nextLeaders.length === (base.kingdom?.leaders || []).length) return false;
    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        leaders: nextLeaders,
      },
    });
    return true;
  };

  const addKingdomSettlement = (draft) => {
    const base = normalizeCampaignState(campaign);
    const settlement = {
      id: uid(),
      name: stringValue(draft?.name) || "Unnamed settlement",
      size: stringValue(draft?.size) || "Village",
      influence: Math.max(0, intValue(draft?.influence, 0)),
      civicStructure: stringValue(draft?.civicStructure),
      resourceDice: Math.max(0, intValue(draft?.resourceDice, 0)),
      consumption: Math.max(0, intValue(draft?.consumption, 0)),
      notes: stringValue(draft?.notes),
      updatedAt: new Date().toISOString(),
    };

    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        settlements: [settlement, ...(base.kingdom?.settlements || [])],
      },
    });

    return settlement;
  };

  const removeKingdomSettlement = (entryId) => {
    const cleanId = stringValue(entryId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextSettlements = (base.kingdom?.settlements || []).filter((entry) => entry.id !== cleanId);
    if (nextSettlements.length === (base.kingdom?.settlements || []).length) return false;
    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        settlements: nextSettlements,
      },
    });
    return true;
  };

  const addKingdomRegion = (draft) => {
    const base = normalizeCampaignState(campaign);
    const cleanHex = normalizeKingdomHex(draft?.hex) || "Unknown hex";
    const region = {
      id: uid(),
      hex: cleanHex,
      status: stringValue(draft?.status) || "Claimed",
      terrain: stringValue(draft?.terrain),
      siteCategory: HEX_MAP_SITE_CATEGORY_OPTIONS.includes(stringValue(draft?.siteCategory)) ? stringValue(draft?.siteCategory) : "",
      workSite: stringValue(draft?.workSite),
      discovery: stringValue(draft?.discovery),
      kingdomValue: stringValue(draft?.kingdomValue),
      danger: stringValue(draft?.danger),
      improvement: stringValue(draft?.improvement),
      rumor: stringValue(draft?.rumor),
      notes: stringValue(draft?.notes),
      updatedAt: new Date().toISOString(),
    };

    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        regions: [region, ...(base.kingdom?.regions || []).filter((entry) => normalizeKingdomHex(entry?.hex) !== cleanHex)],
      },
    });

    return region;
  };

  const removeKingdomRegion = (entryId) => {
    const cleanId = stringValue(entryId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextRegions = (base.kingdom?.regions || []).filter((entry) => entry.id !== cleanId);
    if (nextRegions.length === (base.kingdom?.regions || []).length) return false;
    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        regions: nextRegions,
      },
    });
    return true;
  };

  const advanceKingdomCalendar = ({ days, label, notes, source } = {}) => {
    const base = normalizeCampaignState(campaign);
    const startDate = normalizeGolarionDate(base.kingdom?.currentDate || base.kingdom?.calendarStartDate);
    const amount = Math.max(1, intValue(days, 1));
    const endDate = addDaysToGolarionDate(startDate, amount);
    const entry = buildCalendarEntry({
      startDate,
      endDate,
      label: stringValue(label) || (amount === 1 ? "Advance 1 day" : `Advance ${amount} days`),
      notes,
      source: stringValue(source) || "manual",
    });

    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        currentDate: endDate,
        calendarHistory: [entry, ...(base.kingdom?.calendarHistory || [])],
      },
    });

    return entry;
  };

  const setKingdomCalendarDate = ({ date, label, notes, source } = {}) => {
    const base = normalizeCampaignState(campaign);
    const startDate = normalizeGolarionDate(base.kingdom?.currentDate || base.kingdom?.calendarStartDate);
    const endDate = normalizeGolarionDate(date || startDate, startDate);
    const entry = buildCalendarEntry({
      startDate,
      endDate,
      label: stringValue(label) || "Calendar date adjusted",
      notes,
      source: stringValue(source) || "manual-set",
    });

    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        currentDate: endDate,
        calendarHistory: [entry, ...(base.kingdom?.calendarHistory || [])],
      },
    });

    return entry;
  };

  const applyKingdomTurn = (draft) => {
    const base = normalizeCampaignState(campaign);
    const now = new Date().toISOString();
    const currentKingdom = base.kingdom || {};
    const title = stringValue(draft?.title) || `Turn ${((currentKingdom.turns || []).length || 0) + 1}`;
    const priorDate = normalizeGolarionDate(currentKingdom.currentDate || currentKingdom.calendarStartDate);
    const turnDate = normalizeGolarionDate(draft?.date || priorDate, priorDate);
    const pendingProject = stringValue(draft?.pendingProject);
    const eventSummary = stringValue(draft?.eventSummary);
    const calendarHistory = [...(currentKingdom.calendarHistory || [])];
    const eventHistory = [...(currentKingdom.eventHistory || [])];

    if (turnDate !== priorDate) {
      calendarHistory.unshift(
        buildCalendarEntry({
          startDate: priorDate,
          endDate: turnDate,
          label: `${title} dated`,
          notes: stringValue(draft?.summary),
          source: "kingdom-turn",
        })
      );
    }

    if (eventSummary) {
      eventHistory.unshift({
        id: uid(),
        eventId: "",
        eventTitle: "Kingdom Event Phase",
        type: "turn-summary",
        turnTitle: title,
        hex: "",
        summary: eventSummary,
        impactApplied: false,
        at: now,
      });
    }

    const latestSession = getLatestSessionRecord(base);
    const nextSessions = latestSession
      ? (base.sessions || []).map((entry) =>
          entry.id !== latestSession.id
            ? entry
            : normalizeSessionRecord({
                ...entry,
                kingdomTurn: title,
                updatedAt: now,
              })
        )
      : base.sessions;

    const nextPendingProjects = pendingProject
      ? [pendingProject, ...(currentKingdom.pendingProjects || []).filter((entry) => stringValue(entry) !== pendingProject)]
      : [...(currentKingdom.pendingProjects || [])];

    let nextCampaign = {
      ...base,
      sessions: nextSessions,
      kingdom: {
        ...currentKingdom,
        currentTurnLabel: title,
        currentDate: turnDate,
        resourcePoints: intValue(currentKingdom.resourcePoints, 0) + intValue(draft?.rpDelta, 0),
        unrest: Math.max(0, intValue(currentKingdom.unrest, 0) + intValue(draft?.unrestDelta, 0)),
        renown: Math.max(0, intValue(currentKingdom.renown, 0) + intValue(draft?.renownDelta, 0)),
        fame: Math.max(0, intValue(currentKingdom.fame, 0) + intValue(draft?.fameDelta, 0)),
        infamy: Math.max(0, intValue(currentKingdom.infamy, 0) + intValue(draft?.infamyDelta, 0)),
        commodities: {
          food: intValue(currentKingdom.commodities?.food, 0) + intValue(draft?.foodDelta, 0),
          lumber: intValue(currentKingdom.commodities?.lumber, 0) + intValue(draft?.lumberDelta, 0),
          luxuries: intValue(currentKingdom.commodities?.luxuries, 0) + intValue(draft?.luxuriesDelta, 0),
          ore: intValue(currentKingdom.commodities?.ore, 0) + intValue(draft?.oreDelta, 0),
          stone: intValue(currentKingdom.commodities?.stone, 0) + intValue(draft?.stoneDelta, 0),
        },
        ruin: {
          ...currentKingdom.ruin,
          corruption: Math.max(0, intValue(currentKingdom.ruin?.corruption, 0) + intValue(draft?.corruptionDelta, 0)),
          crime: Math.max(0, intValue(currentKingdom.ruin?.crime, 0) + intValue(draft?.crimeDelta, 0)),
          decay: Math.max(0, intValue(currentKingdom.ruin?.decay, 0) + intValue(draft?.decayDelta, 0)),
          strife: Math.max(0, intValue(currentKingdom.ruin?.strife, 0) + intValue(draft?.strifeDelta, 0)),
          threshold: Math.max(1, intValue(currentKingdom.ruin?.threshold, 5)),
        },
        turns: [
          {
            id: uid(),
            title,
            date: turnDate,
            summary: stringValue(draft?.summary),
            risks: stringValue(draft?.risks),
            eventSummary,
            resourceDelta: intValue(draft?.rpDelta, 0),
            rpDelta: intValue(draft?.rpDelta, 0),
            unrestDelta: intValue(draft?.unrestDelta, 0),
            renownDelta: intValue(draft?.renownDelta, 0),
            fameDelta: intValue(draft?.fameDelta, 0),
            infamyDelta: intValue(draft?.infamyDelta, 0),
            foodDelta: intValue(draft?.foodDelta, 0),
            lumberDelta: intValue(draft?.lumberDelta, 0),
            luxuriesDelta: intValue(draft?.luxuriesDelta, 0),
            oreDelta: intValue(draft?.oreDelta, 0),
            stoneDelta: intValue(draft?.stoneDelta, 0),
            corruptionDelta: intValue(draft?.corruptionDelta, 0),
            crimeDelta: intValue(draft?.crimeDelta, 0),
            decayDelta: intValue(draft?.decayDelta, 0),
            strifeDelta: intValue(draft?.strifeDelta, 0),
            pendingProject,
            notes: stringValue(draft?.notes),
            updatedAt: now,
          },
          ...(currentKingdom.turns || []),
        ],
        eventHistory,
        calendarHistory,
        pendingProjects: nextPendingProjects.slice(0, 24),
      },
    };

    const eventResults = {
      advanced: 0,
      triggered: 0,
      impactsApplied: 0,
      impactsHeld: 0,
      summaries: [],
    };

    let workingCampaign = normalizeCampaignState(nextCampaign);

    for (const sourceEvent of [...(workingCampaign.events || [])]) {
      const currentEvent = (workingCampaign.events || []).find((entry) => entry.id === sourceEvent.id);
      if (!currentEvent) continue;
      const status = stringValue(currentEvent.status).toLowerCase();
      if (status !== "active") continue;
      if (stringValue(currentEvent.advanceOn).toLowerCase() !== "turn") continue;
      const step = getEventAdvancePerTurn(currentEvent);
      if (step <= 0) continue;
      const before = getEventClockValue(currentEvent);
      const after = Math.max(0, Math.min(getEventClockMax(currentEvent), before + step));
      if (after === before) continue;

      workingCampaign = {
        ...workingCampaign,
        events: (workingCampaign.events || []).map((entry) =>
          entry.id !== currentEvent.id
            ? entry
            : {
                ...entry,
                clock: after,
                updatedAt: now,
              }
        ),
        kingdom: appendKingdomEventHistory(workingCampaign.kingdom || {}, {
          eventId: currentEvent.id,
          eventTitle: currentEvent.title,
          type: "turn-advance",
          turnTitle: title,
          hex: currentEvent.hex,
          summary: `${currentEvent.title || "Event"} advanced during ${title}: ${before}/${getEventClockMax(currentEvent)} -> ${after}/${getEventClockMax(currentEvent)}.`,
          clockBefore: before,
          clockAfter: after,
          at: now,
        }),
      };

      eventResults.advanced += 1;
      if (after >= getEventClockMax(currentEvent) && before < getEventClockMax(currentEvent)) {
        const triggered = applyEventConsequenceToCampaign(workingCampaign, currentEvent.id, {
          at: now,
          turnTitle: title,
          summary: `${currentEvent.title || "Event"} reached its limit during ${title}.`,
        });
        workingCampaign = triggered.campaign;
        eventResults.triggered += 1;
        if (triggered.result.impactApplied) eventResults.impactsApplied += 1;
        else if (hasEventImpact(currentEvent)) eventResults.impactsHeld += 1;
        if (triggered.result.summary) {
          eventResults.summaries.push(triggered.result.summary);
        }
      }
    }

    replaceCampaign(workingCampaign);

    return { title, date: turnDate, eventResults };
  };

  const saveHexMapSettings = (draft = {}) => {
    const base = normalizeCampaignState(campaign);
    const currentHexMap = base.hexMap || {};
    const nextColumns = Math.max(HEX_MAP_COLUMNS_MIN, Math.min(HEX_MAP_COLUMNS_MAX, intValue(draft?.columns, currentHexMap.columns || 12)));
    const nextRows = Math.max(HEX_MAP_ROWS_MIN, Math.min(HEX_MAP_ROWS_MAX, intValue(draft?.rows, currentHexMap.rows || 10)));
    const nextHexSize = Math.max(
      HEX_MAP_HEX_SIZE_MIN,
      Math.min(HEX_MAP_HEX_SIZE_MAX, intValue(draft?.hexSize, currentHexMap.hexSize || 54))
    );
    const viewport = clampHexMapViewport({
      ...currentHexMap,
      columns: nextColumns,
      rows: nextRows,
      hexSize: nextHexSize,
      zoom: currentHexMap.zoom,
      panX: currentHexMap.panX,
      panY: currentHexMap.panY,
    });

    replaceCampaign({
      ...base,
      hexMap: {
        ...currentHexMap,
        mapName: stringValue(draft?.mapName) || currentHexMap.mapName,
        columns: nextColumns,
        rows: nextRows,
        hexSize: nextHexSize,
        showLabels: draft?.showLabels == null ? currentHexMap.showLabels !== false : draft.showLabels === true,
        backgroundOpacity: Math.max(0, Math.min(0.95, Number(draft?.backgroundOpacity ?? currentHexMap.backgroundOpacity ?? 0.78))),
        backgroundScale: Math.max(
          HEX_MAP_BACKGROUND_SCALE_MIN,
          Math.min(HEX_MAP_BACKGROUND_SCALE_MAX, Number(draft?.backgroundScale ?? currentHexMap.backgroundScale ?? 1))
        ),
        backgroundOffsetX: Number(draft?.backgroundOffsetX ?? currentHexMap.backgroundOffsetX ?? 0) || 0,
        backgroundOffsetY: Number(draft?.backgroundOffsetY ?? currentHexMap.backgroundOffsetY ?? 0) || 0,
        gridFillOpacity: Math.max(0, Math.min(0.65, Number(draft?.gridFillOpacity ?? currentHexMap.gridFillOpacity ?? 0.32))),
        gridLineOpacity: Math.max(0.15, Math.min(1, Number(draft?.gridLineOpacity ?? currentHexMap.gridLineOpacity ?? 0.54))),
        zoom: viewport.zoom,
        panX: viewport.panX,
        panY: viewport.panY,
      },
    });
  };

  const saveHexMapViewport = (draft = {}) => {
    const base = normalizeCampaignState(campaign);
    const currentHexMap = base.hexMap || {};
    const viewport = clampHexMapViewport({
      ...currentHexMap,
      zoom: Math.max(HEX_MAP_ZOOM_MIN, Math.min(HEX_MAP_ZOOM_MAX, Number(draft?.zoom ?? currentHexMap.zoom ?? 1))),
      panX: Number(draft?.panX ?? currentHexMap.panX ?? 0) || 0,
      panY: Number(draft?.panY ?? currentHexMap.panY ?? 0) || 0,
    });

    replaceCampaign({
      ...base,
      hexMap: {
        ...currentHexMap,
        zoom: viewport.zoom,
        panX: viewport.panX,
        panY: viewport.panY,
      },
    });

    return viewport;
  };

  const setHexMapPartyMoveMode = (enabled) => {
    const base = normalizeCampaignState(campaign);
    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        partyMoveMode: enabled === true,
      },
    });
    return enabled === true;
  };

  const pickHexMapBackground = async () => {
    if (!desktopApi?.pickMapBackground) {
      throw new Error("Map background picker is only available in the desktop build.");
    }

    const picked = await desktopApi.pickMapBackground();
    if (!picked?.fileUrl) return null;
    const dimensions = await loadImageDimensions(picked.fileUrl);
    const base = normalizeCampaignState(campaign);

    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        backgroundPath: stringValue(picked.path),
        backgroundUrl: stringValue(picked.fileUrl),
        backgroundName: stringValue(picked.name),
        backgroundNaturalWidth: dimensions.width,
        backgroundNaturalHeight: dimensions.height,
        backgroundScale: 1,
        backgroundOffsetX: 0,
        backgroundOffsetY: 0,
      },
    });

    return {
      ...picked,
      ...dimensions,
    };
  };

  const clearHexMapBackground = () => {
    const base = normalizeCampaignState(campaign);
    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        backgroundPath: "",
        backgroundUrl: "",
        backgroundName: "",
        backgroundNaturalWidth: 0,
        backgroundNaturalHeight: 0,
        backgroundScale: 1,
        backgroundOffsetX: 0,
        backgroundOffsetY: 0,
      },
    });
  };

  const recenterHexMapBackground = () => {
    const base = normalizeCampaignState(campaign);
    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        backgroundScale: 1,
        backgroundOffsetX: 0,
        backgroundOffsetY: 0,
      },
    });
  };

  const addHexMapRegion = (draft) => {
    const base = normalizeCampaignState(campaign);
    const cleanHex = normalizeHexCoordinate(draft?.hex, base.hexMap?.columns, base.hexMap?.rows);
    if (!cleanHex) {
      throw new Error("Choose a valid hex before saving the region.");
    }

    const region = {
      id:
        (base.kingdom?.regions || []).find((entry) => normalizeKingdomHex(entry?.hex) === cleanHex)?.id ||
        uid(),
      hex: cleanHex,
      status: stringValue(draft?.status) || "Claimed",
      terrain: stringValue(draft?.terrain),
      siteCategory: HEX_MAP_SITE_CATEGORY_OPTIONS.includes(stringValue(draft?.siteCategory)) ? stringValue(draft?.siteCategory) : "",
      workSite: stringValue(draft?.workSite),
      discovery: stringValue(draft?.discovery),
      kingdomValue: stringValue(draft?.kingdomValue),
      danger: stringValue(draft?.danger),
      improvement: stringValue(draft?.improvement),
      rumor: stringValue(draft?.rumor),
      notes: stringValue(draft?.notes),
      updatedAt: new Date().toISOString(),
    };

    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        regions: [region, ...(base.kingdom?.regions || []).filter((entry) => normalizeKingdomHex(entry?.hex) !== cleanHex)],
      },
    });

    return region;
  };

  const clearHexMapRegion = (hex) => {
    const base = normalizeCampaignState(campaign);
    const cleanHex = normalizeHexCoordinate(hex, base.hexMap?.columns, base.hexMap?.rows);
    if (!cleanHex) return false;
    const nextRegions = (base.kingdom?.regions || []).filter((entry) => normalizeKingdomHex(entry?.hex) !== cleanHex);
    if (nextRegions.length === (base.kingdom?.regions || []).length) return false;

    replaceCampaign({
      ...base,
      kingdom: {
        ...base.kingdom,
        regions: nextRegions,
      },
    });
    return true;
  };

  const addHexMapMarker = (draft) => {
    const base = normalizeCampaignState(campaign);
    const cleanHex = normalizeHexCoordinate(draft?.hex, base.hexMap?.columns, base.hexMap?.rows);
    if (!cleanHex) {
      throw new Error("Choose a valid hex before placing a marker.");
    }

    const type = HEX_MAP_MARKER_TYPES.includes(stringValue(draft?.type)) ? stringValue(draft?.type) : "Note";
    const marker = {
      id: uid(),
      hex: cleanHex,
      type,
      icon: stringValue(draft?.icon) || getDefaultHexMarkerIconId(type),
      title: stringValue(draft?.title) || "Untitled marker",
      notes: stringValue(draft?.notes),
      updatedAt: new Date().toISOString(),
    };

    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        markers: [marker, ...(base.hexMap?.markers || [])],
      },
    });

    return marker;
  };

  const updateHexMapMarker = (markerId, patch = {}) => {
    const cleanId = stringValue(markerId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    let changed = false;
    const nextMarkers = (base.hexMap?.markers || []).map((entry) => {
      if (entry.id !== cleanId) return entry;
      changed = true;
      const type = HEX_MAP_MARKER_TYPES.includes(stringValue(patch?.type || entry.type)) ? stringValue(patch?.type || entry.type) : "Note";
      return {
        ...entry,
        type,
        icon: stringValue(patch?.icon) || entry.icon || getDefaultHexMarkerIconId(type),
        title: stringValue(patch?.title ?? entry.title),
        notes: stringValue(patch?.notes ?? entry.notes),
        updatedAt: new Date().toISOString(),
      };
    });
    if (!changed) return false;

    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        markers: nextMarkers,
      },
    });
    return true;
  };

  const removeHexMapMarker = (markerId) => {
    const cleanId = stringValue(markerId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextMarkers = (base.hexMap?.markers || []).filter((entry) => entry.id !== cleanId);
    if (nextMarkers.length === (base.hexMap?.markers || []).length) return false;
    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        markers: nextMarkers,
      },
    });
    return true;
  };

  const addHexMapForce = (draft) => {
    const base = normalizeCampaignState(campaign);
    const cleanHex = normalizeHexCoordinate(draft?.hex, base.hexMap?.columns, base.hexMap?.rows);
    if (!cleanHex) {
      throw new Error("Choose a valid hex before placing a force.");
    }

    const force = {
      id: uid(),
      hex: cleanHex,
      type: HEX_MAP_FORCE_TYPES.includes(stringValue(draft?.type)) ? stringValue(draft?.type) : "Allied Force",
      name: stringValue(draft?.name) || "Unnamed force",
      notes: stringValue(draft?.notes),
      updatedAt: new Date().toISOString(),
    };

    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        forces: [force, ...(base.hexMap?.forces || [])],
      },
    });

    return force;
  };

  const updateHexMapForce = (forceId, patch = {}) => {
    const cleanId = stringValue(forceId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    let changed = false;
    const nextForces = (base.hexMap?.forces || []).map((entry) => {
      if (entry.id !== cleanId) return entry;
      changed = true;
      return {
        ...entry,
        type: HEX_MAP_FORCE_TYPES.includes(stringValue(patch?.type || entry.type)) ? stringValue(patch?.type || entry.type) : "Allied Force",
        name: stringValue(patch?.name ?? entry.name),
        notes: stringValue(patch?.notes ?? entry.notes),
        updatedAt: new Date().toISOString(),
      };
    });
    if (!changed) return false;

    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        forces: nextForces,
      },
    });
    return true;
  };

  const removeHexMapForce = (forceId) => {
    const cleanId = stringValue(forceId);
    if (!cleanId) return false;
    const base = normalizeCampaignState(campaign);
    const nextForces = (base.hexMap?.forces || []).filter((entry) => entry.id !== cleanId);
    if (nextForces.length === (base.hexMap?.forces || []).length) return false;
    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        forces: nextForces,
      },
    });
    return true;
  };

  const moveHexMapParty = (draft = {}) => {
    const base = normalizeCampaignState(campaign);
    const cleanHex = normalizeHexCoordinate(draft?.hex, base.hexMap?.columns, base.hexMap?.rows);
    if (!cleanHex) {
      throw new Error("Choose a valid hex before moving the party.");
    }

    const currentParty = base.hexMap?.party || {};
    const nextTrail = Array.isArray(currentParty.trail) ? [...currentParty.trail] : [];
    if (!nextTrail.length || nextTrail[0]?.hex !== cleanHex) {
      nextTrail.unshift({
        hex: cleanHex,
        at: new Date().toISOString(),
      });
    } else {
      nextTrail[0] = {
        hex: cleanHex,
        at: new Date().toISOString(),
      };
    }

    const party = {
      ...currentParty,
      hex: cleanHex,
      label: stringValue(draft?.label) || stringValue(currentParty.label) || "Charter Party",
      notes: draft?.notes == null ? stringValue(currentParty.notes) : stringValue(draft.notes),
      updatedAt: new Date().toISOString(),
      trail: nextTrail.slice(0, 30),
    };

    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        party,
      },
    });

    return party;
  };

  const clearHexMapParty = () => {
    const base = normalizeCampaignState(campaign);
    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        party: {
          ...(base.hexMap?.party || {}),
          hex: "",
          label: stringValue(base.hexMap?.party?.label) || "Charter Party",
          notes: stringValue(base.hexMap?.party?.notes),
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  const clearHexMapPartyTrail = () => {
    const base = normalizeCampaignState(campaign);
    replaceCampaign({
      ...base,
      hexMap: {
        ...base.hexMap,
        party: {
          ...(base.hexMap?.party || {}),
          trail: base.hexMap?.party?.hex
            ? [
                {
                  hex: base.hexMap.party.hex,
                  at: new Date().toISOString(),
                },
              ]
            : [],
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  const value = {
    campaign,
    desktopApi,
    isHydrating,
    lastSavedAt,
    persistenceError,
    actions: {
      replaceCampaign,
      updateCampaign,
      addSession,
      addCaptureEntry,
      deleteCaptureEntry,
      clearCaptureEntries,
      appendCaptureToSession,
      applyToLatestSession,
      updateAiConfig,
      saveRulesMemory,
      upsertRulesStoreEntry,
      removeRulesStoreEntry,
      upsertCompanion,
      removeCompanion,
      upsertNpc,
      removeNpc,
      upsertQuest,
      removeQuest,
      upsertLocation,
      removeLocation,
      upsertEvent,
      removeEvent,
      adjustEventClock,
      triggerEventConsequence,
      resolveEvent,
      saveKingdomOverview,
      addKingdomLeader,
      removeKingdomLeader,
      addKingdomSettlement,
      removeKingdomSettlement,
      addKingdomRegion,
      removeKingdomRegion,
      advanceKingdomCalendar,
      setKingdomCalendarDate,
      applyKingdomTurn,
      saveHexMapSettings,
      saveHexMapViewport,
      setHexMapPartyMoveMode,
      pickHexMapBackground,
      clearHexMapBackground,
      recenterHexMapBackground,
      addHexMapRegion,
      clearHexMapRegion,
      addHexMapMarker,
      updateHexMapMarker,
      removeHexMapMarker,
      addHexMapForce,
      updateHexMapForce,
      removeHexMapForce,
      moveHexMapParty,
      clearHexMapParty,
      clearHexMapPartyTrail,
      importCampaign: replaceCampaign,
      resetCampaign: () => replaceCampaign(createStarterState()),
    },
  };

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error("useCampaign must be used inside CampaignProvider.");
  }
  return context;
}
