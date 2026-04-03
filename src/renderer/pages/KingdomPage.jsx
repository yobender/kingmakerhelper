import { useEffect, useState } from "react";
import { Accordion, ActionIcon, Badge, Button, Grid, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { diffGolarionDates, formatGolarionDate } from "../lib/golarion";
import {
  buildKingdomCalendarEntrySummary,
  buildKingdomCalendarMonthMatrix,
  buildKingdomModel,
  formatSignedNumber,
  getKingdomRulesProfiles,
  KINGDOM_CIVIC_STRUCTURE_OPTIONS,
  KINGDOM_LEADER_TYPE_OPTIONS,
  KINGDOM_REGION_STATUS_OPTIONS,
  KINGDOM_RESOURCE_DIE_OPTIONS,
  KINGDOM_SETTLEMENT_SIZE_OPTIONS,
  KINGDOM_TERRAIN_OPTIONS,
  KINGDOM_WEEKDAY_LABELS,
} from "../lib/kingdom";

function buildOverviewDraft(kingdom) {
  return {
    profileId: kingdom?.profileId || "",
    name: kingdom?.name || "",
    charter: kingdom?.charter || "",
    government: kingdom?.government || "",
    heartland: kingdom?.heartland || "",
    capital: kingdom?.capital || "",
    currentTurnLabel: kingdom?.currentTurnLabel || "",
    currentDate: kingdom?.currentDate || "",
    level: String(kingdom?.level ?? 1),
    size: String(kingdom?.size ?? 1),
    controlDC: String(kingdom?.controlDC ?? 14),
    resourceDie: kingdom?.resourceDie || "d4",
    resourcePoints: String(kingdom?.resourcePoints ?? 0),
    xp: String(kingdom?.xp ?? 0),
    culture: String(kingdom?.abilities?.culture ?? 0),
    economy: String(kingdom?.abilities?.economy ?? 0),
    loyalty: String(kingdom?.abilities?.loyalty ?? 0),
    stability: String(kingdom?.abilities?.stability ?? 0),
    food: String(kingdom?.commodities?.food ?? 0),
    lumber: String(kingdom?.commodities?.lumber ?? 0),
    luxuries: String(kingdom?.commodities?.luxuries ?? 0),
    ore: String(kingdom?.commodities?.ore ?? 0),
    stone: String(kingdom?.commodities?.stone ?? 0),
    consumption: String(kingdom?.consumption ?? 0),
    renown: String(kingdom?.renown ?? 0),
    fame: String(kingdom?.fame ?? 0),
    infamy: String(kingdom?.infamy ?? 0),
    unrest: String(kingdom?.unrest ?? 0),
    corruption: String(kingdom?.ruin?.corruption ?? 0),
    crime: String(kingdom?.ruin?.crime ?? 0),
    decay: String(kingdom?.ruin?.decay ?? 0),
    strife: String(kingdom?.ruin?.strife ?? 0),
    ruinThreshold: String(kingdom?.ruin?.threshold ?? 5),
    notes: kingdom?.notes || "",
    pendingProjects: (kingdom?.pendingProjects || []).join("\n"),
    dateNotes: "",
  };
}

function createLeaderDraft(defaultRole = "") {
  return {
    role: defaultRole,
    name: "",
    type: "NPC",
    leadershipBonus: "0",
    relevantSkills: "",
    specializedSkills: "",
    notes: "",
  };
}

function createSettlementDraft() {
  return {
    name: "",
    size: "Village",
    influence: "0",
    civicStructure: "",
    resourceDice: "0",
    consumption: "0",
    notes: "",
  };
}

function createRegionDraft() {
  return {
    hex: "",
    status: "Claimed",
    terrain: "Plains",
    workSite: "",
    discovery: "",
    danger: "",
    improvement: "",
    notes: "",
  };
}

function createTurnDraft(kingdom) {
  return {
    title: kingdom?.currentTurnLabel || "",
    date: kingdom?.currentDate || "",
    summary: "",
    risks: "",
    eventSummary: "",
    pendingProject: "",
    rpDelta: "0",
    unrestDelta: "0",
    renownDelta: "0",
    fameDelta: "0",
    infamyDelta: "0",
    foodDelta: "0",
    lumberDelta: "0",
    luxuriesDelta: "0",
    oreDelta: "0",
    stoneDelta: "0",
    corruptionDelta: "0",
    crimeDelta: "0",
    decayDelta: "0",
    strifeDelta: "0",
    notes: "",
  };
}

function createCalendarAdvanceDraft() {
  return {
    days: "1",
    label: "",
    notes: "",
  };
}

function createCalendarSetDraft(kingdom) {
  return {
    date: kingdom?.currentDate || "",
    label: "",
    notes: "",
  };
}

function textInputProps(label, value, onChange, extra = {}) {
  return {
    label,
    value,
    onChange: (event) => onChange(event.currentTarget.value),
    ...extra,
  };
}

export default function KingdomPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildKingdomModel(campaign);
  const profileOptions = getKingdomRulesProfiles().map((profile) => ({
    value: profile.id,
    label: profile.label,
  }));
  const roleOptions = model.roleOptions.map((role) => ({
    value: role,
    label: role,
  }));
  const [overviewDraft, setOverviewDraft] = useState(() => buildOverviewDraft(model.kingdom));
  const [leaderDraft, setLeaderDraft] = useState(() => createLeaderDraft(model.roleOptions[0] || "Ruler"));
  const [settlementDraft, setSettlementDraft] = useState(createSettlementDraft);
  const [regionDraft, setRegionDraft] = useState(createRegionDraft);
  const [turnDraft, setTurnDraft] = useState(() => createTurnDraft(model.kingdom));
  const [calendarAdvanceDraft, setCalendarAdvanceDraft] = useState(createCalendarAdvanceDraft);
  const [calendarSetDraft, setCalendarSetDraft] = useState(() => createCalendarSetDraft(model.kingdom));
  const [mainTab, setMainTab] = useState("sheet");
  const [sheetTab, setSheetTab] = useState("overview");
  const [calendarTab, setCalendarTab] = useState("month");
  const [turnsTab, setTurnsTab] = useState("run");
  const [referenceTab, setReferenceTab] = useState("rules");

  useEffect(() => {
    setOverviewDraft(buildOverviewDraft(model.kingdom));
    setTurnDraft(createTurnDraft(model.kingdom));
    setCalendarSetDraft(createCalendarSetDraft(model.kingdom));
  }, [model.kingdom]);

  useEffect(() => {
    const defaultRole = model.roleOptions[0] || "Ruler";
    setLeaderDraft((current) => {
      if (current.role) return current;
      return {
        ...current,
        role: defaultRole,
      };
    });
  }, [model.roleOptions[0]]);

  const monthMatrix = buildKingdomCalendarMonthMatrix(model.kingdom.currentDate);
  const visibleDates = new Set(monthMatrix.flat().filter(Boolean).map((entry) => entry.isoDate));
  const entryCounts = new Map();
  for (const entry of model.recentCalendarHistory) {
    const targetDate = entry?.endDate || entry?.date;
    if (!visibleDates.has(targetDate)) continue;
    entryCounts.set(targetDate, (entryCounts.get(targetDate) || 0) + 1);
  }

  const elapsedDays = Math.max(0, diffGolarionDates(model.kingdom.calendarStartDate, model.kingdom.currentDate));

  const updateOverview = (field, value) => setOverviewDraft((current) => ({ ...current, [field]: value }));
  const updateLeaderDraft = (field, value) => setLeaderDraft((current) => ({ ...current, [field]: value }));
  const updateSettlementDraft = (field, value) => setSettlementDraft((current) => ({ ...current, [field]: value }));
  const updateRegionDraft = (field, value) => setRegionDraft((current) => ({ ...current, [field]: value }));
  const updateTurnDraft = (field, value) => setTurnDraft((current) => ({ ...current, [field]: value }));
  const updateCalendarAdvanceDraft = (field, value) => setCalendarAdvanceDraft((current) => ({ ...current, [field]: value }));
  const updateCalendarSetDraft = (field, value) => setCalendarSetDraft((current) => ({ ...current, [field]: value }));

  const handleOverviewSubmit = (event) => {
    event.preventDefault();
    actions.saveKingdomOverview(overviewDraft);
    notifications.show({
      color: "moss",
      title: "Kingdom sheet saved",
      message: `${overviewDraft.name || "Kingdom"} overview data was updated.`,
    });
  };

  const handleLeaderSubmit = (event) => {
    event.preventDefault();
    const created = actions.addKingdomLeader(leaderDraft);
    setLeaderDraft(createLeaderDraft(model.roleOptions[0] || "Ruler"));
    notifications.show({
      color: "moss",
      title: "Leader added",
      message: `${created.name} was added to the kingdom roster.`,
    });
  };

  const handleSettlementSubmit = (event) => {
    event.preventDefault();
    const created = actions.addKingdomSettlement(settlementDraft);
    setSettlementDraft(createSettlementDraft());
    notifications.show({
      color: "moss",
      title: "Settlement added",
      message: `${created.name} was added to kingdom settlements.`,
    });
  };

  const handleRegionSubmit = (event) => {
    event.preventDefault();
    const created = actions.addKingdomRegion(regionDraft);
    setRegionDraft(createRegionDraft());
    notifications.show({
      color: "moss",
      title: "Region added",
      message: `${created.hex} was added to kingdom regions.`,
    });
  };

  const handleAdvanceCalendar = (event) => {
    event.preventDefault();
    const entry = actions.advanceKingdomCalendar(calendarAdvanceDraft);
    setCalendarAdvanceDraft(createCalendarAdvanceDraft());
    notifications.show({
      color: "moss",
      title: "Calendar advanced",
      message: buildKingdomCalendarEntrySummary(entry),
    });
  };

  const handleSetCalendarDate = (event) => {
    event.preventDefault();
    const entry = actions.setKingdomCalendarDate(calendarSetDraft);
    notifications.show({
      color: "moss",
      title: "Calendar updated",
      message: buildKingdomCalendarEntrySummary(entry),
    });
  };

  const handleTurnSubmit = (event) => {
    event.preventDefault();
    const result = actions.applyKingdomTurn(turnDraft);
    setTurnDraft(createTurnDraft({ ...model.kingdom, currentTurnLabel: result.title, currentDate: result.date }));
    notifications.show({
      color: "moss",
      title: "Kingdom turn logged",
      message: `${result.title} was recorded for ${formatGolarionDate(result.date)}.`,
    });
  };

  const openKingdomWorkspace = (targetMainTab, targetSubTab = "") => {
    setMainTab(targetMainTab);
    if (targetMainTab === "sheet" && targetSubTab) setSheetTab(targetSubTab);
    if (targetMainTab === "calendar" && targetSubTab) setCalendarTab(targetSubTab);
    if (targetMainTab === "turns" && targetSubTab) setTurnsTab(targetSubTab);
    if (targetMainTab === "reference" && targetSubTab) setReferenceTab(targetSubTab);
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="World"
        title="Kingdom"
        description="Run the kingdom from one place: sheet state, calendar cadence, leadership coverage, settlements, regions, and monthly turn fallout."
        actions={
          <>
            <Button variant="default" onClick={() => navigate("/world/hex-map")}>
              Open Hex Map
            </Button>
            <Button variant="default" onClick={() => navigate("/world/events")}>
              Open Events
            </Button>
          </>
        }
      />

      <Grid gutter="lg">
        {model.summaryCards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, md: 6, xl: 3 }}>
            <MetricCard
              label={card.label}
              value={card.value}
              helper={card.helper}
              valueTone={card.valueTone}
              chip={card.chip}
              actionLabel={card.actionLabel}
              onClick={() => openKingdomWorkspace(card.path, card.subtab)}
            />
          </Grid.Col>
        ))}
      </Grid>

      <Tabs.Root value={mainTab} onValueChange={setMainTab} className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Kingdom views">
          <Tabs.Trigger value="sheet" className="km-radix-trigger">
            Sheet
          </Tabs.Trigger>
          <Tabs.Trigger value="calendar" className="km-radix-trigger">
            Calendar
          </Tabs.Trigger>
          <Tabs.Trigger value="turns" className="km-radix-trigger">
            Turn Workflow
          </Tabs.Trigger>
          <Tabs.Trigger value="reference" className="km-radix-trigger">
            Reference
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="sheet" className="km-radix-content">
          <Stack gap="lg">
            <Paper className="km-panel km-content-panel">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text className="km-section-kicker">Sheet Workspaces</Text>
                  <Text c="dimmed">Open the lane you need: kingdom stats, leadership seats, settlements, or claimed regions.</Text>
                </div>
                <Badge color="moss" variant="light">
                  {model.kingdom.name || "Unnamed Kingdom"}
                </Badge>
              </Group>
            </Paper>

            <Accordion value={sheetTab} onChange={(value) => setSheetTab(value || "overview")} variant="separated" radius="lg" className="km-kingdom-accordion">
              <Accordion.Item value="overview">
                <Accordion.Control>Overview</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 8 }}>
                <Paper className="km-panel km-content-panel">
                  <form onSubmit={handleOverviewSubmit}>
                    <Stack gap="md">
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text className="km-section-kicker">Kingdom Sheet</Text>
                          <Title order={3}>{model.kingdom.name || "Unnamed Kingdom"}</Title>
                        </div>
                        <Button type="submit" color="moss">
                          Save Overview
                        </Button>
                      </Group>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Select
                            label="Rules Profile"
                            data={profileOptions}
                            value={overviewDraft.profileId}
                            onChange={(value) => updateOverview("profileId", value || "")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Kingdom Name", overviewDraft.name, (value) => updateOverview("name", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Charter", overviewDraft.charter, (value) => updateOverview("charter", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Government", overviewDraft.government, (value) => updateOverview("government", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Heartland", overviewDraft.heartland, (value) => updateOverview("heartland", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Capital", overviewDraft.capital, (value) => updateOverview("capital", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Current Turn Label", overviewDraft.currentTurnLabel, (value) => updateOverview("currentTurnLabel", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput
                            {...textInputProps("Current Date", overviewDraft.currentDate, (value) => updateOverview("currentDate", value), {
                              placeholder: "4710-02-24",
                            })}
                          />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Level", overviewDraft.level, (value) => updateOverview("level", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Size", overviewDraft.size, (value) => updateOverview("size", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Control DC", overviewDraft.controlDC, (value) => updateOverview("controlDC", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <Select
                            label="Resource Die"
                            data={KINGDOM_RESOURCE_DIE_OPTIONS.map((value) => ({ value, label: value }))}
                            value={overviewDraft.resourceDie}
                            onChange={(value) => updateOverview("resourceDie", value || "d4")}
                          />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Resource Points", overviewDraft.resourcePoints, (value) => updateOverview("resourcePoints", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Kingdom XP", overviewDraft.xp, (value) => updateOverview("xp", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Culture", overviewDraft.culture, (value) => updateOverview("culture", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Economy", overviewDraft.economy, (value) => updateOverview("economy", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Loyalty", overviewDraft.loyalty, (value) => updateOverview("loyalty", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Stability", overviewDraft.stability, (value) => updateOverview("stability", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Consumption", overviewDraft.consumption, (value) => updateOverview("consumption", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Renown", overviewDraft.renown, (value) => updateOverview("renown", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Unrest", overviewDraft.unrest, (value) => updateOverview("unrest", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Fame", overviewDraft.fame, (value) => updateOverview("fame", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Infamy", overviewDraft.infamy, (value) => updateOverview("infamy", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Food", overviewDraft.food, (value) => updateOverview("food", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Lumber", overviewDraft.lumber, (value) => updateOverview("lumber", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Luxuries", overviewDraft.luxuries, (value) => updateOverview("luxuries", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Ore", overviewDraft.ore, (value) => updateOverview("ore", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Stone", overviewDraft.stone, (value) => updateOverview("stone", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Corruption", overviewDraft.corruption, (value) => updateOverview("corruption", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Crime", overviewDraft.crime, (value) => updateOverview("crime", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Decay", overviewDraft.decay, (value) => updateOverview("decay", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Strife", overviewDraft.strife, (value) => updateOverview("strife", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Ruin Threshold", overviewDraft.ruinThreshold, (value) => updateOverview("ruinThreshold", value))} />
                        </Grid.Col>
                      </Grid>

                      <Textarea
                        autosize
                        minRows={3}
                        label="Kingdom Notes"
                        value={overviewDraft.notes}
                        onChange={(event) => updateOverview("notes", event.currentTarget.value)}
                      />
                      <Textarea
                        autosize
                        minRows={3}
                        label="Pending Projects"
                        description="One project per line."
                        value={overviewDraft.pendingProjects}
                        onChange={(event) => updateOverview("pendingProjects", event.currentTarget.value)}
                      />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Date Change Notes"
                        description="Used only if you changed the kingdom sheet date."
                        value={overviewDraft.dateNotes}
                        onChange={(event) => updateOverview("dateNotes", event.currentTarget.value)}
                      />
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 4 }}>
                <Stack gap="lg">
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Text className="km-section-kicker">Derived Summary</Text>
                      <div className="km-record-card">
                        <Text fw={600}>Control DC</Text>
                        <Text c="dimmed">
                          Recommended: {model.derived.recommendedControlDC}. Current sheet: {model.kingdom.controlDC}.
                        </Text>
                      </div>
                      <div className="km-record-card">
                        <Text fw={600}>Action Economy</Text>
                        <Text c="dimmed">
                          {model.derived.pcLeaderActions} PC actions, {model.derived.npcLeaderActions} NPC actions, {model.derived.settlementActions} settlement actions.
                        </Text>
                      </div>
                      <div className="km-record-card">
                        <Text fw={600}>Upkeep Preview</Text>
                        <Text c="dimmed">
                          Total consumption {model.derived.totalConsumption}. Food after upkeep preview {model.derived.foodAfterUpkeep}.
                        </Text>
                      </div>
                      <div className="km-record-card">
                        <Text fw={600}>Negotiation Pressure</Text>
                        <Text c="dimmed">
                          Peaceful {formatSignedNumber(model.derived.peacefulNegotiationShift)} / Hostile {formatSignedNumber(model.derived.hostileNegotiationShift)}.
                        </Text>
                      </div>
                      <div className="km-record-card">
                        <Text fw={600}>Ruin Watch</Text>
                        <Text c="dimmed">
                          Highest ruin {model.derived.highestRuin}. Margin before threshold {model.derived.ruinMargin}.
                        </Text>
                      </div>
                    </Stack>
                  </Paper>

                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Text className="km-section-kicker">Campaign Pulse</Text>
                      {model.overviewBullets.map((item) => (
                        <div key={item} className="km-bullet-row">
                          <span className="km-bullet-dot" />
                          <Text>{item}</Text>
                        </div>
                      ))}
                    </Stack>
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="leadership">
                <Accordion.Control>Leadership</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 5 }}>
                <Paper className="km-panel km-content-panel">
                  <form onSubmit={handleLeaderSubmit}>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text className="km-section-kicker">Add Leader</Text>
                        <Button type="submit" color="moss">
                          Add Leader
                        </Button>
                      </Group>
                      <Select
                        label="Role"
                        data={roleOptions}
                        value={leaderDraft.role}
                        onChange={(value) => updateLeaderDraft("role", value || "")}
                      />
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Leader Name", leaderDraft.name, (value) => updateLeaderDraft("name", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Select
                            label="Type"
                            data={KINGDOM_LEADER_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
                            value={leaderDraft.type}
                            onChange={(value) => updateLeaderDraft("type", value || "NPC")}
                          />
                        </Grid.Col>
                      </Grid>
                      <TextInput {...textInputProps("Leadership Bonus", leaderDraft.leadershipBonus, (value) => updateLeaderDraft("leadershipBonus", value))} />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Relevant Skills"
                        value={leaderDraft.relevantSkills}
                        onChange={(event) => updateLeaderDraft("relevantSkills", event.currentTarget.value)}
                      />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Specialized Skills"
                        value={leaderDraft.specializedSkills}
                        onChange={(event) => updateLeaderDraft("specializedSkills", event.currentTarget.value)}
                      />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Notes"
                        value={leaderDraft.notes}
                        onChange={(event) => updateLeaderDraft("notes", event.currentTarget.value)}
                      />
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 7 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Leadership Coverage</Text>
                    {(model.kingdom.leaders || []).length ? (
                      model.kingdom.leaders.map((leader) => (
                        <div key={leader.id} className="km-record-card">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={600}>
                                {leader.role || "Leader"}: {leader.name || "Unnamed leader"}
                              </Text>
                              <Text size="sm" c="dimmed">
                                {leader.type || "NPC"} / Leadership Bonus {leader.leadershipBonus ?? 0}
                              </Text>
                            </div>
                            <ActionIcon color="red" variant="light" aria-label={`Delete ${leader.name}`} onClick={() => actions.removeKingdomLeader(leader.id)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                          <Text size="sm" c="dimmed">
                            Relevant: {leader.relevantSkills || "None listed"}
                          </Text>
                          <Text size="sm" c="dimmed">
                            Specialized: {leader.specializedSkills || "None listed"}
                          </Text>
                          {leader.notes ? <Text size="sm">{leader.notes}</Text> : null}
                        </div>
                      ))
                    ) : (
                      <Text c="dimmed">No leaders are recorded yet.</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="settlements">
                <Accordion.Control>Settlements</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 5 }}>
                <Paper className="km-panel km-content-panel">
                  <form onSubmit={handleSettlementSubmit}>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text className="km-section-kicker">Add Settlement</Text>
                        <Button type="submit" color="moss">
                          Add Settlement
                        </Button>
                      </Group>
                      <TextInput {...textInputProps("Settlement Name", settlementDraft.name, (value) => updateSettlementDraft("name", value))} />
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Select
                            label="Size"
                            data={KINGDOM_SETTLEMENT_SIZE_OPTIONS.map((value) => ({ value, label: value }))}
                            value={settlementDraft.size}
                            onChange={(value) => updateSettlementDraft("size", value || "Village")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Select
                            label="Civic Structure"
                            data={KINGDOM_CIVIC_STRUCTURE_OPTIONS.map((value) => ({ value, label: value || "None" }))}
                            value={settlementDraft.civicStructure}
                            onChange={(value) => updateSettlementDraft("civicStructure", value || "")}
                          />
                        </Grid.Col>
                      </Grid>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Influence", settlementDraft.influence, (value) => updateSettlementDraft("influence", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Resource Dice", settlementDraft.resourceDice, (value) => updateSettlementDraft("resourceDice", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Consumption", settlementDraft.consumption, (value) => updateSettlementDraft("consumption", value))} />
                        </Grid.Col>
                      </Grid>
                      <Textarea
                        autosize
                        minRows={2}
                        label="Notes"
                        value={settlementDraft.notes}
                        onChange={(event) => updateSettlementDraft("notes", event.currentTarget.value)}
                      />
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 7 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Settlements</Text>
                    {(model.kingdom.settlements || []).length ? (
                      model.kingdom.settlements.map((settlement) => (
                        <div key={settlement.id} className="km-record-card">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={600}>{settlement.name || "Unnamed settlement"}</Text>
                              <Text size="sm" c="dimmed">
                                {settlement.size || "Settlement"} / influence {settlement.influence ?? 0} / {settlement.civicStructure || "No civic structure"}
                              </Text>
                            </div>
                            <ActionIcon
                              color="red"
                              variant="light"
                              aria-label={`Delete ${settlement.name}`}
                              onClick={() => actions.removeKingdomSettlement(settlement.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                          <Text size="sm" c="dimmed">
                            Resource Dice {settlement.resourceDice ?? 0} / Consumption {settlement.consumption ?? 0}
                          </Text>
                          {settlement.notes ? <Text size="sm">{settlement.notes}</Text> : null}
                        </div>
                      ))
                    ) : (
                      <Text c="dimmed">No settlements are recorded yet.</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="regions">
                <Accordion.Control>Regions</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 5 }}>
                <Paper className="km-panel km-content-panel">
                  <form onSubmit={handleRegionSubmit}>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text className="km-section-kicker">Add Region</Text>
                        <Button type="submit" color="moss">
                          Add Region
                        </Button>
                      </Group>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Hex", regionDraft.hex, (value) => updateRegionDraft("hex", value), { placeholder: "D4" })} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Select
                            label="Status"
                            data={KINGDOM_REGION_STATUS_OPTIONS.map((value) => ({ value, label: value }))}
                            value={regionDraft.status}
                            onChange={(value) => updateRegionDraft("status", value || "Claimed")}
                          />
                        </Grid.Col>
                      </Grid>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Select
                            label="Terrain"
                            data={KINGDOM_TERRAIN_OPTIONS.map((value) => ({ value, label: value }))}
                            value={regionDraft.terrain}
                            onChange={(value) => updateRegionDraft("terrain", value || "Plains")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Work Site", regionDraft.workSite, (value) => updateRegionDraft("workSite", value))} />
                        </Grid.Col>
                      </Grid>
                      <TextInput {...textInputProps("Discovery", regionDraft.discovery, (value) => updateRegionDraft("discovery", value))} />
                      <TextInput {...textInputProps("Danger", regionDraft.danger, (value) => updateRegionDraft("danger", value))} />
                      <TextInput {...textInputProps("Improvement", regionDraft.improvement, (value) => updateRegionDraft("improvement", value))} />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Notes"
                        value={regionDraft.notes}
                        onChange={(event) => updateRegionDraft("notes", event.currentTarget.value)}
                      />
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 7 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Regions</Text>
                    {(model.kingdom.regions || []).length ? (
                      model.kingdom.regions.map((region) => (
                        <div key={region.id} className="km-record-card">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={600}>
                                {region.hex || "Unknown hex"} / {region.status || "Claimed"}
                              </Text>
                              <Text size="sm" c="dimmed">
                                {region.terrain || "No terrain"} / {region.workSite || "No work site"}
                              </Text>
                            </div>
                            <ActionIcon color="red" variant="light" aria-label={`Delete ${region.hex}`} onClick={() => actions.removeKingdomRegion(region.id)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                          {region.discovery ? <Text size="sm">Discovery: {region.discovery}</Text> : null}
                          {region.danger ? <Text size="sm">Danger: {region.danger}</Text> : null}
                          {region.improvement ? <Text size="sm">Improvement: {region.improvement}</Text> : null}
                          {region.notes ? <Text size="sm" c="dimmed">{region.notes}</Text> : null}
                        </div>
                      ))
                    ) : (
                      <Text c="dimmed">No regions are tracked yet.</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="calendar" className="km-radix-content">
          <Stack gap="lg">
            <Paper className="km-panel km-content-panel">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text className="km-section-kicker">Calendar Workspaces</Text>
                  <Text c="dimmed">Check the month, advance the campaign date, or review the full kingdom calendar log.</Text>
                </div>
                <Badge color="moss" variant="light">
                  {model.monthContext.monthLabel}
                </Badge>
              </Group>
            </Paper>

            <Accordion value={calendarTab} onChange={(value) => setCalendarTab(value || "month")} variant="separated" radius="lg" className="km-kingdom-accordion">
              <Accordion.Item value="month">
                <Accordion.Control>Month View</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 4 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Calendar State</Text>
                    <Text fw={600}>{formatGolarionDate(model.kingdom.currentDate)}</Text>
                    <Text c="dimmed">Anchor: {formatGolarionDate(model.kingdom.calendarStartDate)}</Text>
                    <Text c="dimmed">{elapsedDays} day(s) have passed since the campaign anchor.</Text>
                    <Text c="dimmed">{model.monthContext.daysRemaining} day(s) remain in the current month.</Text>
                  </Stack>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 8 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="center">
                      <Text className="km-section-kicker">Month Grid</Text>
                      <Badge color="moss" variant="light">
                        {model.monthContext.monthLabel}
                      </Badge>
                    </Group>
                    <div className="km-kingdom-calendar-head">
                      {KINGDOM_WEEKDAY_LABELS.map((label) => (
                        <Text key={label} className="km-kingdom-calendar-weekday">
                          {label}
                        </Text>
                      ))}
                    </div>
                    <div className="km-kingdom-calendar-grid">
                      {monthMatrix.flat().map((cell, index) => {
                        if (!cell) {
                          return <div key={`empty-${index}`} className="km-kingdom-calendar-cell km-kingdom-calendar-cell--empty" />;
                        }
                        const noteCount = entryCounts.get(cell.isoDate) || 0;
                        const isCurrent = cell.isoDate === model.kingdom.currentDate;
                        return (
                          <div
                            key={cell.isoDate}
                            className={`km-kingdom-calendar-cell${isCurrent ? " km-kingdom-calendar-cell--current" : ""}${noteCount ? " km-kingdom-calendar-cell--marked" : ""}`}
                          >
                            <Text fw={600}>{cell.day}</Text>
                            {noteCount ? <Badge size="xs" variant="light">{noteCount}</Badge> : null}
                          </div>
                        );
                      })}
                    </div>
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="change-date">
                <Accordion.Control>Change Date</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 6 }}>
                <Paper className="km-panel km-content-panel">
                  <form onSubmit={handleAdvanceCalendar}>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text className="km-section-kicker">Advance Days</Text>
                        <Button type="submit" color="moss">
                          Advance
                        </Button>
                      </Group>
                      <TextInput {...textInputProps("Days", calendarAdvanceDraft.days, (value) => updateCalendarAdvanceDraft("days", value))} />
                      <TextInput {...textInputProps("Label", calendarAdvanceDraft.label, (value) => updateCalendarAdvanceDraft("label", value))} />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Notes"
                        value={calendarAdvanceDraft.notes}
                        onChange={(event) => updateCalendarAdvanceDraft("notes", event.currentTarget.value)}
                      />
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 6 }}>
                <Paper className="km-panel km-content-panel">
                  <form onSubmit={handleSetCalendarDate}>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text className="km-section-kicker">Set Exact Date</Text>
                        <Button type="submit" color="moss">
                          Set Date
                        </Button>
                      </Group>
                      <TextInput
                        {...textInputProps("Date", calendarSetDraft.date, (value) => updateCalendarSetDraft("date", value), {
                          placeholder: "4710-02-24",
                        })}
                      />
                      <TextInput {...textInputProps("Label", calendarSetDraft.label, (value) => updateCalendarSetDraft("label", value))} />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Notes"
                        value={calendarSetDraft.notes}
                        onChange={(event) => updateCalendarSetDraft("notes", event.currentTarget.value)}
                      />
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="history">
                <Accordion.Control>Calendar History</Accordion.Control>
                <Accordion.Panel>
            <Paper className="km-panel km-content-panel">
              <Stack gap="md">
                <Text className="km-section-kicker">Calendar Log</Text>
                {model.recentCalendarHistory.length ? (
                  model.recentCalendarHistory.map((entry) => (
                    <div key={entry.id} className="km-record-card">
                      <Text fw={600}>{buildKingdomCalendarEntrySummary(entry)}</Text>
                      <Text size="sm" c="dimmed">
                        Source: {entry.source || "manual"}
                      </Text>
                      {entry.notes ? <Text size="sm">{entry.notes}</Text> : null}
                    </div>
                  ))
                ) : (
                  <Text c="dimmed">No calendar history recorded yet.</Text>
                )}
              </Stack>
            </Paper>

                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="turns" className="km-radix-content">
          <Stack gap="lg">
            <Paper className="km-panel km-content-panel">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text className="km-section-kicker">Turn Workspaces</Text>
                  <Text c="dimmed">Run the current kingdom turn, review active queues, and then inspect the recent turn history.</Text>
                </div>
                <Badge color="moss" variant="light">
                  {model.kingdom.currentTurnLabel || "Turn 1"}
                </Badge>
              </Group>
            </Paper>

            <Accordion value={turnsTab} onChange={(value) => setTurnsTab(value || "run")} variant="separated" radius="lg" className="km-kingdom-accordion">
              <Accordion.Item value="run">
                <Accordion.Control>Run Turn And Queue</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 6 }}>
                <Paper className="km-panel km-content-panel">
                  <form onSubmit={handleTurnSubmit}>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text className="km-section-kicker">Run Kingdom Turn</Text>
                        <Button type="submit" color="moss">
                          Log Turn
                        </Button>
                      </Group>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Turn Title", turnDraft.title, (value) => updateTurnDraft("title", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Turn Date", turnDraft.date, (value) => updateTurnDraft("date", value), { placeholder: "4710-02-24" })} />
                        </Grid.Col>
                      </Grid>
                      <Textarea
                        autosize
                        minRows={3}
                        label="Summary"
                        value={turnDraft.summary}
                        onChange={(event) => updateTurnDraft("summary", event.currentTarget.value)}
                      />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Risks / Fallout"
                        value={turnDraft.risks}
                        onChange={(event) => updateTurnDraft("risks", event.currentTarget.value)}
                      />
                      <Textarea
                        autosize
                        minRows={2}
                        label="Event Summary"
                        value={turnDraft.eventSummary}
                        onChange={(event) => updateTurnDraft("eventSummary", event.currentTarget.value)}
                      />
                      <TextInput {...textInputProps("Pending Project", turnDraft.pendingProject, (value) => updateTurnDraft("pendingProject", value))} />

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("RP Delta", turnDraft.rpDelta, (value) => updateTurnDraft("rpDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Unrest Delta", turnDraft.unrestDelta, (value) => updateTurnDraft("unrestDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput {...textInputProps("Renown Delta", turnDraft.renownDelta, (value) => updateTurnDraft("renownDelta", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Fame Delta", turnDraft.fameDelta, (value) => updateTurnDraft("fameDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput {...textInputProps("Infamy Delta", turnDraft.infamyDelta, (value) => updateTurnDraft("infamyDelta", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Food", turnDraft.foodDelta, (value) => updateTurnDraft("foodDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Lumber", turnDraft.lumberDelta, (value) => updateTurnDraft("lumberDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Luxuries", turnDraft.luxuriesDelta, (value) => updateTurnDraft("luxuriesDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Ore", turnDraft.oreDelta, (value) => updateTurnDraft("oreDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 2 }}>
                          <TextInput {...textInputProps("Stone", turnDraft.stoneDelta, (value) => updateTurnDraft("stoneDelta", value))} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Corruption", turnDraft.corruptionDelta, (value) => updateTurnDraft("corruptionDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Crime", turnDraft.crimeDelta, (value) => updateTurnDraft("crimeDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Decay", turnDraft.decayDelta, (value) => updateTurnDraft("decayDelta", value))} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <TextInput {...textInputProps("Strife", turnDraft.strifeDelta, (value) => updateTurnDraft("strifeDelta", value))} />
                        </Grid.Col>
                      </Grid>

                      <Textarea
                        autosize
                        minRows={2}
                        label="Turn Notes"
                        value={turnDraft.notes}
                        onChange={(event) => updateTurnDraft("notes", event.currentTarget.value)}
                      />
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 6 }}>
                <Stack gap="lg">
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text className="km-section-kicker">Kingdom Event Queue</Text>
                        <Badge color="ember" variant="light">
                          {model.activeKingdomEvents.length} tracked
                        </Badge>
                      </Group>
                      {model.activeKingdomEvents.length ? (
                        model.activeKingdomEvents.map((eventItem) => (
                          <div key={eventItem.id} className="km-record-card">
                            <Text fw={600}>{eventItem.title}</Text>
                            <Text size="sm" c="dimmed">
                              {eventItem.status || "active"} / urgency {eventItem.urgency ?? 0} / clock {eventItem.clock ?? 0}/{eventItem.clockMax ?? 0}
                            </Text>
                            <Text size="sm">{eventItem.trigger || eventItem.consequenceSummary || eventItem.fallout || "No event note."}</Text>
                          </div>
                        ))
                      ) : (
                        <Text c="dimmed">No active kingdom events are recorded yet.</Text>
                      )}
                    </Stack>
                  </Paper>

                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Text className="km-section-kicker">Companion Role Watch</Text>
                      {model.companionRoleWatch.length ? (
                        model.companionRoleWatch.map((companion) => (
                          <div key={companion.id} className="km-record-card">
                            <Text fw={600}>{companion.name}</Text>
                            <Text size="sm" c="dimmed">
                              {companion.kingdomRole || "No role"} / influence {companion.influence ?? 0}
                            </Text>
                            <Text size="sm">{companion.personalQuest || companion.notes || "No companion note."}</Text>
                          </div>
                        ))
                      ) : (
                        <Text c="dimmed">No companions have kingdom roles assigned yet.</Text>
                      )}
                    </Stack>
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="history">
                <Accordion.Control>Turn History</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 7 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Recent Turns</Text>
                    {model.recentTurns.length ? (
                      model.recentTurns.map((turn) => (
                        <div key={turn.id} className="km-record-card">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={600}>{turn.title || "Unnamed turn"}</Text>
                              <Text size="sm" c="dimmed">
                                {formatGolarionDate(turn.date)}
                              </Text>
                            </div>
                            <Group gap="xs">
                              <Badge variant="light">RP {formatSignedNumber(turn.rpDelta ?? turn.resourceDelta ?? 0)}</Badge>
                              <Badge variant="outline">Unrest {formatSignedNumber(turn.unrestDelta ?? 0)}</Badge>
                            </Group>
                          </Group>
                          {turn.summary ? <Text size="sm">{turn.summary}</Text> : null}
                          {turn.risks ? <Text size="sm" c="dimmed">Risks: {turn.risks}</Text> : null}
                          {turn.eventSummary ? <Text size="sm" c="dimmed">Event: {turn.eventSummary}</Text> : null}
                        </div>
                      ))
                    ) : (
                      <Text c="dimmed">No kingdom turns have been recorded yet.</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 5 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Event History</Text>
                    {model.recentEventHistory.length ? (
                      model.recentEventHistory.map((entry) => (
                        <div key={entry.id} className="km-record-card">
                          <Text fw={600}>{entry.eventTitle || "Kingdom Event"}</Text>
                          <Text size="sm" c="dimmed">
                            {entry.type || "note"}{entry.turnTitle ? ` / ${entry.turnTitle}` : ""}
                          </Text>
                          <Text size="sm">{entry.summary || "No summary recorded."}</Text>
                        </div>
                      ))
                    ) : (
                      <Text c="dimmed">No kingdom event history is recorded yet.</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="reference" className="km-radix-content">
          <Stack gap="lg">
            <Paper className="km-panel km-content-panel">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text className="km-section-kicker">Reference Workspaces</Text>
                  <Text c="dimmed">Keep the kingdom rules stack separate from creation options and leadership guidance.</Text>
                </div>
                <Badge color="moss" variant="light">
                  {model.profile.shortLabel || model.profile.label}
                </Badge>
              </Group>
            </Paper>

            <Accordion value={referenceTab} onChange={(value) => setReferenceTab(value || "rules")} variant="separated" radius="lg" className="km-kingdom-accordion">
              <Accordion.Item value="rules">
                <Accordion.Control>Rules Stack</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 5 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Rules Stack</Text>
                    <Title order={3}>{model.profile.label}</Title>
                    <Text>{model.profile.summary}</Text>
                    {(model.profile.sources || []).map((source) => (
                      <div key={source.title} className="km-record-card">
                        <Text fw={600}>{source.title}</Text>
                        <Text size="sm" c="dimmed">
                          {source.role}
                        </Text>
                        {source.url ? <Text size="sm" c="dimmed">{source.url}</Text> : null}
                      </div>
                    ))}
                  </Stack>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 7 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Quick Start</Text>
                    {model.quickStart.map((item) => (
                      <div key={item} className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>{item}</Text>
                      </div>
                    ))}
                    <Text className="km-section-kicker">Turn Structure</Text>
                    {model.turnStructure.map((entry) => (
                      <div key={entry.phase} className="km-record-card">
                        <Text fw={600}>{entry.phase}</Text>
                        <Text size="sm" c="dimmed">
                          {entry.summary}
                        </Text>
                      </div>
                    ))}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="creation">
                <Accordion.Control>Creation Reference</Accordion.Control>
                <Accordion.Panel>
            {model.creationReference ? (
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, xl: 4 }}>
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Text className="km-section-kicker">Charters</Text>
                      {(model.creationReference.charters || []).map((entry) => (
                        <div key={entry.name} className="km-record-card">
                          <Text fw={600}>{entry.name}</Text>
                          <Text size="sm" c="dimmed">{entry.summary}</Text>
                          <Text size="sm">Boosts: {(entry.abilityBoosts || []).join(", ")}</Text>
                          <Text size="sm">Flaw: {entry.abilityFlaw || "None"}</Text>
                        </div>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, xl: 4 }}>
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Text className="km-section-kicker">Governments</Text>
                      {(model.creationReference.governments || []).map((entry) => (
                        <div key={entry.name} className="km-record-card">
                          <Text fw={600}>{entry.name}</Text>
                          <Text size="sm" c="dimmed">{entry.summary}</Text>
                          <Text size="sm">Boosts: {(entry.abilityBoosts || []).join(", ")}</Text>
                          <Text size="sm">Skills: {(entry.trainedSkills || []).join(", ")}</Text>
                        </div>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, xl: 4 }}>
                  <Paper className="km-panel km-content-panel">
                    <Stack gap="md">
                      <Text className="km-section-kicker">Heartlands</Text>
                      {(model.creationReference.heartlands || []).map((entry) => (
                        <div key={entry.name} className="km-record-card">
                          <Text fw={600}>{entry.name}</Text>
                          <Text size="sm" c="dimmed">{entry.summary}</Text>
                          <Text size="sm">Boosts: {(entry.abilityBoosts || []).join(", ")}</Text>
                        </div>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>
            ) : null}

                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="leadership-guide">
                <Accordion.Control>Leadership Guide</Accordion.Control>
                <Accordion.Panel>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 6 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Leadership Roles</Text>
                    {model.leadershipSummary.map((entry) => (
                      <div key={entry.role} className="km-record-card">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={600}>{entry.role}</Text>
                            <Text size="sm" c="dimmed">
                              Relevant: {(entry.relevantSkills || []).join(", ")}
                            </Text>
                            <Text size="sm" c="dimmed">
                              Specialized: {(entry.specializedSkills || []).join(", ")}
                            </Text>
                          </div>
                          <Badge variant={entry.assignedLeader ? "light" : "outline"} color={entry.assignedLeader ? "moss" : "gray"}>
                            {entry.assignedLeader?.name || "Unassigned"}
                          </Badge>
                        </Group>
                      </div>
                    ))}
                  </Stack>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 6 }}>
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Text className="km-section-kicker">Watchlist And Prompts</Text>
                    <Text fw={600}>Current Watchlist</Text>
                    {model.watchlist.length ? (
                      model.watchlist.map((item) => (
                        <div key={item} className="km-bullet-row">
                          <span className="km-bullet-dot" />
                          <Text>{item}</Text>
                        </div>
                      ))
                    ) : (
                      <Text c="dimmed">No current watchlist items.</Text>
                    )}
                    <Text fw={600}>Prompt Seeds</Text>
                    {model.helpPrompts.map((item) => (
                      <div key={item} className="km-record-card">
                        <Text size="sm">{item}</Text>
                      </div>
                    ))}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
