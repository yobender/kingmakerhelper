import { normalizeRulesStore, RULE_STORE_KIND_LABELS } from "./campaignState";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function safeDate(value) {
  const stamp = Date.parse(String(value || ""));
  return Number.isFinite(stamp) ? stamp : 0;
}

function clipText(value, limit = 220) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function sortNewest(left, right) {
  return safeDate(right?.updatedAt || right?.timestamp || right?.createdAt) - safeDate(left?.updatedAt || left?.timestamp || left?.createdAt);
}

function getSearchTerms(query) {
  const terms = stringValue(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 2);
  return [...new Set(terms)];
}

function countTermHits(text, terms) {
  const haystack = stringValue(text).toLowerCase();
  if (!haystack || !terms.length) return 0;
  return terms.reduce((score, term) => (haystack.includes(term) ? score + 1 : score), 0);
}

function extractRelevantExcerpt(text, query, limit = 360) {
  const clean = stringValue(text).replace(/\s+/g, " ");
  if (!clean) return "";
  const terms = getSearchTerms(query);
  if (!terms.length || clean.length <= limit) return clipText(clean, limit);

  const lower = clean.toLowerCase();
  let firstHit = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index >= 0 && (firstHit === -1 || index < firstHit)) {
      firstHit = index;
    }
  }

  if (firstHit === -1) return clipText(clean, limit);

  const start = Math.max(0, firstHit - Math.floor(limit * 0.28));
  const end = Math.min(clean.length, start + limit);
  const excerpt = clean.slice(start, end).trim();
  const prefix = start > 0 ? "... " : "";
  const suffix = end < clean.length ? " ..." : "";
  return `${prefix}${excerpt}${suffix}`.trim();
}

function buildDigestLine(entry) {
  return `${entry.title}: ${clipText(entry.text, 160)}`;
}

function getRecentRuleCaptures(campaign, limit = 8) {
  return [...(campaign?.liveCapture || [])]
    .filter((entry) => {
      const kind = stringValue(entry?.kind).toLowerCase();
      return kind === "rule" || kind === "retcon";
    })
    .sort(sortNewest)
    .slice(0, limit)
    .map((entry) => ({
      id: stringValue(entry?.id),
      title: `${stringValue(entry?.kind) || "Rule"} Call`,
      text: stringValue(entry?.note),
      timestamp: stringValue(entry?.timestamp),
      sessionId: stringValue(entry?.sessionId),
    }))
    .filter((entry) => entry.text);
}

export const RULE_SOURCE_ANCHORS = Object.freeze([
  {
    label: "Running Kingmaker",
    page: 7,
    source: "Adventure Path",
    note: "Capture only the rulings and canon that actually change how tonight's table will run.",
  },
  {
    label: "Player's Guide: Kingdom",
    page: 59,
    source: "Player's Guide",
    note: "Kingdom-facing rules deserve a stable reference surface because they recur across the whole campaign.",
  },
  {
    label: "Kingdom Quick Reference",
    page: 13,
    source: "Kingdom Tracker",
    note: "Keep turn procedure, adjustments, and exceptions readable enough to resolve without slowing the table.",
  },
]);

export function formatRuleKindLabel(kind) {
  return RULE_STORE_KIND_LABELS[stringValue(kind).toLowerCase()] || "Saved Entry";
}

