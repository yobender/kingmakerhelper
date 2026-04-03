import {
  IconAlertTriangle,
  IconBuilding,
  IconBuildingFortress,
  IconCampfire,
  IconCoin,
  IconCrown,
  IconFish,
  IconFlag,
  IconHome2,
  IconMapPin,
  IconPaw,
  IconPick,
  IconShield,
  IconSkull,
  IconSword,
  IconSwords,
  IconTent,
  IconTower,
  IconTrees,
  IconWheat,
} from "@tabler/icons-react";
export const HEX_MAP_MARKER_TYPES = ["Encounter", "Building", "Event", "Settlement", "Resource", "Danger", "Note"];
export const HEX_MAP_FORCE_TYPES = ["Allied Force", "Enemy Force", "Caravan"];
export const HEX_MAP_STATUS_OPTIONS = ["Unclaimed", "Reconnoitered", "Claimed", "Work Site", "Settlement", "Contested"];
export const HEX_MAP_TERRAIN_OPTIONS = ["Plains", "Forest", "Hills", "Mountains", "Marsh", "River", "Lake", "Ruins", "Road", "Settlement"];
export const HEX_MAP_SITE_CATEGORY_OPTIONS = ["", "Landmark", "Resource", "Standard", "Secret"];

export const HEX_MAP_HEX_SIZE_MIN = 36;
export const HEX_MAP_HEX_SIZE_MAX = 110;
export const HEX_MAP_COLUMNS_MIN = 6;
export const HEX_MAP_COLUMNS_MAX = 24;
export const HEX_MAP_ROWS_MIN = 4;
export const HEX_MAP_ROWS_MAX = 20;
export const HEX_MAP_ZOOM_MIN = 1;
export const HEX_MAP_ZOOM_MAX = 6;
export const HEX_MAP_BACKGROUND_SCALE_MIN = 0.4;
export const HEX_MAP_BACKGROUND_SCALE_MAX = 3.5;

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatTrailTimestamp(value) {
  const ms = Date.parse(String(value || ""));
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const HEX_MARKER_ICON_LIBRARY = Object.freeze([
  {
    id: "encounter",
    label: "Encounter",
    type: "Encounter",
    color: "#8a3c2a",
    Icon: IconSwords,
  },
  {
    id: "camp",
    label: "Camp",
    type: "Building",
    color: "#8f6a3d",
    Icon: IconTent,
  },
  {
    id: "fort",
    label: "Fort",
    type: "Building",
    color: "#7f5b35",
    Icon: IconBuildingFortress,
  },
  {
    id: "tower",
    label: "Watchtower",
    type: "Building",
    color: "#7a6048",
    Icon: IconTower,
  },
  {
    id: "house",
    label: "Homestead",
    type: "Settlement",
    color: "#7b5b40",
    Icon: IconHome2,
  },
  {
    id: "capital",
    label: "Capital",
    type: "Settlement",
    color: "#2f7a63",
    Icon: IconCrown,
  },
  {
    id: "event",
    label: "Story Event",
    type: "Event",
    color: "#9c7b25",
    Icon: IconFlag,
  },
  {
    id: "resource-wood",
    label: "Lumber",
    type: "Resource",
    color: "#3b6b46",
    Icon: IconTrees,
  },
  {
    id: "resource-ore",
    label: "Ore",
    type: "Resource",
    color: "#556070",
    Icon: IconPick,
  },
  {
    id: "resource-farm",
    label: "Farm",
    type: "Resource",
    color: "#b2871d",
    Icon: IconWheat,
  },
  {
    id: "resource-fish",
    label: "Fishery",
    type: "Resource",
    color: "#2f6e90",
    Icon: IconFish,
  },
  {
    id: "resource-coin",
    label: "Trade Value",
    type: "Resource",
    color: "#b37e1f",
    Icon: IconCoin,
  },
  {
    id: "danger",
    label: "Danger",
    type: "Danger",
    color: "#8f2f36",
    Icon: IconAlertTriangle,
  },
  {
    id: "beast",
    label: "Beast Sign",
    type: "Danger",
    color: "#7e5d38",
    Icon: IconPaw,
  },
  {
    id: "death",
    label: "Death Site",
    type: "Danger",
    color: "#5f3e46",
    Icon: IconSkull,
  },
  {
    id: "ruin",
    label: "Ruin",
    type: "Note",
    color: "#6d5a42",
    Icon: IconBuilding,
  },
  {
    id: "note",
    label: "Map Note",
    type: "Note",
    color: "#5e6470",
    Icon: IconMapPin,
  },
]);

export const HEX_FORCE_VISUALS = Object.freeze({
  "Allied Force": {
    color: "#2f7a63",
    label: "Allied Force",
    Icon: IconShield,
  },
  "Enemy Force": {
    color: "#8a2f2f",
    label: "Enemy Force",
    Icon: IconSword,
  },
  Caravan: {
    color: "#a06a22",
    label: "Caravan",
    Icon: IconCampfire,
  },
});

export const HEX_SITE_CATEGORY_VISUALS = Object.freeze({
  Landmark: {
    color: "#2f7a63",
    label: "Landmark",
    Icon: IconFlag,
  },
  Resource: {
    color: "#a06a22",
    label: "Resource",
    Icon: IconPick,
  },
  Standard: {
    color: "#6b5a48",
    label: "Standard",
    Icon: IconMapPin,
  },
  Secret: {
    color: "#5f526c",
    label: "Secret",
    Icon: IconShield,
  },
});

export function getHexMarkerIconDefinition(iconId, markerType = "") {
  const cleanId = stringValue(iconId);
  const direct = HEX_MARKER_ICON_LIBRARY.find((entry) => entry.id === cleanId);
  if (direct) return direct;
  return HEX_MARKER_ICON_LIBRARY.find((entry) => entry.type === stringValue(markerType)) || HEX_MARKER_ICON_LIBRARY.at(-1);
}

export function getDefaultHexMarkerIconId(markerType) {
  return getHexMarkerIconDefinition("", markerType)?.id || "note";
}

export function getMarkerIconOptionsForType(markerType) {
  const cleanType = stringValue(markerType) || "Note";
  return HEX_MARKER_ICON_LIBRARY.filter((entry) => entry.type === cleanType);
}

export function getHexForceVisual(forceType) {
  return HEX_FORCE_VISUALS[stringValue(forceType)] || HEX_FORCE_VISUALS["Allied Force"];
}

export function getHexSiteCategoryVisual(siteCategory) {
  return HEX_SITE_CATEGORY_VISUALS[stringValue(siteCategory)] || null;
}

export function getHexStatusColor(status) {
  const clean = stringValue(status).toLowerCase();
  if (clean === "claimed") return "#4d8f74";
  if (clean === "reconnoitered") return "#d5c187";
  if (clean === "work site") return "#9b6f45";
  if (clean === "settlement") return "#2f7a63";
  if (clean === "contested") return "#b25b47";
  return "#f2ead8";
}

export function getHexColumnLabel(index) {
  let value = Math.max(0, Number.parseInt(String(index || "0"), 10) || 0) + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label || "A";
}

export function getHexColumnIndex(label) {
  const clean = stringValue(label).toUpperCase();
  if (!/^[A-Z]+$/.test(clean)) return -1;
  let total = 0;
  for (const char of clean) {
    total = total * 26 + (char.charCodeAt(0) - 64);
  }
  return total - 1;
}

export function parseHexCoordinate(value) {
  const clean = stringValue(value).toUpperCase().replace(/\s+/g, "");
  const match = clean.match(/^([A-Z]+)[-:]?(\d{1,2})$/);
  if (!match) return null;
  return {
    columnLabel: match[1],
    columnIndex: getHexColumnIndex(match[1]),
    rowIndex: Math.max(0, Number.parseInt(match[2], 10) - 1),
  };
}

export function normalizeHexCoordinate(value, columns = 0, rows = 0) {
  const parsed = parseHexCoordinate(value);
  if (!parsed || parsed.columnIndex < 0 || parsed.rowIndex < 0) return "";
  if (columns && parsed.columnIndex >= columns) return "";
  if (rows && parsed.rowIndex >= rows) return "";
  return `${getHexColumnLabel(parsed.columnIndex)}${parsed.rowIndex + 1}`;
}

export function getHexMapMetrics(hexMap) {
  const size = Math.max(HEX_MAP_HEX_SIZE_MIN, Math.min(HEX_MAP_HEX_SIZE_MAX, Math.trunc(numberValue(hexMap?.hexSize, 54)) || 54));
  const hexWidth = size * 2;
  const hexHeight = Math.sqrt(3) * size;
  const stepX = size * 1.5;
  const margin = size * 1.6;
  const columns = Math.max(HEX_MAP_COLUMNS_MIN, Math.trunc(numberValue(hexMap?.columns, 12)) || 12);
  const rows = Math.max(HEX_MAP_ROWS_MIN, Math.trunc(numberValue(hexMap?.rows, 10)) || 10);
  const boardWidth = margin * 2 + hexWidth + Math.max(0, columns - 1) * stepX;
  const boardHeight = margin * 2 + rows * hexHeight + hexHeight / 2;
  return {
    size,
    hexWidth,
    hexHeight,
    stepX,
    margin,
    columns,
    rows,
    boardWidth,
    boardHeight,
  };
}

export function getHexCenter(columnIndex, rowIndex, hexMap) {
  const metrics = getHexMapMetrics(hexMap);
  return {
    cx: metrics.margin + metrics.size + columnIndex * metrics.stepX,
    cy: metrics.margin + metrics.hexHeight / 2 + rowIndex * metrics.hexHeight + (columnIndex % 2 ? metrics.hexHeight / 2 : 0),
  };
}

export function buildHexPolygonPoints(cx, cy, size) {
  const points = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index);
    points.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}

