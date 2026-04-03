import { useEffect, useRef, useState } from "react";
import { ActionIcon, Badge, Button, Grid, Group, Paper, Select, Slider, Stack, Switch, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import {
  HEX_MAP_FORCE_TYPES,
  HEX_MAP_MARKER_TYPES,
  HEX_MAP_SITE_CATEGORY_OPTIONS,
  HEX_MAP_STATUS_OPTIONS,
  HEX_MAP_TERRAIN_OPTIONS,
  HEX_MARKER_ICON_LIBRARY,
  buildHexMapModel,
  buildHexPolygonPoints,
  centerHexMapViewportOnHex,
  clampHexMapViewport,
  getDefaultHexMarkerIconId,
  getBoardPointFromClientPoint,
  getHexCenter,
  getHexCoordinateAtBoardPoint,
  getHexForceVisual,
  getHexMapBackgroundPlacement,
  getHexMapViewBox,
  getHexMarkerIconDefinition,
  getHexSiteCategoryVisual,
  getHexStatusColor,
  getMarkerIconOptionsForType,
  getHexColumnLabel,
  parseHexCoordinate,
} from "../lib/hexmap";

const MARKER_TYPE_OPTIONS = HEX_MAP_MARKER_TYPES.map((value) => ({ value, label: value }));
const FORCE_TYPE_OPTIONS = HEX_MAP_FORCE_TYPES.map((value) => ({ value, label: value }));
const TERRAIN_OPTIONS = HEX_MAP_TERRAIN_OPTIONS.map((value) => ({ value, label: value }));
const STATUS_OPTIONS = HEX_MAP_STATUS_OPTIONS.map((value) => ({ value, label: value }));
const SITE_CATEGORY_OPTIONS = HEX_MAP_SITE_CATEGORY_OPTIONS.map((value) => ({
  value,
  label: value || "None",
}));

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function createSettingsDraft(hexMap) {
  return {
    mapName: hexMap?.mapName || "",
    columns: String(hexMap?.columns ?? 12),
    rows: String(hexMap?.rows ?? 10),
    hexSize: String(hexMap?.hexSize ?? 54),
    showLabels: hexMap?.showLabels !== false,
    backgroundOpacity: Number(hexMap?.backgroundOpacity ?? 0.78),
    backgroundScale: Number(hexMap?.backgroundScale ?? 1),
    backgroundOffsetX: String(hexMap?.backgroundOffsetX ?? 0),
    backgroundOffsetY: String(hexMap?.backgroundOffsetY ?? 0),
    gridFillOpacity: Number(hexMap?.gridFillOpacity ?? 0.32),
    gridLineOpacity: Number(hexMap?.gridLineOpacity ?? 0.54),
  };
}

function createRegionDraft(selectedHex, region) {
  return {
    hex: selectedHex,
    status: region?.status || "Claimed",
    terrain: region?.terrain || "",
    siteCategory: region?.siteCategory || "",
    workSite: region?.workSite || "",
    discovery: region?.discovery || "",
    kingdomValue: region?.kingdomValue || "",
    danger: region?.danger || "",
    improvement: region?.improvement || "",
    rumor: region?.rumor || "",
    notes: region?.notes || "",
  };
}

function createMarkerDraft(selectedHex) {
  return {
    hex: selectedHex,
    type: "Building",
    icon: "camp",
    title: "",
    notes: "",
  };
}

function createForceDraft(selectedHex) {
  return {
    hex: selectedHex,
    type: "Enemy Force",
    name: "",
    notes: "",
  };
}

function createPartyDraft(party) {
  return {
    label: party?.label || "Charter Party",
    notes: party?.notes || "",
  };
}

function getClosestHexAttribute(target) {
  return target?.closest?.("[data-hex]")?.getAttribute("data-hex") || "";
}

function isRegionDraftDirty(draft, baseline) {
  return [
    "status",
    "terrain",
    "siteCategory",
    "workSite",
    "discovery",
    "kingdomValue",
    "danger",
    "improvement",
    "rumor",
    "notes",
  ].some((key) => stringValue(draft?.[key]) !== stringValue(baseline?.[key]));
}

function formatStamp(value) {
  const ms = Date.parse(String(value || ""));
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function IconChip({ definition, active, onClick, onDragStart, onDragEnd }) {
  return (
    <button
      type="button"
      className={`km-hexmap-icon-chip ${active ? "is-active" : ""}`}
      onClick={onClick}
      draggable
      data-marker-icon={definition.id}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="km-hexmap-icon-chip__glyph" style={{ "--chip-accent": definition.color }}>
        <definition.Icon size={18} stroke={1.9} />
      </span>
      <span>{definition.label}</span>
    </button>
  );
}

function RecordList({ title, emptyMessage, items, renderItem }) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text className="km-section-kicker">{title}</Text>
        <Badge variant="outline">{items.length}</Badge>
      </Group>
      {items.length ? items.map(renderItem) : <Text c="dimmed">{emptyMessage}</Text>}
    </Stack>
  );
}

