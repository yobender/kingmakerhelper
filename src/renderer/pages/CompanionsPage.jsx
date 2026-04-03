import { useEffect, useState } from "react";
import { Badge, Button, Grid, Group, Paper, Select, Slider, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconBook2, IconCrown, IconMap2, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import {
  COMPANION_QUEST_STAGE_OPTIONS,
  COMPANION_SPOTLIGHT_OPTIONS,
  COMPANION_STATUS_OPTIONS,
  COMPANION_TRAVEL_STATE_OPTIONS,
} from "../lib/campaignState";
import {
  buildCompanionsModel,
  collectCompanionHexLocations,
  collectLinkedCompanionEvents,
  collectLinkedCompanionQuests,
  getCompanionInfluenceBand,
} from "../lib/companions";
import { getLegacyWorkspaceUrl } from "../lib/desktop";

const NEW_COMPANION_ID = "__new__";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...COMPANION_STATUS_OPTIONS.map((value) => ({
    value,
    label: value.replace(/-/g, " "),
  })),
];

const STATUS_OPTIONS = COMPANION_STATUS_OPTIONS.map((value) => ({
  value,
  label: value.replace(/-/g, " "),
}));

const TRAVEL_STATE_OPTIONS = COMPANION_TRAVEL_STATE_OPTIONS.map((value) => ({
  value,
  label: value.replace(/-/g, " "),
}));

const QUEST_STAGE_OPTIONS = COMPANION_QUEST_STAGE_OPTIONS.map((value) => ({
  value,
  label: value.replace(/-/g, " "),
}));

const SPOTLIGHT_OPTIONS = COMPANION_SPOTLIGHT_OPTIONS.map((value) => ({
  value,
  label: value.replace(/-/g, " "),
}));

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function influenceValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(10, Math.round(parsed)));
}

function createCompanionDraft(companion, partyHex = "") {
  return {
    id: companion?.id || "",
    name: companion?.name || "",
    folder: companion?.folder || "",
    status: companion?.status || "prospective",
    influence: influenceValue(companion?.influence ?? 0),
    currentHex: companion?.currentHex || partyHex || "",
    recruitment: companion?.recruitment || "",
    influenceNotes: companion?.influenceNotes || "",
    relationshipHooks: companion?.relationshipHooks || "",
    friction: companion?.friction || "",
    travelState: companion?.travelState || "with-party",
    campRole: companion?.campRole || "",
    campNotes: companion?.campNotes || "",
    kingdomRole: companion?.kingdomRole || "",
    kingdomNotes: companion?.kingdomNotes || "",
    personalQuest: companion?.personalQuest || "",
    questStage: companion?.questStage || "seeded",
    questTrigger: companion?.questTrigger || "",
    nextScene: companion?.nextScene || "",
    linkedQuest: companion?.linkedQuest || "",
    linkedEvent: companion?.linkedEvent || "",
    spotlight: companion?.spotlight || "medium",
    notes: companion?.notes || "",
  };
}

function normalizeCompanionDraft(draft) {
  return {
    ...draft,
    influence: influenceValue(draft?.influence),
    currentHex: stringValue(draft?.currentHex).replace(/\s+/g, "").toUpperCase(),
  };
}

function isCompanionDraftDirty(draft, baseline) {
  const current = normalizeCompanionDraft(draft);
  const target = normalizeCompanionDraft(baseline);
  return [
    "name",
    "folder",
    "status",
    "influence",
    "currentHex",
    "recruitment",
    "influenceNotes",
    "relationshipHooks",
    "friction",
    "travelState",
    "campRole",
    "campNotes",
    "kingdomRole",
    "kingdomNotes",
    "personalQuest",
    "questStage",
    "questTrigger",
    "nextScene",
    "linkedQuest",
    "linkedEvent",
    "spotlight",
    "notes",
  ].some((key) => String(current?.[key] ?? "") !== String(target?.[key] ?? ""));
}

function buildSelectData(options, currentValue, emptyLabel) {
  const data = options.length ? [...options] : [];
  if (currentValue && !data.some((entry) => entry.value === currentValue)) {
    data.unshift({
      value: currentValue,
      label: currentValue,
    });
  }
  return emptyLabel ? [{ value: "__none__", label: emptyLabel }, ...data] : data;
}