function isPointInPolygon(pointX, pointY, points = []) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const current = points[index];
    const prior = points[previous];
    const intersects =
      current.y > pointY !== prior.y > pointY &&
      pointX < ((prior.x - current.x) * (pointY - current.y)) / Math.max(0.000001, prior.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function getHexCoordinateAtBoardPoint(boardX, boardY, hexMapLike = {}) {
  const metrics = getHexMapMetrics(hexMapLike);
  if (boardX < 0 || boardY < 0 || boardX > metrics.boardWidth || boardY > metrics.boardHeight) {
    return "";
  }

  for (let columnIndex = 0; columnIndex < metrics.columns; columnIndex += 1) {
    for (let rowIndex = 0; rowIndex < metrics.rows; rowIndex += 1) {
      const center = getHexCenter(columnIndex, rowIndex, hexMapLike);
      const polygon = Array.from({ length: 6 }).map((_, pointIndex) => {
        const angle = (Math.PI / 180) * (60 * pointIndex);
        return {
          x: center.cx + metrics.size * Math.cos(angle),
          y: center.cy + metrics.size * Math.sin(angle),
        };
      });
      if (isPointInPolygon(boardX, boardY, polygon)) {
        return `${getHexColumnLabel(columnIndex)}${rowIndex + 1}`;
      }
    }
  }

  return "";
}

export function getBoardPointFromClientPoint(clientX, clientY, containerRect, hexMapLike = {}) {
  const viewBox = getHexMapViewBox(hexMapLike);
  const offsetX = Math.max(0, Math.min(containerRect.width, clientX - containerRect.left));
  const offsetY = Math.max(0, Math.min(containerRect.height, clientY - containerRect.top));
  return {
    x: viewBox.x + (offsetX / Math.max(1, containerRect.width)) * viewBox.width,
    y: viewBox.y + (offsetY / Math.max(1, containerRect.height)) * viewBox.height,
  };
}

export function clampHexMapViewport(hexMapLike = {}) {
  const metrics = getHexMapMetrics(hexMapLike);
  const zoom = Math.max(HEX_MAP_ZOOM_MIN, Math.min(HEX_MAP_ZOOM_MAX, numberValue(hexMapLike.zoom, 1) || 1));
  const viewWidth = metrics.boardWidth / zoom;
  const viewHeight = metrics.boardHeight / zoom;
  const maxX = Math.max(0, metrics.boardWidth - viewWidth);
  const maxY = Math.max(0, metrics.boardHeight - viewHeight);
  return {
    zoom,
    panX: Math.max(0, Math.min(maxX, numberValue(hexMapLike.panX, 0))),
    panY: Math.max(0, Math.min(maxY, numberValue(hexMapLike.panY, 0))),
  };
}

export function getHexMapViewBox(hexMapLike = {}) {
  const metrics = getHexMapMetrics(hexMapLike);
  const viewport = clampHexMapViewport(hexMapLike);
  return {
    x: viewport.panX,
    y: viewport.panY,
    width: metrics.boardWidth / viewport.zoom,
    height: metrics.boardHeight / viewport.zoom,
    ...metrics,
    ...viewport,
  };
}

export function centerHexMapViewportOnHex(hex, hexMapLike = {}) {
  const parsed = parseHexCoordinate(hex);
  if (!parsed) {
    return clampHexMapViewport(hexMapLike);
  }
  const metrics = getHexMapMetrics(hexMapLike);
  const center = getHexCenter(parsed.columnIndex, parsed.rowIndex, hexMapLike);
  const viewport = clampHexMapViewport(hexMapLike);
  return clampHexMapViewport({
    ...hexMapLike,
    zoom: viewport.zoom,
    panX: center.cx - metrics.boardWidth / (2 * viewport.zoom),
    panY: center.cy - metrics.boardHeight / (2 * viewport.zoom),
  });
}

export function getHexMapBackgroundPlacement(hexMap) {
  const metrics = getHexMapMetrics(hexMap);
  const naturalWidth = Math.max(1, numberValue(hexMap?.backgroundNaturalWidth, metrics.boardWidth));
  const naturalHeight = Math.max(1, numberValue(hexMap?.backgroundNaturalHeight, metrics.boardHeight));
  const fitScale = Math.min(metrics.boardWidth / naturalWidth, metrics.boardHeight / naturalHeight);
  const manualScale = Math.max(
    HEX_MAP_BACKGROUND_SCALE_MIN,
    Math.min(HEX_MAP_BACKGROUND_SCALE_MAX, numberValue(hexMap?.backgroundScale, 1) || 1)
  );
  const width = naturalWidth * fitScale * manualScale;
  const height = naturalHeight * fitScale * manualScale;
  return {
    x: (metrics.boardWidth - width) / 2 + numberValue(hexMap?.backgroundOffsetX, 0),
    y: (metrics.boardHeight - height) / 2 + numberValue(hexMap?.backgroundOffsetY, 0),
    width,
    height,
    fitScale,
    naturalWidth,
    naturalHeight,
  };
}

function dedupeRegionsByHex(regions = []) {
  const sorted = [...regions].sort((left, right) =>
    String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || ""))
  );
  const map = new Map();
  for (const region of sorted) {
    const hex = normalizeHexCoordinate(region?.hex);
    if (!hex || map.has(hex)) continue;
    map.set(hex, region);
  }
  return map;
}

