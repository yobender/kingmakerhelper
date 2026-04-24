import { buildKingdomModel } from "./kingdom";
import { getActiveStoryPhase, isLiveCampaignRecord, recordMatchesActiveStoryPhase, shouldSurfaceRecordForFocus } from "./kingmakerFlow";

const ACTIVE_COMPANION_STATUSES = new Set(["prospective", "recruited", "traveling", "kingdom-role"]);
const QUEST_PRESSURE_STAGES = new Set(["available", "active"]);
const COMPANION_GUIDE_PAGES = Object.freeze({
  Amiri: 7,
  Ekundayo: 21,
  Jubilost: 33,
  Linzi: 45,
  "Nok-Nok": 57,
  Tristian: 69,
  Valerie: 83,
  Harrim: 95,
  Jaethal: 97,
  "Kalikke and Kanerah": 99,
  Octavia: 103,
  Regongar: 105,
});

export const COMPANION_SOURCE_ANCHORS = Object.freeze([
  {
    label: "Using Companions",
    page: 6,
    note: "Recruitment, influence encounters, reserve use, and personal quest cadence.",
  },
  {
    label: "Camping",
    page: 108,
    note: "Camp setup and where companions matter during overnight travel.",
  },
  {
    label: "Camping Activities",
    page: 110,
    note: "Watch, camouflage, cook, forage, and other camp-facing procedures.",
  },
  {
    label: "Weather",
    page: 122,
    note: "Predict Weather and the Stolen Lands daily weather rhythm.",
  },
]);

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function priorityRank(companion) {
  const spotlight = stringValue(companion?.spotlight).toLowerCase();
  if (spotlight === "urgent") return 0;
  if (spotlight === "high") return 1;
  if (spotlight === "medium") return 2;
  return 3;
}

function statusRank(companion) {
  const status = stringValue(companion?.status).toLowerCase();
  if (status === "traveling") return 0;
  if (status === "recruited") return 1;
  if (status === "kingdom-role") return 2;
  if (status === "prospective") return 3;
  return 4;
}

function matchesCompanionName(companion, targetName) {
  return stringValue(companion?.name).toLowerCase() === stringValue(targetName).toLowerCase();
}

function summarizeTravelWatch(companion) {
  return [
    stringValue(companion?.travelState).replace(/-/g, " "),
    stringValue(companion?.currentHex),
    stringValue(companion?.campRole),
  ]
    .filter(Boolean)
    .join(" / ");
}

export function getCompanionGuidePage(name) {
  const clean = stringValue(name).toLowerCase();
  if (!clean) return 0;
  const match = Object.entries(COMPANION_GUIDE_PAGES).find(([key]) => key.toLowerCase() === clean);
  return match ? Number.parseInt(String(match[1] || "0"), 10) || 0 : 0;
}

export function getCompanionInfluenceBand(value) {
  const influence = Math.max(0, Math.trunc(numberValue(value, 0)));
  if (influence >= 8) return { label: "Confidant", detail: "Strong trust and frequent spotlight." };
  if (influence >= 5) return { label: "Trusted", detail: "Reliable ally with meaningful buy-in." };
  if (influence >= 3) return { label: "Friendly", detail: "Comfortable traveling and opening up." };
  if (influence >= 1) return { label: "Warming", detail: "Moving past first impressions." };
  return { label: "Unproven", detail: "Still testing whether the charter is worth trusting." };
}

