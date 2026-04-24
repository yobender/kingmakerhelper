import kingdomRulesData from "../../../kingdom-rules-data.json";
import {
  GOLARION_MONTHS,
  diffGolarionDates,
  formatGolarionDate,
  getGolarionMonthContext,
  normalizeGolarionDate,
  parseGolarionDate,
  sameGolarionMonth,
  toGolarionOrdinal,
} from "./golarion";
import { isLiveCampaignRecord } from "./kingmakerFlow";

const ACTIVE_KINGDOM_EVENT_STATUSES = new Set(["seeded", "active", "escalated", "cooldown"]);
const SETTLEMENT_ACTIONS = Object.freeze({
  "Town Hall": 1,
  Castle: 2,
  Palace: 2,
});

export const KINGDOM_RESOURCE_DIE_OPTIONS = ["d4", "d6", "d8", "d10", "d12"];
export const KINGDOM_LEADER_TYPE_OPTIONS = ["PC", "NPC"];
export const KINGDOM_SETTLEMENT_SIZE_OPTIONS = ["Village", "Town", "City", "Metropolis"];
export const KINGDOM_CIVIC_STRUCTURE_OPTIONS = ["", "Town Hall", "Castle", "Palace"];
export const KINGDOM_REGION_STATUS_OPTIONS = ["Claimed", "Reconnoitered", "Work Site", "Settlement", "Contested"];
export const KINGDOM_TERRAIN_OPTIONS = ["Plains", "Forest", "Hills", "Mountains", "Marsh", "River", "Lake", "Ruins", "Road", "Settlement"];

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

function sortByDateDescending(left, right, field = "date") {
  const delta = toGolarionOrdinal(right?.[field]) - toGolarionOrdinal(left?.[field]);
  if (delta !== 0) return delta;
  return String(right?.updatedAt || right?.createdAt || "").localeCompare(String(left?.updatedAt || left?.createdAt || ""));
}

function isPlaceholderLeaderName(name) {
  const clean = stringValue(name).toLowerCase();
  return !clean || clean === "unassigned" || clean.includes("choose the party ruler") || clean.includes("choose the");
}

export function normalizeKingdomHex(value) {
  return stringValue(value).replace(/\s+/g, "").toUpperCase();
}

export function formatSignedNumber(value) {
  const amount = Math.trunc(numberValue(value, 0));
  return amount >= 0 ? `+${amount}` : String(amount);
}

export function getKingdomRulesProfiles() {
  return Array.isArray(kingdomRulesData?.profiles) ? kingdomRulesData.profiles : [];
}

export function getDefaultKingdomProfileId() {
  return stringValue(kingdomRulesData?.latestProfileId) || "vk-remastered-stacked";
}

export function getKingdomProfileById(id) {
  const clean = stringValue(id);
  return getKingdomRulesProfiles().find((profile) => stringValue(profile?.id) === clean) || null;
}

export function getKingdomRoleOptions(profileId = getDefaultKingdomProfileId()) {
  const profile = getKingdomProfileById(profileId);
  return Array.isArray(profile?.leadershipRoles) ? profile.leadershipRoles.map((entry) => stringValue(entry?.role)).filter(Boolean) : [];
}

export function getControlDcForLevel(profile, level) {
  const normalizedLevel = Math.max(1, Math.trunc(numberValue(level, 1)));
  const table = Array.isArray(profile?.advancement) ? profile.advancement : [];
  return numberValue(table.find((entry) => Math.trunc(numberValue(entry?.level, 0)) === normalizedLevel)?.controlDC, 14);
}

export function getSettlementActionCount(settlement) {
  return SETTLEMENT_ACTIONS[stringValue(settlement?.civicStructure)] || 0;
}

export function buildKingdomCalendarEntrySummary(entry) {
  const startDate = normalizeGolarionDate(entry?.startDate || entry?.date);
  const endDate = normalizeGolarionDate(entry?.endDate || entry?.date || startDate, startDate);
  const daysAdvanced = Math.abs(Math.trunc(numberValue(entry?.daysAdvanced, diffGolarionDates(startDate, endDate))));
  const rangeLabel =
    startDate === endDate
      ? formatGolarionDate(endDate)
      : `${formatGolarionDate(startDate, { includeYear: false })} -> ${formatGolarionDate(endDate)}`;
  const label = stringValue(entry?.label);
  return `${rangeLabel}${daysAdvanced > 1 ? ` (${daysAdvanced} days)` : ""}${label ? ` • ${label}` : ""}`;
}

