const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");
const pdfParse = require("pdf-parse");
const aiRouting = require("./src/shared/aiRouting.cjs");

const DEFAULT_PDF_FOLDER = "C:\\Users\\Chris Bender\\Downloads\\PathfinderKingmakerAdventurePathPDF-SingleFile";
const CAMPAIGN_STATE_FILENAME = "campaign-state.v1.json";
const RENDERER_BUILD_DIR = "renderer-dist";
const VITE_DEV_SERVER_URL = String(process.env.VITE_DEV_SERVER_URL || "").trim();
const MAX_CHARS_PER_FILE = 5000000;
const DEFAULT_AI_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_AI_MODEL = "llama3.1:8b";
const AI_TIMEOUT_MS = 120000;
const AI_PDF_SNIPPET_LIMIT = 6;
const OLLAMA_BOOT_RETRY_COUNT = 12;
const OLLAMA_BOOT_RETRY_DELAY_MS = 1000;
const OBSIDIAN_AI_CONTEXT_FILE_SCAN_LIMIT = 400;
const OBSIDIAN_AI_CONTEXT_DEFAULT_NOTE_LIMIT = 6;
const OBSIDIAN_AI_CONTEXT_DEFAULT_CHAR_LIMIT = 3600;
const PDF_INDEX_CACHE_FILENAME = "pdf-index-cache.v1.json";
const AON_RULES_CACHE_FILENAME = "aon-rules-cache.v1.json";
const PDF_RETRIEVAL_CHUNK_SIZE = 1400;
const PDF_RETRIEVAL_CHUNK_OVERLAP = 240;
const PDF_EMBED_BATCH_SIZE = 16;
const PDF_HYBRID_CANDIDATE_FILE_LIMIT = 6;
const PDF_HYBRID_MATCH_LIMIT = 60;
const FAST_AI_MODEL_CANDIDATES = Object.freeze([
  "lorebound-pf2e-pure:latest",
  "lorebound-pf2e-ultra-fast:latest",
  "lorebound-pf2e-v2:latest",
  "llama3.1:8b",
  "qwen2.5:3b",
  "qwen2.5:7b",
  "llama3.2:3b",
  "mistral:7b",
  "qwen2.5-coder:1.5b-base",
]);
const PDF_EMBEDDING_MODEL_CANDIDATES = [
  "all-minilm:latest",
  "all-minilm",
  "embeddinggemma:latest",
  "embeddinggemma",
  "qwen3-embedding:latest",
  "qwen3-embedding",
  "nomic-embed-text:latest",
  "nomic-embed-text",
  "mxbai-embed-large:latest",
  "mxbai-embed-large",
];
const AON_RULES_INDEX_URL = "https://2e.aonprd.com/Rules.aspx";
const AON_RULES_BASE_URL = "https://2e.aonprd.com/";
const AON_RULES_INDEX_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const AON_RULES_PAGE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const AON_RULES_MAX_MATCHES = 6;
const AI_MODEL_LABELS = Object.freeze({
  "lorebound-pf2e:latest": "LoreBound PF2e Deep (20B)",
  "lorebound-pf2e-fast:latest": "LoreBound PF2e Fast (20B)",
  "lorebound-pf2e-minimal:latest": "LoreBound PF2e Minimal (20B)",
  "lorebound-pf2e-pure:latest": "LoreBound PF2e Pure",
  "lorebound-pf2e-ultra-fast:latest": "LoreBound PF2e Ultra-Fast (1.5B)",
  "lorebound-pf2e-qwen:latest": "LoreBound PF2e Qwen Deep (32B)",
  "lorebound-pf2e-cpu:latest": "LoreBound PF2e CPU (20B)",
  "lorebound-pf2e-cpu-minimal:latest": "LoreBound PF2e CPU Minimal (20B)",
  "lorebound-pf2e-v2:latest": "LoreBound PF2e V2",
  "lorebound-pf2e-clean:latest": "LoreBound PF2e Clean",
  "gpt-oss:20b": "GPT-OSS Base (20B)",
  "gpt-oss-20b-fast:latest": "GPT-OSS Fast (20B)",
  "gpt-oss-20b-optimized:latest": "GPT-OSS Optimized (20B)",
  "gpt-oss-20b-cpu:latest": "GPT-OSS CPU (20B)",
  "llama3.1:8b": "Llama 3.1 (8B)",
  "qwen2.5:3b": "Qwen 2.5 (3B)",
  "qwen2.5:7b": "Qwen 2.5 (7B)",
  "llama3.2:3b": "Llama 3.2 (3B)",
  "mistral:7b": "Mistral (7B)",
  "qwen2.5-coder:1.5b-base": "Qwen 2.5 Coder Base (1.5B)",
  "qwen2.5-coder:32b": "Qwen 2.5 Coder (32B)",
});
const KINGDOM_RULES_DATA = loadKingdomRulesData();

let mainWindow = null;
const pdfViewerWindows = new Set();
let pdfIndexCache = {
  folderPath: "",
  indexedAt: "",
  files: [],
};
let aonRulesCache = {
  indexedAt: "",
  entries: [],
  pages: {},
};
let ollamaBootPromise = null;
let pdfEmbeddingModelCache = {
  endpoint: "",
  checkedAt: 0,
  model: "",
};

function loadKingdomRulesData() {
  try {
    return require("./kingdom-rules-data.json");
  } catch {
    return {
      latestProfileId: "fallback",
      profiles: [
        {
          id: "fallback",
          label: "Kingdom Rules Profile",
          shortLabel: "Kingdom",
          summary: "Fallback kingdom rules profile used because the shared rules file could not be loaded.",
          turnStructure: [],
          aiContextSummary: [],
        },
      ],
    };
  }
}

wireProcessStabilityGuards();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    title: "Kingmaker Companion",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });

  await loadRenderer(mainWindow);
  wireSpellcheckContextMenu(mainWindow);
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    safeMainLog("renderer-console", `${sourceId || "renderer"}:${line || 0} [${level}] ${message}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    safeMainLog("render-process-gone", `${details?.reason || "unknown"} exitCode=${details?.exitCode ?? "n/a"}`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    safeMainLog(
      "did-fail-load",
      `${isMainFrame ? "main" : "sub"} frame ${validatedURL || "unknown-url"} code=${errorCode} ${errorDescription || ""}`.trim()
    );
  });
}

async function loadRenderer(targetWindow) {
  if (VITE_DEV_SERVER_URL) {
    await targetWindow.loadURL(VITE_DEV_SERVER_URL);
    return;
  }

  const rendererEntryPath = path.join(__dirname, RENDERER_BUILD_DIR, "index.html");
  if (fsSync.existsSync(rendererEntryPath)) {
    await targetWindow.loadFile(rendererEntryPath);
    return;
  }

  const message = [
    "<h1>Renderer Build Missing</h1>",
    "<p>Kingmaker Companion could not find the compiled React renderer.</p>",
    "<p>Run <code>npm run build:renderer</code> or <code>npm start</code> from the project folder.</p>",
  ].join("");
  await targetWindow.loadURL(`data:text/html,${encodeURIComponent(message)}`);
}

function getCampaignStatePath() {
  return path.join(app.getPath("userData"), CAMPAIGN_STATE_FILENAME);
}

async function readCampaignStateFromDisk() {
  const filePath = getCampaignStatePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      exists: true,
      path: filePath,
      state: JSON.parse(raw),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        path: filePath,
        state: null,
      };
    }
    throw error;
  }
}

async function writeCampaignStateToDisk(statePayload) {
  if (!statePayload || typeof statePayload !== "object" || Array.isArray(statePayload)) {
    throw new Error("Campaign state payload must be an object.");
  }

  const filePath = getCampaignStatePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(statePayload, null, 2)}\n`, "utf8");
  return {
    ok: true,
    path: filePath,
    savedAt: new Date().toISOString(),
  };
}

app.whenReady().then(async () => {
  await loadPdfIndexCacheFromDisk();
  await loadAonRulesCacheFromDisk();
  registerIpc();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function wireProcessStabilityGuards() {
  const ignoreEpipe = (err) => isBrokenPipeError(err);

  if (process.stdout?.on) {
    process.stdout.on("error", (err) => {
      ignoreEpipe(err);
    });
  }
  if (process.stderr?.on) {
    process.stderr.on("error", (err) => {
      ignoreEpipe(err);
    });
  }

  process.on("uncaughtException", (err) => {
    if (ignoreEpipe(err)) return;
    safeMainLog("uncaughtException", err);
  });

  process.on("unhandledRejection", (reason) => {
    if (ignoreEpipe(reason)) return;
    safeMainLog("unhandledRejection", reason);
  });
}

function isBrokenPipeError(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || err || "");
  return code === "EPIPE" || /broken pipe/i.test(message);
}

function safeMainLog(scope, err) {
  const name = String(err?.name || "Error");
  const message = String(err?.message || err || "Unknown error");
  try {
    process.stderr.write(`[${scope}] ${name}: ${message}\n`);
  } catch {
    // Ignore stderr write errors (including EPIPE).
  }
}

function getAiModelDisplayName(model) {
  const raw = String(model || "").trim();
  if (!raw) return "";
  return AI_MODEL_LABELS[raw.toLowerCase()] || raw;
}

function getPdfIndexCachePath() {
  return path.join(app.getPath("userData"), PDF_INDEX_CACHE_FILENAME);
}

function getAonRulesCachePath() {
  return path.join(app.getPath("userData"), AON_RULES_CACHE_FILENAME);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function safeDate(value) {
  const ms = Date.parse(String(value || ""));
  return Number.isNaN(ms) ? 0 : ms;
}

function sanitizeAonRulesEntry(entry) {
  const title = decodeHtmlEntities(String(entry?.title || "")).replace(/\s+/g, " ").trim();
  const url = String(entry?.url || "").trim();
  const pathValue = String(entry?.path || "").trim();
  if (!title || !url || !pathValue) return null;
  if (!/^https:\/\/2e\.aonprd\.com\/Rules\.aspx\?/i.test(url)) return null;
  return {
    title,
    url,
    path: pathValue,
  };
}

function sanitizeAonRulesPage(page) {
  const title = decodeHtmlEntities(String(page?.title || "")).replace(/\s+/g, " ").trim();
  const url = String(page?.url || "").trim();
  const snippet = String(page?.snippet || "").replace(/\s+/g, " ").trim();
  const fetchedAt = String(page?.fetchedAt || "").trim();
  if (!title || !url) return null;
  return {
    title,
    url,
    snippet,
    fetchedAt,
  };
}

function sanitizeAonRulesCache(rawCache) {
  const entries = Array.isArray(rawCache?.entries) ? rawCache.entries.map((entry) => sanitizeAonRulesEntry(entry)).filter(Boolean) : [];
  const pagesRaw = rawCache?.pages && typeof rawCache.pages === "object" && !Array.isArray(rawCache.pages) ? rawCache.pages : {};
  const pages = {};
  for (const [key, value] of Object.entries(pagesRaw)) {
    const clean = sanitizeAonRulesPage(value);
    if (clean) pages[key] = clean;
  }
  return {
    indexedAt: String(rawCache?.indexedAt || "").trim(),
    entries,
    pages,
  };
}

async function loadAonRulesCacheFromDisk() {
  try {
    const cachePath = getAonRulesCachePath();
    const raw = await fs.readFile(cachePath, "utf8");
    aonRulesCache = sanitizeAonRulesCache(JSON.parse(raw));
  } catch {
    aonRulesCache = {
      indexedAt: "",
      entries: [],
      pages: {},
    };
  }
}

async function saveAonRulesCacheToDisk() {
  const cachePath = getAonRulesCachePath();
  await fs.writeFile(cachePath, JSON.stringify(sanitizeAonRulesCache(aonRulesCache)), "utf8");
}

async function fetchTextWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs) || 15000));
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "DM-Helper/0.1.0 (+PF2e rules lookup)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round((Number(timeoutMs) || 15000) / 1000)}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtmlToText(html) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function parseAonRulesIndex(html) {
  const seen = new Map();
  const regex = /<a[^>]+href="([^"]*Rules\.aspx\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match = regex.exec(String(html || ""));
  while (match) {
    const href = String(match[1] || "").trim();
    const title = stripHtmlToText(String(match[2] || ""));
    try {
      const url = new URL(href, AON_RULES_BASE_URL);
      if (url.hostname.toLowerCase() === "2e.aonprd.com" && url.pathname.endsWith("/Rules.aspx")) {
        const clean = sanitizeAonRulesEntry({
          title,
          url: url.href,
          path: `${url.pathname.replace(/^\//, "")}${url.search}`,
        });
        if (clean && !seen.has(clean.url)) {
          seen.set(clean.url, clean);
        }
      }
    } catch {
      // Ignore malformed links.
    }
    match = regex.exec(String(html || ""));
  }
  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function extractAonPageTitle(html, fallbackUrl = "") {
  const titleMatch = String(html || "").match(/<title>([\s\S]*?)<\/title>/i);
  const fromTitle = stripHtmlToText(titleMatch?.[1] || "").replace(/\s*\|\s*Archives of Nethys.*$/i, "").trim();
  if (fromTitle) return fromTitle;
  try {
    const url = new URL(fallbackUrl);
    return `${url.pathname.replace(/^\//, "")}${url.search}`;
  } catch {
    return fallbackUrl || "Rules Page";
  }
}

function buildAonRuleSnippet(html, title) {
  const text = stripHtmlToText(html);
  if (!text) return "";
  const lowered = text.toLowerCase();
  const titleLower = String(title || "").toLowerCase();
  const titleHit = titleLower ? lowered.indexOf(titleLower) : -1;
  const start = titleHit >= 0 ? Math.min(text.length, titleHit + title.length) : 0;
  const candidate = text.slice(start).trim() || text;
  return candidate.slice(0, 900).trim();
}

async function ensureAonRulesIndex(force = false) {
  const indexedAt = safeDate(aonRulesCache.indexedAt);
  const cacheFresh = Number.isFinite(indexedAt) && Date.now() - indexedAt < AON_RULES_INDEX_MAX_AGE_MS;
  if (!force && cacheFresh && Array.isArray(aonRulesCache.entries) && aonRulesCache.entries.length) {
    return aonRulesCache.entries;
  }
  const html = await fetchTextWithTimeout(AON_RULES_INDEX_URL, 20000);
  const entries = parseAonRulesIndex(html);
  if (!entries.length) {
    throw new Error("Could not parse Archives of Nethys rules index.");
  }
  aonRulesCache.entries = entries;
  aonRulesCache.indexedAt = new Date().toISOString();
  await saveAonRulesCacheToDisk();
  return entries;
}

async function ensureAonRulePage(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) throw new Error("AoN rule URL is required.");
  const cached = sanitizeAonRulesPage(aonRulesCache.pages?.[safeUrl]);
  const fetchedAt = safeDate(cached?.fetchedAt);
  const cacheFresh = Number.isFinite(fetchedAt) && Date.now() - fetchedAt < AON_RULES_PAGE_MAX_AGE_MS;
  if (cached && cacheFresh && cached.snippet) {
    return cached;
  }
  const html = await fetchTextWithTimeout(safeUrl, 20000);
  const title = extractAonPageTitle(html, safeUrl);
  const page = sanitizeAonRulesPage({
    title,
    url: safeUrl,
    snippet: buildAonRuleSnippet(html, title),
    fetchedAt: new Date().toISOString(),
  });
  if (!page) {
    throw new Error("Could not parse Archives of Nethys rule page.");
  }
  aonRulesCache.pages[safeUrl] = page;
  await saveAonRulesCacheToDisk();
  return page;
}

async function searchAonRules(query, limit = 4, options = {}) {
  const cleanQuery = normalizePdfText(query);
  if (!cleanQuery) return { query: "", indexedAt: aonRulesCache.indexedAt, results: [] };
  const entries = await ensureAonRulesIndex(options.force === true);
  const searchParts = buildSearchParts(cleanQuery);
  const ranked = entries
    .map((entry) => {
      const textLower = `${entry.title} ${entry.path}`.toLowerCase();
      const match = scoreTextAgainstQuery(textLower, searchParts);
      return {
        ...entry,
        score: match.score,
        firstHit: match.firstHit,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, Math.min(Number(limit) || 4, AON_RULES_MAX_MATCHES)));

  const results = [];
  for (const entry of ranked) {
    try {
      const page = await ensureAonRulePage(entry.url);
      results.push({
        title: page.title || entry.title,
        url: entry.url,
        path: entry.path,
        snippet: makeSnippet(page.snippet || entry.title, entry.firstHit),
        score: entry.score,
        source: "Archives of Nethys",
      });
    } catch {
      results.push({
        title: entry.title,
        url: entry.url,
        path: entry.path,
        snippet: entry.title,
        score: entry.score,
        source: "Archives of Nethys",
      });
    }
  }

  return {
    query: cleanQuery,
    indexedAt: aonRulesCache.indexedAt,
    results,
  };
}

function sanitizeVaultFileName(value, fallback = "Untitled") {
  const clean = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (clean || fallback).slice(0, 110);
}

function uniqueVaultNoteName(baseName, usedNames) {
  const seed = sanitizeVaultFileName(baseName, "Untitled");
  const set = usedNames || new Set();
  let candidate = seed;
  let index = 2;
  while (set.has(candidate.toLowerCase())) {
    candidate = `${seed} ${index}`;
    index += 1;
  }
  set.add(candidate.toLowerCase());
  return candidate;
}

function mdText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function mdLine(value, fallback = "_None_") {
  const clean = mdText(value);
  return clean || fallback;
}

function mdBullets(items, fallback = "_None_") {
  const clean = Array.isArray(items)
    ? items.map((item) => mdText(item)).filter(Boolean)
    : [];
  return clean.length ? clean.map((item) => `- ${item}`).join("\n") : fallback;
}

const EVENT_IMPACT_FIELD_DEFS = Object.freeze([
  ["rpImpact", "RP"],
  ["unrestImpact", "Unrest"],
  ["renownImpact", "Renown"],
  ["fameImpact", "Fame"],
  ["infamyImpact", "Infamy"],
  ["foodImpact", "Food"],
  ["lumberImpact", "Lumber"],
  ["luxuriesImpact", "Luxuries"],
  ["oreImpact", "Ore"],
  ["stoneImpact", "Stone"],
  ["corruptionImpact", "Corruption"],
  ["crimeImpact", "Crime"],
  ["decayImpact", "Decay"],
  ["strifeImpact", "Strife"],
]);

function coerceInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSignedNumber(value) {
  const num = coerceInteger(value, 0);
  return num > 0 ? `+${num}` : `${num}`;
}

function formatEventClockSummary(entry) {
  const clock = Math.max(0, coerceInteger(entry?.clock, 0));
  const clockMax = Math.max(1, coerceInteger(entry?.clockMax, 4));
  return `${clock}/${clockMax}`;
}

function describeEventImpactSummary(entry) {
  const parts = EVENT_IMPACT_FIELD_DEFS
    .map(([key, label]) => {
      const value = coerceInteger(entry?.[key], 0);
      return value === 0 ? "" : `${label} ${formatSignedNumber(value)}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "No kingdom impact recorded.";
}

function mdWikiLink(folder, noteName, label = "") {
  const cleanFolder = String(folder || "").trim();
  const target = cleanFolder && cleanFolder !== "." ? `${cleanFolder}/${noteName}` : `${noteName}`;
  return label ? `[[${target}|${label}]]` : `[[${target}]]`;
}

async function writeVaultMarkdownFile(rootFolder, relativeSegments, content) {
  const targetPath = path.join(rootFolder, ...relativeSegments);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${String(content || "").trim()}\n`, "utf8");
  return targetPath;
}

function buildSessionNote(entry) {
  return [
    `# ${entry.title || "Session"}`,
    "",
    `- Date: ${mdLine(entry.date)}`,
    `- Type: ${mdLine(entry.type)}`,
    `- Arc: ${mdLine(entry.arc)}`,
    `- Chapter Lane: ${mdLine(entry.chapter)}`,
    `- Kingdom Turn: ${mdLine(entry.kingdomTurn)}`,
    `- Focus Hex: ${mdLine(entry.focusHex)}`,
    `- Lead Companion: ${mdLine(entry.leadCompanion)}`,
    `- Travel Objective: ${mdLine(entry.travelObjective)}`,
    `- Weather / Camp: ${mdLine(entry.weather)}`,
    `- Frontier Pressure: ${mdLine(entry.pressure)}`,
    `- Updated: ${mdLine(entry.updatedAt)}`,
    "",
    "## Summary",
    mdLine(entry.summary),
    "",
    "## Next Prep",
    mdLine(entry.nextPrep),
  ].join("\n");
}

function buildNpcNote(entry) {
  return [
    `# ${entry.name || "NPC"}`,
    "",
    `- Role: ${mdLine(entry.role)}`,
    `- Faction: ${mdLine(entry.faction)}`,
    `- Status: ${mdLine(entry.status)}`,
    `- Disposition: ${mdLine(entry.disposition)}`,
    `- Importance: ${mdLine(entry.importance)}`,
    `- Creature Level: ${mdLine(entry.creatureLevel)}`,
    `- Location: ${mdLine(entry.location)}`,
    `- Hex: ${mdLine(entry.hex)}`,
    `- Linked Quest: ${mdLine(entry.linkedQuest)}`,
    `- Linked Event: ${mdLine(entry.linkedEvent)}`,
    `- Kingdom Role: ${mdLine(entry.kingdomRole)}`,
    `- Folder: ${mdLine(entry.folder)}`,
    `- Updated: ${mdLine(entry.updatedAt)}`,
    "",
    "## First Impression",
    mdLine(entry.firstImpression),
    "",
    "## Agenda",
    mdLine(entry.agenda),
    "",
    "## Leverage",
    mdLine(entry.leverage),
    "",
    "## Pressure",
    mdLine(entry.pressure),
    "",
    "## Rumor",
    mdLine(entry.rumor),
    "",
    "## Secret",
    mdLine(entry.secret),
    "",
    "## Next Scene",
    mdLine(entry.nextScene),
    "",
    "## Kingdom Notes",
    mdLine(entry.kingdomNotes),
    "",
    "## Notes",
    mdLine(entry.notes),
  ].join("\n");
}

function buildCompanionNote(entry) {
  return [
    `# ${entry.name || "Companion"}`,
    "",
    `- Status: ${mdLine(entry.status)}`,
    `- Influence: ${mdLine(entry.influence)}`,
    `- Current Hex: ${mdLine(entry.currentHex)}`,
    `- Travel State: ${mdLine(entry.travelState)}`,
    `- Spotlight: ${mdLine(entry.spotlight)}`,
    `- Kingdom Role: ${mdLine(entry.kingdomRole)}`,
    `- Linked Quest: ${mdLine(entry.linkedQuest)}`,
    `- Linked Event: ${mdLine(entry.linkedEvent)}`,
    `- Personal Quest: ${mdLine(entry.personalQuest)}`,
    `- Quest Stage: ${mdLine(entry.questStage)}`,
    `- Folder: ${mdLine(entry.folder)}`,
    `- Updated: ${mdLine(entry.updatedAt)}`,
    "",
    "## Recruitment / Hook",
    mdLine(entry.recruitment),
    "",
    "## Influence",
    mdLine(entry.influenceNotes),
    "",
    "## Relationship Hooks",
    mdLine(entry.relationshipHooks),
    "",
    "## Friction",
    mdLine(entry.friction),
    "",
    "## Camp",
    mdLine([entry.campRole, entry.campNotes].filter(Boolean).join(" - ")),
    "",
    "## Kingdom Fit",
    mdLine([entry.kingdomRole, entry.kingdomNotes].filter(Boolean).join(" - ")),
    "",
    "## Next Scene",
    mdLine(entry.nextScene),
    "",
    "## Notes",
    mdLine(entry.notes),
  ].join("\n");
}

function buildQuestNote(entry) {
  return [
    `# ${entry.title || "Quest"}`,
    "",
    `- Status: ${mdLine(entry.status)}`,
    `- Priority: ${mdLine(entry.priority)}`,
    `- Chapter / Arc: ${mdLine(entry.chapter)}`,
    `- Hex: ${mdLine(entry.hex)}`,
    `- Giver: ${mdLine(entry.giver)}`,
    `- Linked Companion: ${mdLine(entry.linkedCompanion)}`,
    `- Linked Event: ${mdLine(entry.linkedEvent)}`,
    `- Folder: ${mdLine(entry.folder)}`,
    `- Updated: ${mdLine(entry.updatedAt)}`,
    "",
    "## Objective",
    mdLine(entry.objective),
    "",
    "## Stakes",
    mdLine(entry.stakes),
    "",
    "## Next Beat",
    mdLine(entry.nextBeat),
    "",
    "## Blockers",
    mdLine(entry.blockers),
    "",
    "## Reward / Payoff",
    mdLine(entry.reward),
    "",
    "## Notes",
    mdLine(entry.notes),
  ].join("\n");
}

function buildEventNote(entry) {
  const impactSummary = describeEventImpactSummary(entry);
  return [
    `# ${entry.title || "Event"}`,
    "",
    `- Category: ${mdLine(entry.category)}`,
    `- Status: ${mdLine(entry.status)}`,
    `- Urgency: ${mdLine(entry.urgency)}`,
    `- Hex: ${mdLine(entry.hex)}`,
    `- Linked Quest: ${mdLine(entry.linkedQuest)}`,
    `- Linked Companion: ${mdLine(entry.linkedCompanion)}`,
    `- Clock: ${mdLine(formatEventClockSummary(entry))}`,
    `- Advance: ${mdLine(`${coerceInteger(entry.advancePerTurn, 0)}/turn via ${String(entry.advanceOn || "manual")}`)}`,
    `- Impact Scope: ${mdLine(entry.impactScope)}`,
    `- Last Triggered: ${mdLine(entry.lastTriggeredTurn || entry.lastTriggeredAt)}`,
    `- Resolved At: ${mdLine(entry.resolvedAt)}`,
    `- Folder: ${mdLine(entry.folder)}`,
    `- Updated: ${mdLine(entry.updatedAt)}`,
    "",
    "## Trigger",
    mdLine(entry.trigger),
    "",
    "## Consequence Summary",
    mdLine(entry.consequenceSummary || entry.fallout),
    "",
    "## Fallout",
    mdLine(entry.fallout),
    "",
    "## Kingdom Impact",
    mdLine(impactSummary),
    "",
    "## Notes",
    mdLine(entry.notes),
  ].join("\n");
}

function buildLocationNote(entry) {
  return [
    `# ${entry.name || "Location"}`,
    "",
    `- Type: ${mdLine(entry.type)}`,
    `- Status: ${mdLine(entry.status)}`,
    `- Hex / Area: ${mdLine(entry.hex)}`,
    `- Controlling Faction: ${mdLine(entry.controllingFaction)}`,
    `- Linked Quest: ${mdLine(entry.linkedQuest)}`,
    `- Linked Event: ${mdLine(entry.linkedEvent)}`,
    `- Linked NPC: ${mdLine(entry.linkedNpc)}`,
    `- Folder: ${mdLine(entry.folder)}`,
    `- Updated: ${mdLine(entry.updatedAt)}`,
    "",
    "## What Changed",
    mdLine(entry.whatChanged),
    "",
    "## Scene Texture",
    mdLine(entry.sceneTexture),
    "",
    "## Opportunities",
    mdLine(entry.opportunities),
    "",
    "## Risks",
    mdLine(entry.risks),
    "",
    "## Rumor",
    mdLine(entry.rumor),
    "",
    "## Notes",
    mdLine(entry.notes),
  ].join("\n");
}

function buildKingdomNote(entry) {
  const commodities = entry?.commodities && typeof entry.commodities === "object" ? entry.commodities : {};
  const ruin = entry?.ruin && typeof entry.ruin === "object" ? entry.ruin : {};
  return [
    `# ${entry.name || "Kingdom Sheet"}`,
    "",
    `- Rules Profile: ${mdLine(entry.profileLabel)}`,
    `- Charter: ${mdLine(entry.charter)}`,
    `- Government: ${mdLine(entry.government)}`,
    `- Heartland: ${mdLine(entry.heartland)}`,
    `- Turn: ${mdLine(entry.currentTurnLabel)}`,
    `- Date: ${mdLine(entry.currentDate)}`,
    `- Calendar Anchor: ${mdLine(entry.calendarStartDate)}${entry.calendarAnchorLabel ? ` (${mdLine(entry.calendarAnchorLabel, "")})` : ""}`,
    `- Level: ${mdLine(entry.level)}`,
    `- Size: ${mdLine(entry.size)}`,
    `- Control DC: ${mdLine(entry.controlDC)}`,
    `- Resource Points: ${mdLine(entry.resourcePoints)}`,
    `- Consumption: ${mdLine(entry.consumption)}`,
    `- Culture / Economy / Loyalty / Stability: ${coerceInteger(entry.culture, 0)} / ${coerceInteger(entry.economy, 0)} / ${coerceInteger(entry.loyalty, 0)} / ${coerceInteger(entry.stability, 0)}`,
    `- Unrest / Renown / Fame / Infamy: ${coerceInteger(entry.unrest, 0)} / ${coerceInteger(entry.renown, 0)} / ${coerceInteger(entry.fame, 0)} / ${coerceInteger(entry.infamy, 0)}`,
    `- Commodities: Food ${coerceInteger(commodities.food, 0)} / Lumber ${coerceInteger(commodities.lumber, 0)} / Luxuries ${coerceInteger(commodities.luxuries, 0)} / Ore ${coerceInteger(commodities.ore, 0)} / Stone ${coerceInteger(commodities.stone, 0)}`,
    `- Ruin: Corruption ${coerceInteger(ruin.corruption, 0)} / Crime ${coerceInteger(ruin.crime, 0)} / Decay ${coerceInteger(ruin.decay, 0)} / Strife ${coerceInteger(ruin.strife, 0)} / Threshold ${coerceInteger(ruin.threshold, 0)}`,
    "",
    "## Kingdom Notes",
    mdLine(entry.notes),
    "",
    "## Leaders",
    mdBullets((entry.leaders || []).map((leader) => `${leader.role}: ${leader.name || "Vacant"} (${leader.ability || "No ability"}, +${leader.leadershipBonus || 0})${leader.notes ? ` — ${leader.notes}` : ""}`)),
    "",
    "## Settlements",
    mdBullets((entry.settlements || []).map((settlement) => `${settlement.name} (${settlement.size}) • influence ${settlement.influence} • ${settlement.civicStructure || "No civic structure"}${settlement.notes ? ` — ${settlement.notes}` : ""}`)),
    "",
    "## Claimed Regions",
    mdBullets(
      (entry.regions || []).map(
        (region) =>
          `${region.hex}: ${region.status || "Unknown"}${region.terrain ? ` • ${region.terrain}` : ""}${region.workSite ? ` • ${region.workSite}` : ""}${
            region.discovery ? ` • discovery: ${region.discovery}` : ""
          }${region.danger ? ` • danger: ${region.danger}` : ""}${region.improvement ? ` • improvement: ${region.improvement}` : ""}${region.notes ? ` — ${region.notes}` : ""}`
      )
    ),
    "",
    "## Recent Kingdom Turns",
    mdBullets(
      (entry.turns || []).map(
        (turn) =>
          `${turn.title || "Turn"}${turn.date ? ` (${turn.date})` : ""} • RP ${turn.resourceDelta >= 0 ? "+" : ""}${turn.resourceDelta} • Unrest ${turn.unrestDelta >= 0 ? "+" : ""}${turn.unrestDelta}${
            turn.summary ? ` — ${turn.summary}` : ""
          }${turn.eventSummary ? ` | event: ${turn.eventSummary}` : ""}${turn.notes ? ` | ${turn.notes}` : ""}`
      )
    ),
    "",
    "## Recent Event History",
    mdBullets(
      (entry.eventHistory || []).map(
        (item) =>
          `${item.eventTitle || "Event"}${item.type ? ` (${item.type})` : ""}${item.turnTitle ? ` • ${item.turnTitle}` : ""}${item.hex ? ` • ${item.hex}` : ""}${
            item.summary ? ` — ${item.summary}` : ""
          }${item.impactApplied === true ? " | kingdom impact applied" : ""}${item.at ? ` | ${item.at}` : ""}`
      )
    ),
    "",
    "## Calendar History",
    mdBullets(
      (entry.calendarHistory || []).map(
        (item) =>
          `${item.startDate && item.endDate && item.startDate !== item.endDate ? `${item.startDate} -> ${item.endDate}` : item.endDate || item.date || "Unknown date"}${
            item.daysAdvanced > 1 ? ` (${item.daysAdvanced} days)` : ""
          }${item.label ? ` • ${item.label}` : ""}${item.notes ? ` — ${item.notes}` : ""}${item.source ? ` | ${item.source}` : ""}`
      )
    ),
  ].join("\n");
}

function buildHexMapNote(entry, regions) {
  return [
    `# ${entry.mapName || "Hex Map"}`,
    "",
    `- Background: ${mdLine(entry.backgroundName)}`,
    `- Party Position: ${mdLine(entry.party?.hex)}`,
    `- Party Label: ${mdLine(entry.party?.label)}`,
    "",
    "## Party Notes",
    mdLine(entry.party?.notes),
    "",
    "## Party Trail",
    mdBullets((entry.party?.trail || []).map((point) => `${point.hex}${point.at ? ` • ${point.at}` : ""}`)),
    "",
    "## Force Markers",
    mdBullets((entry.forces || []).map((force) => `${force.name} (${force.type}) at ${force.hex}${force.notes ? ` — ${force.notes}` : ""}`)),
    "",
    "## Map Markers",
    mdBullets((entry.markers || []).map((marker) => `${marker.title} (${marker.type}) at ${marker.hex}${marker.notes ? ` — ${marker.notes}` : ""}`)),
    "",
    "## Region Snapshot",
    mdBullets(
      (regions || []).map(
        (region) =>
          `${region.hex}: ${region.status || "Unknown"}${region.terrain ? ` • ${region.terrain}` : ""}${region.workSite ? ` • ${region.workSite}` : ""}${
            region.discovery ? ` • discovery: ${region.discovery}` : ""
          }${region.danger ? ` • danger: ${region.danger}` : ""}${region.improvement ? ` • improvement: ${region.improvement}` : ""}${region.notes ? ` — ${region.notes}` : ""}`
      )
    ),
  ].join("\n");
}

function buildLiveCaptureNote(entries) {
  return [
    "# Table Notes",
    "",
    mdBullets((entries || []).map((entry) => `${entry.timestamp || "Unknown time"} • ${entry.kind || "Note"}${entry.sessionId ? ` • ${entry.sessionId}` : ""} — ${entry.note || ""}`)),
  ].join("\n");
}

function buildCampaignHomeNote(payload, noteRefs) {
  return [
    `# ${payload.campaignName || "Kingmaker Companion Campaign"}`,
    "",
    `- Synced: ${mdLine(payload.generatedAt)}`,
    `- Sessions: ${(payload.sessions || []).length}`,
    `- NPCs: ${(payload.npcs || []).length}`,
    `- Companions: ${(payload.companions || []).length}`,
    `- Quests: ${(payload.quests || []).length}`,
    `- Events: ${(payload.events || []).length}`,
    `- Locations: ${(payload.locations || []).length}`,
    "",
    "## Quick Links",
    `- Kingdom Sheet: ${mdWikiLink("Kingdom", noteRefs.kingdom, "Kingdom Sheet")}`,
    `- Hex Map: ${mdWikiLink("Hex Map", noteRefs.hexMap, "Hex Map")}`,
    `- Table Notes: ${mdWikiLink(".", noteRefs.liveCapture, "Table Notes")}`,
    "",
    "## Sessions",
    mdBullets(noteRefs.sessions.map((entry) => mdWikiLink("Sessions", entry.noteName, entry.label))),
    "",
    "## NPCs",
    mdBullets(noteRefs.npcs.map((entry) => mdWikiLink("NPCs", entry.noteName, entry.label))),
    "",
    "## Companions",
    mdBullets(noteRefs.companions.map((entry) => mdWikiLink("Companions", entry.noteName, entry.label))),
    "",
    "## Quests",
    mdBullets(noteRefs.quests.map((entry) => mdWikiLink("Quests", entry.noteName, entry.label))),
    "",
    "## Events",
    mdBullets(noteRefs.events.map((entry) => mdWikiLink("Events", entry.noteName, entry.label))),
    "",
    "## Locations",
    mdBullets(noteRefs.locations.map((entry) => mdWikiLink("Locations", entry.noteName, entry.label))),
  ].join("\n");
}

async function syncObsidianVault(payload) {
  const vaultPath = String(payload?.vaultPath || "").trim();
  if (!vaultPath) {
    throw new Error("Vault path is required.");
  }
  const baseFolderName = sanitizeVaultFileName(payload?.baseFolder || "Kingmaker Companion", "Kingmaker Companion");
  const rootFolder = path.join(vaultPath, baseFolderName);
  const looksLikeVault = await pathExists(path.join(vaultPath, ".obsidian"));
  await fs.mkdir(rootFolder, { recursive: true });
  await fs.mkdir(path.join(rootFolder, "Sessions"), { recursive: true });
  await fs.mkdir(path.join(rootFolder, "NPCs"), { recursive: true });
  await fs.mkdir(path.join(rootFolder, "Companions"), { recursive: true });
  await fs.mkdir(path.join(rootFolder, "Quests"), { recursive: true });
  await fs.mkdir(path.join(rootFolder, "Events"), { recursive: true });
  await fs.mkdir(path.join(rootFolder, "Locations"), { recursive: true });
  await fs.mkdir(path.join(rootFolder, "Kingdom"), { recursive: true });
  await fs.mkdir(path.join(rootFolder, "Hex Map"), { recursive: true });

  const refs = {
    sessions: [],
    npcs: [],
    companions: [],
    quests: [],
    events: [],
    locations: [],
    kingdom: "Kingdom Sheet",
    hexMap: "Hex Map",
    liveCapture: "Table Notes",
  };

  const usedNames = {
    sessions: new Set(),
    npcs: new Set(),
    companions: new Set(),
    quests: new Set(),
    events: new Set(),
    locations: new Set(),
  };

  let filesWritten = 0;

  for (const session of Array.isArray(payload?.sessions) ? payload.sessions : []) {
    const noteName = uniqueVaultNoteName(session?.title || "Session", usedNames.sessions);
    await writeVaultMarkdownFile(rootFolder, ["Sessions", `${noteName}.md`], buildSessionNote(session));
    refs.sessions.push({ noteName, label: session?.title || noteName });
    filesWritten += 1;
  }

  for (const npc of Array.isArray(payload?.npcs) ? payload.npcs : []) {
    const noteName = uniqueVaultNoteName(npc?.name || "NPC", usedNames.npcs);
    await writeVaultMarkdownFile(rootFolder, ["NPCs", `${noteName}.md`], buildNpcNote(npc));
    refs.npcs.push({ noteName, label: npc?.name || noteName });
    filesWritten += 1;
  }

  for (const companion of Array.isArray(payload?.companions) ? payload.companions : []) {
    const noteName = uniqueVaultNoteName(companion?.name || "Companion", usedNames.companions);
    await writeVaultMarkdownFile(rootFolder, ["Companions", `${noteName}.md`], buildCompanionNote(companion));
    refs.companions.push({ noteName, label: companion?.name || noteName });
    filesWritten += 1;
  }

  for (const quest of Array.isArray(payload?.quests) ? payload.quests : []) {
    const noteName = uniqueVaultNoteName(quest?.title || "Quest", usedNames.quests);
    await writeVaultMarkdownFile(rootFolder, ["Quests", `${noteName}.md`], buildQuestNote(quest));
    refs.quests.push({ noteName, label: quest?.title || noteName });
    filesWritten += 1;
  }

  for (const eventEntry of Array.isArray(payload?.events) ? payload.events : []) {
    const noteName = uniqueVaultNoteName(eventEntry?.title || "Event", usedNames.events);
    await writeVaultMarkdownFile(rootFolder, ["Events", `${noteName}.md`], buildEventNote(eventEntry));
    refs.events.push({ noteName, label: eventEntry?.title || noteName });
    filesWritten += 1;
  }

  for (const location of Array.isArray(payload?.locations) ? payload.locations : []) {
    const noteName = uniqueVaultNoteName(location?.name || "Location", usedNames.locations);
    await writeVaultMarkdownFile(rootFolder, ["Locations", `${noteName}.md`], buildLocationNote(location));
    refs.locations.push({ noteName, label: location?.name || noteName });
    filesWritten += 1;
  }

  await writeVaultMarkdownFile(rootFolder, ["Kingdom", `${refs.kingdom}.md`], buildKingdomNote(payload?.kingdom || {}));
  filesWritten += 1;
  await writeVaultMarkdownFile(rootFolder, ["Hex Map", `${refs.hexMap}.md`], buildHexMapNote(payload?.hexMap || {}, payload?.kingdom?.regions || []));
  filesWritten += 1;
  await writeVaultMarkdownFile(rootFolder, [`${refs.liveCapture}.md`], buildLiveCaptureNote(payload?.liveCapture || []));
  filesWritten += 1;
  await writeVaultMarkdownFile(rootFolder, ["Campaign Home.md"], buildCampaignHomeNote(payload || {}, refs));
  filesWritten += 1;

  return {
    syncedAt: new Date().toISOString(),
    rootFolder,
    filesWritten,
    looksLikeVault,
    summary: `Synced ${filesWritten} notes${looksLikeVault ? "" : " (selected folder does not currently contain a .obsidian vault folder)"}`,
  };
}

function sanitizeVaultRelativeSegments(value, fallback = []) {
  const raw = Array.isArray(value) ? value.join("/") : String(value || "");
  const segments = raw
    .split(/[\\/]+/)
    .map((segment) => sanitizeVaultFileName(segment, ""))
    .filter(Boolean)
    .slice(0, 8);
  return segments.length ? segments : Array.isArray(fallback) ? fallback : [sanitizeVaultFileName(fallback, "AI Notes")];
}

function extractObsidianQueryTerms(value) {
  const stopWords = new Set([
    "about",
    "after",
    "also",
    "and",
    "any",
    "are",
    "because",
    "book",
    "build",
    "could",
    "create",
    "does",
    "from",
    "give",
    "help",
    "here",
    "into",
    "just",
    "more",
    "need",
    "notes",
    "only",
    "party",
    "players",
    "quest",
    "really",
    "scene",
    "should",
    "some",
    "that",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "vault",
    "what",
    "with",
    "would",
    "your",
  ]);
  const unique = new Set();
  for (const term of String(value || "").toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || []) {
    if (stopWords.has(term)) continue;
    unique.add(term);
    if (unique.size >= 14) break;
  }
  return [...unique];
}

async function collectVaultMarkdownFiles(rootFolder, fileLimit = OBSIDIAN_AI_CONTEXT_FILE_SCAN_LIMIT) {
  const ignoreDirs = new Set([".obsidian", ".git", ".trash", "node_modules", ".obsidian-trash"]);
  const pending = [rootFolder];
  const files = [];
  while (pending.length && files.length < fileLimit) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (files.length >= fileLimit) break;
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name.toLowerCase())) continue;
        pending.push(entryPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") continue;
      files.push(entryPath);
    }
  }
  return files;
}

