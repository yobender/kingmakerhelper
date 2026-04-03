import { formatGolarionDate, getGolarionMonthContext, sameGolarionMonth, toGolarionOrdinal } from "./golarion";
import { getSessionTypeLabel } from "./campaignState";

const ACTIVE_QUEST_STATUSES = new Set(["open", "in-progress", "watch"]);
const ACTIVE_EVENT_STATUSES = new Set(["seeded", "active", "escalated"]);
const ACTIVE_COMPANION_STATUSES = new Set(["prospective", "recruited", "traveling", "kingdom-role"]);
const QUEST_PRIORITY_RANK = Object.freeze({ now: 0, soon: 1, later: 2, someday: 3 });

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitNotes(value) {
  const text = stringValue(value);
  if (!text) return [];
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((entry) => entry.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function firstNonEmpty(...values) {
  return values.map((value) => stringValue(value)).find(Boolean) || "";
}

function pushActionItem(items, seen, { text, label, path, actionLabel }) {
  const safeText = stringValue(text);
  if (!safeText) return;
  const safePath = stringValue(path) || "/campaign/command-center";
  const key = `${safeText.toLowerCase()}::${safePath}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push({
    id: key,
    text: safeText,
    label: stringValue(label),
    path: safePath,
    actionLabel: stringValue(actionLabel) || "Open",
  });
}

function buildLatestSessionMetric(session) {
  const title = stringValue(session?.title);
  const match = title.match(/^(session\s+\d+)\s*[-:]\s*(.+)$/i);
  if (match) {
    return {
      value: match[1].replace(/\s+/g, " ").replace(/^./, (char) => char.toUpperCase()),
      detail: match[2],
    };
  }
  return {
    value: title || "No session logged",
    detail: "",
  };
}

function sortSessions(left, right) {
  const delta = toGolarionOrdinal(right?.date) - toGolarionOrdinal(left?.date);
  if (delta !== 0) return delta;
  return String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || ""));
}

export function getLatestSession(state) {
  return [...(state.sessions || [])].sort(sortSessions)[0] || null;
}

export function getActiveQuests(state) {
  return [...(state.quests || [])]
    .filter((quest) => ACTIVE_QUEST_STATUSES.has(stringValue(quest.status).toLowerCase()))
    .sort((left, right) => {
      const priorityDelta =
        (QUEST_PRIORITY_RANK[stringValue(left.priority).toLowerCase()] ?? 99) -
        (QUEST_PRIORITY_RANK[stringValue(right.priority).toLowerCase()] ?? 99);
      if (priorityDelta !== 0) return priorityDelta;
      return String(left.title || "").localeCompare(String(right.title || ""));
    });
}

export function getActiveEvents(state) {
  return [...(state.events || [])]
    .filter((eventItem) => ACTIVE_EVENT_STATUSES.has(stringValue(eventItem.status).toLowerCase()))
    .sort((left, right) => {
      const urgencyDelta = numberValue(right.urgency, 0) - numberValue(left.urgency, 0);
      if (urgencyDelta !== 0) return urgencyDelta;
      const leftRatio = numberValue(left.clock, 0) / Math.max(1, numberValue(left.clockMax, 1));
      const rightRatio = numberValue(right.clock, 0) / Math.max(1, numberValue(right.clockMax, 1));
      return rightRatio - leftRatio;
    });
}

export function getTrackedCompanions(state) {
  return [...(state.companions || [])]
    .filter((companion) => ACTIVE_COMPANION_STATUSES.has(stringValue(companion.status).toLowerCase()))
    .sort((left, right) => numberValue(right.influence, 0) - numberValue(left.influence, 0));
}

export function getSessionDateLabel(session) {
  return formatGolarionDate(session?.date, { fallback: "No date" });
}

export function getSessionSearchText(session) {
  return [
    session?.title,
    session?.date,
    session?.type,
    session?.arc,
    session?.chapter,
    session?.focusHex,
    session?.leadCompanion,
    session?.travelObjective,
    session?.weather,
    session?.pressure,
    session?.summary,
    session?.nextPrep,
  ]
    .map((value) => stringValue(value))
    .join(" ")
    .toLowerCase();
}

export function buildCommandCenterModel(state) {
  const latestSession = getLatestSession(state);
  const activeQuests = getActiveQuests(state);
  const activeEvents = getActiveEvents(state);
  const companions = getTrackedCompanions(state);
  const kingdom = state.kingdom || {};
  const monthContext = getGolarionMonthContext(kingdom.currentDate || kingdom.calendarStartDate);
  const sessionsThisMonth = (state.sessions || []).filter((session) => sameGolarionMonth(session?.date, monthContext.currentDate));
  const kingdomTurnsThisMonth = (kingdom.turns || []).filter((turn) => sameGolarionMonth(turn?.date, monthContext.currentDate));
  const prepItems = [];
  const prepSeen = new Set();
  const pendingProjects = (kingdom.pendingProjects || []).map((item) => stringValue(item)).filter(Boolean);
  const leadershipAssigned = (kingdom.leaders || []).filter((leader) => stringValue(leader.name) && !/choose the party ruler/i.test(stringValue(leader.name))).length;
  const latestSessionMetric = buildLatestSessionMetric(latestSession);
  const compactDateValue = monthContext.parsed ? `${monthContext.parsed.day} ${monthContext.parsed.monthData.name}` : formatGolarionDate(monthContext.currentDate);
  const currentDateHelper = monthContext.parsed
    ? `${monthContext.parsed.year} AR / ${monthContext.daysRemaining} days left in month`
    : `${monthContext.monthLabel} / ${monthContext.daysRemaining} days left in month`;

  splitNotes(latestSession?.nextPrep).forEach((item) =>
    pushActionItem(prepItems, prepSeen, {
      text: item,
      label: "Session prep handoff",
      path: "/campaign/adventure-log",
      actionLabel: "Open Adventure Log",
    })
  );

  pushActionItem(prepItems, prepSeen, {
    text: latestSession?.travelObjective,
    label: "Travel objective",
    path: "/world/hex-map",
    actionLabel: "Open Hex Map",
  });

  activeQuests.forEach((quest) =>
    pushActionItem(prepItems, prepSeen, {
      text: firstNonEmpty(quest.nextBeat, quest.objective),
      label: quest.title ? `Quest: ${quest.title}` : "Quest thread",
      path: "/world/quests",
      actionLabel: "Open Quests",
    })
  );

  activeEvents.forEach((eventItem) =>
    pushActionItem(prepItems, prepSeen, {
      text: firstNonEmpty(eventItem.trigger, eventItem.consequenceSummary, eventItem.title),
      label: eventItem.title ? `Event: ${eventItem.title}` : "Event clock",
      path: "/world/events",
      actionLabel: "Open Events",
    })
  );

  companions.slice(0, 2).forEach((companion) =>
    pushActionItem(prepItems, prepSeen, {
      text: firstNonEmpty(companion.personalQuest, companion.notes),
      label: companion.name ? `Companion: ${companion.name}` : "Companion beat",
      path: "/world/companions",
      actionLabel: "Open Companions",
    })
  );

  return {
    latestSession,
    activeQuests,
    activeEvents,
    companions,
    kingdom,
    monthContext,
    sessionsThisMonth,
    kingdomTurnsThisMonth,
    prepItems: prepItems.slice(0, 6),
    pendingProjects,
    leadershipAssigned,
    runSheet: [
      {
        label: "Open on",
        text: firstNonEmpty(
          splitNotes(latestSession?.summary)[0],
          activeQuests[0]?.objective,
          "Start at the frontier edge and make the table choose between speed, safety, and rumor value."
        ),
        path: "/campaign/adventure-log",
        actionLabel: "Open Adventure Log",
        helper: "Latest session anchor",
      },
      {
        label: "Put pressure on",
        text: firstNonEmpty(
          activeEvents[0]?.trigger,
          latestSession?.pressure,
          activeQuests[0]?.stakes,
          "Advance one frontier clock and make the consequence visible before the party can ignore it."
        ),
        path: "/world/events",
        actionLabel: "Open Events",
        helper: activeEvents[0]?.title ? `Event clock: ${activeEvents[0].title}` : "Current pressure lane",
      },
      {
        label: "Hand off with",
        text: firstNonEmpty(
          activeQuests[0]?.nextBeat,
          splitNotes(latestSession?.nextPrep)[0],
          "Close on the next kingdom-facing decision so the following session opens with momentum."
        ),
        path: activeQuests[0] ? "/world/quests" : "/campaign/adventure-log",
        actionLabel: activeQuests[0] ? "Open Quests" : "Open Adventure Log",
        helper: activeQuests[0]?.title ? `Quest beat: ${activeQuests[0].title}` : "Prep handoff",
      },
    ],
    spotlightText: firstNonEmpty(
      latestSession?.travelObjective,
      activeQuests[0]?.objective,
      "Use the charter, Oleg's pressure, and the first unexplored hexes to keep the opening grounded."
    ),
    summaryCards: [
      {
        label: "Current Date",
        value: compactDateValue,
        helper: currentDateHelper,
        valueTone: "compact",
        chip: "Kingdom",
        path: "/world/kingdom",
        actionLabel: "Open Kingdom",
      },
      {
        label: "Latest Session",
        value: latestSessionMetric.value,
        helper: latestSession
          ? [latestSessionMetric.detail, getSessionTypeLabel(latestSession.type), getSessionDateLabel(latestSession)].filter(Boolean).join(" / ")
          : "Start with the next frontier beat.",
        valueTone: "compact",
        chip: "Adventure Log",
        path: "/campaign/adventure-log",
        actionLabel: "Open Adventure Log",
      },
      {
        label: "Open Pressure",
        value: `${activeEvents.length}`,
        helper: activeEvents[0]?.title || "No active event clocks recorded.",
        valueTone: "number",
        chip: "Events",
        path: "/world/events",
        actionLabel: "Open Events",
      },
      {
        label: "Kingdom Handoff",
        value: kingdomTurnsThisMonth.length ? "Logged" : monthContext.daysRemaining <= 5 ? "Due Soon" : "Not Due",
        helper: `${sessionsThisMonth.length} sessions logged this month`,
        valueTone: "compact",
        chip: "Turn Review",
        path: "/world/kingdom",
        actionLabel: "Open Kingdom",
      },
    ],
  };
}

export function buildAdventureLogModel(state) {
  const sessions = [...(state.sessions || [])].sort(sortSessions);
  const latestSession = sessions[0] || null;
  const activeQuests = getActiveQuests(state);
  const activeEvents = getActiveEvents(state);
  const kingdom = state.kingdom || {};
  const monthContext = getGolarionMonthContext(kingdom.currentDate || kingdom.calendarStartDate);
  const sessionsThisMonth = sessions.filter((session) => sameGolarionMonth(session?.date, monthContext.currentDate));
  const kingdomTurnsThisMonth = (kingdom.turns || []).filter((turn) => sameGolarionMonth(turn?.date, monthContext.currentDate));

  return {
    sessions,
    latestSession,
    activeQuests,
    activeEvents,
    monthContext,
    sessionsThisMonth,
    kingdomTurnsThisMonth,
    latestPrepItems: splitNotes(latestSession?.nextPrep).slice(0, 6),
    latestSummaryItems: splitNotes(latestSession?.summary).slice(0, 4),
  };
}
