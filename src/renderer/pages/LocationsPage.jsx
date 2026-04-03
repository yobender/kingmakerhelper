import { useEffect, useState } from "react";
import { Badge, Button, Grid, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconBellRinging, IconBook2, IconMap2, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { LOCATION_STATUS_OPTIONS, LOCATION_TYPE_OPTIONS } from "../lib/campaignState";
import {
  buildLocationsModel,
  collectLocationCompanions,
  collectLocationEvents,
  collectLocationMarkers,
  collectLocationNpcs,
  collectLocationQuests,
  collectLocationRegion,
  formatLocationValue,
} from "../lib/locations";
import { getLegacyWorkspaceUrl } from "../lib/desktop";

const NEW_LOCATION_ID = "__new__";

const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All statuses" }, ...LOCATION_STATUS_OPTIONS.map((value) => ({ value, label: formatLocationValue(value) }))];
const TYPE_FILTER_OPTIONS = [{ value: "all", label: "All types" }, ...LOCATION_TYPE_OPTIONS.map((value) => ({ value, label: formatLocationValue(value) }))];
const STATUS_OPTIONS = LOCATION_STATUS_OPTIONS.map((value) => ({ value, label: formatLocationValue(value) }));
const TYPE_OPTIONS = LOCATION_TYPE_OPTIONS.map((value) => ({ value, label: formatLocationValue(value) }));

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function buildSelectData(options, currentValue, emptyLabel) {
  const data = options.length ? [...options] : [];
  if (currentValue && !data.some((entry) => entry.value === currentValue)) {
    data.unshift({ value: currentValue, label: currentValue });
  }
  return [{ value: "__none__", label: emptyLabel }, ...data];
}

function createLocationDraft(location) {
  return {
    id: location?.id || "",
    name: location?.name || "",
    type: location?.type || "landmark",
    status: location?.status || "active",
    hex: location?.hex || "",
    controllingFaction: location?.controllingFaction || "",
    linkedQuest: location?.linkedQuest || "",
    linkedEvent: location?.linkedEvent || "",
    linkedNpc: location?.linkedNpc || "",
    folder: location?.folder || "",
    whatChanged: location?.whatChanged || "",
    sceneTexture: location?.sceneTexture || "",
    opportunities: location?.opportunities || "",
    risks: location?.risks || "",
    rumor: location?.rumor || "",
    notes: location?.notes || "",
  };
}

function normalizeLocationDraft(draft) {
  return {
    ...draft,
    hex: stringValue(draft?.hex).replace(/\s+/g, "").toUpperCase(),
  };
}

function isLocationDraftDirty(draft, baseline) {
  const current = normalizeLocationDraft(draft);
  const target = normalizeLocationDraft(baseline);
  return [
    "name",
    "type",
    "status",
    "hex",
    "controllingFaction",
    "linkedQuest",
    "linkedEvent",
    "linkedNpc",
    "folder",
    "whatChanged",
    "sceneTexture",
    "opportunities",
    "risks",
    "rumor",
    "notes",
  ].some((key) => String(current?.[key] ?? "") !== String(target?.[key] ?? ""));
}

function LocationRosterItem({ location, active, onSelect }) {
  return (
    <button type="button" className={`km-location-roster-item${active ? " is-active" : ""}`} onClick={onSelect}>
      <span className="km-location-roster-item__head">
        <span className="km-location-roster-item__title">{stringValue(location?.name) || "Unnamed Location"}</span>
        <span className="km-location-roster-item__meta">{formatLocationValue(location?.status) || "Active"}</span>
      </span>
      <span className="km-location-roster-item__chips">
        <span className="km-companion-chip">{formatLocationValue(location?.type) || "Landmark"}</span>
        {stringValue(location?.hex) ? <span className="km-companion-chip">{stringValue(location.hex)}</span> : null}
        {stringValue(location?.controllingFaction) ? <span className="km-companion-chip">{stringValue(location.controllingFaction)}</span> : null}
      </span>
      <span className="km-location-roster-item__summary">
        {stringValue(location?.whatChanged || location?.risks || location?.opportunities || location?.notes)}
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

export default function LocationsPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildLocationsModel(campaign);
  const [selectedId, setSelectedId] = useState(() => model.locations[0]?.id || NEW_LOCATION_ID);
  const [detailTab, setDetailTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const selectedLocation = model.locations.find((entry) => entry.id === selectedId) || null;
  const [draft, setDraft] = useState(() => createLocationDraft(selectedLocation));

  useEffect(() => {
    if (selectedId === NEW_LOCATION_ID) return;
    if (selectedLocation) return;
    setSelectedId(model.locations[0]?.id || NEW_LOCATION_ID);
  }, [selectedId, selectedLocation, model.locations]);

  useEffect(() => {
    if (selectedId === NEW_LOCATION_ID) return;
    setDraft(createLocationDraft(selectedLocation));
  }, [selectedId, selectedLocation?.updatedAt]);

  const baselineDraft = createLocationDraft(selectedLocation);
  const draftDirty = isLocationDraftDirty(draft, baselineDraft);
  const questData = buildSelectData(model.questOptions, stringValue(draft.linkedQuest), "No linked quest");
  const eventData = buildSelectData(model.eventOptions, stringValue(draft.linkedEvent), "No linked event");
  const npcData = buildSelectData(model.npcOptions, stringValue(draft.linkedNpc), "No linked NPC");
  const linkedQuestRecords = collectLocationQuests(campaign, draft);
  const linkedEventRecords = collectLocationEvents(campaign, draft);
  const linkedNpcRecords = collectLocationNpcs(campaign, draft);
  const linkedCompanionRecords = collectLocationCompanions(campaign, draft);
  const linkedMarkers = collectLocationMarkers(campaign, draft);
  const linkedRegion = collectLocationRegion(campaign, draft);

  const filteredLocations = model.locations.filter((entry) => {
    if (statusFilter !== "all" && stringValue(entry?.status) !== statusFilter) return false;
    if (typeFilter !== "all" && stringValue(entry?.type) !== typeFilter) return false;
    const haystack = [
      entry?.name,
      entry?.type,
      entry?.status,
      entry?.hex,
      entry?.controllingFaction,
      entry?.whatChanged,
      entry?.sceneTexture,
      entry?.opportunities,
      entry?.risks,
      entry?.rumor,
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
        title: "Location name required",
        message: "Add a location name before saving the record.",
      });
      return;
    }
    const saved = actions.upsertLocation(normalizeLocationDraft(draft), selectedId === NEW_LOCATION_ID ? undefined : selectedId);
    if (!saved) return;
    setSelectedId(saved.id);
    notifications.show({
      color: "moss",
      title: selectedId === NEW_LOCATION_ID ? "Location added" : "Location updated",
      message: `${saved.name} is now tracked in the atlas.`,
    });
  };

  const handleReset = () => {
    setDraft(createLocationDraft(selectedLocation));
  };

  const handleDelete = () => {
    if (!selectedLocation) return;
    if (!window.confirm(`Delete ${selectedLocation.name}?`)) return;
    const removed = actions.removeLocation(selectedLocation.id);
    if (!removed) return;
    const fallbackId = model.locations.find((entry) => entry.id !== selectedLocation.id)?.id || NEW_LOCATION_ID;
    setSelectedId(fallbackId);
    if (fallbackId === NEW_LOCATION_ID) {
      setDraft(createLocationDraft(null));
    }
    notifications.show({
      color: "moss",
      title: "Location removed",
      message: `${selectedLocation.name} was removed from the atlas.`,
    });
  };

  const handleNewLocation = () => {
    setSelectedId(NEW_LOCATION_ID);
    setDraft(createLocationDraft(null));
    setDetailTab("overview");
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="World"
        title="Locations"
        description="Run Kingmaker sites as active places, not static labels. Track what changed there, what the party learns by going there, what still threatens it, and which threads point back to it."
        actions={(
          <>
            <Button variant="default" leftSection={<IconMap2 size={16} />} onClick={() => navigate("/world/hex-map")}>
              Open Hex Map
            </Button>
            <Button variant="default" leftSection={<IconBellRinging size={16} />} onClick={() => navigate("/world/events")}>
              Open Events
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
            <Paper className="km-panel km-location-roster-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text className="km-section-kicker">Atlas Roster</Text>
                    <Text c="dimmed">Settlements, landmarks, lairs, ruins, and route-critical sites.</Text>
                  </Stack>
                  <Button size="compact-md" color="moss" onClick={handleNewLocation}>
                    New Location
                  </Button>
                </Group>

                <Grid gutter="sm">
                  <Grid.Col span={12}>
                    <TextInput label="Search" value={searchValue} onChange={(event) => setSearchValue(event.currentTarget.value)} placeholder="Oleg, ford, ruin, camp..." />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value || "all")} data={STATUS_FILTER_OPTIONS} allowDeselect={false} />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select label="Type" value={typeFilter} onChange={(value) => setTypeFilter(value || "all")} data={TYPE_FILTER_OPTIONS} allowDeselect={false} />
                  </Grid.Col>
                </Grid>

                <Stack gap="sm" className="km-location-roster-list">
                  {filteredLocations.length ? (
                    filteredLocations.map((location) => (
                      <LocationRosterItem key={location.id} location={location} active={location.id === selectedId} onSelect={() => setSelectedId(location.id)} />
                    ))
                  ) : (
                    <Text c="dimmed">No locations match the current filters.</Text>
                  )}
                </Stack>
              </Stack>
            </Paper>

          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper className="km-panel km-location-detail-panel">
            <Stack gap="lg">
              <div className="km-location-hero">
                <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
                  <Stack gap="xs">
                    <Text className="km-section-kicker">Selected Site</Text>
                    <Title order={2}>{stringValue(draft.name) || "New Location Record"}</Title>
                    <Group gap="xs" wrap="wrap">
                      <Badge color="moss" variant="light">{formatLocationValue(draft.type) || "Landmark"}</Badge>
                      <Badge variant="outline">{formatLocationValue(draft.status) || "Active"}</Badge>
                      {stringValue(draft.hex) ? <Badge variant="outline">{draft.hex}</Badge> : null}
                      {stringValue(draft.controllingFaction) ? <Badge variant="outline">{draft.controllingFaction}</Badge> : null}
                    </Group>
                    <Text c="dimmed" maw={780}>
                      {stringValue(draft.whatChanged || draft.sceneTexture || draft.risks || draft.notes || "Record why this place matters, what it feels like now, and what answer it gives the party when they go there.") }
                    </Text>
                  </Stack>
                  <Group gap="sm" wrap="wrap">
                    <Button variant="default" onClick={handleReset} disabled={!draftDirty}>Reset</Button>
                    <Button color="moss" onClick={handleSave}>{selectedId === NEW_LOCATION_ID ? "Add Location" : "Save Location"}</Button>
                    {selectedLocation ? (
                      <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>Delete</Button>
                    ) : null}
                  </Group>
                </Group>
              </div>

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Current State</Text>
                      <Text>{stringValue(draft.whatChanged || "No current-state note recorded yet.")}</Text>
                      <Text size="sm" c="dimmed">{stringValue(draft.sceneTexture || "Use `Scene Texture` to note what the GM should emphasize when the party arrives.")}</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Pressure Read</Text>
                      <Text>{stringValue(draft.risks || "No active risk recorded yet.")}</Text>
                      <Text size="sm" c="dimmed">{stringValue(draft.opportunities || "Use `Opportunities` to capture what this location gives the party, the kingdom, or the story when explored well.")}</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Tabs.Root value={detailTab} onValueChange={setDetailTab} className="km-radix-tabs">
                <Tabs.List className="km-radix-list">
                  <Tabs.Trigger value="overview" className="km-radix-trigger">Overview</Tabs.Trigger>
                  <Tabs.Trigger value="scene" className="km-radix-trigger">Scene State</Tabs.Trigger>
                  <Tabs.Trigger value="links" className="km-radix-trigger">Links</Tabs.Trigger>
                  <Tabs.Trigger value="hex" className="km-radix-trigger">Hex & Region</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="overview" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Name" value={draft.name} onChange={(event) => updateDraft("name", event.currentTarget.value)} placeholder="Oleg's Trading Post" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <Select label="Type" value={draft.type} onChange={(value) => updateDraft("type", value || "landmark")} data={TYPE_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <Select label="Status" value={draft.status} onChange={(value) => updateDraft("status", value || "active")} data={STATUS_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput label="Hex" value={draft.hex} onChange={(event) => updateDraft("hex", event.currentTarget.value)} placeholder="D4" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput label="Controlling Faction" value={draft.controllingFaction} onChange={(event) => updateDraft("controllingFaction", event.currentTarget.value)} placeholder="Restov Swordlords / Bandits / Oleg's Trading Post" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput label="Folder" value={draft.folder} onChange={(event) => updateDraft("folder", event.currentTarget.value)} placeholder="Greenbelt / South Narlmarches / Restov" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="What Changed" value={draft.whatChanged} onChange={(event) => updateDraft("whatChanged", event.currentTarget.value)} minRows={3} placeholder="What is different about this place now?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Notes" value={draft.notes} onChange={(event) => updateDraft("notes", event.currentTarget.value)} minRows={4} placeholder="GM reminders, reveal order, or why this site keeps mattering later." />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="scene" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Textarea label="Scene Texture" value={draft.sceneTexture} onChange={(event) => updateDraft("sceneTexture", event.currentTarget.value)} minRows={3} placeholder="What should the GM emphasize in play when the party arrives?" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea label="Opportunities" value={draft.opportunities} onChange={(event) => updateDraft("opportunities", event.currentTarget.value)} minRows={4} placeholder="What can the party gain, learn, or unlock here?" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea label="Risks" value={draft.risks} onChange={(event) => updateDraft("risks", event.currentTarget.value)} minRows={4} placeholder="What is dangerous, unstable, or likely to get worse here?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Rumor" value={draft.rumor} onChange={(event) => updateDraft("rumor", event.currentTarget.value)} minRows={3} placeholder="What rumor or incomplete truth points the party toward this place?" />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="links" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Linked Quest" value={stringValue(draft.linkedQuest) || "__none__"} onChange={(value) => updateDraft("linkedQuest", value === "__none__" ? "" : value || "")} data={questData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Linked Event" value={stringValue(draft.linkedEvent) || "__none__"} onChange={(value) => updateDraft("linkedEvent", value === "__none__" ? "" : value || "")} data={eventData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Linked NPC" value={stringValue(draft.linkedNpc) || "__none__"} onChange={(value) => updateDraft("linkedNpc", value === "__none__" ? "" : value || "")} data={npcData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Quest Links</Text>
                            <Badge variant="outline">{linkedQuestRecords.length}</Badge>
                          </Group>
                          {linkedQuestRecords.length ? (
                            linkedQuestRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.title || "Quest"} meta={entry.status} body={entry.nextBeat || entry.objective} />
                            ))
                          ) : (
                            <Text c="dimmed">No quest currently points at this location.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Event Links</Text>
                            <Badge variant="outline">{linkedEventRecords.length}</Badge>
                          </Group>
                          {linkedEventRecords.length ? (
                            linkedEventRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.title || "Event"} meta={entry.status} body={entry.consequenceSummary || entry.fallout || entry.trigger} />
                            ))
                          ) : (
                            <Text c="dimmed">No event currently points at this location.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">NPC Links</Text>
                            <Badge variant="outline">{linkedNpcRecords.length}</Badge>
                          </Group>
                          {linkedNpcRecords.length ? (
                            linkedNpcRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.name || "NPC"} meta={entry.role || entry.status} body={entry.pressure || entry.agenda || entry.notes} />
                            ))
                          ) : (
                            <Text c="dimmed">No NPC currently points at this location.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Companion Presence</Text>
                            <Badge variant="outline">{linkedCompanionRecords.length}</Badge>
                          </Group>
                          {linkedCompanionRecords.length ? (
                            linkedCompanionRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.name || "Companion"} meta={entry.status} body={entry.nextScene || entry.personalQuest || entry.notes} />
                            ))
                          ) : (
                            <Text c="dimmed">No tracked companion is currently parked in this hex.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="hex" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Hex Map Markers</Text>
                            <Badge variant="outline">{linkedMarkers.length}</Badge>
                          </Group>
                          {linkedMarkers.length ? (
                            linkedMarkers.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.title || "Marker"} meta={entry.type} body={entry.notes} />
                            ))
                          ) : (
                            <Text c="dimmed">No hex-map marker is currently placed on this location's hex.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Kingdom Region Read</Text>
                            <Badge variant="outline">{linkedRegion ? "1" : "0"}</Badge>
                          </Group>
                          {linkedRegion ? (
                            <LinkedRecordCard
                              title={linkedRegion.hex || draft.hex || "Region"}
                              meta={linkedRegion.status || "Unknown"}
                              body={[linkedRegion.terrain, linkedRegion.discovery, linkedRegion.danger, linkedRegion.improvement].filter(Boolean).join(" / ")}
                            />
                          ) : (
                            <Text c="dimmed">No claimed-region record currently matches this hex.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Paper className="km-record-card">
                        <Stack gap="xs">
                          <Text className="km-section-kicker">Map Use</Text>
                          <Text>{stringValue(draft.hex) ? `This location currently anchors to hex ${draft.hex}.` : "Assign a hex if you want this location to show up more cleanly in the map-linked workflows."}</Text>
                          <Text size="sm" c="dimmed">Use the Hex Map for marker placement and the Kingdom tab for claimed-region changes. This page should answer why the site matters and what it feels like now.</Text>
                        </Stack>
                      </Paper>
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
