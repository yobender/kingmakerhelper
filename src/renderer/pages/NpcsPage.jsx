import { useEffect, useState } from "react";
import { Badge, Button, Grid, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconBellRinging, IconBook2, IconCrown, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import {
  NPC_DISPOSITION_OPTIONS,
  NPC_IMPORTANCE_OPTIONS,
  NPC_STATUS_OPTIONS,
} from "../lib/campaignState";
import {
  buildNpcsModel,
  collectLinkedNpcEvents,
  collectLinkedNpcQuests,
  collectNpcLocations,
  formatNpcDisposition,
  formatNpcStatus,
} from "../lib/npcs";
import { getLegacyWorkspaceUrl } from "../lib/desktop";

const NEW_NPC_ID = "__new__";

const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All statuses" }, ...NPC_STATUS_OPTIONS.map((value) => ({ value, label: formatNpcStatus(value) }))];
const STATUS_OPTIONS = NPC_STATUS_OPTIONS.map((value) => ({ value, label: formatNpcStatus(value) }));
const DISPOSITION_OPTIONS = NPC_DISPOSITION_OPTIONS.map((value) => ({ value, label: formatNpcDisposition(value) }));
const IMPORTANCE_OPTIONS = NPC_IMPORTANCE_OPTIONS.map((value) => ({ value, label: formatNpcStatus(value) }));

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function intValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function buildSelectData(options, currentValue, emptyLabel) {
  const data = options.length ? [...options] : [];
  if (currentValue && !data.some((entry) => entry.value === currentValue)) {
    data.unshift({ value: currentValue, label: currentValue });
  }
  return [{ value: "__none__", label: emptyLabel }, ...data];
}

function createNpcDraft(npc) {
  return {
    id: npc?.id || "",
    name: npc?.name || "",
    role: npc?.role || "",
    faction: npc?.faction || "",
    status: npc?.status || "neutral",
    disposition: npc?.disposition || "indifferent",
    importance: npc?.importance || "supporting",
    creatureLevel: intValue(npc?.creatureLevel, 0),
    folder: npc?.folder || "",
    location: npc?.location || "",
    hex: npc?.hex || "",
    firstImpression: npc?.firstImpression || "",
    agenda: npc?.agenda || "",
    leverage: npc?.leverage || "",
    pressure: npc?.pressure || "",
    rumor: npc?.rumor || "",
    secret: npc?.secret || "",
    nextScene: npc?.nextScene || "",
    linkedQuest: npc?.linkedQuest || "",
    linkedEvent: npc?.linkedEvent || "",
    kingdomRole: npc?.kingdomRole || "",
    kingdomNotes: npc?.kingdomNotes || "",
    notes: npc?.notes || "",
  };
}

function normalizeNpcDraft(draft) {
  return {
    ...draft,
    creatureLevel: Math.max(-1, intValue(draft?.creatureLevel, 0)),
    hex: stringValue(draft?.hex).replace(/\s+/g, "").toUpperCase(),
  };
}

function isNpcDraftDirty(draft, baseline) {
  const current = normalizeNpcDraft(draft);
  const target = normalizeNpcDraft(baseline);
  return [
    "name",
    "role",
    "faction",
    "status",
    "disposition",
    "importance",
    "creatureLevel",
    "folder",
    "location",
    "hex",
    "firstImpression",
    "agenda",
    "leverage",
    "pressure",
    "rumor",
    "secret",
    "nextScene",
    "linkedQuest",
    "linkedEvent",
    "kingdomRole",
    "kingdomNotes",
    "notes",
  ].some((key) => String(current?.[key] ?? "") !== String(target?.[key] ?? ""));
}

function NpcRosterItem({ npc, active, onSelect }) {
  return (
    <button type="button" className={`km-npc-roster-item${active ? " is-active" : ""}`} onClick={onSelect}>
      <span className="km-npc-roster-item__head">
        <span className="km-npc-roster-item__title">{stringValue(npc?.name) || "Unnamed NPC"}</span>
        <span className="km-npc-roster-item__meta">{formatNpcStatus(npc?.status) || "neutral"}</span>
      </span>
      <span className="km-npc-roster-item__chips">
        {stringValue(npc?.role) ? <span className="km-companion-chip">{stringValue(npc.role)}</span> : null}
        {stringValue(npc?.faction) ? <span className="km-companion-chip">{stringValue(npc.faction)}</span> : null}
        {stringValue(npc?.hex) ? <span className="km-companion-chip">{stringValue(npc.hex)}</span> : null}
        <span className="km-companion-chip">Lvl {intValue(npc?.creatureLevel, 0)}</span>
      </span>
      <span className="km-npc-roster-item__summary">
        {stringValue(npc?.pressure || npc?.agenda || npc?.nextScene || npc?.notes || npc?.firstImpression)}
      </span>
    </button>
  );
}

function LinkedRecordCard({ title, meta, body }) {
  return (
    <Paper className="km-record-card">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <Text fw={700}>{title}</Text>
          {meta ? <Text size="sm" c="dimmed">{meta}</Text> : null}
        </Group>
        {body ? <Text size="sm" c="dimmed">{body}</Text> : null}
      </Stack>
    </Paper>
  );
}

export default function NpcsPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildNpcsModel(campaign);
  const [selectedId, setSelectedId] = useState(() => model.npcs[0]?.id || NEW_NPC_ID);
  const [detailTab, setDetailTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [factionFilter, setFactionFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const selectedNpc = model.npcs.find((entry) => entry.id === selectedId) || null;
  const [draft, setDraft] = useState(() => createNpcDraft(selectedNpc));

  useEffect(() => {
    if (selectedId === NEW_NPC_ID) return;
    if (selectedNpc) return;
    setSelectedId(model.npcs[0]?.id || NEW_NPC_ID);
  }, [selectedId, selectedNpc, model.npcs]);

  useEffect(() => {
    if (selectedId === NEW_NPC_ID) return;
    setDraft(createNpcDraft(selectedNpc));
  }, [selectedId, selectedNpc?.updatedAt]);

  const baselineDraft = createNpcDraft(selectedNpc);
  const draftDirty = isNpcDraftDirty(draft, baselineDraft);
  const questData = buildSelectData(model.questOptions, stringValue(draft.linkedQuest), "No linked quest");
  const eventData = buildSelectData(model.eventOptions, stringValue(draft.linkedEvent), "No linked event");
  const linkedQuestRecords = collectLinkedNpcQuests(campaign, draft);
  const linkedEventRecords = collectLinkedNpcEvents(campaign, draft);
  const currentLocationRecords = collectNpcLocations(campaign, draft);
  const filteredNpcs = model.npcs.filter((entry) => {
    if (statusFilter !== "all" && stringValue(entry?.status) !== statusFilter) return false;
    if (factionFilter !== "all" && stringValue(entry?.faction) !== factionFilter) return false;
    const haystack = [
      entry?.name,
      entry?.role,
      entry?.faction,
      entry?.status,
      entry?.disposition,
      entry?.location,
      entry?.hex,
      entry?.agenda,
      entry?.pressure,
      entry?.kingdomRole,
      entry?.notes,
      entry?.folder,
    ]
      .map((value) => stringValue(value).toLowerCase())
      .join(" ");
    return haystack.includes(stringValue(searchValue).toLowerCase());
  });

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    if (!stringValue(draft.name)) {
      notifications.show({
        color: "ember",
        title: "NPC name required",
        message: "Add an NPC name before saving the record.",
      });
      return;
    }
    const saved = actions.upsertNpc(normalizeNpcDraft(draft), selectedId === NEW_NPC_ID ? undefined : selectedId);
    if (!saved) return;
    setSelectedId(saved.id);
    notifications.show({
      color: "moss",
      title: selectedId === NEW_NPC_ID ? "NPC added" : "NPC updated",
      message: `${saved.name} is now tracked in the NPC roster.`,
    });
  };

  const handleReset = () => {
    setDraft(createNpcDraft(selectedNpc));
  };

  const handleDelete = () => {
    if (!selectedNpc) return;
    if (!window.confirm(`Delete ${selectedNpc.name}?`)) return;
    const removed = actions.removeNpc(selectedNpc.id);
    if (!removed) return;
    const fallbackId = model.npcs.find((entry) => entry.id !== selectedNpc.id)?.id || NEW_NPC_ID;
    setSelectedId(fallbackId);
    if (fallbackId === NEW_NPC_ID) {
      setDraft(createNpcDraft(null));
    }
    notifications.show({
      color: "moss",
      title: "NPC removed",
      message: `${selectedNpc.name} was removed from the roster.`,
    });
  };

  const handleNewNpc = () => {
    setSelectedId(NEW_NPC_ID);
    setDraft(createNpcDraft(null));
    setDetailTab("overview");
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="World"
        title="NPCs"
        description="Track who matters in Kingmaker: patrons, frontier locals, rivals, envoys, and the figures whose pressure or support changes the party's next decision."
        actions={(
          <>
            <Button variant="default" leftSection={<IconBellRinging size={16} />} onClick={() => navigate("/world/events")}>
              Open Events
            </Button>
            <Button variant="default" leftSection={<IconCrown size={16} />} onClick={() => navigate("/world/kingdom")}>
              Open Kingdom
            </Button>
            <Button component="a" href={getLegacyWorkspaceUrl("pdf")} leftSection={<IconBook2 size={16} />} color="moss">
              Source Library
            </Button>
          </>
        )}
      />

      <Grid gutter="lg">
        {model.summaryCards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, sm: 6, xl: 3 }}>
            <MetricCard {...card} />
          </Grid.Col>
        ))}
      </Grid>

      <Grid gutter="lg" align="start">
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            <Paper className="km-panel km-npc-roster-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text className="km-section-kicker">Actor Roster</Text>
                    <Text c="dimmed">The people who tilt travel, quests, and kingdom legitimacy.</Text>
                  </Stack>
                  <Button size="compact-md" color="moss" onClick={handleNewNpc}>
                    New NPC
                  </Button>
                </Group>

                <Grid gutter="sm">
                  <Grid.Col span={12}>
                    <TextInput label="Search" value={searchValue} onChange={(event) => setSearchValue(event.currentTarget.value)} placeholder="Jamandi, bandit broker, Restov..." />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value || "all")} data={STATUS_FILTER_OPTIONS} allowDeselect={false} />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select
                      label="Faction"
                      value={factionFilter}
                      onChange={(value) => setFactionFilter(value || "all")}
                      data={[{ value: "all", label: "All factions" }, ...model.factionOptions]}
                      allowDeselect={false}
                    />
                  </Grid.Col>
                </Grid>

                <Stack gap="sm" className="km-npc-roster-list">
                  {filteredNpcs.length ? (
                    filteredNpcs.map((npc) => (
                      <NpcRosterItem key={npc.id} npc={npc} active={npc.id === selectedId} onSelect={() => setSelectedId(npc.id)} />
                    ))
                  ) : (
                    <Text c="dimmed">No NPCs match the current filters.</Text>
                  )}
                </Stack>
              </Stack>
            </Paper>

          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper className="km-panel km-npc-detail-panel">
            <Stack gap="lg">
              <div className="km-npc-hero">
                <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
                  <Stack gap="xs">
                    <Text className="km-section-kicker">Selected Actor</Text>
                    <Title order={2}>{stringValue(draft.name) || "New NPC Record"}</Title>
                    <Group gap="xs" wrap="wrap">
                      {stringValue(draft.role) ? <Badge color="moss" variant="light">{draft.role}</Badge> : null}
                      {stringValue(draft.faction) ? <Badge variant="outline">{draft.faction}</Badge> : null}
                      <Badge variant="outline">{formatNpcStatus(draft.status) || "neutral"}</Badge>
                      <Badge variant="outline">{formatNpcDisposition(draft.disposition) || "indifferent"}</Badge>
                      <Badge variant="outline">Lvl {intValue(draft.creatureLevel, 0)}</Badge>
                      {stringValue(draft.hex) ? <Badge variant="outline">{draft.hex}</Badge> : null}
                    </Group>
                    <Text c="dimmed" maw={780}>
                      {stringValue(draft.pressure || draft.agenda || draft.nextScene || draft.notes || "Record what this NPC wants, what they can press on, and what changes when they enter a scene.") }
                    </Text>
                  </Stack>
                  <Group gap="sm" wrap="wrap">
                    <Button variant="default" onClick={handleReset} disabled={!draftDirty}>Reset</Button>
                    <Button color="moss" onClick={handleSave}>{selectedId === NEW_NPC_ID ? "Add NPC" : "Save NPC"}</Button>
                    {selectedNpc ? (
                      <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>Delete</Button>
                    ) : null}
                  </Group>
                </Group>
              </div>

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Pressure Read</Text>
                      <Text>{stringValue(draft.pressure || draft.agenda || "No live pressure recorded yet.")}</Text>
                      <Text size="sm" c="dimmed">{stringValue(draft.nextScene || "Use `Next Scene` to note the fastest, cleanest way to bring this NPC back onto the table.")}</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Kingdom Read</Text>
                      <Text>{stringValue(draft.kingdomRole || "No kingdom fit recorded yet.")}</Text>
                      <Text size="sm" c="dimmed">{stringValue(draft.kingdomNotes || "Track whether this NPC legitimizes the kingdom, pressures it, or can fill a leadership gap later.")}</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Tabs.Root value={detailTab} onValueChange={setDetailTab} className="km-radix-tabs">
                <Tabs.List className="km-radix-list">
                  <Tabs.Trigger value="overview" className="km-radix-trigger">Overview</Tabs.Trigger>
                  <Tabs.Trigger value="leverage" className="km-radix-trigger">Leverage</Tabs.Trigger>
                  <Tabs.Trigger value="links" className="km-radix-trigger">Links</Tabs.Trigger>
                  <Tabs.Trigger value="kingdom" className="km-radix-trigger">Kingdom Fit</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="overview" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Name" value={draft.name} onChange={(event) => updateDraft("name", event.currentTarget.value)} placeholder="Jamandi Aldori" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Role" value={draft.role} onChange={(event) => updateDraft("role", event.currentTarget.value)} placeholder="Patron, guide, merchant, envoy..." />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput label="Faction" value={draft.faction} onChange={(event) => updateDraft("faction", event.currentTarget.value)} placeholder="Restov Swordlords" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Status" value={draft.status} onChange={(value) => updateDraft("status", value || "neutral")} data={STATUS_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Importance" value={draft.importance} onChange={(value) => updateDraft("importance", value || "supporting")} data={IMPORTANCE_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Disposition" value={draft.disposition} onChange={(value) => updateDraft("disposition", value || "indifferent")} data={DISPOSITION_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <NumberInput label="Creature Level" value={draft.creatureLevel} onChange={(value) => updateDraft("creatureLevel", value)} min={-1} max={25} step={1} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput label="Folder" value={draft.folder} onChange={(event) => updateDraft("folder", event.currentTarget.value)} placeholder="Greenbelt / Restov / Troll Trouble" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Location" value={draft.location} onChange={(event) => updateDraft("location", event.currentTarget.value)} placeholder="Oleg's Trading Post" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Hex" value={draft.hex} onChange={(event) => updateDraft("hex", event.currentTarget.value)} placeholder="D4" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="First Impression" value={draft.firstImpression} onChange={(event) => updateDraft("firstImpression", event.currentTarget.value)} minRows={2} placeholder="What should the GM or players feel the moment this NPC enters a scene?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Agenda" value={draft.agenda} onChange={(event) => updateDraft("agenda", event.currentTarget.value)} minRows={3} placeholder="What do they want right now, and what direction are they pushing play?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Notes" value={draft.notes} onChange={(event) => updateDraft("notes", event.currentTarget.value)} minRows={4} placeholder="Voice cues, stat references, scene history, or chapter-specific reminders." />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="leverage" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Textarea label="Leverage" value={draft.leverage} onChange={(event) => updateDraft("leverage", event.currentTarget.value)} minRows={3} placeholder="What can they offer, deny, reveal, or force?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Pressure" value={draft.pressure} onChange={(event) => updateDraft("pressure", event.currentTarget.value)} minRows={3} placeholder="What is making them urgent, dangerous, or unstable right now?" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea label="Rumor" value={draft.rumor} onChange={(event) => updateDraft("rumor", event.currentTarget.value)} minRows={3} placeholder="What table rumor or incomplete truth points toward this NPC?" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea label="Secret" value={draft.secret} onChange={(event) => updateDraft("secret", event.currentTarget.value)} minRows={3} placeholder="What changes the scene if it comes out?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Next Scene" value={draft.nextScene} onChange={(event) => updateDraft("nextScene", event.currentTarget.value)} minRows={3} placeholder="What is the easiest strong use for this NPC in the next session?" />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="links" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select label="Linked Quest" value={stringValue(draft.linkedQuest) || "__none__"} onChange={(value) => updateDraft("linkedQuest", value === "__none__" ? "" : value || "")} data={questData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select label="Linked Event" value={stringValue(draft.linkedEvent) || "__none__"} onChange={(value) => updateDraft("linkedEvent", value === "__none__" ? "" : value || "")} data={eventData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Quest Links</Text>
                            <Badge variant="outline">{linkedQuestRecords.length}</Badge>
                          </Group>
                          {linkedQuestRecords.length ? (
                            linkedQuestRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.title || "Untitled Quest"} meta={entry.status} body={entry.nextBeat || entry.objective} />
                            ))
                          ) : (
                            <Text c="dimmed">No quest is currently linked to this NPC.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Event Links</Text>
                            <Badge variant="outline">{linkedEventRecords.length}</Badge>
                          </Group>
                          {linkedEventRecords.length ? (
                            linkedEventRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.title || "Untitled Event"} meta={entry.status} body={entry.consequenceSummary || entry.fallout || entry.trigger} />
                            ))
                          ) : (
                            <Text c="dimmed">No event currently points at this NPC's active lane.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Location Watch</Text>
                            <Badge variant="outline">{currentLocationRecords.length}</Badge>
                          </Group>
                          {currentLocationRecords.length ? (
                            currentLocationRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.name || "Location"} meta={entry.hex} body={entry.whatChanged || entry.notes} />
                            ))
                          ) : (
                            <Text c="dimmed">No tracked location currently matches this NPC's location or hex.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="kingdom" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Kingdom Role / Fit" value={draft.kingdomRole} onChange={(event) => updateDraft("kingdomRole", event.currentTarget.value)} placeholder="Patron, hardliner, merchant broker, future leader..." />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="xs">
                          <Text className="km-section-kicker">Current Kingdom Context</Text>
                          <Text>{stringValue(campaign.kingdom?.currentTurnLabel || "No turn label set")}</Text>
                          <Text size="sm" c="dimmed">{stringValue(campaign.kingdom?.capital || "No capital yet")} / Renown {intValue(campaign.kingdom?.renown, 0)} / Unrest {intValue(campaign.kingdom?.unrest, 0)}</Text>
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Kingdom Notes" value={draft.kingdomNotes} onChange={(event) => updateDraft("kingdomNotes", event.currentTarget.value)} minRows={5} placeholder="How does this NPC help, undermine, legitimize, or complicate the kingdom?" />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>
              </Tabs.Root>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
