import { useEffect, useState } from "react";
import { Badge, Button, Grid, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconBellRinging, IconBook2, IconMap2, IconTrash, IconUsersGroup } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { QUEST_PRIORITY_OPTIONS, QUEST_STATUS_OPTIONS } from "../lib/campaignState";
import {
  buildQuestsModel,
  collectLinkedQuestCompanions,
  collectLinkedQuestEvents,
  collectLinkedQuestNpcs,
  collectQuestLocations,
} from "../lib/quests";
import { getLegacyWorkspaceUrl } from "../lib/desktop";

const NEW_QUEST_ID = "__new__";

const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All statuses" }, ...QUEST_STATUS_OPTIONS.map((value) => ({ value, label: value }))];
const PRIORITY_FILTER_OPTIONS = [{ value: "all", label: "All priorities" }, ...QUEST_PRIORITY_OPTIONS.map((value) => ({ value, label: value }))];
const STATUS_OPTIONS = QUEST_STATUS_OPTIONS.map((value) => ({ value, label: value }));
const PRIORITY_OPTIONS = QUEST_PRIORITY_OPTIONS.map((value) => ({ value, label: value }));

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

function createQuestDraft(quest) {
  return {
    id: quest?.id || "",
    title: quest?.title || "",
    status: quest?.status || "open",
    priority: quest?.priority || "Soon",
    chapter: quest?.chapter || "",
    folder: quest?.folder || "",
    giver: quest?.giver || "",
    hex: quest?.hex || "",
    linkedCompanion: quest?.linkedCompanion || "",
    linkedEvent: quest?.linkedEvent || "",
    objective: quest?.objective || "",
    stakes: quest?.stakes || "",
    nextBeat: quest?.nextBeat || "",
    blockers: quest?.blockers || "",
    reward: quest?.reward || "",
    notes: quest?.notes || "",
  };
}

function normalizeQuestDraft(draft) {
  return {
    ...draft,
    hex: stringValue(draft?.hex).replace(/\s+/g, "").toUpperCase(),
  };
}

function isQuestDraftDirty(draft, baseline) {
  const current = normalizeQuestDraft(draft);
  const target = normalizeQuestDraft(baseline);
  return [
    "title",
    "status",
    "priority",
    "chapter",
    "folder",
    "giver",
    "hex",
    "linkedCompanion",
    "linkedEvent",
    "objective",
    "stakes",
    "nextBeat",
    "blockers",
    "reward",
    "notes",
  ].some((key) => String(current?.[key] ?? "") !== String(target?.[key] ?? ""));
}

