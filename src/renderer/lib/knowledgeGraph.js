import aiRoutingModule from "../../shared/aiRouting.cjs";
import { getActiveStoryPhase, shouldSurfaceRecordForFocus } from "./kingmakerFlow";

const {
  detectIntent: sharedDetectIntent,
  selectAnswerMode: sharedSelectAnswerMode,
  selectContextBuckets: sharedSelectContextBuckets,
  resolveAiRoute: sharedResolveAiRoute,
  isPlayerBuildQuestion: sharedIsPlayerBuildQuestion,
  isRulesQuestion: sharedIsRulesQuestion,
  isGmPrepQuestion: sharedIsGmPrepQuestion,
  isWorldLoreQuestion: sharedIsWorldLoreQuestion,
  isCampaignRecallQuestion: sharedIsCampaignRecallQuestion,
  isCreateOrUpdateQuestion: sharedIsCreateOrUpdateQuestion,
  isCampaignOpeningQuestion: sharedIsCampaignOpeningQuestion,
} = aiRoutingModule;

export const KNOWLEDGE_GRAPH_VERSION = "kingmaker-knowledge-graph-v1";

export const KNOWLEDGE_SOURCE_TYPES = Object.freeze({
  "campaign-state": {
    label: "Campaign State",
    trust: "live",
    description: "Records created or edited inside Kingmaker Companion.",
  },
  "adventure-path": {
    label: "Adventure Path",
    trust: "source",
    description: "Adventure sequence, scenes, encounters, villains, and chapter flow.",
  },
  "player-guide": {
    label: "Player Guide",
    trust: "source",
    description: "Player-facing lore, charters, backgrounds, and campaign expectations.",
  },
  "companion-guide": {
    label: "Companion Guide",
    trust: "source",
    description: "Companion arcs, influence hooks, and party-facing relationships.",
  },
  "kingdom-rules": {
    label: "Kingdom Rules",
    trust: "source",
    description: "Kingdom turns, leadership, resources, settlements, and claim rules.",
  },
  maps: {
    label: "Maps",
    trust: "source",
    description: "Hexes, regions, landmarks, routes, and map references.",
  },
  rules: {
    label: "Rules",
    trust: "reference",
    description: "PF2e and local ruling references.",
  },
  vault: {
    label: "Vault Notes",
    trust: "local",
    description: "GM markdown notes pulled from the configured Obsidian vault.",
  },
  "source-library": {
    label: "Source Library",
    trust: "source",
    description: "Indexed PDFs that do not fit a narrower source bucket.",
  },
});

