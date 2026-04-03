import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Grid, Group, Paper, Stack, Switch, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import PageHeader from "../components/PageHeader";
import MetricCard from "../components/MetricCard";
import { useCampaign } from "../context/CampaignContext";
import {
  buildVaultAbsolutePath,
  buildVaultRootPreview,
  buildVaultSyncModel,
  buildVaultSyncPayload,
  formatVaultTimestamp,
  normalizeVaultSettingsDraft,
} from "../lib/vaultSync";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function clipText(value, limit = 220) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function getLatestSession(campaign) {
  return Array.isArray(campaign?.sessions) && campaign.sessions.length ? campaign.sessions[0] : null;
}

function createNoteDraft(campaign) {
  return {
    title: "",
    noteFolder: stringValue(campaign?.meta?.obsidian?.aiWriteFolder) || "AI Notes",
    sourceTab: "Vault Sync",
    model: stringValue(campaign?.meta?.aiConfig?.model),
    prompt: "",
    content: "",
  };
}

function VaultNoteCard({ note, onOpen }) {
  return (
    <Paper className="km-vault-note-card">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div className="km-vault-note-card__copy">
            <Text fw={700}>{stringValue(note?.title) || "Vault note"}</Text>
            <Text size="sm" c="dimmed">
              {stringValue(note?.modifiedAt) ? formatVaultTimestamp(note.modifiedAt) : "No modified date"}
            </Text>
          </div>
          <Badge color="moss" variant="light">
            Note
          </Badge>
        </Group>
        <Text size="sm" c="dimmed" className="km-vault-path">
          {stringValue(note?.relativePath) || "No relative path"}
        </Text>
        <Text size="sm" c="dimmed">
          {stringValue(note?.excerpt) || "No excerpt available."}
        </Text>
        <Group gap="sm" className="km-toolbar-wrap">
          <Button size="xs" variant="default" onClick={onOpen}>
            Open Note
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default function VaultSyncPage() {
  const { campaign, actions, desktopApi } = useCampaign();
  const model = useMemo(() => buildVaultSyncModel(campaign), [campaign]);
  const latestSession = useMemo(() => getLatestSession(campaign), [campaign]);
  const [activeTab, setActiveTab] = useState("sync");
  const [settingsDraft, setSettingsDraft] = useState(() => normalizeVaultSettingsDraft(campaign.meta?.obsidian, campaign.meta?.obsidian));
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [contextQuery, setContextQuery] = useState("");
  const [contextBusy, setContextBusy] = useState(false);
  const [contextMessage, setContextMessage] = useState("");
  const [contextResult, setContextResult] = useState(null);
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeMessage, setWriteMessage] = useState("");
  const [noteDraft, setNoteDraft] = useState(() => createNoteDraft(campaign));

  useEffect(() => {
    setSettingsDraft(normalizeVaultSettingsDraft(campaign.meta?.obsidian, campaign.meta?.obsidian));
  }, [campaign.meta?.obsidian]);

  useEffect(() => {
    setNoteDraft((current) => ({
      ...current,
      noteFolder: stringValue(current.noteFolder) || stringValue(campaign.meta?.obsidian?.aiWriteFolder) || "AI Notes",
      sourceTab: stringValue(current.sourceTab) || "Vault Sync",
      model: stringValue(current.model) || stringValue(campaign.meta?.aiConfig?.model),
    }));
  }, [campaign.meta?.aiConfig?.model, campaign.meta?.obsidian?.aiWriteFolder]);

  const desktopReady = Boolean(desktopApi);
  const rootPreview = buildVaultRootPreview(settingsDraft);
  const lastNotePath = buildVaultAbsolutePath(settingsDraft.vaultPath, campaign.meta?.obsidian?.lastAiNotePath);

  const commitSettings = (nextRaw = settingsDraft) => {
    const nextSettings = normalizeVaultSettingsDraft(nextRaw, campaign.meta?.obsidian);
    setSettingsDraft(nextSettings);
    actions.updateCampaign((current) => ({
      ...current,
      meta: {
        ...current.meta,
        obsidian: {
          ...(current.meta?.obsidian || {}),
          ...nextSettings,
        },
      },
    }));
    return nextSettings;
  };

  const handleSaveSettings = () => {
    commitSettings(settingsDraft);
    notifications.show({
      color: "moss",
      title: "Vault settings saved",
      message: "Vault path, folder names, and AI context settings were updated.",
    });
  };

  const handleChooseVault = async () => {
    if (!desktopApi?.pickObsidianVault) {
      notifications.show({
        color: "red",
        title: "Desktop bridge required",
        message: "Vault picking is only available in the desktop build.",
      });
      return;
    }
    try {
      const selected = await desktopApi.pickObsidianVault();
      if (!selected?.path) return;
      const nextSettings = commitSettings({
        ...settingsDraft,
        vaultPath: stringValue(selected.path),
        looksLikeVault: selected.looksLikeVault === true,
      });
      setSyncMessage(
        nextSettings.looksLikeVault
          ? `Vault selected: ${nextSettings.vaultPath}`
          : `Folder selected: ${nextSettings.vaultPath}. No .obsidian folder was detected yet.`
      );
      notifications.show({
        color: "moss",
        title: "Vault selected",
        message: nextSettings.looksLikeVault ? "Obsidian vault detected." : "Folder selected. Sync can still write markdown there.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Vault pick failed",
        message: stringValue(error?.message || error) || "Could not choose an Obsidian vault folder.",
      });
    }
  };

  const handleOpenPath = async (targetPath, title, fallbackMessage) => {
    const cleanPath = stringValue(targetPath);
    if (!cleanPath || !desktopApi?.openPath) return;
    try {
      await desktopApi.openPath(cleanPath);
    } catch (error) {
      notifications.show({
        color: "red",
        title,
        message: stringValue(error?.message || error) || fallbackMessage,
      });
    }
  };

  const handleSyncVault = async () => {
    if (!desktopApi?.syncObsidianVault) {
      notifications.show({
        color: "red",
        title: "Desktop bridge required",
        message: "Vault sync is only available in the desktop build.",
      });
      return;
    }
    const settings = commitSettings(settingsDraft);
    if (!settings.vaultPath) {
      notifications.show({
        color: "ember",
        title: "Vault required",
        message: "Choose your Obsidian vault folder before syncing.",
      });
      return;
    }

    setSyncBusy(true);
    setSyncMessage("Syncing campaign markdown into the vault...");
    try {
      const result = await desktopApi.syncObsidianVault(buildVaultSyncPayload(campaign, settings));
      commitSettings({
        ...settings,
        looksLikeVault: result?.looksLikeVault === true,
        lastSyncAt: stringValue(result?.syncedAt),
        lastSyncSummary: stringValue(result?.summary),
      });
      setSyncMessage(
        stringValue(result?.summary)
          ? `${stringValue(result.summary)} Root: ${stringValue(result.rootFolder)}`
          : `Synced notes to ${stringValue(result?.rootFolder) || settings.vaultPath}.`
      );
      notifications.show({
        color: "moss",
        title: "Vault sync complete",
        message: stringValue(result?.summary) || "Campaign notes were written into the Obsidian vault.",
      });
    } catch (error) {
      const message = stringValue(error?.message || error) || "Could not sync the vault.";
      setSyncMessage(message);
      notifications.show({
        color: "red",
        title: "Vault sync failed",
        message,
      });
    } finally {
      setSyncBusy(false);
    }
  };

  const handlePullContext = async () => {
    if (!desktopApi?.getObsidianVaultContext) {
      notifications.show({
        color: "red",
        title: "Desktop bridge required",
        message: "Vault context pull is only available in the desktop build.",
      });
      return;
    }
    const settings = commitSettings(settingsDraft);
    if (!settings.vaultPath) {
      notifications.show({
        color: "ember",
        title: "Vault required",
        message: "Choose your Obsidian vault folder before pulling context.",
      });
      return;
    }

    setContextBusy(true);
    setContextMessage("Reading markdown notes from the configured vault scope...");
    try {
      const result = await desktopApi.getObsidianVaultContext({
        vaultPath: settings.vaultPath,
        baseFolder: settings.baseFolder,
        readWholeVault: settings.readWholeVault,
        maxNotes: settings.aiContextNoteLimit,
        maxChars: settings.aiContextCharLimit,
        query: contextQuery,
        activeTab: "vault-sync",
      });
      setContextResult(result || null);
      commitSettings({
        ...settings,
        looksLikeVault: result?.looksLikeVault === true,
      });
      setContextMessage(
        Array.isArray(result?.notes) && result.notes.length
          ? `Pulled ${result.notes.length} ranked note(s) from ${stringValue(result?.sourceRoot)}.`
          : `No matching markdown notes were found in ${stringValue(result?.sourceRoot) || settings.vaultPath}.`
      );
    } catch (error) {
      const message = stringValue(error?.message || error) || "Could not pull vault context.";
      setContextMessage(message);
      notifications.show({
        color: "red",
        title: "Context pull failed",
        message,
      });
    } finally {
      setContextBusy(false);
    }
  };

  const handleWriteNote = async () => {
    if (!desktopApi?.writeObsidianAiNote) {
      notifications.show({
        color: "red",
        title: "Desktop bridge required",
        message: "Vault note writing is only available in the desktop build.",
      });
      return;
    }
    const settings = commitSettings(settingsDraft);
    if (!settings.vaultPath) {
      notifications.show({
        color: "ember",
        title: "Vault required",
        message: "Choose your Obsidian vault folder before writing a note.",
      });
      return;
    }
    if (!stringValue(noteDraft.content)) {
      notifications.show({
        color: "ember",
        title: "Note content required",
        message: "Add markdown content before writing a note into the vault.",
      });
      return;
    }

    const title = stringValue(noteDraft.title) || `Vault Sync - ${stringValue(campaign.kingdom?.currentDate) || "GM Note"}`;
    setWriteBusy(true);
    setWriteMessage("Writing markdown note into the vault...");
    try {
      const result = await desktopApi.writeObsidianAiNote({
        vaultPath: settings.vaultPath,
        baseFolder: settings.baseFolder,
        noteFolder: stringValue(noteDraft.noteFolder) || settings.aiWriteFolder,
        title,
        prompt: stringValue(noteDraft.prompt),
        content: stringValue(noteDraft.content),
        sourceTab: stringValue(noteDraft.sourceTab) || "Vault Sync",
        model: stringValue(noteDraft.model) || stringValue(campaign.meta?.aiConfig?.model),
        generatedAt: new Date().toISOString(),
      });
      commitSettings({
        ...settings,
        lastAiNoteAt: stringValue(result?.writtenAt),
        lastAiNotePath: stringValue(result?.relativePath),
      });
      setNoteDraft((current) => ({
        ...current,
        title,
      }));
      setWriteMessage(stringValue(result?.summary) || "Markdown note written to the vault.");
      notifications.show({
        color: "moss",
        title: "Note written",
        message: stringValue(result?.relativePath) || "Markdown note saved into the Obsidian vault.",
      });
    } catch (error) {
      const message = stringValue(error?.message || error) || "Could not write the markdown note.";
      setWriteMessage(message);
      notifications.show({
        color: "red",
        title: "Note write failed",
        message,
      });
    } finally {
      setWriteBusy(false);
    }
  };

  const handleLoadLatestSummary = () => {
    if (!latestSession) return;
    setNoteDraft((current) => ({
      ...current,
      title: `${stringValue(latestSession.title) || "Latest Session"} Summary`,
      sourceTab: "Adventure Log",
      prompt: `Preserve the current session summary for ${stringValue(latestSession.title)}.`,
      content: stringValue(latestSession.summary),
    }));
    setActiveTab("write");
  };

  const handleLoadLatestPrep = () => {
    if (!latestSession) return;
    setNoteDraft((current) => ({
      ...current,
      title: `${stringValue(latestSession.title) || "Latest Session"} Prep`,
      sourceTab: "Adventure Log",
      prompt: `Preserve the current prep handoff for ${stringValue(latestSession.title)}.`,
      content: stringValue(latestSession.nextPrep),
    }));
    setActiveTab("write");
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Links"
        title="Vault Sync"
        description="Connect Kingmaker Companion to your Obsidian vault, export the full campaign note set into markdown, pull compact note context back in for AI use, and write manual GM notes directly into the vault."
        actions={(
          <>
            <Button variant="default" onClick={() => void handleChooseVault()} disabled={!desktopApi?.pickObsidianVault}>
              Choose Vault
            </Button>
            <Button color="moss" onClick={() => void handleSyncVault()} loading={syncBusy} disabled={!desktopApi?.syncObsidianVault}>
              Sync Now
            </Button>
          </>
        )}
      />

      <Grid gutter="lg">
        {model.summaryCards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, md: 6, xl: 3 }}>
            <MetricCard label={card.label} value={card.value} helper={card.helper} valueTone={card.valueTone} />
          </Grid.Col>
        ))}
      </Grid>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Vault Sync views">
          <Tabs.Trigger value="sync" className="km-radix-trigger">
            Settings And Sync
          </Tabs.Trigger>
          <Tabs.Trigger value="context" className="km-radix-trigger">
            AI Context Pull
          </Tabs.Trigger>
          <Tabs.Trigger value="write" className="km-radix-trigger">
            Write Note
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="sync" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel km-vault-sync-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Vault Settings</Text>
                      <Title order={3}>Obsidian Connection</Title>
                    </div>
                    <Badge color={desktopReady ? "moss" : "gray"} variant="light">
                      {desktopReady ? "Desktop bridge ready" : "Desktop required"}
                    </Badge>
                  </Group>

                  <TextInput
                    label="Vault folder"
                    placeholder="C:\\Users\\Chris Bender\\Documents\\Obsidian Vault"
                    value={settingsDraft.vaultPath}
                    onChange={(event) => setSettingsDraft((current) => ({ ...current, vaultPath: event.currentTarget.value }))}
                  />

                  <TextInput
                    label="Kingmaker folder inside vault"
                    placeholder="Kingmaker Companion"
                    value={settingsDraft.baseFolder}
                    onChange={(event) => setSettingsDraft((current) => ({ ...current, baseFolder: event.currentTarget.value }))}
                  />

                  <TextInput
                    label="AI note folder inside Kingmaker root"
                    placeholder="AI Notes"
                    value={settingsDraft.aiWriteFolder}
                    onChange={(event) => setSettingsDraft((current) => ({ ...current, aiWriteFolder: event.currentTarget.value }))}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="AI context note limit"
                        type="number"
                        min={1}
                        max={12}
                        value={String(settingsDraft.aiContextNoteLimit)}
                        onChange={(event) => setSettingsDraft((current) => ({ ...current, aiContextNoteLimit: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="AI context character budget"
                        type="number"
                        min={800}
                        max={12000}
                        step={200}
                        value={String(settingsDraft.aiContextCharLimit)}
                        onChange={(event) => setSettingsDraft((current) => ({ ...current, aiContextCharLimit: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                  </Grid>

                  <Switch
                    checked={settingsDraft.useForAiContext !== false}
                    onChange={(event) => setSettingsDraft((current) => ({ ...current, useForAiContext: event.currentTarget.checked }))}
                    label="Use vault notes as Companion AI context"
                    description="When enabled, the desktop AI flows can pull markdown notes from this vault."
                  />

                  <Switch
                    checked={settingsDraft.readWholeVault !== false}
                    onChange={(event) => setSettingsDraft((current) => ({ ...current, readWholeVault: event.currentTarget.checked }))}
                    label="Read the whole vault for AI context"
                    description="Turn this off to limit AI note reads to the Kingmaker folder only."
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button variant="default" onClick={() => void handleChooseVault()} disabled={!desktopApi?.pickObsidianVault}>
                      Choose Vault
                    </Button>
                    <Button color="moss" onClick={handleSaveSettings}>
                      Save Settings
                    </Button>
                    <Button variant="default" onClick={() => void handleOpenPath(settingsDraft.vaultPath, "Open vault failed", "Could not open the selected vault folder.")} disabled={!settingsDraft.vaultPath || !desktopApi?.openPath}>
                      Open Vault
                    </Button>
                  </Group>

                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text fw={700}>Current root preview</Text>
                      <Text size="sm" c="dimmed" className="km-vault-path">
                        {rootPreview || "Choose a vault folder to preview the Kingmaker sync root."}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {settingsDraft.looksLikeVault
                          ? "The selected folder currently looks like a real Obsidian vault."
                          : "No .obsidian folder has been detected yet. Sync can still create markdown there."}
                      </Text>
                    </Stack>
                  </Paper>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel km-vault-sync-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Campaign Markdown Export</Text>
                      <Title order={3}>Sync Status</Title>
                    </div>
                    <Badge color={syncBusy ? "ember" : "moss"} variant="light">
                      {syncBusy ? "Syncing" : "Ready"}
                    </Badge>
                  </Group>

                  <Text c="dimmed">
                    Sync writes a campaign home note plus structured markdown for sessions, NPCs, companions, quests, events, locations, kingdom state, hex map state, and table notes.
                  </Text>

                  <div className="km-vault-guide-list">
                    <Text component="div" size="sm" c="dimmed">
                      1. Choose the vault folder.
                    </Text>
                    <Text component="div" size="sm" c="dimmed">
                      2. Set the Kingmaker folder name inside that vault.
                    </Text>
                    <Text component="div" size="sm" c="dimmed">
                      3. Sync the campaign to generate or refresh markdown files.
                    </Text>
                    <Text component="div" size="sm" c="dimmed">
                      4. Pull note context or write manual notes back into the vault as needed.
                    </Text>
                  </div>

                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text fw={700}>Last sync</Text>
                      <Text size="sm" c="dimmed">
                        {formatVaultTimestamp(campaign.meta?.obsidian?.lastSyncAt)}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {stringValue(campaign.meta?.obsidian?.lastSyncSummary) || "No sync has been run yet."}
                      </Text>
                    </Stack>
                  </Paper>

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={() => void handleSyncVault()} loading={syncBusy} disabled={!desktopApi?.syncObsidianVault}>
                      Sync Campaign To Vault
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => void handleOpenPath(rootPreview, "Open sync root failed", "Could not open the Kingmaker sync folder.")}
                      disabled={!rootPreview || !desktopApi?.openPath}
                    >
                      Open Sync Root
                    </Button>
                    <Button variant="default" onClick={handleLoadLatestSummary} disabled={!latestSession}>
                      Load Latest Session Summary
                    </Button>
                  </Group>

                  <Text size="sm" c="dimmed">
                    {syncMessage || "Run sync whenever you want the vault markdown copy refreshed from the current campaign state."}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="context" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 4 }}>
              <Paper className="km-panel km-content-panel km-vault-context-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Read From Vault</Text>
                      <Title order={3}>AI Context Pull</Title>
                    </div>
                    <Badge color={contextBusy ? "ember" : settingsDraft.useForAiContext ? "moss" : "gray"} variant="light">
                      {contextBusy ? "Reading" : settingsDraft.useForAiContext ? "Enabled" : "Manual only"}
                    </Badge>
                  </Group>

                  <TextInput
                    label="Optional query"
                    placeholder="bandit pressure, charter politics, unrest, hex travel"
                    value={contextQuery}
                    onChange={(event) => setContextQuery(event.currentTarget.value)}
                  />

                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text fw={700}>Read scope</Text>
                      <Text size="sm" c="dimmed">
                        {settingsDraft.readWholeVault ? "Whole vault" : "Kingmaker folder only"}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {`${settingsDraft.aiContextNoteLimit} ranked notes / ${settingsDraft.aiContextCharLimit} character budget`}
                      </Text>
                    </Stack>
                  </Paper>

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={() => void handlePullContext()} loading={contextBusy} disabled={!desktopApi?.getObsidianVaultContext}>
                      Pull Vault Context
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => void handleOpenPath(contextResult?.sourceRoot || settingsDraft.vaultPath, "Open source root failed", "Could not open the selected source root.")}
                      disabled={!(contextResult?.sourceRoot || settingsDraft.vaultPath) || !desktopApi?.openPath}
                    >
                      Open Source Root
                    </Button>
                  </Group>

                  <Text size="sm" c="dimmed">
                    {contextMessage ||
                      "Preview the same markdown retrieval scope the desktop AI bridge can use when you enable vault context."}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 8 }}>
              <Stack gap="lg">
                <Paper className="km-panel km-content-panel km-vault-context-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Context Summary</Text>
                        <Title order={3}>
                          {contextResult?.sourceRoot ? clipText(contextResult.sourceRoot, 70) : "No context pull yet"}
                        </Title>
                      </div>
                      <Badge color="moss" variant="light">
                        {Array.isArray(contextResult?.notes) ? contextResult.notes.length : 0}
                      </Badge>
                    </Group>

                    <Text size="sm" c="dimmed" className="km-vault-path">
                      {contextResult?.sourceRoot || "Run Pull Vault Context to preview ranked markdown note matches."}
                    </Text>

                    <Textarea
                      readOnly
                      autosize
                      minRows={10}
                      value={stringValue(contextResult?.summary) || "No vault context summary generated yet."}
                    />
                  </Stack>
                </Paper>

                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Ranked Notes</Text>
                        <Title order={3}>Previewed Markdown Matches</Title>
                      </div>
                      <Badge color="brass" variant="light">
                        {Array.isArray(contextResult?.notes) ? contextResult.notes.length : 0}
                      </Badge>
                    </Group>

                    <div className="km-vault-note-list">
                      {Array.isArray(contextResult?.notes) && contextResult.notes.length ? (
                        contextResult.notes.map((note) => (
                          <VaultNoteCard
                            key={`${stringValue(note?.relativePath)}-${stringValue(note?.modifiedAt)}`}
                            note={note}
                            onOpen={() =>
                              void handleOpenPath(
                                buildVaultAbsolutePath(settingsDraft.vaultPath, note?.relativePath),
                                "Open note failed",
                                "Could not open the selected markdown note."
                              )
                            }
                          />
                        ))
                      ) : (
                        <Paper className="km-record-card">
                          <Text c="dimmed">
                            No ranked vault notes yet. Pull context to preview what the AI bridge would read from Obsidian.
                          </Text>
                        </Paper>
                      )}
                    </div>
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="write" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel km-vault-write-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Write To Vault</Text>
                      <Title order={3}>Manual Markdown Note</Title>
                    </div>
                    <Badge color={writeBusy ? "ember" : "moss"} variant="light">
                      {writeBusy ? "Writing" : "Ready"}
                    </Badge>
                  </Group>

                  <TextInput
                    label="Title"
                    placeholder="Bandit escalation note, monthly kingdom recap, prep scratchpad"
                    value={noteDraft.title}
                    onChange={(event) => setNoteDraft((current) => ({ ...current, title: event.currentTarget.value }))}
                  />

                  <TextInput
                    label="Folder inside Kingmaker root"
                    placeholder="AI Notes"
                    value={noteDraft.noteFolder}
                    onChange={(event) => setNoteDraft((current) => ({ ...current, noteFolder: event.currentTarget.value }))}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Source tab"
                        placeholder="Vault Sync"
                        value={noteDraft.sourceTab}
                        onChange={(event) => setNoteDraft((current) => ({ ...current, sourceTab: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Model"
                        placeholder={stringValue(campaign.meta?.aiConfig?.model) || "llama3.1:8b"}
                        value={noteDraft.model}
                        onChange={(event) => setNoteDraft((current) => ({ ...current, model: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                  </Grid>

                  <Textarea
                    label="Prompt or note origin"
                    autosize
                    minRows={5}
                    placeholder="Why this note exists, what prompted it, or the request that produced it."
                    value={noteDraft.prompt}
                    onChange={(event) => setNoteDraft((current) => ({ ...current, prompt: event.currentTarget.value }))}
                  />

                  <Textarea
                    label="Markdown content"
                    autosize
                    minRows={12}
                    placeholder="# Frontier Pressure&#10;&#10;- Bandits hit the south road again.&#10;- Oleg needs proof the charter can hold the line."
                    value={noteDraft.content}
                    onChange={(event) => setNoteDraft((current) => ({ ...current, content: event.currentTarget.value }))}
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={() => void handleWriteNote()} loading={writeBusy} disabled={!desktopApi?.writeObsidianAiNote}>
                      Write Note To Vault
                    </Button>
                    <Button variant="default" onClick={handleLoadLatestSummary} disabled={!latestSession}>
                      Load Latest Summary
                    </Button>
                    <Button variant="default" onClick={handleLoadLatestPrep} disabled={!latestSession}>
                      Load Latest Prep
                    </Button>
                    <Button variant="default" onClick={() => setNoteDraft(createNoteDraft(campaign))}>
                      Clear Draft
                    </Button>
                  </Group>

                  <Text size="sm" c="dimmed">
                    {writeMessage || "Write manual markdown notes into the configured Kingmaker folder without leaving the app."}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Stack gap="lg">
                <Paper className="km-panel km-content-panel km-vault-write-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Current Destination</Text>
                        <Title order={3}>{stringValue(noteDraft.noteFolder) || settingsDraft.aiWriteFolder || "AI Notes"}</Title>
                      </div>
                      <Badge color="brass" variant="light">
                        Markdown
                      </Badge>
                    </Group>

                    <Text size="sm" c="dimmed" className="km-vault-path">
                      {rootPreview
                        ? `${rootPreview}${rootPreview.endsWith("\\") ? "" : "\\"}${stringValue(noteDraft.noteFolder) || settingsDraft.aiWriteFolder || "AI Notes"}`
                        : "Choose a vault first to preview the final note destination."}
                    </Text>

                    <Paper className="km-record-card">
                      <Stack gap="xs">
                        <Text fw={700}>Last written note</Text>
                        <Text size="sm" c="dimmed" className="km-vault-path">
                          {stringValue(campaign.meta?.obsidian?.lastAiNotePath) || "No note has been written yet."}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {formatVaultTimestamp(campaign.meta?.obsidian?.lastAiNoteAt)}
                        </Text>
                      </Stack>
                    </Paper>

                    <Group gap="sm" className="km-toolbar-wrap">
                      <Button
                        variant="default"
                        onClick={() => void handleOpenPath(lastNotePath, "Open last note failed", "Could not open the most recent vault note.")}
                        disabled={!stringValue(campaign.meta?.obsidian?.lastAiNotePath) || !desktopApi?.openPath}
                      >
                        Open Last Note
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => void handleOpenPath(rootPreview, "Open sync root failed", "Could not open the Kingmaker sync root.")}
                        disabled={!rootPreview || !desktopApi?.openPath}
                      >
                        Open Sync Root
                      </Button>
                    </Group>
                  </Stack>
                </Paper>

                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Recommended Uses</Text>
                        <Title order={3}>What Belongs Here</Title>
                      </div>
                      <Badge color="moss" variant="light">
                        GM workflow
                      </Badge>
                    </Group>

                    <div className="km-vault-guide-list">
                      <Text component="div" size="sm" c="dimmed">
                        Session summary snapshots you want outside the app.
                      </Text>
                      <Text component="div" size="sm" c="dimmed">
                        Kingdom turn recaps and month-close notes for later reference.
                      </Text>
                      <Text component="div" size="sm" c="dimmed">
                        Prep scratchpads, frontier threat boards, or rumor summaries.
                      </Text>
                      <Text component="div" size="sm" c="dimmed">
                        AI-generated drafts you want to clean up further inside Obsidian.
                      </Text>
                    </div>

                    <Paper className="km-record-card">
                      <Text size="sm" c="dimmed">
                        The write tool uses the same desktop vault bridge as the legacy workspace, but this page makes the target folder and note payload explicit instead of hiding it behind a single global AI output button.
                      </Text>
                    </Paper>
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
