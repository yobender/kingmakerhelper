const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs/promises");

contextBridge.exposeInMainWorld("kmPdfViewer", {
  readPdfFile: async (targetPath) => {
    const safePath = String(targetPath || "").trim();
    if (!safePath) {
      throw new Error("PDF path is required.");
    }

    try {
      const bytes = await fs.readFile(safePath);
      return Uint8Array.from(bytes);
    } catch {
      // Fallback to main-process read if direct preload fs read fails.
      return ipcRenderer.invoke("pdf:read-file-data", safePath);
    }
  },
});