export function buildKingdomCalendarMonthMatrix(value) {
  const parsed = parseGolarionDate(value) || parseGolarionDate(normalizeGolarionDate(value));
  if (!parsed) return [];

  const daysInMonth = parsed.monthData.days;
  const firstDay = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const cells = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      isoDate: `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export function buildKingdomDerivedState(kingdom, profile) {
  const activeProfile = profile || getKingdomProfileById(kingdom?.profileId) || getKingdomProfileById(getDefaultKingdomProfileId());
  const leaders = Array.isArray(kingdom?.leaders) ? kingdom.leaders : [];
  const settlements = Array.isArray(kingdom?.settlements) ? kingdom.settlements : [];
  const activeLeaders = leaders.filter((leader) => !isPlaceholderLeaderName(leader?.name));
  const pcLeaders = activeLeaders.filter((leader) => stringValue(leader?.type).toUpperCase() === "PC");
  const npcLeaders = activeLeaders.filter((leader) => stringValue(leader?.type).toUpperCase() !== "PC");
  const settlementActionDetails = settlements
    .map((settlement) => ({
      settlement,
      actions: getSettlementActionCount(settlement),
    }))
    .filter((entry) => entry.actions > 0);
  const settlementConsumption = settlements.reduce((sum, settlement) => sum + Math.max(0, Math.trunc(numberValue(settlement?.consumption, 0))), 0);
  const totalConsumption = Math.max(0, Math.trunc(numberValue(kingdom?.consumption, 0))) + settlementConsumption;
  const settlementResourceDice = settlements.reduce((sum, settlement) => sum + Math.max(0, Math.trunc(numberValue(settlement?.resourceDice, 0))), 0);
  const cityResourceDice = settlements.filter((settlement) => ["City", "Metropolis"].includes(stringValue(settlement?.size))).length;
  const threshold = Math.max(1, Math.trunc(numberValue(kingdom?.ruin?.threshold, 5)));
  const highestRuin = Math.max(
    Math.trunc(numberValue(kingdom?.ruin?.corruption, 0)),
    Math.trunc(numberValue(kingdom?.ruin?.crime, 0)),
    Math.trunc(numberValue(kingdom?.ruin?.decay, 0)),
    Math.trunc(numberValue(kingdom?.ruin?.strife, 0))
  );

  return {
    recommendedControlDC: getControlDcForLevel(activeProfile, kingdom?.level),
    controlDcOverride: Math.trunc(numberValue(kingdom?.controlDC, 14)) - getControlDcForLevel(activeProfile, kingdom?.level),
    pcLeaderActions: pcLeaders.length * 3,
    npcLeaderActions: npcLeaders.length * 2,
    settlementActions: settlementActionDetails.reduce((sum, entry) => sum + entry.actions, 0),
    settlementActionDetails,
    totalActions: pcLeaders.length * 3 + npcLeaders.length * 2 + settlementActionDetails.reduce((sum, entry) => sum + entry.actions, 0),
    settlementConsumption,
    totalConsumption,
    foodAfterUpkeep: Math.trunc(numberValue(kingdom?.commodities?.food, 0)) - totalConsumption,
    settlementResourceDice,
    cityResourceDice,
    highestRuin,
    ruinMargin: Math.max(0, threshold - highestRuin),
    peacefulNegotiationShift:
      -Math.floor(Math.max(0, numberValue(kingdom?.fame, 0)) / 10) + Math.floor(Math.max(0, numberValue(kingdom?.infamy, 0)) / 10),
    hostileNegotiationShift: -Math.floor(Math.max(0, numberValue(kingdom?.infamy, 0)) / 10),
    activeLeaderCount: activeLeaders.length,
    expectedRoleCount: Array.isArray(activeProfile?.leadershipRoles) ? activeProfile.leadershipRoles.length : 8,
  };
}

export function buildKingdomModel(campaign) {
  const kingdom = campaign?.kingdom || {};
  const profile =
    getKingdomProfileById(kingdom.profileId) ||
    getKingdomProfileById(getDefaultKingdomProfileId()) ||
    {
      id: "unknown",
      label: "Unknown Kingdom Profile",
      shortLabel: "Unknown",
      summary: "No kingdom rules profile is currently loaded.",
      leadershipRoles: [],
      quickStart: [],
      turnStructure: [],
      helpPrompts: [],
      sources: [],
    };
  const derived = buildKingdomDerivedState(kingdom, profile);
  const monthContext = getGolarionMonthContext(kingdom.currentDate || kingdom.calendarStartDate);
  const sessions = [...(campaign?.sessions || [])].sort((left, right) => sortByDateDescending(left, right, "date"));
  const sessionsThisMonth = sessions.filter((session) => sameGolarionMonth(session?.date, monthContext.currentDate));
  const kingdomTurnsThisMonth = [...(kingdom.turns || [])].filter((turn) => sameGolarionMonth(turn?.date, monthContext.currentDate));
  const activeKingdomEvents = [...(campaign?.events || [])]
    .filter(
      (eventItem) =>
        isLiveCampaignRecord(eventItem) &&
        stringValue(eventItem?.category).toLowerCase() === "kingdom" &&
        ACTIVE_KINGDOM_EVENT_STATUSES.has(stringValue(eventItem?.status).toLowerCase())
    )
    .sort((left, right) => {
      const urgencyDelta = Math.trunc(numberValue(right?.urgency, 0)) - Math.trunc(numberValue(left?.urgency, 0));
      if (urgencyDelta !== 0) return urgencyDelta;
      const leftRatio = numberValue(left?.clock, 0) / Math.max(1, numberValue(left?.clockMax, 1));
      const rightRatio = numberValue(right?.clock, 0) / Math.max(1, numberValue(right?.clockMax, 1));
      return rightRatio - leftRatio;
    });
  const recentEventHistory = [...(kingdom.eventHistory || [])].sort((left, right) => String(right?.at || "").localeCompare(String(left?.at || ""))).slice(0, 8);
  const companionRoleWatch = [...(campaign?.companions || [])]
    .filter((companion) => isLiveCampaignRecord(companion) && stringValue(companion?.kingdomRole))
    .sort((left, right) => Math.trunc(numberValue(right?.influence, 0)) - Math.trunc(numberValue(left?.influence, 0)))
    .slice(0, 8);
  const recentTurns = [...(kingdom.turns || [])].sort((left, right) => sortByDateDescending(left, right, "date")).slice(0, 8);
  const recentCalendarHistory = [...(kingdom.calendarHistory || [])]
    .sort((left, right) => String(right?.createdAt || right?.date || "").localeCompare(String(left?.createdAt || left?.date || "")))
    .slice(0, 12);
  const leadershipRoles = Array.isArray(profile?.leadershipRoles) ? profile.leadershipRoles : [];
  const leadershipSummary = leadershipRoles.map((roleDefinition) => {
    const assignment = (kingdom.leaders || []).find((leader) => stringValue(leader?.role) === stringValue(roleDefinition?.role));
    return {
      ...roleDefinition,
      assignedLeader: assignment || null,
    };
  });
  const clockLead = activeKingdomEvents[0] || null;
  const totalAssignedRoles = leadershipSummary.filter((entry) => entry.assignedLeader && !isPlaceholderLeaderName(entry.assignedLeader?.name)).length;

  return {
    kingdom,
    profile,
    derived,
    monthContext,
    sessionsThisMonth,
    kingdomTurnsThisMonth,
    activeKingdomEvents,
    recentEventHistory,
    companionRoleWatch,
    recentTurns,
    recentCalendarHistory,
    leadershipSummary,
    summaryCards: [
      {
        label: "Current Turn",
        value: stringValue(kingdom.currentTurnLabel) || "Turn 1",
        helper: formatGolarionDate(kingdom.currentDate),
        valueTone: "compact",
        chip: "Turns",
        path: "turns",
        subtab: "run",
        actionLabel: "Open Turn Workflow",
      },
      {
        label: "Rules Profile",
        value: stringValue(profile?.shortLabel || profile?.label) || "No profile",
        helper: `Control DC ${derived.recommendedControlDC} at level ${Math.max(1, Math.trunc(numberValue(kingdom.level, 1)))}`,
        valueTone: "long",
        chip: "Reference",
        path: "reference",
        subtab: "rules",
        actionLabel: "Open Reference",
      },
      {
        label: "Action Economy",
        value: String(derived.totalActions),
        helper: `${derived.pcLeaderActions} PC + ${derived.npcLeaderActions} NPC + ${derived.settlementActions} civic`,
        valueTone: "number",
        chip: "Leadership",
        path: "sheet",
        subtab: "leadership",
        actionLabel: "Open Leadership",
      },
      {
        label: "Ruin Watch",
        value: `${derived.highestRuin}/${Math.max(1, Math.trunc(numberValue(kingdom?.ruin?.threshold, 5)))}`,
        helper: `Unrest ${Math.trunc(numberValue(kingdom.unrest, 0))} / Renown ${Math.trunc(numberValue(kingdom.renown, 0))}`,
        valueTone: "compact",
        chip: "Turn Lane",
        path: "turns",
        subtab: "run",
        actionLabel: "Open Turn Lane",
      },
    ],
    overviewBullets: [
      `Assigned leadership roles: ${totalAssignedRoles}/${leadershipRoles.length || 8}.`,
      `Food after upkeep preview: ${derived.foodAfterUpkeep}.`,
      `This month has ${sessionsThisMonth.length} sessions logged and ${kingdomTurnsThisMonth.length} kingdom turns recorded.`,
      clockLead
        ? `${clockLead.title} is the hottest kingdom clock at ${Math.trunc(numberValue(clockLead.clock, 0))}/${Math.max(1, Math.trunc(numberValue(clockLead.clockMax, 1)))}.`
        : "No active kingdom-only pressure clock is currently tracked.",
    ],
    creationReference: profile?.creationReference || null,
    quickStart: Array.isArray(profile?.quickStart) ? profile.quickStart : [],
    turnStructure: Array.isArray(profile?.turnStructure) ? profile.turnStructure : [],
    helpPrompts: Array.isArray(profile?.helpPrompts) ? profile.helpPrompts : [],
    watchlist: [...(kingdom.pendingProjects || [])].map((entry) => stringValue(entry)).filter(Boolean),
    latestTurnSummary: splitNotes(recentTurns[0]?.summary).slice(0, 4),
    roleOptions: leadershipRoles.map((entry) => stringValue(entry?.role)).filter(Boolean),
  };
}

export const KINGDOM_WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
export { GOLARION_MONTHS };
