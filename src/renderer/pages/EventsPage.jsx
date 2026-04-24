import { useEffect, useRef, useState } from "react";
import { Badge, Button, Grid, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Textarea, Title, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconDice5, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useCampaign } from "../context/CampaignContext";
import {
  EVENT_ADVANCE_OPTIONS,
  EVENT_CATEGORY_OPTIONS,
  EVENT_IMPACT_SCOPE_OPTIONS,
  EVENT_STATUS_OPTIONS,
} from "../lib/campaignState";
import { isLiveCampaignRecord } from "../lib/kingmakerFlow";
import {
  buildEventImpactSnapshot,
  buildEventsModel,
  buildEventReferenceLine,
  describeEventImpactSummary,
  formatEventClockSummary,
  getEventTurnsToConsequence,
} from "../lib/events";
import { buildGeneratedEventDraft, getEventTable, resolveEventTableEntry, rollEventTable } from "../lib/eventTables";

const NEW_EVENT_ID = "__new__";

const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All statuses" }, ...EVENT_STATUS_OPTIONS.map((value) => ({ value, label: value }))];
const CATEGORY_FILTER_OPTIONS = [{ value: "all", label: "All categories" }, ...EVENT_CATEGORY_OPTIONS.map((value) => ({ value, label: value }))];
const STATUS_OPTIONS = EVENT_STATUS_OPTIONS.map((value) => ({ value, label: value }));
const CATEGORY_OPTIONS = EVENT_CATEGORY_OPTIONS.map((value) => ({ value, label: value }));
const ADVANCE_OPTIONS = EVENT_ADVANCE_OPTIONS.map((value) => ({ value, label: value }));
const IMPACT_SCOPE_OPTIONS = EVENT_IMPACT_SCOPE_OPTIONS.map((value) => ({ value, label: value }));

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function intValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function createEventDraft(eventItem) {
  const impacts = buildEventImpactSnapshot(eventItem);
  return {
    id: eventItem?.id || "",
    title: eventItem?.title || "",
    folder: eventItem?.folder || "",
    category: eventItem?.category || "story",
    status: eventItem?.status || "seeded",
    urgency: intValue(eventItem?.urgency, 3),
    hex: eventItem?.hex || "",
    linkedQuest: eventItem?.linkedQuest || "",
    linkedCompanion: eventItem?.linkedCompanion || "",
    clock: intValue(eventItem?.clock, 0),
    clockMax: Math.max(1, intValue(eventItem?.clockMax, 4)),
    advancePerTurn: Math.max(0, intValue(eventItem?.advancePerTurn, 1)),
    advanceOn: eventItem?.advanceOn || "manual",
    impactScope: eventItem?.impactScope || "none",
    trigger: eventItem?.trigger || "",
    fallout: eventItem?.fallout || "",
    consequenceSummary: eventItem?.consequenceSummary || "",
    notes: eventItem?.notes || "",
    ...impacts,
  };
}

function normalizeEventDraft(draft) {
  return {
    ...draft,
    urgency: Math.max(1, Math.min(5, intValue(draft?.urgency, 3))),
    hex: stringValue(draft?.hex).replace(/\s+/g, "").toUpperCase(),
    clock: Math.max(0, intValue(draft?.clock, 0)),
    clockMax: Math.max(1, intValue(draft?.clockMax, 4)),
    advancePerTurn: Math.max(0, intValue(draft?.advancePerTurn, 1)),
    ...buildEventImpactSnapshot(draft),
  };
}

function isEventDraftDirty(draft, baseline) {
  const left = normalizeEventDraft(draft);
  const right = normalizeEventDraft(baseline);
  return [
    "title",
    "folder",
    "category",
    "status",
    "urgency",
    "hex",
    "linkedQuest",
    "linkedCompanion",
    "clock",
    "clockMax",
    "advancePerTurn",
    "advanceOn",
    "impactScope",
    "trigger",
    "fallout",
    "consequenceSummary",
    "notes",
    ...Object.keys(buildEventImpactSnapshot()),
  ].some((key) => String(left?.[key] ?? "") !== String(right?.[key] ?? ""));
}

function buildSelectData(values, currentValue, emptyLabel) {
  const data = [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: value,
    }));
  if (currentValue && !data.some((entry) => entry.value === currentValue)) {
    data.unshift({ value: currentValue, label: currentValue });
  }
  return [{ value: "__none__", label: emptyLabel }, ...data];
}

function createGeneratorState(eventItem) {
  return {
    category: eventItem?.category || "story",
    hex: eventItem?.hex || "",
    linkedQuest: eventItem?.linkedQuest || "",
    linkedCompanion: eventItem?.linkedCompanion || "",
  };
}

function pickRandomEntry(entries = []) {
  if (!entries.length) return null;
  const rollIndex = Math.floor(Math.random() * entries.length);
  return {
    entry: entries[rollIndex],
    roll: rollIndex + 1,
    size: entries.length,
  };
}

