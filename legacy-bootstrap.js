(function bootstrapLegacyWorkspace() {
  const params = new URLSearchParams(window.location.search);
  const rawHash = String(window.location.hash || "").replace(/^#/, "").trim();
  const requestedTab = rawHash.startsWith("tab=") ? rawHash.slice(4) : params.get("tab") || rawHash;

  window.__KINGMAKER_LEGACY_TAB__ = requestedTab;

  window.addEventListener("DOMContentLoaded", () => {
    const returnButton = document.getElementById("legacy-return-btn");
    if (!(returnButton instanceof HTMLButtonElement)) return;

    returnButton.addEventListener("click", () => {
      const current = new URL(window.location.href);
      const target = /^https?:$/.test(current.protocol)
        ? new URL("/", current)
        : new URL("./renderer-dist/index.html", current);
      window.location.assign(target.toString());
    });
  });
})();