function extractObsidianNoteTitle(text, filePath) {
  const heading = String(text || "").match(/^\s*#\s+(.+?)\s*$/m);
  if (heading?.[1]) return heading[1].trim();
  return path.basename(String(filePath || ""), path.extname(String(filePath || ""))) || "Untitled";
}

function extractRelevantVaultExcerpt(text, queryTerms, charLimit = 420) {
  const source = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!source) return "";
  const paragraphs = source
    .split(/\n\s*\n+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 40);
  if (!paragraphs.length) return "";
  if (!Array.isArray(queryTerms) || !queryTerms.length) return paragraphs[0].slice(0, charLimit);
  const scored = paragraphs
    .map((paragraph, index) => {
      const lower = paragraph.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        if (lower.includes(term)) score += term.length > 6 ? 3 : 2;
      }
      return { paragraph, score, index };
    })
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return (scored[0]?.score > 0 ? scored[0].paragraph : paragraphs[0]).slice(0, charLimit);
}

function scoreVaultNote({ title, text, terms, modifiedAt }) {
  const titleLower = String(title || "").toLowerCase();
  const textLower = String(text || "").toLowerCase();
  let score = 0;
  for (const term of Array.isArray(terms) ? terms : []) {
    if (titleLower.includes(term)) score += 8;
    if (textLower.includes(term)) score += 3;
  }
  const agePenalty = Number.isFinite(modifiedAt) ? Math.max(0, (Date.now() - modifiedAt) / 86400000) : 365;
  score += Math.max(0, 5 - Math.min(agePenalty, 5));
  return score;
}

async function getObsidianVaultContext(payload) {
  const vaultPath = String(payload?.vaultPath || "").trim();
  if (!vaultPath) {
    throw new Error("Vault path is required.");
  }
  const baseFolderName = sanitizeVaultFileName(payload?.baseFolder || "Kingmaker Companion", "Kingmaker Companion");
  const readWholeVault = payload?.readWholeVault !== false;
  const maxNotes = Math.max(1, Math.min(12, Number.parseInt(String(payload?.maxNotes || OBSIDIAN_AI_CONTEXT_DEFAULT_NOTE_LIMIT), 10) || OBSIDIAN_AI_CONTEXT_DEFAULT_NOTE_LIMIT));
  const maxChars = Math.max(800, Math.min(12000, Number.parseInt(String(payload?.maxChars || OBSIDIAN_AI_CONTEXT_DEFAULT_CHAR_LIMIT), 10) || OBSIDIAN_AI_CONTEXT_DEFAULT_CHAR_LIMIT));
  const sourceRoot = readWholeVault ? vaultPath : path.join(vaultPath, baseFolderName);
  const sourceExists = await pathExists(sourceRoot);
  if (!sourceExists) {
    return {
      sourceRoot,
      noteCount: 0,
      notes: [],
      summary: "",
      looksLikeVault: await pathExists(path.join(vaultPath, ".obsidian")),
    };
  }
  const markdownFiles = await collectVaultMarkdownFiles(sourceRoot);
  const queryTerms = extractObsidianQueryTerms(payload?.query || "");
  const notes = [];
  for (const filePath of markdownFiles) {
    try {
      const stats = await fs.stat(filePath);
      const rawText = await fs.readFile(filePath, "utf8");
      const text = String(rawText || "").replace(/\u0000/g, "").trim();
      if (!text) continue;
      const title = extractObsidianNoteTitle(text, filePath);
      const excerpt = extractRelevantVaultExcerpt(text, queryTerms, 420);
      notes.push({
        title,
        relativePath: path.relative(vaultPath, filePath).replace(/\\/g, "/"),
        modifiedAt: stats?.mtime ? stats.mtime.toISOString() : "",
        score: scoreVaultNote({
          title,
          text: `${title}\n${text.slice(0, 6000)}`,
          terms: queryTerms,
          modifiedAt: Number(stats?.mtimeMs || 0),
        }),
        excerpt,
      });
    } catch {
      // Skip unreadable notes.
    }
  }
  const ranked = notes
    .sort((a, b) => (b.score - a.score) || String(b.modifiedAt || "").localeCompare(String(a.modifiedAt || "")))
    .slice(0, maxNotes);
  const summaryLines = [];
  let usedChars = 0;
  for (const note of ranked) {
    const line = `- ${note.title} [${note.relativePath}]${note.excerpt ? `: ${note.excerpt}` : ""}`;
    if (usedChars + line.length > maxChars && summaryLines.length) break;
    summaryLines.push(line.slice(0, Math.max(120, maxChars - usedChars)));
    usedChars += line.length + 1;
    if (usedChars >= maxChars) break;
  }
  return {
    sourceRoot,
    noteCount: notes.length,
    notes: ranked.map(({ title, relativePath, modifiedAt, excerpt }) => ({
      title,
      relativePath,
      modifiedAt,
      excerpt,
    })),
    summary: summaryLines.join("\n"),
    looksLikeVault: await pathExists(path.join(vaultPath, ".obsidian")),
  };
}

function buildObsidianAiNoteMarkdown(payload) {
  const title = sanitizeVaultFileName(payload?.title || "AI Note", "AI Note");
  const generatedAt = String(payload?.generatedAt || new Date().toISOString()).trim();
  const sourceTab = String(payload?.sourceTab || "").trim();
  const model = String(payload?.model || "").trim();
  const prompt = mdText(payload?.prompt || "");
  const content = mdText(payload?.content || "");
  return [
    `# ${title}`,
    "",
    `- Generated: ${mdLine(generatedAt)}`,
    `- Source Tab: ${mdLine(sourceTab)}`,
    `- Model: ${mdLine(model)}`,
    "",
    "## Prompt",
    mdLine(prompt),
    "",
    "## AI Output",
    mdLine(content),
  ].join("\n");
}

async function writeObsidianAiNote(payload) {
  const vaultPath = String(payload?.vaultPath || "").trim();
  if (!vaultPath) {
    throw new Error("Vault path is required.");
  }
  const content = mdText(payload?.content || "");
  if (!content) {
    throw new Error("AI output is empty.");
  }
  const baseFolderName = sanitizeVaultFileName(payload?.baseFolder || "Kingmaker Companion", "Kingmaker Companion");
  const rootFolder = path.join(vaultPath, baseFolderName);
  const noteFolderSegments = sanitizeVaultRelativeSegments(payload?.noteFolder, ["AI Notes"]);
  const noteName = sanitizeVaultFileName(payload?.title || "AI Note", "AI Note");
  await fs.mkdir(path.join(rootFolder, ...noteFolderSegments), { recursive: true });
  const relativeSegments = [...noteFolderSegments, `${noteName}.md`];
  const targetPath = await writeVaultMarkdownFile(rootFolder, relativeSegments, buildObsidianAiNoteMarkdown(payload));
  return {
    rootFolder,
    targetPath,
    relativePath: path.relative(vaultPath, targetPath).replace(/\\/g, "/"),
    writtenAt: new Date().toISOString(),
    summary: `Wrote AI note to ${path.relative(rootFolder, targetPath).replace(/\\/g, "/")}.`,
  };
}

function sanitizeEmbeddingVector(rawVector) {
  if (!Array.isArray(rawVector) || !rawVector.length) return null;
  const clean = rawVector
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .slice(0, 4096);
  if (!clean.length) return null;
  return normalizeEmbeddingVector(clean);
}

function normalizeEmbeddingVector(vector) {
  const clean = Array.isArray(vector) ? vector.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [];
  if (!clean.length) return null;
  let magnitude = 0;
  for (const value of clean) {
    magnitude += value * value;
  }
  const norm = Math.sqrt(magnitude);
  if (!Number.isFinite(norm) || norm <= 0) return null;
  return clean.map((value) => Number((value / norm).toFixed(6)));
}

function serializeEmbeddingVector(vector) {
  return Array.isArray(vector) ? vector.map((value) => Number(Number(value).toFixed(6))).filter((value) => Number.isFinite(value)) : [];
}

function buildFileSemanticSource(fileName, summary, pages) {
  const summaryText = normalizePdfText(String(summary || ""));
  if (summaryText) {
    return normalizePdfText(`${fileName}\n${summaryText}`).slice(0, 2400);
  }
  const preview = (Array.isArray(pages) ? pages : [])
    .slice(0, 3)
    .map((page) => normalizePdfText(page?.text || ""))
    .filter(Boolean)
    .join(" ");
  return normalizePdfText(`${fileName}\n${preview}`).slice(0, 2400);
}

function buildRetrievalChunksForPages(pages, chunkSize = PDF_RETRIEVAL_CHUNK_SIZE, overlap = PDF_RETRIEVAL_CHUNK_OVERLAP) {
  const chunks = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    const pageNum = Number.parseInt(String(page?.page || chunks.length + 1), 10) || chunks.length + 1;
    const text = normalizePdfText(String(page?.text || ""));
    if (!text) continue;
    let start = 0;
    let chunkIndex = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + Math.max(320, Number(chunkSize) || PDF_RETRIEVAL_CHUNK_SIZE));
      if (end < text.length) {
        const window = text.slice(start, Math.min(text.length, end + 180));
        const breakpoints = [". ", "? ", "! ", "; ", ", ", " "];
        let best = -1;
        for (const marker of breakpoints) {
          const hit = window.lastIndexOf(marker);
          if (hit > best) best = hit;
        }
        if (best >= 240) {
          end = start + best + 1;
        }
      }
      const chunkText = normalizePdfText(text.slice(start, end));
      if (chunkText.length >= 120) {
        chunks.push({
          id: `p${pageNum}-c${chunkIndex + 1}`,
          page: pageNum,
          pageEnd: pageNum,
          text: chunkText,
          textLower: chunkText.toLowerCase(),
          charCount: chunkText.length,
          embedding: null,
        });
        chunkIndex += 1;
      }
      if (end >= text.length) break;
      start = Math.max(start + 1, end - Math.max(60, Number(overlap) || PDF_RETRIEVAL_CHUNK_OVERLAP));
    }
  }
  return chunks;
}

function sanitizeRetrievalChunk(rawChunk, fallbackChunk = null) {
  const source = rawChunk && typeof rawChunk === "object" ? rawChunk : {};
  const sourceText = normalizePdfText(String(source.text || ""));
  const fallbackText = normalizePdfText(String(fallbackChunk?.text || ""));
  const sourceMatchesFallback = sourceText && (!fallbackText || sourceText === fallbackText);
  const baseText = sourceMatchesFallback ? sourceText : fallbackText || sourceText;
  if (!baseText) return null;
  const page = Number.parseInt(String(source.page ?? fallbackChunk?.page ?? 1), 10) || 1;
  const pageEnd = Number.parseInt(String(source.pageEnd ?? fallbackChunk?.pageEnd ?? page), 10) || page;
  const embedding = sourceMatchesFallback
    ? sanitizeEmbeddingVector(source.embedding || fallbackChunk?.embedding)
    : sanitizeEmbeddingVector(fallbackChunk?.embedding);
  return {
    id: String(source.id || fallbackChunk?.id || `p${page}-c1`).trim() || `p${page}-c1`,
    page,
    pageEnd: Math.max(page, pageEnd),
    text: baseText,
    textLower: baseText.toLowerCase(),
    charCount: baseText.length,
    embedding,
  };
}

function sanitizeFileRetrieval(rawRetrieval, pages, fileName, summary) {
  const source = rawRetrieval && typeof rawRetrieval === "object" ? rawRetrieval : {};
  const baseChunks = buildRetrievalChunksForPages(pages);
  const existingChunks = new Map();
  if (Array.isArray(source.chunks)) {
    for (const rawChunk of source.chunks) {
      const cleanChunk = sanitizeRetrievalChunk(rawChunk);
      if (!cleanChunk) continue;
      existingChunks.set(cleanChunk.id, cleanChunk);
    }
  }
  const chunks = baseChunks
    .map((baseChunk) => sanitizeRetrievalChunk(existingChunks.get(baseChunk.id), baseChunk))
    .filter(Boolean);
  return {
    chunkSize: Number.parseInt(String(source.chunkSize || PDF_RETRIEVAL_CHUNK_SIZE), 10) || PDF_RETRIEVAL_CHUNK_SIZE,
    chunkOverlap: Number.parseInt(String(source.chunkOverlap || PDF_RETRIEVAL_CHUNK_OVERLAP), 10) || PDF_RETRIEVAL_CHUNK_OVERLAP,
    embeddingModel: String(source.embeddingModel || "").trim(),
    fileEmbedding: sanitizeEmbeddingVector(source.fileEmbedding),
    fileEmbeddingUpdatedAt: String(source.fileEmbeddingUpdatedAt || "").trim(),
    fileSemanticSource: buildFileSemanticSource(fileName, summary, pages),
    chunks,
  };
}

function sanitizeIndexedPage(rawPage, fallbackPageNumber) {
  const pageNum = Number.parseInt(String(rawPage?.page ?? fallbackPageNumber), 10) || fallbackPageNumber;
  const text = normalizePdfText(String(rawPage?.text || ""));
  if (!text) return null;
  return {
    page: pageNum,
    text,
    textLower: text.toLowerCase(),
    charCount: text.length,
  };
}

function normalizeStoredPdfSummaryText(text) {
  const source = String(text || "").replace(/\r\n?/g, "\n");
  if (!source) return "";
  const lines = source.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trimEnd());
  const cleaned = [];
  let lastBlank = false;
  for (const line of lines) {
    const normalized = line.trim() ? line : "";
    if (!normalized) {
      if (lastBlank) continue;
      cleaned.push("");
      lastBlank = true;
      continue;
    }
    lastBlank = false;
    cleaned.push(normalized);
  }
  return cleaned.join("\n").trim().slice(0, 24000);
}

function sanitizeIndexedFile(rawFile) {
  const filePath = String(rawFile?.path || "").trim();
  const fileName = String(rawFile?.fileName || path.basename(filePath || "")).trim();
  const pagesRaw = Array.isArray(rawFile?.pages) ? rawFile.pages : [];
  const pages = pagesRaw
    .map((rawPage, index) => sanitizeIndexedPage(rawPage, index + 1))
    .filter(Boolean);
  if (!filePath || !fileName || !pages.length) return null;
  const merged = normalizePdfText(pages.map((page) => page.text).join(" "));
  const summary = normalizeStoredPdfSummaryText(rawFile?.summary);
  const summaryUpdatedAt = String(rawFile?.summaryUpdatedAt || "").trim();
  const retrieval = sanitizeFileRetrieval(rawFile?.retrieval, pages, fileName, summary);
  return {
    path: filePath,
    fileName,
    pages,
    text: merged,
    textLower: merged.toLowerCase(),
    charCount: merged.length,
    summary,
    summaryUpdatedAt,
    retrieval,
  };
}

function sanitizePdfIndexCache(rawCache) {
  const filesRaw = Array.isArray(rawCache?.files) ? rawCache.files : [];
  const files = filesRaw.map((file) => sanitizeIndexedFile(file)).filter(Boolean);
  return {
    folderPath: String(rawCache?.folderPath || "").trim(),
    indexedAt: String(rawCache?.indexedAt || "").trim(),
    files,
  };
}

function buildPdfIndexSummary() {
  const files = pdfIndexCache.files
    .map((file) => ({
      fileName: String(file?.fileName || "").trim(),
      path: String(file?.path || "").trim(),
      pageCount: Array.isArray(file?.pages) ? file.pages.length : 0,
      charCount: Number.parseInt(String(file?.charCount || 0), 10) || 0,
      summary: normalizeStoredPdfSummaryText(file?.summary),
      summaryUpdatedAt: String(file?.summaryUpdatedAt || "").trim(),
      retrievalChunks: Array.isArray(file?.retrieval?.chunks) ? file.retrieval.chunks.length : 0,
      retrievalEmbeddingModel: String(file?.retrieval?.embeddingModel || "").trim(),
    }))
    .filter((file) => file.fileName && file.path)
    .sort((a, b) => a.fileName.localeCompare(b.fileName) || a.path.localeCompare(b.path));
  const fileNames = files.map((file) => file.fileName);
  return {
    folderPath: String(pdfIndexCache.folderPath || "").trim(),
    indexedAt: String(pdfIndexCache.indexedAt || "").trim(),
    count: pdfIndexCache.files.length,
    fileNames,
    files,
  };
}

function buildRagStatus(rawConfig = {}) {
  const config = normalizeAiConfig(rawConfig);
  const files = Array.isArray(pdfIndexCache.files) ? pdfIndexCache.files : [];
  const embeddingModels = new Map();
  let pageCount = 0;
  let chunkCount = 0;
  let embeddedChunks = 0;
  let embeddedFiles = 0;
  let charCount = 0;
  const filesStatus = [];

  for (const file of files) {
    const pages = getIndexedPages(file);
    const retrieval = ensureFileRetrievalState(file);
    const chunks = Array.isArray(retrieval?.chunks) ? retrieval.chunks : [];
    const fileEmbeddedChunks = chunks.filter((chunk) => Array.isArray(chunk?.embedding) && chunk.embedding.length).length;
    const fileCharCount = Number.parseInt(String(file?.charCount || 0), 10) || 0;
    pageCount += pages.length;
    charCount += fileCharCount;
    const modelName = String(retrieval?.embeddingModel || "").trim();
    if (modelName) embeddingModels.set(modelName, (embeddingModels.get(modelName) || 0) + 1);
    if (Array.isArray(retrieval?.fileEmbedding) && retrieval.fileEmbedding.length) embeddedFiles += 1;
    chunkCount += chunks.length;
    embeddedChunks += fileEmbeddedChunks;
    filesStatus.push({
      fileName: String(file?.fileName || "").trim(),
      path: String(file?.path || "").trim(),
      pageCount: pages.length,
      charCount: fileCharCount,
      retrievalChunks: chunks.length,
      embeddedChunks: fileEmbeddedChunks,
      semanticCoverage: chunks.length ? Math.round((fileEmbeddedChunks / chunks.length) * 100) : 0,
      indexLimitChars: MAX_CHARS_PER_FILE,
      likelyTruncated: fileCharCount >= MAX_CHARS_PER_FILE - 1000,
    });
  }
  filesStatus.sort((a, b) => b.charCount - a.charCount || a.fileName.localeCompare(b.fileName));

  const semanticCoverage = chunkCount ? Math.round((embeddedChunks / chunkCount) * 100) : 0;

  return {
    endpoint: config.endpoint,
    generationModel: config.model,
    configuredEmbeddingModel: config.embeddingModel,
    retrievalMode: config.retrievalMode,
    retrievalLimit: config.retrievalLimit,
    rerankEnabled: config.rerankEnabled,
    indexedAt: String(pdfIndexCache.indexedAt || "").trim(),
    indexedFiles: files.length,
    indexedPages: pageCount,
    indexedCharacters: charCount,
    retrievalChunks: chunkCount,
    embeddedFiles,
    embeddedChunks,
    semanticCoverage,
    maxIndexedCharactersPerPdf: MAX_CHARS_PER_FILE,
    files: filesStatus,
    activeEmbeddingModels: [...embeddingModels.entries()]
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || String(a[0]).localeCompare(String(b[0])))
      .map(([model, filesUsingModel]) => ({ model, filesUsingModel })),
    candidateEmbeddingModels: PDF_EMBEDDING_MODEL_CANDIDATES,
    note: files.length
      ? embeddedChunks >= chunkCount && chunkCount
        ? "PDF index is searchable. Semantic chunk embeddings cover the indexed library."
        : embeddedChunks
          ? "PDF index is searchable. Semantic chunk embeddings cover part of the library; missing chunks will be embedded lazily by search."
          : "PDF index is searchable. Semantic embeddings will be created lazily on the next RAG search."
      : "No PDFs are indexed yet. Index the Source Library before using PDF RAG.",
  };
}

async function loadPdfIndexCacheFromDisk() {
  try {
    const cachePath = getPdfIndexCachePath();
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    pdfIndexCache = sanitizePdfIndexCache(parsed);
  } catch {
    pdfIndexCache = {
      folderPath: "",
      indexedAt: "",
      files: [],
    };
  }
}

async function savePdfIndexCacheToDisk() {
  const cachePath = getPdfIndexCachePath();
  const serializable = {
    folderPath: String(pdfIndexCache.folderPath || "").trim(),
    indexedAt: String(pdfIndexCache.indexedAt || "").trim(),
    files: pdfIndexCache.files.map((file) => ({
      path: String(file?.path || "").trim(),
      fileName: String(file?.fileName || "").trim(),
      summary: normalizeStoredPdfSummaryText(file?.summary),
      summaryUpdatedAt: String(file?.summaryUpdatedAt || "").trim(),
      retrieval: {
        chunkSize: Number.parseInt(String(file?.retrieval?.chunkSize || PDF_RETRIEVAL_CHUNK_SIZE), 10) || PDF_RETRIEVAL_CHUNK_SIZE,
        chunkOverlap: Number.parseInt(String(file?.retrieval?.chunkOverlap || PDF_RETRIEVAL_CHUNK_OVERLAP), 10) || PDF_RETRIEVAL_CHUNK_OVERLAP,
        embeddingModel: String(file?.retrieval?.embeddingModel || "").trim(),
        fileEmbeddingUpdatedAt: String(file?.retrieval?.fileEmbeddingUpdatedAt || "").trim(),
        fileEmbedding: serializeEmbeddingVector(file?.retrieval?.fileEmbedding),
        chunks: (Array.isArray(file?.retrieval?.chunks) ? file.retrieval.chunks : [])
          .map((chunk) => sanitizeRetrievalChunk(chunk))
          .filter(Boolean)
          .map((chunk) => ({
            id: chunk.id,
            page: chunk.page,
            pageEnd: chunk.pageEnd,
            text: chunk.text,
            embedding: serializeEmbeddingVector(chunk.embedding),
          })),
      },
      pages: (Array.isArray(file?.pages) ? file.pages : [])
        .map((page, index) => sanitizeIndexedPage(page, index + 1))
        .filter(Boolean)
        .map((page) => ({
          page: page.page,
          text: page.text,
        })),
    })),
  };
  await fs.writeFile(cachePath, JSON.stringify(serializable), "utf8");
}

