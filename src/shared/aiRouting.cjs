"use strict";

const PAGE_MODE_DEFAULT_INTENT = Object.freeze({
  ask: "general_chat",
  prep: "gm_prep",
  recall: "campaign_recall",
  create: "create_or_update_content",
});

const ALL_CONTEXT_BUCKETS = Object.freeze([
  "party",
  "campaign_summary",
  "rules",
  "gm_notes",
  "session_history",
  "kingdom_state",
  "lore",
  "opening_notes",
  "selected_target_record",
  "relevant_npc_location_notes",
]);

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeText(value) {
  return stringValue(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9@]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePageMode(value) {
  const clean = normalizeText(value);
  return clean === "prep" || clean === "recall" || clean === "create" ? clean : "ask";
}

function normalizeScopeTag(value) {
  const clean = normalizeText(value).replace(/^@+/, "");
  if (!clean) return "@app";
  return `@${clean}`;
}

function unique(values) {
  return [...new Set((values || []).map((entry) => stringValue(entry)).filter(Boolean))];
}

function hasBuildAskPattern(lower) {
  return (
    /\b(what should i play|what should i build|what class|which class|recommend|suggest|advice|pointers?|tips?|help me|should i play|should i build|help round out|round out|fill the gap|good fit|best fit|what about|how about|instead)\b/.test(
      lower
    ) ||
    /\b(build me|make me|good support|support character|fits our party|fits the party|party fit|party composition)\b/.test(lower) ||
    /\blevel\s*\d+\b/.test(lower) ||
    (/\bwhat\b/.test(lower) && /\bclasses?\b/.test(lower)) ||
    (/\bgood\b/.test(lower) && /\bclasses?\b/.test(lower))
  );
}

function detectPlayerBuildReasons(lower) {
  if (!lower) return [];
  const reasons = [];
  const partyTerms = /\b(build|class|classes|character|pc|party|group|team|composition|comp|role|roles|frontline|frontliner|tank|healer|support|damage|dps|skill|skills|caster|spellcaster|spell caster|int|intelligence|int based|arcane|prepared caster|ancestry|background|feat|feats|spell|spells|archetype|archetypes|ranged|melee|face|scout|pointers?|tips?|advice|playstyle)\b/.test(
    lower
  );
  const asksRecommendation = hasBuildAskPattern(lower);
  const pf2eClassTerms = /\b(alchemist|animist|barbarian|bard|champion|cleric|druid|exemplar|fighter|gunslinger|inventor|investigator|kineticist|magus|monk|oracle|psychic|ranger|rogue|sor|sorc|sorcerer|sorceror|summoner|swashbuckler|thaumaturge|witch|wizard)\b/.test(
    lower
  );
  const playingClass = pf2eClassTerms && /\b(play|playing|played|going to play|going to be playing|gonna play|pointers?|tips?|advice)\b/.test(lower);
  const partyMention = /\b(we have|we will have|there will be|party has|group has|our party|right now|as of right now)\b/.test(lower);
  if (asksRecommendation) reasons.push("matched build or class recommendation language");
  if (partyTerms) reasons.push("matched party or role terms");
  if (pf2eClassTerms) reasons.push("matched PF2e class terms");
  if (playingClass) reasons.push("matched playing-a-class advice language");
  if (partyMention) reasons.push("matched party composition language");
  if (/\blevel\s*\d+\b/.test(lower)) reasons.push("matched level-specific build language");
  if (/\b(int|intelligence|int based|arcane)\b/.test(lower) && /\b(caster|spellcaster|spell caster|class|build|character)\b/.test(lower)) {
    reasons.push("matched attribute plus caster build language");
  }
  const matched =
    (asksRecommendation && (partyTerms || pf2eClassTerms)) ||
    playingClass ||
    (partyTerms && pf2eClassTerms && (/\b(play|playing|party|group|team)\b/.test(lower) || partyMention)) ||
    (partyTerms && /\b(kingmaker|stolen lands|brevoy|jamandi|restov)\b/.test(lower) && /\b(play|playing|build|class|character)\b/.test(lower)) ||
    (/\blevel\s*\d+\b/.test(lower) && /\b(build|class|character|bard|cleric|fighter|rogue|wizard|witch|sor|sorc|sorcerer|sorceror|monk|ranger|champion)\b/.test(lower)) ||
    (/\b(int|intelligence|int based|arcane)\b/.test(lower) && /\b(caster|spellcaster|spell caster|class|build|character)\b/.test(lower));
  return matched ? unique(reasons) : [];
}

function detectRulesReasons(lower) {
  if (!lower) return [];
  const reasons = [];
  if (/\b(how does|how do|can i|does this work|does this stack|what happens if|explain|rules for|rule for|remaster rule|action economy)\b/.test(lower)) {
    reasons.push("matched explicit rules phrasing");
  }
  if (/\b(rule|rules|action economy|kingdom turns?|hexploration|control dc|unrest|consumption|leadership activity|settlement activity|claim|ruin|conditions?|check|dc)\b/.test(lower)) {
    reasons.push("matched mechanics keywords");
  }
  return unique(reasons);
}

function detectGmPrepReasons(lower) {
  if (!lower) return [];
  const reasons = [];
  if (/\b(prep|prepare|how should i run|session prep|prep this|prep for|how do i run|what should i prep next|what should i prep|what should i prep first|what do i prep first)\b/.test(lower)) {
    reasons.push("matched prep or run language");
  }
  if (/\b(encounter ideas?|hook|hooks|rumor|rumors|npc reaction|pacing|side quest|scene idea|for tonight|for tomorrow)\b/.test(lower)) {
    reasons.push("matched session-planning keywords");
  }
  if (/\b(oleg|bandit|attack|ambush|scene|pressure)\b/.test(lower) && /\b(prep|run|tonight|session)\b/.test(lower)) {
    reasons.push("matched concrete session-prep framing");
  }
  return unique(reasons);
}

function detectWorldLoreReasons(lower) {
  if (!lower) return [];
  const reasons = [];
  if (/\b(lore|tell me about|who is|what is|history of|background of|rostland|brevoy|stolen lands|river kingdoms)\b/.test(lower)) {
    reasons.push("matched lore language");
  }
  return unique(reasons);
}

function detectCampaignRecallReasons(lower) {
  if (!lower) return [];
  const reasons = [];
  if (/\b(recap|what happened|where are we|what have we done|what has happened|last session|current status|kingdom status|what has the party completed|what s unresolved|what is unresolved)\b/.test(lower)) {
    reasons.push("matched recall or recap language");
  }
  return unique(reasons);
}

function detectCreateOrUpdateReasons(lower) {
  if (!lower) return [];
  const reasons = [];
  if (/\b(create|update|generate|make me|make an|write|draft)\b/.test(lower)) {
    reasons.push("matched create or update verb");
  }
  if (/\b(npc|quest|event|location|table note|read aloud|rumor table|summary|opening narration|opening speech|intro scene)\b/.test(lower)) {
    reasons.push("matched content target");
  }
  const matched = /\b(create|update|generate|make me|make an|write|draft)\b/.test(lower) && /\b(npc|quest|event|location|table note|read aloud|rumor table|summary|opening narration|opening speech|intro scene)\b/.test(lower);
  return matched ? unique(reasons) : [];
}

function detectOpeningReasons(lower) {
  if (!lower) return [];
  const reasons = [];
  if (/\b(opening narration|opening scene|session opener|intro scene|read aloud|read aloud text|opening speech|campaign opening|open the campaign|start of the campaign)\b/.test(lower)) {
    reasons.push("matched explicit opening request");
  }
  if (/\b(first session|session one|session 1|session zero|session 0)\b/.test(lower) && /\b(opener|opening|intro|introduce|read aloud|narrat|scene)\b/.test(lower)) {
    reasons.push("matched first-session opener language");
  }
  if (/\b(jamandi|aldori|restov|feast|charter ceremony|charter)\b/.test(lower) && /\b(introduce|intro|opening|opener|start|read aloud|narrat|speech|scene)\b/.test(lower)) {
    reasons.push("matched Jamandi or Restov opening language");
  }
  if (/\b(oleg|trading post)\b/.test(lower) && /\b(arrive|arrival|introduce|intro|opening scene|opening|opener|first scene|read aloud|what would oleg say)\b/.test(lower)) {
    reasons.push("matched Oleg arrival opener language");
  }
  return unique(reasons);
}

function isPlayerBuildQuestion(value) {
  return detectPlayerBuildReasons(normalizeText(value)).length > 0;
}

function isRulesQuestion(value) {
  const lower = normalizeText(value);
  return detectPlayerBuildReasons(lower).length === 0 && detectRulesReasons(lower).length > 0;
}

function isGmPrepQuestion(value) {
  const lower = normalizeText(value);
  return (
    detectPlayerBuildReasons(lower).length === 0 &&
    detectRulesReasons(lower).length === 0 &&
    detectOpeningReasons(lower).length === 0 &&
    detectGmPrepReasons(lower).length > 0
  );
}

function isWorldLoreQuestion(value) {
  const lower = normalizeText(value);
  return (
    detectPlayerBuildReasons(lower).length === 0 &&
    detectRulesReasons(lower).length === 0 &&
    detectGmPrepReasons(lower).length === 0 &&
    detectCampaignRecallReasons(lower).length === 0 &&
    detectCreateOrUpdateReasons(lower).length === 0 &&
    detectOpeningReasons(lower).length === 0 &&
    detectWorldLoreReasons(lower).length > 0
  );
}

function isCampaignRecallQuestion(value) {
  return detectCampaignRecallReasons(normalizeText(value)).length > 0;
}

function isCreateOrUpdateQuestion(value) {
  return detectCreateOrUpdateReasons(normalizeText(value)).length > 0;
}

function isCampaignOpeningQuestion(value) {
  const lower = normalizeText(value);
  return (
    detectPlayerBuildReasons(lower).length === 0 &&
    detectRulesReasons(lower).length === 0 &&
    detectCampaignRecallReasons(lower).length === 0 &&
    detectCreateOrUpdateReasons(lower).length === 0 &&
    detectOpeningReasons(lower).length > 0
  );
}

function detectIntent(userMessage = "", selectedPageMode = "ask", scopeTag = "@app") {
  const lower = normalizeText(userMessage);
  const pageMode = normalizePageMode(selectedPageMode);
  const normalizedScopeTag = normalizeScopeTag(scopeTag);

  const playerBuildReasons = detectPlayerBuildReasons(lower);
  if (playerBuildReasons.length) {
    return {
      intent: "player_build",
      reasons: playerBuildReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }

  const rulesReasons = detectRulesReasons(lower);
  if (rulesReasons.length) {
    return {
      intent: "rules_question",
      reasons: rulesReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }

  const prepReasons = detectGmPrepReasons(lower);
  if (prepReasons.length) {
    return {
      intent: "gm_prep",
      reasons: prepReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }

  const loreReasons = detectWorldLoreReasons(lower);
  if (loreReasons.length) {
    return {
      intent: "world_lore",
      reasons: loreReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }

  const recallReasons = detectCampaignRecallReasons(lower);
  if (recallReasons.length) {
    return {
      intent: "campaign_recall",
      reasons: recallReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }

  const createReasons = detectCreateOrUpdateReasons(lower);
  const openingReasons = detectOpeningReasons(lower);
  if (createReasons.length && openingReasons.length) {
    return {
      intent: "session_start_or_opening",
      reasons: openingReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }
  if (createReasons.length) {
    return {
      intent: "create_or_update_content",
      reasons: createReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }

  if (openingReasons.length) {
    return {
      intent: "session_start_or_opening",
      reasons: openingReasons.slice(0, 3),
      selectedPageMode: pageMode,
      scopeTag: normalizedScopeTag,
    };
  }

  const fallbackIntent = PAGE_MODE_DEFAULT_INTENT[pageMode] || "general_chat";
  return {
    intent: fallbackIntent,
    reasons: [`page mode default: ${pageMode}`],
    selectedPageMode: pageMode,
    scopeTag: normalizedScopeTag,
  };
}

function selectAnswerMode(intent = "general_chat", selectedPageMode = "ask") {
  const pageMode = normalizePageMode(selectedPageMode);
  const modeByIntent = {
    player_build: "advice",
    rules_question: "rules",
    gm_prep: "prep",
    world_lore: "advice",
    campaign_recall: "recall",
    create_or_update_content: "create",
    session_start_or_opening: "narration",
    general_chat: pageMode === "prep" ? "prep" : pageMode === "recall" ? "recall" : pageMode === "create" ? "create" : "advice",
  };
  return modeByIntent[intent] || "advice";
}

function selectContextBuckets(intent = "general_chat", selectedPageMode = "ask", scopeTag = "@app") {
  const pageMode = normalizePageMode(selectedPageMode);
  const normalizedScopeTag = normalizeScopeTag(scopeTag);
  const scopeSupportsCampaignSummary = ["@app", "@campaign", "@graph", "@kingdom"].includes(normalizedScopeTag);

  let includedBuckets = [];
  switch (intent) {
    case "player_build":
      includedBuckets = ["party", "campaign_summary", "rules"];
      break;
    case "rules_question":
      includedBuckets = ["rules", ...(scopeSupportsCampaignSummary ? ["campaign_summary"] : [])];
      break;
    case "gm_prep":
      includedBuckets = ["campaign_summary", "gm_notes", "session_history", "lore"];
      break;
    case "world_lore":
      includedBuckets = ["lore", ...(scopeSupportsCampaignSummary ? ["campaign_summary"] : [])];
      break;
    case "campaign_recall":
      includedBuckets = ["session_history", "kingdom_state", "campaign_summary"];
      break;
    case "create_or_update_content":
      includedBuckets = ["selected_target_record", "campaign_summary", "gm_notes"];
      break;
    case "session_start_or_opening":
      includedBuckets = ["opening_notes", "campaign_summary", "relevant_npc_location_notes"];
      break;
    case "general_chat":
    default:
      includedBuckets = scopeSupportsCampaignSummary && pageMode !== "ask" ? ["campaign_summary"] : [];
      break;
  }

  includedBuckets = unique(includedBuckets);
  const excludedBuckets = ALL_CONTEXT_BUCKETS.filter((bucket) => !includedBuckets.includes(bucket));
  return {
    includedBuckets,
    excludedBuckets,
    included: includedBuckets,
    excluded: excludedBuckets,
    selectedPageMode: pageMode,
    scopeTag: normalizedScopeTag,
  };
}

function resolveAiRoute(userMessage = "", selectedPageMode = "ask", scopeTag = "@app") {
  const intentResult = detectIntent(userMessage, selectedPageMode, scopeTag);
  const answerMode = selectAnswerMode(intentResult.intent, intentResult.selectedPageMode);
  const contextPlan = selectContextBuckets(intentResult.intent, intentResult.selectedPageMode, intentResult.scopeTag);
  return {
    selectedPageMode: intentResult.selectedPageMode,
    scopeTag: intentResult.scopeTag,
    intent: intentResult.intent,
    answerMode,
    includedBuckets: contextPlan.includedBuckets,
    excludedBuckets: contextPlan.excludedBuckets,
    included: contextPlan.includedBuckets,
    excluded: contextPlan.excludedBuckets,
    reasons: unique(intentResult.reasons).slice(0, 4),
  };
}

const api = {
  ALL_CONTEXT_BUCKETS,
  detectIntent,
  selectAnswerMode,
  selectContextBuckets,
  resolveAiRoute,
  isPlayerBuildQuestion,
  isRulesQuestion,
  isGmPrepQuestion,
  isWorldLoreQuestion,
  isCampaignRecallQuestion,
  isCreateOrUpdateQuestion,
  isCampaignOpeningQuestion,
};

module.exports = api;
module.exports.default = api;