function groupByHex(entries = [], resolver) {
  const map = new Map();
  for (const entry of entries) {
    const hex = normalizeHexCoordinate(resolver(entry));
    if (!hex) continue;
    const bucket = map.get(hex) || [];
    bucket.push(entry);
    map.set(hex, bucket);
  }
  return map;
}

export function getDefaultSelectedHex(campaign, requestedHex = "") {
  const hexMap = campaign?.hexMap || {};
  const candidates = [
    requestedHex,
    hexMap?.party?.hex,
    ...(campaign?.kingdom?.regions || []).map((entry) => entry.hex),
    ...(hexMap?.markers || []).map((entry) => entry.hex),
    "A1",
  ];
  return (
    candidates
      .map((value) => normalizeHexCoordinate(value, hexMap.columns, hexMap.rows))
      .find(Boolean) || "A1"
  );
}

export function buildHexMapModel(campaign, requestedHex = "") {
  const hexMap = campaign?.hexMap || {};
  const selectedHex = getDefaultSelectedHex(campaign, requestedHex);
  const regionMap = dedupeRegionsByHex(campaign?.kingdom?.regions || []);
  const markersByHex = groupByHex(hexMap.markers || [], (entry) => entry.hex);
  const forcesByHex = groupByHex(hexMap.forces || [], (entry) => entry.hex);
  const selectedRegion = regionMap.get(selectedHex) || null;
  const selectedMarkers = markersByHex.get(selectedHex) || [];
  const selectedForces = forcesByHex.get(selectedHex) || [];
  const linkedLocations = (campaign?.locations || []).filter((entry) => normalizeHexCoordinate(entry?.hex) === selectedHex);
  const linkedQuests = (campaign?.quests || []).filter((entry) => normalizeHexCoordinate(entry?.hex) === selectedHex);
  const linkedEvents = (campaign?.events || []).filter((entry) => normalizeHexCoordinate(entry?.hex) === selectedHex);
  const linkedCompanions = (campaign?.companions || []).filter((entry) => normalizeHexCoordinate(entry?.currentHex) === selectedHex);
  const partyTrail = Array.isArray(hexMap?.party?.trail)
    ? hexMap.party.trail.filter((entry) => normalizeHexCoordinate(entry?.hex))
    : [];
  const metrics = getHexMapMetrics(hexMap);

  return {
    hexMap,
    metrics,
    selectedHex,
    selectedRegion,
    selectedMarkers,
    selectedForces,
    linkedLocations,
    linkedQuests,
    linkedEvents,
    linkedCompanions,
    regionMap,
    markersByHex,
    forcesByHex,
    party: hexMap.party || {
      hex: "",
      label: "Charter Party",
      notes: "",
      trail: [],
    },
    trailSummary: partyTrail
      .slice(0, 8)
      .map((entry) => `${entry.hex}${entry.at ? ` • ${formatTrailTimestamp(entry.at)}` : ""}`),
    summaryCards: [
      {
        label: "Selected Hex",
        value: selectedHex,
        helper: selectedRegion?.discovery || selectedRegion?.danger || "Pick a hex to inspect routes, threats, and kingdom value.",
        valueTone: "compact",
      },
      {
        label: "Mapped Footprint",
        value: `${regionMap.size}`,
        helper: `${metrics.columns} x ${metrics.rows} board / ${hexMap.markers?.length || 0} markers placed`,
        valueTone: "number",
      },
      {
        label: "Party Position",
        value: hexMap.party?.hex || "Off Map",
        helper: hexMap.party?.notes || "Move the party marker as expeditions cross the Stolen Lands.",
        valueTone: "compact",
      },
      {
        label: "Open Travel Pressure",
        value: `${linkedEvents.length}`,
        helper: linkedEvents[0]?.title || "No events linked to the selected hex.",
        valueTone: "number",
      },
    ],
  };
}
