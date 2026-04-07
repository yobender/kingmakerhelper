import { useEffect, useState } from "react";
import { IconBooks, IconLibrary, IconMap2, IconSparkles } from "@tabler/icons-react";
import { Badge, Button, Checkbox, Grid, Group, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import UiThemeSwitcher from "../components/UiThemeSwitcher";
import { useCampaign } from "../context/CampaignContext";
import { useUiTheme } from "../context/UiThemeContext";
import { DEFAULT_AI_CONFIG } from "../lib/campaignState";
import { getLegacyWorkspaceUrl } from "../lib/desktop";

const TEMPERATURE_OPTIONS = ["0.1", "0.2", "0.4", "0.7", "1.0"].map((value) => ({
  value,
  label: value,
}));

const MAX_TOKEN_OPTIONS = ["320", "640", "1024", "1600"].map((value) => ({
  value,
  label: value,
}));

const TIMEOUT_OPTIONS = ["120", "240", "480", "900"].map((value) => ({
  value,
  label: `${value}s`,
}));

function formatSavedAt(value) {
  const time = Date.parse(value || "");
  if (Number.isNaN(time)) return "Not saved yet";
  return new Date(time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatConfigMessage(value) {
  return String(value || "").trim() || "No local AI status yet.";
}

function SettingsShortcutCard({ title, description, badge, buttonLabel, onClick, icon: Icon }) {
  return (
    <Paper className="km-record-card">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            {Icon ? <Icon size={18} stroke={1.8} /> : null}
            <Stack gap={3}>
              <Text fw={700}>{title}</Text>
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            </Stack>
          </Group>
          {badge ? (
            <Badge variant="light" color="brass">
              {badge}
            </Badge>
          ) : null}
        </Group>

        <Group justify="flex-start">
          <Button variant="default" onClick={onClick}>
            {buttonLabel}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default function SettingsPage({ onExport, onImport, onReset }) {
  const navigate = useNavigate();
  const { activeTheme } = useUiTheme();
  const { campaign, desktopApi, lastSavedAt, persistenceError, actions } = useCampaign();
  const aiConfig = campaign.meta?.aiConfig || DEFAULT_AI_CONFIG;
  const [campaignNameDraft, setCampaignNameDraft] = useState(campaign.meta?.campaignName || "Kingmaker");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    setCampaignNameDraft(campaign.meta?.campaignName || "Kingmaker");
  }, [campaign.meta?.campaignName]);

  const aiReady = Boolean(desktopApi?.generateLocalAiText);
  const cleanCampaignName = campaignNameDraft.trim();
  const canSaveCampaignName = cleanCampaignName.length > 0 && cleanCampaignName !== (campaign.meta?.campaignName || "Kingmaker");

  const summaryCards = [
    {
      label: "Campaign Name",
      value: campaign.meta?.campaignName || "Kingmaker",
      helper: "Global app identity used in the shell, exports, and external handoff payloads.",
      valueTone: "compact",
    },
    {
      label: "Active Style",
      value: activeTheme.label,
      helper: activeTheme.description,
      valueTone: "compact",
    },
    {
      label: "Local AI",
      value: aiReady ? aiConfig.model : "Desktop required",
      helper: aiReady ? `${aiConfig.endpoint} / shared across AI-enabled pages` : "Launch the desktop build to use the local AI bridge.",
      valueTone: "compact",
    },
    {
      label: "Save Status",
      value: persistenceError ? "Attention" : formatSavedAt(lastSavedAt),
      helper: persistenceError || "Campaign state is saved automatically as you edit.",
      valueTone: "compact",
    },
  ];

  const handleSaveCampaignName = () => {
    if (!cleanCampaignName) {
      notifications.show({
        color: "ember",
        title: "Campaign name required",
        message: "Enter a campaign name before saving workspace identity.",
      });
      return;
    }

    actions.updateMeta({ campaignName: cleanCampaignName });
    notifications.show({
      color: "moss",
      title: "Workspace updated",
      message: `Campaign name saved as ${cleanCampaignName}.`,
    });
  };

  const handleConfigChange = (field, value) => {
    actions.updateAiConfig({ [field]: value });
  };

  const handleTestAi = async () => {
    if (!desktopApi?.testLocalAi) {
      notifications.show({
        color: "ember",
        title: "Desktop AI unavailable",
        message: "Test connection is only available in the desktop app build.",
      });
      return;
    }

    setAiBusy(true);
    setAiStatus("Testing local AI connection...");
    try {
      const result = await desktopApi.testLocalAi(aiConfig);
      setAvailableModels(Array.isArray(result?.models) ? result.models : []);
      setAiStatus(result?.message || "Local AI connection ok.");
      notifications.show({
        color: "moss",
        title: "Connection ok",
        message: result?.message || "Local AI connection ok.",
      });
    } catch (error) {
      const message = String(error?.message || error || "Unknown error");
      setAiStatus(message);
      notifications.show({
        color: "ember",
        title: "Connection test failed",
        message,
      });
    } finally {
      setAiBusy(false);
    }
  };

  const handleLoadModels = async () => {
    if (!desktopApi?.listLocalAiModels) {
      notifications.show({
        color: "ember",
        title: "Model list unavailable",
        message: "Installed model discovery only works in the desktop app build.",
      });
      return;
    }

    setAiBusy(true);
    setAiStatus("Loading installed local AI models...");
    try {
      const result = await desktopApi.listLocalAiModels(aiConfig);
      const models = Array.isArray(result?.models) ? result.models : [];
      setAvailableModels(models);
      setAiStatus(models.length ? `Loaded ${models.length} installed model${models.length === 1 ? "" : "s"}.` : "No installed models were reported.");
    } catch (error) {
      const message = String(error?.message || error || "Unknown error");
      setAiStatus(message);
      notifications.show({
        color: "ember",
        title: "Model list failed",
        message,
      });
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Global options live here now: workspace identity and data actions, shell appearance, and shared local AI defaults. Page-specific setup stays close to the workflow it controls."
      />

      <Grid gutter="lg">
        {summaryCards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, md: 6, xl: 3 }}>
            <MetricCard label={card.label} value={card.value} helper={card.helper} valueTone={card.valueTone} />
          </Grid.Col>
        ))}
      </Grid>

      <Tabs.Root defaultValue="workspace" className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Settings views">
          <Tabs.Trigger value="workspace" className="km-radix-trigger">
            Workspace
          </Tabs.Trigger>
          <Tabs.Trigger value="appearance" className="km-radix-trigger">
            Appearance
          </Tabs.Trigger>
          <Tabs.Trigger value="ai" className="km-radix-trigger">
            Local AI
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="workspace" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Workspace Identity</Text>
                    <Title order={3}>Campaign and Data Controls</Title>
                  </div>

                  <TextInput
                    label="Campaign Name"
                    value={campaignNameDraft}
                    onChange={(event) => setCampaignNameDraft(event.currentTarget.value)}
                    placeholder="Kingmaker"
                  />

                  <Text size="sm" c="dimmed">
                    This name appears in the shell, exported files, Foundry payloads, and vault sync metadata.
                  </Text>

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={handleSaveCampaignName} disabled={!canSaveCampaignName}>
                      Save Name
                    </Button>
                    <Button variant="default" onClick={() => setCampaignNameDraft(campaign.meta?.campaignName || "Kingmaker")} disabled={campaignNameDraft === (campaign.meta?.campaignName || "Kingmaker")}>
                      Reset Draft
                    </Button>
                  </Group>

                  <div>
                    <Text className="km-section-kicker">Data Actions</Text>
                    <Group gap="sm" className="km-toolbar-wrap" mt="xs">
                      <Button variant="default" onClick={onImport}>
                        Import JSON
                      </Button>
                      <Button color="moss" onClick={onExport}>
                        Export JSON
                      </Button>
                      <Button color="ember" variant="light" onClick={onReset}>
                        Load Starter State
                      </Button>
                      <Button component="a" href={getLegacyWorkspaceUrl()} variant="default">
                        Open Legacy Workspace
                      </Button>
                    </Group>
                  </div>

                  <Text size="sm" c="dimmed">
                    Save state: {persistenceError ? persistenceError : `last automatic save at ${formatSavedAt(lastSavedAt)}.`}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Keep In Context</Text>
                    <Title order={3}>Settings That Should Stay On Their Own Pages</Title>
                  </div>

                  <SettingsShortcutCard
                    icon={IconBooks}
                    title="Source Library"
                    description="PDF folder choice, indexing, and brief generation belong with the library workflow because they affect search state and summaries directly."
                    badge="Reference"
                    buttonLabel="Open Source Library"
                    onClick={() => navigate("/reference/source-library")}
                  />

                  <SettingsShortcutCard
                    icon={IconLibrary}
                    title="Vault Sync"
                    description="Vault path, AI note folders, and context pull limits stay with the Obsidian bridge so the sync workflow remains explicit."
                    badge="Links"
                    buttonLabel="Open Vault Sync"
                    onClick={() => navigate("/links/vault-sync")}
                  />

                  <SettingsShortcutCard
                    icon={IconMap2}
                    title="Hex Map Display"
                    description="Grid size, background art, and map offsets are visual editing tools, so they stay on the map page where changes are immediately visible."
                    badge="World"
                    buttonLabel="Open Hex Map"
                    onClick={() => navigate("/world/hex-map")}
                  />
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="appearance" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Shell Style</Text>
                    <Title order={3}>Style Studio</Title>
                  </div>
                  <Text c="dimmed">
                    These looks change the shell, tabs, cards, buttons, and navigation without touching your campaign data. The selected look is saved locally on this machine.
                  </Text>
                  <UiThemeSwitcher />
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Where It Applies</Text>
                    <Title order={3}>Shared UI Surfaces</Title>
                  </div>

                  <div className="km-record-card">
                    <Text fw={700}>Current Look: {activeTheme.label}</Text>
                    <Text size="sm" c="dimmed">
                      {activeTheme.description}
                    </Text>
                  </div>

                  <div className="km-record-card">
                    <Text fw={700}>Rethemed globally</Text>
                    <Text size="sm" c="dimmed">
                      Navigation, page headers, Radix tabs, cards, default buttons, and shared shell panels now follow the selected preset.
                    </Text>
                  </div>

                  <div className="km-record-card">
                    <Text fw={700}>Still contextual</Text>
                    <Text size="sm" c="dimmed">
                      Hex map content, PDF results, and workflow-specific data stay on their home pages; only the shared presentation layer changes here.
                    </Text>
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="ai" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 8 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Global AI Defaults</Text>
                      <Title order={3}>Ollama Bridge</Title>
                    </div>
                    <Badge color={aiReady ? "moss" : "gray"} variant="light">
                      {aiReady ? "Desktop Runtime" : "Browser Preview"}
                    </Badge>
                  </Group>

                  <Text c="dimmed">
                    These defaults are shared by Scene Forge, Source Library briefings, and vault note-writing flows.
                  </Text>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Endpoint"
                        value={aiConfig.endpoint}
                        onChange={(event) => handleConfigChange("endpoint", event.currentTarget.value)}
                        placeholder="http://127.0.0.1:11434"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Model"
                        value={aiConfig.model}
                        onChange={(event) => handleConfigChange("model", event.currentTarget.value)}
                        placeholder="llama3.1:8b"
                      />
                    </Grid.Col>
                  </Grid>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Temperature"
                        value={String(aiConfig.temperature)}
                        onChange={(value) => handleConfigChange("temperature", Number(value || "0.2"))}
                        data={TEMPERATURE_OPTIONS}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Max Output Tokens"
                        value={String(aiConfig.maxOutputTokens)}
                        onChange={(value) => handleConfigChange("maxOutputTokens", Number(value || "320"))}
                        data={MAX_TOKEN_OPTIONS}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Timeout (seconds)"
                        value={String(aiConfig.timeoutSec)}
                        onChange={(value) => handleConfigChange("timeoutSec", Number(value || "120"))}
                        data={TIMEOUT_OPTIONS}
                      />
                    </Grid.Col>
                  </Grid>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Checkbox
                        checked={aiConfig.compactContext !== false}
                        onChange={(event) => handleConfigChange("compactContext", event.currentTarget.checked)}
                        label="Compact context"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Checkbox
                        checked={aiConfig.usePdfContext !== false}
                        onChange={(event) => handleConfigChange("usePdfContext", event.currentTarget.checked)}
                        label="Use PDF context"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Checkbox
                        checked={aiConfig.useAonRules !== false}
                        onChange={(event) => handleConfigChange("useAonRules", event.currentTarget.checked)}
                        label="Use AON rules lookup"
                      />
                    </Grid.Col>
                  </Grid>

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={handleTestAi} disabled={aiBusy}>
                      Test Local AI
                    </Button>
                    <Button variant="default" onClick={handleLoadModels} disabled={aiBusy}>
                      Refresh Models
                    </Button>
                    <Button variant="default" leftSection={<IconSparkles size={16} />} onClick={() => navigate("/campaign/scene-forge")}>
                      Open Scene Forge
                    </Button>
                  </Group>

                  <Text size="sm" c="dimmed">
                    {formatConfigMessage(aiStatus)}
                  </Text>

                  {availableModels.length ? (
                    <Stack gap="sm">
                      <Text className="km-section-kicker">Installed Models</Text>
                      <Group gap="sm" className="km-toolbar-wrap">
                        {availableModels.map((modelName) => (
                          <Button
                            key={modelName}
                            size="compact-sm"
                            variant={modelName === aiConfig.model ? "filled" : "light"}
                            color="moss"
                            onClick={() => handleConfigChange("model", modelName)}
                          >
                            {modelName}
                          </Button>
                        ))}
                      </Group>
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 4 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Why It Moved</Text>
                    <Title order={3}>Keep AI Global</Title>
                  </div>

                  <div className="km-record-card">
                    <Text fw={700}>Scene Forge is now cleaner</Text>
                    <Text size="sm" c="dimmed">
                      Scene Forge keeps generation and editing in one place, while connection and model defaults live here.
                    </Text>
                  </div>

                  <div className="km-record-card">
                    <Text fw={700}>Shared behavior stays aligned</Text>
                    <Text size="sm" c="dimmed">
                      PDF grounding, rules lookup, and model choice now update once instead of being hidden inside a single page.
                    </Text>
                  </div>

                  <div className="km-record-card">
                    <Text fw={700}>Desktop runtime recommended</Text>
                    <Text size="sm" c="dimmed">
                      Connection tests and installed model discovery require the desktop build because they use the Electron bridge.
                    </Text>
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
