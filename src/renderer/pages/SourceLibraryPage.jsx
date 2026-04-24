import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Grid, Group, Paper, Progress, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { IconBook2, IconBooks, IconRefresh, IconSearch } from "@tabler/icons-react";
import CompactMetaStrip from "../components/CompactMetaStrip";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { buildSourceLibraryModel } from "../lib/sourceLibrary";

const SEARCH_LIMIT_OPTIONS = ["10", "20", "40"].map((value) => ({
  value,
  label: value,
}));

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function intValue(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clipText(value, limit = 220) {
  const clean = stringValue(value).replace(/\s+/g, " ");
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function formatDateTime(value) {
  const stamp = Date.parse(String(value || ""));
  if (!Number.isFinite(stamp)) return "Never";
  return new Date(stamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRetrievalStatus(status) {
  if (!status) return "RAG status has not been loaded yet.";
  const indexed = intValue(status.indexedFiles, 0);
  const chunks = intValue(status.retrievalChunks, 0);
  const embedded = intValue(status.embeddedChunks, 0);
  const coverage = intValue(status.semanticCoverage, chunks ? Math.round((embedded / chunks) * 100) : 0);
  return `${indexed} PDFs / ${chunks} chunks / ${embedded} embedded (${coverage}%) / ${stringValue(status.retrievalMode || "hybrid")} retrieval`;
}

function formatCompactNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString();
}

function RagFileCoverage({ status }) {
  const files = Array.isArray(status?.files) ? status.files : [];
  if (!files.length) return null;
  return (
    <div className="km-rag-file-coverage">
      {files.slice(0, 8).map((file) => {
        const chunks = intValue(file?.retrievalChunks, 0);
        const embedded = intValue(file?.embeddedChunks, 0);
        const coverage = chunks ? Math.round((embedded / chunks) * 100) : 0;
        return (
          <div key={`${stringValue(file?.path)}-${stringValue(file?.fileName)}`} className="km-rag-file-row">
            <div>
              <Text fw={700} size="sm">
                {stringValue(file?.fileName) || "Indexed PDF"}
              </Text>
              <Text size="xs" c="dimmed">
                {`${formatCompactNumber(file?.pageCount)} pages / ${formatCompactNumber(file?.charCount)} chars / ${formatCompactNumber(chunks)} chunks`}
              </Text>
            </div>
            <Badge color={coverage >= 95 ? "moss" : coverage ? "brass" : "gray"} variant="light">
              {`${formatCompactNumber(embedded)} embedded`}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

function buildPdfSummaryMapFromIndex(summary, existingSummaries = {}) {
  const files = Array.isArray(summary?.files) ? summary.files : [];
  const next = { ...(existingSummaries || {}) };
  for (const file of files) {
    const fileName = stringValue(file?.fileName);
    if (!fileName) continue;
    const summaryText = stringValue(file?.summary);
    if (!summaryText) continue;
    next[fileName] = {
      fileName,
      path: stringValue(file?.path),
      summary: summaryText,
      updatedAt: stringValue(file?.summaryUpdatedAt),
    };
  }
  return next;
}

function matchSourceByFileName(sources, fileName) {
  const normalized = stringValue(fileName).toLowerCase();
  return (
    (sources || []).find((source) => {
      if (stringValue(source?.fileName).toLowerCase() === normalized) return true;
      return Array.isArray(source?.aliases) && source.aliases.some((alias) => stringValue(alias).toLowerCase() === normalized);
    }) || null
  );
}

function SearchResultCard({ result, onOpenPage, onFocusFile }) {
  return (
    <Paper className="km-source-result-card">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div className="km-source-result-card__copy">
            <Text fw={700}>{stringValue(result?.fileName) || "Indexed PDF"}</Text>
            <Text size="sm" c="dimmed">
              {`Page ${intValue(result?.page, 1)} / ${stringValue(result?.searchMode || "lexical")} / ${
                result?.reranked ? "reranked" : "ranked"
              } / score ${stringValue(result?.score || 0)}`}
            </Text>
          </div>
          <Badge color="moss" variant="light">
            Match
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {stringValue(result?.snippet) || "No snippet available."}
        </Text>
        <Group gap="sm" className="km-toolbar-wrap">
          <Button size="xs" color="moss" onClick={onOpenPage}>
            Open Page
          </Button>
          <Button size="xs" variant="default" leftSection={<IconBook2 size={14} />} onClick={onFocusFile}>
            Focus File
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function SourceCard({ source, active, onSelect }) {
  return (
    <button type="button" className={`km-source-card${active ? " is-active" : ""}`} onClick={onSelect}>
      <span className="km-source-card__head">
        <span className="km-source-card__title">{stringValue(source?.displayTitle) || "Source"}</span>
        <span className="km-source-card__meta">{source?.indexed ? "Indexed" : "Not indexed"}</span>
      </span>
      <span className="km-source-card__chips">
        <span className="km-companion-chip">{stringValue(source?.audienceLabel) || "Unknown"}</span>
        <span className="km-companion-chip">{stringValue(source?.roleLabel) || "Unknown"}</span>
        {source?.pages ? <span className="km-companion-chip">{`${source.pages} pages`}</span> : null}
      </span>
      <span className="km-source-card__summary">{stringValue(source?.description) || "No source description loaded yet."}</span>
    </button>
  );
}

export default function SourceLibraryPage() {
  const { campaign, actions, desktopApi } = useCampaign();
  const model = useMemo(() => buildSourceLibraryModel(campaign), [campaign]);
  const [activeTab, setActiveTab] = useState("search");
  const [folderDraft, setFolderDraft] = useState(() => stringValue(campaign.meta?.pdfFolder));
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState("20");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchRetrieval, setSearchRetrieval] = useState(null);
  const [ragStatus, setRagStatus] = useState(null);
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [semanticMessage, setSemanticMessage] = useState("");
  const [semanticProgress, setSemanticProgress] = useState({ current: 0, total: 1, label: "" });
  const [selectedSourceId, setSelectedSourceId] = useState(() => model.sources[0]?.id || "");
  const [selectedSummaryFile, setSelectedSummaryFile] = useState(() => stringValue(campaign.meta?.pdfIndexedFiles?.[0]));
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryMessage, setSummaryMessage] = useState("");
  const [summaryProgress, setSummaryProgress] = useState({ current: 0, total: 1, label: "" });

  const indexedFiles = Array.isArray(campaign.meta?.pdfIndexedFiles) ? campaign.meta.pdfIndexedFiles.map((entry) => stringValue(entry)).filter(Boolean) : [];
  const summaryOptions = indexedFiles.map((fileName) => ({ value: fileName, label: fileName }));
  const selectedSource = model.sources.find((entry) => entry.id === selectedSourceId) || model.sources[0] || null;
  const selectedSummarySource = matchSourceByFileName(model.sources, selectedSummaryFile);
  const selectedSummaryEntry = campaign.meta?.pdfSummaries?.[selectedSummaryFile] || null;
  const searchReady = Boolean(desktopApi?.searchPdf);
  const summaryReady = Boolean(desktopApi?.summarizePdfFile);

  const syncLibraryMeta = (summary, folderOverride) => {
    const fallbackFolder = stringValue(folderOverride) || stringValue(summary?.folderPath) || stringValue(campaign.meta?.pdfFolder);
    actions.updateCampaign((current) => ({
      ...current,
      meta: {
        ...current.meta,
        pdfFolder: fallbackFolder,
        pdfIndexedAt: stringValue(summary?.indexedAt) || current.meta?.pdfIndexedAt || "",
        pdfIndexedCount: intValue(summary?.count, Array.isArray(summary?.fileNames) ? summary.fileNames.length : current.meta?.pdfIndexedCount || 0),
        pdfIndexedFiles: Array.isArray(summary?.fileNames) ? summary.fileNames : current.meta?.pdfIndexedFiles || [],
        pdfSummaries: buildPdfSummaryMapFromIndex(summary, current.meta?.pdfSummaries),
      },
    }));
  };

  useEffect(() => {
    setFolderDraft(stringValue(campaign.meta?.pdfFolder));
  }, [campaign.meta?.pdfFolder]);

  useEffect(() => {
    if (!selectedSourceId && model.sources[0]?.id) {
      setSelectedSourceId(model.sources[0].id);
    }
  }, [model.sources, selectedSourceId]);

  useEffect(() => {
    if (selectedSummaryFile && indexedFiles.includes(selectedSummaryFile)) return;
    setSelectedSummaryFile(indexedFiles[0] || "");
  }, [indexedFiles, selectedSummaryFile]);

  useEffect(() => {
    if (!desktopApi?.getPdfIndexSummary) return undefined;
    let active = true;

    (async () => {
      try {
        const [defaultFolder, indexSummary] = await Promise.all([
          desktopApi.getDefaultPdfFolder?.(),
          desktopApi.getPdfIndexSummary(),
        ]);
        if (!active) return;
        const nextFolder = stringValue(campaign.meta?.pdfFolder) || stringValue(defaultFolder) || stringValue(indexSummary?.folderPath);
        setFolderDraft(nextFolder);
        if (indexSummary) {
          syncLibraryMeta(indexSummary, nextFolder);
        }
        if (desktopApi?.getRagStatus) {
          const status = await desktopApi.getRagStatus(campaign.meta?.aiConfig || {});
          if (active) setRagStatus(status || null);
        }
      } catch (error) {
        if (!active) return;
        setLibraryMessage(stringValue(error?.message || error) || "Could not load desktop PDF index state.");
      }
    })();

    return () => {
      active = false;
    };
  }, [desktopApi]);

  useEffect(() => {
    if (!desktopApi?.onPdfSummarizeProgress) return undefined;
    return desktopApi.onPdfSummarizeProgress((payload) => {
      const fileName = stringValue(payload?.fileName);
      if (fileName && fileName !== selectedSummaryFile) return;
      const current = Math.max(0, intValue(payload?.current, 0));
      const total = Math.max(1, intValue(payload?.total, 1));
      setSummaryProgress({
        current,
        total,
        label: stringValue(payload?.message),
      });
      if (stringValue(payload?.stage) === "done" || stringValue(payload?.stage) === "error") {
        setSummaryBusy(false);
      }
    });
  }, [desktopApi, selectedSummaryFile]);

  useEffect(() => {
    if (!desktopApi?.onSemanticIndexProgress) return undefined;
    return desktopApi.onSemanticIndexProgress((payload) => {
      const current = Math.max(0, intValue(payload?.current, 0));
      const total = Math.max(1, intValue(payload?.total, 1));
      const label = stringValue(payload?.message);
      setSemanticProgress({ current, total, label });
      if (label) setSemanticMessage(label);
      const stage = stringValue(payload?.stage);
      if (stage === "done" || stage === "error") {
        setSemanticBusy(false);
      }
    });
  }, [desktopApi]);

  const handleChooseFolder = async () => {
    if (!desktopApi?.pickPdfFolder) return;
    try {
      const chosen = await desktopApi.pickPdfFolder();
      if (!chosen) return;
      setFolderDraft(stringValue(chosen));
      actions.updateCampaign((current) => ({
        ...current,
        meta: {
          ...current.meta,
          pdfFolder: stringValue(chosen),
        },
      }));
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Folder pick failed",
        message: stringValue(error?.message || error) || "Could not choose a PDF folder.",
      });
    }
  };

  const handleIndexLibrary = async () => {
    if (!desktopApi?.indexPdfFolder) return;
    const folderPath = stringValue(folderDraft);
    if (!folderPath) {
      notifications.show({
        color: "ember",
        title: "Folder required",
        message: "Choose or enter a PDF folder before indexing the source library.",
      });
      return;
    }

    setLibraryBusy(true);
    setLibraryMessage(`Indexing PDFs from ${folderPath}...`);
    try {
      const summary = await desktopApi.indexPdfFolder(folderPath);
      syncLibraryMeta(summary, folderPath);
      if (desktopApi?.getRagStatus) {
        try {
          setRagStatus(await desktopApi.getRagStatus(campaign.meta?.aiConfig || {}));
        } catch {
          setRagStatus(null);
        }
      }
      setLibraryMessage(
        summary?.failed
          ? `Indexed ${intValue(summary?.count, 0)} PDFs. ${intValue(summary?.failed, 0)} file(s) could not be parsed.`
          : `Indexed ${intValue(summary?.count, 0)} PDFs successfully.`
      );
      notifications.show({
        color: "moss",
        title: "Source library indexed",
        message: `${intValue(summary?.count, 0)} PDFs are now searchable.`,
      });
    } catch (error) {
      const message = stringValue(error?.message || error) || "Could not index the PDF folder.";
      setLibraryMessage(message);
      notifications.show({
        color: "red",
        title: "Index failed",
        message,
      });
    } finally {
      setLibraryBusy(false);
    }
  };

  const handleBuildSemanticIndex = async () => {
    if (!desktopApi?.buildSemanticIndex) return;
    const total = Math.max(1, intValue(ragStatus?.retrievalChunks, 1));
    const current = Math.max(0, intValue(ragStatus?.embeddedChunks, 0));
    setSemanticBusy(true);
    setSemanticMessage("Starting full-library semantic embedding...");
    setSemanticProgress({ current, total, label: "Starting full-library semantic embedding..." });
    try {
      const status = await desktopApi.buildSemanticIndex(campaign.meta?.aiConfig || {});
      setRagStatus(status || null);
      const embedded = intValue(status?.embeddedChunks, 0);
      const chunks = intValue(status?.retrievalChunks, 0);
      setSemanticMessage(`Semantic index ready: ${embedded} of ${chunks} chunks embedded.`);
      notifications.show({
        color: "moss",
        title: "Semantic index ready",
        message: `${embedded} of ${chunks} PDF chunks are embedded for RAG search.`,
      });
    } catch (error) {
      const message = stringValue(error?.message || error) || "Could not build the semantic index.";
      setSemanticMessage(message);
      notifications.show({
        color: "red",
        title: "Semantic index failed",
        message,
      });
    } finally {
      setSemanticBusy(false);
    }
  };

  const handleSearch = async () => {
    if (!desktopApi?.searchPdf) return;
    const cleanQuery = stringValue(searchQuery);
    if (!cleanQuery) {
      notifications.show({
        color: "ember",
        title: "Search query required",
        message: "Enter a lore, rules, or chapter phrase before searching the indexed PDFs.",
      });
      return;
    }
    setSearchBusy(true);
    try {
      const result = await desktopApi.searchPdf({
        query: cleanQuery,
        limit: Math.max(1, Math.min(intValue(searchLimit, 20), 100)),
        config: campaign.meta?.aiConfig || {},
      });
      const rows = Array.isArray(result?.results) ? result.results : [];
      const retrieval = result?.retrieval || null;
      setSearchResults(rows);
      setSearchRetrieval(retrieval);
      if (desktopApi?.getRagStatus) {
        try {
          setRagStatus(await desktopApi.getRagStatus(campaign.meta?.aiConfig || {}));
        } catch {
          setRagStatus(null);
        }
      }
      setLibraryMessage(
        rows.length
          ? `Found ${rows.length} source result(s) for "${cleanQuery}". ${stringValue(retrieval?.note)}`
          : `No source result matched "${cleanQuery}". ${stringValue(retrieval?.note)}`
      );
    } catch (error) {
      const message = stringValue(error?.message || error) || "Could not search the indexed PDFs.";
      setLibraryMessage(message);
      notifications.show({
        color: "red",
        title: "Source search failed",
        message,
      });
    } finally {
      setSearchBusy(false);
    }
  };

  const handleOpenSearchResult = async (result) => {
    try {
      if (desktopApi?.openPathAtPage) {
        await desktopApi.openPathAtPage(stringValue(result?.path), intValue(result?.page, 1));
        return;
      }
      if (desktopApi?.openPath) {
        await desktopApi.openPath(stringValue(result?.path));
      }
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Open page failed",
        message: stringValue(error?.message || error) || "Could not open the matched PDF page.",
      });
    }
  };

  const handleSummarizeSelected = async (force = false) => {
    if (!desktopApi?.summarizePdfFile) return;
    const fileName = stringValue(selectedSummaryFile);
    if (!fileName) {
      notifications.show({
        color: "ember",
        title: "No indexed file selected",
        message: "Pick an indexed PDF before generating a source brief.",
      });
      return;
    }
    setSummaryBusy(true);
    setSummaryMessage(force ? `Refreshing source brief for ${fileName}...` : `Summarizing ${fileName}...`);
    setSummaryProgress({ current: 0, total: 1, label: force ? "Refreshing summary..." : "Preparing summary..." });
    try {
      const result = await desktopApi.summarizePdfFile({
        fileName,
        force,
        config: campaign.meta?.aiConfig || {},
      });
      actions.updateCampaign((current) => ({
        ...current,
        meta: {
          ...current.meta,
          pdfSummaries: {
            ...(current.meta?.pdfSummaries || {}),
            [fileName]: {
              fileName: stringValue(result?.fileName) || fileName,
              path: stringValue(result?.path),
              summary: stringValue(result?.summary),
              updatedAt: stringValue(result?.summaryUpdatedAt),
            },
          },
        },
      }));
      setSummaryMessage(result?.reused ? `Loaded saved source brief for ${fileName}.` : `Saved source brief for ${fileName}.`);
      setSummaryProgress({ current: 1, total: 1, label: "Summary ready." });
      notifications.show({
        color: "moss",
        title: result?.reused ? "Saved brief loaded" : "Source brief generated",
        message: fileName,
      });
    } catch (error) {
      const message = stringValue(error?.message || error) || "Could not summarize the selected PDF.";
      setSummaryMessage(message);
      notifications.show({
        color: "red",
        title: "Summary failed",
        message,
      });
    } finally {
      setSummaryBusy(false);
    }
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Reference"
        title="Source Library"
        description="Keep the whole Kingmaker PDF shelf usable in play: registry-level source awareness, searchable indexed text, and reusable book briefs for prep and AI context."
        actions={(
          <>
            <Button variant="default" leftSection={<IconBooks size={16} />} onClick={handleChooseFolder} disabled={!desktopApi?.pickPdfFolder}>
              Choose Folder
            </Button>
            <Button color="moss" leftSection={<IconRefresh size={16} />} onClick={handleIndexLibrary} loading={libraryBusy} disabled={!desktopApi?.indexPdfFolder}>
              Index PDFs
            </Button>
          </>
        )}
      />

      <CompactMetaStrip items={model.summaryCards} />

      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="km-radix-tabs">
        <Tabs.List className="km-radix-list" aria-label="Source Library views">
          <Tabs.Trigger value="search" className="km-radix-trigger">
            Index And Search
          </Tabs.Trigger>
          <Tabs.Trigger value="registry" className="km-radix-trigger">
            Source Registry
          </Tabs.Trigger>
          <Tabs.Trigger value="briefings" className="km-radix-trigger">
            GM Briefings
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="search" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel km-content-panel--flat km-source-control-panel km-panel--flat">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Desktop Library</Text>
                      <Title order={3}>Index Status</Title>
                    </div>
                    <Badge color={desktopApi ? "moss" : "gray"} variant="light">
                      {desktopApi ? "Desktop build" : "Desktop required"}
                    </Badge>
                  </Group>

                  <TextInput
                    label="PDF folder"
                    placeholder="C:\\Users\\Chris Bender\\Downloads\\PathfinderKingmakerAdventurePathPDF-SingleFile"
                    value={folderDraft}
                    onChange={(event) => setFolderDraft(event.currentTarget.value)}
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button variant="default" onClick={handleChooseFolder} disabled={!desktopApi?.pickPdfFolder}>
                      Choose Folder
                    </Button>
                    <Button color="moss" onClick={handleIndexLibrary} loading={libraryBusy} disabled={!desktopApi?.indexPdfFolder}>
                      Index PDFs
                    </Button>
                  </Group>

                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text fw={700}>Library snapshot</Text>
                      <Text size="sm" c="dimmed">{`Folder: ${stringValue(campaign.meta?.pdfFolder) || "Not set"}`}</Text>
                      <Text size="sm" c="dimmed">{`Last indexed: ${formatDateTime(campaign.meta?.pdfIndexedAt)}`}</Text>
                      <Text size="sm" c="dimmed">{`Indexed files: ${intValue(campaign.meta?.pdfIndexedCount, indexedFiles.length)}`}</Text>
                      <Text size="sm" c="dimmed">{libraryMessage || "Index the folder once, then search and summarize books on demand."}</Text>
                    </Stack>
                  </Paper>

                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start">
                        <Text fw={700}>RAG pipeline</Text>
                        <Badge
                          color={
                            ragStatus?.retrievalChunks && ragStatus?.embeddedChunks >= ragStatus?.retrievalChunks
                              ? "moss"
                              : ragStatus?.embeddedChunks
                                ? "brass"
                                : "gray"
                          }
                          variant="light"
                        >
                          {ragStatus?.retrievalChunks && ragStatus?.embeddedChunks >= ragStatus?.retrievalChunks
                            ? "Semantic ready"
                            : ragStatus?.embeddedChunks
                              ? "Partial semantic"
                              : "Lazy embeddings"}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">{formatRetrievalStatus(ragStatus)}</Text>
                      <Text size="sm" c="dimmed">
                        {stringValue(ragStatus?.note) || "PDF search will use keyword fallback until embeddings are available."}
                      </Text>
                      <RagFileCoverage status={ragStatus} />
                      {semanticBusy || semanticMessage ? (
                        <Stack gap={6}>
                          <Progress
                            value={
                              Math.max(1, intValue(semanticProgress.total, 1))
                                ? Math.min(100, Math.round((intValue(semanticProgress.current, 0) / Math.max(1, intValue(semanticProgress.total, 1))) * 100))
                                : 0
                            }
                            color="moss"
                            radius="xl"
                          />
                          <Text size="xs" c="dimmed">
                            {semanticMessage || semanticProgress.label}
                          </Text>
                        </Stack>
                      ) : null}
                      <Group gap="sm" className="km-toolbar-wrap">
                        <Button
                          variant="default"
                          onClick={async () => {
                            if (!desktopApi?.getRagStatus) return;
                            setRagStatus(await desktopApi.getRagStatus(campaign.meta?.aiConfig || {}));
                          }}
                          disabled={!desktopApi?.getRagStatus || semanticBusy}
                        >
                          Refresh RAG Status
                        </Button>
                        <Button
                          color="moss"
                          onClick={handleBuildSemanticIndex}
                          loading={semanticBusy}
                          disabled={
                            !desktopApi?.buildSemanticIndex ||
                            !intValue(ragStatus?.retrievalChunks, 0) ||
                            intValue(ragStatus?.embeddedChunks, 0) >= intValue(ragStatus?.retrievalChunks, 0)
                          }
                        >
                          Build Semantic Index
                        </Button>
                      </Group>
                    </Stack>
                  </Paper>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel km-content-panel--flat">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Search Indexed PDFs</Text>
                      <Title order={3}>Source Search</Title>
                    </div>
                    <Badge color="brass" variant="light">
                      {searchResults.length}
                    </Badge>
                  </Group>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <TextInput
                        label="Query"
                        placeholder="travel hazards, downtime, undead, faction politics"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.currentTarget.value)}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Select
                        label="Max results"
                        value={searchLimit}
                        onChange={(value) => setSearchLimit(value || "20")}
                        data={SEARCH_LIMIT_OPTIONS}
                      />
                    </Grid.Col>
                  </Grid>

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" leftSection={<IconSearch size={16} />} onClick={handleSearch} loading={searchBusy} disabled={!searchReady}>
                      Search Library
                    </Button>
                  </Group>

                  <Text c="dimmed">
                    Search results come from the desktop PDF index. Current RAG defaults: {stringValue(campaign.meta?.aiConfig?.retrievalMode || "hybrid")} retrieval, {campaign.meta?.aiConfig?.rerankEnabled === false ? "reranking off" : "local reranking on"}.
                  </Text>

                  {searchRetrieval ? (
                    <Paper className="km-record-card">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                          <Text fw={700}>Last retrieval pass</Text>
                          <Text size="sm" c="dimmed">
                            {`${stringValue(searchRetrieval.mode || "unknown")} / ${
                              stringValue(searchRetrieval.embeddingModel) || "keyword"
                            } / ${stringValue(searchRetrieval.rerankStrategy || "off")}`}
                          </Text>
                        </div>
                        <Badge color="moss" variant="light">
                          {intValue(searchRetrieval.semanticCandidates, 0)} semantic
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed" mt="xs">
                        {stringValue(searchRetrieval.note) || "No retrieval note returned."}
                      </Text>
                    </Paper>
                  ) : null}

                  <div className="km-source-results-list">
                    {searchResults.length ? (
                      searchResults.map((result, index) => (
                        <SearchResultCard
                          key={`${stringValue(result?.path)}-${intValue(result?.page, index + 1)}-${index}`}
                          result={result}
                          onOpenPage={() => void handleOpenSearchResult(result)}
                          onFocusFile={() => {
                            const fileName = stringValue(result?.fileName);
                            setSelectedSummaryFile(fileName);
                            const matchedSource = matchSourceByFileName(model.sources, fileName);
                            if (matchedSource?.id) setSelectedSourceId(matchedSource.id);
                            setActiveTab("briefings");
                          }}
                        />
                      ))
                    ) : (
                      <Paper className="km-record-card">
                        <Text c="dimmed">
                          No source results yet. Index your PDF folder, then search lore, rules, or chapter phrases here.
                        </Text>
                      </Paper>
                    )}
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="registry" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel km-content-panel--flat">
                <Stack gap="md">
                  <div>
                    <Text className="km-section-kicker">Canonical Shelf</Text>
                    <Title order={3}>Kingmaker Source Registry</Title>
                  </div>
                  <Text c="dimmed">
                    This registry is derived from the PDF bundle manifest so the app knows which books are GM-only, player-safe, kingdom-facing, or map-focused.
                  </Text>
                  <div className="km-source-registry-list">
                    {model.sources.map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        active={stringValue(source.id) === stringValue(selectedSource?.id)}
                        onSelect={() => setSelectedSourceId(source.id)}
                      />
                    ))}
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel km-content-panel--flat km-source-detail-panel km-panel--flat">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Selected Source</Text>
                      <Title order={3}>{selectedSource ? selectedSource.displayTitle : "No source selected"}</Title>
                    </div>
                    {selectedSource ? (
                      <Badge color={selectedSource.indexed ? "moss" : "gray"} variant="light">
                        {selectedSource.indexed ? "Indexed" : "Not indexed"}
                      </Badge>
                    ) : null}
                  </Group>

                  {selectedSource ? (
                    <>
                      <Group gap="sm" className="km-toolbar-wrap">
                        <Badge color="moss" variant="light">{selectedSource.audienceLabel}</Badge>
                        <Badge color="brass" variant="light">{selectedSource.roleLabel}</Badge>
                        <Badge color="gray" variant="light">{selectedSource.sizeLabel}</Badge>
                        {selectedSource.pages ? <Badge color="gray" variant="light">{`${selectedSource.pages} pages`}</Badge> : null}
                      </Group>

                      <Text>{selectedSource.description}</Text>

                      {selectedSource.aliases.length ? (
                        <Text size="sm" c="dimmed">{`Aliases: ${selectedSource.aliases.join(", ")}`}</Text>
                      ) : null}

                      {selectedSource.appBuckets.length ? (
                        <Text size="sm" c="dimmed">{`App buckets: ${selectedSource.appBuckets.join(", ")}`}</Text>
                      ) : null}

                      {selectedSource.summary ? (
                        <Paper className="km-record-card">
                          <Stack gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <Text fw={700}>Saved brief</Text>
                              <Text size="sm" c="dimmed">{formatDateTime(selectedSource.summaryUpdatedAt)}</Text>
                            </Group>
                            <Text size="sm" c="dimmed">{clipText(selectedSource.summary, 420)}</Text>
                          </Stack>
                        </Paper>
                      ) : null}

                      <Paper className="km-record-card">
                        <Stack gap="xs">
                          <Group justify="space-between" align="flex-start">
                            <Text fw={700}>Section outline</Text>
                            <Badge color="gray" variant="light">
                              {selectedSource.sections.length}
                            </Badge>
                          </Group>
                          <div className="km-source-sections-list">
                            {selectedSource.sections.slice(0, 18).map((section, index) => (
                              <Text key={`${section.title}-${section.pageStart}-${index}`} size="sm" c="dimmed">
                                {`${section.depth > 0 ? "  ".repeat(Math.min(section.depth, 3)) : ""}${stringValue(section.title)} / p.${intValue(section.pageStart, 1)}`}
                              </Text>
                            ))}
                          </div>
                        </Stack>
                      </Paper>
                    </>
                  ) : (
                    <Text c="dimmed">
                      Select a canonical source to inspect how the app should treat it.
                    </Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="briefings" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel km-content-panel--flat">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Reusable Briefs</Text>
                      <Title order={3}>Summarize Indexed PDF</Title>
                    </div>
                    <Badge color={summaryBusy ? "ember" : "moss"} variant="light">
                      {summaryBusy ? "Working" : "Ready"}
                    </Badge>
                  </Group>

                  <Select
                    label="Indexed file"
                    value={selectedSummaryFile}
                    onChange={(value) => setSelectedSummaryFile(value || "")}
                    data={summaryOptions}
                    placeholder="No indexed files"
                    searchable
                    clearable={false}
                  />

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button color="moss" onClick={() => void handleSummarizeSelected(false)} loading={summaryBusy} disabled={!summaryReady || !selectedSummaryFile}>
                      Summarize Selected PDF
                    </Button>
                    <Button variant="default" onClick={() => void handleSummarizeSelected(true)} disabled={!summaryReady || !selectedSummaryFile || summaryBusy}>
                      Refresh Summary
                    </Button>
                  </Group>

                  <Paper className="km-record-card">
                    <Stack gap="xs">
                      <Text fw={700}>Summary status</Text>
                      <Text size="sm" c="dimmed">{summaryMessage || "Build a persistent GM brief for a selected indexed PDF."}</Text>
                      <Text size="sm" c="dimmed">
                        {selectedSummaryEntry?.updatedAt ? `Saved ${formatDateTime(selectedSummaryEntry.updatedAt)}` : "No saved brief yet for this file."}
                      </Text>
                      <Progress value={Math.round((Math.max(0, summaryProgress.current) / Math.max(1, summaryProgress.total)) * 100)} color="moss" />
                      <Text size="sm" c="dimmed">{summaryProgress.label || "Waiting to summarize."}</Text>
                    </Stack>
                  </Paper>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel km-content-panel--flat km-source-brief-panel km-panel--flat">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Selected Brief</Text>
                      <Title order={3}>{selectedSummarySource ? selectedSummarySource.displayTitle : selectedSummaryFile || "No indexed file selected"}</Title>
                    </div>
                    {selectedSummarySource ? (
                      <Badge color={selectedSummarySource.indexed ? "moss" : "gray"} variant="light">
                        {selectedSummarySource.indexed ? "Indexed source" : "Manifest only"}
                      </Badge>
                    ) : null}
                  </Group>

                  {selectedSummarySource ? (
                    <Text c="dimmed">{selectedSummarySource.description}</Text>
                  ) : null}

                  <Textarea
                    readOnly
                    autosize
                    minRows={18}
                    value={stringValue(selectedSummaryEntry?.summary) || "Run Summarize Selected PDF to generate a persistent source brief."}
                  />
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
