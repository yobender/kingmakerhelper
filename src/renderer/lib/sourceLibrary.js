import sourceManifest from "../../../kingmaker-source-manifest.json";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAudience(value) {
  const normalized = stringValue(value).replace(/-/g, " ");
  return normalized ? normalized.replace(/\b\w/g, (match) => match.toUpperCase()) : "Unknown";
}

function formatRole(value) {
  const normalized = stringValue(value).replace(/-/g, " ");
  return normalized ? normalized.replace(/\b\w/g, (match) => match.toUpperCase()) : "Unknown";
}

function formatFileSize(bytes) {
  const amount = numberValue(bytes, 0);
  if (amount <= 0) return "Unknown size";
  if (amount >= 1024 * 1024) return `${(amount / (1024 * 1024)).toFixed(1)} MB`;
  if (amount >= 1024) return `${Math.round(amount / 1024)} KB`;
  return `${amount} B`;
}

function mapIndexedFiles(indexedFiles, pdfSummaries) {
  const indexedSet = new Set((Array.isArray(indexedFiles) ? indexedFiles : []).map((entry) => stringValue(entry).toLowerCase()).filter(Boolean));
  const summaryMap = pdfSummaries && typeof pdfSummaries === "object" && !Array.isArray(pdfSummaries) ? pdfSummaries : {};

  return (Array.isArray(sourceManifest?.canonicalSources) ? sourceManifest.canonicalSources : []).map((source) => {
    const aliases = Array.isArray(source?.aliases) ? source.aliases.map((entry) => stringValue(entry)).filter(Boolean) : [];
    const allNames = [stringValue(source?.fileName), ...aliases].filter(Boolean);
    const indexed = allNames.some((name) => indexedSet.has(name.toLowerCase()));
    const summaryEntry = allNames
      .map((name) => summaryMap[name] || summaryMap[name.toLowerCase()] || null)
      .find(Boolean);

    return {
      id: stringValue(source?.id),
      displayTitle: stringValue(source?.displayTitle || source?.fileName || "Untitled Source"),
      fileName: stringValue(source?.fileName),
      aliases,
      audience: stringValue(source?.audience),
      audienceLabel: formatAudience(source?.audience),
      role: stringValue(source?.role),
      roleLabel: formatRole(source?.role),
      description: stringValue(source?.description),
      pages: numberValue(source?.pages, 0),
      sizeBytes: numberValue(source?.sizeBytes, 0),
      sizeLabel: formatFileSize(source?.sizeBytes),
      appBuckets: Array.isArray(source?.appBuckets) ? source.appBuckets.map((entry) => stringValue(entry)).filter(Boolean) : [],
      sections: Array.isArray(source?.sections) ? source.sections : [],
      indexed,
      summary: summaryEntry?.summary || "",
      summaryUpdatedAt: stringValue(summaryEntry?.updatedAt),
    };
  });
}

export function buildSourceLibraryModel(campaign) {
  const meta = campaign?.meta || {};
  const indexedFiles = Array.isArray(meta.pdfIndexedFiles) ? meta.pdfIndexedFiles : [];
  const pdfSummaries = meta.pdfSummaries && typeof meta.pdfSummaries === "object" ? meta.pdfSummaries : {};
  const sources = mapIndexedFiles(indexedFiles, pdfSummaries);
  const indexedSources = sources.filter((entry) => entry.indexed);
  const summarizedSources = sources.filter((entry) => stringValue(entry.summary));
  const playerSafeSources = sources.filter((entry) => stringValue(entry.audience) === "player" || stringValue(entry.audience) === "table" || stringValue(entry.audience) === "mixed");

  return {
    generatedAt: stringValue(sourceManifest?.generatedAt),
    sourceFolder: stringValue(sourceManifest?.sourceFolder),
    sourceNotes: Array.isArray(sourceManifest?.sourceNotes) ? sourceManifest.sourceNotes.map((entry) => stringValue(entry)).filter(Boolean) : [],
    sources,
    indexedSources,
    summarizedSources,
    playerSafeSources,
    summaryCards: [
      {
        label: "Canonical Sources",
        value: `${sources.length}`,
        helper: sources[0] ? `${sources[0].displayTitle} / ${sources[0].roleLabel}` : "No canonical source manifest loaded.",
        valueTone: "number",
      },
      {
        label: "Indexed Books",
        value: `${indexedSources.length}`,
        helper: indexedSources[0] ? `${indexedSources[0].displayTitle} / ${indexedSources[0].pages} pages` : "No canonical book has been indexed in the desktop library yet.",
        valueTone: "number",
      },
      {
        label: "GM Briefs Ready",
        value: `${summarizedSources.length}`,
        helper: summarizedSources[0] ? `${summarizedSources[0].displayTitle} / summary saved` : "No persistent PDF summary is saved yet.",
        valueTone: "number",
      },
      {
        label: "Player-Safe Sources",
        value: `${playerSafeSources.length}`,
        helper: playerSafeSources[0] ? `${playerSafeSources[0].displayTitle} / ${playerSafeSources[0].audienceLabel}` : "No player-safe source entry is available.",
        valueTone: "number",
      },
    ],
  };
}
