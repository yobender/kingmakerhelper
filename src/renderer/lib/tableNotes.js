import { toGolarionOrdinal } from "./golarion";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function sortSessions(left, right) {
  const delta = toGolarionOrdinal(right?.date) - toGolarionOrdinal(left?.date);
  if (delta !== 0) return delta;
  return String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || ""));
}

function sortCaptureEntries(left, right) {
  const delta = Date.parse(String(right?.timestamp || "")) - Date.parse(String(left?.timestamp || ""));
  if (Number.isFinite(delta) && delta !== 0) return delta;
  return String(right?.id || "").localeCompare(String(left?.id || ""));
}

export function formatCaptureTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isNaN(parsed)) return "Unknown time";
  return new Date(parsed).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildTableNotesModel(state) {
  const sessions = [...(state.sessions || [])].sort(sortSessions);
  const latestSession = sessions[0] || null;
  const entries = [...(state.liveCapture || [])].sort(sortCaptureEntries);
  const linkedEntries = entries.filter((entry) => stringValue(entry.sessionId));
  const rulingEntries = entries.filter((entry) => {
    const kind = stringValue(entry.kind).toLowerCase();
    return kind === "rule" || kind === "retcon";
  });
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));

  return {
    sessions,
    latestSession,
    entries,
    linkedEntries,
    rulingEntries,
    sessionMap,
    defaultSessionId: latestSession?.id || "",
  };
}

export function getCaptureSearchText(entry, sessionMap) {
  return [
    entry?.kind,
    entry?.note,
    sessionMap.get(entry?.sessionId)?.title,
  ]
    .map((value) => stringValue(value))
    .join(" ")
    .toLowerCase();
}

export function getAppendableCaptureEntries(entries, sessionId) {
  const targetSessionId = stringValue(sessionId);
  if (!targetSessionId) return [];
  return entries.filter((entry) => !stringValue(entry.sessionId) || stringValue(entry.sessionId) === targetSessionId).slice(0, 20);
}