function emitPdfSummarizeProgress(sender, payload) {
  if (!sender) return;
  try {
    if (typeof sender.isDestroyed === "function" && sender.isDestroyed()) return;
    sender.send("pdf:summarize-progress", {
      at: new Date().toISOString(),
      ...payload,
    });
  } catch {
    // Ignore renderer IPC delivery issues.
  }
}

function emitSemanticIndexProgress(sender, payload) {
  if (!sender) return;
  try {
    if (typeof sender.isDestroyed === "function" && sender.isDestroyed()) return;
    sender.send("ai:semantic-index-progress", {
      at: new Date().toISOString(),
      ...payload,
    });
  } catch {
    // Ignore renderer IPC delivery issues.
  }
}

function registerIpc() {
  ipcMain.handle("campaign:load-state", async () => {
    return readCampaignStateFromDisk();
  });

  ipcMain.handle("campaign:save-state", async (_event, payload) => {
    return writeCampaignStateToDisk(payload || {});
  });

  ipcMain.handle("pdf:get-default-folder", async () => {
    return DEFAULT_PDF_FOLDER;
  });

  ipcMain.handle("obsidian:pick-vault", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose Obsidian Vault",
      properties: ["openDirectory"],
      defaultPath: app.getPath("documents"),
    });
    if (result.canceled || !result.filePaths?.length) return null;
    const selectedPath = result.filePaths[0];
    return {
      path: selectedPath,
      looksLikeVault: await pathExists(path.join(selectedPath, ".obsidian")),
    };
  });

  ipcMain.handle("obsidian:sync", async (_event, payload) => {
    return syncObsidianVault(payload || {});
  });

  ipcMain.handle("obsidian:get-context", async (_event, payload) => {
    return getObsidianVaultContext(payload || {});
  });

  ipcMain.handle("obsidian:write-ai-note", async (_event, payload) => {
    return writeObsidianAiNote(payload || {});
  });

  ipcMain.handle("aon:search-rules", async (_event, payload) => {
    const query = String(payload?.query || "").trim();
    const limitRaw = Number.parseInt(String(payload?.limit || "4"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, AON_RULES_MAX_MATCHES)) : 4;
    return searchAonRules(query, limit, { force: payload?.force === true });
  });

  ipcMain.handle("map:pick-background", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose Hex Map Background",
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      ],
      defaultPath: DEFAULT_PDF_FOLDER,
    });
    if (result.canceled || !result.filePaths?.length) return null;
    const selectedPath = result.filePaths[0];
    return {
      path: selectedPath,
      fileUrl: pathToFileURL(selectedPath).href,
      name: path.basename(selectedPath),
    };
  });

  ipcMain.handle("pdf:get-index-summary", async () => {
    return buildPdfIndexSummary();
  });

  ipcMain.handle("pdf:pick-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose PDF Folder",
      properties: ["openDirectory"],
      defaultPath: DEFAULT_PDF_FOLDER,
    });
    if (result.canceled || !result.filePaths?.length) return "";
    return result.filePaths[0];
  });

  ipcMain.handle("pdf:index-folder", async (_event, folderPath) => {
    if (!folderPath) {
      throw new Error("Folder path is required.");
    }

    const pdfPaths = await collectPdfPaths(folderPath);
    const existingByPath = new Map(
      (Array.isArray(pdfIndexCache.files) ? pdfIndexCache.files : [])
        .map((file) => [String(file?.path || ""), file])
        .filter((entry) => entry[0])
    );
    const indexedFiles = [];
    let failed = 0;

    for (const pdfPath of pdfPaths) {
      try {
        const buffer = await fs.readFile(pdfPath);
        const pages = await extractPdfPages(buffer, MAX_CHARS_PER_FILE);
        const existing = existingByPath.get(pdfPath);
        const merged = normalizePdfText(pages.map((page) => page.text).join(" "));
        indexedFiles.push(sanitizeIndexedFile({
          path: pdfPath,
          fileName: path.basename(pdfPath),
          pages,
          summary: normalizeStoredPdfSummaryText(existing?.summary),
          summaryUpdatedAt: String(existing?.summaryUpdatedAt || "").trim(),
          retrieval: existing?.retrieval || null,
        }));
      } catch {
        failed += 1;
      }
    }

    pdfIndexCache = {
      folderPath,
      indexedAt: new Date().toISOString(),
      files: indexedFiles,
    };

    await savePdfIndexCacheToDisk();

    return {
      ...buildPdfIndexSummary(),
      failed,
    };
  });

  ipcMain.handle("pdf:read-file-data", async (_event, targetPath) => {
    const resolvedPath = String(targetPath || "").trim();
    if (!resolvedPath) {
      throw new Error("PDF path is required.");
    }
    return fs.readFile(resolvedPath);
  });

  ipcMain.handle("pdf:search", async (_event, payload) => {
    const query = String(payload?.query || "").trim();
    const limitRaw = Number.parseInt(String(payload?.limit || "20"), 10);
    const limit = Number.isNaN(limitRaw) ? 20 : Math.max(1, Math.min(limitRaw, 100));
    const config = await prepareAiGenerationConfig(normalizeAiConfig(payload?.config));

    if (!query) return { results: [] };
    if (!pdfIndexCache.files.length) {
      throw new Error("No PDFs indexed yet. Run Index PDFs first.");
    }

    return searchIndexedPdfHybrid(query, limit, { config });
  });

  ipcMain.handle("pdf:summarize-file", async (event, payload) => {
    if (!pdfIndexCache.files.length) {
      throw new Error("No PDFs indexed yet. Run Index PDFs first.");
    }

    const target = resolveIndexedPdfFile(payload);
    if (!target) {
      throw new Error("Could not find that indexed PDF. Re-index and try again.");
    }

    const force = payload?.force === true;
    if (!force && normalizePdfText(String(target.summary || ""))) {
      emitPdfSummarizeProgress(event?.sender, {
        stage: "done",
        fileName: target.fileName,
        path: target.path,
        current: 1,
        total: 1,
        message: `Loaded saved summary for ${target.fileName}.`,
      });
      return {
        ...buildPdfSummaryResponse(target),
        reused: true,
        chunks: 0,
      };
    }

    const config = normalizeAiConfig(payload?.config);
    const chunkSummaryConfig = buildPdfSummaryConfig(config, "chunk");
    const finalSummaryConfig = buildPdfSummaryConfig(config, "final");
    const text = normalizePdfText(String(target.text || target.pages?.map((page) => page.text || "").join(" ") || ""));
    if (!text) {
      throw new Error("Indexed PDF text is empty for this file.");
    }

    const chunks = splitTextIntoChunks(text, 7600, 6);
    const progressTotal = Math.max(2, chunks.length + 1);
    emitPdfSummarizeProgress(event?.sender, {
      stage: "start",
      fileName: target.fileName,
      path: target.path,
      current: 0,
      total: progressTotal,
      message: `Starting summary for ${target.fileName}...`,
    });
    const chunkSummaries = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkText = chunks[i];
      emitPdfSummarizeProgress(event?.sender, {
        stage: "chunk",
        fileName: target.fileName,
        path: target.path,
        current: i + 1,
        total: progressTotal,
        message: `Summarizing chunk ${i + 1}/${chunks.length}...`,
      });
      const prompt = buildPdfChunkSummaryPrompt({
        fileName: target.fileName,
        chunkText,
        index: i + 1,
        total: chunks.length,
      });
      try {
        const raw = await generateWithOllama(chunkSummaryConfig, prompt);
        const cleaned = sanitizeAiTextOutput(raw);
        chunkSummaries.push(cleaned || extractiveChunkSummary(chunkText));
      } catch {
        chunkSummaries.push(extractiveChunkSummary(chunkText));
      }
    }

    const combinedPrompt = buildPdfFinalSummaryPrompt({
      fileName: target.fileName,
      chunkSummaries,
    });
    emitPdfSummarizeProgress(event?.sender, {
      stage: "combine",
      fileName: target.fileName,
      path: target.path,
      current: Math.max(1, chunks.length),
      total: progressTotal,
      message: `Combining chunk summaries for ${target.fileName}...`,
    });
    let finalSummary = "";
    try {
      const rawFinal = await generateWithOllama(finalSummaryConfig, combinedPrompt);
      finalSummary = sanitizeAiTextOutput(rawFinal);
    } catch {
      finalSummary = "";
    }
    if (!isUsefulPdfSummary(finalSummary)) {
      emitPdfSummarizeProgress(event?.sender, {
        stage: "combine",
        fileName: target.fileName,
        path: target.path,
        current: Math.max(1, chunks.length),
        total: progressTotal,
        message: `Refining summary structure for ${target.fileName}...`,
      });
      try {
        const retryPrompt = buildPdfFinalSummaryRetryPrompt({
          fileName: target.fileName,
          chunkSummaries,
        });
        const retryConfig = {
          ...finalSummaryConfig,
          maxOutputTokens: Math.max(Number(finalSummaryConfig.maxOutputTokens || 0) || 0, 1600),
          timeoutSec: Math.max(Number(finalSummaryConfig.timeoutSec || 0) || 0, 480),
        };
        retryConfig.timeoutMs = Math.max(15000, Number(retryConfig.timeoutSec || 0) * 1000);
        const rawRetry = await generateWithOllama(retryConfig, retryPrompt);
        const cleanedRetry = sanitizeAiTextOutput(rawRetry);
        if (isUsefulPdfSummary(cleanedRetry)) {
          finalSummary = cleanedRetry;
        }
      } catch {
        // Fall back below.
      }
    }
    if (!isUsefulPdfSummary(finalSummary)) {
      finalSummary = combineChunkSummariesFallback(target.fileName, chunkSummaries);
    }

    target.summary = normalizeStoredPdfSummaryText(finalSummary);
    target.summaryUpdatedAt = new Date().toISOString();
    await savePdfIndexCacheToDisk();
    emitPdfSummarizeProgress(event?.sender, {
      stage: "done",
      fileName: target.fileName,
      path: target.path,
      current: progressTotal,
      total: progressTotal,
      message: `Summary complete for ${target.fileName}.`,
    });

    return {
      ...buildPdfSummaryResponse(target),
      reused: false,
      chunks: chunks.length,
    };
  });

  ipcMain.handle("system:open-path", async (_event, targetPath) => {
    if (!targetPath) return false;
    await shell.openPath(targetPath);
    return true;
  });

  ipcMain.handle("system:open-external", async (_event, targetUrl) => {
    const url = String(targetUrl || "").trim();
    if (!url) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle("system:open-path-at-page", async (_event, payload) => {
    const targetPath = String(payload?.targetPath || "").trim();
    if (!targetPath) return false;
    const pageRaw = Number.parseInt(String(payload?.page || "0"), 10);
    const page = Number.isNaN(pageRaw) ? 0 : Math.max(0, pageRaw);
    if (!page) {
      await shell.openPath(targetPath);
      return true;
    }

    try {
      await openPdfAtPageInApp(targetPath, page);
      return true;
    } catch {
      await shell.openPath(targetPath);
      return true;
    }
  });

  ipcMain.handle("ai:test-connection", async (_event, rawConfig) => {
    const config = normalizeAiConfig(rawConfig);
    return testOllamaConnection(config);
  });

  ipcMain.handle("ai:list-models", async (_event, rawConfig) => {
    const config = normalizeAiConfig(rawConfig);
    const models = await listOllamaModelsWithRecovery(config.endpoint, Math.min(20000, Number(config?.timeoutMs) || 10000));
    return {
      endpoint: config.endpoint,
      models,
    };
  });

  ipcMain.handle("ai:get-rag-status", async (_event, rawConfig) => buildRagStatus(rawConfig));

  ipcMain.handle("ai:build-semantic-index", async (event, rawConfig) => {
    return buildSemanticIndexForLibrary(event.sender, rawConfig);
  });

  ipcMain.handle("ai:generate-text", async (_event, payload) => {
    const input = String(payload?.input || "").trim();
    if (!input) {
      throw new Error("Draft text is required.");
    }

    const mode = String(payload?.mode || "session");
    const activeTab = String(payload?.context?.activeTab || "").trim();
    const selectedPdfFile = String(payload?.context?.selectedPdfFile || "").trim();
    const context =
      payload?.context && typeof payload.context === "object" && !Array.isArray(payload.context)
        ? payload.context
        : {};
    const config = normalizeAiConfig(payload?.config);
    const enrichedContext = {
      ...context,
      selectedPdfFile,
      selectedPdfPreview: selectedPdfFile ? buildSelectedPdfPreview(selectedPdfFile, 1200) : "",
      pdfContextEnabled: false,
      pdfSnippets: [],
      pdfIndexedFiles: getIndexedPdfFileNames(config.compactContext ? 20 : 40),
      pdfIndexedFileCount: pdfIndexCache.files.length,
      aonRulesEnabled: false,
      aonRulesMatches: Array.isArray(context?.aonRulesMatches) ? context.aonRulesMatches : [],
    };
    const assistantRouteResult =
      String(mode || "").toLowerCase() === "assistant" ? resolveAssistantRoute(input, enrichedContext) : null;
    if (assistantRouteResult) {
      enrichedContext.askIntent = assistantRouteResult.intent;
      enrichedContext.answerMode = assistantRouteResult.answerMode;
      enrichedContext.contextPlan = {
        included: assistantRouteResult.includedBuckets,
        excluded: assistantRouteResult.excludedBuckets,
      };
      enrichedContext.routeDebug = {
        intent: assistantRouteResult.intent,
        answerMode: assistantRouteResult.answerMode,
        included: assistantRouteResult.includedBuckets,
        excluded: assistantRouteResult.excludedBuckets,
        reasons: assistantRouteResult.reasons,
      };
      enrichedContext.routeReason = assistantRouteResult.reasons.join("; ");
      if (assistantRouteResult.intent === "player_build") {
        enrichedContext.taskType = "player_build_advice";
        enrichedContext.playerBuildRequested = true;
        enrichedContext.campaignOpeningRequested = false;
      } else if (assistantRouteResult.intent === "rules_question") {
        enrichedContext.taskType = "rules_question";
      } else if (assistantRouteResult.intent === "campaign_recall") {
        enrichedContext.taskType = "campaign_recall";
      } else {
        enrichedContext.taskType = String(enrichedContext.taskType || "");
      }
      if (assistantRouteResult.intent === "session_start_or_opening") {
        enrichedContext.campaignOpeningRequested = true;
      }
    }
    if (
      config.useAonRules &&
      String(enrichedContext?.askIntent || enrichedContext?.taskType || "").trim() === "rules_question" &&
      !enrichedContext.aonRulesMatches.length
    ) {
      try {
        const aonResults = await searchAonRules(input, config.compactContext ? 3 : 4);
        enrichedContext.aonRulesMatches = Array.isArray(aonResults?.results) ? aonResults.results : [];
        enrichedContext.aonRulesEnabled = enrichedContext.aonRulesMatches.length > 0;
      } catch {
        enrichedContext.aonRulesEnabled = false;
      }
    } else {
      enrichedContext.aonRulesEnabled = enrichedContext.aonRulesMatches.length > 0;
    }
    const assistantIntent = String(assistantRouteResult?.intent || enrichedContext?.askIntent || "").trim();
    const shouldFetchPdfContext =
      config.usePdfContext &&
      pdfIndexCache.files.length &&
      assistantIntent !== "player_build" &&
      assistantIntent !== "campaign_recall" &&
      assistantIntent !== "general_chat";
    if (shouldFetchPdfContext) {
      const campaignOpeningRequested = assistantRouteResult?.intent === "session_start_or_opening";
      const query = [
        input,
        String(enrichedContext?.tabContext || ""),
        String(enrichedContext?.knowledgeGraph?.route?.queryExpansion || ""),
        Array.isArray(enrichedContext?.knowledgeGraph?.sourceTypes)
          ? enrichedContext.knowledgeGraph.sourceTypes.map((source) => String(source?.label || source?.id || "")).join(" ")
          : "",
        Array.isArray(enrichedContext?.knowledgeGraph?.matchedNodes)
          ? enrichedContext.knowledgeGraph.matchedNodes
              .slice(0, 8)
              .map((node) => String(node?.label || ""))
              .join(" ")
          : "",
        campaignOpeningRequested
          ? "Jamandi Aldori Restov invitation charter ceremony opening prologue first session Aldori mansion manor"
          : String(enrichedContext?.latestSession?.summary || ""),
        campaignOpeningRequested ? "" : String(enrichedContext?.latestSession?.nextPrep || ""),
      ]
        .join(" ")
        .trim();
      const configuredSnippetLimit = Math.max(1, Math.min(Number(config.retrievalLimit || AI_PDF_SNIPPET_LIMIT), 12));
      const snippetLimit = config.compactContext
        ? Math.min(configuredSnippetLimit, AI_PDF_SNIPPET_LIMIT)
        : Math.max(configuredSnippetLimit, AI_PDF_SNIPPET_LIMIT);
      try {
        enrichedContext.pdfSnippets = await collectPdfContextForAi(query, snippetLimit, {
          config,
          preferredFileName: selectedPdfFile,
        });
        if (!enrichedContext.pdfSnippets.length && selectedPdfFile && (activeTab === "pdf" || isPdfGroundedQuestion(input))) {
          enrichedContext.pdfSnippets = collectSelectedPdfFallbackContext(selectedPdfFile, query, snippetLimit);
        }
        enrichedContext.pdfContextEnabled = enrichedContext.pdfSnippets.length > 0;
      } catch (error) {
        enrichedContext.pdfSnippets = [];
        enrichedContext.pdfContextEnabled = false;
        enrichedContext.pdfContextError = String(error?.message || error || "PDF retrieval failed.").slice(0, 260);
      }
    }

    const promptPayload =
      String(mode || "").toLowerCase() === "assistant"
        ? buildAssistantPromptPayload({
            input,
            context: enrichedContext,
            compactContext: config.compactContext,
          })
        : {
            routeResult: null,
            systemPrompt:
              "You are the Kingmaker Steward, a practical Pathfinder 2e Kingmaker GM aide. If the prompt asks for JSON, a schema, or exact labels, obey that structure exactly and do not add extra conversational text.",
            userPrompt: buildDraftModePrompt({
              mode,
              input,
              context: enrichedContext,
              compactContext: config.compactContext,
            }),
          };
    const scopedSourceReply = maybeBuildSourceScopeReply(mode, input, enrichedContext);
    if (scopedSourceReply) {
      return {
        text: scopedSourceReply,
        model: config.model,
        endpoint: config.endpoint,
        usedFallback: false,
        filtered: true,
        fallbackReason: "",
        routeDebug: enrichedContext.routeDebug || null,
      };
    }

    let generation;
    try {
      generation = await generateWithOllamaFastFallback(config, promptPayload);
    } catch (error) {
      if (isAiTimeoutError(error) && String(mode || "").toLowerCase() === "assistant") {
        return {
          text: buildAssistantTimeoutFallback({ mode, input, context: enrichedContext }),
          model: config.model,
          endpoint: config.endpoint,
          usedFallback: true,
          filtered: true,
          fallbackReason: String(error?.message || error || "Local AI timed out."),
          routeDebug: enrichedContext.routeDebug || null,
        };
      }
      throw error;
    }
    const finalized = finalizeAiOutput({
      rawText: generation.text,
      mode,
      input,
      tabId: String(enrichedContext?.activeTab || "").trim(),
      context: enrichedContext,
    });
    return {
      text: finalized.text,
      model: generation.config?.model || config.model,
      endpoint: generation.config?.endpoint || config.endpoint,
      usedFallback: finalized.usedFallback || generation.usedGenerationFallback,
      filtered: finalized.filtered,
      fallbackReason: finalized.fallbackReason || generation.fallbackReason || "",
      routeDebug: enrichedContext.routeDebug || null,
    };
  });
}

async function collectPdfPaths(rootDir) {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        out.push(fullPath);
      }
    }
  }

  return out;
}

async function extractPdfPages(buffer, maxCharsPerFile = MAX_CHARS_PER_FILE) {
  const pages = [];
  let remainingChars = Math.max(1, Number.parseInt(String(maxCharsPerFile || MAX_CHARS_PER_FILE), 10));

  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      if (remainingChars <= 0) {
        pages.push({
          page: pages.length + 1,
          text: "",
          textLower: "",
          charCount: 0,
        });
        return "";
      }

      const textContent = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      const rawText = textContent.items.map((item) => String(item.str || "")).join(" ");
      const cleaned = normalizePdfText(rawText);
      const clipped = cleaned.slice(0, remainingChars);
      remainingChars -= clipped.length;

      pages.push({
        page: pages.length + 1,
        text: clipped,
        textLower: clipped.toLowerCase(),
        charCount: clipped.length,
      });

      return clipped;
    },
  });

  return pages.filter((page) => page.charCount > 0);
}

function normalizePdfText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function buildSearchParts(query) {
  const phrase = normalizePdfText(query).toLowerCase();
  const words = phrase
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  return { phrase, words };
}

function getIndexedPages(file) {
  if (Array.isArray(file?.pages) && file.pages.length) {
    return file.pages
      .map((page, index) => {
        const text = String(page?.text || "");
        return {
          page: Number.parseInt(String(page?.page || index + 1), 10) || index + 1,
          text,
          textLower: String(page?.textLower || text.toLowerCase()),
        };
      })
      .filter((page) => page.text.length > 0);
  }

  const text = String(file?.text || "");
  return text
    ? [
        {
          page: 1,
          text,
          textLower: String(file?.textLower || text.toLowerCase()),
        },
      ]
    : [];
}

function ensureFileRetrievalState(file) {
  if (!file || typeof file !== "object") return { chunks: [], embeddingModel: "", fileEmbedding: null, fileSemanticSource: "" };
  if (!file.retrieval || typeof file.retrieval !== "object") {
    file.retrieval = sanitizeFileRetrieval(null, getIndexedPages(file), String(file?.fileName || ""), String(file?.summary || ""));
    return file.retrieval;
  }
  const expectedSource = buildFileSemanticSource(String(file?.fileName || ""), String(file?.summary || ""), getIndexedPages(file));
  if (String(file.retrieval.fileSemanticSource || "") !== expectedSource) {
    file.retrieval.fileSemanticSource = expectedSource;
    file.retrieval.fileEmbedding = null;
    file.retrieval.fileEmbeddingUpdatedAt = "";
  }
  if (!Array.isArray(file.retrieval.chunks) || !file.retrieval.chunks.length) {
    file.retrieval = sanitizeFileRetrieval(file.retrieval, getIndexedPages(file), String(file?.fileName || ""), String(file?.summary || ""));
  }
  return file.retrieval;
}

function dotProduct(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || !vectorA.length || vectorA.length !== vectorB.length) return 0;
  let total = 0;
  for (let i = 0; i < vectorA.length; i += 1) {
    total += Number(vectorA[i] || 0) * Number(vectorB[i] || 0);
  }
  return total;
}

function getChunkKey(file, chunk) {
  const filePath = String(file?.path || "").trim();
  const chunkId = String(chunk?.id || "").trim();
  return `${filePath}::${chunkId}`;
}

function buildChunkSearchResult(file, chunk, score, firstHit = -1) {
  return {
    key: getChunkKey(file, chunk),
    fileName: String(file?.fileName || "").trim(),
    path: String(file?.path || "").trim(),
    page: Number.parseInt(String(chunk?.page || 1), 10) || 1,
    pageEnd: Number.parseInt(String(chunk?.pageEnd || chunk?.page || 1), 10) || (Number.parseInt(String(chunk?.page || 1), 10) || 1),
    score,
    snippet: makeSnippet(String(chunk?.text || ""), firstHit),
    chunkId: String(chunk?.id || "").trim(),
  };
}

function collectLexicalChunkMatches(files, query, limit = PDF_HYBRID_MATCH_LIMIT, preferredFileName = "") {
  const searchParts = buildSearchParts(query);
  if (!searchParts.words.length && !searchParts.phrase) return [];
  const preferred = String(preferredFileName || "").trim().toLowerCase();
  const ranked = [];
  for (const file of files) {
    const retrieval = ensureFileRetrievalState(file);
    for (const chunk of retrieval.chunks) {
      const match = scoreTextAgainstQuery(chunk.textLower, searchParts);
      if (!match.score) continue;
      const fileBoost = preferred && String(file?.fileName || "").trim().toLowerCase() === preferred ? 3 : 0;
      ranked.push({
        ...buildChunkSearchResult(file, chunk, match.score + fileBoost, match.firstHit),
        lexicalScore: match.score + fileBoost,
      });
    }
  }
  ranked.sort((a, b) => b.lexicalScore - a.lexicalScore || a.fileName.localeCompare(b.fileName) || a.page - b.page);
  return ranked.slice(0, Math.max(1, Math.min(Number(limit) || PDF_HYBRID_MATCH_LIMIT, 120)));
}

async function pickAvailableEmbeddingModel(endpoint, timeoutMs = 10000, preferredModel = "") {
  const safeEndpoint = String(endpoint || DEFAULT_AI_ENDPOINT).replace(/\/+$/g, "");
  const preferred = String(preferredModel || "").trim();
  const now = Date.now();
  if (
    pdfEmbeddingModelCache.endpoint === safeEndpoint &&
    now - Number(pdfEmbeddingModelCache.checkedAt || 0) < 120000
  ) {
    if (!preferred) return pdfEmbeddingModelCache.model || "";
  }
  const models = await listOllamaModelsWithRecovery(safeEndpoint, timeoutMs);
  if (preferred) {
    return models.some((model) => String(model || "").trim().toLowerCase() === preferred.toLowerCase()) ? preferred : "";
  }
  const match = PDF_EMBEDDING_MODEL_CANDIDATES.find((candidate) =>
    models.some((model) => String(model || "").trim().toLowerCase() === candidate.toLowerCase())
  );
  pdfEmbeddingModelCache = {
    endpoint: safeEndpoint,
    checkedAt: now,
    model: match || "",
  };
  return match || "";
}

