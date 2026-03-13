const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");
const pdfParse = require("pdf-parse");

const DEFAULT_PDF_FOLDER = "C:\\Users\\Chris Bender\\OneDrive\\Desktop";
const MAX_CHARS_PER_FILE = 300000;
const DEFAULT_AI_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_AI_MODEL = "llama3.1:8b";
const AI_TIMEOUT_MS = 120000;
const AI_PDF_SNIPPET_LIMIT = 6;
const OLLAMA_BOOT_RETRY_COUNT = 12;
const OLLAMA_BOOT_RETRY_DELAY_MS = 1000;
const PDF_INDEX_CACHE_FILENAME = "pdf-index-cache.v1.json";
const AI_MODEL_LABELS = Object.freeze({
  "lorebound-pf2e:latest": "LoreBound PF2e Deep (20B)",
  "lorebound-pf2e-fast:latest": "LoreBound PF2e Fast (20B)",
  "lorebound-pf2e-minimal:latest": "LoreBound PF2e Minimal (20B)",
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
  "qwen2.5-coder:1.5b-base": "Qwen 2.5 Coder Base (1.5B)",
  "qwen2.5-coder:32b": "Qwen 2.5 Coder (32B)",
});

let mainWindow = null;
const pdfViewerWindows = new Set();
let pdfIndexCache = {
  folderPath: "",
  indexedAt: "",
  files: [],
};
let ollamaBootPromise = null;

wireProcessStabilityGuards();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    title: "DM Helper",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  wireSpellcheckContextMenu(mainWindow);
}