const GRAPH_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "around",
  "because",
  "before",
  "being",
  "between",
  "could",
  "first",
  "from",
  "have",
  "help",
  "into",
  "kingmaker",
  "make",
  "next",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "thing",
  "this",
  "what",
  "when",
  "where",
  "with",
  "would",
  "should",
  "players",
  "party",
]);

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function clip(value, max = 180) {
  const text = stringValue(value).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function normalizeKey(value) {
  return stringValue(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeKey(text)
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !GRAPH_STOP_WORDS.has(word));
}

function unique(values) {
  return [...new Set((values || []).map(stringValue).filter(Boolean))];
}

function scopeIdToTag(scopeId = "app") {
  const clean = normalizeKey(scopeId);
  return clean ? `@${clean}` : "@app";
}

function makeNodeId(type, preferredId, label) {
  const raw = stringValue(preferredId) || stringValue(label) || type;
  return `${type}:${normalizeKey(raw).replace(/\s+/g, "-") || "unknown"}`;
}

function buildSearchText(parts) {
  return unique(parts).join(" ").toLowerCase();
}

function findNodeByLabel(nodeByLabel, label) {
  const key = normalizeKey(label);
  if (!key) return "";
  return nodeByLabel.get(key) || "";
}

function addNode(nodes, nodeByLabel, rawNode) {
  const label = stringValue(rawNode?.label);
  if (!label) return "";
  const id = stringValue(rawNode?.id) || makeNodeId(rawNode?.type || "node", rawNode?.recordId, label);
  if (nodes.some((node) => node.id === id)) return id;
  const node = {
    id,
    type: stringValue(rawNode?.type) || "record",
    label,
    sourceType: stringValue(rawNode?.sourceType) || "campaign-state",
    trust: stringValue(rawNode?.trust) || "live",
    tags: unique(rawNode?.tags || []),
    facts: unique(rawNode?.facts || []).map((fact) => clip(fact, 220)).filter(Boolean),
    searchText: buildSearchText([label, ...(rawNode?.tags || []), ...(rawNode?.facts || [])]),
  };
  nodes.push(node);
  nodeByLabel.set(normalizeKey(label), id);
  for (const alias of rawNode?.aliases || []) {
    const aliasKey = normalizeKey(alias);
    if (aliasKey && !nodeByLabel.has(aliasKey)) nodeByLabel.set(aliasKey, id);
  }
  return id;
}

function addEdge(edges, from, relation, to, evidence, sourceType = "campaign-state") {
  if (!from || !to || from === to) return;
  const key = `${from}|${relation}|${to}`;
  if (edges.some((edge) => edge.key === key)) return;
  edges.push({
    key,
    from,
    relation,
    to,
    evidence: clip(evidence, 200),
    sourceType,
  });
}

export function classifyKnowledgeSource(fileName) {
  const lower = normalizeKey(fileName);
  if (!lower) return "source-library";
  if (/\b(kingdom tracker|kingdom management|kingdom screen|kingdom rules)\b/.test(lower)) return "kingdom-rules";
  if (/\b(interactive map|interactive maps|map|maps|hex)\b/.test(lower)) return "maps";
  if (/\b(companion guide|companionguide|companion)\b/.test(lower)) return "companion-guide";
  if (/\b(player guide|players guide|playerguide|playersguide|player s guide|player)\b/.test(lower)) return "player-guide";
  if (/\b(adventure path|adventure|kingmaker pdf|chapter|campaign spine)\b/.test(lower)) return "adventure-path";
  return "source-library";
}

function hasBuildAskPattern(lower) {
  return (
    /\b(what should i play|what should i build|what class|which class|recommend|suggest|should i play|should i build|help round out|round out|fill the gap|good fit|best fit|what about|how about|instead)\b/.test(
      lower
    ) ||
    /\b(build me|make me|good support|support character|fits our party|fits the party|party fit|party composition)\b/.test(lower) ||
    /\blevel\s*\d+\b/.test(lower) ||
    (/\bwhat\b/.test(lower) && /\bclasses?\b/.test(lower)) ||
    (/\bgood\b/.test(lower) && /\bclasses?\b/.test(lower))
  );
}

export function isCampaignOpeningQuestion(query = "") {
  return sharedIsCampaignOpeningQuestion(query);
}

export function isPlayerBuildQuestion(query = "") {
  return sharedIsPlayerBuildQuestion(query);
}

export function isRulesQuestion(query = "") {
  return sharedIsRulesQuestion(query);
}

export function isGmPrepQuestion(query = "") {
  return sharedIsGmPrepQuestion(query);
}

export function isCampaignRecallQuestion(query = "") {
  return sharedIsCampaignRecallQuestion(query);
}

export function isCreateOrUpdateQuestion(query = "") {
  return sharedIsCreateOrUpdateQuestion(query);
}

export function isWorldLoreQuestion(query = "") {
  return sharedIsWorldLoreQuestion(query);
}

export function detectIntent(userMessage = "", selectedPageMode = "ask", scopeTag = "@app") {
  return sharedDetectIntent(userMessage, selectedPageMode, scopeTag);
}

export function detectAskIntent(query = "", selectedPageMode = "ask", scopeTag = "@app") {
  return detectIntent(query, selectedPageMode, scopeTag).intent;
}

export function selectAnswerMode(intent = "general_chat", selectedPageMode = "ask") {
  return sharedSelectAnswerMode(intent, selectedPageMode);
}

export function getAskAnswerMode(intent = "general_chat", selectedPageMode = "ask") {
  return selectAnswerMode(intent, selectedPageMode);
}

export function selectContextBuckets(intent = "general_chat", selectedPageMode = "ask", scopeTag = "@app") {
  return sharedSelectContextBuckets(intent, selectedPageMode, scopeTag);
}

export function getAskContextPlan(intent = "general_chat", selectedPageMode = "ask", scopeTag = "@app") {
  return selectContextBuckets(intent, selectedPageMode, scopeTag);
}

export function resolveAiRoute(query = "", selectedPageMode = "ask", scopeTag = "@app") {
  return sharedResolveAiRoute(query, selectedPageMode, scopeTag);
}

export function inferKnowledgeGraphRoute(query = "", scopeId = "app", selectedPageMode = "ask") {
  const lower = normalizeKey(query);
  const routeResult = resolveAiRoute(query, selectedPageMode, scopeIdToTag(scopeId));
  const intent = routeResult.intent;
  const isOpeningQuestion = intent === "session_start_or_opening";
  const isPlayerBuild = intent === "player_build";
  const sourceTypes = new Set(["campaign-state"]);
  const tags = new Set();
  const reasons = [];

  const add = (sourceType, tag, reason) => {
    sourceTypes.add(sourceType);
    if (tag) tags.add(tag);
    if (reason) reasons.push(reason);
  };

  if (scopeId === "pdf" || scopeId === "graph") add("adventure-path", "source", "question asks for source-backed context");
  if (scopeId === "rules") add("rules", "rules", "rules scope selected");
  if (scopeId === "kingdom") add("kingdom-rules", "kingdom", "kingdom scope selected");
  if (scopeId === "vault") add("vault", "vault", "vault scope selected");
  if (isOpeningQuestion) {
    add("adventure-path", "opening", "new-campaign opening question detected");
    add("player-guide", "charter", "opening questions need player-facing campaign setup");
  }
  if (isPlayerBuild) {
    add("rules", "character", "player class or party composition question detected");
    add("player-guide", "player", "player-facing character advice needed");
  }
  if (intent === "rules_question") {
    add("rules", "rules", "rules question detected");
  }
  if (intent === "campaign_recall") {
    add("campaign-state", "recall", "campaign recall question detected");
  }

  if (/\b(rule|rules|dc|check|action|activity|condition|remaster|pf2e|pathfinder|class|classes|character|build|party composition)\b/.test(lower)) {
    add("rules", "rules", "rules language detected");
  }
  if (/\b(kingdom|turn|resource|leader|leadership|settlement|claim|unrest|ruin|commodity|charter|fame|infamy)\b/.test(lower)) {
    add("kingdom-rules", "kingdom", "kingdom management language detected");
  }
  if (/\b(map|maps|hex|route|terrain|region|landmark|travel|exploration|greenbelt|narlmarches|kamelands)\b/.test(lower)) {
    add("maps", "map", "map or hex language detected");
  }
  if (/\b(companion|influence|romance|camp|personal|advisor)\b/.test(lower)) {
    add("companion-guide", "companion", "companion language detected");
  }
  if (/\b(lore|background|brevoy|rostland|aldori|surtova|restov|stolen lands|river kingdoms)\b/.test(lower)) {
    add("player-guide", "lore", "lore language detected");
  }
  if (
    /\b(adventure|chapter|scene|encounter|opening|mansion|manor|banquet|jamandi|oleg|stag lord|tartuk|varnhold|vordakai|drelev|pitax|irovetti|nyrissa|lantern king)\b/.test(
      lower
    )
  ) {
    add("adventure-path", "ap", "adventure sequence language detected");
  }

  if (sourceTypes.size === 1) {
    add("adventure-path", "ap", "default Kingmaker source route");
  }

  const queryExpansion = unique([
    ...tokenize(query),
    ...tags,
    isOpeningQuestion
      ? "Jamandi Aldori Restov invitation charter ceremony opening prologue first session Aldori mansion manor"
      : "",
    isPlayerBuild ? "pf2e remastered class party composition role frontliner defender striker support skills player guide" : "",
    sourceTypes.has("adventure-path") ? "chapter scene encounter timeline" : "",
    sourceTypes.has("kingdom-rules") ? "kingdom turn leadership resource settlement" : "",
    sourceTypes.has("maps") ? "hex map region landmark route terrain" : "",
    sourceTypes.has("companion-guide") ? "companion influence personal quest" : "",
    sourceTypes.has("player-guide") ? "lore charter background region" : "",
    sourceTypes.has("rules") ? "pf2e remastered rule dc check" : "",
  ]).join(" ");

  return {
    scopeId,
    intent,
    answerMode: routeResult.answerMode,
    contextPlan: {
      included: routeResult.includedBuckets,
      excluded: routeResult.excludedBuckets,
    },
    sourceTypes: [...sourceTypes],
    tags: [...tags],
    isOpeningQuestion,
    reasons: unique([...routeResult.reasons, ...reasons]).slice(0, 6),
    queryExpansion,
  };
}

function scoreNode(node, terms, route) {
  if (!terms.length) return 0;
  let score = 0;
  const text = node.searchText || "";
  for (const term of terms) {
    if (text.includes(term)) score += node.label.toLowerCase().includes(term) ? 5 : 2;
  }
  if (route.sourceTypes.includes(node.sourceType)) score += 2;
  if (node.type === "session" && /opening|first|start|begin|session/.test(route.queryExpansion)) score += 1;
  return score;
}

function summarizeGraphFact(node) {
  const facts = node.facts?.length ? ` - ${node.facts.slice(0, 2).join("; ")}` : "";
  return `${node.type.toUpperCase()} ${node.label}${facts}`;
}

function addCampaignNodes({ campaign, nodes, edges, nodeByLabel }) {
  const includeReference = campaign?.meta?.storyFocus?.includeReferenceInAi !== false;
  const shouldInclude = (record) => shouldSurfaceRecordForFocus(record, campaign, { includeReference });

  for (const quest of (campaign?.quests || []).filter(shouldInclude)) {
    const title = stringValue(quest?.title);
    if (!title) continue;
    const id = addNode(nodes, nodeByLabel, {
      type: "quest",
      recordId: quest?.id,
      label: title,
      tags: [quest?.status, quest?.priority, quest?.chapter, quest?.folder, quest?.hex],
      facts: [
        quest?.objective && `Objective: ${quest.objective}`,
        quest?.stakes && `Stakes: ${quest.stakes}`,
        quest?.nextBeat && `Next beat: ${quest.nextBeat}`,
        quest?.giver && `Giver: ${quest.giver}`,
        quest?.hex && `Hex: ${quest.hex}`,
      ],
    });
    if (quest?.linkedEvent) addEdge(edges, id, "linked_to_event", findNodeByLabel(nodeByLabel, quest.linkedEvent), "Quest has linked event.");
    if (quest?.linkedCompanion) addEdge(edges, id, "linked_to_companion", findNodeByLabel(nodeByLabel, quest.linkedCompanion), "Quest has linked companion.");
  }

  for (const location of (campaign?.locations || []).filter(shouldInclude)) {
    const name = stringValue(location?.name);
    if (!name) continue;
    addNode(nodes, nodeByLabel, {
      type: "location",
      recordId: location?.id,
      label: name,
      aliases: [location?.hex],
      tags: [location?.type, location?.status, location?.region, location?.hex],
      facts: [
        location?.hex && `Hex: ${location.hex}`,
        location?.region && `Region: ${location.region}`,
        location?.summary && `Summary: ${location.summary}`,
        location?.threat && `Threat: ${location.threat}`,
        location?.opportunity && `Opportunity: ${location.opportunity}`,
      ],
    });
  }

  for (const npc of (campaign?.npcs || []).filter(shouldInclude)) {
    const name = stringValue(npc?.name);
    if (!name) continue;
    const id = addNode(nodes, nodeByLabel, {
      type: "npc",
      recordId: npc?.id,
      label: name,
      tags: [npc?.role, npc?.faction, npc?.status, npc?.disposition, npc?.importance, npc?.location, npc?.hex],
      facts: [
        npc?.role && `Role: ${npc.role}`,
        npc?.faction && `Faction: ${npc.faction}`,
        npc?.location && `Location: ${npc.location}`,
        npc?.agenda && `Agenda: ${npc.agenda}`,
        npc?.pressure && `Pressure: ${npc.pressure}`,
        npc?.rumor && `Rumor: ${npc.rumor}`,
        npc?.nextScene && `Next scene: ${npc.nextScene}`,
      ],
    });
    if (npc?.location) addEdge(edges, id, "located_at", findNodeByLabel(nodeByLabel, npc.location), `NPC location: ${npc.location}`);
    if (npc?.linkedQuest) addEdge(edges, id, "linked_to_quest", findNodeByLabel(nodeByLabel, npc.linkedQuest), "NPC has linked quest.");
    if (npc?.linkedEvent) addEdge(edges, id, "linked_to_event", findNodeByLabel(nodeByLabel, npc.linkedEvent), "NPC has linked event.");
  }

  for (const event of (campaign?.events || []).filter(shouldInclude)) {
    const title = stringValue(event?.title);
    if (!title) continue;
    const id = addNode(nodes, nodeByLabel, {
      type: "event",
      recordId: event?.id,
      label: title,
      tags: [event?.category, event?.status, event?.folder, event?.hex, event?.linkedQuest, event?.linkedCompanion],
      facts: [
        event?.trigger && `Trigger: ${event.trigger}`,
        event?.fallout && `Fallout: ${event.fallout}`,
        event?.consequenceSummary && `Consequence: ${event.consequenceSummary}`,
        Number.isFinite(Number(event?.clockMax)) ? `Clock: ${Number(event?.clock || 0)}/${Number(event.clockMax || 0)}` : "",
      ],
    });
    if (event?.linkedQuest) addEdge(edges, id, "pressures_quest", findNodeByLabel(nodeByLabel, event.linkedQuest), "Event pressures quest.");
    if (event?.linkedCompanion) {
      addEdge(edges, id, "pressures_companion", findNodeByLabel(nodeByLabel, event.linkedCompanion), "Event pressures companion.");
    }
  }

  for (const companion of (campaign?.companions || []).filter(shouldInclude)) {
    const name = stringValue(companion?.name);
    if (!name) continue;
    addNode(nodes, nodeByLabel, {
      type: "companion",
      recordId: companion?.id,
      label: name,
      tags: [companion?.status, companion?.travelState, companion?.questStage, companion?.kingdomRole],
      facts: [
        companion?.influence && `Influence: ${companion.influence}`,
        companion?.currentNeed && `Current need: ${companion.currentNeed}`,
        companion?.kingdomRole && `Kingdom role: ${companion.kingdomRole}`,
        companion?.nextBeat && `Next beat: ${companion.nextBeat}`,
      ],
    });
  }

  const latestSession = [...(campaign?.sessions || [])].sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))[0];
  if (latestSession) {
    addNode(nodes, nodeByLabel, {
      type: "session",
      recordId: latestSession.id,
      label: latestSession.title || "Latest Session",
      tags: [latestSession.date, latestSession.type, latestSession.arc, latestSession.focusHex],
      facts: [
        latestSession.date && `Date: ${latestSession.date}`,
        latestSession.summary && `Summary: ${latestSession.summary}`,
        latestSession.nextPrep && `Next prep: ${latestSession.nextPrep}`,
        latestSession.focusHex && `Focus hex: ${latestSession.focusHex}`,
      ],
    });
  }

  const kingdom = campaign?.kingdom || {};
  if (kingdom?.name || kingdom?.currentTurnLabel || kingdom?.currentDate) {
    addNode(nodes, nodeByLabel, {
      type: "kingdom",
      recordId: "kingdom-sheet",
      label: kingdom.name || "Kingdom Sheet",
      sourceType: "kingdom-rules",
      trust: "live",
      tags: [kingdom.currentTurnLabel, kingdom.currentDate, kingdom.charter, kingdom.government, kingdom.heartland],
      facts: [
        kingdom.currentTurnLabel && `Current turn: ${kingdom.currentTurnLabel}`,
        kingdom.currentDate && `Current date: ${kingdom.currentDate}`,
        kingdom.controlDC && `Control DC: ${kingdom.controlDC}`,
        kingdom.unrest != null && `Unrest: ${kingdom.unrest}`,
        kingdom.renown != null && `Renown: ${kingdom.renown}`,
      ],
    });
  }

  for (const quest of (campaign?.quests || []).filter(shouldInclude)) {
    const from = findNodeByLabel(nodeByLabel, quest?.title);
    if (quest?.linkedEvent) addEdge(edges, from, "linked_to_event", findNodeByLabel(nodeByLabel, quest.linkedEvent), "Quest has linked event.");
    if (quest?.linkedCompanion) addEdge(edges, from, "linked_to_companion", findNodeByLabel(nodeByLabel, quest.linkedCompanion), "Quest has linked companion.");
    if (quest?.giver) addEdge(edges, from, "given_by", findNodeByLabel(nodeByLabel, quest.giver), `Quest giver: ${quest.giver}`);
  }

  for (const npc of (campaign?.npcs || []).filter(shouldInclude)) {
    const from = findNodeByLabel(nodeByLabel, npc?.name);
    if (npc?.location) addEdge(edges, from, "located_at", findNodeByLabel(nodeByLabel, npc.location), `NPC location: ${npc.location}`);
    if (npc?.linkedQuest) addEdge(edges, from, "linked_to_quest", findNodeByLabel(nodeByLabel, npc.linkedQuest), "NPC has linked quest.");
    if (npc?.linkedEvent) addEdge(edges, from, "linked_to_event", findNodeByLabel(nodeByLabel, npc.linkedEvent), "NPC has linked event.");
  }

  for (const event of (campaign?.events || []).filter(shouldInclude)) {
    const from = findNodeByLabel(nodeByLabel, event?.title);
    if (event?.linkedQuest) addEdge(edges, from, "pressures_quest", findNodeByLabel(nodeByLabel, event.linkedQuest), "Event pressures quest.");
    if (event?.linkedCompanion) {
      addEdge(edges, from, "pressures_companion", findNodeByLabel(nodeByLabel, event.linkedCompanion), "Event pressures companion.");
    }
  }
}

