import { Badge, Button, Grid, Group, Paper, Progress, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import * as Tabs from "@radix-ui/react-tabs";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { buildCommandCenterModel, getSessionDateLabel } from "../lib/selectors";

export default function CommandCenterPage() {
  const navigate = useNavigate();
  const { campaign } = useCampaign();
  const model = buildCommandCenterModel(campaign);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Campaign"
        title="Command Center"
        description="Use this page to jump straight into the session log, pressure clocks, kingdom turn work, and the next live prep item."
        actions={
          <>
            <Button variant="default" onClick={() => navigate("/campaign/adventure-log")}>
              Open Adventure Log
            </Button>
            <Button variant="default" onClick={() => navigate("/world/events")}>
              Open Events
            </Button>
            <Button color="moss" onClick={() => navigate("/world/kingdom")}>
              Open Kingdom
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
              onClick={() => navigate(card.path)}
            />
          </Grid.Col>
        ))}
      </Grid>

      <Tabs.Root defaultValue="tonight" className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Command Center views">
          <Tabs.Trigger value="tonight" className="km-radix-trigger">
            Tonight
          </Tabs.Trigger>
          <Tabs.Trigger value="fronts" className="km-radix-trigger">
            Frontier Pressure
          </Tabs.Trigger>
          <Tabs.Trigger value="kingdom" className="km-radix-trigger">
            Kingdom Pulse
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="tonight" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel focus-card">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Campaign Pulse</Text>
                      <Title order={3}>{model.latestSession?.title || "No session logged yet"}</Title>
                    </div>
                    {model.latestSession ? (
                      <Badge color="moss" variant="light">
                        {getSessionDateLabel(model.latestSession)}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="lg">{model.spotlightText}</Text>
                  {model.latestSession?.summary ? (
                    <Text c="dimmed">{model.latestSession.summary}</Text>
                  ) : (
                    <Text c="dimmed">Use this area to hold the immediate expedition focus, then drive the rest of the prep around it.</Text>
                  )}
                  <Group gap="sm" wrap="wrap">
                    <Button variant="default" onClick={() => navigate("/campaign/adventure-log")}>
                      Open Session Log
                    </Button>
                    <Button variant="subtle" onClick={() => navigate("/campaign/table-notes")}>
                      Open Table Notes
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text className="km-section-kicker">Continue Working</Text>
                    <Badge color="moss" variant="light">
                      {model.prepItems.length} items
                    </Badge>
                  </Group>
                  {model.prepItems.length ? (
                    model.prepItems.map((item) => (
                      <UnstyledButton key={item.id} className="km-action-row" onClick={() => navigate(item.path)}>
                        <span className="km-bullet-dot km-action-row__dot" />
                        <div className="km-action-row__content">
                          <Text>{item.text}</Text>
                          {item.label ? (
                            <Text size="sm" c="dimmed">
                              {item.label}
                            </Text>
                          ) : null}
                        </div>
                        <Text className="km-action-row__link">{item.actionLabel}</Text>
                      </UnstyledButton>
                    ))
                  ) : (
                    <Text c="dimmed">No prep queue yet. Adventure Log notes, open quests, and live event clocks will start feeding this automatically.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          <Grid gutter="lg" mt="sm">
            {model.runSheet.map((entry) => (
              <Grid.Col key={entry.label} span={{ base: 12, md: 4 }}>
                <UnstyledButton className="km-panel-link" onClick={() => navigate(entry.path)}>
                  <Paper className="km-panel km-content-panel km-run-sheet-card km-run-sheet-card--interactive">
                    <Stack gap="sm">
                      <Text className="km-section-kicker">{entry.label}</Text>
                      <Text>{entry.text}</Text>
                      <Group justify="space-between" align="center" mt="auto">
                        <Text size="sm" c="dimmed">
                          {entry.helper}
                        </Text>
                        <Badge color="moss" variant="light">
                          {entry.actionLabel}
                        </Badge>
                      </Group>
                    </Stack>
                  </Paper>
                </UnstyledButton>
              </Grid.Col>
            ))}
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="fronts" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Text className="km-section-kicker">Open Event Clocks</Text>
                      <Badge color="ember" variant="light">
                        {model.activeEvents.length} tracked
                      </Badge>
                    </Group>
                    <Button variant="subtle" onClick={() => navigate("/world/events")}>
                      Open Events
                    </Button>
                  </Group>
                  {model.activeEvents.length ? (
                    model.activeEvents.map((eventItem) => {
                      const ratio = Math.min(100, (Number(eventItem.clock || 0) / Math.max(1, Number(eventItem.clockMax || 1))) * 100);
                      return (
                        <UnstyledButton key={eventItem.id} className="km-card-button" onClick={() => navigate("/world/events")}>
                          <div className="km-pressure-card km-pressure-card--interactive">
                            <Group justify="space-between" align="flex-start">
                              <div>
                                <Text fw={600}>{eventItem.title}</Text>
                                <Text size="sm" c="dimmed">
                                  {eventItem.consequenceSummary || eventItem.fallout || eventItem.trigger}
                                </Text>
                              </div>
                              <Badge variant="outline">{eventItem.hex || "No hex"}</Badge>
                            </Group>
                            <Progress value={ratio} color="ember" radius="xl" size="lg" />
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Clock {eventItem.clock || 0}/{eventItem.clockMax || 0}
                              </Text>
                              <Text size="sm" c="dimmed">
                                {eventItem.linkedQuest || eventItem.linkedCompanion || "No linked thread"}
                              </Text>
                            </Group>
                          </div>
                        </UnstyledButton>
                      );
                    })
                  ) : (
                    <Text c="dimmed">No active event clocks are recorded yet.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Text className="km-section-kicker">Companion Watch</Text>
                      <Badge color="moss" variant="light">
                        {model.companions.length} active
                      </Badge>
                    </Group>
                    <Button variant="subtle" onClick={() => navigate("/world/companions")}>
                      Open Companions
                    </Button>
                  </Group>
                  {model.companions.length ? (
                    model.companions.map((companion) => (
                      <UnstyledButton key={companion.id} className="km-card-button" onClick={() => navigate("/world/companions")}>
                        <div className="km-pressure-card km-pressure-card--interactive">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={600}>{companion.name}</Text>
                              <Text size="sm" c="dimmed">
                                {companion.personalQuest || companion.notes}
                              </Text>
                            </div>
                            <Badge variant="outline">{companion.currentHex || "Off map"}</Badge>
                          </Group>
                          <Progress value={Math.min(100, Number(companion.influence || 0) * 12)} color="moss" radius="xl" />
                          <Text size="sm" c="dimmed">
                            Influence {companion.influence || 0} / {companion.kingdomRole || companion.status}
                          </Text>
                        </div>
                      </UnstyledButton>
                    ))
                  ) : (
                    <Text c="dimmed">Companion travel and influence records will surface here as soon as they are tracked.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="kingdom" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Kingdom Pulse</Text>
                  <Group gap="sm" wrap="wrap">
                    <Badge color="moss" variant="light">
                      {model.kingdom.currentTurnLabel || "Turn 1"}
                    </Badge>
                    <Badge variant="outline">RP {model.kingdom.resourcePoints || 0}</Badge>
                    <Badge variant="outline">Unrest {model.kingdom.unrest || 0}</Badge>
                    <Badge variant="outline">Renown {model.kingdom.renown || 0}</Badge>
                    <Badge variant="outline">Leaders {model.leadershipAssigned}</Badge>
                  </Group>
                  <Text>
                    {model.kingdom.notes || "Track charter progress, leadership roles, and monthly fallout here."}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {model.kingdomTurnsThisMonth.length
                      ? "This month already has a kingdom turn logged."
                      : model.monthContext.daysRemaining <= 5
                        ? "Month close is coming up and there is no kingdom turn logged yet."
                        : "No kingdom turn is due yet for the current month."}
                  </Text>
                  <Group gap="sm" wrap="wrap">
                    <Button color="moss" onClick={() => navigate("/world/kingdom")}>
                      Open Kingdom
                    </Button>
                    <Button variant="subtle" onClick={() => navigate("/world/hex-map")}>
                      Open Hex Map
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text className="km-section-kicker">Pending Kingdom Work</Text>
                    <Button variant="subtle" onClick={() => navigate("/world/kingdom")}>
                      Review Turn Work
                    </Button>
                  </Group>
                  {model.pendingProjects.length ? (
                    model.pendingProjects.map((item) => (
                      <div key={item} className="km-bullet-row">
                        <span className="km-bullet-dot" />
                        <Text>{item}</Text>
                      </div>
                    ))
                  ) : (
                    <Text c="dimmed">No pending kingdom projects recorded.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