export function buildCompanionsModel(campaign) {
  const storyPhase = getActiveStoryPhase(campaign);
  const companions = [...(campaign?.companions || [])]
    .sort((left, right) => {
      const statusDelta = statusRank(left) - statusRank(right);
      if (statusDelta !== 0) return statusDelta;
      const priorityDelta = priorityRank(left) - priorityRank(right);
      if (priorityDelta !== 0) return priorityDelta;
      const influenceDelta = numberValue(right?.influence, 0) - numberValue(left?.influence, 0);
      if (influenceDelta !== 0) return influenceDelta;
      return stringValue(left?.name).localeCompare(stringValue(right?.name));
    });

  const activeCompanions = companions.filter((entry) => isLiveCampaignRecord(entry) && ACTIVE_COMPANION_STATUSES.has(stringValue(entry?.status).toLowerCase()));
  const focusReferenceCompanions = companions.filter((entry) => !isLiveCampaignRecord(entry) && recordMatchesActiveStoryPhase(entry, campaign));
  const visibleCompanions = [...activeCompanions, ...focusReferenceCompanions].filter(
    (entry, index, list) => list.findIndex((candidate) => stringValue(candidate?.id) === stringValue(entry?.id)) === index
  );
  const focusedRecords = (records = []) => records.filter((entry) => shouldSurfaceRecordForFocus(entry, campaign));
  const partyHex = stringValue(campaign?.hexMap?.party?.hex);
  const withParty = activeCompanions.filter(
    (entry) =>
      stringValue(entry?.travelState).toLowerCase() === "with-party"
      || (partyHex && stringValue(entry?.currentHex).toUpperCase() === partyHex.toUpperCase())
  );
  const questPressure = activeCompanions.filter(
    (entry) =>
      QUEST_PRESSURE_STAGES.has(stringValue(entry?.questStage).toLowerCase())
      || Boolean(stringValue(entry?.nextScene))
      || Boolean(stringValue(entry?.linkedQuest))
  );
  const kingdomRoleWatch = activeCompanions.filter((entry) => stringValue(entry?.kingdomRole));
  const attentionRoster = activeCompanions
    .filter(
      (entry) =>
        stringValue(entry?.spotlight).toLowerCase() === "urgent"
        || stringValue(entry?.spotlight).toLowerCase() === "high"
        || QUEST_PRESSURE_STAGES.has(stringValue(entry?.questStage).toLowerCase())
        || Boolean(stringValue(entry?.nextScene))
    )
    .slice(0, 6);
  const folderOptions = [...new Set(visibleCompanions.map((entry) => stringValue(entry?.folder)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: value,
    }));
  const questOptions = focusedRecords(campaign?.quests)
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: value,
    }));
  const eventOptions = focusedRecords(campaign?.events)
    .map((entry) => stringValue(entry?.title))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: value,
    }));
  const locationWatch = focusedRecords(campaign?.locations);
  const eventWatch = focusedRecords(campaign?.events);
  const kingdomModel = buildKingdomModel(campaign);
  const sourceAnchors = [...COMPANION_SOURCE_ANCHORS];

  return {
    companions: visibleCompanions,
    allCompanions: companions,
    storyPhase,
    activeCompanions,
    focusReferenceCompanions,
    withParty,
    questPressure,
    kingdomRoleWatch,
    attentionRoster,
    folderOptions,
    questOptions,
    eventOptions,
    sourceAnchors,
    partyHex,
    partyLabel: stringValue(campaign?.hexMap?.party?.label) || "Charter Party",
    locations: locationWatch,
    events: eventWatch,
    quests: focusedRecords(campaign?.quests),
    roleOptions: kingdomModel.roleOptions || [],
    summaryCards: [
      {
        label: "Tracked Roster",
        value: `${activeCompanions.length}`,
        helper: activeCompanions.length
          ? `${activeCompanions.length} active or recruitable / ${companions.filter((entry) => isLiveCampaignRecord(entry) && stringValue(entry?.status).toLowerCase() === "departed").length} departed`
          : `No live companions yet. ${focusReferenceCompanions.length} ${storyPhase.shortLabel} reference companion(s) are available.`,
        valueTone: "number",
      },
      {
        label: "With Party",
        value: `${withParty.length}`,
        helper: withParty[0]
          ? `${withParty[0].name} leads the visible companion presence${summarizeTravelWatch(withParty[0]) ? ` / ${summarizeTravelWatch(withParty[0])}` : ""}`
          : partyHex
            ? `${partyHex} is the current party hex, but no companion is marked as traveling with them yet.`
            : "No party hex is set yet.",
        valueTone: "number",
      },
      {
        label: "Quest Pressure",
        value: `${questPressure.length}`,
        helper: questPressure[0]
          ? `${questPressure[0].name}: ${stringValue(questPressure[0].nextScene || questPressure[0].personalQuest || questPressure[0].questTrigger)}`
          : "No personal-quest pressure is queued right now.",
        valueTone: "number",
      },
      {
        label: "Kingdom Roles",
        value: `${kingdomRoleWatch.length}`,
        helper: kingdomRoleWatch[0]
          ? `${kingdomRoleWatch[0].name} / ${stringValue(kingdomRoleWatch[0].kingdomRole)}`
          : "No companion has a kingdom-role fit recorded yet.",
        valueTone: "number",
      },
    ],
  };
}

export function collectLinkedCompanionEvents(campaign, companionDraft) {
  const companionName = stringValue(companionDraft?.name);
  const linkedEventTitle = stringValue(companionDraft?.linkedEvent);
  return [...(campaign?.events || [])].filter(
    (entry) =>
      shouldSurfaceRecordForFocus(entry, campaign) &&
      (matchesCompanionName({ name: entry?.linkedCompanion }, companionName)
        || stringValue(entry?.title) === linkedEventTitle
        || stringValue(entry?.hex) === stringValue(companionDraft?.currentHex))
  );
}

export function collectLinkedCompanionQuests(campaign, companionDraft) {
  const companionName = stringValue(companionDraft?.name);
  const linkedQuestTitle = stringValue(companionDraft?.linkedQuest);
  return [...(campaign?.quests || [])].filter(
    (entry) =>
      shouldSurfaceRecordForFocus(entry, campaign) &&
      (matchesCompanionName({ name: entry?.linkedCompanion }, companionName)
        || stringValue(entry?.title) === linkedQuestTitle)
  );
}

export function collectCompanionHexLocations(campaign, companionDraft) {
  const hex = stringValue(companionDraft?.currentHex).toUpperCase();
  if (!hex) return [];
  return [...(campaign?.locations || [])].filter((entry) => shouldSurfaceRecordForFocus(entry, campaign) && stringValue(entry?.hex).toUpperCase() === hex);
}