export function formatRulesTimestamp(value) {
  const stamp = safeDate(value);
  if (!stamp) return "";
  return new Date(stamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function deriveRulesMemoryState(campaign) {
  const rulesStore = normalizeRulesStore(campaign?.rulesStore);
  const manualRulings = stringValue(campaign?.meta?.aiMemory?.manualRulings);
  const recentRuleCaptures = getRecentRuleCaptures(campaign, 8);
  const canonEntries = rulesStore.filter((entry) => stringValue(entry?.kind) === "canon_memory").sort(sortNewest);
  const rulingEntries = rulesStore.filter((entry) => stringValue(entry?.kind) !== "canon_memory").sort(sortNewest);

  const rulingsSections = [];
  if (manualRulings) {
    rulingsSections.push(`Manual Digest\n${manualRulings}`);
  }
  if (rulingEntries.length) {
    rulingsSections.push(
      `Saved Rules\n${rulingEntries
        .slice(0, 6)
        .map((entry) => buildDigestLine(entry))
        .join("\n")}`
    );
  }
  if (recentRuleCaptures.length) {
    rulingsSections.push(
      `Recent Table Calls\n${recentRuleCaptures
        .slice(0, 5)
        .map((entry) => `${entry.title}: ${clipText(entry.text, 150)}`)
        .join("\n")}`
    );
  }

  const canonSummary = canonEntries
    .slice(0, 8)
    .map((entry) => buildDigestLine(entry))
    .join("\n");

  return {
    manualRulings,
    rulingsDigest: rulingsSections.join("\n\n").trim(),
    canonSummary,
    rulesStore,
    rulingEntries,
    canonEntries,
    recentRuleCaptures,
  };
}

export function buildRulesLocalMatches(campaign, query) {
  const memory = deriveRulesMemoryState(campaign);
  const terms = getSearchTerms(query);
  const hasQuery = Boolean(stringValue(query));
  const scoreExcerpt = (text) => (terms.length ? countTermHits(text, terms) : 1);

  const digestMatches = [];
  if (memory.manualRulings) {
    const excerpt = extractRelevantExcerpt(memory.manualRulings, query, 420);
    const score = scoreExcerpt(`${memory.manualRulings}`);
    if (!hasQuery || score > 0) {
      digestMatches.push({
        key: "manual-rulings",
        title: "Manual Rulings Digest",
        text: excerpt,
        score,
      });
    }
  }
  if (memory.rulingsDigest && memory.rulingsDigest !== memory.manualRulings) {
    const excerpt = extractRelevantExcerpt(memory.rulingsDigest, query, 420);
    const score = scoreExcerpt(`${memory.rulingsDigest}`);
    if (!hasQuery || score > 0) {
      digestMatches.push({
        key: "effective-rulings",
        title: "Effective Local Rules Digest",
        text: excerpt,
        score,
      });
    }
  }

  const canonMatches = memory.canonEntries
    .map((entry) => {
      const haystack = `${entry.title} ${entry.text} ${(entry.tags || []).join(" ")}`;
      return {
        ...entry,
        excerpt: extractRelevantExcerpt(entry.text, query, 300),
        score: scoreExcerpt(haystack),
      };
    })
    .filter((entry) => (!hasQuery || entry.score > 0))
    .slice(0, 6);

  const captureMatches = memory.recentRuleCaptures
    .map((entry) => ({
      ...entry,
      excerpt: extractRelevantExcerpt(entry.text, query, 260),
      score: scoreExcerpt(entry.text),
    }))
    .filter((entry) => (!hasQuery || entry.score > 0))
    .slice(0, 6);

  const savedMatches = memory.rulesStore
    .map((entry) => {
      const haystack = `${entry.title} ${entry.text} ${(entry.tags || []).join(" ")}`;
      return {
        ...entry,
        excerpt: extractRelevantExcerpt(entry.text, query, 320),
        score: scoreExcerpt(haystack),
      };
    })
    .filter((entry) => (!hasQuery || entry.score > 0))
    .sort((left, right) => right.score - left.score || sortNewest(left, right))
    .slice(0, 10);

  return {
    ...memory,
    digestMatches,
    canonMatches,
    captureMatches,
    savedMatches,
  };
}

export function buildRulesModel(campaign, officialState = {}) {
  const memory = deriveRulesMemoryState(campaign);
  const officialResults = Array.isArray(officialState?.results) ? officialState.results : [];
  const latestRuleCapture = memory.recentRuleCaptures[0] || null;
  const latestCanon = memory.canonEntries[0] || null;
  const latestRuling = memory.rulingEntries[0] || null;

  return {
    ...memory,
    officialResults,
    indexedAt: stringValue(officialState?.indexedAt),
    query: stringValue(officialState?.query),
    sourceAnchors: [...RULE_SOURCE_ANCHORS],
    summaryCards: [
      {
        label: "Official Matches",
        value: `${officialResults.length}`,
        helper: officialResults[0] ? `${officialResults[0].title} / ${clipText(officialResults[0].snippet, 82)}` : "Search AoN for PF2e actions, conditions, subsystems, or kingdom procedure.",
        valueTone: "number",
      },
      {
        label: "Saved Rule Entries",
        value: `${memory.rulesStore.length}`,
        helper: latestRuling ? `${latestRuling.title} / ${formatRuleKindLabel(latestRuling.kind)}` : "No persistent local rule entry is saved yet.",
        valueTone: "number",
      },
      {
        label: "Canon Memory",
        value: `${memory.canonEntries.length}`,
        helper: latestCanon ? `${latestCanon.title} / ${clipText(latestCanon.text, 82)}` : "No campaign canon memory has been locked into the rules store yet.",
        valueTone: "number",
      },
      {
        label: "Recent Rule Calls",
        value: `${memory.recentRuleCaptures.length}`,
        helper: latestRuleCapture ? `${formatRulesTimestamp(latestRuleCapture.timestamp)} / ${clipText(latestRuleCapture.text, 82)}` : "No Rule or Retcon capture entries are waiting in Table Notes.",
        valueTone: "number",
      },
    ],
  };
}

export function buildRulesPromptFromResult(result, mode = "explain") {
  const title = stringValue(result?.title) || "PF2e rule";
  const url = stringValue(result?.url);
  const snippet = stringValue(result?.snippet);
  if (mode === "compare") {
    return [
      `Using the official Pathfinder 2e rule page "${title}", compare the official rule against my local rulings digest.`,
      "Return:",
      "Official Rule:",
      "- 2 to 5 bullets",
      "Local Override / House Rule:",
      "- bullet",
      "GM Quick Ruling:",
      "- 2 to 4 bullets",
      "Source Trail:",
      `- ${title}${url ? ` (${url})` : ""}`,
      "",
      "Official excerpt:",
      snippet,
    ].join("\n");
  }

  return [
    `Using the official Pathfinder 2e rule page "${title}", explain how this works at the table.`,
    "Return:",
    "Rules Answer:",
    "- 3 to 6 concise bullets",
    "Official vs Local Notes:",
    "- Confirmed official rule",
    "- Local override if one exists",
    "Source Trail:",
    `- ${title}${url ? ` (${url})` : ""}`,
    "",
    "Official excerpt:",
    snippet,
  ].join("\n");
}