function EventListItem({ eventItem, active, onSelect }) {
  const turns = getEventTurnsToConsequence(eventItem);

  return (
    <button type="button" className={`km-event-list-item${active ? " is-active" : ""}`} onClick={onSelect}>
      <span className="km-event-list-item__head">
        <span className="km-event-list-item__title">{stringValue(eventItem?.title) || "Untitled Event"}</span>
        <span className="km-event-list-item__meta">{stringValue(eventItem?.status) || "seeded"}</span>
      </span>
      <span className="km-event-list-item__chips">
        <span className="km-companion-chip">{stringValue(eventItem?.category) || "story"}</span>
        <span className="km-companion-chip">Clock {formatEventClockSummary(eventItem)}</span>
        {stringValue(eventItem?.hex) ? <span className="km-companion-chip">{stringValue(eventItem?.hex)}</span> : null}
        {turns == null ? null : <span className="km-companion-chip">{turns} turn(s)</span>}
      </span>
      <span className="km-event-list-item__summary">
        {stringValue(eventItem?.trigger || eventItem?.consequenceSummary || eventItem?.notes)}
      </span>
    </button>
  );
}

function HistoryCard({ entry }) {
  return (
    <Paper className="km-record-card">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <Text fw={700}>{stringValue(entry?.eventTitle) || "Event"}</Text>
          <Text size="sm" c="dimmed">{stringValue(entry?.type) || "note"}</Text>
        </Group>
        <Text size="sm" c="dimmed">{stringValue(entry?.turnTitle || entry?.at)}</Text>
        <Text size="sm">{stringValue(entry?.summary)}</Text>
      </Stack>
    </Paper>
  );
}

