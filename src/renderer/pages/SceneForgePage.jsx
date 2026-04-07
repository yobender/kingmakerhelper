import { useState } from "react";
import { Badge, Button, Checkbox, Grid, Group, Paper, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { DEFAULT_AI_CONFIG } from "../lib/campaignState";
import { buildSceneForgeAiContext, buildSceneForgeModel, generateSceneForgeDraft, getWritingModeLabel, WRITING_MODE_OPTIONS } from "../lib/sceneForge";
import { getSessionDateLabel } from "../lib/selectors";

const MODE_DESCRIPTIONS = Object.freeze({
  assistant: "Turn a rough question into a GM-ready answer with an opening move, a pressure move, and a clean close.",
  session: "Polish rough notes into a clean session summary you can keep in the Adventure Log.",
  recap: "Create read-aloud recap text that sounds table-ready instead of like bullet notes.",
  npc: "Turn fragments into a usable NPC handoff with pressure, leverage, and the next scene use.",
  quest: "Draft a quest record with objective, stakes, and the next beat.",
  location: "Write a location handoff with change state, scene texture, and play use.",
  prep: "Convert rough ideas into a clean prep checklist for the next session.",
});

function clipText(value, limit = 160) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

export default function SceneForgePage() {
  const navigate = useNavigate();
  const { campaign, desktopApi, actions } = useCampaign();
  const model = buildSceneForgeModel(campaign);
  const aiConfig = campaign.meta?.aiConfig || DEFAULT_AI_CONFIG;
  const [draft, setDraft] = useState({
    mode: "session",
    input: "",
    output: "",
    autoAppendToPrep: false,
  });
  const [aiBusy, setAiBusy] = useState(false);

  const currentModeLabel = getWritingModeLabel(draft.mode);
  const aiReady = Boolean(desktopApi?.generateLocalAiText);
  const latestTargetLabel = model.latestSession?.title || "No session logged";
  const openThreadCount = model.activeQuests.length + model.activeEvents.length;
  const canGenerate = draft.input.trim().length > 0;
  const canApply = draft.output.trim().length > 0;

  const summaryCards = [
    {
      label: "Latest Target",
      value: latestTargetLabel,
      helper: model.latestSession ? getSessionDateLabel(model.latestSession) : "Add a session in Adventure Log first.",
      valueTone: "compact",
    },
    {
      label: "Active Mode",
      value: currentModeLabel,
      helper: MODE_DESCRIPTIONS[draft.mode],
      valueTone: "compact",
    },
    {
      label: "Open Threads",
      value: `${openThreadCount}`,
      helper:
        openThreadCount > 0
          ? [model.activeQuests[0]?.title, model.activeEvents[0]?.title].filter(Boolean).join(" / ")
          : "No active quests or events are recorded yet.",
      valueTone: "number",
    },
    {
      label: "Local AI",
      value: aiReady ? "Desktop Bridge" : "Browser Preview",
      helper: aiReady ? `${aiConfig.model} @ ${aiConfig.endpoint}. Shared defaults live in Settings.` : "Launch the desktop app to use local AI generation and manage defaults in Settings.",
      valueTone: "compact",
    },
  ];

  const updateDraftField = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleGenerateClean = () => {
    if (!canGenerate) {
      notifications.show({
        color: "ember",
        title: "Draft text required",
        message: "Add rough notes or a prompt before generating output.",
      });
      return;
    }

    const output = generateSceneForgeDraft({
      campaign,
      mode: draft.mode,
      input: draft.input,
    });
    updateDraftField("output", output);
    notifications.show({
      color: "moss",
      title: "Scene Forge updated",
      message: `${currentModeLabel} output was generated from the current draft.`,
    });
  };

  const handleApply = (field, mode = "replace") => {
    const result = actions.applyToLatestSession(field, draft.output, { mode });
    if (!result.ok) {
      notifications.show({
        color: "ember",
        title: "Apply failed",
        message: result.reason === "missing-session" ? "Adventure Log needs a session before Scene Forge can write into it." : "Scene Forge output is empty.",
      });
      return;
    }

    notifications.show({
      color: "moss",
      title: "Adventure Log updated",
      message: `${result.mode === "append" ? "Appended" : "Saved"} Scene Forge output to ${result.sessionTitle} (${result.field}).`,
    });
  };

  const handleCopyOutput = async () => {
    if (!canApply) return;
    try {
      await navigator.clipboard.writeText(draft.output);
      notifications.show({
        color: "moss",
        title: "Output copied",
        message: "Scene Forge output was copied to the clipboard.",
      });
    } catch {
      notifications.show({
        color: "ember",
        title: "Copy failed",
        message: "Clipboard access was not available in this runtime.",
      });
    }
  };

  const handleClear = () => {
    setDraft((current) => ({
      ...current,
      input: "",
      output: "",
    }));
  };

  const handleGenerateWithAi = async () => {
    if (!aiReady) {
      notifications.show({
        color: "ember",
        title: "Desktop AI unavailable",
        message: "Local AI generation only works in the desktop app build.",
      });
      return;
    }
    if (!canGenerate) {
      notifications.show({
        color: "ember",
        title: "Draft text required",
        message: "Add rough notes or a prompt before generating AI output.",
      });
      return;
    }

    setAiBusy(true);
    try {
      const response = await desktopApi.generateLocalAiText({
        mode: draft.mode,
        input: draft.input,
        context: buildSceneForgeAiContext(campaign, draft.mode),
        config: aiConfig,
      });
      const output = String(response?.text || "").trim()
        || generateSceneForgeDraft({
          campaign,
          mode: draft.mode,
          input: draft.input,
        });
      updateDraftField("output", output);

      if (draft.autoAppendToPrep) {
        const result = actions.applyToLatestSession("nextPrep", output, { mode: "append" });
        if (result.ok) {
          notifications.show({
            color: "moss",
            title: "AI output generated",
            message: `Local AI response saved and appended to ${result.sessionTitle} prep.`,
          });
          return;
        }
      }

      notifications.show({
        color: "moss",
        title: "AI output generated",
        message: "Local AI returned Scene Forge output for the current draft.",
      });
    } catch (error) {
      const message = String(error?.message || error || "Unknown error");
      notifications.show({
        color: "ember",
        title: "AI generation failed",
        message,
      });
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Campaign"
        title="Scene Forge"
        description="Turn rough notes into clean Kingmaker prep, recap text, and record-ready output without dropping the active frontier context."
        actions={
          <>
            <Button variant="default" onClick={() => navigate("/system/settings")}>
              Open Settings
            </Button>
            <Button variant="default" onClick={() => navigate("/campaign/table-notes")}>
              Open Table Notes
            </Button>
            <Button color="moss" onClick={() => navigate("/campaign/adventure-log")}>
              Open Adventure Log
            </Button>
          </>
        }
      />

      <Grid gutter="lg">
        {summaryCards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, md: 6, xl: 3 }}>
            <MetricCard label={card.label} value={card.value} helper={card.helper} valueTone={card.valueTone} />
          </Grid.Col>
        ))}
      </Grid>

      <Tabs.Root defaultValue="studio" className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Scene Forge views">
          <Tabs.Trigger value="studio" className="km-radix-trigger">
            Draft Studio
          </Tabs.Trigger>
          <Tabs.Trigger value="reference" className="km-radix-trigger">
            Reference Lane
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="studio" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Draft Input</Text>
                      <Title order={3}>Start Rough, Then Clean It</Title>
                    </div>
                    <Badge color="brass" variant="light">
                      {currentModeLabel}
                    </Badge>
                  </Group>

                  <Select
                    label="Mode"
                    value={draft.mode}
                    onChange={(value) => updateDraftField("mode", value || "session")}
                    data={WRITING_MODE_OPTIONS}
                  />

                  <Textarea
                    autosize
                    minRows={16}
                    label="Draft input"
                    placeholder="Type rough notes, a question, or a partial scene outline. Scene Forge will clean it into session-ready text."
                    value={draft.input}
                    onChange={(event) => updateDraftField("input", event.currentTarget.value)}
                  />

                  <Checkbox
                    checked={draft.autoAppendToPrep}
                    onChange={(event) => updateDraftField("autoAppendToPrep", event.currentTarget.checked)}
                    label="After local AI generate, append the output to the latest session prep"
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={handleGenerateClean} disabled={!canGenerate}>
                      Generate Clean Text
                    </Button>
                    <Button variant="default" onClick={handleGenerateWithAi} disabled={!canGenerate || aiBusy}>
                      Generate With Local AI
                    </Button>
                    <Button color="ember" variant="light" onClick={handleClear}>
                      Clear
                    </Button>
                  </Group>

                  <Text size="sm" c="dimmed">
                    {MODE_DESCRIPTIONS[draft.mode]}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Output</Text>
                      <Title order={3}>Refine Before You Commit</Title>
                    </div>
                    <Badge color="moss" variant="light">
                      {latestTargetLabel}
                    </Badge>
                  </Group>

                  <Textarea
                    autosize
                    minRows={16}
                    label="Scene Forge output"
                    value={draft.output}
                    onChange={(event) => updateDraftField("output", event.currentTarget.value)}
                    placeholder="Generated output appears here. You can edit it before sending it to the Adventure Log."
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button variant="default" onClick={handleCopyOutput} disabled={!canApply}>
                      Copy Output
                    </Button>
                    <Button color="moss" onClick={() => handleApply("summary")} disabled={!canApply}>
                      Use As Latest Summary
                    </Button>
                    <Button color="moss" variant="light" onClick={() => handleApply("nextPrep")} disabled={!canApply}>
                      Use As Latest Prep
                    </Button>
                    <Button variant="default" onClick={() => handleApply("nextPrep", "append")} disabled={!canApply}>
                      Append To Latest Prep
                    </Button>
                  </Group>

                  <Text size="sm" c="dimmed">
                    The output box is editable on purpose. Use Scene Forge to get close, then make the final version match your table voice before saving it into the log.
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="reference" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Latest Session</Text>
                  <Title order={3}>{model.latestSession?.title || "No session logged yet"}</Title>
                  <Text c="dimmed">{model.latestSession ? getSessionDateLabel(model.latestSession) : model.currentDateLabel}</Text>
                  <Text>{model.latestSession?.summary || "Adventure Log summary is empty."}</Text>
                  <Text size="sm" c="dimmed">
                    {model.latestSession?.nextPrep || "No prep handoff is recorded on the latest session yet."}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Quest Pressure</Text>
                  {model.activeQuests.length ? (
                    model.activeQuests.map((quest) => (
                      <div key={quest.id} className="km-pressure-card">
                        <Text fw={600}>{quest.title}</Text>
                        <Text size="sm" c="dimmed">
                          {quest.objective}
                        </Text>
                        {quest.nextBeat ? (
                          <Text size="sm" c="dimmed">
                            Next beat: {quest.nextBeat}
                          </Text>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <Text c="dimmed">No active quests are recorded yet.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          <Grid gutter="lg" mt="sm">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Event Pressure</Text>
                  {model.activeEvents.length ? (
                    model.activeEvents.map((eventItem) => (
                      <div key={eventItem.id} className="km-pressure-card">
                        <Group justify="space-between" align="flex-start">
                          <Text fw={600}>{eventItem.title}</Text>
                          <Badge variant="outline">
                            {eventItem.clock || 0}/{eventItem.clockMax || 0}
                          </Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {eventItem.trigger || eventItem.consequenceSummary || eventItem.fallout}
                        </Text>
                      </div>
                    ))
                  ) : (
                    <Text c="dimmed">No active event clocks are recorded yet.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Companion Watch</Text>
                  {model.companions.length ? (
                    model.companions.map((companion) => (
                      <div key={companion.id} className="km-pressure-card">
                        <Group justify="space-between" align="flex-start">
                          <Text fw={600}>{companion.name}</Text>
                          <Badge variant="outline">{companion.currentHex || "Off map"}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {clipText(companion.personalQuest || companion.notes, 180)}
                        </Text>
                      </div>
                    ))
                  ) : (
                    <Text c="dimmed">No tracked companions are active yet.</Text>
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