app.whenReady().then(async () => {
  await loadPdfIndexCacheFromDisk();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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

function sanitizeIndexedFile(rawFile) {
  const filePath = String(rawFile?.path || "").trim();
  const fileName = String(rawFile?.fileName || path.basename(filePath || "")).trim();
  const pagesRaw = Array.isArray(rawFile?.pages) ? rawFile.pages : [];
  const pages = pagesRaw
    .map((rawPage, index) => sanitizeIndexedPage(rawPage, index + 1))
    .filter(Boolean);
  if (!filePath || !fileName || !pages.length) return null;
  const merged = normalizePdfText(pages.map((page) => page.text).join(" "));
  const summary = normalizePdfText(String(rawFile?.summary || "")).slice(0, 24000);
  const summaryUpdatedAt = String(rawFile?.summaryUpdatedAt || "").trim();
  return {
    path: filePath,
    fileName,
    pages,
    text: merged,
    textLower: merged.toLowerCase(),
    charCount: merged.length,
    summary,
    summaryUpdatedAt,
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
      summary: normalizePdfText(String(file?.summary || "")).slice(0, 24000),
      summaryUpdatedAt: String(file?.summaryUpdatedAt || "").trim(),
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
      summary: normalizePdfText(String(file?.summary || "")).slice(0, 24000),
      summaryUpdatedAt: String(file?.summaryUpdatedAt || "").trim(),
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

function registerIpc() {
  ipcMain.handle("pdf:get-default-folder", async () => {
    return DEFAULT_PDF_FOLDER;
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
        const merged = normalizePdfText(pages.map((page) => page.text).join(" "));
        const existing = existingByPath.get(pdfPath);

        indexedFiles.push({
          path: pdfPath,
          fileName: path.basename(pdfPath),
          pages,
          text: merged,
          textLower: merged.toLowerCase(),
          charCount: merged.length,
          summary: normalizePdfText(String(existing?.summary || "")).slice(0, 24000),
          summaryUpdatedAt: String(existing?.summaryUpdatedAt || "").trim(),
        });
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

    if (!query) return { results: [] };
    if (!pdfIndexCache.files.length) {
      throw new Error("No PDFs indexed yet. Run Index PDFs first.");
    }

    const searchParts = buildSearchParts(query);
    if (!searchParts.words.length && !searchParts.phrase) {
      return { results: [] };
    }
    const ranked = [];

    for (const file of pdfIndexCache.files) {
      const pages = getIndexedPages(file);
      for (const page of pages) {
        const match = scoreTextAgainstQuery(page.textLower, searchParts);
        if (!match.score) continue;
        ranked.push({
          fileName: file.fileName,
          path: file.path,
          page: page.page,
          score: match.score,
          snippet: makeSnippet(page.text, match.firstHit),
        });
      }
    }

    ranked.sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName) || a.page - b.page);
    return { results: ranked.slice(0, limit) };
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
    const summaryConfig = buildPdfSummaryConfig(config);
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
        const raw = await generateWithOllama(summaryConfig, prompt);
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
      const rawFinal = await generateWithOllama(summaryConfig, combinedPrompt);
      finalSummary = sanitizeAiTextOutput(rawFinal);
    } catch {
      finalSummary = "";
    }
    if (!finalSummary) {
      finalSummary = combineChunkSummariesFallback(target.fileName, chunkSummaries);
    }

    target.summary = normalizePdfText(finalSummary).slice(0, 24000);
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

  ipcMain.handle("ai:generate-text", async (_event, payload) => {
    const input = String(payload?.input || "").trim();
    if (!input) {
      throw new Error("Draft text is required.");
    }

    const mode = String(payload?.mode || "session");
    const context =
      payload?.context && typeof payload.context === "object" && !Array.isArray(payload.context)
        ? payload.context
        : {};
    const config = normalizeAiConfig(payload?.config);
    const enrichedContext = {
      ...context,
      pdfContextEnabled: false,
      pdfSnippets: [],
      pdfIndexedFiles: getIndexedPdfFileNames(config.compactContext ? 20 : 40),
      pdfIndexedFileCount: pdfIndexCache.files.length,
    };
    if (config.usePdfContext && pdfIndexCache.files.length) {
      const query = [
        input,
        String(context?.tabContext || ""),
        String(context?.latestSession?.summary || ""),
        String(context?.latestSession?.nextPrep || ""),
      ]
        .join(" ")
        .trim();
      const snippetLimit = config.compactContext ? Math.min(3, AI_PDF_SNIPPET_LIMIT) : AI_PDF_SNIPPET_LIMIT;
      enrichedContext.pdfSnippets = collectPdfContextForAi(query, snippetLimit);
      enrichedContext.pdfContextEnabled = enrichedContext.pdfSnippets.length > 0;
    }

    const userPrompt = buildAiUserPrompt({
      mode,
      input,
      context: enrichedContext,
      compactContext: config.compactContext,
    });
    const text = await generateWithOllama(config, userPrompt);
    const finalized = finalizeAiOutput({
      rawText: text,
      mode,
      input,
      tabId: String(enrichedContext?.activeTab || "").trim(),
    });
    const scopedSourceReply = maybeBuildSourceScopeReply(mode, input, enrichedContext);
    if (scopedSourceReply) {
      return {
        text: scopedSourceReply,
        model: config.model,
        endpoint: config.endpoint,
        usedFallback: false,
        filtered: true,
        fallbackReason: "",
      };
    }
    return {
      text: finalized.text,
      model: config.model,
      endpoint: config.endpoint,
      usedFallback: finalized.usedFallback,
      filtered: finalized.filtered,
      fallbackReason: finalized.fallbackReason || "",
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
    summary: normalizePdfText(String(file?.summary || "")).slice(0, 24000),
    summaryUpdatedAt: String(file?.summaryUpdatedAt || "").trim(),
  };
}

function buildPdfSummaryConfig(config) {
  const next = {
    ...config,
    temperature: Math.max(0, Math.min(Number(config?.temperature ?? 0.2), 0.4)),
    maxOutputTokens: Math.max(Number(config?.maxOutputTokens || 0), 720),
  };
  let timeoutSec = Number.parseInt(String(config?.timeoutSec || "120"), 10);
  if (!Number.isFinite(timeoutSec)) timeoutSec = 120;
  timeoutSec = Math.max(timeoutSec, 240);
  if (/20b/i.test(String(next.model || ""))) {
    timeoutSec = Math.max(timeoutSec, 360);
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
    `You are summarizing indexed PDF content for a GM prep tool.`,
    `Book: ${fileName}`,
    `Chunk ${index} of ${total}.`,
    `Task: Write a concise chunk summary with these sections:`,
    `- Core Topics`,
    `- Rules / Mechanics`,
    `- NPCs / Factions / Locations`,
    `- GM Use At Table`,
    `Keep it factual and grounded only in the provided chunk.`,
    `No markdown tables. No policy text.`,
    ``,
    `Chunk text:`,
    chunkText,
  ].join("\n");
}

function buildPdfFinalSummaryPrompt({ fileName, chunkSummaries }) {
  return [
    `You are combining chunk summaries into one practical book summary for a GM.`,
    `Book: ${fileName}`,
    `Produce these sections:`,
    `1) What this book is for`,
    `2) Key rules/mechanics`,
    `3) Important entities (NPCs, factions, locations, monsters)`,
    `4) GM prep checklist`,
    `5) Fast session-use cheat sheet`,
    `Keep it concise, usable, and factual.`,
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

function combineChunkSummariesFallback(fileName, chunkSummaries) {
  const body = chunkSummaries.map((item) => normalizePdfText(String(item || ""))).filter(Boolean).join("\n");
  if (!body) {
    return `${fileName}\n- No summary could be generated from indexed text.`;
  }
  return [
    `${fileName} Summary`,
    "What this book is for:",
    "- Reference for campaign prep and table use based on indexed content.",
    "Key points:",
    ...body
      .split(/\r?\n+/)
      .map((line) => normalizePdfText(line))
      .filter(Boolean)
      .slice(0, 18)
      .map((line) => (line.startsWith("- ") ? line : `- ${line}`)),
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
  const tempRaw = Number.parseFloat(String(rawConfig?.temperature ?? "0.2"));
  const temperature = Number.isFinite(tempRaw) ? Math.max(0, Math.min(tempRaw, 2)) : 0.2;
  const usePdfContext = rawConfig?.usePdfContext === false ? false : true;
  const compactContext = rawConfig?.compactContext === false ? false : true;
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
    temperature,
    usePdfContext,
    compactContext,
    maxOutputTokens,
    timeoutSec,
    timeoutMs: timeoutSec * 1000 || AI_TIMEOUT_MS,
  };
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

async function generateWithOllama(config, userPrompt, recovered = false, timeoutRetried = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config?.timeoutMs) || AI_TIMEOUT_MS);
  try {
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
            content:
              "You are a tabletop GM writing assistant. Return concise, practical GM-facing text only.",
          },
          { role: "user", content: userPrompt },
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
            "You are a tabletop GM writing assistant.",
            "Return concise, practical GM-facing text only.",
            "",
            userPrompt,
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
        return generateWithOllama(retriedConfig, userPrompt, recovered, true);
      }
      throw new Error(
        `Local AI request timed out after ${Math.round(timeoutMs / 1000)}s. Try compact context, fewer output tokens, a faster model, or a longer timeout.`
      );
    }
    if (!recovered && isLocalEndpoint(config.endpoint) && isLikelyOllamaConnectionError(err)) {
      await ensureOllamaAvailable(config.endpoint, Number(config?.timeoutMs) || AI_TIMEOUT_MS);
      return generateWithOllama(config, userPrompt, true, timeoutRetried);
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

function buildAiUserPrompt({ mode, input, context, compactContext = true }) {
  const latestSession = context?.latestSession || {};
  const openQuests = Array.isArray(context?.openQuests) ? context.openQuests : [];
  const npcs = Array.isArray(context?.npcs) ? context.npcs : [];
  const locations = Array.isArray(context?.locations) ? context.locations : [];
  const indexedPdfFiles = Array.isArray(context?.pdfIndexedFiles) ? context.pdfIndexedFiles : [];
  const pdfSummaryBriefs = Array.isArray(context?.pdfSummaryBriefs) ? context.pdfSummaryBriefs : [];
  const indexedPdfCount = Number.parseInt(String(context?.pdfIndexedFileCount || indexedPdfFiles.length || 0), 10) || 0;
  const aiHistory = Array.isArray(context?.aiHistory) ? context.aiHistory : [];
  const activeTab = summarizeForPrompt(String(context?.activeTab || ""), 40);
  const tabLabel = summarizeForPrompt(String(context?.tabLabel || ""), 80);
  const limits = compactContext
    ? { draft: 1500, tab: 900, latest: 220, snippet: 180 }
    : { draft: 2400, tab: 1800, latest: 360, snippet: 280 };
  const tabContext = summarizeForPrompt(String(context?.tabContext || ""), limits.tab);
  const pdfSnippets = Array.isArray(context?.pdfSnippets) ? context.pdfSnippets : [];
  const pdfEnabled = context?.pdfContextEnabled === true;
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
    assistant: "Answer the GM's question directly with practical, table-ready guidance.",
    session:
      "Produce structured, table-ready session notes. Follow requested section labels exactly and provide substantive detail (not just one short paragraph).",
    recap: "Rewrite as a short read-aloud recap for players (3-6 sentences).",
    npc: "Rewrite as an NPC briefing with motive and attitude.",
    quest: "Rewrite as a quest objective with stakes and next actionable beat.",
    location: "Rewrite as a location briefing with atmosphere and immediate tension.",
    prep: "Rewrite as next-session prep bullet points.",
  };

  const lines = [
    `Mode: ${mode}`,
    `Goal: ${modeGuide[mode] || modeGuide.session}`,
    "",
    "Draft input:",
    summarizeForPrompt(input, limits.draft),
    "",
    "Campaign context:",
    `Active tab: ${activeTab || "unknown"} (${tabLabel || "unknown"})`,
    `Tab context: ${tabContext || "None provided."}`,
    `Latest session: ${summarizeForPrompt(String(latestSession?.title || ""), 120)} | ${summarizeForPrompt(
      String(latestSession?.summary || ""),
      limits.latest
    )}`,
    `Open quests: ${openQuests.map((q) => summarizeForPrompt(String(q?.title || ""), 80)).join("; ") || "None listed."}`,
    `Known NPCs: ${npcs.map((n) => summarizeForPrompt(String(n?.name || ""), 60)).join(", ") || "None listed."}`,
    `Known locations: ${
      locations.map((l) => summarizeForPrompt(String(l?.name || ""), 60)).join(", ") || "None listed."
    }`,
    `PDF context enabled: ${pdfEnabled ? "yes" : "no"}`,
    `Indexed PDF files (${indexedPdfCount}): ${
      indexedPdfFiles.length
        ? indexedPdfFiles.map((name) => summarizeForPrompt(String(name || ""), 70)).join("; ")
        : "None indexed."
    }`,
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
    "Source scope rule: you only have access to campaign context and indexed PDF files listed above.",
    "If asked what books/sources/PDFs you can access, answer using only the indexed PDF file names.",
    "Never claim access to external books, websites, or rules not listed in indexed PDF files.",
  ];

  return lines.join("\n");
}

function finalizeAiOutput({ rawText, mode, input, tabId }) {
  const raw = String(rawText || "").trim();
  const cleaned = sanitizeAiTextOutput(raw);
  const candidate = cleaned || raw;

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
    text: generateFallbackAiOutput(mode, input, tabId),
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

function generateFallbackAiOutput(mode, input, tabId) {
  const normalizedMode = String(mode || "").toLowerCase();
  const cleanInput = normalizeSentenceText(String(input || "").trim());
  if (normalizedMode === "assistant") {
    return generateAssistantFallbackAnswer(cleanInput);
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
  if (normalizedMode === "npc") {
    return `NPC Brief: ${ensureSentence(cleanInput || "This NPC has a clear goal and visible pressure in the current scene")}`;
  }
  if (normalizedMode === "quest") {
    return `Objective: ${ensureSentence(cleanInput || "Advance the active quest with one clear obstacle and one consequence for delay")}`;
  }
  if (normalizedMode === "location") {
    return `Location Note: ${ensureSentence(cleanInput || "Describe atmosphere, immediate tension, and one clue tied to current events")}`;
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
  if (tabId === "npcs") {
    return [
      "Name: Frontier Contact",
      "Role: Information broker",
      "Agenda: Gain leverage over local factions",
      "Disposition: Cautiously allied",
      "Notes: Speaks in clipped sentences and trades favors, not coin.",
    ].join("\n");
  }
  if (tabId === "quests") {
    return [
      "Title: Secure the Main Route",
      "Status: open",
      "Objective: Clear threats blocking movement between key settlements.",
      "Giver: Local council envoy",
      "Stakes: Trade and trust collapse if route remains unsafe.",
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
      "Query: frontier road spirit threat",
      "Backup Queries:",
      "- cursed road encounter design",
      "- low level incorporeal enemy tactics",
      "Why: These terms find practical encounter and rules references quickly.",
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

function generateAssistantFallbackAnswer(input) {
  const prompt = String(input || "").trim();
  const lower = prompt.toLowerCase();
  if (!prompt) return "Ask one clear GM question and I will generate table-ready options.";
  if (/^(hi|hello|hey|yo)\b/.test(lower) || lower.includes("how are you")) {
    return [
      "Hey. I am ready.",
      "Tell me what you want right now:",
      "- prep plan",
      "- encounter idea",
      "- NPC or quest help",
      "- cleanup of rough notes",
    ].join("\n");
  }
  if (/\b(who|what)\s+are\s+you\b/.test(lower)) {
    return [
      "I am your DM Helper Loremaster running on your local AI setup.",
      "I can help with hooks, session prep, encounters, NPCs, quests, and note cleanup.",
      "Ask me for one specific thing and I will draft it in table-ready format.",
    ].join("\n");
  }
  if (/\bwhat can you do\b/.test(lower) || /^help\b/.test(lower)) {
    return [
      "I can help right now with:",
      "- Session hook ideas",
      "- Encounter setup (objective, obstacle, consequence)",
      "- NPC or quest drafts",
      "- Cleanup of rough notes into clean prep text",
    ].join("\n");
  }

  if (
    lower.includes("hook") ||
    lower.includes("where to start") ||
    lower.includes("start this") ||
    lower.includes("start the game") ||
    lower.includes("not sure where to start")
  ) {
    return [
      "Try one of these opening hooks:",
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
    "Quick answer:",
    ensureSentence(prompt),
    "Turn this into one immediate scene objective, one obstacle, and one consequence.",
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
      "Open PDF Intel and run Index PDFs, then ask again.",
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
    lines.push("Note: these come from saved campaign index metadata. Re-index in PDF Intel to load full live text context.");
  }
  lines.push("If a book is not in this indexed list, I do not have access to it.");
  return lines.join("\n");
}

function collectPdfContextForAi(query, limit = 6) {
  const searchParts = buildSearchParts(query);
  const longWords = searchParts.words.filter((word) => word.length >= 4);
  if (!longWords.length && !searchParts.phrase) return [];
  const aiSearchParts = {
    phrase: searchParts.phrase,
    words: longWords,
  };

  const ranked = [];
  for (const file of pdfIndexCache.files) {
    const pages = getIndexedPages(file);
    for (const page of pages) {
      const match = scoreTextAgainstQuery(page.textLower, aiSearchParts);
      if (!match.score) continue;
      ranked.push({
        fileName: file.fileName,
        page: page.page,
        score: match.score,
        snippet: makeSnippet(page.text, match.firstHit),
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName) || a.page - b.page);
  return ranked.slice(0, Math.max(1, Math.min(limit, 12)));
}
