import { isLiveCampaignRecord } from "./kingmakerFlow";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function liveRecords(records = []) {
  return (Array.isArray(records) ? records : []).filter(isLiveCampaignRecord);
}

function intValue(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clipText(value, limit = 180) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function trimTrailingSeparators(value) {
  return stringValue(value).replace(/[\\/]+$/, "");
}

function detectSeparator(basePath) {
  return stringValue(basePath).includes("\\") ? "\\" : "/";
}

function joinDisplayPath(basePath, relativePath) {
  const cleanBase = trimTrailingSeparators(basePath);
  const cleanRelative = stringValue(relativePath).replace(/^[\\/]+/, "");
  if (!cleanBase) return cleanRelative;
  if (!cleanRelative) return cleanBase;
  const separator = detectSeparator(cleanBase);
  return `${cleanBase}${separator}${cleanRelative.replace(/[\\/]+/g, separator)}`;
}

export function formatVaultTimestamp(value) {
  const stamp = Date.parse(String(value || ""));
  if (!Number.isFinite(stamp)) return "Never";
  return new Date(stamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function normalizeVaultSettingsDraft(raw = {}, fallback = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const base = fallback && typeof fallback === "object" ? fallback : {};
  return {
    vaultPath: stringValue(source.vaultPath ?? base.vaultPath),
    baseFolder: stringValue(source.baseFolder ?? base.baseFolder) || "Kingmaker Companion",
    lastSyncAt: stringValue(source.lastSyncAt ?? base.lastSyncAt),
    lastSyncSummary: stringValue(source.lastSyncSummary ?? base.lastSyncSummary),
    looksLikeVault: source.looksLikeVault == null ? base.looksLikeVault === true : source.looksLikeVault === true,
    useForAiContext: source.useForAiContext == null ? base.useForAiContext !== false : source.useForAiContext !== false,
    readWholeVault: source.readWholeVault == null ? base.readWholeVault !== false : source.readWholeVault !== false,
    aiContextNoteLimit: Math.max(1, Math.min(12, intValue(source.aiContextNoteLimit ?? base.aiContextNoteLimit, 6))),
    aiContextCharLimit: Math.max(800, Math.min(12000, intValue(source.aiContextCharLimit ?? base.aiContextCharLimit, 3600))),
    aiWriteFolder: stringValue(source.aiWriteFolder ?? base.aiWriteFolder) || "AI Notes",
    lastAiNoteAt: stringValue(source.lastAiNoteAt ?? base.lastAiNoteAt),
    lastAiNotePath: stringValue(source.lastAiNotePath ?? base.lastAiNotePath),
  };
}

export function buildVaultRootPreview(settings) {
  const normalized = normalizeVaultSettingsDraft(settings, settings);
  return normalized.vaultPath ? joinDisplayPath(normalized.vaultPath, normalized.baseFolder) : "";
}

export function buildVaultAbsolutePath(vaultPath, relativePath) {
  return joinDisplayPath(vaultPath, relativePath);
}

function getVaultStatus(settings) {
  if (!stringValue(settings?.vaultPath)) return "Not Set";
  return settings?.looksLikeVault ? "Ready" : "Folder Selected";
}

function getContextModeLabel(settings) {
  if (settings?.useForAiContext === false) return "Manual Only";
  return settings?.readWholeVault === false ? "Campaign Folder" : "Whole Vault";
}

export function buildVaultSyncPayload(campaign, settingsOverride = {}) {
  const normalizedSettings = normalizeVaultSettingsDraft(settingsOverride, campaign?.meta?.obsidian);
  return {
    vaultPath: normalizedSettings.vaultPath,
    baseFolder: normalizedSettings.baseFolder,
    campaignName: stringValue(campaign?.meta?.campaignName) || "Kingmaker",
    storyFocus: campaign?.meta?.storyFocus || {},
    sessions: Array.isArray(campaign?.sessions) ? campaign.sessions : [],
    npcs: liveRecords(campaign?.npcs),
    companions: liveRecords(campaign?.companions),
    quests: liveRecords(campaign?.quests),
    events: liveRecords(campaign?.events),
    locations: liveRecords(campaign?.locations),
    kingdom: campaign?.kingdom || {},
    hexMap: campaign?.hexMap || {},
    liveCapture: Array.isArray(campaign?.liveCapture) ? campaign.liveCapture : [],
    referenceCounts: {
      npcs: Math.max(0, (Array.isArray(campaign?.npcs) ? campaign.npcs.length : 0) - liveRecords(campaign?.npcs).length),
      companions: Math.max(0, (Array.isArray(campaign?.companions) ? campaign.companions.length : 0) - liveRecords(campaign?.companions).length),
      quests: Math.max(0, (Array.isArray(campaign?.quests) ? campaign.quests.length : 0) - liveRecords(campaign?.quests).length),
      events: Math.max(0, (Array.isArray(campaign?.events) ? campaign.events.length : 0) - liveRecords(campaign?.events).length),
      locations: Math.max(0, (Array.isArray(campaign?.locations) ? campaign.locations.length : 0) - liveRecords(campaign?.locations).length),
    },
  };
}

export function buildVaultSyncModel(campaign) {
  const settings = normalizeVaultSettingsDraft(campaign?.meta?.obsidian, campaign?.meta?.obsidian);
  const rootPreview = buildVaultRootPreview(settings);
  const lastSyncSummary = clipText(settings.lastSyncSummary, 150);

  return {
    settings,
    rootPreview,
    summaryCards: [
      {
        label: "Vault Status",
        value: getVaultStatus(settings),
        helper: settings.vaultPath
          ? settings.looksLikeVault
            ? "Selected folder looks like a real Obsidian vault."
            : "Folder selected, but no .obsidian directory has been detected yet."
          : "Choose a vault folder to unlock sync, context preview, and note writing.",
        valueTone: "compact",
      },
      {
        label: "Sync Root",
        value: settings.baseFolder || "Kingmaker Companion",
        helper: rootPreview || "The Kingmaker campaign folder will be created inside the selected vault.",
        valueTone: "compact",
      },
      {
        label: "AI Context",
        value: getContextModeLabel(settings),
        helper:
          settings.useForAiContext === false
            ? "Context preview is still available here, but Companion AI will ignore vault notes until re-enabled."
            : `${settings.aiContextNoteLimit} notes / ${settings.aiContextCharLimit} chars / ${settings.readWholeVault ? "whole vault" : "campaign folder only"}`,
        valueTone: "compact",
      },
      {
        label: "Last Sync",
        value: formatVaultTimestamp(settings.lastSyncAt),
        helper: lastSyncSummary || "Sync writes confirmed table state by default; Kingmaker reference records stay in the app until activated.",
        valueTone: settings.lastSyncAt ? "compact" : "auto",
      },
    ],
  };
}
