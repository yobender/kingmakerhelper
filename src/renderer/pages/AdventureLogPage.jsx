import { useDeferredValue, useEffect, useState } from "react";
import { Badge, Button, Drawer, Grid, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { createSessionDraft, SESSION_TYPE_OPTIONS, getSessionTypeLabel } from "../lib/campaignState";
import { buildAdventureLogModel, getSessionDateLabel, getSessionSearchText } from "../lib/selectors";

const SESSION_TYPE_SELECT = SESSION_TYPE_OPTIONS.map((value) => ({
  value,
  label: getSessionTypeLabel(value),
}));

export default function AdventureLogPage() {
  const { campaign, actions } = useCampaign();
  const model = buildAdventureLogModel(campaign);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [drawerOpened, setDrawerOpened] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredSessions = model.sessions.filter((session) => {
    const matchesType = typeFilter === "all" || session.type === typeFilter;
    const matchesQuery = !deferredQuery || getSessionSearchText(session).includes(deferredQuery);
    return matchesType && matchesQuery;
  });

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Campaign"
        title="Adventure Log"
        description="Keep session history, prep handoffs, and month-end kingdom timing in one timeline instead of scattered notes."
        actions={
          <Button color="moss" onClick={() => setDrawerOpened(true)}>
            Add Session
          </Button>
        }
      />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper className="km-panel metric-card">
            <Stack gap="sm">
              <Text className="metric-label">Current Month</Text>
              <Text className="metric-value">{model.monthContext.monthLabel}</Text>
              <Text size="sm" c="dimmed">
                {model.monthContext.daysRemaining} days remain in the current kingdom month.
              </Text>
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper className="km-panel metric-card">
            <Stack gap="sm">
              <Text className="metric-label">Sessions This Month</Text>
              <Text className="metric-value">{model.sessionsThisMonth.length}</Text>
              <Text size="sm" c="dimmed">
                {model.kingdomTurnsThisMonth.length ? "Kingdom handoff already logged." : "No kingdom turn logged for this month yet."}
              </Text>
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper className="km-panel metric-card">
            <Stack gap="sm">
              <Text className="metric-label">Open Threads</Text>
              <Text className="metric-value">{model.activeQuests.length + model.activeEvents.length}</Text>
              <Text size="sm" c="dimmed">
                {model.activeQuests.length} active quests / {model.activeEvents.length} active events
              </Text>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Tabs.Root defaultValue="timeline" className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Adventure Log views">
          <Tabs.Trigger value="timeline" className="km-radix-trigger">
            Timeline
          </Tabs.Trigger>
          <Tabs.Trigger value="prep" className="km-radix-trigger">
            Prep Handoff
          </Tabs.Trigger>
          <Tabs.Trigger value="month" className="km-radix-trigger">
            Month Close
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="timeline" className="km-radix-content">
          <Paper className="km-panel km-content-panel">
            <Grid gutter="md" align="end">
              <Grid.Col span={{ base: 12, md: 7 }}>
                <TextInput
                  label="Search sessions"
                  placeholder="Search by title, chapter, hex, companion, pressure, or prep"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Select
                  label="Filter by type"
                  value={typeFilter}
                  onChange={(value) => setTypeFilter(value || "all")}
                  data={[{ value: "all", label: "All session types" }, ...SESSION_TYPE_SELECT]}
                />
              </Grid.Col>
            </Grid>
          </Paper>

          <Stack gap="lg" mt="lg">
            {filteredSessions.length ? (
              filteredSessions.map((session) => (
                <Paper key={session.id} className="km-panel km-content-panel session-card">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Title order={3}>{session.title}</Title>
                        <Text c="dimmed">
                          {session.arc || "No arc"} / {session.chapter || "No chapter"}
                        </Text>
                      </div>
                      <Group gap="xs" wrap="wrap">
                        <Badge color="moss" variant="light">
                          {getSessionDateLabel(session)}
                        </Badge>
                        <Badge variant="outline">{getSessionTypeLabel(session.type)}</Badge>
                        {session.focusHex ? <Badge variant="outline">{session.focusHex}</Badge> : null}
                      </Group>
                    </Group>

                    <Grid gutter="lg">
                      <Grid.Col span={{ base: 12, xl: 7 }}>
                        <Stack gap="xs">
                          <Text className="km-section-kicker">Summary</Text>
                          <Text>{session.summary || "No summary recorded yet."}</Text>
                        </Stack>
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, xl: 5 }}>
                        <Stack gap="xs">
                          <Text className="km-section-kicker">Run Conditions</Text>
                          <Text c="dimmed">{session.travelObjective || "No travel objective recorded."}</Text>
                          <Text c="dimmed">{session.weather || "No weather note recorded."}</Text>
                          <Text c="dimmed">{session.pressure || "No active pressure note recorded."}</Text>
                        </Stack>
                      </Grid.Col>
                    </Grid>

                    <Stack gap="xs">
                      <Text className="km-section-kicker">Next Prep</Text>
                      <Text>{session.nextPrep || "No prep handoff recorded yet."}</Text>
                    </Stack>

                    {session.leadCompanion ? (
                      <Text size="sm" c="dimmed">
                        Lead companion: {session.leadCompanion}
                      </Text>
                    ) : null}
                  </Stack>
                </Paper>
              ))
            ) : (
              <Paper className="km-panel km-content-panel">
                <Text c="dimmed">No sessions match the current filter.</Text>
              </Paper>
            )}
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="prep" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Latest Prep Queue</Text>
                  {model.latestPrepItems.length ? (
                    model.latestPrepItems.map((item) => (
                      <div key={item} className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>{item}</Text>
                      </div>
                    ))
                  ) : (
                    <Text c="dimmed">The latest session does not have a prep handoff yet.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Live Frontier Threads</Text>
                  {model.activeQuests.slice(0, 4).map((quest) => (
                    <div key={quest.id} className="km-pressure-card">
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text fw={600}>{quest.title}</Text>
                          <Text size="sm" c="dimmed">
                            {quest.objective}
                          </Text>
                        </div>
                        <Badge variant="outline">{quest.priority}</Badge>
                      </Group>
                    </div>
                  ))}
                  {!model.activeQuests.length ? <Text c="dimmed">No active quests are recorded yet.</Text> : null}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="month" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Month Close Readiness</Text>
                  <Text>
                    {model.kingdomTurnsThisMonth.length
                      ? "A kingdom turn already exists for this month."
                      : model.monthContext.daysRemaining <= 5
                        ? "Month close is approaching. This is the point to prep kingdom upkeep, event fallout, and leadership consequences."
                        : "There is still time before the month closes, but prep should already be pulling kingdom consequences forward."}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Current date: {getSessionDateLabel({ date: model.monthContext.currentDate })}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Latest Session Summary Beats</Text>
                  {model.latestSummaryItems.length ? (
                    model.latestSummaryItems.map((item) => (
                      <div key={item} className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>{item}</Text>
                      </div>
                    ))
                  ) : (
                    <Text c="dimmed">No summary beats recorded on the latest session yet.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>
      </Tabs.Root>

      <SessionDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} />
    </Stack>
  );
}

function SessionDrawer({ opened, onClose }) {
  const { campaign, actions } = useCampaign();
  const [draft, setDraft] = useState(() => createSessionDraft(campaign));

  useEffect(() => {
    if (opened) {
      setDraft(createSessionDraft(campaign));
    }
  }, [opened, campaign]);

  const companionOptions = campaign.companions.map((companion) => ({
    value: companion.name,
    label: companion.name,
  }));

  const updateField = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    actions.addSession(draft);
    notifications.show({
      color: "moss",
      title: "Session added",
      message: `${draft.title} was added to the Adventure Log.`,
    });
    onClose();
  };

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="xl" title="Add Adventure Log Session">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Session 04 - Oleg Under Siege"
            value={draft.title}
            onChange={(event) => updateField("title", event.currentTarget.value)}
            required
          />

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Date"
                placeholder="4710-02-24"
                value={draft.date}
                onChange={(event) => updateField("date", event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Type"
                value={draft.type}
                onChange={(value) => updateField("type", value || "expedition")}
                data={SESSION_TYPE_SELECT}
              />
            </Grid.Col>
          </Grid>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Arc"
                placeholder="Stolen Lands Opening"
                value={draft.arc}
                onChange={(event) => updateField("arc", event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Chapter"
                placeholder="Chapter 2: Into the Wild"
                value={draft.chapter}
                onChange={(event) => updateField("chapter", event.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Focus Hex"
                placeholder="D4"
                value={draft.focusHex}
                onChange={(event) => updateField("focusHex", event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                searchable
                clearable
                label="Lead Companion"
                value={draft.leadCompanion}
                onChange={(value) => updateField("leadCompanion", value || "")}
                data={companionOptions}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            autosize
            minRows={2}
            label="Travel Objective"
            value={draft.travelObjective}
            onChange={(event) => updateField("travelObjective", event.currentTarget.value)}
          />
          <Textarea
            autosize
            minRows={2}
            label="Weather"
            value={draft.weather}
            onChange={(event) => updateField("weather", event.currentTarget.value)}
          />
          <Textarea
            autosize
            minRows={2}
            label="Pressure"
            value={draft.pressure}
            onChange={(event) => updateField("pressure", event.currentTarget.value)}
          />
          <Textarea
            autosize
            minRows={4}
            label="Summary"
            value={draft.summary}
            onChange={(event) => updateField("summary", event.currentTarget.value)}
          />
          <Textarea
            autosize
            minRows={4}
            label="Next Prep"
            value={draft.nextPrep}
            onChange={(event) => updateField("nextPrep", event.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" color="moss">
              Save Session
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
