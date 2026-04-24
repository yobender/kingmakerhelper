import { buildCompanionsModel } from "./companions";
import { buildEventsModel, buildEventReferenceLine } from "./events";
import { KINGMAKER_STORY_PHASES } from "./kingmakerFlow";
import { buildLocationsModel } from "./locations";
import { buildNpcsModel } from "./npcs";
import { buildQuestsModel } from "./quests";
import { buildCommandCenterModel, getSessionDateLabel } from "./selectors";
import sourceManifest from "../../../kingmaker-source-manifest.json";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function firstNonEmpty(...values) {
  return values.map((value) => stringValue(value)).find(Boolean) || "";
}

function uniqueByKey(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recordTitle(record, fallback = "Untitled") {
  return firstNonEmpty(record?.title, record?.name, fallback);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAdventurePathSource() {
  return (Array.isArray(sourceManifest?.canonicalSources) ? sourceManifest.canonicalSources : []).find(
    (source) => stringValue(source?.id) === "adventure-path",
  );
}

function getChapterSourceAnchors(phase = {}) {
  const source = getAdventurePathSource();
  const sections = Array.isArray(source?.sections) ? source.sections : [];
  if (!sections.length) return [];

  if (phase.chapter === "Kingdom Founding") {
    return sections
      .filter((section) => /appendix 2:\s*kingdoms/i.test(stringValue(section.title)))
      .map((section) => ({
        title: stringValue(section.title),
        pageStart: numberValue(section.pageStart),
        depth: numberValue(section.depth),
        sourceTitle: stringValue(source.displayTitle),
      }));
  }

  const chapterIndex = sections.findIndex((section) => stringValue(section.title).toLowerCase() === stringValue(phase.chapter).toLowerCase());
  if (chapterIndex < 0) return [];

  const chapterDepth = numberValue(sections[chapterIndex]?.depth, 0);
  const anchors = [];
  for (let index = chapterIndex; index < sections.length; index += 1) {
    const section = sections[index];
    const depth = numberValue(section.depth, 0);
    if (index !== chapterIndex && depth <= chapterDepth) break;
    anchors.push({
      title: stringValue(section.title),
      pageStart: numberValue(section.pageStart),
      depth,
      sourceTitle: stringValue(source.displayTitle),
    });
  }
  return anchors;
}

function formatSourcePage(pageStart) {
  const page = numberValue(pageStart, 0);
  return page > 0 ? `p. ${page}` : "Source";
}

function questRow(quest, { reference = false } = {}) {
  return {
    id: quest.id,
    kind: "quest",
    label: reference ? "Reference Quest" : "Live Quest",
    title: recordTitle(quest, "Quest"),
    meta: [stringValue(quest.priority), stringValue(quest.status), stringValue(quest.chapter)].filter(Boolean).join(" / "),
    body: firstNonEmpty(quest.nextBeat, quest.objective, quest.stakes, quest.notes),
    path: "/world/quests",
    reference,
  };
}

function eventRow(eventItem, { reference = false } = {}) {
  return {
    id: eventItem.id,
    kind: "event",
    label: reference ? "Reference Event" : "Live Event",
    title: recordTitle(eventItem, "Event"),
    meta: buildEventReferenceLine(eventItem),
    body: firstNonEmpty(eventItem.trigger, eventItem.consequenceSummary, eventItem.fallout, eventItem.notes),
    path: "/world/events",
    reference,
  };
}

function npcRow(npc, { reference = false } = {}) {
  return {
    id: npc.id,
    kind: "npc",
    label: reference ? "Reference NPC" : "Live NPC",
    title: recordTitle(npc, "NPC"),
    meta: [stringValue(npc.role), stringValue(npc.status), stringValue(npc.location)].filter(Boolean).join(" / "),
    body: firstNonEmpty(npc.pressure, npc.agenda, npc.nextScene, npc.notes),
    path: "/world/npcs",
    reference,
  };
}

function locationRow(location, { reference = false } = {}) {
  return {
    id: location.id,
    kind: "location",
    label: reference ? "Reference Location" : "Live Location",
    title: recordTitle(location, "Location"),
    meta: [stringValue(location.type), stringValue(location.status), stringValue(location.hex)].filter(Boolean).join(" / "),
    body: firstNonEmpty(location.whatChanged, location.risks, location.opportunities, location.notes),
    path: "/world/locations",
    reference,
  };
}

function companionRow(companion, { reference = false } = {}) {
  return {
    id: companion.id,
    kind: "companion",
    label: reference ? "Reference Companion" : "Live Companion",
    title: recordTitle(companion, "Companion"),
    meta: [stringValue(companion.status), stringValue(companion.travelState), stringValue(companion.kingdomRole)].filter(Boolean).join(" / "),
    body: firstNonEmpty(companion.nextScene, companion.personalQuest, companion.questTrigger, companion.notes),
    path: "/world/companions",
    reference,
  };
}

export function buildRunKingmakerModel(campaign) {
  const command = buildCommandCenterModel(campaign);
  const quests = buildQuestsModel(campaign);
  const events = buildEventsModel(campaign);
  const npcs = buildNpcsModel(campaign);
  const locations = buildLocationsModel(campaign);
  const companions = buildCompanionsModel(campaign);
  const latestSession = command.latestSession;

  const liveRows = uniqueByKey(
    [
      ...quests.activeQuests.slice(0, 4).map((entry) => questRow(entry)),
      ...events.activeEvents.slice(0, 4).map((entry) => eventRow(entry)),
      ...locations.activeLocations.slice(0, 3).map((entry) => locationRow(entry)),
      ...npcs.activeNpcs.slice(0, 3).map((entry) => npcRow(entry)),
      ...companions.activeCompanions.slice(0, 3).map((entry) => companionRow(entry)),
    ],
    (item) => `${item.kind}:${item.id}`,
  ).slice(0, 10);

  const referenceRows = uniqueByKey(
    [
      ...quests.focusReferenceQuests.slice(0, 4).map((entry) => questRow(entry, { reference: true })),
      ...events.focusReferenceEvents.slice(0, 4).map((entry) => eventRow(entry, { reference: true })),
      ...locations.focusReferenceLocations.slice(0, 4).map((entry) => locationRow(entry, { reference: true })),
      ...npcs.focusReferenceNpcs.slice(0, 4).map((entry) => npcRow(entry, { reference: true })),
      ...companions.focusReferenceCompanions.slice(0, 3).map((entry) => companionRow(entry, { reference: true })),
    ],
    (item) => `${item.kind}:${item.id}`,
  ).slice(0, 12);

  const activeCounts = {
    quests: quests.activeQuests.length,
    events: events.activeEvents.length,
    npcs: npcs.activeNpcs.length,
    locations: locations.activeLocations.length,
    companions: companions.activeCompanions.length,
  };
  const referenceCounts = {
    quests: quests.focusReferenceQuests.length,
    events: events.focusReferenceEvents.length,
    npcs: npcs.focusReferenceNpcs.length,
    locations: locations.focusReferenceLocations.length,
    companions: companions.focusReferenceCompanions.length,
  };

  const totalActive = Object.values(activeCounts).reduce((sum, value) => sum + value, 0);
  const totalReference = Object.values(referenceCounts).reduce((sum, value) => sum + value, 0);
  const storyFocus = campaign?.meta?.storyFocus || {};
  const sourceAnchors = getChapterSourceAnchors(command.storyPhase);
  const chapterCards = KINGMAKER_STORY_PHASES.map((phase) => ({
    id: phase.id,
    label: phase.label,
    shortLabel: phase.shortLabel,
    lane: phase.lane,
    chapter: phase.chapter,
    summary: phase.summary,
    pageLabel: formatSourcePage(phase.sourcePageStart),
    active: phase.id === command.storyPhase.id,
  }));
  const chapterGuide = {
    label: command.storyPhase.label,
    shortLabel: command.storyPhase.shortLabel,
    lane: command.storyPhase.lane,
    chapter: command.storyPhase.chapter,
    pageLabel: formatSourcePage(command.storyPhase.sourcePageStart),
    summary: command.storyPhase.summary,
    dmBrief: command.storyPhase.dmBrief || command.storyPhase.summary,
    runBeats: Array.isArray(command.storyPhase.runBeats) ? command.storyPhase.runBeats : [],
    keepHandy: Array.isArray(command.storyPhase.keepHandy) ? command.storyPhase.keepHandy : [],
    sourceAnchors: sourceAnchors.slice(0, 8).map((anchor) => ({
      ...anchor,
      pageLabel: formatSourcePage(anchor.pageStart),
    })),
    sourceCount: sourceAnchors.length,
    referenceCount: totalReference,
    liveCount: totalActive,
  };

  return {
    storyPhase: command.storyPhase,
    command,
    quests,
    events,
    npcs,
    locations,
    companions,
    latestSession,
    latestSessionDate: latestSession ? getSessionDateLabel(latestSession) : "No session logged",
    liveRows,
    referenceRows,
    activeCounts,
    referenceCounts,
    runSheet: command.runSheet,
    prepItems: command.prepItems,
    chapterCards,
    chapterGuide,
    aiContext: [
      {
        label: "Story Phase",
        value: command.storyPhase.shortLabel,
        detail: command.storyPhase.summary,
      },
      {
        label: "Live State",
        value: `${totalActive} record(s)`,
        detail: "Only activated records are treated as confirmed table truth.",
      },
      {
        label: "Reference Shelf",
        value: storyFocus.includeReferenceInAi === false ? "Hidden from AI" : `${totalReference} focused hint(s)`,
        detail: "Reference items stay advisory until the DM activates them.",
      },
      {
        label: "Opening Context",
        value: "Explicit only",
        detail: "Jamandi/Oleg opening material stays out unless the question asks for an opener or scene.",
      },
    ],
    checklist: [
      {
        label: "Choose active AP phase",
        done: Boolean(command.storyPhase?.id),
        helper: command.storyPhase.label,
      },
      {
        label: "Log the current or next session",
        done: Boolean(latestSession),
        helper: latestSession ? `${latestSession.title} / ${getSessionDateLabel(latestSession)}` : "No session exists yet.",
      },
      {
        label: "Activate tonight's quest or pressure",
        done: quests.activeQuests.length > 0 || events.activeEvents.length > 0,
        helper: quests.activeQuests[0]?.title || events.activeEvents[0]?.title || "Use the reference queue below when the table reaches a beat.",
      },
      {
        label: "Confirm key people and places",
        done: npcs.activeNpcs.length > 0 || locations.activeLocations.length > 0,
        helper: npcs.activeNpcs[0]?.name || locations.activeLocations[0]?.name || "Activate NPCs and locations as they become table-visible.",
      },
    ],
    summaryCards: [
      {
        label: "Current Phase",
        value: command.storyPhase.shortLabel,
        helper: command.storyPhase.lane,
        valueTone: "compact",
      },
      {
        label: "Live Records",
        value: `${totalActive}`,
        helper: `${activeCounts.quests} quests / ${activeCounts.events} fronts / ${activeCounts.npcs + activeCounts.locations} people & places`,
        valueTone: "number",
      },
      {
        label: "Focused Reference",
        value: `${totalReference}`,
        helper: "Safe-to-review material for this phase.",
        valueTone: "number",
      },
      {
        label: "Tonight",
        value: latestSession ? latestSession.title : "Not logged",
        helper: latestSession ? getSessionDateLabel(latestSession) : "Create a session when prep begins.",
        valueTone: "compact",
      },
    ],
  };
}