async function requestOllamaEmbeddings(endpoint, model, inputs, timeoutMs = 45000) {
  const safeInputs = (Array.isArray(inputs) ? inputs : [inputs]).map((item) => normalizePdfText(String(item || ""))).filter(Boolean);
  if (!safeInputs.length) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(10000, Number(timeoutMs) || 45000));
  try {
    try {
      const data = await requestOllamaJson(
        `${endpoint}/api/embed`,
        {
          model,
          input: safeInputs,
          truncate: true,
        },
        controller.signal
      );
      const vectors = Array.isArray(data?.embeddings)
        ? data.embeddings
        : Array.isArray(data?.embedding)
          ? [data.embedding]
          : [];
      return vectors.map((vector) => sanitizeEmbeddingVector(vector)).filter(Boolean);
    } catch (err) {
      const message = String(err?.message || err || "").toLowerCase();
      if (!message.includes("/api/embed")) {
        // requestOllamaJson uses generic errors, so retry the legacy endpoint unless we clearly timed out.
      }
      const vectors = [];
      for (const text of safeInputs) {
        const data = await requestOllamaJson(
          `${endpoint}/api/embeddings`,
          {
            model,
            prompt: text,
          },
          controller.signal
        );
        vectors.push(sanitizeEmbeddingVector(data?.embedding));
      }
      return vectors.filter(Boolean);
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Embedding request timed out after ${Math.round((Number(timeoutMs) || 45000) / 1000)}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureFileEmbeddings(files, endpoint, model, timeoutMs = 45000) {
  const pending = [];
  for (const file of files) {
    const retrieval = ensureFileRetrievalState(file);
    if (retrieval.embeddingModel && retrieval.embeddingModel !== model) {
      retrieval.fileEmbedding = null;
      retrieval.fileEmbeddingUpdatedAt = "";
      for (const chunk of retrieval.chunks) {
        chunk.embedding = null;
      }
      retrieval.embeddingModel = "";
    }
    if (Array.isArray(retrieval.fileEmbedding) && retrieval.fileEmbedding.length) {
      continue;
    }
    const semanticText = normalizePdfText(String(retrieval.fileSemanticSource || buildFileSemanticSource(file.fileName, file.summary, getIndexedPages(file))));
    if (!semanticText) continue;
    pending.push({ file, text: semanticText });
  }
  if (!pending.length) return false;

  let changed = false;
  for (let index = 0; index < pending.length; index += PDF_EMBED_BATCH_SIZE) {
    const batch = pending.slice(index, index + PDF_EMBED_BATCH_SIZE);
    const vectors = await requestOllamaEmbeddings(endpoint, model, batch.map((item) => item.text), timeoutMs);
    for (let offset = 0; offset < batch.length; offset += 1) {
      const vector = vectors[offset];
      if (!vector) continue;
      const retrieval = ensureFileRetrievalState(batch[offset].file);
      retrieval.fileEmbedding = vector;
      retrieval.fileEmbeddingUpdatedAt = new Date().toISOString();
      retrieval.embeddingModel = model;
      changed = true;
    }
  }
  return changed;
}

async function ensureChunkEmbeddingsForFiles(files, endpoint, model, timeoutMs = 45000) {
  const pending = [];
  for (const file of files) {
    const retrieval = ensureFileRetrievalState(file);
    if (retrieval.embeddingModel && retrieval.embeddingModel !== model) {
      retrieval.fileEmbedding = null;
      retrieval.fileEmbeddingUpdatedAt = "";
      for (const chunk of retrieval.chunks) {
        chunk.embedding = null;
      }
      retrieval.embeddingModel = "";
    }
    for (const chunk of retrieval.chunks) {
      if (Array.isArray(chunk.embedding) && chunk.embedding.length) continue;
      pending.push({ file, chunk });
    }
  }
  if (!pending.length) return false;

  let changed = false;
  for (let index = 0; index < pending.length; index += PDF_EMBED_BATCH_SIZE) {
    const batch = pending.slice(index, index + PDF_EMBED_BATCH_SIZE);
    const vectors = await requestOllamaEmbeddings(endpoint, model, batch.map((item) => item.chunk.text), timeoutMs);
    for (let offset = 0; offset < batch.length; offset += 1) {
      const vector = vectors[offset];
      if (!vector) continue;
      const { file, chunk } = batch[offset];
      const retrieval = ensureFileRetrievalState(file);
      const target = retrieval.chunks.find((entry) => entry.id === chunk.id);
      if (!target) continue;
      target.embedding = vector;
      retrieval.embeddingModel = model;
      changed = true;
    }
  }
  return changed;
}

function getSemanticIndexStats(files = pdfIndexCache.files) {
  let indexedFiles = 0;
  let retrievalChunks = 0;
  let embeddedChunks = 0;
  let embeddedFiles = 0;
  for (const file of Array.isArray(files) ? files : []) {
    indexedFiles += 1;
    const retrieval = ensureFileRetrievalState(file);
    const chunks = Array.isArray(retrieval?.chunks) ? retrieval.chunks : [];
    retrievalChunks += chunks.length;
    embeddedChunks += chunks.filter((chunk) => Array.isArray(chunk?.embedding) && chunk.embedding.length).length;
    if (Array.isArray(retrieval?.fileEmbedding) && retrieval.fileEmbedding.length) embeddedFiles += 1;
  }
  return {
    indexedFiles,
    retrievalChunks,
    embeddedChunks,
    embeddedFiles,
    semanticCoverage: retrievalChunks ? Math.round((embeddedChunks / retrievalChunks) * 100) : 0,
  };
}

async function buildSemanticIndexForLibrary(sender, rawConfig = {}) {
  const config = normalizeAiConfig(rawConfig);
  const files = Array.isArray(pdfIndexCache.files) ? pdfIndexCache.files : [];
  if (!files.length) {
    throw new Error("No indexed PDFs found. Index the Source Library before building semantic embeddings.");
  }

  emitSemanticIndexProgress(sender, {
    stage: "starting",
    current: 0,
    total: 1,
    message: "Finding local embedding model...",
  });

  const embeddingModel = await pickAvailableEmbeddingModel(
    config.endpoint,
    Math.max(15000, Number(config.timeoutMs || 0)),
    config.embeddingModel
  );
  if (!embeddingModel) {
    throw new Error(
      config.embeddingModel
        ? `Configured embedding model "${config.embeddingModel}" is not installed in Ollama.`
        : "No local embedding model is installed in Ollama. Install nomic-embed-text to build the semantic index."
    );
  }

  for (const file of files) {
    const retrieval = ensureFileRetrievalState(file);
    if (retrieval.embeddingModel && retrieval.embeddingModel !== embeddingModel) {
      retrieval.fileEmbedding = null;
      retrieval.fileEmbeddingUpdatedAt = "";
      for (const chunk of retrieval.chunks) {
        chunk.embedding = null;
      }
      retrieval.embeddingModel = "";
    }
  }

  let changed = false;
  const timeoutMs = Math.max(120000, Number(config.timeoutMs || 0));
  const beforeStats = getSemanticIndexStats(files);
  emitSemanticIndexProgress(sender, {
    stage: "files",
    current: beforeStats.embeddedFiles,
    total: beforeStats.indexedFiles,
    message: `Embedding ${beforeStats.indexedFiles} PDF-level summaries with ${embeddingModel}...`,
  });

  changed = (await ensureFileEmbeddings(files, config.endpoint, embeddingModel, timeoutMs)) || changed;

  const pending = [];
  for (const file of files) {
    const retrieval = ensureFileRetrievalState(file);
    for (const chunk of retrieval.chunks) {
      if (Array.isArray(chunk?.embedding) && chunk.embedding.length) continue;
      pending.push({ file, chunk });
    }
  }

  const totalChunks = getSemanticIndexStats(files).retrievalChunks;
  let embeddedChunks = getSemanticIndexStats(files).embeddedChunks;
  emitSemanticIndexProgress(sender, {
    stage: "chunks",
    current: embeddedChunks,
    total: totalChunks,
    message: pending.length
      ? `Embedding ${pending.length} missing PDF chunks with ${embeddingModel}...`
      : "All PDF chunks already have semantic embeddings.",
  });

  for (let index = 0; index < pending.length; index += PDF_EMBED_BATCH_SIZE) {
    const batch = pending.slice(index, index + PDF_EMBED_BATCH_SIZE);
    const vectors = await requestOllamaEmbeddings(config.endpoint, embeddingModel, batch.map((item) => item.chunk.text), timeoutMs);
    for (let offset = 0; offset < batch.length; offset += 1) {
      const vector = vectors[offset];
      if (!vector) continue;
      const { file, chunk } = batch[offset];
      const retrieval = ensureFileRetrievalState(file);
      const target = retrieval.chunks.find((entry) => entry.id === chunk.id);
      if (!target) continue;
      target.embedding = vector;
      retrieval.embeddingModel = embeddingModel;
      changed = true;
    }

    embeddedChunks = getSemanticIndexStats(files).embeddedChunks;
    emitSemanticIndexProgress(sender, {
      stage: "chunks",
      current: embeddedChunks,
      total: totalChunks,
      message: `Embedded ${embeddedChunks} of ${totalChunks} PDF chunks.`,
      embeddingModel,
    });

    if (changed && index % (PDF_EMBED_BATCH_SIZE * 8) === 0) {
      await savePdfIndexCacheToDisk();
    }
  }

  if (changed) {
    await savePdfIndexCacheToDisk();
  }

  const status = buildRagStatus(config);
  emitSemanticIndexProgress(sender, {
    stage: "done",
    current: status.embeddedChunks,
    total: status.retrievalChunks,
    message: `Semantic index ready: ${status.embeddedChunks} of ${status.retrievalChunks} chunks embedded.`,
    embeddingModel,
  });
  return {
    ...status,
    embeddingModel,
  };
}

function collectSemanticFileCandidates(files, queryEmbedding, preferredFileName = "", limit = PDF_HYBRID_CANDIDATE_FILE_LIMIT) {
  const preferred = String(preferredFileName || "").trim().toLowerCase();
  const ranked = [];
  for (const file of files) {
    const retrieval = ensureFileRetrievalState(file);
    if (!Array.isArray(retrieval.fileEmbedding) || !retrieval.fileEmbedding.length) continue;
    let score = dotProduct(queryEmbedding, retrieval.fileEmbedding);
    if (preferred && String(file?.fileName || "").trim().toLowerCase() === preferred) {
      score += 0.035;
    }
    ranked.push({ file, score });
  }
  ranked.sort((a, b) => b.score - a.score || String(a.file?.fileName || "").localeCompare(String(b.file?.fileName || "")));
  return ranked.slice(0, Math.max(1, Math.min(Number(limit) || PDF_HYBRID_CANDIDATE_FILE_LIMIT, 20)));
}

function collectSemanticChunkMatches(files, queryEmbedding, limit = PDF_HYBRID_MATCH_LIMIT, preferredFileName = "") {
  const preferred = String(preferredFileName || "").trim().toLowerCase();
  const ranked = [];
  for (const file of files) {
    const retrieval = ensureFileRetrievalState(file);
    for (const chunk of retrieval.chunks) {
      if (!Array.isArray(chunk.embedding) || !chunk.embedding.length) continue;
      let score = dotProduct(queryEmbedding, chunk.embedding);
      if (preferred && String(file?.fileName || "").trim().toLowerCase() === preferred) {
        score += 0.02;
      }
      if (!Number.isFinite(score) || score <= 0) continue;
      ranked.push({
        ...buildChunkSearchResult(file, chunk, score, -1),
        semanticScore: score,
      });
    }
  }
  ranked.sort((a, b) => b.semanticScore - a.semanticScore || a.fileName.localeCompare(b.fileName) || a.page - b.page);
  return ranked.slice(0, Math.max(1, Math.min(Number(limit) || PDF_HYBRID_MATCH_LIMIT, 120)));
}

function fuseHybridMatches(lexicalMatches, semanticMatches, limit = 20) {
  const fused = new Map();
  const rankConstant = 60;
  lexicalMatches.forEach((match, index) => {
    const current = fused.get(match.key) || { ...match, lexicalRank: 0, semanticRank: 0, lexicalScore: 0, semanticScore: 0, fusedScore: 0 };
    current.lexicalRank = index + 1;
    current.lexicalScore = Math.max(Number(current.lexicalScore || 0), Number(match.lexicalScore || match.score || 0));
    current.fusedScore += 1 / (rankConstant + index + 1);
    fused.set(match.key, current);
  });
  semanticMatches.forEach((match, index) => {
    const current = fused.get(match.key) || { ...match, lexicalRank: 0, semanticRank: 0, lexicalScore: 0, semanticScore: 0, fusedScore: 0 };
    current.semanticRank = index + 1;
    current.semanticScore = Math.max(Number(current.semanticScore || 0), Number(match.semanticScore || match.score || 0));
    current.fusedScore += 1 / (rankConstant + index + 1);
    if (!current.snippet && match.snippet) current.snippet = match.snippet;
    fused.set(match.key, current);
  });

  const entries = [...fused.values()].map((entry) => {
    const searchMode = entry.lexicalRank && entry.semanticRank ? "hybrid" : entry.semanticRank ? "semantic" : "lexical";
    return {
      ...entry,
      searchMode,
      score: Math.round(Number(entry.fusedScore || 0) * 100000),
    };
  });
  entries.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.semanticScore || 0) - Number(a.semanticScore || 0) ||
      Number(b.lexicalScore || 0) - Number(a.lexicalScore || 0) ||
      a.fileName.localeCompare(b.fileName) ||
      a.page - b.page
  );
  return entries.slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)));
}

function findChunkForSearchResult(result) {
  const targetPath = String(result?.path || "").trim();
  const targetChunkId = String(result?.chunkId || "").trim();
  if (!targetPath || !targetChunkId) return null;
  const file = pdfIndexCache.files.find((entry) => String(entry?.path || "").trim() === targetPath);
  if (!file) return null;
  const retrieval = ensureFileRetrievalState(file);
  const chunk = (Array.isArray(retrieval?.chunks) ? retrieval.chunks : []).find((entry) => String(entry?.id || "").trim() === targetChunkId);
  return chunk ? { file, chunk } : null;
}

function normalizeSearchScore(value, scale = 1) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  if (scale <= 1) return Math.max(0, Math.min(1, num));
  return Math.max(0, Math.min(1, num / scale));
}

function scoreTitleAgainstQuery(fileName, words) {
  const source = String(fileName || "").toLowerCase();
  if (!source || !Array.isArray(words) || !words.length) return 0;
  const matched = words.filter((word) => word.length >= 4 && source.includes(word)).length;
  return matched ? Math.min(0.12, matched * 0.04) : 0;
}

function rerankPdfMatches(matches, query, limit = 20, config = {}) {
  const candidates = Array.isArray(matches) ? matches : [];
  const desired = Math.max(1, Math.min(Number(limit) || 20, 100));
  if (!config?.rerankEnabled || candidates.length <= 1) {
    return candidates.slice(0, desired).map((entry, index) => ({
      ...entry,
      rank: index + 1,
      reranked: false,
    }));
  }

  const searchParts = buildSearchParts(query);
  const words = Array.isArray(searchParts.words) ? searchParts.words.filter((word) => word.length >= 3) : [];
  const lexicalScale = Math.max(8, words.length * 4 + 8);
  const phrase = String(searchParts.phrase || "");

  const scored = candidates.map((entry) => {
    const found = findChunkForSearchResult(entry);
    const textLower = String(found?.chunk?.textLower || entry?.snippet || "").toLowerCase();
    const queryScore = scoreTextAgainstQuery(textLower, searchParts);
    const rawSemantic = Number(entry?.semanticScore);
    const semantic = Number.isFinite(rawSemantic) && rawSemantic !== 0 ? normalizeSearchScore((rawSemantic + 1) / 2) : 0;
    const lexical = Math.max(
      normalizeSearchScore(entry?.lexicalScore, lexicalScale),
      normalizeSearchScore(queryScore.score, lexicalScale)
    );
    const phraseBoost = phrase && textLower.includes(phrase) ? 0.08 : 0;
    const titleBoost = scoreTitleAgainstQuery(entry?.fileName, words);
    const hybridBoost = entry?.searchMode === "hybrid" ? 0.06 : 0;
    const pageBoost = Number(entry?.page || 0) > 0 ? 0.01 : 0;
    const rerankScore = semantic * 0.46 + lexical * 0.38 + phraseBoost + titleBoost + hybridBoost + pageBoost;
    return {
      ...entry,
      lexicalScore: Number(entry?.lexicalScore || queryScore.score || 0),
      matchedWords: queryScore.matchedWords || 0,
      rerankScore: Number(rerankScore.toFixed(6)),
      reranked: true,
    };
  });

  scored.sort(
    (a, b) =>
      Number(b.rerankScore || 0) - Number(a.rerankScore || 0) ||
      Number(b.semanticScore || 0) - Number(a.semanticScore || 0) ||
      Number(b.lexicalScore || 0) - Number(a.lexicalScore || 0) ||
      a.fileName.localeCompare(b.fileName) ||
      a.page - b.page
  );

  const selected = [];
  const perFile = new Map();
  for (const entry of scored) {
    const fileKey = String(entry?.path || entry?.fileName || "").trim();
    const fileCount = perFile.get(fileKey) || 0;
    if (fileCount >= 3 && selected.length < Math.min(desired, 8)) continue;
    selected.push(entry);
    perFile.set(fileKey, fileCount + 1);
    if (selected.length >= desired) break;
  }
  if (selected.length < desired) {
    for (const entry of scored) {
      if (selected.some((existing) => existing.key === entry.key)) continue;
      selected.push(entry);
      if (selected.length >= desired) break;
    }
  }

  return selected.slice(0, desired).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    score: Math.round(Number(entry.rerankScore || entry.score || 0) * 100000),
    rerankStrategy: "local-hybrid",
  }));
}

async function searchIndexedPdfHybrid(query, limit = 20, options = {}) {
  const normalizedQuery = normalizePdfText(String(query || ""));
  if (!normalizedQuery) {
    return {
      results: [],
      retrieval: {
        mode: "none",
        embeddingModel: "",
        note: "Empty query.",
      },
    };
  }

  const preferredFileName = String(options?.preferredFileName || "").trim();
  const restrictFileName = String(options?.restrictFileName || "").trim().toLowerCase();
  const config = normalizeAiConfig(options?.config || {});
  const allFiles = pdfIndexCache.files.filter((file) => {
    if (!restrictFileName) return true;
    return String(file?.fileName || "").trim().toLowerCase() === restrictFileName;
  });
  const retrievalMode = config.retrievalMode || "hybrid";
  const wantsSemantic = retrievalMode === "hybrid" || retrievalMode === "semantic";
  const matchPoolLimit = Math.max(limit * 4, PDF_HYBRID_MATCH_LIMIT);
  const lexicalMatches = collectLexicalChunkMatches(allFiles, normalizedQuery, matchPoolLimit, preferredFileName);

  if (!wantsSemantic) {
    const ranked = rerankPdfMatches(
      lexicalMatches.map((entry) => ({ ...entry, searchMode: "lexical" })),
      normalizedQuery,
      limit,
      config
    );
    return {
      results: ranked,
      retrieval: {
        mode: "lexical",
        requestedMode: retrievalMode,
        embeddingModel: "",
        reranked: config.rerankEnabled,
        rerankStrategy: config.rerankEnabled ? "local-hybrid" : "off",
        note: "Keyword retrieval only. Semantic embeddings were skipped by RAG settings.",
      },
    };
  }

  let embeddingModel = "";
  try {
    embeddingModel = await pickAvailableEmbeddingModel(
      config.endpoint,
      Math.min(15000, Number(config.timeoutMs || 15000)),
      config.embeddingModel
    );
  } catch {
    embeddingModel = "";
  }
  if (!embeddingModel) {
    const note = config.embeddingModel
      ? `Configured embedding model "${config.embeddingModel}" is not installed. Search used keyword ranking only.`
      : "No local embedding model is installed. Search used keyword ranking only.";
    return {
      results: rerankPdfMatches(
        lexicalMatches.map((entry) => ({ ...entry, searchMode: "lexical" })),
        normalizedQuery,
        limit,
        config
      ),
      retrieval: {
        mode: "lexical",
        requestedMode: retrievalMode,
        embeddingModel: "",
        reranked: config.rerankEnabled,
        rerankStrategy: config.rerankEnabled ? "local-hybrid" : "off",
        note,
      },
    };
  }

  let changed = false;
  try {
    changed = (await ensureFileEmbeddings(allFiles, config.endpoint, embeddingModel, Math.max(25000, Number(config.timeoutMs || 0)))) || changed;
    const queryEmbedding = (await requestOllamaEmbeddings(config.endpoint, embeddingModel, [normalizedQuery], Math.max(25000, Number(config.timeoutMs || 0))))[0];
    if (!queryEmbedding) {
      return {
        results: rerankPdfMatches(
          lexicalMatches.map((entry) => ({ ...entry, searchMode: "lexical" })),
          normalizedQuery,
          limit,
          config
        ),
        retrieval: {
          mode: "lexical",
          requestedMode: retrievalMode,
          embeddingModel,
          reranked: config.rerankEnabled,
          rerankStrategy: config.rerankEnabled ? "local-hybrid" : "off",
          note: `Embedding model "${embeddingModel}" did not return a query vector. Search used keyword ranking only.`,
        },
      };
    }

    const lexicalCandidateFiles = new Map();
    for (const match of lexicalMatches.slice(0, PDF_HYBRID_CANDIDATE_FILE_LIMIT * 3)) {
      if (!lexicalCandidateFiles.has(match.path)) {
        const file = allFiles.find((entry) => String(entry?.path || "").trim() === match.path);
        if (file) lexicalCandidateFiles.set(match.path, file);
      }
      if (lexicalCandidateFiles.size >= PDF_HYBRID_CANDIDATE_FILE_LIMIT) break;
    }
    const semanticFileCandidates = collectSemanticFileCandidates(allFiles, queryEmbedding, preferredFileName, PDF_HYBRID_CANDIDATE_FILE_LIMIT);
    const candidateFiles = new Map(semanticFileCandidates.map((entry) => [String(entry.file?.path || "").trim(), entry.file]));
    if (retrievalMode === "hybrid") {
      for (const [filePath, file] of lexicalCandidateFiles.entries()) {
        candidateFiles.set(filePath, file);
      }
    }
    const candidateList = [...candidateFiles.values()];
    changed = (await ensureChunkEmbeddingsForFiles(candidateList, config.endpoint, embeddingModel, Math.max(30000, Number(config.timeoutMs || 0)))) || changed;
    if (changed) {
      await savePdfIndexCacheToDisk();
    }

    const semanticMatches = collectSemanticChunkMatches(candidateList, queryEmbedding, matchPoolLimit, preferredFileName);
    const baseMatches =
      retrievalMode === "semantic"
        ? semanticMatches.length
          ? semanticMatches.map((entry) => ({ ...entry, searchMode: "semantic" }))
          : lexicalMatches.map((entry) => ({ ...entry, searchMode: "lexical" }))
        : fuseHybridMatches(lexicalMatches, semanticMatches, matchPoolLimit);
    const ranked = rerankPdfMatches(baseMatches, normalizedQuery, limit, config);
    const effectiveMode = retrievalMode === "semantic"
      ? semanticMatches.length
        ? "semantic"
        : "lexical"
      : semanticMatches.length && lexicalMatches.length
        ? "hybrid"
        : semanticMatches.length
          ? "semantic"
          : "lexical";
    return {
      results: ranked,
      retrieval: {
        mode: effectiveMode,
        requestedMode: retrievalMode,
        embeddingModel,
        reranked: config.rerankEnabled,
        rerankStrategy: config.rerankEnabled ? "local-hybrid" : "off",
        lexicalCandidates: lexicalMatches.length,
        semanticCandidates: semanticMatches.length,
        note:
          retrievalMode === "semantic" && semanticMatches.length
            ? `Semantic retrieval used ${embeddingModel}; local reranking ${config.rerankEnabled ? "refined" : "was disabled for"} the final order.`
            : semanticMatches.length && lexicalMatches.length
            ? `Hybrid search combined keyword and semantic retrieval using ${embeddingModel}.`
            : semanticMatches.length
              ? `Semantic retrieval used ${embeddingModel}.`
              : `Keyword ranking remained stronger than semantic retrieval for this query.`,
      },
    };
  } catch (err) {
    if (changed) {
      await savePdfIndexCacheToDisk();
    }
    return {
      results: rerankPdfMatches(
        lexicalMatches.map((entry) => ({ ...entry, searchMode: "lexical" })),
        normalizedQuery,
        limit,
        config
      ),
      retrieval: {
        mode: "lexical",
        requestedMode: retrievalMode,
        embeddingModel,
        reranked: config.rerankEnabled,
        rerankStrategy: config.rerankEnabled ? "local-hybrid" : "off",
        note: `Semantic retrieval failed, so search fell back to keyword ranking only. ${String(err?.message || err || "")}`.trim(),
      },
    };
  }
}

function scoreTextAgainstQuery(textLower, searchParts) {
  const haystack = String(textLower || "");
  if (!haystack) return { score: 0, firstHit: -1 };

  let score = 0;
  let firstHit = -1;
  let matchedWords = 0;
  const phrase = String(searchParts?.phrase || "");
  const words = Array.isArray(searchParts?.words) ? searchParts.words : [];

  if (phrase) {
    const phraseHit = haystack.indexOf(phrase);
    if (phraseHit >= 0) {
      score += 16;
      firstHit = phraseHit;
    }
  }

  for (const word of words) {
    const hit = haystack.indexOf(word);
    if (hit < 0) continue;
    matchedWords += 1;
    if (firstHit < 0 || hit < firstHit) firstHit = hit;
    score += 4;
    score += Math.min(6, countOccurrences(haystack, word, 6));
  }

  if (matchedWords && words.length) {
    score += Math.round((matchedWords / words.length) * 8);
  }

  return {
    score,
    firstHit,
    matchedWords,
  };
}

function countOccurrences(haystack, needle, cap = 6) {
  if (!haystack || !needle) return 0;
  let count = 0;
  let cursor = 0;
  while (count < cap) {
    const hit = haystack.indexOf(needle, cursor);
    if (hit < 0) break;
    count += 1;
    cursor = hit + needle.length;
  }
  return count;
}

function makeSnippet(text, firstHit) {
  const clean = normalizePdfText(text);
  if (!clean) return "";

  const hit = Number.isFinite(firstHit) ? firstHit : -1;
  const start = Math.max(0, hit >= 0 ? hit - 120 : 0);
  const end = Math.min(clean.length, hit >= 0 ? hit + 220 : 260);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < clean.length ? "..." : "";
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function resolveIndexedPdfFile(payload) {
  const matchPath = String(payload?.path || "").trim();
  const matchName = String(payload?.fileName || "").trim().toLowerCase();
  if (matchPath) {
    const byPath = pdfIndexCache.files.find((file) => String(file?.path || "").trim() === matchPath);
    if (byPath) return byPath;
  }
  if (matchName) {
    const byName = pdfIndexCache.files.find((file) => String(file?.fileName || "").trim().toLowerCase() === matchName);
    if (byName) return byName;
  }
  return pdfIndexCache.files[0] || null;
}

function buildPdfSummaryResponse(file) {
  return {
    fileName: String(file?.fileName || "").trim(),
    path: String(file?.path || "").trim(),
    summary: normalizeStoredPdfSummaryText(file?.summary),
    summaryUpdatedAt: String(file?.summaryUpdatedAt || "").trim(),
  };
}

function buildPdfSummaryConfig(config, stage = "chunk") {
  const isFinalStage = String(stage || "").toLowerCase() === "final";
  const next = {
    ...config,
    temperature: Math.max(0, Math.min(Number(config?.temperature ?? 0.2), isFinalStage ? 0.25 : 0.35)),
    maxOutputTokens: Math.max(Number(config?.maxOutputTokens || 0), isFinalStage ? 1400 : 520),
  };
  let timeoutSec = Number.parseInt(String(config?.timeoutSec || "120"), 10);
  if (!Number.isFinite(timeoutSec)) timeoutSec = 120;
  timeoutSec = Math.max(timeoutSec, isFinalStage ? 420 : 240);
  if (/20b/i.test(String(next.model || ""))) {
    timeoutSec = Math.max(timeoutSec, isFinalStage ? 480 : 360);
  }
  next.timeoutSec = timeoutSec;
  next.timeoutMs = timeoutSec * 1000;
  return next;
}

function splitTextIntoChunks(text, chunkSize = 7600, maxChunks = 6) {
  const clean = normalizePdfText(text);
  if (!clean) return [];
  const out = [];
  let cursor = 0;
  while (cursor < clean.length && out.length < Math.max(1, maxChunks)) {
    let end = Math.min(clean.length, cursor + Math.max(1200, chunkSize));
    if (end < clean.length) {
      const pivot = clean.lastIndexOf(" ", end);
      if (pivot > cursor + 900) end = pivot;
    }
    const piece = clean.slice(cursor, end).trim();
    if (piece) out.push(piece);
    if (end <= cursor) break;
    cursor = end;
  }
  return out.length ? out : [clean.slice(0, Math.max(1200, chunkSize))];
}

function buildPdfChunkSummaryPrompt({ fileName, chunkText, index, total }) {
  return [
    `You are summarizing indexed PDF content for Kingmaker Companion, a standalone Kingmaker GM prep tool.`,
    `Book: ${fileName}`,
    `Chunk ${index} of ${total}.`,
    `Task: extract the most useful GM-facing facts from this chunk only.`,
    `Return these headings exactly:`,
    `Adventure Beats:`,
    `- bullet`,
    `Key People / Factions:`,
    `- bullet`,
    `Key Places / Scenes:`,
    `- bullet`,
    `Threats / Obstacles / Clues:`,
    `- bullet`,
    `Rules / Mechanics Worth Prep:`,
    `- bullet`,
    `GM Use:`,
    `- bullet`,
    `Keep it factual and grounded only in the provided chunk.`,
    `No markdown tables. No bold. No numbering. Prefer short bullets over paragraphs.`,
    `If a section has nothing useful, write "- None noted in this chunk."`,
    ``,
    `Chunk text:`,
    chunkText,
  ].join("\n");
}

function buildPdfFinalSummaryPrompt({ fileName, chunkSummaries }) {
  return [
    `You are combining chunk summaries into one persistent GM-ready book brief for Kingmaker Companion.`,
    `Book: ${fileName}`,
    `Return these headings exactly:`,
    `Adventure Premise:`,
    `- 2 to 4 bullets`,
    `Main Threats / Stakes:`,
    `- 3 to 6 bullets`,
    `Key People / Factions:`,
    `- 3 to 8 bullets`,
    `Key Places / Scenes:`,
    `- 3 to 8 bullets`,
    `Likely Flow / Structure:`,
    `- 3 to 6 bullets`,
    `What To Prep First:`,
    `- 5 to 8 bullets`,
    `Fast Table Reference:`,
    `- 4 to 8 bullets`,
    `Keep it concise, factual, and immediately useful at the table.`,
    `No markdown tables. No bold. No numbering. No incomplete sentences. Prefer bullets over paragraphs.`,
    ``,
    `Chunk summaries:`,
    ...chunkSummaries.map((summary, i) => `Chunk ${i + 1}:\n${summary}`),
  ].join("\n");
}

function buildPdfFinalSummaryRetryPrompt({ fileName, chunkSummaries }) {
  return [
    `You are fixing a weak or incomplete summary for Kingmaker Companion.`,
    `Book: ${fileName}`,
    `Return only a clean GM summary in this exact structure:`,
    `Adventure Premise:`,
    `- bullet`,
    `Main Threats / Stakes:`,
    `- bullet`,
    `Key People / Factions:`,
    `- bullet`,
    `Key Places / Scenes:`,
    `- bullet`,
    `Likely Flow / Structure:`,
    `- bullet`,
    `What To Prep First:`,
    `- bullet`,
    `Fast Table Reference:`,
    `- bullet`,
    `Requirements:`,
    `- use bullets only`,
    `- no markdown tables`,
    `- no bold`,
    `- no numbered lists`,
    `- no section may be empty`,
    `- if a detail is unclear, keep it general rather than inventing specifics`,
    ``,
    `Chunk summaries:`,
    ...chunkSummaries.map((summary, i) => `Chunk ${i + 1}:\n${summary}`),
  ].join("\n");
}

function extractiveChunkSummary(chunkText) {
  const clean = normalizePdfText(chunkText);
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]?/g) || [];
  const picks = sentences.map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const lines = picks.map((s) => `- ${s.endsWith(".") ? s : `${s}.`}`);
  return lines.length ? lines.join("\n") : `- ${clean.slice(0, 280)}...`;
}

function collectBulletsFromPdfSummarySection(text, label, fallbackLabels = []) {
  const labels = [label, ...fallbackLabels];
  const picked = [];
  const seen = new Set();
  for (const item of labels) {
    const block = extractLabeledBlock(text, item);
    if (!block) continue;
    for (const line of splitAiLines(block)) {
      const clean = String(line || "").replace(/^[-*]\s*/, "").trim();
      if (!clean || /none noted in this chunk/i.test(clean)) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(clean.endsWith(".") ? clean : `${clean}.`);
    }
  }
  return picked;
}

function takePdfSummaryBullets(lines, minCount, maxCount, fallbackLines = []) {
  const unique = [];
  const seen = new Set();
  for (const line of [...(lines || []), ...(fallbackLines || [])]) {
    const clean = normalizeSentenceText(line);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(clean.endsWith(".") ? clean : `${clean}.`);
  }
  if (!unique.length) return [];
  const min = Math.max(0, Number(minCount) || 0);
  const max = Math.max(min || 1, Number(maxCount) || min || 1);
  if (unique.length >= min) return unique.slice(0, max);
  return unique.slice(0, max);
}

function isUsefulPdfSummary(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (isClearlyTruncatedOutput(raw)) return false;
  if (/\|[^\n]{0,220}\|/.test(raw)) return false;
  const required = [
    "Adventure Premise",
    "Main Threats / Stakes",
    "Key People / Factions",
    "Key Places / Scenes",
    "Likely Flow / Structure",
    "What To Prep First",
    "Fast Table Reference",
  ];
  const headingCount = required.filter((label) => new RegExp(`^${escapeRegex(label)}\\s*:`, "im").test(raw)).length;
  if (headingCount < 5) return false;
  if (countBulletLikeLines(raw) < 10) return false;
  return raw.length >= 320;
}

function combineChunkSummariesFallback(fileName, chunkSummaries) {
  const summaries = chunkSummaries.map((item) => String(item || "")).filter(Boolean);
  if (!summaries.length) {
    return [
      `Adventure Premise:`,
      `- ${fileName} was indexed, but no usable summary could be generated from the saved chunk notes.`,
      `Main Threats / Stakes:`,
      `- Re-run summary or use PDF search for focused book details.`,
      `Key People / Factions:`,
      `- Use PDF search to identify named NPCs and factions.`,
      `Key Places / Scenes:`,
      `- Use PDF search to locate the opening area, main sites, and likely set pieces.`,
      `Likely Flow / Structure:`,
      `- Review the saved PDF search results for chapter or encounter order.`,
      `What To Prep First:`,
      `- Summarize the selected PDF again after confirming the indexed text looks clean.`,
      `Fast Table Reference:`,
      `- Keep Source Library open for exact page lookups.`,
    ].join("\n");
  }

  const adventureBeats = takePdfSummaryBullets(
    summaries.flatMap((summary) => collectBulletsFromPdfSummarySection(summary, "Adventure Beats")),
    2,
    6
  );
  const people = takePdfSummaryBullets(
    summaries.flatMap((summary) => collectBulletsFromPdfSummarySection(summary, "Key People / Factions")),
    3,
    8
  );
  const places = takePdfSummaryBullets(
    summaries.flatMap((summary) => collectBulletsFromPdfSummarySection(summary, "Key Places / Scenes")),
    3,
    8
  );
  const threats = takePdfSummaryBullets(
    summaries.flatMap((summary) => collectBulletsFromPdfSummarySection(summary, "Threats / Obstacles / Clues")),
    3,
    8
  );
  const rules = takePdfSummaryBullets(
    summaries.flatMap((summary) => collectBulletsFromPdfSummarySection(summary, "Rules / Mechanics Worth Prep")),
    2,
    6
  );
  const gmUse = takePdfSummaryBullets(
    summaries.flatMap((summary) => collectBulletsFromPdfSummarySection(summary, "GM Use")),
    3,
    8
  );

  return [
    "Adventure Premise:",
    ...takePdfSummaryBullets(adventureBeats, 1, 4, threats).map((line) => `- ${line}`),
    "Main Threats / Stakes:",
    ...takePdfSummaryBullets(threats, 1, 6, adventureBeats).map((line) => `- ${line}`),
    "Key People / Factions:",
    ...takePdfSummaryBullets(people, 1, 8, adventureBeats).map((line) => `- ${line}`),
    "Key Places / Scenes:",
    ...takePdfSummaryBullets(places, 1, 8, adventureBeats).map((line) => `- ${line}`),
    "Likely Flow / Structure:",
    ...takePdfSummaryBullets(adventureBeats, 1, 6, places).map((line) => `- ${line}`),
    "What To Prep First:",
    ...takePdfSummaryBullets(gmUse, 1, 8, threats.concat(rules)).map((line) => `- ${line}`),
    "Fast Table Reference:",
    ...takePdfSummaryBullets(rules.concat(people.slice(0, 2), places.slice(0, 2)), 1, 8, gmUse).map((line) => `- ${line}`),
  ].join("\n");
}

