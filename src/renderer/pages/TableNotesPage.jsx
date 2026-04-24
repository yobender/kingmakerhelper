import { useEffect, useMemo, useState } from "react";
import { ActionIcon, Badge, Button, Grid, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import CompactMetaStrip from "../components/CompactMetaStrip";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { CAPTURE_KIND_OPTIONS } from "../lib/campaignState";
import { getSessionDateLabel } from "../lib/selectors";
import { buildTableNotesModel, formatCaptureTimestamp, getAppendableCaptureEntries, getCaptureSearchText } from "../lib/tableNotes";

const CAPTURE_SELECT_DATA = CAPTURE_KIND_OPTIONS.map((kind) => ({
  value: kind,
  label: kind,
}));

const KIND_COLORS = Object.freeze({
  hook: "brass",
  npc: "moss",
  rule: "ember",
  loot: "brass",
  retcon: "ember",
  scene: "moss",
  combat: "dark",
  note: "gray",
});

function clipText(value, limit = 120) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function getKindColor(kind) {
  return KIND_COLORS[String(kind || "").toLowerCase()] || "gray";
}

export default function TableNotesPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildTableNotesModel(campaign);
  const [sessionId, setSessionId] = useState(model.defaultSessionId);
  const [kind, setKind] = useState("Note");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  useEffect(() => {
    const hasSelectedSession = model.sessions.some((session) => session.id === sessionId);
    if (!sessionId || !hasSelectedSession) {
      setSessionId(model.defaultSessionId);
    }
  }, [model.defaultSessionId, model.sessions, sessionId]);

  const sessionOptions = model.sessions.map((session) => ({
    value: session.id,
    label: session.title,
  }));

  const previewEntries = useMemo(
    () => getAppendableCaptureEntries(model.entries, sessionId || model.defaultSessionId),
    [model.defaultSessionId, model.entries, sessionId]
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return model.entries.filter((entry) => {
      const matchesKind = kindFilter === "all" || String(entry.kind || "").toLowerCase() === kindFilter;
      const matchesQuery = !normalizedQuery || getCaptureSearchText(entry, model.sessionMap).includes(normalizedQuery);
      return matchesKind && matchesQuery;
    });
  }, [kindFilter, model.entries, model.sessionMap, query]);

  const targetSession = model.sessionMap.get(sessionId || model.defaultSessionId) || model.latestSession || null;

  const summaryCards = [
    {
      label: "Capture Queue",
      value: `${model.entries.length}`,
      helper: `${model.linkedEntries.length} linked / ${Math.max(0, model.entries.length - model.linkedEntries.length)} unlinked`,
      valueTone: "number",
    },
    {
      label: "Rules Flagged",
      value: `${model.rulingEntries.length}`,
      helper: model.rulingEntries[0] ? clipText(model.rulingEntries[0].note) : "No rule or retcon notes captured yet.",
      valueTone: "number",
    },
    {
      label: "Append Target",
      value: targetSession?.title || "No Session",
      helper: targetSession ? getSessionDateLabel(targetSession) : "Adventure Log needs a session before notes can be promoted.",
      valueTone: "compact",
      onClick: () => navigate("/campaign/adventure-log"),
    },
    {
      label: "Latest Capture",
      value: model.entries[0]?.kind || "Empty",
      helper: model.entries[0]
        ? `${formatCaptureTimestamp(model.entries[0].timestamp)} / ${clipText(model.entries[0].note)}`
        : "Capture live notes here while you run the table.",
      valueTone: "compact",
    },
  ];

  const handleCapture = (kindOverride) => {
    const chosenKind = kindOverride || kind;
    if (!note.trim()) {
      notifications.show({
        color: "ember",
        title: "Note required",
        message: "Add table-side text before capturing an entry.",
      });
      return;
    }

    actions.addCaptureEntry({
      kind: chosenKind,
      note,
      sessionId: sessionId || "",
    });
    setKind(chosenKind);
    setNote("");
    notifications.show({
      color: "moss",
      title: "Table note captured",
      message: `${chosenKind} note added${targetSession ? ` for ${targetSession.title}` : ""}.`,
    });
  };

  const handleAppend = () => {
    const result = actions.appendCaptureToSession(sessionId || model.defaultSessionId);
    if (!result.ok) {
      notifications.show({
        color: "ember",
        title: "Append failed",
        message:
          result.reason === "missing-session"
            ? "Pick a valid session before appending notes."
            : "There are no matching table notes to append.",
      });
      return;
    }

    notifications.show({
      color: "moss",
      title: "Session updated",
      message: `Appended ${result.count} table note${result.count === 1 ? "" : "s"} to ${result.sessionTitle}.`,
    });
  };

  const handleDelete = (entryId) => {
    const removed = actions.deleteCaptureEntry(entryId);
    if (!removed) return;
    notifications.show({
      color: "moss",
      title: "Capture removed",
      message: "The table note was deleted from the capture log.",
    });
  };

  const handleClear = () => {
    const count = actions.clearCaptureEntries();
    if (!count) {
      notifications.show({
        color: "gray",
        title: "Capture log already empty",
        message: "There are no table notes to clear.",
      });
      return;
    }

    notifications.show({
      color: "moss",
      title: "Capture log cleared",
      message: `Removed ${count} captured note${count === 1 ? "" : "s"}.`,
    });
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Campaign"
        title="Table Notes"
        description="Capture fast notes while play is moving, then promote the useful parts into the Adventure Log without rebuilding the session from memory."
        actions={
          <>
            <Button variant="default" onClick={handleAppend}>
              Append To Session
            </Button>
            <Button color="moss" onClick={() => navigate("/campaign/adventure-log")}>
              Open Adventure Log
            </Button>
          </>
        }
      />

      <CompactMetaStrip items={summaryCards} className="km-campaign-desk-strip" />

      <Tabs.Root defaultValue="capture" className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Table Notes views">
          <Tabs.Trigger value="capture" className="km-radix-trigger">
            Capture Desk
          </Tabs.Trigger>
          <Tabs.Trigger value="logbook" className="km-radix-trigger">
            Logbook
          </Tabs.Trigger>
          <Tabs.Trigger value="rules" className="km-radix-trigger">
            Rules Watch
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="capture" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel km-table-capture-card">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Quick Capture</Text>
                      <Title order={3}>Run This Page During Play</Title>
                    </div>
                    <Badge color="moss" variant="light">
                      {targetSession ? targetSession.title : "No session target"}
                    </Badge>
                  </Group>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 7 }}>
                      <Select
                        label="Attach notes to session"
                        value={sessionId}
                        onChange={(value) => setSessionId(value || "")}
                        data={sessionOptions}
                        placeholder="Pick a session"
                        searchable
                        clearable
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 5 }}>
                      <Select
                        label="Default capture type"
                        value={kind}
                        onChange={(value) => setKind(value || "Note")}
                        data={CAPTURE_SELECT_DATA}
                      />
                    </Grid.Col>
                  </Grid>

                  <Textarea
                    autosize
                    minRows={7}
                    label="Quick note"
                    placeholder="Short, table-speed note: revealed rumor, rule call, loot found, scene beat, or fallout."
                    value={note}
                    onChange={(event) => setNote(event.currentTarget.value)}
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={() => handleCapture()}>
                      Capture {kind}
                    </Button>
                    {["NPC", "Hook", "Rule", "Loot", "Retcon"].map((quickKind) => (
                      <Button key={quickKind} variant="default" onClick={() => handleCapture(quickKind)}>
                        {quickKind}
                      </Button>
                    ))}
                  </Group>

                  <Text size="sm" c="dimmed">
                    Use fast fragments here. The session append pass turns them into a timestamped log inside the latest Adventure Log summary.
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel km-table-promote-card">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Session Lift</Text>
                      <Title order={3}>Append Preview</Title>
                    </div>
                    <Button variant="default" onClick={handleAppend}>
                      Promote Notes
                    </Button>
                  </Group>

                  <Text c="dimmed">
                    Notes linked to this session, plus any unlinked table notes, will be written into the session summary under a dedicated capture log.
                  </Text>

                  {previewEntries.length ? (
                    <Stack gap="sm">
                      {previewEntries.map((entry) => (
                        <div key={entry.id} className="km-capture-preview">
                          <Group justify="space-between" align="flex-start">
                            <Badge color={getKindColor(entry.kind)} variant="light">
                              {entry.kind}
                            </Badge>
                            <Text size="sm" c="dimmed">
                              {formatCaptureTimestamp(entry.timestamp)}
                            </Text>
                          </Group>
                          <Text>{entry.note}</Text>
                        </div>
                      ))}
                    </Stack>
                  ) : (
                    <Text c="dimmed">No captured notes are queued for this session yet.</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="logbook" className="km-radix-content">
          <Paper className="km-panel km-content-panel">
            <Grid gutter="md" align="end">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Search captured notes"
                  placeholder="Search by type, note text, or linked session"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  label="Filter by type"
                  value={kindFilter}
                  onChange={(value) => setKindFilter(value || "all")}
                  data={[
                    { value: "all", label: "All capture types" },
                    ...CAPTURE_SELECT_DATA.map((option) => ({
                      value: option.value.toLowerCase(),
                      label: option.label,
                    })),
                  ]}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 2 }}>
                <Button color="ember" variant="light" fullWidth onClick={handleClear}>
                  Clear Log
                </Button>
              </Grid.Col>
            </Grid>
          </Paper>

          <Stack gap="lg" mt="lg">
            {filteredEntries.length ? (
              filteredEntries.map((entry) => {
                const linkedSession = model.sessionMap.get(entry.sessionId);
                return (
                  <Paper key={entry.id} className="km-panel km-content-panel km-capture-entry">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs" wrap="wrap">
                          <Badge color={getKindColor(entry.kind)} variant="light">
                            {entry.kind}
                          </Badge>
                          <Badge variant="outline">{formatCaptureTimestamp(entry.timestamp)}</Badge>
                          <Badge variant="outline">{linkedSession?.title || "No session link"}</Badge>
                        </Group>
                        <ActionIcon variant="subtle" color="ember" onClick={() => handleDelete(entry.id)} aria-label="Delete capture entry">
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                      <Text className="km-capture-entry__note">{entry.note}</Text>
                    </Stack>
                  </Paper>
                );
              })
            ) : (
              <Paper className="km-panel km-content-panel">
                <Text c="dimmed">No captured notes match the current filter.</Text>
              </Paper>
            )}
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="rules" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Text className="km-section-kicker">Why This Matters</Text>
                  <Title order={3}>Rulings And Retcons Need A Home</Title>
                  <Text>
                    Rule calls and retcons are the fastest notes to get lost between sessions. Keeping them here makes it easier to move the durable ones into your
                    longer-form rulings digest later.
                  </Text>
                  <Text size="sm" c="dimmed">
                    Use `Rule` for table rulings and `Retcon` for changes that alter what the campaign now considers true.
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Stack gap="lg">
                {model.rulingEntries.length ? (
                  model.rulingEntries.map((entry) => {
                    const linkedSession = model.sessionMap.get(entry.sessionId);
                    return (
                      <Paper key={entry.id} className="km-panel km-content-panel km-capture-entry">
                        <Stack gap="sm">
                          <Group justify="space-between" align="flex-start">
                            <Group gap="xs" wrap="wrap">
                              <Badge color="ember" variant="light">
                                {entry.kind}
                              </Badge>
                              <Badge variant="outline">{formatCaptureTimestamp(entry.timestamp)}</Badge>
                              <Badge variant="outline">{linkedSession?.title || "No session link"}</Badge>
                            </Group>
                            <ActionIcon variant="subtle" color="ember" onClick={() => handleDelete(entry.id)} aria-label="Delete ruling entry">
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Group>
                          <Text className="km-capture-entry__note">{entry.note}</Text>
                        </Stack>
                      </Paper>
                    );
                  })
                ) : (
                  <Paper className="km-panel km-content-panel">
                    <Text c="dimmed">No rule or retcon entries are captured yet.</Text>
                  </Paper>
                )}
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