function CompanionRosterItem({ companion, active, onSelect }) {
  const influenceBand = getCompanionInfluenceBand(companion?.influence);

  return (
    <button type="button" className={`km-companion-roster-item${active ? " is-active" : ""}`} onClick={onSelect}>
      <span className="km-companion-roster-item__head">
        <span className="km-companion-roster-item__title">{stringValue(companion?.name) || "Unnamed Companion"}</span>
        <span className="km-companion-roster-item__meta">{stringValue(companion?.status).replace(/-/g, " ") || "prospective"}</span>
      </span>
      <span className="km-companion-roster-item__chips">
        <span className="km-companion-chip">Influence {influenceValue(companion?.influence)}</span>
        {stringValue(companion?.currentHex) ? <span className="km-companion-chip">{stringValue(companion?.currentHex)}</span> : null}
      </span>
      <span className="km-companion-roster-item__summary">
        {stringValue(companion?.nextScene || companion?.personalQuest || companion?.notes || influenceBand.detail)}
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

export default function CompanionsPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildCompanionsModel(campaign);
  const [selectedId, setSelectedId] = useState(() => model.companions[0]?.id || NEW_COMPANION_ID);
  const [detailTab, setDetailTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const selectedCompanion = model.companions.find((entry) => entry.id === selectedId) || null;
  const [draft, setDraft] = useState(() => createCompanionDraft(selectedCompanion, model.partyHex));

  useEffect(() => {
    if (selectedId === NEW_COMPANION_ID) return;
    if (selectedCompanion) return;
    setSelectedId(model.companions[0]?.id || NEW_COMPANION_ID);
  }, [selectedId, selectedCompanion, model.companions[0]?.id]);

  useEffect(() => {
    setDraft(createCompanionDraft(selectedCompanion, model.partyHex));
  }, [selectedId, selectedCompanion?.updatedAt, model.partyHex]);

  const baselineDraft = createCompanionDraft(selectedCompanion, model.partyHex);
  const draftDirty = isCompanionDraftDirty(draft, baselineDraft);
  const influenceBand = getCompanionInfluenceBand(draft.influence);
  const filteredCompanions = model.companions.filter((entry) => {
    const statusMatches = statusFilter === "all" || stringValue(entry?.status) === statusFilter;
    if (!statusMatches) return false;
    const haystack = [
      entry?.name,
      entry?.status,
      entry?.currentHex,
      entry?.kingdomRole,
      entry?.personalQuest,
      entry?.nextScene,
      entry?.notes,
      entry?.folder,
    ]
      .map((value) => stringValue(value).toLowerCase())
      .join(" ");
    return haystack.includes(stringValue(searchValue).toLowerCase());
  });
  const questSelectData = buildSelectData(model.questOptions, stringValue(draft.linkedQuest), "No linked quest");
  const eventSelectData = buildSelectData(model.eventOptions, stringValue(draft.linkedEvent), "No linked event");
  const linkedQuestRecords = collectLinkedCompanionQuests(campaign, draft);
  const linkedEventRecords = collectLinkedCompanionEvents(campaign, draft);
  const currentHexLocations = collectCompanionHexLocations(campaign, draft);

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
        title: "Companion name required",
        message: "Add a companion name before saving the record.",
      });
      return;
    }

    const saved = actions.upsertCompanion(normalizeCompanionDraft(draft), selectedId === NEW_COMPANION_ID ? undefined : selectedId);
    if (!saved) return;
    setSelectedId(saved.id);
    notifications.show({
      color: "moss",
      title: selectedId === NEW_COMPANION_ID ? "Companion added" : "Companion updated",
      message: `${saved.name} is now tracked in the companion roster.`,
    });
  };

  const handleReset = () => {
    setDraft(createCompanionDraft(selectedCompanion, model.partyHex));
  };

  const handleDelete = () => {
    if (!selectedCompanion) return;
    if (!window.confirm(`Delete ${selectedCompanion.name}?`)) return;
    const removed = actions.removeCompanion(selectedCompanion.id);
    if (!removed) return;
    setSelectedId(model.companions.find((entry) => entry.id !== selectedCompanion.id)?.id || NEW_COMPANION_ID);
    notifications.show({
      color: "moss",
      title: "Companion removed",
      message: `${selectedCompanion.name} was removed from the roster.`,
    });
  };

  const handleNewCompanion = () => {
    setSelectedId(NEW_COMPANION_ID);
    setDetailTab("overview");
  };

  const handleSetToPartyHex = () => {
    if (!model.partyHex) {
      notifications.show({
        color: "ember",
        title: "Party hex not set",
        message: "Set the party position on the Hex Map first.",
      });
      return;
    }
    setDraft((current) => ({
      ...current,
      currentHex: model.partyHex,
      travelState: "with-party",
    }));
  };

  const roleHints = model.roleOptions.length ? model.roleOptions.join(", ") : "No kingdom role profile loaded yet.";

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="World"
        title="Companions"
        description="Track influence, recruitment, camp presence, personal quests, and kingdom-role fit with the Companion Guide and PF2e Kingmaker play loop in mind."
        actions={(
          <>
            <Button variant="default" leftSection={<IconMap2 size={16} />} onClick={() => navigate("/world/hex-map")}>
              Open Hex Map
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
            <Paper className="km-panel km-companion-roster-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text className="km-section-kicker">Companion Roster</Text>
                    <Text c="dimmed">Recruitable allies, active travelers, and kingdom-facing companions.</Text>
                  </Stack>
                  <Button size="compact-md" color="moss" onClick={handleNewCompanion}>
                    New Companion
                  </Button>
                </Group>

                <Grid gutter="sm">
                  <Grid.Col span={7}>
                    <TextInput
                      label="Search"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.currentTarget.value)}
                      placeholder="Linzi, Oleg, chronicler..."
                    />
                  </Grid.Col>
                  <Grid.Col span={5}>
                    <Select
                      label="Status"
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value || "all")}
                      data={STATUS_FILTER_OPTIONS}
                      allowDeselect={false}
                    />
                  </Grid.Col>
                </Grid>

                <Stack gap="sm" className="km-companion-roster-list">
                  {filteredCompanions.length ? (
                    filteredCompanions.map((companion) => (
                      <CompanionRosterItem
                        key={companion.id}
                        companion={companion}
                        active={companion.id === selectedId}
                        onSelect={() => setSelectedId(companion.id)}
                      />
                    ))
                  ) : (
                    <Text c="dimmed">No companions match the current filters.</Text>
                  )}
                </Stack>
              </Stack>
            </Paper>

            <Paper className="km-panel km-content-panel">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Text className="km-section-kicker">Attention Watch</Text>
                  <Badge variant="outline">{model.attentionRoster.length}</Badge>
                </Group>
                {model.attentionRoster.length ? (
                  model.attentionRoster.map((entry) => (
                    <LinkedRecordCard
                      key={entry.id}
                      title={entry.name}
                      meta={`${stringValue(entry.status).replace(/-/g, " ")} / ${stringValue(entry.spotlight).replace(/-/g, " ") || "medium"} spotlight`}
                      body={stringValue(entry.nextScene || entry.personalQuest || entry.questTrigger || entry.notes)}
                    />
                  ))
                ) : (
                  <Text c="dimmed">No companion beats are currently demanding attention.</Text>
                )}
              </Stack>
            </Paper>

          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper className="km-panel km-companion-detail-panel">
            <Stack gap="lg">
              <div className="km-companion-hero">
                <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
                  <Stack gap="xs">
                    <Text className="km-section-kicker">Selected Companion</Text>
                    <Title order={2}>{stringValue(draft.name) || "New Companion Record"}</Title>
                    <Group gap="xs" wrap="wrap">
                      <Badge color="moss" variant="light">{stringValue(draft.status).replace(/-/g, " ") || "prospective"}</Badge>
                      <Badge variant="outline">Influence {influenceValue(draft.influence)}</Badge>
                      <Badge variant="outline">{influenceBand.label}</Badge>
                      {stringValue(draft.currentHex) ? <Badge variant="outline">{draft.currentHex}</Badge> : null}
                    </Group>
                    <Text c="dimmed" maw={760}>
                      {stringValue(draft.personalQuest || draft.nextScene || draft.notes || influenceBand.detail)}
                    </Text>
                  </Stack>

                  <Group gap="sm" wrap="wrap">
                    <Button variant="default" onClick={handleReset} disabled={!draftDirty}>
                      Reset
                    </Button>
                    <Button color="moss" onClick={handleSave}>
                      {selectedId === NEW_COMPANION_ID ? "Add Companion" : "Save Companion"}
                    </Button>
                    {selectedCompanion ? (
                      <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                        Delete
                      </Button>
                    ) : null}
                  </Group>
                </Group>
              </div>

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 4 }} offset={{ md: 8 }}>
                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text className="km-section-kicker">Party Link</Text>
                      <Text>{model.partyHex ? `${model.partyLabel} is currently in ${model.partyHex}.` : "The party hex is not set yet."}</Text>
                      <Button variant="light" color="moss" onClick={handleSetToPartyHex}>
                        Set To Party Hex
                      </Button>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Tabs.Root value={detailTab} onValueChange={setDetailTab} className="km-radix-tabs">
                <Tabs.List className="km-radix-list">
                  <Tabs.Trigger value="overview" className="km-radix-trigger">Overview</Tabs.Trigger>
                  <Tabs.Trigger value="influence" className="km-radix-trigger">Influence</Tabs.Trigger>
                  <Tabs.Trigger value="travel" className="km-radix-trigger">Travel & Camp</Tabs.Trigger>
                  <Tabs.Trigger value="quest" className="km-radix-trigger">Personal Quest</Tabs.Trigger>
                  <Tabs.Trigger value="kingdom" className="km-radix-trigger">Kingdom Fit</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="overview" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput label="Name" value={draft.name} onChange={(event) => updateDraft("name", event.currentTarget.value)} placeholder="Linzi" />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Folder / Group"
                        value={draft.folder}
                        onChange={(event) => updateDraft("folder", event.currentTarget.value)}
                        placeholder={model.folderOptions[0]?.value || "Core Companions"}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select label="Status" value={draft.status} onChange={(value) => updateDraft("status", value || "prospective")} data={STATUS_OPTIONS} allowDeselect={false} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput
                        label="Current Hex"
                        value={draft.currentHex}
                        onChange={(event) => updateDraft("currentHex", event.currentTarget.value)}
                        placeholder="D4"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Spotlight Need"
                        value={draft.spotlight}
                        onChange={(value) => updateDraft("spotlight", value || "medium")}
                        data={SPOTLIGHT_OPTIONS}
                        allowDeselect={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea
                        label="Recruitment / Meeting Hook"
                        value={draft.recruitment}
                        onChange={(event) => updateDraft("recruitment", event.currentTarget.value)}
                        minRows={2}
                        placeholder="How the party meets, influences, or earns this companion."
                      />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea
                        label="General Notes"
                        value={draft.notes}
                        onChange={(event) => updateDraft("notes", event.currentTarget.value)}
                        minRows={4}
                        placeholder="Why they matter, what changes around them, and what the party should feel when they are on screen."
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="influence" className="km-radix-content">
                  <Paper className="km-record-card">
                    <Stack gap="lg">
                      <div>
                        <Group justify="space-between" align="center">
                          <Text fw={700}>Influence</Text>
                          <Badge color="moss" variant="light">{influenceBand.label}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">{influenceBand.detail}</Text>
                      </div>
                      <Slider
                        value={influenceValue(draft.influence)}
                        onChange={(value) => updateDraft("influence", value)}
                        min={0}
                        max={10}
                        step={1}
                        marks={[
                          { value: 0, label: "0" },
                          { value: 2, label: "2" },
                          { value: 5, label: "5" },
                          { value: 8, label: "8" },
                          { value: 10, label: "10" },
                        ]}
                        color="moss"
                      />
                    </Stack>
                  </Paper>

                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Textarea
                        label="Influence Notes"
                        value={draft.influenceNotes}
                        onChange={(event) => updateDraft("influenceNotes", event.currentTarget.value)}
                        minRows={3}
                        placeholder="What earns trust, what damages it, and what signals the PCs should recognize."
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        label="Relationship Hooks"
                        value={draft.relationshipHooks}
                        onChange={(event) => updateDraft("relationshipHooks", event.currentTarget.value)}
                        minRows={3}
                        placeholder="Topics, asks, camp scenes, or reactions worth surfacing next."
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        label="Friction / Fault Lines"
                        value={draft.friction}
                        onChange={(event) => updateDraft("friction", event.currentTarget.value)}
                        minRows={3}
                        placeholder="What choices this companion hates, fears, or challenges."
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="travel" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Select
                        label="Travel State"
                        value={draft.travelState}
                        onChange={(value) => updateDraft("travelState", value || "with-party")}
                        data={TRAVEL_STATE_OPTIONS}
                        allowDeselect={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Camp Role"
                        value={draft.campRole}
                        onChange={(event) => updateDraft("campRole", event.currentTarget.value)}
                        placeholder="Watch, storykeeper, healer, scout..."
                      />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea
                        label="Camp Notes"
                        value={draft.campNotes}
                        onChange={(event) => updateDraft("campNotes", event.currentTarget.value)}
                        minRows={4}
                        placeholder="What scenes, duties, or camp complications this companion should generate while traveling."
                      />
                    </Grid.Col>
                  </Grid>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Text className="km-section-kicker">Current Hex Context</Text>
                          {currentHexLocations.length ? (
                            currentHexLocations.map((entry) => (
                              <LinkedRecordCard
                                key={entry.id}
                                title={entry.name || "Location"}
                                meta={entry.hex || ""}
                                body={stringValue(entry.whatChanged || entry.notes)}
                              />
                            ))
                          ) : (
                            <Text c="dimmed">No location records are currently tied to this hex.</Text>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="sm">
                          <Text className="km-section-kicker">Travel Watch</Text>
                          <Text>
                            {model.partyHex
                              ? `${model.partyLabel} is in ${model.partyHex}. Use this tab to keep companions either with the party, back at camp, or on kingdom duty.`
                              : "Set the party position in Hex Map so travel-state calls are easier to manage."}
                          </Text>
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="quest" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <Textarea
                        label="Personal Quest"
                        value={draft.personalQuest}
                        onChange={(event) => updateDraft("personalQuest", event.currentTarget.value)}
                        minRows={3}
                        placeholder="What unresolved companion story belongs to them?"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Quest Stage"
                        value={draft.questStage}
                        onChange={(value) => updateDraft("questStage", value || "seeded")}
                        data={QUEST_STAGE_OPTIONS}
                        allowDeselect={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Linked Quest"
                        value={stringValue(draft.linkedQuest) || "__none__"}
                        onChange={(value) => updateDraft("linkedQuest", value === "__none__" ? "" : value || "")}
                        data={questSelectData}
                        allowDeselect={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Linked Event"
                        value={stringValue(draft.linkedEvent) || "__none__"}
                        onChange={(value) => updateDraft("linkedEvent", value === "__none__" ? "" : value || "")}
                        data={eventSelectData}
                        allowDeselect={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        label="Quest Trigger"
                        value={draft.questTrigger}
                        onChange={(event) => updateDraft("questTrigger", event.currentTarget.value)}
                        minRows={3}
                        placeholder="What chapter beat, kingdom change, or relationship turn starts this quest?"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        label="Next Scene / Next Beat"
                        value={draft.nextScene}
                        onChange={(event) => updateDraft("nextScene", event.currentTarget.value)}
                        minRows={3}
                        placeholder="What exact scene or decision should happen next?"
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="kingdom" className="km-radix-content">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Kingdom Role / Best Fit"
                        value={draft.kingdomRole}
                        onChange={(event) => updateDraft("kingdomRole", event.currentTarget.value)}
                        placeholder="Counselor, General, Treasurer..."
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Paper className="km-record-card">
                        <Stack gap="xs">
                          <Text className="km-section-kicker">Current Role Library</Text>
                          <Text size="sm" c="dimmed">{roleHints}</Text>
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea
                        label="Kingdom Notes"
                        value={draft.kingdomNotes}
                        onChange={(event) => updateDraft("kingdomNotes", event.currentTarget.value)}
                        minRows={4}
                        placeholder="Why this companion fits that role, what kingdom work they stabilize, and what political fallout they attract."
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Content>
              </Tabs.Root>

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper className="km-record-card">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text className="km-section-kicker">Linked Quests</Text>
                        <Badge variant="outline">{linkedQuestRecords.length}</Badge>
                      </Group>
                      {linkedQuestRecords.length ? (
                        linkedQuestRecords.map((entry) => (
                          <LinkedRecordCard
                            key={entry.id}
                            title={entry.title || "Quest"}
                            meta={`${stringValue(entry.status)}${stringValue(entry.hex) ? ` / ${stringValue(entry.hex)}` : ""}`}
                            body={stringValue(entry.nextBeat || entry.objective || entry.stakes)}
                          />
                        ))
                      ) : (
                        <Text c="dimmed">No quest record currently points at this companion.</Text>
                      )}
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper className="km-record-card">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text className="km-section-kicker">Linked Events</Text>
                        <Badge variant="outline">{linkedEventRecords.length}</Badge>
                      </Group>
                      {linkedEventRecords.length ? (
                        linkedEventRecords.map((entry) => (
                          <LinkedRecordCard
                            key={entry.id}
                            title={entry.title || "Event"}
                            meta={`${stringValue(entry.status)}${stringValue(entry.hex) ? ` / ${stringValue(entry.hex)}` : ""}`}
                            body={stringValue(entry.trigger || entry.consequenceSummary || entry.notes)}
                          />
                        ))
                      ) : (
                        <Text c="dimmed">No event record currently points at this companion.</Text>
                      )}
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper className="km-record-card">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text className="km-section-kicker">Current Hex</Text>
                        <Badge variant="outline">{stringValue(draft.currentHex) || "None"}</Badge>
                      </Group>
                      {currentHexLocations.length ? (
                        currentHexLocations.map((entry) => (
                          <LinkedRecordCard
                            key={entry.id}
                            title={entry.name || "Location"}
                            meta={stringValue(entry.hex)}
                            body={stringValue(entry.whatChanged || entry.notes)}
                          />
                        ))
                      ) : (
                        <Text c="dimmed">No location or landmark context is currently recorded for this hex.</Text>
                      )}
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