function buildSourceBriefs(meta) {
  const indexedFiles = Array.isArray(meta?.pdfIndexedFiles) ? meta.pdfIndexedFiles : [];
  const summaries = meta?.pdfSummaries && typeof meta.pdfSummaries === "object" ? meta.pdfSummaries : {};
  const sourceBriefs = indexedFiles.map((fileName) => {
    const summary = Object.values(summaries).find((entry) => stringValue(entry?.fileName) === stringValue(fileName));
    const sourceType = classifyKnowledgeSource(fileName);
    return {
      fileName: stringValue(fileName),
      sourceType,
      label: KNOWLEDGE_SOURCE_TYPES[sourceType]?.label || sourceType,
      summary: clip(summary?.summary || "", 220),
    };
  });
  return sourceBriefs.filter((entry) => entry.fileName);
}

export function buildKnowledgeGraph(campaign = {}, query = "", scopeId = "app", selectedPageMode = "ask") {
  const route = inferKnowledgeGraphRoute(query, scopeId, selectedPageMode);
  const storyPhase = getActiveStoryPhase(campaign);
  const nodes = [];
  const edges = [];
  const nodeByLabel = new Map();
  addCampaignNodes({ campaign, nodes, edges, nodeByLabel });

  const meta = campaign?.meta || {};
  const sourceBriefs = buildSourceBriefs(meta);
  const sourceTypeCounts = sourceBriefs.reduce((acc, source) => {
    acc[source.sourceType] = (acc[source.sourceType] || 0) + 1;
    return acc;
  }, {});
  const terms = unique([...tokenize(query), ...tokenize(route.queryExpansion)]);
  const matchedNodes = nodes
    .map((node) => ({ ...node, score: scoreNode(node, terms, route) }))
    .filter((node) => node.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 18);
  const matchedIds = new Set(matchedNodes.map((node) => node.id));
  const matchedEdges = edges
    .filter((edge) => matchedIds.has(edge.from) || matchedIds.has(edge.to))
    .slice(0, 16)
    .map((edge) => ({
      relation: edge.relation,
      from: nodes.find((node) => node.id === edge.from)?.label || edge.from,
      to: nodes.find((node) => node.id === edge.to)?.label || edge.to,
      evidence: edge.evidence,
    }));
  const graphFacts = matchedNodes.length
    ? matchedNodes.map(summarizeGraphFact)
    : nodes.slice(0, 12).map(summarizeGraphFact);

  return {
    version: KNOWLEDGE_GRAPH_VERSION,
    generatedAt: new Date().toISOString(),
    route,
    storyPhase,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      matchedNodeCount: matchedNodes.length,
      indexedSourceCount: sourceBriefs.length,
      sourceTypeCounts,
    },
    sourceTypes: route.sourceTypes.map((sourceType) => ({
      id: sourceType,
      ...(KNOWLEDGE_SOURCE_TYPES[sourceType] || KNOWLEDGE_SOURCE_TYPES["source-library"]),
    })),
    sourceBriefs: sourceBriefs.slice(0, 18),
    matchedNodes: matchedNodes.map(({ searchText, score, ...node }) => ({
      ...node,
      facts: node.facts.slice(0, 4),
      score,
    })),
    matchedEdges,
    graphFacts: graphFacts.slice(0, 18),
    retrievalRules: [
      "Prefer live app records over model memory.",
      `Current story focus: ${storyPhase.label}. Treat Kingmaker reference records as available prep, not confirmed campaign history unless they are marked confirmed.`,
      "Use the graph route to pick source buckets before pulling broad PDF snippets.",
      "Use Adventure Path sources for encounter order and scene flow.",
      "Use rules/kingdom sources for mechanics; do not mix in PF1e or CRPG mechanics unless the GM asks.",
      "If a graph fact conflicts with a PDF excerpt, say which source you are following and why.",
    ],
  };
}