export default function HexMapPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const [selectedHex, setSelectedHex] = useState("");
  const model = buildHexMapModel(campaign, selectedHex);
  const stageShellRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickUntilRef = useRef(0);
  const [viewport, setViewport] = useState(() => ({
    zoom: model.hexMap.zoom,
    panX: model.hexMap.panX,
    panY: model.hexMap.panY,
  }));
  const [settingsDraft, setSettingsDraft] = useState(() => createSettingsDraft(model.hexMap));
  const [regionDraft, setRegionDraft] = useState(() => createRegionDraft(model.selectedHex, model.selectedRegion));
  const [markerDraft, setMarkerDraft] = useState(() => createMarkerDraft(model.selectedHex));
  const [forceDraft, setForceDraft] = useState(() => createForceDraft(model.selectedHex));
  const [partyDraft, setPartyDraft] = useState(() => createPartyDraft(model.party));
  const [inspectorTab, setInspectorTab] = useState("hex");
  const [markerPlacementMode, setMarkerPlacementMode] = useState(false);
  const [boardHoverHex, setBoardHoverHex] = useState("");
  const [isDraggingMarkerPalette, setIsDraggingMarkerPalette] = useState(false);

  useEffect(() => {
    setSelectedHex(model.selectedHex);
  }, [model.selectedHex]);

  useEffect(() => {
    setViewport({
      zoom: model.hexMap.zoom,
      panX: model.hexMap.panX,
      panY: model.hexMap.panY,
    });
  }, [model.hexMap.zoom, model.hexMap.panX, model.hexMap.panY]);

  useEffect(() => {
    setSettingsDraft(createSettingsDraft(model.hexMap));
  }, [
    model.hexMap.mapName,
    model.hexMap.columns,
    model.hexMap.rows,
    model.hexMap.hexSize,
    model.hexMap.showLabels,
    model.hexMap.backgroundOpacity,
    model.hexMap.backgroundScale,
    model.hexMap.backgroundOffsetX,
    model.hexMap.backgroundOffsetY,
    model.hexMap.gridFillOpacity,
    model.hexMap.gridLineOpacity,
  ]);

  useEffect(() => {
    setRegionDraft(createRegionDraft(model.selectedHex, model.selectedRegion));
    setMarkerDraft(createMarkerDraft(model.selectedHex));
    setForceDraft(createForceDraft(model.selectedHex));
  }, [model.selectedHex, model.selectedRegion?.updatedAt]);

  useEffect(() => {
    setPartyDraft(createPartyDraft(model.party));
  }, [model.party?.label, model.party?.notes]);

  useEffect(() => {
    if (inspectorTab === "markers") return;
    setMarkerPlacementMode(false);
  }, [inspectorTab]);

  useEffect(() => {
    if (
      viewport.zoom === model.hexMap.zoom &&
      viewport.panX === model.hexMap.panX &&
      viewport.panY === model.hexMap.panY
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      actions.saveHexMapViewport(viewport);
    }, 160);

    return () => window.clearTimeout(timer);
  }, [actions, model.hexMap.panX, model.hexMap.panY, model.hexMap.zoom, viewport]);

  useEffect(() => {
    const validIcons = getMarkerIconOptionsForType(markerDraft.type);
    if (validIcons.some((entry) => entry.id === markerDraft.icon)) return;
    setMarkerDraft((current) => ({
      ...current,
      icon: getDefaultHexMarkerIconId(current.type),
    }));
  }, [markerDraft.icon, markerDraft.type]);

  const viewHexMap = {
    ...model.hexMap,
    zoom: viewport.zoom,
    panX: viewport.panX,
    panY: viewport.panY,
  };
  const regionDraftBaseline = createRegionDraft(model.selectedHex, model.selectedRegion);
  const previewingRegionDraft = isRegionDraftDirty(regionDraft, regionDraftBaseline);
  const activeSelectedRegion = previewingRegionDraft
    ? {
        ...(model.selectedRegion || {}),
        ...regionDraft,
        hex: model.selectedHex,
      }
    : model.selectedRegion;
  const boardRegionMap = new Map(model.regionMap);
  if (activeSelectedRegion) {
    boardRegionMap.set(model.selectedHex, activeSelectedRegion);
  }
  const viewBox = getHexMapViewBox(viewHexMap);
  const backgroundPlacement = model.hexMap.backgroundUrl ? getHexMapBackgroundPlacement(model.hexMap) : null;
  const markerIconOptions = getMarkerIconOptionsForType(markerDraft.type);
  const activeMarkerDefinition = getHexMarkerIconDefinition(markerDraft.icon, markerDraft.type);

  const getHexFromClientPoint = (clientX, clientY) => {
    if (!stageShellRef.current) return "";
    const rect = stageShellRef.current.getBoundingClientRect();
    const boardPoint = getBoardPointFromClientPoint(clientX, clientY, rect, viewHexMap);
    return getHexCoordinateAtBoardPoint(boardPoint.x, boardPoint.y, viewHexMap);
  };

  const buildPlacedMarkerDraft = (hex, overrides = {}) => {
    const nextType = stringValue(overrides.type || markerDraft.type) || "Note";
    const nextIcon = stringValue(overrides.icon || markerDraft.icon) || getDefaultHexMarkerIconId(nextType);
    const definition = getHexMarkerIconDefinition(nextIcon, nextType);
    return {
      ...markerDraft,
      ...overrides,
      hex,
      type: nextType,
      icon: nextIcon,
      title: stringValue(overrides.title || markerDraft.title) || definition.label,
      notes: overrides.notes == null ? markerDraft.notes : overrides.notes,
    };
  };

  const placeMarkerAtHex = (hex, overrides = {}, source = "board") => {
    const created = actions.addHexMapMarker(buildPlacedMarkerDraft(hex, overrides));
    setSelectedHex(created.hex);
    setMarkerDraft((current) => ({
      ...current,
      hex: created.hex,
      type: created.type,
      icon: created.icon,
      title: "",
      notes: "",
    }));
    notifications.show({
      color: "moss",
      title: "Marker placed",
      message:
        source === "drag"
          ? `${created.title} was dropped onto ${created.hex}.`
          : `${created.title} was placed on ${created.hex}.`,
    });
    return created;
  };

  const handleHexActivate = (hex) => {
    if (!hex || Date.now() < suppressClickUntilRef.current) return;
    setSelectedHex(hex);
    if (markerPlacementMode) {
      placeMarkerAtHex(hex);
      setMarkerPlacementMode(false);
      return;
    }
    if (model.hexMap.partyMoveMode) {
      actions.moveHexMapParty({
        hex,
        label: partyDraft.label,
        notes: partyDraft.notes,
      });
    }
  };

  const setViewportState = (nextViewport) => {
    setViewport(clampHexMapViewport({ ...viewHexMap, ...nextViewport }));
  };

  const fitBoard = () => {
    setViewportState({ zoom: 1, panX: 0, panY: 0 });
  };

  const centerOnHex = (hex) => {
    setViewportState(centerHexMapViewportOnHex(hex, viewHexMap));
  };

  const applyWheelZoom = (event) => {
    if (!stageShellRef.current) return;
    const rect = stageShellRef.current.getBoundingClientRect();
    const oldView = getHexMapViewBox(viewHexMap);
    const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const anchorX = oldView.x + (offsetX / Math.max(1, rect.width)) * oldView.width;
    const anchorY = oldView.y + (offsetY / Math.max(1, rect.height)) * oldView.height;
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Number((viewport.zoom * factor).toFixed(2));
    const nextView = clampHexMapViewport({
      ...viewHexMap,
      zoom: nextZoom,
    });
    const nextViewBox = getHexMapViewBox({
      ...viewHexMap,
      zoom: nextView.zoom,
      panX: nextView.panX,
      panY: nextView.panY,
    });
    setViewportState({
      zoom: nextView.zoom,
      panX: anchorX - (offsetX / Math.max(1, rect.width)) * nextViewBox.width,
      panY: anchorY - (offsetY / Math.max(1, rect.height)) * nextViewBox.height,
    });
  };

  const handlePointerDown = (event) => {
    if ((event.button !== 0 && event.button !== 2) || !stageShellRef.current) return;
    event.preventDefault();
    const rect = stageShellRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      button: event.button,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startHex: getClosestHexAttribute(event.target),
      startPanX: viewport.panX,
      startPanY: viewport.panY,
      viewWidth: viewBox.width,
      viewHeight: viewBox.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      didDrag: false,
    };
    stageShellRef.current.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    event.preventDefault();
    const deltaClientX = event.clientX - dragRef.current.startClientX;
    const deltaClientY = event.clientY - dragRef.current.startClientY;
    if (Math.abs(deltaClientX) > 4 || Math.abs(deltaClientY) > 4) {
      dragRef.current.didDrag = true;
      stageShellRef.current?.classList.add("is-dragging");
    }
    const boardDeltaX = deltaClientX * (dragRef.current.viewWidth / Math.max(1, dragRef.current.rectWidth));
    const boardDeltaY = deltaClientY * (dragRef.current.viewHeight / Math.max(1, dragRef.current.rectHeight));
    setViewportState({
      panX: dragRef.current.startPanX - boardDeltaX,
      panY: dragRef.current.startPanY - boardDeltaY,
    });
  };

  const finishPointerSession = (event) => {
    const pointerSession = dragRef.current;
    if (!pointerSession) return;
    stageShellRef.current?.classList.remove("is-dragging");
    stageShellRef.current?.releasePointerCapture?.(pointerSession.pointerId);
    if (pointerSession.didDrag) {
      suppressClickUntilRef.current = Date.now() + 180;
    } else if (pointerSession.button === 0 && event?.clientX != null && event?.clientY != null) {
      handleHexActivate(pointerSession.startHex || getClosestHexAttribute(event.target) || getHexFromClientPoint(event.clientX, event.clientY));
    }
    dragRef.current = null;
  };

  const handleWheel = (event) => {
    event.preventDefault();
    event.stopPropagation();
    applyWheelZoom(event);
  };

  useEffect(() => {
    const shell = stageShellRef.current;
    if (!shell) return undefined;

    const nativeWheelListener = (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyWheelZoom(event);
    };

    shell.addEventListener("wheel", nativeWheelListener, { passive: false });
    return () => {
      shell.removeEventListener("wheel", nativeWheelListener);
    };
  }, [model.hexMap, viewport]);

  const handleStageDragOver = (event) => {
    if (!isDraggingMarkerPalette) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setBoardHoverHex(getHexFromClientPoint(event.clientX, event.clientY));
  };

  const handleStageDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setBoardHoverHex("");
  };

  const handleStageDrop = (event) => {
    const payload = event.dataTransfer?.getData("application/x-kingmaker-marker");
    setBoardHoverHex("");
    setIsDraggingMarkerPalette(false);
    if (!payload) return;
    event.preventDefault();

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      parsedPayload = {};
    }

    const hex = getHexFromClientPoint(event.clientX, event.clientY);
    if (!hex) {
      notifications.show({
        color: "gray",
        title: "Drop onto a hex",
        message: "Drag the icon onto a specific hex cell to place it.",
      });
      return;
    }

    placeMarkerAtHex(
      hex,
      {
        type: parsedPayload.type,
        icon: parsedPayload.icon,
      },
      "drag"
    );
  };

  const handleSaveSettings = (event) => {
    event.preventDefault();
    actions.saveHexMapSettings(settingsDraft);
    notifications.show({
      color: "moss",
      title: "Map settings saved",
      message: `${settingsDraft.mapName || "Hex map"} display settings were updated.`,
    });
  };

  const handleChooseBackground = async () => {
    try {
      const result = await actions.pickHexMapBackground();
      if (!result) return;
      notifications.show({
        color: "moss",
        title: "Background loaded",
        message: `${result.name} is ready to align under the grid.`,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Background load failed",
        message: stringValue(error?.message || error),
      });
    }
  };

  const handleSaveRegion = (event) => {
    event.preventDefault();
    const saved = actions.addHexMapRegion(regionDraft);
    notifications.show({
      color: "moss",
      title: "Hex record saved",
      message: `${saved.hex} now has an updated region record.`,
    });
  };

  const handleClearRegion = () => {
    const removed = actions.clearHexMapRegion(model.selectedHex);
    notifications.show({
      color: removed ? "moss" : "gray",
      title: removed ? "Hex record cleared" : "No record to clear",
      message: removed ? `${model.selectedHex} was removed from kingdom regions.` : `${model.selectedHex} does not have a saved region record.`,
    });
  };

  const handleAddMarker = (event) => {
    event.preventDefault();
    const created = actions.addHexMapMarker(markerDraft);
    setMarkerDraft((current) => ({
      ...current,
      hex: created.hex,
      type: created.type,
      icon: created.icon,
      title: "",
      notes: "",
    }));
    notifications.show({
      color: "moss",
      title: "Marker placed",
      message: `${created.title} was added to ${created.hex}.`,
    });
  };

  const handleAddForce = (event) => {
    event.preventDefault();
    const created = actions.addHexMapForce(forceDraft);
    setForceDraft(createForceDraft(model.selectedHex));
    notifications.show({
      color: "moss",
      title: "Force marker placed",
      message: `${created.name} was added to ${created.hex}.`,
    });
  };

  const handleMarkerChipClick = (iconId) => {
    setMarkerDraft((current) => ({ ...current, icon: iconId }));
  };

  const handleLegendMarkerSelect = (entry) => {
    setMarkerDraft((current) => ({
      ...current,
      hex: model.selectedHex,
      type: entry.type,
      icon: entry.id,
      title: current.title || entry.label,
    }));
    setInspectorTab("markers");
    setMarkerPlacementMode(true);
    notifications.show({
      color: "moss",
      title: "Marker ready",
      message: `Click a hex to place ${entry.label}, or open the Markers tab to customize it first.`,
    });
  };

  const handleLegendPlaceOnSelectedHex = (entry) => {
    placeMarkerAtHex(
      model.selectedHex,
      {
        type: entry.type,
        icon: entry.id,
        title: entry.label,
      },
      "legend"
    );
    setInspectorTab("markers");
  };

  const handleMarkerChipDragStart = (event, iconId) => {
    const payload = JSON.stringify({
      type: markerDraft.type,
      icon: iconId,
    });
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-kingmaker-marker", payload);
    event.dataTransfer.setData("text/plain", payload);
    setMarkerDraft((current) => ({ ...current, icon: iconId }));
    setIsDraggingMarkerPalette(true);
    setInspectorTab("markers");
  };

  const handleMarkerChipDragEnd = () => {
    setIsDraggingMarkerPalette(false);
    setBoardHoverHex("");
  };

  const handleMoveParty = () => {
    const party = actions.moveHexMapParty({
      hex: model.selectedHex,
      label: partyDraft.label,
      notes: partyDraft.notes,
    });
    notifications.show({
      color: "moss",
      title: "Party moved",
      message: `${party.label} is now marked in ${party.hex}.`,
    });
  };

  const renderLinkedEntry = (title, subtitle, detail, key) => (
    <Paper key={key} className="km-record-card">
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start">
          <Text fw={600}>{title}</Text>
          {subtitle ? <Badge variant="outline">{subtitle}</Badge> : null}
        </Group>
        {detail ? <Text c="dimmed">{detail}</Text> : null}
      </Stack>
    </Paper>
  );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="World"
        title="Hex Map"
        description="Run exploration, discovery, travel pressure, and kingdom expansion from one board. The map is grounded in Kingmaker's landmark, resource, standard, and secret encounter rhythm."
        actions={
          <>
            <Button variant="default" onClick={() => navigate("/world/kingdom")}>
              Open Kingdom
            </Button>
            <Button color={model.hexMap.partyMoveMode ? "ember" : "moss"} onClick={() => actions.setHexMapPartyMoveMode(!model.hexMap.partyMoveMode)}>
              {model.hexMap.partyMoveMode ? "Stop Click-Move" : "Enable Click-Move"}
            </Button>
          </>
        }
      />

      <Grid gutter="lg">
        {model.summaryCards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, md: 6, xl: 3 }}>
            <MetricCard label={card.label} value={card.value} helper={card.helper} valueTone={card.valueTone} />
          </Grid.Col>
        ))}
      </Grid>

      <Grid gutter="lg" align="flex-start" className="km-hexmap-layout">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper className="km-panel km-hexmap-board-panel">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <div>
                  <Text className="km-section-kicker">Stolen Lands Board</Text>
                  <Title order={3}>{model.hexMap.mapName}</Title>
                  <Text c="dimmed">
                    {model.metrics.columns} columns / {model.metrics.rows} rows / selected {model.selectedHex}
                  </Text>
                </div>
                <Group gap="xs" wrap="wrap">
                  <Badge color="moss" variant="light">
                    {model.regionMap.size} mapped hexes
                  </Badge>
                  <Badge variant="outline">{model.hexMap.markers.length} markers</Badge>
                  <Badge variant="outline">{model.hexMap.forces.length} forces</Badge>
                  <Badge variant="outline">Zoom {Math.round(viewport.zoom * 100)}%</Badge>
                </Group>
              </Group>

              <Group gap="sm" wrap="wrap" className="km-toolbar-wrap">
                <Button variant="default" onClick={handleChooseBackground}>
                  Choose Background
                </Button>
                <Button variant="light" onClick={() => actions.recenterHexMapBackground()} disabled={!model.hexMap.backgroundUrl}>
                  Recenter Background
                </Button>
                <Button variant="light" onClick={() => centerOnHex(model.party.hex)} disabled={!model.party.hex}>
                  Center On Party
                </Button>
                <Button variant="light" onClick={() => centerOnHex(model.selectedHex)}>
                  Center On Selected
                </Button>
                <Button variant="light" onClick={fitBoard}>
                  Fit Board
                </Button>
                <ActionIcon variant="default" size="lg" aria-label="Zoom out" onClick={() => setViewportState({ zoom: viewport.zoom * 0.89 })}>
                  <IconMinus size={18} />
                </ActionIcon>
                <ActionIcon variant="default" size="lg" aria-label="Zoom in" onClick={() => setViewportState({ zoom: viewport.zoom * 1.12 })}>
                  <IconPlus size={18} />
                </ActionIcon>
                {markerPlacementMode ? (
                  <Badge color="moss" variant="light">
                    Click a hex to place {activeMarkerDefinition.label}
                  </Badge>
                ) : null}
                {isDraggingMarkerPalette && boardHoverHex ? (
                  <Badge color="gold" variant="light">
                    Drop on {boardHoverHex}
                  </Badge>
                ) : null}
              </Group>

              <div
                ref={stageShellRef}
                className={`km-hexmap-stage-shell ${markerPlacementMode || isDraggingMarkerPalette ? "is-placement-mode" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerSession}
                onPointerCancel={finishPointerSession}
                onPointerLeave={finishPointerSession}
                onWheel={handleWheel}
                onContextMenu={(event) => event.preventDefault()}
                onDragOver={handleStageDragOver}
                onDragLeave={handleStageDragLeave}
                onDrop={handleStageDrop}
              >
                <svg
                  className="km-hexmap-stage"
                  viewBox={`${viewBox.x.toFixed(2)} ${viewBox.y.toFixed(2)} ${viewBox.width.toFixed(2)} ${viewBox.height.toFixed(2)}`}
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Interactive Kingmaker hex map"
                >
                  <rect x="0" y="0" width={viewBox.boardWidth} height={viewBox.boardHeight} fill="#f7f1e5" />
                  {model.hexMap.backgroundUrl && backgroundPlacement ? (
                    <image
                      href={model.hexMap.backgroundUrl}
                      x={backgroundPlacement.x}
                      y={backgroundPlacement.y}
                      width={backgroundPlacement.width}
                      height={backgroundPlacement.height}
                      preserveAspectRatio="none"
                      opacity={model.hexMap.backgroundOpacity}
                    />
                  ) : null}

                  {model.party.trail?.length > 0 ? (
                    <g className="km-hexmap-trail-layer">
                      {(() => {
                        const points = (model.party.trail || [])
                          .slice(0, 12)
                          .reverse()
                          .map((entry) => {
                            const parsed = parseHexCoordinate(entry.hex);
                            if (!parsed) return null;
                            return getHexCenter(parsed.columnIndex, parsed.rowIndex, viewHexMap);
                          })
                          .filter(Boolean);
                        if (!points.length) return null;
                        return (
                          <>
                            {points.length > 1 ? (
                              <polyline
                                className="km-hexmap-trail-line"
                                points={points.map((entry) => `${entry.cx.toFixed(2)},${entry.cy.toFixed(2)}`).join(" ")}
                              />
                            ) : null}
                            {points.map((entry, index) => (
                              <circle
                                key={`trail-${entry.cx}-${entry.cy}-${index}`}
                                className={`km-hexmap-trail-dot ${index === points.length - 1 ? "is-current" : ""}`}
                                cx={entry.cx}
                                cy={entry.cy}
                                r={index === points.length - 1 ? 7 : 4}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </g>
                  ) : null}

                  {Array.from({ length: model.metrics.columns }).map((_, columnIndex) =>
                    Array.from({ length: model.metrics.rows }).map((__, rowIndex) => {
                      const hex = `${getHexColumnLabel(columnIndex)}${rowIndex + 1}`;
                      const center = getHexCenter(columnIndex, rowIndex, viewHexMap);
                      const region = boardRegionMap.get(hex) || null;
                      const markers = model.markersByHex.get(hex) || [];
                      const forces = model.forcesByHex.get(hex) || [];
                      const siteCategoryVisual = getHexSiteCategoryVisual(region?.siteCategory);
                      const isSelected = model.selectedHex === hex;
                      const isPartyHex = model.party.hex === hex;
                      const isDropTarget = boardHoverHex === hex;
                      const markerOffsetBase = center.cx - (Math.max(0, markers.length - 1) * 21) / 2;
                      const forceOffsetBase = center.cx - (Math.max(0, forces.length - 1) * 24) / 2;
                      return (
                        <g
                          key={hex}
                          className={`km-hexmap-cell-group ${isSelected ? "is-selected" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
                          data-hex={hex}
                        >
                          <polygon
                            className={`km-hexmap-cell ${isSelected ? "is-selected" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
                            points={buildHexPolygonPoints(center.cx, center.cy, model.metrics.size)}
                            fill={getHexStatusColor(region?.status || "")}
                            style={{
                              "--hex-fill-opacity": model.hexMap.gridFillOpacity,
                              "--hex-stroke-opacity": model.hexMap.gridLineOpacity,
                            }}
                          />
                          {isSelected ? (
                            <g className="km-hexmap-selection-group">
                              <polygon
                                className="km-hexmap-selection-ring"
                                points={buildHexPolygonPoints(center.cx, center.cy, model.metrics.size + 5)}
                              />
                              <circle
                                cx={center.cx + model.metrics.size * 0.52}
                                cy={center.cy - model.metrics.size * 0.58}
                                r="8"
                                className="km-hexmap-selection-dot"
                              />
                            </g>
                          ) : null}
                          {model.hexMap.showLabels ? (
                            <text x={center.cx} y={center.cy - 4} className={`km-hexmap-label ${isSelected ? "is-selected" : ""}`}>
                              {hex}
                            </text>
                          ) : null}
                          {region?.workSite ? (
                            <text x={center.cx} y={center.cy + 15} className="km-hexmap-sub-label">
                              {region.workSite}
                            </text>
                          ) : null}

                          {siteCategoryVisual ? (
                            <g className="km-hexmap-site-category-group">
                              <circle
                                cx={center.cx + model.metrics.size * 0.48}
                                cy={center.cy - model.metrics.size * 0.3}
                                r="10.5"
                                className="km-hexmap-site-category-bubble"
                                fill={siteCategoryVisual.color}
                              />
                              <svg
                                x={center.cx + model.metrics.size * 0.48 - 7}
                                y={center.cy - model.metrics.size * 0.3 - 7}
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                className="km-hexmap-inline-icon"
                              >
                                <siteCategoryVisual.Icon size={14} stroke={2.1} />
                              </svg>
                            </g>
                          ) : null}

                          {isPartyHex ? (
                            <g className="km-hexmap-party-group">
                              <circle cx={center.cx} cy={center.cy - model.metrics.size * 0.52} r="14" className="km-hexmap-party-marker" />
                              <text x={center.cx} y={center.cy - model.metrics.size * 0.52 + 4} className="km-hexmap-party-label">
                                P
                              </text>
                            </g>
                          ) : null}

                          {forces.slice(0, 3).map((force, index) => {
                            const visual = getHexForceVisual(force.type);
                            return (
                              <g key={force.id} className="km-hexmap-force-group">
                                <rect
                                  x={forceOffsetBase + index * 24 - 11}
                                  y={center.cy - model.metrics.size * 0.12 - 12}
                                  width="22"
                                  height="22"
                                  rx="7"
                                  className="km-hexmap-force-marker"
                                  fill={visual.color}
                                />
                                <svg
                                  x={forceOffsetBase + index * 24 - 8}
                                  y={center.cy - model.metrics.size * 0.12 - 9}
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  className="km-hexmap-inline-icon"
                                >
                                  <visual.Icon size={16} stroke={1.9} />
                                </svg>
                              </g>
                            );
                          })}

                          {markers.slice(0, 4).map((marker, index) => {
                            const definition = getHexMarkerIconDefinition(marker.icon, marker.type);
                            return (
                              <g key={marker.id} className="km-hexmap-marker-group">
                                <circle
                                  cx={markerOffsetBase + index * 21}
                                  cy={center.cy + model.metrics.size * 0.56}
                                  r="9.5"
                                  fill={definition.color}
                                  className="km-hexmap-marker-bubble"
                                />
                                <svg
                                  x={markerOffsetBase + index * 21 - 7}
                                  y={center.cy + model.metrics.size * 0.56 - 7}
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  className="km-hexmap-inline-icon"
                                >
                                  <definition.Icon size={14} stroke={2.1} />
                                </svg>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })
                  )}
                </svg>
              </div>

              <Tabs.Root defaultValue="display" className="km-radix-tabs">
                <Tabs.List className="km-radix-list" aria-label="Hex map board panels">
                  <Tabs.Trigger value="display" className="km-radix-trigger">
                    Display
                  </Tabs.Trigger>
                  <Tabs.Trigger value="legend" className="km-radix-trigger">
                    Legend
                  </Tabs.Trigger>
                  <Tabs.Trigger value="travel" className="km-radix-trigger">
                    Exploration Cues
                  </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="display" className="km-radix-content">
                  <Paper className="km-panel km-content-panel">
                    <form onSubmit={handleSaveSettings}>
                      <Stack gap="md">
                        <Grid gutter="md">
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <TextInput
                              label="Map name"
                              value={settingsDraft.mapName}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, mapName: event.currentTarget.value }))}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 4, md: 2 }}>
                            <TextInput
                              type="number"
                              label="Columns"
                              value={settingsDraft.columns}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, columns: event.currentTarget.value }))}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 4, md: 2 }}>
                            <TextInput
                              type="number"
                              label="Rows"
                              value={settingsDraft.rows}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, rows: event.currentTarget.value }))}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 4, md: 2 }}>
                            <TextInput
                              type="number"
                              label="Hex size"
                              value={settingsDraft.hexSize}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, hexSize: event.currentTarget.value }))}
                            />
                          </Grid.Col>
                        </Grid>

                        <Switch
                          checked={settingsDraft.showLabels}
                          onChange={(event) => setSettingsDraft((current) => ({ ...current, showLabels: event.currentTarget.checked }))}
                          label="Show hex labels on the board"
                        />

                        <Grid gutter="lg">
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <Stack gap={6}>
                              <Text size="sm">Background opacity</Text>
                              <Slider
                                min={0}
                                max={0.95}
                                step={0.05}
                                value={settingsDraft.backgroundOpacity}
                                onChange={(value) => setSettingsDraft((current) => ({ ...current, backgroundOpacity: value }))}
                              />
                            </Stack>
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <Stack gap={6}>
                              <Text size="sm">Background scale</Text>
                              <Slider
                                min={0.4}
                                max={3.5}
                                step={0.05}
                                value={settingsDraft.backgroundScale}
                                onChange={(value) => setSettingsDraft((current) => ({ ...current, backgroundScale: value }))}
                              />
                            </Stack>
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <Stack gap={6}>
                              <Text size="sm">Grid fill opacity</Text>
                              <Slider
                                min={0}
                                max={0.65}
                                step={0.05}
                                value={settingsDraft.gridFillOpacity}
                                onChange={(value) => setSettingsDraft((current) => ({ ...current, gridFillOpacity: value }))}
                              />
                            </Stack>
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <Stack gap={6}>
                              <Text size="sm">Grid line opacity</Text>
                              <Slider
                                min={0.15}
                                max={1}
                                step={0.05}
                                value={settingsDraft.gridLineOpacity}
                                onChange={(value) => setSettingsDraft((current) => ({ ...current, gridLineOpacity: value }))}
                              />
                            </Stack>
                          </Grid.Col>
                        </Grid>

                        <Grid gutter="md">
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <TextInput
                              type="number"
                              label="Background offset X"
                              value={settingsDraft.backgroundOffsetX}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, backgroundOffsetX: event.currentTarget.value }))}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <TextInput
                              type="number"
                              label="Background offset Y"
                              value={settingsDraft.backgroundOffsetY}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, backgroundOffsetY: event.currentTarget.value }))}
                            />
                          </Grid.Col>
                        </Grid>

                        <Group gap="sm">
                          <Button type="submit" color="moss">
                            Save Display Settings
                          </Button>
                          <Button type="button" variant="light" onClick={() => actions.clearHexMapBackground()} disabled={!model.hexMap.backgroundUrl}>
                            Clear Background
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  </Paper>
                </Tabs.Content>

                <Tabs.Content value="legend" className="km-radix-content">
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="lg">
                      <Paper className="km-record-card km-hexmap-placement-card">
                        <Stack gap={8}>
                          <Text fw={600}>Legend And Placement</Text>
                          <Text c="dimmed">
                            These icons are now usable. Click any legend row to arm placement, then click a hex on the board.
                          </Text>
                          <Text size="sm" c="dimmed">
                            If you already have the right hex selected, use the row button to place the icon directly on {model.selectedHex}.
                          </Text>
                        </Stack>
                      </Paper>
                      <RecordList
                        title="Marker Icons"
                        emptyMessage="No marker icons are available."
                        items={HEX_MARKER_ICON_LIBRARY}
                        renderItem={(entry) => (
                          <div
                            key={entry.id}
                            className={`km-hexmap-legend-row ${markerDraft.icon === entry.id ? "is-active" : ""}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleLegendMarkerSelect(entry)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleLegendMarkerSelect(entry);
                              }
                            }}
                          >
                            <span className="km-hexmap-legend-swatch" style={{ "--chip-accent": entry.color }}>
                              <entry.Icon size={18} stroke={1.9} />
                            </span>
                            <div className="km-hexmap-legend-copy">
                              <Text fw={600}>{entry.label}</Text>
                              <Text size="sm" c="dimmed">
                                {entry.type}
                              </Text>
                            </div>
                            <Button
                              type="button"
                              variant="light"
                              color="moss"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleLegendPlaceOnSelectedHex(entry);
                              }}
                            >
                              Place On {model.selectedHex}
                            </Button>
                          </div>
                        )}
                      />
                    </Stack>
                  </Paper>
                </Tabs.Content>

                <Tabs.Content value="travel" className="km-radix-content">
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Text className="km-section-kicker">Adventure Path Guidance</Text>
                      <div className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>
                          <strong>Landmark</strong> sites are visible from adjacent open hexes and are discovered automatically on travel.
                        </Text>
                      </div>
                      <div className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>
                          <strong>Resource</strong> sites matter later for kingdom growth, so flag them even if the party finds them before founding the realm.
                        </Text>
                      </div>
                      <div className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>
                          <strong>Standard</strong> sites are discovered on Reconnoiter, or on Travel if the terrain is open.
                        </Text>
                      </div>
                      <div className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>
                          <strong>Secret</strong> sites should stay hidden until the party takes a specific action, hears the right rumor, or finds the right clue.
                        </Text>
                      </div>
                      <Text c="dimmed">
                        Source cues: Kingmaker Adventure Path pp. 44-48, plus the kingdom turn cadence in the Player&apos;s Guide.
                      </Text>
                    </Stack>
                  </Paper>
                </Tabs.Content>
              </Tabs.Root>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper className="km-panel km-hexmap-inspector">
            <Stack gap="lg">
              <div>
                <Text className="km-section-kicker">Selected Hex</Text>
                <Title order={3}>{model.selectedHex}</Title>
                <Group gap="xs" mt="xs" wrap="wrap">
                  <Badge color="moss" variant="light">
                    {activeSelectedRegion?.status || "No region record"}
                  </Badge>
                  <Badge variant="outline">{activeSelectedRegion?.terrain || "Terrain unset"}</Badge>
                  {activeSelectedRegion?.siteCategory ? <Badge variant="outline">{activeSelectedRegion.siteCategory}</Badge> : null}
                </Group>
              </div>

              <div className="km-hexmap-inspector-summary">
                <Paper className="km-record-card">
                  <Text className="km-hexmap-summary-label">Discovery</Text>
                  <Text>{activeSelectedRegion?.discovery || "Nothing logged yet."}</Text>
                </Paper>
                <Paper className="km-record-card">
                  <Text className="km-hexmap-summary-label">Kingdom Value</Text>
                  <Text>{activeSelectedRegion?.kingdomValue || "No work site or resource value recorded yet."}</Text>
                </Paper>
                <Paper className="km-record-card">
                  <Text className="km-hexmap-summary-label">Danger</Text>
                  <Text>{activeSelectedRegion?.danger || "No danger note recorded."}</Text>
                </Paper>
              </div>

              <Tabs.Root value={inspectorTab} onValueChange={setInspectorTab} className="km-radix-tabs">
                <Tabs.List className="km-radix-list km-hexmap-inspector-tabs" aria-label="Hex inspector panels">
                  <Tabs.Trigger value="hex" className="km-radix-trigger">
                    Hex Record
                  </Tabs.Trigger>
                  <Tabs.Trigger value="markers" className="km-radix-trigger">
                    Markers
                  </Tabs.Trigger>
                  <Tabs.Trigger value="party" className="km-radix-trigger">
                    Party
                  </Tabs.Trigger>
                  <Tabs.Trigger value="links" className="km-radix-trigger">
                    Links
                  </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="hex" className="km-radix-content">
                  <Paper className="km-panel km-content-panel">
                    <form onSubmit={handleSaveRegion}>
                      <Stack gap="md">
                        <Grid gutter="md">
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <TextInput label="Hex" value={regionDraft.hex} readOnly />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <Select label="Status" value={regionDraft.status} onChange={(value) => setRegionDraft((current) => ({ ...current, status: value || "Claimed" }))} data={STATUS_OPTIONS} />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <Select searchable label="Terrain" value={regionDraft.terrain} onChange={(value) => setRegionDraft((current) => ({ ...current, terrain: value || "" }))} data={TERRAIN_OPTIONS} />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <Select label="Encounter type" value={regionDraft.siteCategory} onChange={(value) => setRegionDraft((current) => ({ ...current, siteCategory: value || "" }))} data={SITE_CATEGORY_OPTIONS} />
                          </Grid.Col>
                        </Grid>

                        <TextInput label="Discovery" value={regionDraft.discovery} onChange={(event) => setRegionDraft((current) => ({ ...current, discovery: event.currentTarget.value }))} placeholder="Oleg's Trading Post, fey ring, monster den..." />
                        <TextInput label="Kingdom value" value={regionDraft.kingdomValue} onChange={(event) => setRegionDraft((current) => ({ ...current, kingdomValue: event.currentTarget.value }))} placeholder="Lumber, farmland, road anchor, rumor base..." />
                        <Grid gutter="md">
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <TextInput label="Danger" value={regionDraft.danger} onChange={(event) => setRegionDraft((current) => ({ ...current, danger: event.currentTarget.value }))} placeholder="Bandits, trolls, fey mischief..." />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 6 }}>
                            <TextInput label="Improvement" value={regionDraft.improvement} onChange={(event) => setRegionDraft((current) => ({ ...current, improvement: event.currentTarget.value }))} placeholder="Road, fort, camp, farm..." />
                          </Grid.Col>
                        </Grid>
                        <TextInput label="Work site" value={regionDraft.workSite} onChange={(event) => setRegionDraft((current) => ({ ...current, workSite: event.currentTarget.value }))} placeholder="Lumber camp, mine, watchtower..." />
                        <Textarea autosize minRows={2} label="Rumor" value={regionDraft.rumor} onChange={(event) => setRegionDraft((current) => ({ ...current, rumor: event.currentTarget.value }))} placeholder="What rumor points players toward this hex?" />
                        <Textarea autosize minRows={4} label="Hex notes" value={regionDraft.notes} onChange={(event) => setRegionDraft((current) => ({ ...current, notes: event.currentTarget.value }))} placeholder="Why it matters, what changes here, and what escalates next." />

                        <Group gap="sm">
                          <Button type="submit" color="moss">
                            Save Hex Record
                          </Button>
                          <Button type="button" variant="light" color="red" onClick={handleClearRegion}>
                            Clear Record
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  </Paper>
                </Tabs.Content>

                <Tabs.Content value="markers" className="km-radix-content">
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="lg">
                      <form onSubmit={handleAddMarker}>
                        <Stack gap="md">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Place Marker</Text>
                            <Group gap="xs">
                              <Badge variant="outline">{model.selectedHex}</Badge>
                              <Button
                                type="button"
                                variant={markerPlacementMode ? "filled" : "light"}
                                color={markerPlacementMode ? "moss" : "gray"}
                                onClick={() => setMarkerPlacementMode((current) => !current)}
                              >
                                {markerPlacementMode ? "Cancel Click Place" : "Click Place On Map"}
                              </Button>
                            </Group>
                          </Group>
                          <Paper className="km-record-card km-hexmap-placement-card">
                            <Stack gap={8}>
                              <Text fw={600}>Placement Workflow</Text>
                              <Text c="dimmed">
                                Pick a marker type, then either drag an icon chip onto the board or arm click placement and select a hex.
                              </Text>
                              <Text size="sm" c="dimmed">
                                Active icon: {activeMarkerDefinition.label}
                              </Text>
                            </Stack>
                          </Paper>
                          <Grid gutter="md">
                            <Grid.Col span={{ base: 12, md: 6 }}>
                              <Select label="Marker type" value={markerDraft.type} onChange={(value) => setMarkerDraft((current) => ({ ...current, type: value || "Note", icon: getDefaultHexMarkerIconId(value || "Note") }))} data={MARKER_TYPE_OPTIONS} />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                              <TextInput label="Marker title" value={markerDraft.title} onChange={(event) => setMarkerDraft((current) => ({ ...current, title: event.currentTarget.value }))} placeholder="Bandit camp, ore seam, hidden shrine..." />
                            </Grid.Col>
                          </Grid>
                          <div className="km-hexmap-icon-grid">
                            {markerIconOptions.map((entry) => (
                              <IconChip
                                key={entry.id}
                                definition={entry}
                                active={markerDraft.icon === entry.id}
                                onClick={() => handleMarkerChipClick(entry.id)}
                                onDragStart={(event) => handleMarkerChipDragStart(event, entry.id)}
                                onDragEnd={handleMarkerChipDragEnd}
                              />
                            ))}
                          </div>
                          <Textarea autosize minRows={3} label="Marker notes" value={markerDraft.notes} onChange={(event) => setMarkerDraft((current) => ({ ...current, notes: event.currentTarget.value }))} placeholder="What the players find here, or what this marker should remind you to run." />
                          <Button type="submit" color="moss">
                            Add Marker
                          </Button>
                        </Stack>
                      </form>

                      <RecordList
                        title={`Markers in ${model.selectedHex}`}
                        emptyMessage="No icon markers in this hex yet."
                        items={model.selectedMarkers}
                        renderItem={(marker) => {
                          const definition = getHexMarkerIconDefinition(marker.icon, marker.type);
                          return (
                            <Paper key={marker.id} className="km-record-card">
                              <Stack gap="sm">
                                <Group justify="space-between" align="flex-start">
                                  <Group gap="sm" align="center">
                                    <span className="km-hexmap-legend-swatch" style={{ "--chip-accent": definition.color }}>
                                      <definition.Icon size={18} stroke={1.9} />
                                    </span>
                                    <div>
                                      <Text fw={600}>{marker.title}</Text>
                                      <Text size="sm" c="dimmed">
                                        {marker.type}
                                      </Text>
                                    </div>
                                  </Group>
                                  <ActionIcon variant="light" color="red" onClick={() => actions.removeHexMapMarker(marker.id)} aria-label={`Delete ${marker.title}`}>
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Group>
                                {marker.notes ? <Text c="dimmed">{marker.notes}</Text> : null}
                              </Stack>
                            </Paper>
                          );
                        }}
                      />

                      <form onSubmit={handleAddForce}>
                        <Stack gap="md">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Place Force</Text>
                            <Badge variant="outline">{model.selectedHex}</Badge>
                          </Group>
                          <Grid gutter="md">
                            <Grid.Col span={{ base: 12, md: 6 }}>
                              <Select label="Force type" value={forceDraft.type} onChange={(value) => setForceDraft((current) => ({ ...current, type: value || "Allied Force" }))} data={FORCE_TYPE_OPTIONS} />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                              <TextInput label="Force name" value={forceDraft.name} onChange={(event) => setForceDraft((current) => ({ ...current, name: event.currentTarget.value }))} placeholder="Bandit scouts, ally patrol, caravan..." />
                            </Grid.Col>
                          </Grid>
                          <Textarea autosize minRows={3} label="Force notes" value={forceDraft.notes} onChange={(event) => setForceDraft((current) => ({ ...current, notes: event.currentTarget.value }))} placeholder="Commander, goal, strength, route, or countdown." />
                          <Button type="submit" color="moss">
                            Add Force Marker
                          </Button>
                        </Stack>
                      </form>

                      <RecordList
                        title={`Forces in ${model.selectedHex}`}
                        emptyMessage="No force markers in this hex yet."
                        items={model.selectedForces}
                        renderItem={(force) => {
                          const visual = getHexForceVisual(force.type);
                          return (
                            <Paper key={force.id} className="km-record-card">
                              <Stack gap="sm">
                                <Group justify="space-between" align="flex-start">
                                  <Group gap="sm" align="center">
                                    <span className="km-hexmap-legend-swatch" style={{ "--chip-accent": visual.color }}>
                                      <visual.Icon size={18} stroke={1.9} />
                                    </span>
                                    <div>
                                      <Text fw={600}>{force.name}</Text>
                                      <Text size="sm" c="dimmed">
                                        {force.type}
                                      </Text>
                                    </div>
                                  </Group>
                                  <ActionIcon variant="light" color="red" onClick={() => actions.removeHexMapForce(force.id)} aria-label={`Delete ${force.name}`}>
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Group>
                                {force.notes ? <Text c="dimmed">{force.notes}</Text> : null}
                              </Stack>
                            </Paper>
                          );
                        }}
                      />
                    </Stack>
                  </Paper>
                </Tabs.Content>

                <Tabs.Content value="party" className="km-radix-content">
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Group justify="space-between" align="center">
                        <Text className="km-section-kicker">Party Tracker</Text>
                        <Badge color="moss" variant="light">
                          {model.party.hex || "Off map"}
                        </Badge>
                      </Group>
                      <TextInput label="Party label" value={partyDraft.label} onChange={(event) => setPartyDraft((current) => ({ ...current, label: event.currentTarget.value }))} />
                      <Textarea autosize minRows={4} label="Party notes" value={partyDraft.notes} onChange={(event) => setPartyDraft((current) => ({ ...current, notes: event.currentTarget.value }))} placeholder="Objective, companion mix, weather hit, or camp condition." />
                      <Group gap="sm" wrap="wrap">
                        <Button color="moss" onClick={handleMoveParty}>
                          Move Party To {model.selectedHex}
                        </Button>
                        <Button variant="light" onClick={() => centerOnHex(model.party.hex)} disabled={!model.party.hex}>
                          Center On Party
                        </Button>
                        <Button variant="light" onClick={() => actions.clearHexMapPartyTrail()} disabled={!model.party.trail?.length}>
                          Clear Trail
                        </Button>
                        <Button variant="light" color="red" onClick={() => actions.clearHexMapParty()} disabled={!model.party.hex}>
                          Clear Party Marker
                        </Button>
                      </Group>

                      <RecordList
                        title="Recent Party Route"
                        emptyMessage="No party trail is recorded yet."
                        items={model.party.trail || []}
                        renderItem={(entry, index) => (
                          <Paper key={`${entry.hex}-${entry.at}-${index}`} className="km-record-card">
                            <Group justify="space-between" align="center">
                              <div>
                                <Text fw={600}>
                                  {entry.hex}
                                  {index === 0 ? " (latest)" : ""}
                                </Text>
                                {entry.at ? <Text size="sm" c="dimmed">{formatStamp(entry.at)}</Text> : null}
                              </div>
                              <Button variant="subtle" onClick={() => centerOnHex(entry.hex)}>
                                Focus
                              </Button>
                            </Group>
                          </Paper>
                        )}
                      />
                    </Stack>
                  </Paper>
                </Tabs.Content>

                <Tabs.Content value="links" className="km-radix-content">
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="lg">
                      <RecordList title="Locations" emptyMessage={`No locations currently point at ${model.selectedHex}.`} items={model.linkedLocations} renderItem={(location) => renderLinkedEntry(location.name || "Unnamed Location", location.hex, location.whatChanged || location.notes, location.id)} />
                      <RecordList title="Quests" emptyMessage={`No quests currently point at ${model.selectedHex}.`} items={model.linkedQuests} renderItem={(quest) => renderLinkedEntry(quest.title || "Untitled Quest", quest.status, quest.nextBeat || quest.objective, quest.id)} />
                      <RecordList title="Events" emptyMessage={`No events currently point at ${model.selectedHex}.`} items={model.linkedEvents} renderItem={(eventItem) => renderLinkedEntry(eventItem.title || "Untitled Event", eventItem.status, eventItem.consequenceSummary || eventItem.fallout || eventItem.trigger, eventItem.id)} />
                      <RecordList title="Companions" emptyMessage={`No companions are currently tracked in ${model.selectedHex}.`} items={model.linkedCompanions} renderItem={(companion) => renderLinkedEntry(companion.name || "Unnamed Companion", companion.status, companion.personalQuest || companion.notes, companion.id)} />
                    </Stack>
                  </Paper>
                </Tabs.Content>
              </Tabs.Root>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