function QuestRosterItem({ quest, active, onSelect }) {
  return (
    <button type="button" className={`km-quest-roster-item${active ? " is-active" : ""}`} onClick={onSelect}>
      <span className="km-quest-roster-item__head">
        <span className="km-quest-roster-item__title">{stringValue(quest?.title) || "Untitled Quest"}</span>
        <span className="km-quest-roster-item__meta">{stringValue(quest?.status) || "open"}</span>
      </span>
      <span className="km-quest-roster-item__chips">
        <span className="km-companion-chip">{stringValue(quest?.priority) || "Soon"}</span>
        {stringValue(quest?.chapter) ? <span className="km-companion-chip">{stringValue(quest.chapter)}</span> : null}
        {stringValue(quest?.hex) ? <span className="km-companion-chip">{stringValue(quest.hex)}</span> : null}
      </span>
      <span className="km-quest-roster-item__summary">
        {stringValue(quest?.nextBeat || quest?.objective || quest?.stakes || quest?.notes)}
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

export default function QuestsPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildQuestsModel(campaign);
  const [selectedId, setSelectedId] = useState(() => model.quests[0]?.id || NEW_QUEST_ID);
  const [detailTab, setDetailTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const selectedQuest = model.quests.find((entry) => entry.id === selectedId) || null;
  const [draft, setDraft] = useState(() => createQuestDraft(selectedQuest));

  useEffect(() => {
    if (selectedId === NEW_QUEST_ID) return;
    if (selectedQuest) return;
    setSelectedId(model.quests[0]?.id || NEW_QUEST_ID);
  }, [selectedId, selectedQuest, model.quests]);

  useEffect(() => {
    if (selectedId === NEW_QUEST_ID) return;
    setDraft(createQuestDraft(selectedQuest));
  }, [selectedId, selectedQuest?.updatedAt]);

  const baselineDraft = createQuestDraft(selectedQuest);
  const draftDirty = isQuestDraftDirty(draft, baselineDraft);
  const giverData = buildSelectData(model.giverOptions, stringValue(draft.giver), "No tracked giver");
  const companionData = buildSelectData(model.companionOptions, stringValue(draft.linkedCompanion), "No linked companion");
  const eventData = buildSelectData(model.eventOptions, stringValue(draft.linkedEvent), "No linked event");
  const linkedEventRecords = collectLinkedQuestEvents(campaign, draft);
  const linkedCompanionRecords = collectLinkedQuestCompanions(campaign, draft);
  const linkedNpcRecords = collectLinkedQuestNpcs(campaign, draft);
  const linkedLocationRecords = collectQuestLocations(campaign, draft);

  const filteredQuests = model.quests.filter((entry) => {
    if (statusFilter !== "all" && stringValue(entry?.status) !== statusFilter) return false;
    if (priorityFilter !== "all" && stringValue(entry?.priority) !== priorityFilter) return false;
    const haystack = [
      entry?.title,
      entry?.status,
      entry?.priority,
      entry?.chapter,
      entry?.giver,
      entry?.hex,
      entry?.objective,
      entry?.stakes,
      entry?.nextBeat,
      entry?.notes,
      entry?.folder,
      entry?.linkedCompanion,
      entry?.linkedEvent,
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
    if (!stringValue(draft.title)) {
      notifications.show({
        color: "ember",
        title: "Quest title required",
        message: "Add a quest title before saving the record.",
      });
      return;
    }
    const saved = actions.upsertQuest(normalizeQuestDraft(draft), selectedId === NEW_QUEST_ID ? undefined : selectedId);
    if (!saved) return;
    setSelectedId(saved.id);
    notifications.show({
      color: "moss",
      title: selectedId === NEW_QUEST_ID ? "Quest added" : "Quest updated",
      message: `${saved.title} is now tracked on the quest board.`,
    });
  };

  const handleReset = () => {
    setDraft(createQuestDraft(selectedQuest));
  };

  const handleDelete = () => {
    if (!selectedQuest) return;
    if (!window.confirm(`Delete ${selectedQuest.title}?`)) return;
    const removed = actions.removeQuest(selectedQuest.id);
    if (!removed) return;
    const fallbackId = model.quests.find((entry) => entry.id !== selectedQuest.id)?.id || NEW_QUEST_ID;
    setSelectedId(fallbackId);
    if (fallbackId === NEW_QUEST_ID) {
      setDraft(createQuestDraft(null));
    }
    notifications.show({
      color: "moss",
      title: "Quest removed",
      message: `${selectedQuest.title} was removed from the quest board.`,
    });
  };

  const handleNewQuest = () => {
    setSelectedId(NEW_QUEST_ID);
    setDraft(createQuestDraft(null));
    setDetailTab("overview");
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="World"
        title="Quests"
        description="Keep the Kingmaker objective stack readable: what matters now, what it costs to delay, what hex or chapter it points at, and which companion, NPC, or event thread is pushing it."
        actions={(
          <>
            <Button variant="default" leftSection={<IconBellRinging size={16} />} onClick={() => navigate("/world/events")}>
              Open Events
            </Button>
            <Button variant="default" leftSection={<IconUsersGroup size={16} />} onClick={() => navigate("/world/companions")}>
              Open Companions
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
            <Paper className="km-panel km-quest-roster-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text className="km-section-kicker">Quest Board</Text>
                    <Text c="dimmed">The frontier mission stack, with chapter and map context.</Text>
                  </Stack>
                  <Button size="compact-md" color="moss" onClick={handleNewQuest}>
                    New Quest
                  </Button>
                </Group>

                <Grid gutter="sm">
                  <Grid.Col span={12}>
                    <TextInput label="Search" value={searchValue} onChange={(event) => setSearchValue(event.currentTarget.value)} placeholder="bandits, charter, troll trouble..." />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value || "all")} data={STATUS_FILTER_OPTIONS} allowDeselect={false} />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select label="Priority" value={priorityFilter} onChange={(value) => setPriorityFilter(value || "all")} data={PRIORITY_FILTER_OPTIONS} allowDeselect={false} />
                  </Grid.Col>
                </Grid>

                <Stack gap="sm" className="km-quest-roster-list">
                  {filteredQuests.length ? (
                    filteredQuests.map((quest) => (
                      <QuestRosterItem key={quest.id} quest={quest} active={quest.id === selectedId} onSelect={() => setSelectedId(quest.id)} />
                    ))
                  ) : (
                    <Text c="dimmed">No quests match the current filters.</Text>
                  )}
                </Stack>
              </Stack>
            </Paper>

          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper className="km-panel km-quest-detail-panel">
            <Stack gap="lg">
              <div className="km-quest-hero">
                <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
                  <Stack gap="xs">
                    <Text className="km-section-kicker">Selected Thread</Text>
                    <Title order={2}>{stringValue(draft.title) || "New Quest Record"}</Title>
                    <Group gap="xs" wrap="wrap">
                      <Badge color="moss" variant="light">{stringValue(draft.priority) || "Soon"}</Badge>
                      <Badge variant="outline">{stringValue(draft.status) || "open"}</Badge>
                      {stringValue(draft.chapter) ? <Badge variant="outline">{stringValue(draft.chapter)}</Badge> : null}
                      {stringValue(draft.hex) ? <Badge variant="outline">{stringValue(draft.hex)}</Badge> : null}
                    </Group>
                    <Text c="dimmed" maw={780}>
                      {stringValue(draft.nextBeat || draft.objective || draft.stakes || draft.notes || "Record the objective, what delay costs, and the cleanest next move.") }
                    </Text>
                  </Stack>
                  <Group gap="sm" wrap="wrap">
                    <Button variant="default" onClick={handleReset} disabled={!draftDirty}>Reset</Button>
                    <Button color="moss" onClick={handleSave}>{selectedId === NEW_QUEST_ID ? "Add Quest" : "Save Quest"}</Button>
                    {selectedQuest ? (
                      <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>Delete</Button>
                    ) : null}
                  </Group>
                </Group>
              </div>

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Objective Read</Text>
                      <Text>{stringValue(draft.objective || "No objective recorded yet.")}</Text>
                      <Text size="sm" c="dimmed">{stringValue(draft.nextBeat || "Use `Next Beat` to capture the next visible choice, clue, or confrontation.")}</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Delay Cost</Text>
                      <Text>{stringValue(draft.stakes || "No stakes recorded yet.")}</Text>
                      <Text size="sm" c="dimmed">{stringValue(draft.blockers || "Use `Blockers` to note what is slowing the party or why this quest cannot simply be resolved now.")}</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Tabs.Root value={detailTab} onValueChange={setDetailTab} className="km-radix-tabs">
                <Tabs.List className="km-radix-list">
                  <Tabs.Trigger value="overview" className="km-radix-trigger">Overview</Tabs.Trigger>
                  <Tabs.Trigger value="pressure" className="km-radix-trigger">Pressure</Tabs.Trigger>
                  <Tabs.Trigger value="links" className="km-radix-trigger">Links</Tabs.Trigger>
                  <Tabs.Trigger value="reward" className="km-radix-trigger">Reward & Notes</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="overview" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Title" value={draft.title} onChange={(event) => updateDraft("title", event.currentTarget.value)} placeholder="Secure Oleg's Trading Post" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <Select label="Status" value={draft.status} onChange={(value) => updateDraft("status", value || "open")} data={STATUS_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <Select label="Priority" value={draft.priority} onChange={(value) => updateDraft("priority", value || "Soon")} data={PRIORITY_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Chapter / Arc" value={draft.chapter} onChange={(event) => updateDraft("chapter", event.currentTarget.value)} placeholder="Chapter 1: A Call for Heroes" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Folder" value={draft.folder} onChange={(event) => updateDraft("folder", event.currentTarget.value)} placeholder="Greenbelt / Troll Trouble / Companion Arc" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select label="Giver" value={stringValue(draft.giver) || "__none__"} onChange={(value) => updateDraft("giver", value === "__none__" ? "" : value || "")} data={giverData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <TextInput label="Hex" value={draft.hex} onChange={(event) => updateDraft("hex", event.currentTarget.value)} placeholder="D4" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <Select label="Linked Companion" value={stringValue(draft.linkedCompanion) || "__none__"} onChange={(value) => updateDraft("linkedCompanion", value === "__none__" ? "" : value || "")} data={companionData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select label="Linked Event" value={stringValue(draft.linkedEvent) || "__none__"} onChange={(value) => updateDraft("linkedEvent", value === "__none__" ? "" : value || "")} data={eventData} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Objective" value={draft.objective} onChange={(event) => updateDraft("objective", event.currentTarget.value)} minRows={4} placeholder="What must the party actually achieve?" />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="pressure" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Textarea label="Stakes" value={draft.stakes} onChange={(event) => updateDraft("stakes", event.currentTarget.value)} minRows={4} placeholder="What changes if the party delays, fails, or handles this poorly?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Next Beat" value={draft.nextBeat} onChange={(event) => updateDraft("nextBeat", event.currentTarget.value)} minRows={4} placeholder="What clue, scene, or pressure move should bring this quest back onstage next?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="Blockers" value={draft.blockers} onChange={(event) => updateDraft("blockers", event.currentTarget.value)} minRows={3} placeholder="What is currently slowing progress or making the answer costly?" />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="links" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Linked Events</Text>
                            <Badge variant="outline">{linkedEventRecords.length}</Badge>
                          </Group>
                          {linkedEventRecords.length ? (
                            linkedEventRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.title || "Event"} meta={entry.status} body={entry.consequenceSummary || entry.fallout || entry.trigger} />
                            ))
                          ) : (
                            <Text c="dimmed">No event currently points at this quest.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Linked Companions</Text>
                            <Badge variant="outline">{linkedCompanionRecords.length}</Badge>
                          </Group>
                          {linkedCompanionRecords.length ? (
                            linkedCompanionRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.name || "Companion"} meta={entry.status} body={entry.nextScene || entry.personalQuest || entry.notes} />
                            ))
                          ) : (
                            <Text c="dimmed">No companion currently points at this quest.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Linked NPCs</Text>
                            <Badge variant="outline">{linkedNpcRecords.length}</Badge>
                          </Group>
                          {linkedNpcRecords.length ? (
                            linkedNpcRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.name || "NPC"} meta={entry.role || entry.status} body={entry.pressure || entry.agenda || entry.notes} />
                            ))
                          ) : (
                            <Text c="dimmed">No NPC is currently tied to this quest's lane.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text className="km-section-kicker">Linked Locations</Text>
                            <Badge variant="outline">{linkedLocationRecords.length}</Badge>
                          </Group>
                          {linkedLocationRecords.length ? (
                            linkedLocationRecords.map((entry) => (
                              <LinkedRecordCard key={entry.id} title={entry.name || "Location"} meta={entry.hex} body={entry.whatChanged || entry.notes} />
                            ))
                          ) : (
                            <Text c="dimmed">No tracked location currently matches this quest's hex.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="reward" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Textarea label="Reward / Payoff" value={draft.reward} onChange={(event) => updateDraft("reward", event.currentTarget.value)} minRows={3} placeholder="What does success materially or politically unlock?" />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea label="GM Notes" value={draft.notes} onChange={(event) => updateDraft("notes", event.currentTarget.value)} minRows={5} placeholder="Chapter references, reveal order, route ideas, or how this quest should evolve into a later front." />
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