export function buildKnowledgeGraphPromptBlock(graph, maxFacts = 18) {
  if (!graph || typeof graph !== "object") return "";
  const route = graph.route || {};
  const stats = graph.stats || {};
  const sourceLabels = (graph.sourceTypes || []).map((source) => source.label || source.id).join(", ");
  const reasons = Array.isArray(route.reasons) ? route.reasons.join("; ") : "";
  const sourceBriefs = Array.isArray(graph.sourceBriefs) ? graph.sourceBriefs : [];
  const facts = Array.isArray(graph.graphFacts) ? graph.graphFacts.slice(0, maxFacts) : [];
  const edges = Array.isArray(graph.matchedEdges) ? graph.matchedEdges.slice(0, 10) : [];

  return [
    `Knowledge graph version: ${graph.version || KNOWLEDGE_GRAPH_VERSION}`,
    `Graph stats: ${Number(stats.nodeCount || 0)} nodes, ${Number(stats.edgeCount || 0)} edges, ${Number(
      stats.indexedSourceCount || 0
    )} indexed sources.`,
    `Source route: ${sourceLabels || "Campaign State"}.`,
    reasons ? `Route reason: ${reasons}.` : "",
    route.queryExpansion ? `Retrieval expansion: ${route.queryExpansion}` : "",
    "Graph retrieval rule: use these graph facts first, then verify or deepen with matching PDF chunks.",
    facts.length ? "Matched graph facts:" : "",
    ...facts.map((fact, index) => `${index + 1}. ${fact}`),
    edges.length ? "Matched graph links:" : "",
    ...edges.map((edge, index) => `${index + 1}. ${edge.from} --${edge.relation}--> ${edge.to}${edge.evidence ? ` (${edge.evidence})` : ""}`),
    sourceBriefs.length ? "Indexed source buckets:" : "",
    ...sourceBriefs.slice(0, 10).map((source, index) => `${index + 1}. ${source.fileName} => ${source.label}${source.summary ? `: ${source.summary}` : ""}`),
  ]
    .filter(Boolean)
    .join("\n");
}
