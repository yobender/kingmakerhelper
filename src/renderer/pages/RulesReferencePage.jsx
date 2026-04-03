import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Grid, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconBook2, IconExternalLink, IconRefresh, IconScale, IconSearch, IconSparkles, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { RULE_STORE_KIND_LABELS, RULE_STORE_KIND_OPTIONS } from "../lib/campaignState";
import {
  buildRulesLocalMatches,
  buildRulesModel,
  buildRulesPromptFromResult,
  deriveRulesMemoryState,
  formatRuleKindLabel,
  formatRulesTimestamp,
} from "../lib/rules";

const NEW_RULE_ENTRY_ID = "__new__";
const SEARCH_LIMIT_OPTIONS = [3, 5, 6].map((value) => ({ value: String(value), label: `${value}` }));
const RULE_KIND_SELECT_DATA = RULE_STORE_KIND_OPTIONS.map((value) => ({
  value,
  label: RULE_STORE_KIND_LABELS[value],
}));
const RULE_KIND_OPTIONS_WITH_ALL = [{ value: "all", label: "All entry types" }, ...RULE_KIND_SELECT_DATA];

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function clipText(value, limit = 220) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function formatIndexedAt(value) {
  const stamp = Date.parse(String(value || ""));
  if (!Number.isFinite(stamp)) return "No cached AoN index yet";
  return `AoN cache ${new Date(stamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function createRuleDraft(entry) {
  return {
    id: stringValue(entry?.id),
    title: stringValue(entry?.title),
    kind: stringValue(entry?.kind) || "accepted_ruling",
    text: stringValue(entry?.text),
    sourceTitle: stringValue(entry?.sourceTitle),
    sourceUrl: stringValue(entry?.sourceUrl),
    tags: Array.isArray(entry?.tags) ? entry.tags.join(", ") : stringValue(entry?.tags),
  };
}

function normalizeRuleDraft(draft) {
  return {
    ...draft,
    title: stringValue(draft?.title),
    kind: stringValue(draft?.kind) || "accepted_ruling",
    text: stringValue(draft?.text),
    sourceTitle: stringValue(draft?.sourceTitle),
    sourceUrl: stringValue(draft?.sourceUrl),
    tags: stringValue(draft?.tags)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

function buildStoreFilterOptions() {
  return RULE_KIND_OPTIONS_WITH_ALL;
}

async function openExternalLink(desktopApi, url) {
  const target = stringValue(url);
  if (!target) return;
  if (desktopApi?.openExternal) {
    await desktopApi.openExternal(target);
    return;
  }
  window.open(target, "_blank", "noopener,noreferrer");
}

async function copyText(text) {
  if (!navigator?.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this runtime.");
  }
  await navigator.clipboard.writeText(text);
}

function OfficialRuleListItem({ entry, active, onSelect, onOpen }) {
  return (
    <Paper className={`km-rules-result-item${active ? " is-active" : ""}`}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div className="km-rules-result-item__copy">
            <Text fw={700}>{stringValue(entry?.title) || "Official rule"}</Text>
            <Text size="sm" c="dimmed">{`${stringValue(entry?.source) || "Archives of Nethys"} / score ${stringValue(entry?.score || 0)}`}</Text>
          </div>
          <Badge color="brass" variant="light">
            AoN
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {clipText(entry?.snippet, 220) || "No excerpt available."}
        </Text>
        <Text size="xs" c="dimmed" className="km-rules-result-item__path">
          {stringValue(entry?.path || entry?.url)}
        </Text>
        <Group gap="sm">
          <Button size="xs" color="moss" variant={active ? "filled" : "light"} onClick={onSelect}>
            {active ? "Selected" : "Select"}
          </Button>
          <Button size="xs" variant="default" leftSection={<IconExternalLink size={14} />} onClick={onOpen}>
            Open
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function MemoryMatchCard({ title, body, badge }) {
  return (
    <Paper className="km-record-card km-rules-memory-card">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text fw={700}>{title}</Text>
          {badge ? (
            <Badge color="moss" variant="light">
              {badge}
            </Badge>
          ) : null}
        </Group>
        <Text size="sm" c="dimmed">
          {body}
        </Text>
      </Stack>
    </Paper>
  );
}

function StoreEntryCard({ entry, active, onEdit, onDelete, onOpenSource }) {
  return (
    <Paper className={`km-rules-store-card${active ? " is-active" : ""}`}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div className="km-rules-store-card__copy">
            <Text fw={700}>{stringValue(entry?.title) || "Saved entry"}</Text>
            <Text size="sm" c="dimmed">{`${formatRuleKindLabel(entry?.kind)}${entry?.updatedAt ? ` / ${formatRulesTimestamp(entry.updatedAt)}` : ""}`}</Text>
          </div>
          <Badge color={stringValue(entry?.kind) === "canon_memory" ? "brass" : "moss"} variant="light">
            {formatRuleKindLabel(entry?.kind)}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {clipText(entry?.text, 260)}
        </Text>
        {Array.isArray(entry?.tags) && entry.tags.length ? (
          <Group gap={8}>
            {entry.tags.slice(0, 6).map((tag) => (
              <Badge key={tag} color="gray" variant="light">
                {tag}
              </Badge>
            ))}
          </Group>
        ) : null}
        <Group gap="sm" className="km-toolbar-wrap">
          <Button size="xs" color="moss" variant={active ? "filled" : "light"} onClick={onEdit}>
            {active ? "Editing" : "Edit"}
          </Button>
          <Button size="xs" variant="default" leftSection={<IconExternalLink size={14} />} onClick={onOpenSource} disabled={!stringValue(entry?.sourceUrl)}>
            Open Source
          </Button>
          <Button size="xs" color="red" variant="subtle" leftSection={<IconTrash size={14} />} onClick={onDelete}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default function RulesReferencePage() {
  const navigate = useNavigate();
  const { campaign, actions, desktopApi } = useCampaign();
  const [activeTab, setActiveTab] = useState("lookup");
  const [query, setQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState("5");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [indexedAt, setIndexedAt] = useState("");
  const [officialResults, setOfficialResults] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [manualRulingsDraft, setManualRulingsDraft] = useState(() => stringValue(campaign.meta?.aiMemory?.manualRulings));
  const [editingEntryId, setEditingEntryId] = useState(NEW_RULE_ENTRY_ID);
  const [ruleDraft, setRuleDraft] = useState(() => createRuleDraft(null));
  const [storeFilter, setStoreFilter] = useState("all");
  const [storeQuery, setStoreQuery] = useState("");

  const model = useMemo(
    () => buildRulesModel(campaign, { query, results: officialResults, indexedAt }),
    [campaign, indexedAt, officialResults, query]
  );
  const localMatches = useMemo(() => buildRulesLocalMatches(campaign, query), [campaign, query]);
  const derivedMemory = useMemo(() => deriveRulesMemoryState(campaign), [campaign]);
  const selectedOfficial = officialResults.find((entry) => stringValue(entry?.url) === selectedUrl) || officialResults[0] || null;
  const editingEntry = model.rulesStore.find((entry) => entry.id === editingEntryId) || null;

  useEffect(() => {
    setManualRulingsDraft(stringValue(campaign.meta?.aiMemory?.manualRulings));
  }, [campaign.meta?.aiMemory?.manualRulings]);

  useEffect(() => {
    if (editingEntryId === NEW_RULE_ENTRY_ID) return;
    if (!editingEntry) {
      setEditingEntryId(NEW_RULE_ENTRY_ID);
      setRuleDraft(createRuleDraft(null));
      return;
    }
    setRuleDraft(createRuleDraft(editingEntry));
  }, [editingEntry, editingEntryId]);

  const storeEntries = useMemo(() => {
    const normalizedQuery = stringValue(storeQuery).toLowerCase();
    return model.rulesStore.filter((entry) => {
      if (storeFilter !== "all" && stringValue(entry?.kind) !== storeFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [entry?.title, entry?.text, entry?.sourceTitle, ...(entry?.tags || [])]
        .map((value) => stringValue(value).toLowerCase())
        .join(" ");
      return haystack.includes(normalizedQuery);
    });
  }, [model.rulesStore, storeFilter, storeQuery]);

  const manualDraftDirty = stringValue(manualRulingsDraft) !== stringValue(campaign.meta?.aiMemory?.manualRulings);
  const desktopSearchReady = Boolean(desktopApi?.searchAonRules);

  const runRulesSearch = async (force = false) => {
    const cleanQuery = stringValue(query);
    const cleanLimit = Math.max(1, Math.min(Number.parseInt(String(searchLimit), 10) || 5, 6));
    setSearchLimit(String(cleanLimit));

    if (!cleanQuery) {
      notifications.show({
        color: "ember",
        title: "Search query required",
        message: "Enter a PF2e rule term before searching Archives of Nethys.",
      });
      return;
    }

    if (!desktopSearchReady) {
      setOfficialResults([]);
      setSelectedUrl("");
      setSearchMessage("Official AoN lookup is only available in the desktop runtime.");
      return;
    }

    setSearchBusy(true);
    setSearchMessage(force ? `Refreshing official PF2e rules for "${cleanQuery}"...` : `Searching official PF2e rules for "${cleanQuery}"...`);
    try {
      const result = await desktopApi.searchAonRules({
        query: cleanQuery,
        limit: cleanLimit,
        force,
      });
      const matches = Array.isArray(result?.results) ? result.results : [];
      setOfficialResults(matches);
      setSelectedUrl(stringValue(matches[0]?.url));
      setIndexedAt(stringValue(result?.indexedAt));
      setSearchMessage(
        matches.length
          ? `Loaded ${matches.length} official PF2e rule match${matches.length === 1 ? "" : "es"} for "${cleanQuery}".`
          : `No official PF2e rule matches found for "${cleanQuery}".`
      );
    } catch (error) {
      setOfficialResults([]);
      setSelectedUrl("");
      setSearchMessage(`Official rules lookup failed: ${stringValue(error?.message || error) || "Unknown error"}`);
    } finally {
      setSearchBusy(false);
    }
  };

  const handleOpenOfficial = async (result) => {
    const target = stringValue(result?.url);
    if (!target) return;
    try {
      await openExternalLink(desktopApi, target);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Open failed",
        message: stringValue(error?.message || error) || "Could not open the official rule page.",
      });
    }
  };

  const handleSaveOfficialNote = () => {
    if (!selectedOfficial) {
      notifications.show({
        color: "ember",
        title: "No official rule selected",
        message: "Select an AoN result before saving it into the local rules store.",
      });
      return;
    }
    const saved = actions.upsertRulesStoreEntry({
      title: stringValue(selectedOfficial.title) || stringValue(query) || "Official PF2e Rule",
      kind: "official_note",
      text: stringValue(selectedOfficial.snippet),
      sourceTitle: stringValue(selectedOfficial.title),
      sourceUrl: stringValue(selectedOfficial.url),
      sourceOrigin: "official",
      tags: stringValue(query)
        .split(/\s+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    });
    if (!saved) return;
    setActiveTab("store");
    setEditingEntryId(saved.id);
    notifications.show({
      color: "moss",
      title: "Official note saved",
      message: `${saved.title} is now part of the campaign's rules library.`,
    });
  };

  const handleCopyPrompt = async (mode) => {
    if (!selectedOfficial) {
      notifications.show({
        color: "ember",
        title: "No official rule selected",
        message: "Select an official rule before copying a prompt.",
      });
      return;
    }
    try {
      await copyText(buildRulesPromptFromResult(selectedOfficial, mode));
      notifications.show({
        color: "moss",
        title: "Prompt copied",
        message: mode === "compare" ? "Official-vs-local prompt copied to the clipboard." : "Rules answer prompt copied to the clipboard.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Copy failed",
        message: stringValue(error?.message || error) || "Clipboard access failed.",
      });
    }
  };

  const handleSaveManualRulings = () => {
    actions.saveRulesMemory({
      manualRulings: manualRulingsDraft,
    });
    notifications.show({
      color: "moss",
      title: "Rulings digest saved",
      message: stringValue(manualRulingsDraft)
        ? "Manual local rulings now anchor the Rules Reference tab."
        : "Manual local rulings were cleared. The effective digest now derives from saved entries and table calls.",
    });
  };

  const handleEditEntry = (entry) => {
    setActiveTab("store");
    setEditingEntryId(stringValue(entry?.id) || NEW_RULE_ENTRY_ID);
    setRuleDraft(createRuleDraft(entry));
  };

  const handleNewEntry = (kind = "accepted_ruling") => {
    setActiveTab("store");
    setEditingEntryId(NEW_RULE_ENTRY_ID);
    setRuleDraft(createRuleDraft({ kind }));
  };

  const handleSaveRuleEntry = () => {
    const normalized = normalizeRuleDraft(ruleDraft);
    if (!normalized.title || !normalized.text) {
      notifications.show({
        color: "ember",
        title: "Entry incomplete",
        message: "Add both a title and text before saving the rule entry.",
      });
      return;
    }
    const saved = actions.upsertRulesStoreEntry(normalized, editingEntryId === NEW_RULE_ENTRY_ID ? undefined : editingEntryId);
    if (!saved) return;
    setEditingEntryId(saved.id);
    notifications.show({
      color: "moss",
      title: editingEntryId === NEW_RULE_ENTRY_ID ? "Rule entry added" : "Rule entry updated",
      message: `${saved.title} is now available in the campaign rules store.`,
    });
  };

  const handleDeleteRuleEntry = (entry) => {
    const title = stringValue(entry?.title) || "this rule entry";
    if (!window.confirm(`Delete ${title}?`)) return;
    const removed = actions.removeRulesStoreEntry(entry?.id);
    if (!removed) return;
    if (stringValue(entry?.id) === editingEntryId) {
      setEditingEntryId(NEW_RULE_ENTRY_ID);
      setRuleDraft(createRuleDraft(null));
    }
    notifications.show({
      color: "moss",
      title: "Rule entry removed",
      message: `${title} was removed from the local rules store.`,
    });
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Reference"
        title="Rules Reference"
        description="Keep PF2e rulings table-ready: search the official rule, compare it to your local Kingmaker adjudication, and save only the canon and overrides you actually want this campaign to remember."
        actions={(
          <>
            <Button variant="default" leftSection={<IconBook2 size={16} />} onClick={() => navigate("/campaign/table-notes")}>
              Open Table Notes
            </Button>
            <Button color="moss" leftSection={<IconSparkles size={16} />} onClick={() => navigate("/campaign/scene-forge")}>
              Open Scene Forge
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
        <Tabs.List className="km-radix-list" aria-label="Rules Reference views">
          <Tabs.Trigger value="lookup" className="km-radix-trigger">
            Official Lookup
          </Tabs.Trigger>
          <Tabs.Trigger value="memory" className="km-radix-trigger">
            Local Memory
          </Tabs.Trigger>
          <Tabs.Trigger value="store" className="km-radix-trigger">
            Rules Store
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="lookup" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 12 }}>
              <Paper className="km-panel km-content-panel km-rules-search-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Official Search</Text>
                      <Title order={3}>Archives of Nethys Lookup</Title>
                    </div>
                    <Badge color={desktopSearchReady ? "moss" : "gray"} variant="light">
                      {desktopSearchReady ? "Desktop bridge ready" : "Desktop lookup unavailable"}
                    </Badge>
                  </Group>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runRulesSearch(false);
                    }}
                  >
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, md: 8 }}>
                        <TextInput
                          label="Search query"
                          placeholder="bleed, concealed, persistent damage, aid, command an animal"
                          value={query}
                          onChange={(event) => setQuery(event.currentTarget.value)}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Select
                          label="Result limit"
                          value={searchLimit}
                          onChange={(value) => setSearchLimit(value || "5")}
                          data={SEARCH_LIMIT_OPTIONS}
                        />
                      </Grid.Col>
                    </Grid>

                    <Group gap="sm" mt="md" className="km-toolbar-wrap">
                      <Button type="submit" color="moss" leftSection={<IconSearch size={16} />} loading={searchBusy} disabled={!desktopSearchReady}>
                        Search Official Rules
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        leftSection={<IconRefresh size={16} />}
                        onClick={() => void runRulesSearch(true)}
                        disabled={!desktopSearchReady || !stringValue(query) || searchBusy}
                      >
                        Force Refresh
                      </Button>
                    </Group>
                  </form>

                  <Text c="dimmed">
                    Search exact PF2e rules terms first. Use this page to resolve the official rule, then compare it against the rulings and canon you have already accepted for this campaign.
                  </Text>

                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text fw={700}>Lookup status</Text>
                      <Text size="sm" c="dimmed">
                        {searchMessage || "No AoN search has been run yet."}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {formatIndexedAt(indexedAt)}
                      </Text>
                    </Stack>
                  </Paper>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Official Matches</Text>
                      <Title order={3}>Search Results</Title>
                    </div>
                    <Badge color="brass" variant="light">
                      {officialResults.length}
                    </Badge>
                  </Group>

                  <div className="km-rules-results-list">
                    {officialResults.length ? (
                      officialResults.map((entry) => (
                        <OfficialRuleListItem
                          key={stringValue(entry?.url) || stringValue(entry?.title)}
                          entry={entry}
                          active={stringValue(entry?.url) === stringValue(selectedOfficial?.url)}
                          onSelect={() => setSelectedUrl(stringValue(entry?.url))}
                          onOpen={() => void handleOpenOfficial(entry)}
                        />
                      ))
                    ) : (
                      <Paper className="km-record-card">
                        <Text c="dimmed">
                          Search for a PF2e condition, action, subsystem, kingdom step, or rules term to load official matches here.
                        </Text>
                      </Paper>
                    )}
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Stack gap="lg">
                <Paper className="km-panel km-content-panel km-rules-selected-card">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Selected Official Rule</Text>
                        <Title order={3}>{selectedOfficial ? stringValue(selectedOfficial.title) : "No official rule selected"}</Title>
                      </div>
                      {selectedOfficial ? (
                        <Badge color="brass" variant="light">
                          Official
                        </Badge>
                      ) : null}
                    </Group>

                    {selectedOfficial ? (
                      <>
                        <Text size="sm" c="dimmed">
                          {stringValue(selectedOfficial.path || selectedOfficial.url)}
                        </Text>
                        <Text>{stringValue(selectedOfficial.snippet) || "No excerpt available."}</Text>
                        <Group gap="sm" className="km-toolbar-wrap">
                          <Button variant="default" leftSection={<IconExternalLink size={16} />} onClick={() => void handleOpenOfficial(selectedOfficial)}>
                            Open AoN
                          </Button>
                          <Button color="moss" leftSection={<IconBook2 size={16} />} onClick={handleSaveOfficialNote}>
                            Save Official Note
                          </Button>
                          <Button variant="default" leftSection={<IconScale size={16} />} onClick={() => void handleCopyPrompt("explain")}>
                            Copy Rules Prompt
                          </Button>
                          <Button variant="default" leftSection={<IconSparkles size={16} />} onClick={() => void handleCopyPrompt("compare")}>
                            Copy Compare Prompt
                          </Button>
                        </Group>
                      </>
                    ) : (
                      <Text c="dimmed">
                        Select an official AoN result to compare it against your local rulings and save it into the store.
                      </Text>
                    )}
                  </Stack>
                </Paper>

                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Official Vs Local</Text>
                        <Title order={3}>Local Matches For This Query</Title>
                      </div>
                      <Badge color="moss" variant="light">
                        {localMatches.savedMatches.length + localMatches.captureMatches.length + localMatches.digestMatches.length + localMatches.canonMatches.length}
                      </Badge>
                    </Group>

                    <Grid gutter="md">
                      {localMatches.digestMatches.map((match) => (
                        <Grid.Col key={match.key} span={{ base: 12, md: 6 }}>
                          <MemoryMatchCard title={match.title} body={match.text} badge="Digest" />
                        </Grid.Col>
                      ))}
                      {localMatches.canonMatches.slice(0, 2).map((entry) => (
                        <Grid.Col key={entry.id} span={{ base: 12, md: 6 }}>
                          <MemoryMatchCard title={entry.title} body={entry.excerpt || entry.text} badge="Canon" />
                        </Grid.Col>
                      ))}
                      {localMatches.captureMatches.slice(0, 2).map((entry) => (
                        <Grid.Col key={entry.id} span={{ base: 12, md: 6 }}>
                          <MemoryMatchCard title={entry.title} body={entry.excerpt || entry.text} badge={formatRulesTimestamp(entry.timestamp) || "Table"} />
                        </Grid.Col>
                      ))}
                      {localMatches.savedMatches.slice(0, 4).map((entry) => (
                        <Grid.Col key={entry.id} span={{ base: 12, md: 6 }}>
                          <MemoryMatchCard title={entry.title} body={entry.excerpt || entry.text} badge={formatRuleKindLabel(entry.kind)} />
                        </Grid.Col>
                      ))}
                    </Grid>

                    {!localMatches.digestMatches.length && !localMatches.canonMatches.length && !localMatches.captureMatches.length && !localMatches.savedMatches.length ? (
                      <Paper className="km-record-card">
                        <Text c="dimmed">
                          No local rulings, canon notes, or recent rule captures match the current query yet.
                        </Text>
                      </Paper>
                    ) : null}
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="memory" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Manual Rulings</Text>
                      <Title order={3}>House Rules Digest</Title>
                    </div>
                    <Badge color={manualDraftDirty ? "ember" : "moss"} variant="light">
                      {manualDraftDirty ? "Unsaved" : "Saved"}
                    </Badge>
                  </Group>

                  <Textarea
                    label="Manual rulings digest"
                    autosize
                    minRows={12}
                    placeholder="Example: Hero Point rerolls must be declared before new information is revealed. Use remaster terminology. Kingdom event clocks advance at month close."
                    value={manualRulingsDraft}
                    onChange={(event) => setManualRulingsDraft(event.currentTarget.value)}
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={handleSaveManualRulings}>
                      Save Rulings Digest
                    </Button>
                    <Button variant="default" onClick={() => setManualRulingsDraft(stringValue(campaign.meta?.aiMemory?.manualRulings))}>
                      Reset
                    </Button>
                  </Group>

                  <Text c="dimmed">
                    This is the fastest place to lock your standing adjudications. If you leave it blank, the app falls back to saved rules entries plus recent Rule and Retcon captures from Table Notes.
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Stack gap="lg">
                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <div>
                      <Text className="km-section-kicker">Effective Local Context</Text>
                      <Title order={3}>What Companion AI Should Remember</Title>
                    </div>
                    <Paper className="km-record-card">
                      <Stack gap="xs">
                        <Text fw={700}>Rulings Digest</Text>
                        <Text size="sm" c="dimmed">
                          {derivedMemory.rulingsDigest || "No effective local rulings digest exists yet."}
                        </Text>
                      </Stack>
                    </Paper>
                    <Paper className="km-record-card">
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start">
                          <Text fw={700}>Canon Summary</Text>
                          <Button size="xs" variant="default" onClick={() => handleNewEntry("canon_memory")}>
                            New Canon Entry
                          </Button>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {derivedMemory.canonSummary || "No canon memory has been saved into the rules store yet."}
                        </Text>
                      </Stack>
                    </Paper>
                  </Stack>
                </Paper>

                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Table Feed</Text>
                        <Title order={3}>Recent Rule And Retcon Calls</Title>
                      </div>
                      <Button variant="default" leftSection={<IconBook2 size={16} />} onClick={() => navigate("/campaign/table-notes")}>
                        Open Rules Watch
                      </Button>
                    </Group>

                    {derivedMemory.recentRuleCaptures.length ? (
                      <div className="km-rules-memory-list">
                        {derivedMemory.recentRuleCaptures.map((entry) => (
                          <MemoryMatchCard
                            key={entry.id}
                            title={entry.title}
                            body={`${formatRulesTimestamp(entry.timestamp) || "No timestamp"} / ${clipText(entry.text, 220)}`}
                            badge="Capture"
                          />
                        ))}
                      </div>
                    ) : (
                      <Paper className="km-record-card">
                        <Text c="dimmed">
                          No Rule or Retcon capture entries are waiting in Table Notes yet.
                        </Text>
                      </Paper>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="store" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Persistent Store</Text>
                      <Title order={3}>{editingEntryId === NEW_RULE_ENTRY_ID ? "New Rule Entry" : "Edit Rule Entry"}</Title>
                    </div>
                    <Badge color="moss" variant="light">
                      {editingEntryId === NEW_RULE_ENTRY_ID ? "New" : "Editing"}
                    </Badge>
                  </Group>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 7 }}>
                      <TextInput
                        label="Title"
                        placeholder="Aid clarification, hero point policy, campaign canon fact"
                        value={ruleDraft.title}
                        onChange={(event) => setRuleDraft((current) => ({ ...current, title: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 5 }}>
                      <Select
                        label="Entry type"
                        value={ruleDraft.kind}
                        onChange={(value) => setRuleDraft((current) => ({ ...current, kind: value || "accepted_ruling" }))}
                        data={RULE_KIND_SELECT_DATA}
                      />
                    </Grid.Col>
                  </Grid>

                  <Textarea
                    label="Text"
                    autosize
                    minRows={10}
                    placeholder="Save the ruling, canon fact, or official note you want the campaign to retain."
                    value={ruleDraft.text}
                    onChange={(event) => setRuleDraft((current) => ({ ...current, text: event.currentTarget.value }))}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Source title"
                        placeholder="Persistent Damage, Kingdom Quick Reference, Jamandi Charter"
                        value={ruleDraft.sourceTitle}
                        onChange={(event) => setRuleDraft((current) => ({ ...current, sourceTitle: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Source URL"
                        placeholder="https://2e.aonprd.com/..."
                        value={ruleDraft.sourceUrl}
                        onChange={(event) => setRuleDraft((current) => ({ ...current, sourceUrl: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                  </Grid>

                  <TextInput
                    label="Tags"
                    placeholder="persistent damage, remaster, kingdom turn"
                    value={ruleDraft.tags}
                    onChange={(event) => setRuleDraft((current) => ({ ...current, tags: event.currentTarget.value }))}
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={handleSaveRuleEntry}>
                      {editingEntryId === NEW_RULE_ENTRY_ID ? "Save Entry" : "Update Entry"}
                    </Button>
                    <Button variant="default" onClick={() => handleNewEntry(ruleDraft.kind || "accepted_ruling")}>
                      New Blank Entry
                    </Button>
                    {editingEntry ? (
                      <Button color="red" variant="subtle" leftSection={<IconTrash size={16} />} onClick={() => handleDeleteRuleEntry(editingEntry)}>
                        Delete
                      </Button>
                    ) : null}
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Library</Text>
                      <Title order={3}>Saved Rules And Canon</Title>
                    </div>
                    <Badge color="moss" variant="light">
                      {storeEntries.length}
                    </Badge>
                  </Group>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 5 }}>
                      <Select
                        label="Filter"
                        value={storeFilter}
                        onChange={(value) => setStoreFilter(value || "all")}
                        data={buildStoreFilterOptions(model.rulesStore)}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 7 }}>
                      <TextInput
                        label="Search store"
                        placeholder="Search title, text, source, or tags"
                        value={storeQuery}
                        onChange={(event) => setStoreQuery(event.currentTarget.value)}
                      />
                    </Grid.Col>
                  </Grid>

                  <div className="km-rules-store-list">
                    {storeEntries.length ? (
                      storeEntries.map((entry) => (
                        <StoreEntryCard
                          key={entry.id}
                          entry={entry}
                          active={stringValue(entry.id) === editingEntryId}
                          onEdit={() => handleEditEntry(entry)}
                          onDelete={() => handleDeleteRuleEntry(entry)}
                          onOpenSource={() => void openExternalLink(desktopApi, entry.sourceUrl)}
                        />
                      ))
                    ) : (
                      <Paper className="km-record-card">
                        <Text c="dimmed">
                          No saved rule entries match the current filter.
                        </Text>
                      </Paper>
                    )}
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