async function openPdfAtPageInApp(targetPath, page) {
  const safePage = Math.max(1, page);
  const fileUrl = pathToFileURL(targetPath).toString();
  const viewerWin = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    autoHideMenuBar: true,
    title: `${path.basename(targetPath)} - Page ${Math.max(1, page)}`,
    webPreferences: {
      preload: path.join(__dirname, "viewer-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  pdfViewerWindows.add(viewerWin);
  viewerWin.on("closed", () => {
    pdfViewerWindows.delete(viewerWin);
  });

  await viewerWin.loadFile(path.join(__dirname, "pdf-viewer.html"), {
    query: {
      targetPath: targetPath,
      fileUrl,
      page: String(safePage),
    },
  });
}

function wireSpellcheckContextMenu(win) {
  win.webContents.on("context-menu", (_event, params) => {
    const menu = new Menu();

    if (params.misspelledWord && params.dictionarySuggestions.length) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 6)) {
        menu.append({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion),
        });
      }
      menu.append({ type: "separator" });
      menu.append({
        label: `Add "${params.misspelledWord}" to dictionary`,
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      menu.append({ type: "separator" });
    }

    menu.append({ role: "undo" });
    menu.append({ role: "redo" });
    menu.append({ type: "separator" });
    menu.append({ role: "cut" });
    menu.append({ role: "copy" });
    menu.append({ role: "paste" });
    menu.append({ role: "selectAll" });

    menu.popup();
  });
}

