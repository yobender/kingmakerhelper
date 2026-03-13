import * as pdfjsLib from "./node_modules/pdfjs-dist/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./node_modules/pdfjs-dist/build/pdf.worker.mjs",
  window.location.href
).toString();

const params = new URLSearchParams(window.location.search);
const targetPath = String(params.get("targetPath") || "").trim();
const fileUrl = String(params.get("fileUrl") || "").trim();
const initialPage = clampPositiveInt(params.get("page"), 1);

const viewerContainer = byId("viewerContainer");
const viewerNode = byId("viewer");
const pageInput = byId("pageInput");
const pageTotal = byId("pageTotal");
const statusText = byId("statusText");
const prevPageBtn = byId("prevPageBtn");
const nextPageBtn = byId("nextPageBtn");

let eventBus = null;
let linkService = null;
let viewer = null;
let EventBus = null;
let PDFLinkService = null;
let PDFViewer = null;

let pdfDocument = null;

boot().catch((err) => {
  console.error(err);
  setStatus(`Advanced viewer failed: ${String(err?.message || err)}. Switching to basic mode...`);
  openBasicFallback();
});

async function boot() {
  await loadAdvancedViewerModules();

  eventBus = new EventBus();
  linkService = new PDFLinkService({ eventBus });
  viewer = new PDFViewer({
    container: viewerContainer,
    viewer: viewerNode,
    eventBus,
    linkService,
    textLayerMode: 2,
  });

  if (!fileUrl && !targetPath) {
    setStatus("No PDF file specified.");
    disableControls();
    return;
  }

  wireEvents();
  setStatus("Loading PDF...");

  const data = await loadPdfData();
  if (!data && !fileUrl) {
    throw new Error("Could not load PDF bytes from disk.");
  }

  const loadingTask = data
    ? pdfjsLib.getDocument({
        data,
        disableWorker: true,
      })
    : pdfjsLib.getDocument({
        url: fileUrl,
        disableWorker: true,
      });
  pdfDocument = await loadingTask.promise;

  eventBus.on("pagesinit", () => {
    viewer.currentScaleValue = "page-width";
    viewer.currentPageNumber = Math.min(initialPage, pdfDocument.numPages);
    syncPageInput();
  });

  viewer.setDocument(pdfDocument);
  linkService.setViewer(viewer);
  linkService.setDocument(pdfDocument, null);

  pageTotal.textContent = `/ ${pdfDocument.numPages}`;
  setStatus("PDF loaded.");
}

async function loadAdvancedViewerModules() {
  setStatus("Loading viewer modules...");
  await import("./node_modules/pdfjs-dist/web/pdf_viewer.mjs");
  const viewerLib = globalThis.pdfjsViewer || {};
  EventBus = viewerLib.EventBus || null;
  PDFLinkService = viewerLib.PDFLinkService || null;
  PDFViewer = viewerLib.PDFViewer || null;

  if (!EventBus || !PDFLinkService || !PDFViewer) {
    throw new Error("PDF viewer modules failed to load.");
  }
}

async function loadPdfData() {
  const reader = window.kmPdfViewer;
  if (!reader || typeof reader.readPdfFile !== "function" || !targetPath) return null;
  try {
    setStatus("Reading PDF file...");
    const bytes = await reader.readPdfFile(targetPath);
    const out = toUint8Array(bytes);
    if (!out || !out.length) {
      throw new Error("PDF bytes were empty.");
    }
    setStatus(`Loaded ${Math.round(out.length / 1024 / 1024)} MB. Rendering...`);
    return out;
  } catch (err) {
    console.warn("PDF byte read failed, falling back to URL load.", err);
    setStatus("Direct file read failed, trying URL load...");
    return null;
  }
}

function wireEvents() {
  prevPageBtn.addEventListener("click", () => {
    if (!pdfDocument) return;
    viewer.currentPageNumber = Math.max(1, viewer.currentPageNumber - 1);
  });

  nextPageBtn.addEventListener("click", () => {
    if (!pdfDocument) return;
    viewer.currentPageNumber = Math.min(pdfDocument.numPages, viewer.currentPageNumber + 1);
  });

  pageInput.addEventListener("change", () => {
    if (!pdfDocument) return;
    const nextPage = clampPositiveInt(pageInput.value, viewer.currentPageNumber);
    viewer.currentPageNumber = Math.min(pdfDocument.numPages, nextPage);
    syncPageInput();
  });

  eventBus.on("pagechanging", () => {
    syncPageInput();
  });
}

function syncPageInput() {
  pageInput.value = String(viewer.currentPageNumber || 1);
}

function setStatus(message) {
  statusText.textContent = String(message || "");
}

function disableControls() {
  for (const node of [prevPageBtn, nextPageBtn, pageInput]) {
    node.disabled = true;
  }
}

function openBasicFallback() {
  if (!fileUrl) {
    setStatus("Basic mode unavailable: missing file URL.");
    disableControls();
    return;
  }

  const fallbackUrl = `${fileUrl}#page=${Math.max(1, initialPage)}`;
  const frame = document.createElement("iframe");
  frame.src = fallbackUrl;
  frame.className = "fallback-frame";
  frame.setAttribute("title", "PDF fallback viewer");
  viewerContainer.innerHTML = "";
  viewerContainer.appendChild(frame);
  disableControls();
  setStatus("Opened in basic mode.");
}

function clampPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function byId(id) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing required node: ${id}`);
  }
  return node;
}

function toUint8Array(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)) {
    return Uint8Array.from(value.data);
  }
  if (Array.isArray(value)) return Uint8Array.from(value);
  return null;
}