export default function EventsPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildEventsModel(campaign);
  const detailPanelRef = useRef(null);
  const [selectedId, setSelectedId] = useState(() => model.activeEvents[0]?.id || model.focusReferenceEvents[0]?.id || model.events[0]?.id || NEW_EVENT_ID);
  const [detailTab, setDetailTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const selectedEvent = model.events.find((entry) => entry.id === selectedId) || null;
  const [draft, setDraft] = useState(() => createEventDraft(selectedEvent));
  const [generator, setGenerator] = useState(() => createGeneratorState(selectedEvent));
  const [rollResult, setRollResult] = useState(null);

  useEffect(() => {
    if (selectedId === NEW_EVENT_ID) return;
    if (selectedEvent) return;
    setSelectedId(model.activeEvents[0]?.id || model.focusReferenceEvents[0]?.id || model.events[0]?.id || NEW_EVENT_ID);
  }, [selectedId, selectedEvent, model.activeEvents, model.focusReferenceEvents, model.events]);

  useEffect(() => {
    if (selectedId === NEW_EVENT_ID) return;
    setDraft(createEventDraft(selectedEvent));
  }, [selectedId, selectedEvent?.updatedAt]);

  const baselineDraft = createEventDraft(selectedEvent);
  const draftDirty = isEventDraftDirty(draft, baselineDraft);
  const impactSummary = describeEventImpactSummary(draft);
  const selectedHistory = [...(campaign.kingdom?.eventHistory || [])]
    .filter((entry) => stringValue(entry?.eventId) === stringValue(selectedEvent?.id))
    .sort((left, right) => String(right?.at || "").localeCompare(String(left?.at || "")))
    .slice(0, 8);
  const visibleEventPool = stringValue(searchValue) ? model.events : [...model.activeEvents, ...model.focusReferenceEvents];
  const filteredEvents = visibleEventPool.filter((entry) => {
    if (statusFilter !== "all" && stringValue(entry?.status) !== statusFilter) return false;
    if (categoryFilter !== "all" && stringValue(entry?.category) !== categoryFilter) return false;
    const haystack = [
      entry?.title,
      entry?.category,
      entry?.status,
      entry?.hex,
      entry?.trigger,
      entry?.fallout,
      entry?.consequenceSummary,
      entry?.notes,
      entry?.folder,
      entry?.linkedQuest,
      entry?.linkedCompanion,
    ]
      .map((value) => stringValue(value).toLowerCase())
      .join(" ");
    return haystack.includes(stringValue(searchValue).toLowerCase());
  });
  const libraryEvents = model.events.filter((entry) => stringValue(entry?.status).toLowerCase() === "library");
  const filteredLibraryEvents = filteredEvents.filter((entry) => stringValue(entry?.status).toLowerCase() === "library");
  const selectedCategoryLibraryEvents = selectedEvent
    ? libraryEvents.filter((entry) => stringValue(entry?.category).toLowerCase() === stringValue(selectedEvent?.category).toLowerCase())
    : [];
  const quickRollPool =
    filteredLibraryEvents.length
      ? filteredLibraryEvents
      : selectedCategoryLibraryEvents.length
        ? selectedCategoryLibraryEvents
        : libraryEvents;
  const quickRollPoolLabel = filteredLibraryEvents.length
    ? `filtered library d${quickRollPool.length}`
    : selectedCategoryLibraryEvents.length
      ? `${stringValue(selectedEvent?.category) || "category"} library d${quickRollPool.length}`
      : `library d${quickRollPool.length}`;
  const questData = buildSelectData(model.questOptions, stringValue(draft.linkedQuest), "No linked quest");
  const companionData = buildSelectData(model.companionOptions, stringValue(draft.linkedCompanion), "No linked companion");
  const generatorQuestData = buildSelectData(model.questOptions, stringValue(generator.linkedQuest), "No linked quest");
  const generatorCompanionData = buildSelectData(model.companionOptions, stringValue(generator.linkedCompanion), "No linked companion");
  const generatorTable = getEventTable(generator.category);
  const generatorRows = generatorTable.map((entry, index) => ({
    entry,
    roll: index + 1,
    preview: resolveEventTableEntry(entry, campaign, generator),
  }));
  const generatorPreview = rollResult?.preview || null;
  const leadFront = model.activeEvents[0] || selectedEvent || model.events[0] || null;
  const kingdomFront = model.kingdomEvents[0] || null;
  const partyFront = model.partyEvents[0] || null;
  const liveClockRows = (model.imminentEvents.length ? model.imminentEvents : model.activeEvents).slice(0, 4);
  const eventMetaRows = model.summaryCards.map((card) => ({
    ...card,
    action:
      card.label === "Kingdom Pressure"
        ? () => {
            setCategoryFilter("kingdom");
            setStatusFilter("all");
          }
        : card.label === "Party Pressure"
          ? () => {
              setCategoryFilter("all");
              setStatusFilter("active");
            }
          : card.label === "Due Soon"
            ? () => {
                setCategoryFilter("all");
                setStatusFilter("all");
                setSelectedId(model.imminentEvents[0]?.id || model.events[0]?.id || NEW_EVENT_ID);
              }
            : () => {
                setCategoryFilter("all");
                setStatusFilter("all");
              },
  }));
  const pressureNoteRows = [
    {
      label: "Lead Front",
      title: leadFront?.title || "No active front selected",
      text: stringValue(leadFront?.trigger || leadFront?.consequenceSummary || leadFront?.notes) || "Create or select an event to define the pressure currently driving the table.",
      actionLabel: "Open Front",
      onClick: () => {
        setSelectedId(leadFront?.id || NEW_EVENT_ID);
        setDetailTab("overview");
        focusDetailPanel();
      },
    },
    {
      label: "Kingdom Fallout",
      title: kingdomFront?.title || "No kingdom pressure live",
      text: stringValue(kingdomFront?.consequenceSummary || kingdomFront?.fallout || kingdomFront?.trigger) || "Kingdom-facing trouble will appear here when it can change unrest, resources, ruin, or claimed hexes.",
      actionLabel: "Open Kingdom",
      onClick: () => navigate("/world/kingdom"),
    },
    {
      label: "Party Trouble",
      title: partyFront?.title || "No party-facing pressure live",
      text: stringValue(partyFront?.trigger || partyFront?.notes || partyFront?.consequenceSummary) || "Travel, quest, companion, and story trouble will appear here when the party needs to feel the next beat.",
      actionLabel: "Open Board",
      onClick: () => {
        setSelectedId(partyFront?.id || model.events[0]?.id || NEW_EVENT_ID);
        focusDetailPanel();
      },
    },
  ];

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateGenerator = (field, value) => {
    setGenerator((current) => ({
      ...current,
      [field]: value,
    }));
    setRollResult(null);
  };

  const handleSave = () => {
    if (!stringValue(draft.title)) {
      notifications.show({
        color: "ember",
        title: "Event title required",
        message: "Add an event title before saving the record.",
      });
      return;
    }
    const saved = actions.upsertEvent(normalizeEventDraft(draft), selectedId === NEW_EVENT_ID ? undefined : selectedId);
    if (!saved) return;
    setSelectedId(saved.id);
    notifications.show({
      color: "moss",
      title: selectedId === NEW_EVENT_ID ? "Event added" : "Event updated",
      message: `${saved.title} is now tracked in the event board.`,
    });
  };

  const handleReset = () => {
    setDraft(createEventDraft(selectedEvent));
  };

  const handleDelete = () => {
    if (!selectedEvent) return;
    if (!window.confirm(`Delete ${selectedEvent.title}?`)) return;
    const removed = actions.removeEvent(selectedEvent.id);
    if (!removed) return;
    const fallbackId = model.events.find((entry) => entry.id !== selectedEvent.id)?.id || NEW_EVENT_ID;
    setSelectedId(fallbackId);
    if (fallbackId === NEW_EVENT_ID) {
      setDraft(createEventDraft(null));
    }
    notifications.show({
      color: "moss",
      title: "Event removed",
      message: `${selectedEvent.title} was removed from the event board.`,
    });
  };

  const handleActivate = () => {
    if (!selectedEvent) return;
    const saved = actions.activateEvent(selectedEvent.id);
    if (!saved) return;
    setDraft(createEventDraft(saved));
    notifications.show({
      color: "moss",
      title: "Event activated",
      message: `${saved.title} is now live campaign pressure.`,
    });
  };

  const handleAdvanceClock = (amount) => {
    if (!selectedEvent) return;
    const result = actions.adjustEventClock(selectedEvent.id, amount, {
      autoTrigger: true,
      type: amount >= 0 ? "manual-advance" : "manual-rewind",
    });
    if (!result.changed) return;
    notifications.show({
      color: "moss",
      title: amount >= 0 ? "Clock advanced" : "Clock rewound",
      message: result.triggered ? `${selectedEvent.title} advanced and triggered its consequence.` : `${selectedEvent.title} is now at ${result.after}/${selectedEvent.clockMax}.`,
    });
  };

  const handleTriggerConsequence = () => {
    if (!selectedEvent) return;
    const result = actions.triggerEventConsequence(selectedEvent.id);
    if (!result.triggered) return;
    notifications.show({
      color: result.impactApplied ? "moss" : "brass",
      title: "Consequence triggered",
      message: result.summary || `${selectedEvent.title} consequence triggered.`,
    });
  };

  const handleResolve = (outcome) => {
    if (!selectedEvent) return;
    const result = actions.resolveEvent(selectedEvent.id, outcome);
    if (!result.resolved) return;
    notifications.show({
      color: outcome === "failed" ? "ember" : "moss",
      title: outcome === "failed" ? "Event failed" : "Event resolved",
      message: result.summary || `${selectedEvent.title} marked ${outcome}.`,
    });
  };

  const handleNewEvent = () => {
    setSelectedId(NEW_EVENT_ID);
    setDraft(createEventDraft(null));
    setDetailTab("overview");
  };

  const focusDetailPanel = () => {
    detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleQuickRollEvent = () => {
    const draw = pickRandomEntry(quickRollPool);
    if (!draw?.entry) {
      notifications.show({
        color: "brass",
        title: "No library events available",
        message: "The current filters leave no library events to draw from.",
      });
      return;
    }
    setSelectedId(draw.entry.id);
    setDraft(createEventDraft(draw.entry));
    setDetailTab("overview");
    window.requestAnimationFrame(() => {
      focusDetailPanel();
    });
    notifications.show({
      color: "moss",
      title: `Library draw d${draw.size} -> ${draw.roll}`,
      message: `${draw.entry.title} is now selected from the event library.`,
    });
  };

  const handleUseSelectedContext = () => {
    setGenerator(createGeneratorState(draft));
    setRollResult(null);
    notifications.show({
      color: "moss",
      title: "Context loaded",
      message: "The generator is now using the currently selected front's category, hex, quest, and companion links.",
    });
  };

  const handlePreviewGeneratorRow = (entry, roll) => {
    setRollResult({
      category: generator.category,
      size: generatorTable.length,
      roll,
      entry,
      preview: resolveEventTableEntry(entry, campaign, generator),
    });
  };

  const handleRollEvent = () => {
    const result = rollEventTable(generator.category, campaign, generator);
    if (!result) return;
    setRollResult(result);
    notifications.show({
      color: "moss",
      title: `Rolled d${result.size}`,
      message: `${result.preview.title} is ready to review or load into a new event draft.`,
    });
  };

  const handleLoadRolledEvent = () => {
    if (!rollResult) return;
    const nextDraft = createEventDraft(buildGeneratedEventDraft(rollResult, campaign, generator));
    setSelectedId(NEW_EVENT_ID);
    setDraft(nextDraft);
    setDetailTab("overview");
    notifications.show({
      color: "moss",
      title: "Rolled event loaded",
      message: `${nextDraft.title} is now loaded into a new event draft.`,
    });
  };

  const handleSaveRolledEvent = () => {
    if (!rollResult) return;
    const generatedDraft = normalizeEventDraft(buildGeneratedEventDraft(rollResult, campaign, generator));
    const saved = actions.upsertEvent(generatedDraft);
    if (!saved) return;
    setSelectedId(saved.id);
    setDraft(createEventDraft(saved));
    setDetailTab("overview");
    notifications.show({
      color: "moss",
      title: "Rolled event saved",
      message: `${saved.title} was added to the event board.`,
    });
  };

  return (
    <Stack gap="xl" className="km-events-page">
      <div className="km-event-editor-header">
        <div className="km-event-editor-header__copy">
          <Text className="km-eyebrow">Pressure Note</Text>
          <Title order={2} className="km-event-editor-header__title">
            Events
          </Title>
          <Text c="dimmed" className="km-event-editor-header__description">
            One workspace for live fronts, countdown clocks, party trouble, and kingdom consequences.
          </Text>
          <Group gap="lg" wrap="wrap" className="km-event-editor-header__links">
            <UnstyledButton className="km-command-editor-link" onClick={() => navigate("/world/kingdom")}>
              Kingdom
            </UnstyledButton>
            <UnstyledButton className="km-command-editor-link" onClick={() => navigate("/world/hex-map")}>
              Hex Map
            </UnstyledButton>
            <UnstyledButton className="km-command-editor-link" onClick={() => navigate("/reference/source-library")}>
              Source Library
            </UnstyledButton>
          </Group>
        </div>
      </div>

      <div className="km-event-editor-layout">
        <main className="km-event-editor-note">
          <div className="km-event-editor-meta">
            {eventMetaRows.map((card) => (
              <UnstyledButton key={card.label} className="km-event-editor-meta__row" onClick={card.action}>
                <Text className="km-section-kicker">{card.label}</Text>
                <Text className="km-event-editor-meta__value">{card.value}</Text>
                <Text size="sm" c="dimmed" className="km-event-editor-meta__helper">
                  {card.helper}
                </Text>
              </UnstyledButton>
            ))}
          </div>

          <section className="km-event-editor-section km-event-editor-section--intro">
            <Text className="km-section-kicker">Pressure Read</Text>
            <div className="km-event-editor-outline">
              {pressureNoteRows.map((row) => (
                <UnstyledButton key={row.label} className="km-event-editor-outline__row" onClick={row.onClick}>
                  <div className="km-event-editor-outline__head">
                    <Text className="km-event-editor-outline__label">{row.label}</Text>
                    <Text className="km-command-editor-link km-command-editor-link--small">{row.actionLabel}</Text>
                  </div>
                  <Text className="km-event-editor-outline__text">{row.title}</Text>
                  <Text size="sm" c="dimmed" className="km-event-editor-outline__helper">
                    {row.text}
                  </Text>
                </UnstyledButton>
              ))}
            </div>
          </section>

          <section className="km-event-editor-section">
            <Text className="km-section-kicker">Quick Tools</Text>
            <Group gap="lg" wrap="wrap">
              <UnstyledButton className="km-command-editor-link" onClick={handleQuickRollEvent}>
                Draw Library Event
              </UnstyledButton>
              <UnstyledButton className="km-command-editor-link" onClick={handleNewEvent}>
                New Event
              </UnstyledButton>
              <UnstyledButton className="km-command-editor-link" onClick={() => setDetailTab("generator")}>
                Table Roll
              </UnstyledButton>
              <UnstyledButton className="km-command-editor-link" onClick={() => navigate("/world/kingdom")}>
                Open Kingdom
              </UnstyledButton>
            </Group>
          </section>
        </main>

        <aside className="km-event-editor-dock">
          <div className="km-event-editor-dock__section">
            <Group justify="space-between" align="center">
              <Text className="km-section-kicker">Live Clocks</Text>
              <Text className="km-workspace-strip__hint">{liveClockRows.length} shown</Text>
            </Group>
            {liveClockRows.length ? (
              liveClockRows.map((entry) => (
                <UnstyledButton
                  key={entry.id}
                  className="km-event-editor-dock__row"
                  onClick={() => {
                    setSelectedId(entry.id);
                    setDetailTab("clock");
                    focusDetailPanel();
                  }}
                >
                  <span className="km-bullet-dot km-event-editor-dock__dot" />
                  <div className="km-event-editor-dock__copy">
                    <Text className="km-event-editor-dock__text">{entry.title}</Text>
                    <Text size="sm" c="dimmed">
                      {buildEventReferenceLine(entry)}
                    </Text>
                    <Text className="km-action-row__link">Open Clock</Text>
                  </div>
                </UnstyledButton>
              ))
            ) : (
              <Text c="dimmed">No live event clocks are tracked yet.</Text>
            )}
          </div>

          <div className="km-event-editor-dock__section">
            <Text className="km-section-kicker">Random Pressure</Text>
            <UnstyledButton className="km-event-editor-dock__row" onClick={handleQuickRollEvent}>
              <span className="km-bullet-dot km-event-editor-dock__dot" />
              <div className="km-event-editor-dock__copy">
                <Text className="km-event-editor-dock__text">Draw from the Kingmaker event library</Text>
                <Text size="sm" c="dimmed">
                  {quickRollPoolLabel}
                </Text>
                <Text className="km-action-row__link">Draw Library Event</Text>
              </div>
            </UnstyledButton>
            <UnstyledButton className="km-event-editor-dock__row" onClick={() => setDetailTab("generator")}>
              <span className="km-bullet-dot km-event-editor-dock__dot" />
              <div className="km-event-editor-dock__copy">
                <Text className="km-event-editor-dock__text">Use the compact table roller</Text>
                <Text size="sm" c="dimmed">
                  Current table d{generatorTable.length}
                </Text>
                <Text className="km-action-row__link">Open Table Roll</Text>
              </div>
            </UnstyledButton>
          </div>

          <div className="km-event-editor-dock__section">
            <Text className="km-section-kicker">Linked Work</Text>
            <div className="km-event-editor-dock__links">
              <UnstyledButton className="km-command-editor-link km-command-editor-link--small" onClick={() => navigate("/world/quests")}>
                Open Quests
              </UnstyledButton>
              <UnstyledButton className="km-command-editor-link km-command-editor-link--small" onClick={() => navigate("/world/companions")}>
                Open Companions
              </UnstyledButton>
              <UnstyledButton className="km-command-editor-link km-command-editor-link--small" onClick={() => navigate("/world/locations")}>
                Open Locations
              </UnstyledButton>
            </div>
          </div>
        </aside>
      </div>

      <Grid gutter="lg" align="start">
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            <Paper className="km-panel km-event-roster-panel km-panel--flat">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text className="km-section-kicker">Front Board</Text>
                    <Text c="dimmed">{model.storyPhase.shortLabel} focus. Search to reach the full Kingmaker event library.</Text>
                  </Stack>
                  <Group gap="xs">
                    <Button size="compact-md" variant="default" leftSection={<IconDice5 size={16} />} onClick={handleQuickRollEvent}>
                      Draw Library Event
                    </Button>
                    <Button size="compact-md" color="moss" onClick={handleNewEvent}>
                      New Event
                    </Button>
                  </Group>
                </Group>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="outline">Library records {libraryEvents.length}</Badge>
                  <Badge variant="outline">Focus references {model.focusReferenceEvents.length}</Badge>
                  <Badge variant="outline">Current draw pool {quickRollPool.length}</Badge>
                  <Text size="sm" c="dimmed">Top button draws from the seeded event library. The `Table Roll` tab uses smaller per-category prompt tables.</Text>
                </Group>

                <Grid gutter="sm">
                  <Grid.Col span={12}>
                    <TextInput label="Search" value={searchValue} onChange={(event) => setSearchValue(event.currentTarget.value)} placeholder="bandits, weather, Linzi..." />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value || "all")} data={STATUS_FILTER_OPTIONS} allowDeselect={false} />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select label="Category" value={categoryFilter} onChange={(value) => setCategoryFilter(value || "all")} data={CATEGORY_FILTER_OPTIONS} allowDeselect={false} />
                  </Grid.Col>
                </Grid>

                <Stack gap="sm" className="km-event-list">
                  {filteredEvents.length ? (
                    filteredEvents.map((eventItem) => (
                      <EventListItem key={eventItem.id} eventItem={eventItem} active={eventItem.id === selectedId} onSelect={() => setSelectedId(eventItem.id)} />
                    ))
                  ) : (
                    <Text c="dimmed">No events match the current filters.</Text>
                  )}
                </Stack>
              </Stack>
            </Paper>

          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper ref={detailPanelRef} className="km-panel km-event-detail-panel km-panel--flat">
            <Stack gap="lg">
              <div className="km-event-hero">
                <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
                  <Stack gap="xs">
                    <Text className="km-section-kicker">Selected Front</Text>
                    <Title order={2}>{stringValue(draft.title) || "New Event Record"}</Title>
                    <Group gap="xs" wrap="wrap">
                      <Badge color="moss" variant="light">{stringValue(draft.category) || "story"}</Badge>
                      <Badge variant="outline">{stringValue(draft.status) || "seeded"}</Badge>
                      {selectedEvent && !isLiveCampaignRecord(selectedEvent) ? <Badge color="yellow" variant="light">Reference</Badge> : null}
                      <Badge variant="outline">Urgency {intValue(draft.urgency, 3)}</Badge>
                      <Badge variant="outline">Clock {formatEventClockSummary(draft)}</Badge>
                      {stringValue(draft.hex) ? <Badge variant="outline">{draft.hex}</Badge> : null}
                    </Group>
                    <Text c="dimmed" maw={780}>
                      {stringValue(draft.trigger || draft.consequenceSummary || draft.notes || "Describe the pressure, what advances it, and what happens when it lands.")}
                    </Text>
                  </Stack>
                  <Group gap="sm" wrap="wrap">
                    {selectedEvent && !isLiveCampaignRecord(selectedEvent) ? (
                      <Button color="sun" onClick={handleActivate}>Activate Event</Button>
                    ) : null}
                    <Button variant="default" onClick={handleReset} disabled={!draftDirty}>Reset</Button>
                    <Button color="moss" onClick={handleSave}>{selectedId === NEW_EVENT_ID ? "Add Event" : "Save Event"}</Button>
                    {selectedEvent ? (
                      <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>Delete</Button>
                    ) : null}
                  </Group>
                </Group>
              </div>

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Clock Read</Text>
                      <Text>{buildEventReferenceLine(draft)}</Text>
                      <Text size="sm" c="dimmed">
                        {getEventTurnsToConsequence(draft) == null
                          ? "This front only advances when you push it manually or through scene play."
                          : `At the current pace, the consequence hits in ${getEventTurnsToConsequence(draft)} turn(s).`}
                      </Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Kingdom Impact</Text>
                      <Text>{impactSummary || "No kingdom deltas configured yet."}</Text>
                      <Text size="sm" c="dimmed">Use `always` for guaranteed kingdom fallout, `claimed-hex` for territory-bound fallout, and `none` for party-only pressure.</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Tabs.Root value={detailTab} onValueChange={setDetailTab} className="km-radix-tabs">
                <Tabs.List className="km-radix-list">
                  <Tabs.Trigger value="overview" className="km-radix-trigger">Overview</Tabs.Trigger>
                  <Tabs.Trigger value="clock" className="km-radix-trigger">Clock</Tabs.Trigger>
                  <Tabs.Trigger value="consequence" className="km-radix-trigger">Consequence</Tabs.Trigger>
                  <Tabs.Trigger value="history" className="km-radix-trigger">History</Tabs.Trigger>
                  <Tabs.Trigger value="generator" className="km-radix-trigger">Table Roll</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="overview" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Title" value={draft.title} onChange={(event) => updateDraft("title", event.currentTarget.value)} placeholder="Bandit Tribute Deadline" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Folder / Group" value={draft.folder} onChange={(event) => updateDraft("folder", event.currentTarget.value)} placeholder="Travel Pressure" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <Select label="Category" value={draft.category} onChange={(value) => updateDraft("category", value || "story")} data={CATEGORY_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <Select label="Status" value={draft.status} onChange={(value) => updateDraft("status", value || "seeded")} data={STATUS_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <NumberInput label="Urgency" value={draft.urgency} onChange={(value) => updateDraft("urgency", value)} min={1} max={5} step={1} clampBehavior="strict" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <TextInput label="Hex" value={draft.hex} onChange={(event) => updateDraft("hex", event.currentTarget.value)} placeholder="D4" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select label="Linked Quest" value={stringValue(draft.linkedQuest) || "__none__"} onChange={(value) => updateDraft("linkedQuest", value === "__none__" ? "" : value || "")} data={questData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select label="Linked Companion" value={stringValue(draft.linkedCompanion) || "__none__"} onChange={(value) => updateDraft("linkedCompanion", value === "__none__" ? "" : value || "")} data={companionData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Trigger" value={draft.trigger} onChange={(event) => updateDraft("trigger", event.currentTarget.value)} minRows={3} placeholder="What starts, advances, or keeps this front alive?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Notes" value={draft.notes} onChange={(event) => updateDraft("notes", event.currentTarget.value)} minRows={4} placeholder="Scene prompts, table signals, NPC reactions, and what to reveal next." />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="clock" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <NumberInput label="Clock" value={draft.clock} onChange={(value) => updateDraft("clock", value)} min={0} step={1} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <NumberInput label="Clock Max" value={draft.clockMax} onChange={(value) => updateDraft("clockMax", value)} min={1} step={1} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <NumberInput label="Advance / Turn" value={draft.advancePerTurn} onChange={(value) => updateDraft("advancePerTurn", value)} min={0} step={1} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select label="Advance Mode" value={draft.advanceOn} onChange={(value) => updateDraft("advanceOn", value || "manual")} data={ADVANCE_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="xs">
                          <Text className="km-section-kicker">Clock Helper</Text>
                          <Text>{formatEventClockSummary(draft)}</Text>
                          <Text size="sm" c="dimmed">{getEventTurnsToConsequence(draft) == null ? "No automatic kingdom-turn advancement." : `${getEventTurnsToConsequence(draft)} turn(s) to consequence at the current pace.`}</Text>
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Group gap="sm" wrap="wrap">
                        <Button variant="default" onClick={() => handleAdvanceClock(1)} disabled={!selectedEvent}>Advance Clock</Button>
                        <Button variant="default" onClick={() => handleAdvanceClock(-1)} disabled={!selectedEvent}>Rewind Clock</Button>
                        <Button color="brass" variant="light" onClick={handleTriggerConsequence} disabled={!selectedEvent}>Trigger Consequence</Button>
                        <Button color="moss" variant="light" onClick={() => handleResolve("resolved")} disabled={!selectedEvent}>Resolve</Button>
                        <Button color="red" variant="light" onClick={() => handleResolve("failed")} disabled={!selectedEvent}>Mark Failed</Button>
                      </Group>
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="consequence" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Textarea label="Consequence Summary" value={draft.consequenceSummary} onChange={(event) => updateDraft("consequenceSummary", event.currentTarget.value)} minRows={3} placeholder="What happens when the clock fills or the front breaks?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Fallout" value={draft.fallout} onChange={(event) => updateDraft("fallout", event.currentTarget.value)} minRows={3} placeholder="How does the map, party, settlement, or kingdom change after this lands?" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Impact Scope" value={draft.impactScope} onChange={(value) => updateDraft("impactScope", value || "none")} data={IMPACT_SCOPE_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    {Object.keys(buildEventImpactSnapshot(draft)).map((key) => (
                      <Grid.Col key={key} span={{ base: 12, md: 4 }}>
                        <NumberInput
                          label={key.replace(/Impact$/, "").replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}
                          value={draft[key]}
                          onChange={(value) => updateDraft(key, value)}
                          step={1}
                        />
                      </Grid.Col>
                    ))}
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="history" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Event History</Text>
                            <Badge variant="outline">{selectedHistory.length}</Badge>
                          </Group>
                          {selectedHistory.length ? selectedHistory.map((entry) => <HistoryCard key={entry.id} entry={entry} />) : <Text c="dimmed">No history has been recorded for this event yet.</Text>}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Recent Global History</Text>
                            <Badge variant="outline">{model.recentHistory.length}</Badge>
                          </Group>
                          {model.recentHistory.length ? model.recentHistory.slice(0, 6).map((entry) => <HistoryCard key={entry.id} entry={entry} />) : <Text c="dimmed">No recent event history is recorded yet.</Text>}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="generator" className="km-radix-content">
                  <Paper className="km-record-card km-event-generator-card">
                    <Stack gap="md">
                      <Group justify="space-between" align="center">
                        <Stack gap={2}>
                          <Text className="km-section-kicker">Prompt Table Roll</Text>
                          <Text c="dimmed">This is a compact lane table, not the full 100-event library. It rolls on the selected category table and builds a new draft from that result.</Text>
                        </Stack>
                        <Badge color="brass" variant="light">d{generatorTable.length}</Badge>
                      </Group>

                      <Group gap="xs" wrap="wrap">
                        <Badge variant="outline">Selected table {stringValue(generator.category) || "story"}</Badge>
                        <Badge variant="outline">Table size d{generatorTable.length}</Badge>
                        <Badge variant="outline">Library pool {quickRollPoolLabel}</Badge>
                      </Group>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <Select
                            label="Table"
                            value={generator.category}
                            onChange={(value) => updateGenerator("category", value || "story")}
                            data={CATEGORY_OPTIONS}
                            allowDeselect={false}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput
                            label="Hex Context"
                            value={generator.hex}
                            onChange={(event) => updateGenerator("hex", event.currentTarget.value)}
                            placeholder="D4"
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <Select
                            label="Linked Quest"
                            value={stringValue(generator.linkedQuest) || "__none__"}
                            onChange={(value) => updateGenerator("linkedQuest", value === "__none__" ? "" : value || "")}
                            data={generatorQuestData}
                            allowDeselect={false}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <Select
                            label="Linked Companion"
                            value={stringValue(generator.linkedCompanion) || "__none__"}
                            onChange={(value) => updateGenerator("linkedCompanion", value === "__none__" ? "" : value || "")}
                            data={generatorCompanionData}
                            allowDeselect={false}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 8 }}>
                          <Group gap="sm" wrap="wrap" pt="xl">
                            <Button variant="default" onClick={handleUseSelectedContext}>Use Selected Front Context</Button>
                            <Button color="moss" leftSection={<IconDice5 size={16} />} onClick={handleRollEvent}>
                              Roll Table d{generatorTable.length}
                            </Button>
                          </Group>
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, xl: 5 }}>
                          <Paper className="km-record-card km-event-roll-result">
                            <Stack gap="sm">
                              <Group justify="space-between" align="center">
                                <Text className="km-section-kicker">Table Result</Text>
                                {rollResult ? <Badge variant="outline">d{rollResult.size} {"->"} {rollResult.roll}</Badge> : null}
                              </Group>
                              {generatorPreview ? (
                                <>
                                  <Title order={4}>{generatorPreview.title}</Title>
                                  <Group gap="xs" wrap="wrap">
                                    <Badge color="moss" variant="light">{generator.category}</Badge>
                                    <Badge variant="outline">Urgency {intValue(generatorPreview.urgency, 3)}</Badge>
                                    <Badge variant="outline">Clock {formatEventClockSummary(generatorPreview)}</Badge>
                                    {stringValue(generatorPreview.hex) ? <Badge variant="outline">{generatorPreview.hex}</Badge> : null}
                                  </Group>
                                  <Text size="sm" c="dimmed">{generatorPreview.trigger}</Text>
                                  <Text size="sm">{generatorPreview.consequenceSummary}</Text>
                                  <Text size="sm" c="dimmed">{generatorPreview.fallout}</Text>
                                  <Text size="sm" c="dimmed">{generatorPreview.notes}</Text>
                                  <Group gap="sm" wrap="wrap">
                                    <Button variant="default" onClick={handleLoadRolledEvent}>Load Into New Draft</Button>
                                    <Button color="moss" onClick={handleSaveRolledEvent}>Save Rolled Event</Button>
                                  </Group>
                                </>
                              ) : (
                                <Text c="dimmed">Roll the current table or preview a row below to stage a new event front.</Text>
                              )}
                            </Stack>
                          </Paper>
                        </Grid.Col>

                        <Grid.Col span={{ base: 12, xl: 7 }}>
                          <Stack gap="sm" className="km-event-generator-table">
                            {generatorRows.map(({ entry, preview, roll }) => (
                              <div key={`${generator.category}-${roll}-${entry.title}`} className={`km-event-generator-row${rollResult?.roll === roll ? " is-active" : ""}`}>
                                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                                  <Group align="flex-start" gap="sm" wrap="nowrap" className="km-event-generator-row__head">
                                    <Badge variant="outline" className="km-event-generator-row__roll">{roll}</Badge>
                                    <Stack gap={4}>
                                      <Text fw={700}>{preview.title}</Text>
                                      <Text size="sm" c="dimmed">{preview.trigger}</Text>
                                    </Stack>
                                  </Group>
                                  <Button size="compact-md" variant="default" onClick={() => handlePreviewGeneratorRow(entry, roll)}>
                                    Preview
                                  </Button>
                                </Group>
                                <Group gap="xs" wrap="wrap">
                                  <Badge color="moss" variant="light">Urgency {intValue(preview.urgency, 3)}</Badge>
                                  <Badge variant="outline">Clock {formatEventClockSummary(preview)}</Badge>
                                  <Badge variant="outline">{preview.advanceOn === "turn" ? "Kingdom turn" : "Manual advance"}</Badge>
                                  {stringValue(preview.hex) ? <Badge variant="outline">{preview.hex}</Badge> : null}
                                </Group>
                                <Text size="sm">{preview.consequenceSummary}</Text>
                              </div>
                            ))}
                          </Stack>
                        </Grid.Col>
                      </Grid>
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