function normalizeAiConfig(rawConfig) {
  const endpointRaw = String(rawConfig?.endpoint || DEFAULT_AI_ENDPOINT).trim();
  const endpoint = endpointRaw.replace(/\/+$/g, "");
  const model = String(rawConfig?.model || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL;
  const embeddingModel = String(rawConfig?.embeddingModel || "").trim();
  const tempRaw = Number.parseFloat(String(rawConfig?.temperature ?? "0.2"));
  const temperature = Number.isFinite(tempRaw) ? Math.max(0, Math.min(tempRaw, 2)) : 0.2;
  const usePdfContext = rawConfig?.usePdfContext === false ? false : true;
  const useAonRules = rawConfig?.useAonRules === false ? false : true;
  const compactContext = rawConfig?.compactContext === false ? false : true;
  const retrievalModeRaw = String(rawConfig?.retrievalMode || "hybrid").trim().toLowerCase();
  const retrievalMode = ["hybrid", "semantic", "keyword"].includes(retrievalModeRaw) ? retrievalModeRaw : "hybrid";
  const retrievalLimitRaw = Number.parseInt(String(rawConfig?.retrievalLimit ?? "4"), 10);
  const retrievalLimit = Number.isFinite(retrievalLimitRaw) ? Math.max(1, Math.min(retrievalLimitRaw, 12)) : 4;
  const rerankEnabled = rawConfig?.rerankEnabled === false ? false : true;
  const preferFastModel = rawConfig?.preferFastModel === true;
  const maxOutputTokensRaw = Number.parseInt(String(rawConfig?.maxOutputTokens ?? "320"), 10);
  const maxOutputTokens = Number.isFinite(maxOutputTokensRaw)
    ? Math.max(64, Math.min(maxOutputTokensRaw, 2048))
    : 320;
  const timeoutSecRaw = Number.parseInt(String(rawConfig?.timeoutSec ?? "120"), 10);
  let timeoutSec = Number.isFinite(timeoutSecRaw) ? Math.max(15, Math.min(timeoutSecRaw, 1200)) : 120;
  if (/20b/i.test(model) && timeoutSec < 300) {
    timeoutSec = 300;
  }
  return {
    endpoint: endpoint || DEFAULT_AI_ENDPOINT,
    model,
    embeddingModel,
    temperature,
    usePdfContext,
    useAonRules,
    compactContext,
    retrievalMode,
    retrievalLimit,
    rerankEnabled,
    preferFastModel,
    maxOutputTokens,
    timeoutSec,
    timeoutMs: timeoutSec * 1000 || AI_TIMEOUT_MS,
  };
}

function normalizeModelName(model) {
  return String(model || "").trim().toLowerCase();
}

function isFastAiCandidate(model) {
  const target = normalizeModelName(model);
  return FAST_AI_MODEL_CANDIDATES.some((candidate) => normalizeModelName(candidate) === target);
}

function isLikelySlowAiModel(model) {
  const target = normalizeModelName(model);
  return (
    /\b(20b|32b|70b)\b/.test(target) ||
    target.includes("cpu") ||
    target.includes("deep") ||
    target.includes("gpt-oss") ||
    target.includes("qwen:latest")
  );
}

function isAiTimeoutError(err) {
  return err?.name === "AbortError" || /timed out|timeout/i.test(String(err?.message || err || ""));
}

async function pickAvailableFastAiModel(config, excludedModels = []) {
  const excluded = new Set(excludedModels.map(normalizeModelName));
  let modelNames = [];
  try {
    modelNames = await listOllamaModelsWithRecovery(
      config.endpoint,
      Math.min(12000, Math.max(5000, Number(config?.timeoutMs) || 10000))
    );
  } catch {
    return "";
  }
  const available = new Set(modelNames.map(normalizeModelName));
  return (
    FAST_AI_MODEL_CANDIDATES.find((candidate) => available.has(normalizeModelName(candidate)) && !excluded.has(normalizeModelName(candidate))) ||
    ""
  );
}

function buildFastAiConfig(baseConfig, model) {
  const timeoutSec = Math.max(45, Math.min(Number(baseConfig?.timeoutSec || 120), 180));
  return {
    ...baseConfig,
    model,
    compactContext: true,
    maxOutputTokens: Math.max(360, Math.min(Number(baseConfig?.maxOutputTokens || 720), 900)),
    timeoutSec,
    timeoutMs: timeoutSec * 1000,
  };
}

async function prepareAiGenerationConfig(config) {
  if (!config?.preferFastModel) return config;
  if (isFastAiCandidate(config.model) && !isLikelySlowAiModel(config.model)) return config;
  const fastModel = await pickAvailableFastAiModel(config, [config.model]);
  return fastModel ? buildFastAiConfig(config, fastModel) : config;
}

async function testOllamaConnection(config) {
  const modelNames = await listOllamaModelsWithRecovery(config.endpoint, Math.min(15000, Number(config?.timeoutMs) || 15000));
  const hasModel = modelNames.includes(config.model);
  const modelLabel = getAiModelDisplayName(config.model);
  return {
    ok: true,
    modelFound: hasModel,
    models: modelNames.slice(0, 80),
    message: hasModel
      ? `Connected. Model "${modelLabel}" is available.`
      : `Connected. Model "${modelLabel}" not found locally yet.`,
  };
}

function isLocalEndpoint(endpoint) {
  try {
    const parsed = new URL(String(endpoint || ""));
    const host = String(parsed.hostname || "").toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

function isLikelyOllamaConnectionError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("could not reach local ai endpoint") ||
    msg.includes("could not connect to local ai") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function launchOllamaServe() {
  const child = spawn("ollama", ["serve"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
  });
  child.unref();
}

async function ensureOllamaAvailable(endpoint, timeoutMs = 10000) {
  if (ollamaBootPromise) {
    await ollamaBootPromise;
    return;
  }

  ollamaBootPromise = (async () => {
    try {
      launchOllamaServe();
    } catch {
      // Ignore launch errors; readiness probe below will still validate status.
    }

    const probeTimeout = Math.max(1500, Math.min(5000, Number(timeoutMs) || 2500));
    for (let i = 0; i < OLLAMA_BOOT_RETRY_COUNT; i += 1) {
      try {
        await listOllamaModels(endpoint, probeTimeout);
        return;
      } catch (probeErr) {
        if (!isLikelyOllamaConnectionError(probeErr)) throw probeErr;
        await sleep(OLLAMA_BOOT_RETRY_DELAY_MS);
      }
    }

    throw new Error(
      "Could not reach local AI endpoint after restart attempt. Confirm Ollama is installed and running."
    );
  })();

  try {
    await ollamaBootPromise;
  } finally {
    ollamaBootPromise = null;
  }
}

async function listOllamaModelsWithRecovery(endpoint, timeoutMs = 10000) {
  try {
    return await listOllamaModels(endpoint, timeoutMs);
  } catch (err) {
    if (!isLocalEndpoint(endpoint) || !isLikelyOllamaConnectionError(err)) throw err;
    await ensureOllamaAvailable(endpoint, timeoutMs);
    return listOllamaModels(endpoint, Math.max(10000, Number(timeoutMs) || 10000));
  }
}

async function listOllamaModels(endpoint, timeoutMs = 10000) {
  const safeTimeoutMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : 10000;
  const url = `${endpoint}/api/tags`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), safeTimeoutMs);
  let response = null;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Could not reach local AI endpoint (timeout after ${Math.round(safeTimeoutMs / 1000)}s).`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`Could not reach local AI endpoint (${response.status}).`);
  }
  const data = await response.json();
  const modelNames = Array.isArray(data?.models)
    ? data.models.map((model) => String(model?.name || "").trim()).filter(Boolean)
    : [];
  return modelNames.slice(0, 160);
}

function normalizePromptPayload(promptPayload) {
  if (promptPayload && typeof promptPayload === "object" && !Array.isArray(promptPayload)) {
    return {
      systemPrompt: String(promptPayload.systemPrompt || "").trim(),
      userPrompt: String(promptPayload.userPrompt || "").trim(),
    };
  }
  return {
    systemPrompt:
      "You are the Kingmaker Steward, a practical Pathfinder 2e Kingmaker GM aide. If the prompt asks for JSON, a schema, or exact labels, obey that structure exactly and do not add extra conversational text.",
    userPrompt: String(promptPayload || "").trim(),
  };
}

async function generateWithOllama(config, promptPayload, recovered = false, timeoutRetried = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config?.timeoutMs) || AI_TIMEOUT_MS);
  try {
    const prompts = normalizePromptPayload(promptPayload);
    const chatData = await requestOllamaJson(
      `${config.endpoint}/api/chat`,
      {
        model: config.model,
        stream: false,
        think: false,
        options: {
          temperature: config.temperature,
          num_predict: config.maxOutputTokens,
        },
        messages: [
          {
            role: "system",
            content: prompts.systemPrompt,
          },
          { role: "user", content: prompts.userPrompt },
        ],
      },
      controller.signal
    );

    let text = extractOllamaText(chatData);
    if (!text) {
      const generateData = await requestOllamaJson(
        `${config.endpoint}/api/generate`,
        {
          model: config.model,
          stream: false,
          options: {
            temperature: config.temperature,
            num_predict: config.maxOutputTokens,
          },
          prompt: [
            prompts.systemPrompt,
            "",
            prompts.userPrompt,
          ].join("\n"),
        },
        controller.signal
      );
      text = extractOllamaText(generateData);
    }

    // Some local models occasionally return no final content from both endpoints.
    return text;
  } catch (err) {
    if (err?.name === "AbortError") {
      const timeoutMs = Number(config?.timeoutMs) || AI_TIMEOUT_MS;
      const modelName = String(config?.model || "");
      const canRetryWithLongerTimeout = !timeoutRetried && /20b/i.test(modelName) && timeoutMs < 600000;
      if (canRetryWithLongerTimeout) {
        const retriedTimeoutMs = Math.min(600000, Math.max(timeoutMs * 2, 420000));
        const retriedConfig = {
          ...config,
          timeoutMs: retriedTimeoutMs,
          timeoutSec: Math.max(Number(config?.timeoutSec) || 0, Math.round(retriedTimeoutMs / 1000)),
          maxOutputTokens: Math.max(192, Math.min(Number(config?.maxOutputTokens || 320), 1024)),
        };
        return generateWithOllama(retriedConfig, promptPayload, recovered, true);
      }
      throw new Error(
        `Local AI request timed out after ${Math.round(timeoutMs / 1000)}s. Try compact context, fewer output tokens, a faster model, or a longer timeout.`
      );
    }
    if (!recovered && isLocalEndpoint(config.endpoint) && isLikelyOllamaConnectionError(err)) {
      await ensureOllamaAvailable(config.endpoint, Number(config?.timeoutMs) || AI_TIMEOUT_MS);
      return generateWithOllama(config, promptPayload, true, timeoutRetried);
    }
    const message = String(err?.message || "");
    if (/fetch failed/i.test(message) || /ECONNREFUSED/i.test(message)) {
      throw new Error(`Could not connect to local AI at ${config.endpoint}. Confirm Ollama is running and endpoint is correct.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithOllamaFastFallback(config, promptPayload) {
  try {
    const text = await generateWithOllama(config, promptPayload);
    return {
      text,
      config,
      usedGenerationFallback: false,
      fallbackReason: "",
    };
  } catch (err) {
    if (!isAiTimeoutError(err)) throw err;

    const fastModel = await pickAvailableFastAiModel(config, [config.model]);
    if (!fastModel) throw err;

    const retryConfig = buildFastAiConfig(config, fastModel);
    const retryPrompt = compactPromptForTimeoutRetry(promptPayload);
    const text = await generateWithOllama(retryConfig, retryPrompt);
    return {
      text,
      config: retryConfig,
      usedGenerationFallback: true,
      fallbackReason: `Timed out on ${getAiModelDisplayName(config.model)}; retried with ${getAiModelDisplayName(fastModel)} and compact context.`,
    };
  }
}

function compactPromptForTimeoutRetry(promptPayload) {
  const prompts = normalizePromptPayload(promptPayload);
  const lines = String(prompts.userPrompt || "").split(/\r?\n/);
  const head = lines.slice(0, 80).join("\n");
  const tail = lines.slice(-14).join("\n");
  return {
    systemPrompt: prompts.systemPrompt,
    userPrompt: [
      summarizeForPrompt(head, 5200),
      "",
      "Retry note: previous local model timed out. Answer concisely from the available campaign context.",
      "",
      summarizeForPrompt(tail, 1200),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildAssistantTimeoutFallback({ mode, input, context }) {
  const tabId = String(context?.activeTab || "").trim();
  const fallback = generateFallbackAiOutput(mode, input, tabId, context);
  const intent = detectAssistantIntent(input, context);
  const graphFacts = Array.isArray(context?.knowledgeGraph?.graphFacts)
    ? context.knowledgeGraph.graphFacts.slice(0, 5).map((fact, index) => `${index + 1}. ${summarizeForPrompt(String(fact || ""), 180)}`)
    : [];
  return [
    intent === "player_build"
      ? "The local model timed out before it could finish, so I am giving you a concise built-in character-advice fallback."
      : "The local model timed out before it could finish, so I am giving you a concise context-only fallback.",
    "",
    ...(intent === "player_build" ? [] : graphFacts.length ? ["Graph facts I can use right now:", ...graphFacts, ""] : []),
    fallback,
    "",
    "If you want the full AI answer, switch AI / RAG Settings to a faster model like lorebound-pf2e-pure:latest or llama3.1:8b, or ask with @campaign instead of @app.",
  ].join("\n");
}

async function requestOllamaJson(url, payload, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 260);
    throw new Error(`Local AI generation failed (${response.status}): ${details}`);
  }
  const data = await response.json();
  if (typeof data?.error === "string" && data.error.trim()) {
    throw new Error(`Local AI generation failed: ${data.error.trim()}`);
  }
  return data;
}

function extractOllamaText(data) {
  const direct = String(data?.message?.content || "").trim();
  if (direct) return direct;

  const contentParts = Array.isArray(data?.message?.content) ? data.message.content : [];
  if (contentParts.length) {
    const joined = contentParts
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("\n")
      .trim();
    if (joined) return joined;
  }

  const alternatives = [data?.response, data?.output_text, data?.completion, data?.text];
  for (const candidate of alternatives) {
    const clean = String(candidate || "").trim();
    if (clean) return clean;
  }

  return "";
}

function buildDraftModePrompt({ mode, input, context, compactContext = true }) {
  const latestSession = context?.latestSession || {};
  const recentSessions = Array.isArray(context?.recentSessions) ? context.recentSessions : [];
  const openQuests = Array.isArray(context?.openQuests) ? context.openQuests : [];
  const quests = Array.isArray(context?.quests) ? context.quests : [];
  const companions = Array.isArray(context?.companions) ? context.companions : [];
  const events = Array.isArray(context?.events) ? context.events : [];
  const npcs = Array.isArray(context?.npcs) ? context.npcs : [];
  const locations = Array.isArray(context?.locations) ? context.locations : [];
  const kingdom = context?.kingdom || null;
  const aiMemory = context?.aiMemory || {};
  const selectedPdfFile = summarizeForPrompt(String(context?.selectedPdfFile || ""), 120);
  const selectedPdfSummary = summarizeForPrompt(String(context?.selectedPdfSummary || ""), compactContext ? 720 : 1100);
  const selectedPdfPreview = summarizeForPrompt(String(context?.selectedPdfPreview || ""), compactContext ? 720 : 1100);
  const indexedPdfFiles = Array.isArray(context?.pdfIndexedFiles) ? context.pdfIndexedFiles : [];
  const pdfSummaryBriefs = Array.isArray(context?.pdfSummaryBriefs) ? context.pdfSummaryBriefs : [];
  const indexedPdfCount = Number.parseInt(String(context?.pdfIndexedFileCount || indexedPdfFiles.length || 0), 10) || 0;
  const retrievalSummary = context?.retrievalSummary && typeof context.retrievalSummary === "object" ? context.retrievalSummary : {};
  const retrievedChunks = Array.isArray(context?.retrievedChunks) ? context.retrievedChunks : [];
  const knowledgeGraph = context?.knowledgeGraph && typeof context.knowledgeGraph === "object" ? context.knowledgeGraph : {};
  const knowledgeGraphPrompt = summarizeForPrompt(String(context?.knowledgeGraphPrompt || ""), compactContext ? 2200 : 3400);
  const graphRoute = knowledgeGraph?.route && typeof knowledgeGraph.route === "object" ? knowledgeGraph.route : {};
  const graphSourceTypes = Array.isArray(graphRoute?.sourceTypes) ? graphRoute.sourceTypes : [];
  const graphQueryExpansion = summarizeForPrompt(String(graphRoute?.queryExpansion || ""), compactContext ? 220 : 360);
  const aonRulesMatches = Array.isArray(context?.aonRulesMatches) ? context.aonRulesMatches : [];
  const aonRulesEnabled = context?.aonRulesEnabled === true;
  const aiPersona = summarizeForPrompt(String(context?.aiPersona || "kingmaker-steward"), 80);
  const storyFocus = context?.storyFocus && typeof context.storyFocus === "object" ? context.storyFocus : {};
  const storyFocusLabel = summarizeForPrompt(String(storyFocus?.label || ""), 120);
  const storyFocusSummary = summarizeForPrompt(String(storyFocus?.summary || ""), compactContext ? 260 : 420);
  const campaignMemorySummary = summarizeForPrompt(String(aiMemory?.campaignSummary || ""), compactContext ? 700 : 1100);
  const recentSessionMemory = summarizeForPrompt(String(aiMemory?.recentSessionSummary || ""), compactContext ? 700 : 1100);
  const activeQuestMemory = summarizeForPrompt(String(aiMemory?.activeQuestsSummary || ""), compactContext ? 700 : 1100);
  const activeEntityMemory = summarizeForPrompt(String(aiMemory?.activeEntitiesSummary || ""), compactContext ? 600 : 900);
  const canonMemory = summarizeForPrompt(String(aiMemory?.canonSummary || ""), compactContext ? 700 : 1100);
  const rulingsDigest = summarizeForPrompt(String(aiMemory?.rulingsDigest || ""), compactContext ? 600 : 900);
  const obsidianContext = summarizeForPrompt(String(context?.obsidianContext || ""), compactContext ? 1400 : 2200);
  const obsidianVaultNotes = Array.isArray(context?.obsidianVaultNotes) ? context.obsidianVaultNotes : [];
  const obsidianContextEnabled = context?.obsidianContextEnabled === true;
  const obsidianContextNoteCount = Number.parseInt(String(context?.obsidianContextNoteCount || obsidianVaultNotes.length || 0), 10) || 0;
  const retrievalQuery = summarizeForPrompt(String(retrievalSummary?.query || ""), compactContext ? 180 : 320);
  const retrievalSourceSummary = retrievalSummary?.sourceCounts && typeof retrievalSummary.sourceCounts === "object"
    ? Object.entries(retrievalSummary.sourceCounts)
        .filter((entry) => Number(entry[1] || 0) > 0)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || String(a[0]).localeCompare(String(b[0])))
        .map(([key, value]) => `${key} ${value}`)
        .join("; ")
    : "";
  const taskType = summarizeForPrompt(String(context?.taskType || ""), 48);
  const taskLabel = summarizeForPrompt(String(context?.taskLabel || ""), 80);
  const taskSaveTarget = summarizeForPrompt(String(context?.taskSaveTarget || ""), 120);
  const routeReason = summarizeForPrompt(String(context?.routeReason || ""), 180);
  const entityType = summarizeForPrompt(String(context?.entityType || ""), 40);
  const aiHistory = Array.isArray(context?.aiHistory) ? context.aiHistory : [];
  const activeTab = summarizeForPrompt(String(context?.activeTab || ""), 40);
  const tabLabel = summarizeForPrompt(String(context?.tabLabel || ""), 80);
  const campaignOpeningRequested = isCampaignOpeningRequest(input, context);
  const playerBuildRequested = isPlayerBuildRequest(input, context);
  const limits = compactContext
    ? { draft: 1500, tab: 900, latest: 220, snippet: 180 }
    : { draft: 2400, tab: 1800, latest: 360, snippet: 280 };
  const tabContext = summarizeForPrompt(String(context?.tabContext || ""), limits.tab);
  const pdfSnippets = Array.isArray(context?.pdfSnippets) ? context.pdfSnippets : [];
  const pdfEnabled = context?.pdfContextEnabled === true;
  const pdfContextError = summarizeForPrompt(String(context?.pdfContextError || ""), compactContext ? 220 : 360);
  const appRoleLines = getKingmakerAppRoleLines(activeTab);
  const suppressCampaignRecords = campaignOpeningRequested || playerBuildRequested;
  const recentSessionLines = suppressCampaignRecords ? [] : summarizeRecentSessionsForPrompt(recentSessions, compactContext ? 3 : 5);
  const trackedNpcLines = suppressCampaignRecords ? [] : summarizeTrackedNpcsForPrompt(npcs, compactContext ? 5 : 8);
  const trackedCompanionLines = suppressCampaignRecords ? [] : summarizeTrackedCompanionsForPrompt(companions, compactContext ? 5 : 8);
  const trackedQuestLines = suppressCampaignRecords ? [] : summarizeTrackedQuestsForPrompt(quests, compactContext ? 5 : 8);
  const activeEventLines = suppressCampaignRecords ? [] : summarizeTrackedEventsForPrompt(events, compactContext ? 5 : 8);
  const trackedLocationLines = suppressCampaignRecords ? [] : summarizeTrackedLocationsForPrompt(locations, compactContext ? 5 : 8);
  const kingdomLines = suppressCampaignRecords ? [] : summarizeKingdomForPrompt(kingdom, compactContext);
  const historyLimit = compactContext ? 6 : 10;
  const historyTurns = aiHistory
    .slice(-historyLimit)
    .map((turn) => {
      const role = String(turn?.role || "").toLowerCase() === "assistant" ? "AI" : "GM";
      const tab = summarizeForPrompt(String(turn?.tabId || ""), 18);
      const text = summarizeForPrompt(String(turn?.text || ""), compactContext ? 160 : 240);
      return `${role}${tab ? ` [${tab}]` : ""}: ${text}`;
    })
    .filter((line) => line.endsWith(": ") === false);

  const modeGuide = {
    assistant:
      "Answer like a trusted Kingmaker GM aide: give your read, explain the table reason, then provide practical next steps.",
    session:
      "Produce structured, table-ready session notes. Follow requested section labels exactly and provide substantive detail (not just one short paragraph).",
    recap: "Rewrite as a short read-aloud recap for players (3-6 sentences).",
    npc: "Produce one table-ready NPC using the requested labels exactly. Give the NPC a clear motive, pressure, and immediately playable detail.",
    companion: "Produce one table-ready companion record using the requested labels exactly. Make influence, travel state, and kingdom-role usefulness obvious.",
    quest: "Rewrite as a quest objective with stakes and next actionable beat.",
    event: "Produce one table-ready event record using the requested labels exactly. Make the pressure clock, trigger, kingdom consequence, fallout, and links explicit.",
    location: "Rewrite as a location briefing with atmosphere and immediate tension.",
    prep: "Rewrite as next-session prep bullet points.",
  };
  const modeSpecificLines = getModeSpecificPromptLines(mode, input, context);

  const lines = [
    `Mode: ${mode}`,
    `Goal: ${modeGuide[mode] || modeGuide.session}`,
    `Persona: ${aiPersona === "kingmaker-steward" ? "Kingmaker Steward - opinionated when useful, source-aware, concise, and table-ready." : aiPersona}`,
    ...(storyFocusLabel
      ? [
          `Story focus: ${storyFocusLabel}${storyFocusSummary ? ` - ${storyFocusSummary}` : ""}`,
          "Campaign-state rule: confirmed/user records are what has happened at this table. Kingmaker reference records are canon prep only; do not describe them as completed campaign history unless the GM or saved session notes confirms it.",
        ]
      : []),
    ...(String(mode || "").toLowerCase() === "assistant"
      ? playerBuildRequested
        ? [
          "Assistant voice rules:",
          "- Start with Quick take: one clear class recommendation in 1-3 concise sentences.",
          "- Then use Why it fits this party, How it plays, and Alternatives if useful.",
          "- Do not include table-running sections, scene framing, active pressure, campaign-start prep, or app record updates unless the GM explicitly asks for campaign prep.",
          "- Focus on PF2e party role coverage, playstyle, expected ability focus, and why the recommendation helps the listed group.",
          "- Keep the answer compact unless the GM asks for a build plan.",
        ]
        : [
          "Assistant voice rules:",
          "- Start with Quick take: one clear recommendation in 1-3 concise sentences.",
          "- Answer the exact question asked. Do not add campaign prep, extra scenes, or record updates unless the GM asks for those.",
          "- Only include table-running advice when the GM asks for prep, scenes, session planning, or running advice.",
          "- Use at most one short bullet block by default.",
          "- If there are multiple viable paths, say which one you would choose and why.",
        ]
      : []),
    "",
    ...appRoleLines,
    ...(modeSpecificLines.length ? ["", ...modeSpecificLines] : []),
    "",
    "Draft input:",
    summarizeForPrompt(input, limits.draft),
    "",
    "Campaign context:",
    `Task class: ${taskType || "unspecified"}${taskLabel ? ` (${taskLabel})` : ""}`,
    `Task save target: ${taskSaveTarget || "unspecified"}`,
    ...(routeReason ? [`Routing reason: ${routeReason}`] : []),
    ...(campaignOpeningRequested
      ? [
          "Campaign opening override: The GM is asking how to begin a new Kingmaker campaign. Start with the Jamandi Aldori / Restov invitation, Aldori manor or mansion prologue, charter stakes, and first-session table setup. Do not use saved trading-post, Linzi-scouting, bandit-tribute, Animal Panic, or Blood for Blood records as the first scene unless the GM explicitly says the opening is complete.",
          "Source priority for this opening answer: use indexed PDF/RAG source snippets and knowledge-graph opening terms before saved app records, because saved app records may reflect a later test state.",
        ]
      : []),
    ...(playerBuildRequested
      ? [
          "Player build advice override: The GM is asking what class or character role to play. Answer as PF2e party-composition advice. Do not turn this into Kingmaker scene prep, opening campaign guidance, active pressure, or app record updates.",
        ]
      : []),
    ...(entityType ? [`Target entity type: ${entityType}`] : []),
    `Active tab: ${activeTab || "unknown"} (${tabLabel || "unknown"})`,
    `Tab context: ${tabContext || "None provided."}`,
    ...(knowledgeGraphPrompt
      ? [
          "Knowledge graph context:",
          knowledgeGraphPrompt,
          graphSourceTypes.length ? `Graph source types: ${graphSourceTypes.map((type) => summarizeForPrompt(String(type), 40)).join(", ")}` : "",
          graphQueryExpansion ? `Graph query expansion: ${graphQueryExpansion}` : "",
        ]
      : []),
    campaignOpeningRequested
      ? "Latest session: saved live records are later than the campaign opening. Do not use saved trading-post, bandit tribute, or frontier pressure as the first scene unless the GM explicitly says the opening is already complete."
      : playerBuildRequested
        ? "Latest session: held aside because this is player class advice, not campaign scene prep."
      : `Latest session: ${summarizeForPrompt(String(latestSession?.title || ""), 120)} | ${summarizeForPrompt(
          String(latestSession?.summary || ""),
          limits.latest
        )}`,
    ...(recentSessionLines.length ? ["Recent sessions in app:", ...recentSessionLines] : []),
    campaignOpeningRequested
      ? "Open quests: held aside for opening routing. The first answer should cover the Jamandi / Restov mansion setup before saved live quest pressure."
      : playerBuildRequested
        ? "Open quests: held aside because this is player class advice, not quest or session prep."
      : `Open quests: ${openQuests.map((q) => summarizeForPrompt(String(q?.title || ""), 80)).join("; ") || "None listed."}`,
    ...(trackedQuestLines.length ? ["Tracked quest records:", ...trackedQuestLines] : ["Tracked quest records: None listed."]),
    ...(trackedNpcLines.length ? ["Tracked NPC records:", ...trackedNpcLines] : ["Tracked NPC records: None listed."]),
    ...(trackedCompanionLines.length ? ["Tracked companion records:", ...trackedCompanionLines] : ["Tracked companion records: None listed."]),
    ...(activeEventLines.length ? ["Tracked event records:", ...activeEventLines] : ["Tracked event records: None listed."]),
    ...(trackedLocationLines.length ? ["Tracked location records:", ...trackedLocationLines] : ["Tracked location records: None listed."]),
    ...(kingdomLines.length ? ["Kingdom records:", ...kingdomLines] : []),
    ...(campaignMemorySummary || recentSessionMemory || activeQuestMemory || activeEntityMemory || canonMemory || rulingsDigest
      ? [
          "Memory digests:",
          ...(campaignMemorySummary ? [`Campaign summary: ${campaignMemorySummary}`] : []),
          ...(recentSessionMemory ? [`Recent session summary: ${recentSessionMemory}`] : []),
          ...(activeQuestMemory ? [`Active quests digest: ${activeQuestMemory}`] : []),
          ...(activeEntityMemory ? [`Active entities digest: ${activeEntityMemory}`] : []),
          ...(canonMemory ? [`Canon memory digest: ${canonMemory}`] : []),
          ...(rulingsDigest ? [`Rulings / house rules digest: ${rulingsDigest}`] : []),
        ]
      : []),
    `Unified retrieval chunks: ${retrievedChunks.length}`,
    ...(retrievalQuery ? [`Retrieval query: ${retrievalQuery}`] : []),
    ...(retrievalSourceSummary ? [`Retrieval sources: ${retrievalSourceSummary}`] : []),
    `Archives of Nethys rules lookup enabled: ${aonRulesEnabled ? "yes" : "no"}`,
    `PDF context enabled: ${pdfEnabled ? "yes" : "no"}`,
    ...(pdfContextError ? [`PDF context warning: ${pdfContextError}`] : []),
    `Indexed PDF files (${indexedPdfCount}): ${
      indexedPdfFiles.length
        ? indexedPdfFiles.map((name) => summarizeForPrompt(String(name || ""), 70)).join("; ")
        : "None indexed."
    }`,
    `Obsidian vault context enabled: ${obsidianContextEnabled ? "yes" : "no"}`,
    `Selected PDF focus: ${selectedPdfFile || "None selected."}`,
    ...(selectedPdfSummary ? [`Selected PDF summary: ${selectedPdfSummary}`] : []),
    ...(selectedPdfPreview ? [`Selected PDF preview: ${selectedPdfPreview}`] : []),
    ...(obsidianContext ? [`Obsidian vault context (${obsidianContextNoteCount} note${obsidianContextNoteCount === 1 ? "" : "s"}): ${obsidianContext}`] : []),
    ...(obsidianVaultNotes.length
      ? [
          "Top vault notes:",
          ...obsidianVaultNotes.map(
            (note, index) =>
              `${index + 1}. ${summarizeForPrompt(String(note?.title || "Note"), 80)} [${
                summarizeForPrompt(String(note?.relativePath || ""), 100)
              }] ${summarizeForPrompt(String(note?.excerpt || ""), limits.snippet)}`
          ),
        ]
      : []),
    ...(pdfSummaryBriefs.length
      ? [
          "Saved PDF memory briefs:",
          ...pdfSummaryBriefs.map(
            (entry, idx) =>
              `${idx + 1}. ${summarizeForPrompt(String(entry?.fileName || "PDF"), 80)} - ${summarizeForPrompt(
                String(entry?.summary || ""),
                limits.snippet * 2
              )}`
          ),
        ]
      : ["Saved PDF memory briefs: None yet."]),
    ...(aonRulesMatches.length
      ? [
          "Archives of Nethys rule matches:",
          ...aonRulesMatches.map(
            (entry, index) =>
              `${index + 1}. ${summarizeForPrompt(String(entry?.title || "Rule"), 90)} [${summarizeForPrompt(
                String(entry?.url || ""),
                140
              )}] ${summarizeForPrompt(String(entry?.snippet || ""), limits.snippet * 2)}`
          ),
        ]
      : []),
    ...(retrievedChunks.length
      ? [
          "Retrieved context chunks:",
          ...retrievedChunks.map(
            (chunk, index) =>
              `${index + 1}. [${summarizeForPrompt(String(chunk?.sourceLabel || chunk?.sourceType || "context"), 40)}] ${summarizeForPrompt(
                String(chunk?.title || "untitled"),
                80
              )}: ${summarizeForPrompt(String(chunk?.text || ""), limits.snippet * 2)}`
          ),
        ]
      : ["Retrieved context chunks: None selected."]),
    "",
    ...(historyTurns.length
      ? [
          "Recent AI conversation:",
          ...historyTurns.map((line, index) => `${index + 1}. ${line}`),
          "",
        ]
      : []),
    ...(pdfSnippets.length
      ? [
          "Relevant PDF excerpts:",
          ...pdfSnippets.map(
            (snippet, index) =>
              `${index + 1}. [${summarizeForPrompt(String(snippet?.fileName || "PDF"), 80)}${
                snippet?.page ? ` p.${snippet.page}` : ""
              }] ${summarizeForPrompt(String(snippet?.snippet || ""), limits.snippet)}`
          ),
          "",
        ]
      : []),
    "Return only final GM-facing content.",
    "No instruction lists, no policy text, and no meta-rules in the answer.",
    "Keep facts grounded in provided context and avoid invented lore.",
    "Source scope rule: you only have access to campaign context, the active app-bundled kingdom rules profile if one is provided above, and indexed PDF files listed above.",
    "If asked what books/sources/rules/PDFs you can access, answer using only the campaign data above, the active kingdom rules profile if present, and the indexed PDF file names.",
    "Never claim access to external books, websites, or rules not listed in indexed PDF files or the active kingdom rules profile.",
  ];

  return lines.join("\n");
}

function getAssistantRoleLabel(answerMode) {
  const roleByMode = {
    advice: "player advisor",
    rules: "rules explainer",
    prep: "GM prep assistant",
    recall: "campaign recall assistant",
    create: "content drafting assistant",
    narration: "opening narrator",
  };
  return roleByMode[answerMode] || "Kingmaker helper";
}

function normalizeAssistantPageMode(value) {
  const clean = String(value || "").trim().toLowerCase();
  return clean === "prep" || clean === "recall" || clean === "create" ? clean : "ask";
}

function normalizeAssistantScopeTag(value) {
  const clean = String(value || "").trim().toLowerCase().replace(/^@+/, "");
  return clean ? `@${clean}` : "@app";
}

function formatAssistantRuleNote(entry, compactContext = true) {
  if (!entry || typeof entry !== "object") return "";
  const title = summarizeForPrompt(String(entry?.title || "Rule"), 90);
  const snippet = summarizeForPrompt(String(entry?.snippet || ""), compactContext ? 220 : 320);
  if (!title && !snippet) return "";
  return `${title || "Rule"}${snippet ? ` - ${snippet}` : ""}`;
}

function formatAssistantRetrievedNote(entry, compactContext = true) {
  if (!entry || typeof entry !== "object") return "";
  const label = summarizeForPrompt(String(entry?.sourceLabel || entry?.sourceType || "context"), 48);
  const title = summarizeForPrompt(String(entry?.title || ""), 90);
  const text = summarizeForPrompt(String(entry?.text || ""), compactContext ? 220 : 320);
  const heading = [label, title].filter(Boolean).join(" / ");
  if (!heading && !text) return "";
  return `${heading || "Context"}${text ? ` - ${text}` : ""}`;
}

function formatAssistantPdfNote(entry, compactContext = true) {
  if (!entry || typeof entry !== "object") return "";
  const fileName = summarizeForPrompt(String(entry?.fileName || "PDF"), 90);
  const snippet = summarizeForPrompt(String(entry?.snippet || ""), compactContext ? 220 : 320);
  if (!fileName && !snippet) return "";
  return `${fileName}${entry?.page ? ` p.${entry.page}` : ""}${snippet ? ` - ${snippet}` : ""}`;
}

function formatAssistantSessionNote(session, compactContext = true) {
  if (!session || typeof session !== "object") return "";
  const title = summarizeForPrompt(String(session?.title || ""), 90);
  const summary = summarizeForPrompt(String(session?.summary || session?.nextPrep || ""), compactContext ? 220 : 320);
  if (!title && !summary) return "";
  return `${title || "Session"}${summary ? ` - ${summary}` : ""}`;
}

function formatAssistantQuestNote(quest, compactContext = true) {
  if (!quest || typeof quest !== "object") return "";
  const title = summarizeForPrompt(String(quest?.title || ""), 90);
  const objective = summarizeForPrompt(String(quest?.objective || quest?.nextBeat || quest?.stakes || ""), compactContext ? 220 : 320);
  if (!title && !objective) return "";
  return `${title || "Quest"}${objective ? ` - ${objective}` : ""}`;
}

function formatAssistantEventNote(eventItem, compactContext = true) {
  if (!eventItem || typeof eventItem !== "object") return "";
  const title = summarizeForPrompt(String(eventItem?.title || ""), 90);
  const summary = summarizeForPrompt(String(eventItem?.trigger || eventItem?.consequenceSummary || ""), compactContext ? 220 : 320);
  if (!title && !summary) return "";
  return `${title || "Event"}${summary ? ` - ${summary}` : ""}`;
}

function formatAssistantKingdomNote(kingdom) {
  if (!kingdom || typeof kingdom !== "object") return "";
  const parts = [
    summarizeForPrompt(String(kingdom?.currentTurnLabel || ""), 48),
    kingdom?.controlDC != null ? `Control DC ${kingdom.controlDC}` : "",
    kingdom?.unrest != null ? `Unrest ${kingdom.unrest}` : "",
    kingdom?.renown != null ? `Renown ${kingdom.renown}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function resolveAssistantRoute(userMessage, context = {}) {
  const rawQuestion = String(context?.userQuestion || userMessage || "").trim();
  const selectedPageMode = normalizeAssistantPageMode(context?.workspaceModeId || context?.selectedPageMode);
  const scopeTag = normalizeAssistantScopeTag(context?.scopeTag || context?.tabTag || context?.activeTab);
  let routeResult = aiRouting.resolveAiRoute(rawQuestion, selectedPageMode, scopeTag);
  if (routeResult.intent === "general_chat" && isPlayerBuildFollowupText(rawQuestion) && hasRecentPlayerBuildContext(context)) {
    const contextPlan = aiRouting.selectContextBuckets("player_build", selectedPageMode, scopeTag);
    routeResult = {
      ...routeResult,
      intent: "player_build",
      answerMode: aiRouting.selectAnswerMode("player_build", selectedPageMode),
      includedBuckets: contextPlan.includedBuckets,
      excludedBuckets: contextPlan.excludedBuckets,
      included: contextPlan.includedBuckets,
      excluded: contextPlan.excludedBuckets,
      reasons: ["follow-up to recent player-build discussion", ...routeResult.reasons].slice(0, 4),
    };
  }
  return routeResult;
}

function buildAssistantBucketLines(bucket, context = {}, compactContext = true) {
  const limit = compactContext ? 220 : 320;
  const intent = String(context?.askIntent || context?.routeDebug?.intent || "").trim();
  const isPlayerBuild = intent === "player_build" || context?.playerBuildRequested === true;
  const aiMemory = context?.aiMemory && typeof context.aiMemory === "object" ? context.aiMemory : {};
  const latestSession = context?.latestSession && typeof context.latestSession === "object" ? context.latestSession : null;
  const recentSessions = Array.isArray(context?.recentSessions) ? context.recentSessions : [];
  const openQuests = Array.isArray(context?.openQuests) ? context.openQuests : [];
  const companions = Array.isArray(context?.companions) ? context.companions : [];
  const events = Array.isArray(context?.events) ? context.events : [];
  const kingdom = context?.kingdom && typeof context.kingdom === "object" ? context.kingdom : null;
  const aonRulesMatches = Array.isArray(context?.aonRulesMatches) ? context.aonRulesMatches : [];
  const retrievedChunks = Array.isArray(context?.retrievedChunks) ? context.retrievedChunks : [];
  const pdfSnippets = Array.isArray(context?.pdfSnippets) ? context.pdfSnippets : [];
  const obsidianVaultNotes = Array.isArray(context?.obsidianVaultNotes) ? context.obsidianVaultNotes : [];
  const knowledgeGraph = context?.knowledgeGraph && typeof context.knowledgeGraph === "object" ? context.knowledgeGraph : {};
  const graphFacts = Array.isArray(knowledgeGraph?.graphFacts) ? knowledgeGraph.graphFacts : [];
  const matchedNodes = Array.isArray(knowledgeGraph?.matchedNodes) ? knowledgeGraph.matchedNodes : [];
  const secondSession = recentSessions.find((session) => String(session?.id || "") !== String(latestSession?.id || ""));
  const openingPattern = /\b(opening|opener|jamandi|aldori|restov|feast|charter|first session|oleg|trading post|arrival)\b/i;

  const lines = [];
  const push = (value) => {
    const clean = summarizeForPrompt(String(value || ""), limit);
    if (clean) lines.push(clean);
  };

  switch (bucket) {
    case "party":
      if (isPlayerBuild) {
        push("No PC party composition was provided unless the user included it in the question. Do not infer party makeup from NPC, companion, quest, or session records.");
      } else {
        companions.slice(0, compactContext ? 3 : 4).forEach((companion) => {
          push(`${summarizeForPrompt(String(companion?.name || "Companion"), 80)} - ${summarizeForPrompt(String(companion?.currentNeed || companion?.nextBeat || companion?.kingdomRole || ""), 120)}`);
        });
        if (!lines.length) push(aiMemory?.activeEntitiesSummary);
      }
      break;
    case "campaign_summary":
      if (isPlayerBuild) {
        push("Kingmaker character context: wilderness exploration, social scenes, kingdom leadership, hexploration, and varied threat types reward versatile PCs. Keep named campaign NPCs, quests, and opening scenes out unless the user asks for story integration.");
      } else {
        push(aiMemory?.campaignSummary);
        push(formatAssistantSessionNote(latestSession, compactContext));
        push(formatAssistantQuestNote(openQuests[0], compactContext));
      }
      break;
    case "rules":
      push(formatAssistantRuleNote(aonRulesMatches[0], compactContext));
      push(aiMemory?.rulingsDigest);
      push(formatAssistantRetrievedNote(retrievedChunks.find((entry) => /\brule|rules|kingdom\b/i.test(String(entry?.sourceLabel || entry?.sourceType || entry?.title || ""))), compactContext));
      if (isPlayerBuild && !lines.length) push("Use Pathfinder 2e Remastered character-building assumptions. Give practical class pointers without pretending to know unprovided feats, bloodline, ancestry, or party composition.");
      break;
    case "gm_notes":
      push(formatAssistantQuestNote(openQuests[0], compactContext));
      push(formatAssistantEventNote(events[0], compactContext));
      push(obsidianVaultNotes[0] ? `${summarizeForPrompt(String(obsidianVaultNotes[0]?.title || "Vault note"), 80)} - ${summarizeForPrompt(String(obsidianVaultNotes[0]?.excerpt || ""), 120)}` : "");
      break;
    case "session_history":
      push(formatAssistantSessionNote(latestSession, compactContext));
      push(formatAssistantSessionNote(secondSession, compactContext));
      break;
    case "kingdom_state":
      push(formatAssistantKingdomNote(kingdom));
      break;
    case "lore":
      push(graphFacts[0]);
      push(graphFacts[1]);
      push(aiMemory?.canonSummary);
      break;
    case "opening_notes":
      push(formatAssistantPdfNote(pdfSnippets.find((entry) => openingPattern.test(String(entry?.snippet || "")) || openingPattern.test(String(entry?.fileName || ""))), compactContext));
      push(formatAssistantRetrievedNote(retrievedChunks.find((entry) => openingPattern.test(String(entry?.text || "")) || openingPattern.test(String(entry?.title || ""))), compactContext));
      push(graphFacts.find((fact) => openingPattern.test(String(fact || ""))));
      break;
    case "selected_target_record":
      push(
        matchedNodes[0]
          ? `${summarizeForPrompt(String(matchedNodes[0]?.type || "record"), 24)} ${summarizeForPrompt(String(matchedNodes[0]?.label || ""), 80)} - ${summarizeForPrompt(
              String((matchedNodes[0]?.facts || []).slice(0, 2).join("; ") || ""),
              140
            )}`
          : ""
      );
      break;
    case "relevant_npc_location_notes":
      matchedNodes
        .filter((node) => node?.type === "npc" || node?.type === "location")
        .slice(0, compactContext ? 2 : 3)
        .forEach((node) => {
          push(`${summarizeForPrompt(String(node?.type || "note"), 24)} ${summarizeForPrompt(String(node?.label || ""), 80)} - ${summarizeForPrompt(String((node?.facts || []).slice(0, 2).join("; ") || ""), 140)}`);
        });
      break;
    default:
      break;
  }

  return unique(lines).slice(0, compactContext ? 2 : 3);
}

function buildSystemPrompt(answerMode = "advice", intent = "general_chat") {
  const roleLabel = getAssistantRoleLabel(answerMode);
  const modeGuidance = {
    advice: [
      "- Give a direct recommendation first, then brief reasons.",
      "- Keep campaign flavor in the background unless it materially affects the answer.",
    ],
    rules: [
      "- Explain the rule directly before discussing tactics or prep.",
      "- Do not drift into narration or scene framing unless asked.",
    ],
    prep: [
      "- Keep the answer structured and table-practical.",
      "- Focus on what the GM should run, prep, or decide next.",
    ],
    recall: [
      "- Summarize stored notes only.",
      "- Distinguish known facts from inference.",
    ],
    create: [
      "- Return the requested artifact directly.",
      "- Keep formatting focused on the requested deliverable.",
    ],
    narration: [
      "- Cinematic prose is allowed here because the user explicitly asked for an opener or read-aloud.",
      "- Keep the narration grounded in the provided Kingmaker context.",
    ],
  };
  const intentGuidance = {
    player_build: [
      "- Answer as player-facing Pathfinder 2e character advice, not GM prep.",
      "- Do not mention Jamandi, Oleg, active quests, NPCs, scene framing, campaign-opening narration, or app record updates unless the user explicitly asks for story integration.",
      "- Do not use canned prep labels like 'My read' or 'At the table'. Use natural headings such as 'Quick take', 'Pointers', 'Good options', and 'Watch-outs'.",
      "- For class pointers, cover the class role, key ability/playstyle, early spell or feat priorities, and common mistakes.",
      "- If ancestry, bloodline, level, or party composition is missing, give broadly useful guidance instead of inventing details.",
    ],
    general_chat: [
      "- If the user asks for personal/player advice, answer from that perspective instead of the app workflow.",
    ],
  };

  return [
    "You are a Pathfinder 2e Remastered Kingmaker helper.",
    `Current role: ${roleLabel}.`,
    "Campaign: Kingmaker.",
    `Mode: ${answerMode}.`,
    "",
    "Priorities:",
    "- Answer the user's immediate question first.",
    "- Do not foreground workflow, UI, or internal app state.",
    "- Never mention task class, route intent, context buckets, debug routing, or app implementation details.",
    "- Do not switch into narration, recap, or campaign-opening guidance unless the route explicitly calls for it.",
    "- Prefer direct, practical answers.",
    "- Use Pathfinder 2e Remastered assumptions.",
    "- If you infer something from partial context, label it as an inference.",
    ...(modeGuidance[answerMode] || []),
    ...(intentGuidance[intent] || []),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildContextBlock(contextBuckets = {}) {
  const includedBuckets = Array.isArray(contextBuckets?.includedBuckets)
    ? contextBuckets.includedBuckets
    : Array.isArray(contextBuckets?.included)
      ? contextBuckets.included
      : [];
  const compactContext = contextBuckets?.compactContext !== false;
  const context = contextBuckets?.context && typeof contextBuckets.context === "object" ? contextBuckets.context : {};
  const bucketLabels = {
    party: "Party",
    campaign_summary: "Campaign Summary",
    rules: "Rules",
    gm_notes: "GM Notes",
    session_history: "Session History",
    kingdom_state: "Kingdom State",
    lore: "Lore",
    opening_notes: "Opening Notes",
    selected_target_record: "Selected Target Record",
    relevant_npc_location_notes: "Relevant NPC / Location Notes",
  };

  const sections = includedBuckets
    .map((bucket) => {
      const lines = buildAssistantBucketLines(bucket, context, compactContext);
      if (!lines.length) return "";
      return [bucketLabels[bucket] || bucket, ...lines.map((line, index) => `${index + 1}. ${line}`)].join("\n");
    })
    .filter(Boolean);

  if (!sections.length) return "";
  return ["Relevant context:", ...sections].join("\n");
}

function buildAiUserPrompt(userMessage, routeResult, contextBlock) {
  const question = summarizeForPrompt(String(userMessage || ""), 1200);
  const intent = String(routeResult?.intent || "general_chat");
  const taskByIntent = {
    player_build: "Give practical player-facing Pathfinder 2e character advice. Do not write GM prep, scene framing, campaign recap, or app-record instructions.",
    rules_question: "Answer the rules question directly, then add brief table-use guidance if helpful.",
    gm_prep: "Give GM-facing prep that can be run at the table.",
    world_lore: "Answer the lore question clearly without turning it into session prep unless asked.",
    campaign_recall: "Summarize known campaign/session state from stored notes only.",
    create_or_update_content: "Create or update the requested content artifact.",
    session_start_or_opening: "Write or advise on the requested opening narration/session opener.",
    general_chat: "Answer the user's question directly.",
  };
  return [
    `Task: ${taskByIntent[intent] || taskByIntent.general_chat}`,
    "Use the relevant context only when it helps answer the question. Ignore context that would pull the answer away from the user's immediate ask.",
    contextBlock,
    "",
    "User question:",
    question,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAssistantPromptPayload({ input, context = {}, compactContext = true }) {
  const rawQuestion = String(context?.userQuestion || input || "").trim();
  const routeResult = resolveAssistantRoute(rawQuestion, context);
  const contextBlock = buildContextBlock({
    includedBuckets: routeResult.includedBuckets,
    context: { ...context, userQuestion: rawQuestion },
    compactContext,
    routeResult,
  });
  return {
    routeResult,
    systemPrompt: buildSystemPrompt(routeResult.answerMode, routeResult.intent),
    userPrompt: buildAiUserPrompt(rawQuestion, routeResult, contextBlock),
  };
}

function getKingmakerAppRoleLines(activeTab) {
  const tabId = String(activeTab || "").toLowerCase();
  const workflowByTab = {
    dashboard: "You are planning the GM's next moves. Output should be ready to attach to the latest session prep in the app.",
    sessions: "You are helping maintain the session record. Output should be ready to apply into the latest session summary or next-prep fields.",
    capture: "You are cleaning raw table notes into structured records the app can keep as campaign notes or session notes.",
    writing: "You are drafting clean GM-facing text that Scene Forge can store or paste into campaign notes.",
    kingdom: "You are helping run a PF2e Kingmaker kingdom inside Kingmaker Companion. Output should be ready to save into kingdom notes, turn logs, settlement plans, or leader assignments.",
    npcs: "You are creating or enriching structured NPC records for Kingmaker Companion. Output may be imported directly into NPC entries.",
    companions: "You are creating or enriching structured companion records for Kingmaker Companion. Output may be imported directly into companion entries.",
    quests: "You are creating or refining structured quest records for Kingmaker Companion. Output may be imported directly into quest entries.",
    events: "You are creating or refining structured event pressure records for Kingmaker Companion. Output may be imported directly into event entries.",
    locations: "You are creating or refining structured location records for Kingmaker Companion. Output may be imported directly into location entries.",
    pdf: "You are answering from indexed PDF context or producing a PDF query the app can run immediately.",
    foundry: "You are preparing export or integration notes that the GM can use in Foundry or another linked tool.",
  };
  return [
    "App role: You are Companion AI inside the Kingmaker Companion app, helping the GM build and maintain structured Kingmaker records and usable session prep.",
    `Current app workflow: ${workflowByTab[tabId] || "You are helping the GM create content that can be saved back into Kingmaker Companion without cleanup."}`,
    "Write content that fits the app workflow for the active tab and is ready to save or apply inside Kingmaker Companion.",
  ];
}

function summarizeRecentSessionsForPrompt(sessions, limit = 4) {
  return (sessions || [])
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((session, index) => {
      const title = summarizeForPrompt(String(session?.title || ""), 70) || `Session ${index + 1}`;
      const date = summarizeForPrompt(String(session?.date || ""), 24);
      const arc = summarizeForPrompt(String(session?.arc || ""), 50);
      const summary = summarizeForPrompt(String(session?.summary || ""), 120);
      return `- ${title}${date ? ` (${date})` : ""}${arc ? ` | arc: ${arc}` : ""} | ${summary || "No summary yet."}`;
    })
    .filter(Boolean);
}

function summarizeTrackedNpcsForPrompt(npcs, limit = 6) {
  return (npcs || [])
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((npc) => {
      const name = summarizeForPrompt(String(npc?.name || ""), 60);
      if (!name) return "";
      const parts = [
        summarizeForPrompt(String(npc?.role || ""), 40),
        summarizeForPrompt(String(npc?.faction || ""), 36),
        summarizeForPrompt(String(npc?.agenda || ""), 70),
        summarizeForPrompt(String(npc?.disposition || ""), 32),
        summarizeForPrompt(String(npc?.pressure || ""), 70),
        summarizeForPrompt(String(npc?.kingdomRole || ""), 50),
      ].filter(Boolean);
      const notes = summarizeForPrompt(String(npc?.notes || ""), 120);
      return `- ${name}${parts.length ? ` | ${parts.join(" | ")}` : ""}${notes ? ` | notes: ${notes}` : ""}`;
    })
    .filter(Boolean);
}

function summarizeTrackedCompanionsForPrompt(companions, limit = 6) {
  return (companions || [])
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((companion) => {
      const name = summarizeForPrompt(String(companion?.name || ""), 60);
      if (!name) return "";
      const status = summarizeForPrompt(String(companion?.status || ""), 24);
      const currentHex = summarizeForPrompt(String(companion?.currentHex || ""), 18);
      const travelState = summarizeForPrompt(String(companion?.travelState || ""), 22);
      const role = summarizeForPrompt(String(companion?.kingdomRole || ""), 48);
      const quest = summarizeForPrompt(String(companion?.personalQuest || ""), 80);
      const nextScene = summarizeForPrompt(String(companion?.nextScene || ""), 90);
      const notes = summarizeForPrompt(String(companion?.notes || ""), 110);
      return `- ${name}${status ? ` (${status})` : ""} | influence ${Number.parseInt(String(companion?.influence || "0"), 10) || 0}${currentHex ? ` | hex: ${currentHex}` : ""}${travelState ? ` | travel: ${travelState}` : ""}${role ? ` | role: ${role}` : ""}${quest ? ` | personal quest: ${quest}` : ""}${nextScene ? ` | next scene: ${nextScene}` : ""}${notes ? ` | notes: ${notes}` : ""}`;
    })
    .filter(Boolean);
}

function formatRecordTrustForPrompt(entry) {
  return String(entry?.recordSource || "").trim() === "kingmaker-reference" || entry?.confirmed === false ? "reference only" : "confirmed";
}

function summarizeTrackedQuestsForPrompt(quests, limit = 6) {
  return (quests || [])
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((quest) => {
      const title = summarizeForPrompt(String(quest?.title || ""), 70);
      if (!title) return "";
      const status = summarizeForPrompt(String(quest?.status || ""), 24);
      const priority = summarizeForPrompt(String(quest?.priority || ""), 16);
      const hex = summarizeForPrompt(String(quest?.hex || ""), 18);
      const objective = summarizeForPrompt(String(quest?.objective || ""), 90);
      const stakes = summarizeForPrompt(String(quest?.stakes || ""), 110);
      const giver = summarizeForPrompt(String(quest?.giver || ""), 48);
      const nextBeat = summarizeForPrompt(String(quest?.nextBeat || ""), 100);
      return `- ${title}${status ? ` (${status})` : ""} | ${formatRecordTrustForPrompt(quest)}${priority ? ` | priority: ${priority}` : ""}${giver ? ` | giver: ${giver}` : ""}${hex ? ` | hex: ${hex}` : ""}${objective ? ` | objective: ${objective}` : ""}${stakes ? ` | stakes: ${stakes}` : ""}${nextBeat ? ` | next beat: ${nextBeat}` : ""}`;
    })
    .filter(Boolean);
}

function summarizeTrackedEventsForPrompt(events, limit = 6) {
  return (events || [])
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((eventEntry) => {
      const title = summarizeForPrompt(String(eventEntry?.title || ""), 70);
      if (!title) return "";
      const category = summarizeForPrompt(String(eventEntry?.category || ""), 24);
      const status = summarizeForPrompt(String(eventEntry?.status || ""), 24);
      const hex = summarizeForPrompt(String(eventEntry?.hex || ""), 18);
      const clock = summarizeForPrompt(formatEventClockSummary(eventEntry), 12);
      const trigger = summarizeForPrompt(String(eventEntry?.trigger || ""), 90);
      const consequence = summarizeForPrompt(String(eventEntry?.consequenceSummary || ""), 90);
      const fallout = summarizeForPrompt(String(eventEntry?.fallout || ""), 90);
      const impact = summarizeForPrompt(describeEventImpactSummary(eventEntry), 120);
      return `- ${title}${category ? ` (${category})` : ""} | ${formatRecordTrustForPrompt(eventEntry)}${status ? ` | ${status}` : ""}${clock ? ` | clock ${clock}` : ""}${hex ? ` | hex: ${hex}` : ""}${
        trigger ? ` | trigger: ${trigger}` : ""
      }${consequence ? ` | consequence: ${consequence}` : ""}${fallout ? ` | fallout: ${fallout}` : ""}${impact && impact !== "No kingdom impact recorded." ? ` | impact: ${impact}` : ""}`;
    })
    .filter(Boolean);
}

function summarizeTrackedLocationsForPrompt(locations, limit = 6) {
  return (locations || [])
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((location) => {
      const name = summarizeForPrompt(String(location?.name || ""), 70);
      if (!name) return "";
      const hex = summarizeForPrompt(String(location?.hex || ""), 24);
      const type = summarizeForPrompt(String(location?.type || ""), 24);
      const status = summarizeForPrompt(String(location?.status || ""), 24);
      const whatChanged = summarizeForPrompt(String(location?.whatChanged || ""), 90);
      const risks = summarizeForPrompt(String(location?.risks || ""), 90);
      const notes = summarizeForPrompt(String(location?.notes || ""), 110);
      return `- ${name}${type ? ` (${type})` : ""} | ${formatRecordTrustForPrompt(location)}${status ? ` | ${status}` : ""}${hex ? ` [${hex}]` : ""}${whatChanged ? ` | changed: ${whatChanged}` : ""}${risks ? ` | risk: ${risks}` : ""}${notes ? ` | notes: ${notes}` : ""}`;
    })
    .filter(Boolean);
}

function summarizeKingdomForPrompt(kingdom, compactContext = true) {
  const data = kingdom && typeof kingdom === "object" ? kingdom : null;
  if (!data) return [];
  const profile = data?.rulesProfile || getDefaultKingdomRulesProfile();
  const leaders = Array.isArray(data?.leaders) ? data.leaders : [];
  const settlements = Array.isArray(data?.settlements) ? data.settlements : [];
  const regions = Array.isArray(data?.regions) ? data.regions : [];
  const recentTurns = Array.isArray(data?.recentTurns) ? data.recentTurns : [];
  const recentEventHistory = Array.isArray(data?.recentEventHistory)
    ? data.recentEventHistory
    : Array.isArray(data?.eventHistory)
      ? data.eventHistory
      : [];
  const recentCalendarHistory = Array.isArray(data?.recentCalendarHistory)
    ? data.recentCalendarHistory
    : Array.isArray(data?.calendarHistory)
      ? data.calendarHistory
      : [];
  const commodities = data?.commodities || {};
  const ruin = data?.ruin || {};
  const lines = [
    `- Sheet: ${summarizeForPrompt(String(data?.name || "Unnamed kingdom"), 90)} | turn ${summarizeForPrompt(String(data?.currentTurnLabel || "not set"), 36)} | date ${summarizeForPrompt(String(data?.currentDate || "not set"), 36)} | level ${Number.parseInt(String(data?.level || "1"), 10) || 1} | size ${Number.parseInt(String(data?.size || "1"), 10) || 1} | Control DC ${Number.parseInt(String(data?.controlDC || "14"), 10) || 14}`,
    `- Economy: RP ${Number.parseInt(String(data?.resourcePoints || "0"), 10) || 0} | resource die ${summarizeForPrompt(String(data?.resourceDie || "d4"), 8)} | consumption ${Math.max(0, Number.parseInt(String(data?.consumption || "0"), 10) || 0)} | commodities F:${Number.parseInt(String(commodities.food || "0"), 10) || 0} L:${Number.parseInt(String(commodities.lumber || "0"), 10) || 0} Lux:${Number.parseInt(String(commodities.luxuries || "0"), 10) || 0} O:${Number.parseInt(String(commodities.ore || "0"), 10) || 0} S:${Number.parseInt(String(commodities.stone || "0"), 10) || 0}`,
    `- Pressure: unrest ${Math.max(0, Number.parseInt(String(data?.unrest || "0"), 10) || 0)} | renown ${Math.max(0, Number.parseInt(String(data?.renown || "0"), 10) || 0)} | fame ${Math.max(0, Number.parseInt(String(data?.fame || "0"), 10) || 0)} | infamy ${Math.max(0, Number.parseInt(String(data?.infamy || "0"), 10) || 0)} | ruin C:${Math.max(0, Number.parseInt(String(ruin.corruption || "0"), 10) || 0)} Cr:${Math.max(0, Number.parseInt(String(ruin.crime || "0"), 10) || 0)} D:${Math.max(0, Number.parseInt(String(ruin.decay || "0"), 10) || 0)} S:${Math.max(0, Number.parseInt(String(ruin.strife || "0"), 10) || 0)} / threshold ${Math.max(1, Number.parseInt(String(ruin.threshold || "5"), 10) || 5)}`,
    `- Rules profile: ${summarizeForPrompt(String(profile?.label || "Kingdom profile"), 90)} | ${summarizeForPrompt(String(profile?.summary || ""), compactContext ? 180 : 260)}`,
  ];
  const turnStructure = Array.isArray(profile?.turnStructure) ? profile.turnStructure : [];
  if (turnStructure.length) {
    lines.push(
      `- Turn structure: ${turnStructure
        .slice(0, compactContext ? 4 : 5)
        .map((entry) => `${summarizeForPrompt(String(entry || ""), compactContext ? 60 : 90)}`)
        .join(" | ")}`
    );
  }
  const aiSummary = Array.isArray(profile?.aiSummary)
    ? profile.aiSummary
    : Array.isArray(profile?.aiContextSummary)
      ? profile.aiContextSummary
      : [];
  if (aiSummary.length) {
    lines.push(
      `- Kingdom AI guide: ${aiSummary
        .slice(0, compactContext ? 4 : 6)
        .map((entry) => summarizeForPrompt(String(entry || ""), compactContext ? 80 : 120))
        .join(" | ")}`
    );
  }
  const leaderLines = leaders
    .slice(0, compactContext ? 5 : 8)
    .map((leader) => {
      const name = summarizeForPrompt(String(leader?.name || ""), 40);
      const role = summarizeForPrompt(String(leader?.role || ""), 28);
      const type = summarizeForPrompt(String(leader?.type || ""), 8);
      const skills = summarizeForPrompt(String(leader?.specializedSkills || ""), compactContext ? 60 : 90);
      return `- Leader: ${role || "Role"} = ${name || "Unassigned"}${type ? ` (${type})` : ""}${skills ? ` | specialized: ${skills}` : ""}`;
    })
    .filter(Boolean);
  const settlementLines = settlements
    .slice(0, compactContext ? 4 : 6)
    .map((settlement) => {
      const name = summarizeForPrompt(String(settlement?.name || ""), 40);
      const size = summarizeForPrompt(String(settlement?.size || ""), 20);
      const structure = summarizeForPrompt(String(settlement?.civicStructure || ""), 28);
      return `- Settlement: ${name || "Unnamed"}${size ? ` (${size})` : ""}${structure ? ` | civic: ${structure}` : ""} | influence ${Math.max(0, Number.parseInt(String(settlement?.influence || "0"), 10) || 0)} | dice ${Math.max(0, Number.parseInt(String(settlement?.resourceDice || "0"), 10) || 0)}`;
    })
    .filter(Boolean);
  const regionLines = regions
    .slice(0, compactContext ? 5 : 8)
    .map((region) => {
      const hex = summarizeForPrompt(String(region?.hex || ""), 24);
      const terrain = summarizeForPrompt(String(region?.terrain || ""), 24);
      const workSite = summarizeForPrompt(String(region?.workSite || ""), 30);
      return `- Region: ${hex || "Unknown"} | ${summarizeForPrompt(String(region?.status || ""), 24) || "status unknown"}${terrain ? ` | terrain: ${terrain}` : ""}${workSite ? ` | work site: ${workSite}` : ""}`;
    })
    .filter(Boolean);
  const turnLines = recentTurns
    .slice(0, compactContext ? 3 : 5)
    .map((turn) => {
      const title = summarizeForPrompt(String(turn?.title || ""), 36);
      const summary = summarizeForPrompt(String(turn?.summary || ""), compactContext ? 90 : 140);
      return `- Recent turn: ${title || "Turn"}${summary ? ` | ${summary}` : ""}`;
    })
    .filter(Boolean);
  const projectLines = (Array.isArray(data?.pendingProjects) ? data.pendingProjects : [])
    .slice(0, compactContext ? 4 : 6)
    .map((entry) => `- Pending: ${summarizeForPrompt(String(entry || ""), compactContext ? 100 : 140)}`)
    .filter(Boolean);
  const eventLines = recentEventHistory
    .slice(0, compactContext ? 4 : 6)
    .map((item) => {
      const title = summarizeForPrompt(String(item?.eventTitle || item?.title || ""), 48);
      if (!title) return "";
      const type = summarizeForPrompt(String(item?.type || ""), 20);
      const turn = summarizeForPrompt(String(item?.turnTitle || ""), 28);
      const summary = summarizeForPrompt(String(item?.summary || ""), compactContext ? 90 : 130);
      return `- Event pressure: ${title}${type ? ` (${type})` : ""}${turn ? ` | ${turn}` : ""}${summary ? ` | ${summary}` : ""}${item?.impactApplied === true ? " | impact applied" : ""}`;
    })
    .filter(Boolean);
  const calendarLines = recentCalendarHistory
    .slice(0, compactContext ? 4 : 6)
    .map((item) => {
      const endDate = summarizeForPrompt(String(item?.endDate || item?.date || ""), 36);
      if (!endDate) return "";
      const startDate = summarizeForPrompt(String(item?.startDate || ""), 36);
      const label = summarizeForPrompt(String(item?.label || ""), 72);
      const notes = summarizeForPrompt(String(item?.notes || ""), compactContext ? 80 : 120);
      return `- Calendar: ${startDate && startDate !== endDate ? `${startDate} -> ${endDate}` : endDate}${label ? ` | ${label}` : ""}${notes ? ` | ${notes}` : ""}`;
    })
    .filter(Boolean);
  const notes = summarizeForPrompt(String(data?.notes || ""), compactContext ? 180 : 280);
  if (leaderLines.length) lines.push(...leaderLines);
  if (settlementLines.length) lines.push(...settlementLines);
  if (regionLines.length) lines.push(...regionLines);
  if (turnLines.length) lines.push(...turnLines);
  if (projectLines.length) lines.push(...projectLines);
  if (eventLines.length) lines.push(...eventLines);
  if (calendarLines.length) lines.push(...calendarLines);
  if (notes) lines.push(`- Kingdom notes: ${notes}`);
  return lines;
}

function getDefaultKingdomRulesProfile() {
  const profiles = Array.isArray(KINGDOM_RULES_DATA?.profiles) ? KINGDOM_RULES_DATA.profiles : [];
  const wanted = String(KINGDOM_RULES_DATA?.latestProfileId || "").trim();
  if (wanted) {
    const match = profiles.find((profile) => String(profile?.id || "").trim() === wanted);
    if (match) return match;
  }
  return profiles[0] || { label: "Kingdom profile", summary: "", turnStructure: [], aiContextSummary: [] };
}

function getModeSpecificPromptLines(mode, input, context = null) {
  const activeTab = String(context?.activeTab || "").toLowerCase();
  if (String(mode || "").toLowerCase() === "npc") {
    const lines = [
      "Format requirements:",
      "Return exactly these top-level labels: Name, Role, Agenda, Disposition, Notes.",
      "Under Notes include 6 to 8 short bullets covering core want, leverage, current pressure or fear, voice and mannerisms, first impression or look, hidden truth or complication, and best way to use them in the next session.",
    ];
    const lowerInput = String(input || "").toLowerCase();
    if (/\b(few|several|multiple|some|2|3|4)\b/.test(lowerInput) && /\bnpcs?\b/.test(lowerInput)) {
      lines.push("If the GM asks for multiple NPCs, return 2 to 4 NPC blocks separated by a line containing only ---.");
    }
    if (String(context?.selectedPdfFile || "").trim() && isPdfGroundedQuestion(lowerInput)) {
      lines.push(
        "Book-grounding requirement: base the NPCs on the selected PDF context. Prefer named or clearly implied figures from that book, and mark any inferred role as inferred instead of inventing unsupported lore."
      );
    }
    return lines;
  }
  if (String(mode || "").toLowerCase() === "companion") {
    return [
      "Format requirements:",
      "Return exactly these top-level labels: Name, Status, Influence, Current Hex, Kingdom Role, Personal Quest, Notes.",
      "Under Notes include 4 to 6 short bullets covering loyalty or leverage, current pressure or tension, best camp or travel scene, and best use in the next session.",
      'Use one of these status values when possible: "prospective", "recruited", "traveling", "kingdom-role", or "departed".',
      "Keep influence as a whole number from 0 to 10.",
    ];
  }
  if (String(mode || "").toLowerCase() === "event") {
    return [
      "Format requirements:",
      "Return exactly these top-level labels: Title, Category, Status, Urgency, Hex, Linked Quest, Linked Companion, Clock, Clock Max, Advance / Turn, Advance Mode, Impact Scope, Trigger, Consequence Summary, Fallout, Kingdom Impact, Notes.",
      "Under Kingdom Impact include short bullets for only the non-zero kingdom changes using these labels: RP, Unrest, Renown, Fame, Infamy, Food, Lumber, Luxuries, Ore, Stone, Corruption, Crime, Decay, Strife.",
      'Use one of these categories when possible: "kingdom", "companion", "quest", "travel", "threat", or "story".',
      'Use one of these status values when possible: "seeded", "active", "escalated", "cooldown", "resolved", or "failed".',
      "Keep urgency as a whole number from 1 to 5.",
      'Use one of these impact scope values when possible: "always", "claimed-hex", or "none".',
    ];
  }
  if (activeTab === "kingdom") {
    return [
      "Kingdom workflow requirements:",
      "Base advice on the current kingdom sheet and the active V&K rules profile before inventing new plans.",
      "When you suggest changes, make the consequences and tradeoffs explicit so the GM can decide whether to update the records.",
      "Prefer outputs that help the GM record the turn cleanly: action order, what changed, risks, and what should be saved into Kingmaker Companion.",
    ];
  }
  return [];
}

function finalizeAiOutput({ rawText, mode, input, tabId, context = {} }) {
  const raw = String(rawText || "").trim();
  const cleaned = sanitizeAiTextOutput(raw);
  const candidate = cleaned || raw;

  if (candidate && isMisroutedOpeningAnswer(candidate, context, input)) {
    return {
      text: generateFallbackAiOutput(mode, input, tabId, { ...context, campaignOpeningRequested: true }),
      usedFallback: true,
      filtered: true,
      fallbackReason: "opening-route",
    };
  }

  if (candidate && isMismatchedPlayerBuildAnswer(candidate, context, input)) {
    return {
      text: generateFallbackAiOutput(mode, input, tabId, { ...context, playerBuildRequested: true }),
      usedFallback: true,
      filtered: true,
      fallbackReason: "player-build-route",
    };
  }

  if (candidate && !isLikelyInstructionEcho(candidate) && !isLikelyWeakAiOutput(candidate, mode, input, tabId)) {
    return {
      text: candidate,
      usedFallback: false,
      filtered: cleaned !== raw,
      fallbackReason: "",
    };
  }

  const fallbackReason = !candidate ? "empty" : isLikelyInstructionEcho(candidate) ? "instruction" : "weak";

  return {
    text: generateFallbackAiOutput(mode, input, tabId, context),
    usedFallback: true,
    filtered: true,
    fallbackReason,
  };
}

function sanitizeAiTextOutput(rawText) {
  const lines = splitAiLines(rawText);
  if (!lines.length) return "";
  const cleaned = lines
    .filter((line) => !isConstraintInstructionLine(line))
    .filter((line) => !isLikelyDuplicateLine(line, lines));
  return cleaned.join("\n").trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLabeledBlock(text, label) {
  const source = String(text || "");
  if (!source) return "";
  const regex = new RegExp(`${escapeRegex(label)}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Za-z][A-Za-z ]{1,28}:|$)`, "i");
  const match = source.match(regex);
  return match ? String(match[1] || "").trim() : "";
}

function collectNpcSupplementalDetailLines(text) {
  const fieldMap = [
    ["Core Want", "Core want"],
    ["Want", "Core want"],
    ["Goal", "Core want"],
    ["Leverage", "Leverage"],
    ["Pressure", "Current pressure"],
    ["Fear", "Current pressure"],
    ["Voice", "Voice and mannerisms"],
    ["Mannerisms", "Voice and mannerisms"],
    ["First Impression", "First impression or look"],
    ["Appearance", "First impression or look"],
    ["Look", "First impression or look"],
    ["Secret", "Hidden truth or complication"],
    ["Hidden Truth", "Hidden truth or complication"],
    ["Complication", "Hidden truth or complication"],
    ["Hook", "Best way to use them in the next session"],
    ["Use At Table", "Best way to use them in the next session"],
    ["Use in Next Session", "Best way to use them in the next session"],
  ];
  const seenTitles = new Set();
  const lines = [];
  for (const [label, title] of fieldMap) {
    const value = extractLabeledBlock(text, label).replace(/\s*\n+\s*/g, " ").trim();
    if (!value || seenTitles.has(title.toLowerCase())) continue;
    seenTitles.add(title.toLowerCase());
    lines.push(`- ${title}: ${value}`);
  }
  return lines;
}

function buildNpcNotesFromAi(text) {
  const baseNotes = extractLabeledBlock(text, "Notes");
  const extraLines = collectNpcSupplementalDetailLines(text);
  if (!baseNotes && !extraLines.length) return "";
  if (!baseNotes) return extraLines.join("\n");

  const existing = baseNotes.toLowerCase();
  const freshLines = extraLines.filter((line) => !existing.includes(line.replace(/^- /, "").split(":")[0].toLowerCase()));
  return [baseNotes, freshLines.join("\n")].filter(Boolean).join("\n");
}

function isWeakNpcOutput(text) {
  const name = extractLabeledBlock(text, "Name");
  const role = extractLabeledBlock(text, "Role");
  const agenda = extractLabeledBlock(text, "Agenda");
  const disposition = extractLabeledBlock(text, "Disposition");
  const notes = buildNpcNotesFromAi(text);
  if (!name || !role || !agenda || !disposition || !notes) return true;

  const noteLines = splitAiLines(notes);
  const bulletCount = noteLines.filter((line) => /^[-*]\s+/.test(line)).length;
  const noteChars = notes.replace(/\s+/g, " ").trim().length;
  if (noteChars < 110) return true;
  if (bulletCount > 0 && bulletCount < 4) return true;
  return false;
}

function countBulletLikeLines(text) {
  return splitAiLines(text).filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)).length;
}

function isClearlyTruncatedOutput(text) {
  const clean = String(text || "").trim();
  if (!clean) return true;
  const lines = splitAiLines(clean);
  const lastLine = lines[lines.length - 1] || clean;
  if (/[:\-]\s*$/.test(lastLine)) return true;
  if (/[.!?]$/.test(lastLine)) return false;
  const lastWord = String(lastLine || "").toLowerCase().split(/\s+/).filter(Boolean).pop() || "";
  if (
    [
      "a",
      "an",
      "the",
      "and",
      "or",
      "to",
      "of",
      "in",
      "on",
      "with",
      "for",
      "from",
      "is",
      "are",
      "was",
      "were",
      "that",
      "this",
      "these",
      "those",
      "as",
      "at",
      "by",
    ].includes(lastWord)
  ) {
    return true;
  }
  return lines.length <= 2 && clean.length < 160;
}

function isLikelyWeakAiOutput(text, mode, input, tabId) {
  const clean = String(text || "").trim();
  if (!clean) return true;
  if (/^\*{1,2}[^*\n]{1,60}$/.test(clean)) return true;
  if (/^[A-Za-z][A-Za-z ]{1,30}:?$/.test(clean) && clean.length < 40) return true;

  const lines = splitAiLines(clean);
  if (lines.length === 1 && clean.length < 60 && !/[.!?]$/.test(clean)) return true;

  const lowerInput = String(input || "").toLowerCase();
  if (
    tabId === "dashboard" &&
    /\b(opening scene|objective|obstacle|consequence|hook|hooks)\b/.test(lowerInput) &&
    clean.length < 120
  ) {
    return true;
  }

  if (
    tabId === "sessions" &&
    /\b(idea|ideas|hook|hooks|scene|scenes|encounter|encounters|village|town|quest|npc|prep|session|run|opening)\b/.test(
      lowerInput
    ) &&
    clean.length < 160
  ) {
    return true;
  }

  if ((String(mode || "").toLowerCase() === "npc" || tabId === "npcs") && isWeakNpcOutput(clean)) {
    return true;
  }

  if (isClearlyTruncatedOutput(clean)) {
    return true;
  }

  if (isPdfGroundedQuestion(lowerInput)) {
    if (clean.length < 180) return true;
    if (/\b(give me 5 ways|five ways|5 ways to run|ways to run)\b/.test(lowerInput) && countBulletLikeLines(clean) < 3) {
      return true;
    }
  }

  if (String(mode || "").toLowerCase() !== "assistant" && clean.length < 24) return true;
  return false;
}

function splitAiLines(text) {
  return String(text || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isConstraintInstructionLine(line) {
  const text = String(line || "").trim().toLowerCase();
  if (!text) return false;
  if (/^(output rules|rules|constraints)\s*:/.test(text)) return true;
  if (/^\d+\)\s*/.test(text) && /(no|keep|return|do not|must)/.test(text)) return true;
  if (/(do not|don[’']t)\s+generate\b/.test(text) && /\b(text|content|anything|output)\b/.test(text)) return true;
  if (/\boutside of\b/.test(text) && /(do not|don[’']t|only|must|keep|limit|avoid)/.test(text)) return true;
  if (/^(avoid|do not|don[’']t|must not|never)\b.*\b(answer|response|output)\b/.test(text)) return true;
  if (/^remember to update your records\b/.test(text)) return true;
  if (/\bkingmaker companion\b/.test(text) && /\b(update|save|record)\b/.test(text) && /^remember\b/.test(text)) return true;
  if (/^avoid\s+using\b/.test(text) && /\b(in the answer|in your answer|in the response|in output)\b/.test(text)) return true;
  if (/\bin the answer\b/.test(text) && /^(avoid|do not|don[’']t|must|only|keep|limit)/.test(text)) return true;
  if (/^only\s+(return|respond|output)\b/.test(text)) return true;
  if (/^(return|respond|output)\s+only\b/.test(text)) return true;
  if (/^(keep|limit)\s+(the\s+)?(answer|response|output)\b/.test(text)) return true;
  if (/^(keep|limit)\b.*\b(to|under|below|within)\s+\d+\b/.test(text)) return true;
  if (/^(answer|response|output)\s*(length|limit)\b/.test(text)) return true;
  if (/(^|\s)no markdown(,|\.|\s|$)/.test(text)) return true;
  if (/(^|\s)no code(,|\.|\s|$)/.test(text)) return true;
  if (/(^|\s)no emojis?(,|\.|\s|$)/.test(text)) return true;
  if (/no more than\s+\d+/.test(text)) return true;
  if (/keep\s+(the\s+)?output/.test(text)) return true;
  if (/single response/.test(text)) return true;
  if (/output length/.test(text)) return true;
  if (/\b\d+\s*(characters?|words?|tokens?)\b/.test(text) && /(keep|limit|no more than)/.test(text)) return true;
  if (/return plain text only/.test(text)) return true;
  if (/do not repeat instructions/.test(text)) return true;
  return false;
}
function isLikelyDuplicateLine(line, allLines) {
  const candidate = normalizeEchoLine(line);
  if (!candidate) return false;
  let count = 0;
  for (const item of allLines) {
    if (normalizeEchoLine(item) === candidate) count += 1;
    if (count >= 2) return true;
  }
  return false;
}

function isLikelyInstructionEcho(text) {
  const lines = splitAiLines(text);
  if (!lines.length) return true;
  const hits = lines.filter((line) => isConstraintInstructionLine(line)).length;
  if (hits >= 2 || hits / lines.length >= 0.5) return true;
  if (hasRepeatedNearIdenticalLines(lines, 3)) return true;
  const lower = String(text || "").toLowerCase();
  const signalCount = [
    "no markdown",
    "no code",
    "no emojis",
    "no more than",
    "avoid using",
    "in the answer",
    "in your answer",
    "in the response",
    "dont generate any text",
    "don't generate any text",
    "outside of",
    "return only",
    "respond only",
    "output only",
    "keep the answer",
    "keep answer",
    "limit the answer",
    "answer length",
    "keep output",
    "single response",
    "output length",
    "output rules",
    "return plain text only",
  ].filter((token) => lower.includes(token)).length;
  return signalCount >= 2;
}
function hasRepeatedNearIdenticalLines(lines, threshold = 3) {
  const counts = new Map();
  for (const line of lines) {
    const key = normalizeEchoLine(line);
    if (!key) continue;
    const next = (counts.get(key) || 0) + 1;
    counts.set(key, next);
    if (next >= threshold) return true;
  }
  return false;
}

function normalizeEchoLine(line) {
  return String(line || "")
    .toLowerCase()
    .replace(/^\d+\)\s*/, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAiLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasBuildAskPattern(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
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

function isRulesQuestionText(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
  if (isPlayerBuildText(lower)) return false;
  if (/\b(how does|how do|can i|does this work|does this stack|what happens if|explain|rules for|rule for|remaster rule|action economy)\b/.test(lower)) {
    return true;
  }
  return /\b(rule|rules|action economy|kingdom turns?|control dc|unrest|consumption|leadership activity|settlement activity|claim|ruin|conditions?|check|dc)\b/.test(
    lower
  );
}

function isGmPrepText(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
  if (isCampaignOpeningText(lower) || isPlayerBuildText(lower) || isRulesQuestionText(lower) || isCampaignRecallText(lower) || isCreateOrUpdateText(lower)) {
    return false;
  }
  return /\b(how should i run|session prep|prep this|prep for|encounter ideas?|hook|hooks|rumor|rumors|npc reaction|pacing|side quest|scene idea|what should i prep next|what should i prep|how do i run|where should i start|what should i prep first|what do i prep first|how should i start|how do i start)\b/.test(
    lower
  );
}

function isCampaignRecallText(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
  return /\b(recap|what happened|where are we|what have we done|what has happened|last session|current status|kingdom status|what has the party completed|what s unresolved|what is unresolved)\b/.test(
    lower
  );
}

function isCreateOrUpdateText(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
  return /\b(create|update|generate|make me|make an|write|draft)\b/.test(lower) && /\b(npc|quest|event|location|table note|read aloud|rumor table|summary)\b/.test(lower);
}

function isWorldLoreText(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
  if (isPlayerBuildText(lower) || isRulesQuestionText(lower) || isGmPrepText(lower) || isCampaignRecallText(lower) || isCreateOrUpdateText(lower) || isCampaignOpeningText(lower)) {
    return false;
  }
  return /\b(lore|tell me about|who is|what is|history of|background of|rostland|brevoy|stolen lands|river kingdoms)\b/.test(lower);
}

function isCampaignOpeningText(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
  if (isPlayerBuildText(lower) || isRulesQuestionText(lower) || isCampaignRecallText(lower) || isCreateOrUpdateText(lower)) return false;
  if (/\b(opening narration|opening scene|session opener|intro scene|read aloud|read aloud text|opening speech|campaign opening|campain opening|open the campaign|start of the campaign)\b/.test(lower)) {
    return true;
  }
  if (/\b(first session|frist session|session one|session 1|session zero|session 0)\b/.test(lower) && /\b(opener|opening|intro|introduce|read aloud|narrat|scene)\b/.test(lower)) {
    return true;
  }
  if (/\b(jamandi|aldori|restov|feast|charter ceremony|charter)\b/.test(lower) && /\b(introduce|intro|opening|opener|start|read aloud|narrat|speech|scene)\b/.test(lower)) {
    return true;
  }
  if (/\b(oleg|trading post)\b/.test(lower) && /\b(arrive|arrival|introduce|intro|opening scene|opening|opener|first scene|read aloud|what would oleg say)\b/.test(lower)) {
    return true;
  }
  return false;
}

function isCampaignOpeningRequest(input, context = {}) {
  return resolveAssistantRoute(input, context).intent === "session_start_or_opening";
}

function isPlayerBuildText(value) {
  const lower = normalizeAiLookupText(value);
  if (!lower) return false;
  const partyTerms = /\b(class|classes|build|character|pc|party|group|team|composition|comp|role|roles|frontline|frontliner|tank|healer|support|damage|dps|skill|skills|caster|spellcaster|spell caster|int|intelligence|int based|arcane|prepared caster|ancestry|background|feat|feats|spell|spells|archetype|archetypes|ranged|melee|face|scout|pointers?|tips?|advice|playstyle)\b/.test(
    lower
  );
  const asksRecommendation = hasBuildAskPattern(lower);
  const pf2eClassTerms = /\b(alchemist|animist|barbarian|bard|champion|cleric|druid|exemplar|fighter|gunslinger|inventor|investigator|kineticist|magus|monk|oracle|psychic|ranger|rogue|sor|sorc|sorcerer|sorceror|summoner|swashbuckler|thaumaturge|witch|wizard)\b/.test(lower);
  const playingClass = pf2eClassTerms && /\b(play|playing|played|going to play|going to be playing|gonna play|pointers?|tips?|advice)\b/.test(lower);
  const partyMention = /\b(we have|we will have|there will be|party has|group has|our party|right now|as of right now)\b/.test(lower);
  if (/\b(int|intelligence|int based|arcane)\b/.test(lower) && /\b(caster|spellcaster|spell caster|class|build|character)\b/.test(lower)) return true;
  if (/\blevel\s*\d+\b/.test(lower) && /\b(build|class|character|bard|cleric|fighter|rogue|wizard|witch|sor|sorc|sorcerer|sorceror|monk|ranger|champion)\b/.test(lower)) return true;
  return (
    (asksRecommendation && (partyTerms || pf2eClassTerms)) ||
    playingClass ||
    (partyTerms && pf2eClassTerms && (/\b(play|playing|party|group|team)\b/.test(lower) || partyMention)) ||
    (partyTerms && /\b(kingmaker|stolen lands|brevoy|jamandi|restov)\b/.test(lower) && /\b(play|playing|build|class|character)\b/.test(lower))
  );
}

function isPlayerBuildFollowupText(value) {
  const lower = normalizeAiLookupText(value);
  return /\b(what about|how about|instead|alternative|caster|spellcaster|spell caster|int|intelligence|str|strength|dex|dexterity|wis|wisdom|cha|charisma|class|build)\b/.test(lower);
}

function hasRecentPlayerBuildContext(context = {}) {
  const history = Array.isArray(context?.aiHistory) ? context.aiHistory : [];
  const recent = history
    .slice(-6)
    .map((entry) => String(entry?.text || ""))
    .join(" ");
  return isPlayerBuildText(recent);
}

function isPlayerBuildRequest(input, context = {}) {
  return resolveAssistantRoute(input, context).intent === "player_build";
}

function isRulesQuestionRequest(input, context = {}) {
  return resolveAssistantRoute(input, context).intent === "rules_question";
}

function detectAssistantIntent(input, context = {}) {
  return resolveAssistantRoute(input, context).intent;
}

function isMismatchedPlayerBuildAnswer(text, context = {}, input = "") {
  if (!isPlayerBuildRequest(input, context)) return false;
  const lower = normalizeAiLookupText(text);
  if (!lower) return true;
  return /\b(at the table|best starting scene|immediate objective|active pressure|what to prep next|record update|records to update|update app records|adventure log|task class|general prep|face nyrissa|stag lord|linzi|akiros|armag|jamandi|aldori manor|restov invitation|charter ceremony)\b/.test(lower);
}

function hasKingmakerOpeningAnchor(text) {
  return /\b(jamandi|aldori|restov|charter|invitation)\b/.test(normalizeAiLookupText(text));
}

function isMisroutedOpeningAnswer(text, context = {}, input = "") {
  if (!isCampaignOpeningRequest(input, context)) return false;
  const lower = normalizeAiLookupText(text);
  if (!lower) return true;
  const hasOpeningAnchor = hasKingmakerOpeningAnchor(lower);
  if (!hasOpeningAnchor) return true;
  const forbiddenOpeningDrift = [
    /\bnew kingmaker campaign starting with (oleg|the trading post)\b/,
    /\b(start|begin|open)\s+(at|with|in|around|on|from)\s+(oleg|the trading post|trading post)\b/,
    /\bbest starting scene.{0,80}\b(oleg|trading post)\b/,
    /\b(oleg|trading post).{0,40}\b(manor prologue|mansion prologue)\b/,
    /\b(linzi).{0,80}\b(reconnaissance|scout|scouting)\b/,
    /\b(reconnaissance|scout|scouting).{0,80}\b(linzi)\b/,
    /\b(animal panic before the storm|blood for blood|bandit tribute|bandit collection)\b/,
    /\bbandits are preparing\b/,
  ].some((pattern) => pattern.test(lower));
  if (forbiddenOpeningDrift) return true;

  const tradingPostIndex = lower.search(/\b(oleg|trading post)\b/);
  const openingIndex = lower.search(/\b(jamandi|aldori|restov|charter|invitation)\b/);
  const saysNotFirst =
    /\b(do not|don't|never)\s+(start|begin|open).{0,80}\b(oleg|trading post)\b/.test(lower) ||
    /\b(oleg|trading post).{0,80}\b(after|later|next destination|not the first scene|not the opening)\b/.test(lower);
  return tradingPostIndex >= 0 && openingIndex >= 0 && tradingPostIndex < openingIndex && !saysNotFirst;
}

function generateFallbackAiOutput(mode, input, tabId, context = {}) {
  const normalizedMode = String(mode || "").toLowerCase();
  const cleanInput = normalizeSentenceText(String(input || "").trim());
  if (normalizedMode === "assistant") {
    return generateAssistantFallbackAnswer(cleanInput, context);
  }
  if (normalizedMode === "npc") {
    return [
      "Name: Frontier Broker",
      "Role: Local fixer with contested loyalties",
      "Agenda: Stay useful to the party while concealing one damaging alliance",
      "Disposition: Helpful, but always measuring the cost",
      "Notes:",
      "- Core want: Survive the current power struggle without losing access or credibility.",
      "- Leverage over the party or locals: Knows the fastest route to the next lead and who is lying about it.",
      "- Current pressure or fear: A stronger faction is about to call in a favor they cannot safely refuse.",
      "- Voice and mannerisms: Speaks quietly, answers sideways first, and watches who reacts to every name.",
      "- First impression or look: Well-kept gear, tired eyes, and the posture of someone who expects betrayal.",
      "- Hidden truth or complication: Already helped the wrong people once and is trying to keep that buried.",
      "- Best way to use them in the next session: Make them the quickest path to progress, then reveal their complication when the party commits.",
    ].join("\n");
  }
  if (normalizedMode === "companion") {
    return [
      "Name: Restless Swordlord Ally",
      "Status: recruited",
      "Influence: 4",
      "Current Hex: D4",
      "Kingdom Role: General candidate",
      "Personal Quest: Prove they can shape the Stolen Lands without becoming another tyrant.",
      "Notes:",
      "- Loyalty or leverage: They respond well to bold action but hate avoidable cruelty.",
      "- Current pressure or tension: A rival wants them tied down to court politics instead of the frontier.",
      "- Best camp or travel scene: They challenge the party's plan and reveal what outcome they actually fear.",
      "- Best use in the next session: Put them beside a kingdom or quest decision that tests trust.",
    ].join("\n");
  }
  if (normalizedMode === "quest") {
    return [
      "Title: Secure the Main Route",
      "Status: open",
      "Priority: Soon",
      "Chapter: Stolen Lands Opening",
      "Hex: D4",
      `Objective: ${ensureSentence(cleanInput || "Advance the active quest with one clear obstacle and one consequence for delay")}`,
      "Giver: Local council envoy",
      "Stakes: Trade and trust collapse if route remains unsafe.",
      "Linked Companion: ",
      "Next Beat: Point the party at the clearest immediate lead.",
    ].join("\n");
  }
  if (normalizedMode === "event") {
    return [
      "Title: Border Pressure Rising",
      "Category: kingdom",
      "Status: active",
      "Urgency: 3",
      "Hex: D4",
      "Linked Quest: Secure the Main Route",
      "Linked Companion: ",
      "Clock: 1",
      "Clock Max: 4",
      "Advance / Turn: 1",
      "Advance Mode: turn",
      "Impact Scope: claimed-hex",
      "Trigger: Delays at the frontier give rival forces time to test the kingdom's response.",
      "Consequence Summary: If ignored, the kingdom loses control of the border story and has to absorb a public setback.",
      "Fallout: If ignored, unrest rises and a nearby ally loses confidence in the party's rule.",
      "Kingdom Impact:",
      "- RP: -1",
      "- Unrest: 1",
      "- Renown: -1",
      "- Crime: 1",
      "Notes: Track this as a pressure clock tied to the next kingdom turn or travel leg.",
    ].join("\n");
  }
  if (normalizedMode === "location") {
    return [
      "Name: Old Waystation",
      "Hex: D4",
      `What Changed: ${ensureSentence(cleanInput || "Describe atmosphere, immediate tension, and one clue tied to current events")}`,
      "Notes: Use one visual detail, one immediate problem, and one clue the party can act on right away.",
    ].join("\n");
  }
  if (tabId) {
    const byTab = generateCopilotFallbackByTab(tabId, cleanInput);
    if (byTab) return byTab;
  }
  if (normalizedMode === "prep") {
    return toPrepBullets(cleanInput || "Prepare a concise opening, one obstacle, and one reveal.");
  }
  if (normalizedMode === "recap") {
    return buildRecapFallback(cleanInput || "The party advanced their goals and uncovered a new threat.");
  }
  return ensureSentence(cleanInput || "Session notes organized into practical GM prep text.");
}

function generateCopilotFallbackByTab(tabId, input) {
  if (tabId === "dashboard") {
    const lower = String(input || "").toLowerCase();
    if (
      /\b(opening scene|objective|obstacle|consequence)\b/.test(lower) ||
      /\bscene\b/.test(lower)
    ) {
      return [
        "Opening Scene:",
        "Objective: Get the party to commit to helping the border village before supplies run short.",
        "Obstacle: A shaken witness gives conflicting details, while rival locals push different priorities.",
        "Consequence: Delay lets the threat escalate, costing trust and creating a harder first encounter.",
        "Read-Aloud (4-6 sentences):",
        "A cold wind pushes dust across the village square as the party arrives to find shutters barred before dusk. A cart stands overturned near the well, its cargo half-looted and scattered. An exhausted runner grabs the nearest hero and points toward the road, warning that scouts never returned. At the same moment, two villagers begin arguing over whether to fortify the gate or send a rescue team now. Every voice turns toward the party, waiting to see what they do first.",
      ].join("\n");
    }
    if (/\b(hook|hooks)\b/.test(lower)) {
      return [
        "Three Fast Hooks:",
        "- Debt Hook: a caravan master offers payment and future discounts if the party secures the route tonight.",
        "- Duty Hook: a local leader names one missing family member and begs the party to bring them back before dark.",
        "- Rival Hook: another adventuring crew is already taking the job, and failure means losing influence in the region.",
      ].join("\n");
    }
    return [
      "Top Priorities:",
      "- Confirm the opening scene objective and one consequence.",
      "- Pick one active quest to advance this session.",
      "- Prepare one NPC reaction and one location change.",
      "",
      "60-Minute Prep Queue:",
      "- 15m: review last session consequences",
      "- 20m: prep one obstacle with stakes",
      "- 15m: prep clues and reveals",
      "- 10m: prep fallback scene",
    ].join("\n");
  }
  if (tabId === "sessions") {
    return [
      "Summary:",
      ensureSentence(input || "Session notes captured and next objectives clarified."),
      "",
      "Next Prep:",
      "- Open with urgency tied to one active quest.",
      "- Prepare one social beat and one challenge beat.",
      "- End with a clear hook for next session.",
    ].join("\n");
  }
  if (tabId === "capture") {
    return [
      "Summary:",
      ensureSentence(input || "Captured notes should be grouped by scene and consequence."),
      "",
      "Follow-up Tasks:",
      "- Group notes by scene.",
      "- Mark unresolved hooks.",
      "- Push key entries into the latest session log.",
    ].join("\n");
  }
  if (tabId === "kingdom") {
    return [
      "Kingdom Turn Focus:",
      "- Confirm Control DC, unrest, ruin, and consumption before spending actions.",
      "- Assign specialized leader actions first, then use flexible actions to cover gaps.",
      "- Check whether any civic structure, construction project, or event needs to resolve this turn.",
      "",
      "Recommended Action Order:",
      "1. Resolve Upkeep changes, including leadership gaps and automatic kingdom effects.",
      "2. Spend leader and settlement actions on the safest high-value activities for this turn.",
      "3. Record RP, commodities, unrest, ruin, renown, fame, infamy, and pending construction changes.",
      "",
      "Risks To Watch:",
      "- Rising unrest or ruin near the threshold can make the next event spiral fast.",
      "- Consumption and local settlement limits can quietly punish overexpansion.",
      "",
      "What To Record In Kingmaker Companion:",
      "- Which leaders acted, what changed, and which projects are still pending.",
      "- Any rulings or reminders you need before the next kingdom turn.",
    ].join("\n");
  }
  if (tabId === "npcs") {
    return [
      "Name: Frontier Contact",
      "Role: Information broker",
      "Agenda: Gain leverage over local factions",
      "Disposition: Cautiously allied",
      "Notes:",
      "- Core want: Stay indispensable to every side without becoming owned by any one faction.",
      "- Leverage over the party or locals: Holds a name, route, or hidden meeting place the party needs.",
      "- Current pressure or fear: One local faction suspects they are selling information twice.",
      "- Voice and mannerisms: Speaks in clipped sentences and never answers the exact question first.",
      "- First impression or look: Polished boots, travel cloak, and the calm posture of someone who expects trouble.",
      "- Hidden truth or complication: Their best source is a person the party would not trust on sight.",
      "- Best way to use them in the next session: Introduce them as the fastest path to a lead, then make the price for help social rather than monetary.",
    ].join("\n");
  }
  if (tabId === "companions") {
    return [
      "Name: Frontier Scout",
      "Status: traveling",
      "Influence: 5",
      "Current Hex: D4",
      "Kingdom Role: Warden candidate",
      "Personal Quest: Find proof that a missing patrol was betrayed from inside the kingdom.",
      "Notes:",
      "- Loyalty or leverage: Trust grows when the party follows through on frontier promises.",
      "- Current pressure or tension: They suspect someone useful to the kingdom is hiding the truth.",
      "- Best camp or travel scene: They share a hard choice from the road and ask who the kingdom protects first.",
      "- Best use in the next session: Tie them to a travel complication or a border-defense decision.",
    ].join("\n");
  }
  if (tabId === "quests") {
    return [
      "Title: Secure the Main Route",
      "Status: open",
      "Priority: Soon",
      "Chapter: Stolen Lands Opening",
      "Hex: D4",
      "Objective: Clear threats blocking movement between key settlements.",
      "Giver: Local council envoy",
      "Stakes: Trade and trust collapse if route remains unsafe.",
      "Linked Companion: ",
      "Next Beat: Push the party toward the first concrete lead on the route.",
    ].join("\n");
  }
  if (tabId === "events") {
    return [
      "Title: Bandit Tribute Deadline",
      "Category: threat",
      "Status: active",
      "Urgency: 4",
      "Hex: D4",
      "Linked Quest: Secure the Main Route",
      "Linked Companion: ",
      "Clock: 2",
      "Clock Max: 4",
      "Advance / Turn: 1",
      "Advance Mode: turn",
      "Impact Scope: claimed-hex",
      "Trigger: The local threat makes a demand and expects visible submission.",
      "Consequence Summary: Failure to answer the threat on time costs the kingdom supplies, legitimacy, and breathing room.",
      "Fallout: Delay hardens enemy confidence and damages local trust in the party.",
      "Kingdom Impact:",
      "- RP: -1",
      "- Unrest: 1",
      "- Food: -1",
      "- Crime: 1",
      "Notes: Advance this if the party spends time elsewhere or fails to project control.",
    ].join("\n");
  }
  if (tabId === "locations") {
    return [
      "Name: Old Waystation",
      "Hex: Frontier Route",
      "What Changed: Signs of hostile activity appeared nearby.",
      "Notes: Use fog, damaged supplies, and witness rumors as scene cues.",
    ].join("\n");
  }
  if (tabId === "pdf") {
    return [
      "Book Context Status: No PDF-grounded answer was generated here. This is a built-in fallback.",
      "Query: adventure summary opening chapter",
      "Backup Queries:",
      "- main threat final chapter",
      "- important NPCs clues chapter one",
      "Why: Summarize the book or search for the specific section you want before asking again.",
    ].join("\n");
  }
  if (tabId === "foundry") {
    return [
      "- Export NPC and quest updates from this session.",
      "- Verify names and titles before import.",
      "- Import JSON and spot-check journal links.",
    ].join("\n");
  }
  return "";
}

function generateAssistantFallbackAnswer(input, context = {}) {
  const prompt = String(input || "").trim();
  const lower = prompt.toLowerCase();
  const intent = detectAssistantIntent(prompt, context);
  if (!prompt) return "Ask one clear GM question and I will generate table-ready options.";
  if (/^(hi|hello|hey|yo)\b/.test(lower) || lower.includes("how are you")) {
    return [
      "Hey. I am ready.",
      "Tell me what you want right now:",
      "- prep plan",
      "- encounter idea",
      "- kingdom turn help",
      "- NPC or quest help",
      "- cleanup of rough notes",
    ].join("\n");
  }
  if (/\b(who|what)\s+are\s+you\b/.test(lower)) {
    return [
      "I am your Kingmaker Companion AI running on your local AI setup.",
      "I can help with hooks, session prep, kingdom turns, encounters, NPCs, quests, and note cleanup.",
      "Ask me for one specific thing and I will draft it in table-ready format.",
    ].join("\n");
  }
  if (/\bwhat can you do\b/.test(lower) || /^help\b/.test(lower)) {
    return [
      "I work best when you ask for one concrete job: advice, prep, recall, or a draft.",
      "",
      "Best uses right now:",
      "- Session hook ideas",
      "- Kingdom turn planning and record updates",
      "- Encounter setup (objective, obstacle, consequence)",
      "- NPC or quest drafts",
      "- Cleanup of rough notes into clean prep text",
    ].join("\n");
  }

  if (intent === "player_build") {
    return generatePlayerBuildFallback(prompt, context);
  }

  if (intent === "rules_question") {
    return generateRulesFallback(prompt, context);
  }

  if (intent === "campaign_recall") {
    return generateCampaignRecallFallback(context);
  }

  if (intent === "session_start_or_opening") {
    return generateKingmakerOpeningFallback();
  }

  if (
    lower.includes("hook") ||
    lower.includes("where to start") ||
    lower.includes("start this") ||
    lower.includes("start the game") ||
    lower.includes("not sure where to start")
  ) {
    return [
      "Quick take: open with pressure the players can answer immediately, then let the larger campaign breathe after they make the first choice. If the first scene has no decision point, it will feel like narration instead of play.",
      "",
      "I would pick one of these hooks:",
      "- Distress Hook: A messenger arrives injured and begs the party to act before nightfall.",
      "- Contract Hook: A local patron offers pay, supplies, and legal authority for one urgent job.",
      "- Personal Hook: The problem directly threatens one PC contact, home, or oath.",
      "",
      "Quick first scene plan:",
      "- Objective: Reach the threatened site and confirm what is happening.",
      "- Obstacle: A rival group or hazard blocks the fastest route.",
      "- Consequence: If delayed, the enemy secures leverage before the party arrives.",
    ].join("\n");
  }

  if (lower.includes("npc")) {
    return [
      "Quick NPC frame:",
      "- Goal: what they want right now.",
      "- Leverage: what they can offer or withhold.",
      "- Pressure: what happens if ignored.",
      "- Voice: one memorable speaking trait.",
    ].join("\n");
  }

  if (/\b(monster|monsters|enemy|enemies|creature|creatures|villain|threat)\b/.test(lower)) {
    return [
      "Monster prep frame:",
      "- Use 1 signature threat tied to the adventure's main problem.",
      "- Use 2 recurring lower-rank enemies so the region feels consistent.",
      "- Add 1 hazard or weird support creature to change the fight rhythm.",
      "",
      "Good categories to choose from:",
      "- Humanoid pressure: bandits, scouts, cultists, rival hunters.",
      "- Supernatural pressure: spirits, undead, cursed beasts, corrupted guardians.",
      "- Environment pressure: traps, haunted ground, fog, unstable bridges, shrine effects.",
      "",
      "Pick monsters that answer:",
      "- What does this region fear most?",
      "- What protects the main villain or secret?",
      "- What shows the consequences before the party reaches the main conflict?",
    ].join("\n");
  }

  if (/\b(run|start with|starting point|first step|adventure|scenario|module|book|players)\b/.test(lower)) {
    return [
      "Quick take: do not try to prep the whole book first. Prep the opening decision, the first pressure, and the first consequence; that gives you enough control without overbuilding.",
      "",
      "Start here:",
      "- Read the adventure hook, final threat, and first 2 encounter areas before anything else.",
      "- Pick one clear opening scene that gets the party moving in the first 10 minutes.",
      "- Write 3 names: the first ally, the first problem NPC, and the first place the party reaches.",
      "",
      "First prep pass:",
      "- What do the players need to care about immediately?",
      "- What blocks them in scene one?",
      "- What gets worse if they wait?",
    ].join("\n");
  }

  if (/\b(prep|prepare|next|tonight|session)\b/.test(lower)) {
    return [
      "Quick take: prep one playable problem, not five possible chapters. The table will feel better if the next session has a strong first choice and one visible cost for delay.",
      "",
      "Next Prep Pass:",
      "- Opening scene: put the party in front of one visible problem they can act on immediately.",
      "- Immediate objective: define what success looks like before the first break in play.",
      "- Active pressure: choose one clock or enemy move that escalates if the party delays.",
      "- NPC beat: prepare one ally who needs help and one troublemaker who complicates the obvious solution.",
      "- Location beat: prepare one practical route, one hazard, and one clue pointing toward the next choice.",
      "",
      "Save Into The App:",
      "- Quest: the objective the party can complete next.",
      "- Event: the pressure that advances if they ignore it.",
      "- Table Note: the opening scene, obstacle, and consequence.",
    ].join("\n");
  }

  const hasGmSignal = /\b(hook|quest|npc|session|encounter|player|players|party|location|monster|prep|campaign|story|adventure|scenario|module|book|run)\b/.test(
    lower
  );
  if (!hasGmSignal) {
    return [
      "I can help with your tabletop session prep.",
      "Try asking:",
      "- Give me 3 hooks for level 1 players.",
      "- Build one opening scene with objective, obstacle, consequence.",
      "- Turn these rough notes into session prep bullets.",
    ].join("\n");
  }

  return [
    "Quick take: turn this into one table-facing decision, not just background text. Give the party something to choose, something that resists them, and something that changes if they wait.",
    "",
    "Recommended Prep:",
    `- Core ask: ${ensureSentence(prompt)}`,
    "- Scene objective: turn the question into one thing the party can accomplish on screen.",
    "- Obstacle: add one social, travel, or combat problem that forces a meaningful choice.",
    "- Consequence: decide what changes if the party waits or fails.",
    "- App record: save the result as a quest, event, NPC, location, or table note so it stays connected to the campaign.",
  ].join("\n");
}

function generateKingmakerOpeningFallback() {
  return [
    "Steward's Opening Counsel:",
    "Quick take: start before Oleg's Trading Post. The campaign works better if the players first feel the weight of being chosen, watched, and politically useful before they are dropped into frontier logistics.",
    "",
    "Your first playable frame should be the Restov / Jamandi Aldori opening: the heroes are gathered under noble attention, offered legal authority, and measured as future frontier problem-solvers.",
    "",
    "Opening Scene:",
    "- Put the party at Lady Jamandi Aldori's mansion or manor before the road north.",
    "- Give each PC one quick table moment: why they answered the call, what they hope to gain, and what would make them walk away.",
    "- Frame the charter as political leverage, not just permission to go adventuring.",
    "",
    "Immediate Pressure:",
    "- The Stolen Lands are an opportunity, but everyone in the room should feel that rival ambition and frontier danger are already moving.",
    "- Keep Oleg's Trading Post as the first frontier destination after the opening, not the campaign's first scene.",
    "",
    "What To Prep Next:",
    "- Three mansion impressions: Jamandi as patron, one useful ally or contact, and one suspicious rival or nervous observer.",
    "- Two table questions: what does each PC want from land and authority, and what line will they not cross to get it?",
    "- One transition hook from the charter ceremony to the road toward Oleg's.",
    "",
    "Records To Update:",
    "- Adventure Log: create a session zero or session one entry for the mansion opening.",
    "- NPCs: add or review Jamandi Aldori as the active patron.",
    "- Quests: keep Secure Oleg's Trading Post as the next quest after the mansion prologue.",
  ].join("\n");
}

function generateRulesFallback(input, context = {}) {
  const lower = normalizeAiLookupText(input);
  const kingdom = context?.kingdom && typeof context.kingdom === "object" ? context.kingdom : {};
  const kingdomState = [
    kingdom?.currentTurnLabel ? `Turn ${kingdom.currentTurnLabel}` : "",
    kingdom?.controlDC != null ? `Control DC ${kingdom.controlDC}` : "",
    kingdom?.unrest != null ? `Unrest ${kingdom.unrest}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  if (/\b(kingdom turns?|kingdom turn|control dc|unrest|consumption|leadership activity|settlement activity|claim|ruin)\b/.test(lower)) {
    return [
      "Quick take: treat a kingdom turn as a fixed order of operations, not a loose checklist. Resolve upkeep and kingdom state first, spend actions second, then record every changed stat before ending the turn.",
      "",
      "Kingdom turn structure:",
      "- Start with current kingdom state, including Control DC, unrest, and any automatic effects or unresolved events.",
      "- Resolve the turn's required upkeep pieces before choosing discretionary actions.",
      "- Spend leader, settlement, and region actions in a deliberate order so you do not lose track of prerequisites or resource costs.",
      "- Finish by recording RP, commodities, unrest, ruin, construction progress, and any event clocks that advanced.",
      kingdomState ? `Current app state: ${kingdomState}.` : "Current app state: no kingdom snapshot was attached to this fallback.",
      "",
      "Practical rule:",
      "If you are unsure what changes first, update the kingdom sheet immediately after each action instead of waiting until the end of the turn.",
    ].join("\n");
  }

  if (/\b(does this stack|stack)\b/.test(lower)) {
    return [
      "Quick take: check the exact effect types and wording first. In PF2e, things that look similar often do not stack if they are the same type of bonus, penalty, or named effect.",
      "",
      "How to judge it:",
      "- Identify whether each effect is a bonus, penalty, circumstance effect, status effect, or item effect.",
      "- Check whether the rule text says the effects combine, replace each other, or the higher value applies.",
      "- If two effects are the same kind and target the same thing, assume they usually do not both fully stack unless the text clearly says otherwise.",
    ].join("\n");
  }

  return [
    "Quick take: answer the rule as directly as possible before talking tactics. If you cannot state the resolution in one sentence, you probably have not identified the actual rule question yet.",
    "",
    "Rules check:",
    `- Question: ${ensureSentence(input)}`,
    "- State the rule outcome first.",
    "- Then note the condition, exception, or edge case that changes the answer.",
    "- Only add table advice after the rule itself is clear.",
  ].join("\n");
}

function generateCampaignRecallFallback(context = {}) {
  const latestSession = context?.latestSession && typeof context.latestSession === "object" ? context.latestSession : {};
  const recentSessions = Array.isArray(context?.recentSessions) ? context.recentSessions : [];
  const openQuests = Array.isArray(context?.openQuests) ? context.openQuests : [];
  const kingdom = context?.kingdom && typeof context.kingdom === "object" ? context.kingdom : {};
  const secondSession = recentSessions.find((session) => String(session?.id || "") !== String(latestSession?.id || ""));
  const currentState = [
    latestSession?.title ? `Latest session: ${latestSession.title}` : "",
    latestSession?.summary ? latestSession.summary : "",
  ]
    .filter(Boolean)
    .join(" - ");
  const kingdomState = [
    kingdom?.currentTurnLabel ? `Turn ${kingdom.currentTurnLabel}` : "",
    kingdom?.controlDC != null ? `Control DC ${kingdom.controlDC}` : "",
    kingdom?.unrest != null ? `Unrest ${kingdom.unrest}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    "Quick take: here is the current campaign picture from stored notes only.",
    "",
    currentState ? `Current state: ${currentState}` : "Current state: no latest session summary is stored.",
    secondSession?.title ? `Prior point of reference: ${secondSession.title}${secondSession?.summary ? ` - ${secondSession.summary}` : ""}` : "",
    openQuests[0]?.title ? `Open thread: ${openQuests[0].title}${openQuests[0]?.nextBeat ? ` - ${openQuests[0].nextBeat}` : openQuests[0]?.objective ? ` - ${openQuests[0].objective}` : ""}` : "",
    kingdomState ? `Kingdom state: ${kingdomState}` : "",
    "",
    "If you want, ask for a tighter recap, unresolved threads only, or kingdom status only.",
  ]
    .filter(Boolean)
    .join("\n");
}

function generatePlayerBuildFallback(input, context = {}) {
  const lower = normalizeAiLookupText(input);
  const recentContext = Array.isArray(context?.aiHistory)
    ? normalizeAiLookupText(context.aiHistory.slice(-6).map((entry) => entry?.text || "").join(" "))
    : "";
  const combined = `${lower} ${recentContext}`.trim();
  const asksSorcerer = /\b(sor|sorc|sorcerer|sorceror)\b/.test(combined);
  if (asksSorcerer) {
    return [
      "Quick take: Sorcerer is a strong Kingmaker pick if you want charisma, flexible magic, and a clear party role without preparing spells every day.",
      "",
      "Pointers:",
      "- Decide your role first: blaster, controller, face/support, or strange bloodline utility. Sorcerers feel much better when your spell choices support one plan.",
      "- Protect your limited spells known. Pick spells you expect to cast often, not niche answers that look cool once.",
      "- Keep a reliable damage cantrip, one defensive option, and at least one spell that changes the battlefield or solves a non-combat problem.",
      "- Charisma is your engine, so lean into social skills if nobody else is covering the party face role.",
      "- Your bloodline matters because it shapes your spell list, focus spell, and overall vibe. Choose it for playstyle, not just theme.",
      "",
      "Watch-outs:",
      "- Do not spend every known spell on damage. Kingmaker rewards travel, negotiation, investigation, and weird problem-solving.",
      "- Do not stand still in bad positions. You are useful when you survive long enough to keep casting.",
      "- If the party already has multiple full casters, pick spells that make you distinct instead of duplicating their job.",
    ].join("\n");
  }
  const asksIntCaster = /\b(int|intelligence|int based|arcane)\b/.test(combined) && /\b(caster|spellcaster|spell caster|wizard|witch|psychic|magus)\b/.test(combined);
  if (asksIntCaster) {
    return [
      "Quick take: yes, an INT-based caster can work well, and I would lean Wizard if you want the strongest party fit. With a Monk, Thaumaturge, and Cleric, Wizard gives you the missing piece: broad arcane utility, battlefield control, knowledge coverage, and problem-solving that is not already covered by divine magic.",
      "",
      "Why it fits:",
      "- You add area control, utility rituals, knowledge skills, and flexible spell answers.",
      "- You avoid competing directly with the Cleric's divine support role.",
      "- You give the Monk and Thaumaturge better fights by shaping the battlefield instead of just adding more single-target damage.",
      "",
      "Alternatives:",
      "- Witch if you want a more flavorful patron/familiar caster with a softer support angle.",
      "- Magus if you want INT and weapons, but it overlaps more with the party's martial side.",
      "- Psychic if you want a flashier caster, but it is less of a broad problem-solver than Wizard.",
    ].join("\n");
  }
  const hasMonkThaumCleric = /\bmonk\b/.test(lower) && /\bthaumaturge\b/.test(lower) && /\bcleric\b/.test(lower);
  if (hasMonkThaumCleric) {
    return [
      "Quick take: I would play a Fighter. With a Monk, Thaumaturge, and Cleric already present, the group benefits most from a reliable front-line anchor who turns the Cleric's support and the Thaumaturge's enemy knowledge into consistent results.",
      "",
      "Why it fits this party:",
      "- The Monk is mobile, but not always built to stand still and hold enemy attention.",
      "- The Thaumaturge brings strong identification, weaknesses, utility, and weird problem-solving, but can appreciate someone else controlling the front.",
      "- The Cleric covers healing and divine support, which makes a durable martial even better.",
      "",
      "How it plays:",
      "- Pick Fighter if you want dependable accuracy, simple turns, and strong teamwork.",
      "- Use a shield or reach weapon if you want to protect the party; use two-handed weapons if the group needs more damage.",
      "- Take Athletics options if you want to trip, shove, and lock enemies down for the Monk and Thaumaturge.",
      "",
      "Alternatives:",
      "- Champion if you want more defense and party protection.",
      "- Ranger if you want wilderness skill, tracking, and reliable ranged or dual-weapon pressure.",
      "- Rogue if the group needs more skills and precision damage, but it is less sturdy than Fighter.",
    ].join("\n");
  }

  return [
    "Quick take: choose the class that fills the missing party role while still sounding fun to play for a long campaign. In PF2e, party coverage matters, but enjoying your turn every round matters more.",
    "",
    "How to choose:",
    "- If the party lacks a steady front line, pick Fighter or Champion.",
    "- If the party lacks skills and scouting, pick Rogue, Ranger, or Investigator.",
    "- If the party lacks control or utility casting, pick Bard, Wizard, Druid, Witch, or Sorcerer.",
    "- If the party lacks ranged pressure, pick Ranger, Gunslinger, Fighter, or Rogue.",
    "",
    "My practical rule:",
    "Pick the class whose normal turn sounds fun even when the dice are cold. That is usually the class you will enjoy past the first few sessions.",
  ].join("\n");
}

function toPrepBullets(text) {
  const lines = splitAiLines(text);
  const source = lines.length ? lines : [text];
  return source
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => `- ${ensureSentence(line)}`)
    .join("\n");
}

function buildRecapFallback(text) {
  const clean = normalizeSentenceText(text);
  const parts = clean.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  const first = parts[0] || "the party pushed the story forward";
  const second = parts[1] || "they uncovered new pressure tied to their current objective";
  return `Last session, ${lowercaseFirst(first)}. ${capitalizeFirst(second)}. Now the next chapter begins.`;
}

function normalizeSentenceText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSentence(text) {
  const clean = normalizeSentenceText(text);
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function lowercaseFirst(text) {
  const clean = normalizeSentenceText(text);
  if (!clean) return "";
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function capitalizeFirst(text) {
  const clean = normalizeSentenceText(text);
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function summarizeForPrompt(text, limit) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit)}...`;
}

function getIndexedPdfFileNames(limit = 30) {
  const max = Math.max(1, Math.min(Number.parseInt(String(limit || "30"), 10) || 30, 120));
  const names = pdfIndexCache.files
    .map((file) => String(file?.fileName || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return names.slice(0, max);
}

function getIndexedPdfFileNamesFromContext(context, limit = 30) {
  const max = Math.max(1, Math.min(Number.parseInt(String(limit || "30"), 10) || 30, 120));
  const names = Array.isArray(context?.pdfIndexedFiles)
    ? context.pdfIndexedFiles.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  names.sort((a, b) => a.localeCompare(b));
  return names.slice(0, max);
}

function isPdfGroundedQuestion(inputText) {
  const lower = String(inputText || "").toLowerCase().trim();
  if (!lower) return false;
  return /\b(selected pdf|this book|the book|book|pdf|adventure|module|chapter|section|main threat|run chapter|run it|run this)\b/.test(
    lower
  );
}

function isSourceScopeQuestion(text) {
  const lower = String(text || "").toLowerCase().trim();
  if (!lower) return false;
  const directScopePatterns = [
    /\bwhat do you have access to\b/,
    /\bwhat can you access\b/,
    /\bwhat books do you have\b/,
    /\bwhat pdfs?\s+do you have\b/,
    /\bwhich books\b.*\b(can|do)\s+you\b/,
    /\bwhat files are indexed\b/,
    /\bwhich files are indexed\b/,
    /\blist\b.*\b(indexed|loaded|available)\s+(books?|pdfs?|sources?|files?)\b/,
    /\bshow (me )?(the )?(indexed|loaded|available)\s+(books?|pdfs?|sources?|files?)\b/,
    /\bdo you have access to\b.*\b(books?|pdfs?|sources?|rulebooks?)\b/,
    /\bcan you access\b.*\b(books?|pdfs?|sources?|rulebooks?)\b/,
  ];
  return directScopePatterns.some((pattern) => pattern.test(lower));
}

function maybeBuildSourceScopeReply(mode, input, context = null) {
  if (String(mode || "").toLowerCase() !== "assistant") return "";
  if (!isSourceScopeQuestion(input)) return "";

  const liveFiles = getIndexedPdfFileNames(30);
  const contextFiles = getIndexedPdfFileNamesFromContext(context, 30);
  const files = liveFiles.length ? liveFiles : contextFiles;
  const contextCount = Number.parseInt(String(context?.pdfIndexedFileCount || files.length || 0), 10) || 0;
  const liveCount = pdfIndexCache.files.length;
  const total = Math.max(liveCount, contextCount, files.length);

  if (!total) {
    return [
      "I only use files indexed in this app.",
      "No PDFs are indexed yet.",
      "Open Source Library and run Index PDFs, then ask again.",
    ].join("\n");
  }

  const lines = [
    "I only have access to PDFs indexed in this app.",
    `Indexed files (${files.length}${total > files.length ? ` of ${total}` : ""}):`,
    ...files.map((name) => `- ${name}`),
  ];
  if (total > files.length) {
    lines.push(`- ...and ${total - files.length} more indexed files.`);
  }
  if (!liveCount && contextCount > 0) {
    lines.push("Note: these come from saved campaign index metadata. Re-index in Source Library to load full live text context.");
  }
  lines.push("If a book is not in this indexed list, I do not have access to it.");
  return lines.join("\n");
}

function findIndexedPdfFileByName(fileName) {
  const target = String(fileName || "").trim().toLowerCase();
  if (!target) return null;
  return pdfIndexCache.files.find((file) => String(file?.fileName || "").trim().toLowerCase() === target) || null;
}

function buildSelectedPdfPreview(fileName, maxChars = 1200) {
  const file = findIndexedPdfFileByName(fileName);
  if (!file) return "";
  const pages = getIndexedPages(file).slice(0, 3);
  const combined = pages.map((page) => normalizePdfText(page.text)).filter(Boolean).join(" ");
  return summarizeForPrompt(combined, Math.max(240, Number(maxChars) || 1200));
}

function collectSelectedPdfFallbackContext(fileName, query, limit = 6) {
  const file = findIndexedPdfFileByName(fileName);
  if (!file) return [];
  const pages = getIndexedPages(file);
  if (!pages.length) return [];

  const max = Math.max(1, Math.min(Number(limit) || 6, 12));
  const lowerQuery = String(query || "").toLowerCase();
  const wantsChapterOne = /\b(chapter\s*1|chapter one|opening|first chapter|start of the book)\b/.test(lowerQuery);
  const wantsThreat = /\b(threat|villain|antagonist|enemy|danger|main problem|main conflict)\b/.test(lowerQuery);
  const seen = new Set();
  const ranked = [];

  function addPage(page, score, pattern = null) {
    if (!page?.text || seen.has(page.page)) return;
    seen.add(page.page);
    const textLower = String(page.textLower || page.text.toLowerCase());
    const hit = pattern ? textLower.search(pattern) : -1;
    ranked.push({
      fileName: file.fileName,
      page: page.page,
      score,
      snippet: makeSnippet(page.text, hit),
    });
  }

  const chapterPattern = /\b(chapter\s*1|chapter one|introduction|overview|adventure summary|background|part 1)\b/i;
  const threatPattern = /\b(threat|villain|antagonist|enemy|danger|cult|mastermind|plot|menace)\b/i;

  for (const page of pages.slice(0, 2)) {
    addPage(page, 40);
  }
  if (wantsChapterOne) {
    for (const page of pages) {
      if (chapterPattern.test(page.text)) addPage(page, 90, chapterPattern);
      if (ranked.length >= max) break;
    }
  }
  if (wantsThreat) {
    for (const page of pages) {
      if (threatPattern.test(page.text)) addPage(page, 85, threatPattern);
      if (ranked.length >= max) break;
    }
  }
  for (const page of pages.slice(2)) {
    addPage(page, 20);
    if (ranked.length >= max) break;
  }

  ranked.sort((a, b) => b.score - a.score || a.page - b.page);
  return ranked.slice(0, max);
}

async function collectPdfContextForAi(query, limit = 6, options = {}) {
  const searchParts = buildSearchParts(query);
  const longWords = searchParts.words.filter((word) => word.length >= 4);
  if (!longWords.length && !searchParts.phrase) return [];
  const result = await searchIndexedPdfHybrid(query, Math.max(1, Math.min(Number(limit) || 6, 12)), {
    config: options?.config,
    preferredFileName: options?.preferredFileName,
  });
  return Array.isArray(result?.results) ? result.results.slice(0, Math.max(1, Math.min(Number(limit) || 6, 12))) : [];
}
