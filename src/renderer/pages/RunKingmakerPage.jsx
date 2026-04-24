import { Badge, Button, Grid, Group, Paper, Select, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight,
  IconBook2,
  IconChecklist,
  IconCircleCheck,
  IconCircleDashed,
  IconCrown,
  IconMap2,
  IconPlayerPlay,
  IconSparkles,
} from "@tabler/icons-react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import { useCampaign } from "../context/CampaignContext";
import { STORY_PHASE_SELECT_OPTIONS } from "../lib/kingmakerFlow";
import { buildRunKingmakerModel } from "../lib/runKingmaker";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function getKindLabel(kind) {
  if (kind === "npc") return "NPC";
  return stringValue(kind).replace(/^\w/, (match) => match.toUpperCase());
}

function ReferenceRow({ item, onOpen, onActivate }) {
  return (
    <Paper className={`km-run-record km-run-record--${item.reference ? "reference" : "live"}`}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Stack gap={6} miw={0}>
          <Group gap="xs" wrap="wrap">
            <Badge color={item.reference ? "brass" : "moss"} variant="light">
              {item.label || getKindLabel(item.kind)}
            </Badge>
            {item.meta ? <Text className="km-run-record__meta">{item.meta}</Text> : null}
          </Group>
          <Text className="km-run-record__title">{item.title}</Text>
          <Text className="km-run-record__body">{item.body || "No table-facing note has been written yet."}</Text>
        </Stack>
        <Stack gap="xs" align="flex-end" className="km-run-record__actions">
          {item.reference ? (
            <Button size="compact-sm" color="moss" variant="light" onClick={() => onActivate(item)}>
              Activate
            </Button>
          ) : null}
          <Button size="compact-sm" variant="subtle" rightSection={<IconArrowRight size={14} />} onClick={() => onOpen(item.path)}>
            Open
          </Button>
        </Stack>
      </Group>
    </Paper>
  );
}

function RunSheetCard({ item, onOpen }) {
  return (
    <UnstyledButton className="km-run-sheet-card" onClick={() => onOpen(item.path)}>
      <Text className="km-section-kicker">{item.label}</Text>
      <Text className="km-run-sheet-card__text">{item.text}</Text>
      <Group className="km-run-sheet-card__footer" justify="space-between" align="center" wrap="wrap">
        <Text className="km-run-sheet-card__helper">{item.helper}</Text>
        <span className="km-run-sheet-card__action">
          {item.actionLabel}
          <IconArrowRight size={14} stroke={2} />
        </span>
      </Group>
    </UnstyledButton>
  );
}

function ChecklistRow({ item }) {
  const Icon = item.done ? IconCircleCheck : IconCircleDashed;
  return (
    <div className={`km-run-check-row${item.done ? " is-done" : ""}`}>
      <Icon size={18} stroke={1.9} />
      <span>
        <Text className="km-run-check-row__label">{item.label}</Text>
        <Text className="km-run-check-row__helper">{item.helper}</Text>
      </span>
    </div>
  );
}

function ContextChip({ item }) {
  return (
    <Paper className="km-run-context-chip">
      <Text className="km-section-kicker">{item.label}</Text>
      <Text className="km-run-context-chip__value">{item.value}</Text>
      <Text className="km-run-context-chip__detail">{item.detail}</Text>
    </Paper>
  );
}

function ChapterCard({ item, onSelect }) {
  return (
    <UnstyledButton className={`km-run-chapter-card${item.active ? " is-active" : ""}`} onClick={() => onSelect(item.id)}>
      <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
        <Stack gap={4} miw={0}>
          <Text className="km-section-kicker">{item.pageLabel}</Text>
          <Text className="km-run-chapter-card__title">{item.shortLabel}</Text>
        </Stack>
        <Badge color={item.active ? "brass" : "moss"} variant="light">
          {item.lane}
        </Badge>
      </Group>
      <Text className="km-run-chapter-card__summary">{item.summary}</Text>
      <Group justify="space-between" align="center" gap="xs" wrap="nowrap" className="km-run-chapter-card__footer">
        <Text className="km-run-chapter-card__status">{item.active ? "Selected chapter" : "Run this chapter"}</Text>
        <IconArrowRight size={14} stroke={2} />
      </Group>
    </UnstyledButton>
  );
}

function SourceAnchorRow({ item, onOpen }) {
  return (
    <UnstyledButton className="km-run-source-anchor" onClick={() => onOpen("/reference/source-library")}>
      <span>
        <Text className="km-run-source-anchor__title">{item.title}</Text>
        <Text className="km-run-source-anchor__meta">{item.sourceTitle}</Text>
      </span>
      <Badge color="brass" variant="light">
        {item.pageLabel}
      </Badge>
    </UnstyledButton>
  );
}

export default function RunKingmakerPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildRunKingmakerModel(campaign);
  const chapterBriefRef = useRef(null);

  const handleOpen = (path) => {
    if (!path) return;
    navigate(path);
  };

  const handleSetPhase = (phaseId) => {
    const selectedPhaseId = phaseId || model.storyPhase.id;
    const selectedCard = model.chapterCards.find((item) => item.id === selectedPhaseId);
    actions.setStoryFocus({ activePhaseId: selectedPhaseId });
    notifications.show({
      color: "moss",
      title: "Chapter focus updated",
      message: `${selectedCard?.label || "Selected chapter"} is now the active Run Kingmaker focus.`,
    });
    window.requestAnimationFrame(() => {
      chapterBriefRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleCreateSession = () => {
    const sessionNumber = String((campaign.sessions || []).length + 1).padStart(2, "0");
    actions.addSession({
      title: `Session ${sessionNumber} - ${model.storyPhase.shortLabel}`,
      arc: model.storyPhase.shortLabel,
      chapter: model.storyPhase.chapter,
      travelObjective: model.command.spotlightText,
      pressure: model.events.activeEvents[0]?.title || "",
      nextPrep: model.prepItems[0]?.text || "",
    });
    notifications.show({
      color: "moss",
      title: "Session started",
      message: `A ${model.storyPhase.shortLabel} session draft was added to the Adventure Log.`,
    });
    navigate("/campaign/adventure-log");
  };

  const handleActivate = (item) => {
    const actionByKind = {
      quest: actions.activateQuest,
      event: actions.activateEvent,
      npc: actions.activateNpc,
      location: actions.activateLocation,
      companion: actions.activateCompanion,
    };
    const action = actionByKind[item.kind];
    if (!action || !item.id) return;
    const saved = action(item.id);
    if (!saved) return;
    notifications.show({
      color: "moss",
      title: `${getKindLabel(item.kind)} activated`,
      message: `${item.title} is now confirmed campaign state.`,
    });
  };

  return (
    <Stack gap="xl" className="km-run-page">
      <section className="km-run-hero">
        <div className="km-run-hero__copy">
          <Text className="km-home-kicker">Run Kingmaker</Text>
          <Title order={1} className="km-run-title">
            Tonight's table, not the whole archive.
          </Title>
          <Text className="km-run-hero__lede">
            Pick the AP chapter you are running. The app narrows source anchors, live records, reference cards, and Council context around that chapter.
          </Text>
          <Group gap="sm" wrap="wrap">
            <Button color="moss" leftSection={<IconPlayerPlay size={16} />} onClick={handleCreateSession}>
              Start Session
            </Button>
            <Button variant="default" leftSection={<IconBook2 size={16} />} onClick={() => navigate("/campaign/adventure-log")}>
              Adventure Log
            </Button>
            <Button variant="default" leftSection={<IconSparkles size={16} />} onClick={() => navigate("/reference/ai-chat")}>
              Ask Council
            </Button>
          </Group>
        </div>

        <Paper className="km-run-phase-card">
          <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
            <Stack gap={4}>
              <Text className="km-section-kicker">Active AP Phase</Text>
              <Title order={2}>{model.storyPhase.label}</Title>
              <Text c="dimmed">{model.storyPhase.summary}</Text>
            </Stack>
            <IconCrown size={34} stroke={1.55} />
          </Group>
          <Select
            label="Change story focus"
            value={model.storyPhase.id}
            data={STORY_PHASE_SELECT_OPTIONS}
            onChange={handleSetPhase}
            allowDeselect={false}
          />
        </Paper>
      </section>

      <Paper className="km-panel km-run-panel km-run-chapter-board">
        <Group justify="space-between" align="flex-start" mb="md">
          <Stack gap={3}>
            <Text className="km-section-kicker">Chapter Shelf</Text>
            <Title order={2}>Choose what the DM is running</Title>
            <Text c="dimmed">Selecting a chapter updates the whole app focus without marking any reference material as table truth.</Text>
          </Stack>
          <Badge color="brass" variant="light">{model.chapterGuide.pageLabel}</Badge>
        </Group>
        <div className="km-run-chapter-grid">
          {model.chapterCards.map((item) => (
            <ChapterCard key={item.id} item={item} onSelect={handleSetPhase} />
          ))}
        </div>
      </Paper>

      <Grid gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper className="km-panel km-run-panel km-run-chapter-brief" ref={chapterBriefRef}>
            <Group justify="space-between" align="flex-start" gap="md" mb="lg">
              <Stack gap={4}>
                <Text className="km-section-kicker">Chapter Brief</Text>
                <Title order={2}>{model.chapterGuide.label}</Title>
                <Text c="dimmed">{model.chapterGuide.dmBrief}</Text>
              </Stack>
              <Badge color="moss" variant="light">{model.chapterGuide.lane}</Badge>
            </Group>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Stack gap="sm">
                  <Text className="km-section-kicker">Run Beats</Text>
                  {model.chapterGuide.runBeats.map((beat, index) => (
                    <Paper key={beat} className="km-run-beat">
                      <Badge color="brass" variant="light">{String(index + 1).padStart(2, "0")}</Badge>
                      <Text>{beat}</Text>
                    </Paper>
                  ))}
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Stack gap="sm">
                  <Text className="km-section-kicker">Keep Handy</Text>
                  <Group gap="xs" wrap="wrap">
                    {model.chapterGuide.keepHandy.map((item) => (
                      <Badge key={item} color="moss" variant="light" className="km-run-handy-chip">
                        {item}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              </Grid.Col>
            </Grid>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper className="km-panel km-run-panel">
            <Group justify="space-between" align="flex-start" mb="md">
              <Stack gap={3}>
                <Text className="km-section-kicker">Source Anchors</Text>
                <Title order={2}>Local PDF chapter map</Title>
                <Text c="dimmed">Page anchors from your indexed source manifest. Open the source library when you need the actual book text.</Text>
              </Stack>
              <Button variant="default" size="compact-sm" onClick={() => navigate("/reference/source-library")}>
                Source Library
              </Button>
            </Group>
            <Stack gap="xs">
              {model.chapterGuide.sourceAnchors.length ? (
                model.chapterGuide.sourceAnchors.map((item) => (
                  <SourceAnchorRow key={`${item.title}:${item.pageStart}`} item={item} onOpen={handleOpen} />
                ))
              ) : (
                <Paper className="km-run-empty">
                  <Text fw={700}>No source anchors found.</Text>
                  <Text c="dimmed">Refresh the source library manifest after adding or moving PDFs.</Text>
                </Paper>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Grid gutter="lg">
        {model.summaryCards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, sm: 6, xl: 3 }}>
            <MetricCard {...card} />
          </Grid.Col>
        ))}
      </Grid>

      <Grid gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper className="km-panel km-run-panel">
            <Group justify="space-between" align="flex-start" mb="lg">
              <Stack gap={3}>
                <Text className="km-section-kicker">Run Sheet</Text>
                <Title order={2}>Three beats for the next session</Title>
              </Stack>
              <Badge color="brass" variant="light">{model.latestSessionDate}</Badge>
            </Group>
            <div className="km-run-sheet-grid">
              {model.runSheet.map((item) => (
                <div key={item.label} className="km-run-sheet-grid__item">
                  <RunSheetCard item={item} onOpen={handleOpen} />
                </div>
              ))}
            </div>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper className="km-panel km-run-panel">
            <Group gap="xs" mb="lg">
              <IconChecklist size={20} stroke={1.8} />
              <Stack gap={2}>
                <Text className="km-section-kicker">DM Checklist</Text>
                <Title order={2}>Ready state</Title>
              </Stack>
            </Group>
            <Stack gap="sm">
              {model.checklist.map((item) => (
                <ChecklistRow key={item.label} item={item} />
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Grid gutter="lg" align="start">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper className="km-panel km-run-panel">
            <Group justify="space-between" align="flex-start" mb="md">
              <Stack gap={3}>
                <Text className="km-section-kicker">Live Table State</Text>
                <Title order={2}>What the app should treat as true</Title>
                <Text c="dimmed">These records are active, confirmed, and safe for AI/context/export use.</Text>
              </Stack>
              <Button variant="default" leftSection={<IconMap2 size={16} />} onClick={() => navigate("/world/hex-map")}>
                Open Atlas
              </Button>
            </Group>
            <Stack gap="sm">
              {model.liveRows.length ? (
                model.liveRows.map((item) => (
                  <ReferenceRow key={`${item.kind}:${item.id}`} item={item} onOpen={handleOpen} onActivate={handleActivate} />
                ))
              ) : (
                <Paper className="km-run-empty">
                  <Text fw={700}>No live records yet.</Text>
                  <Text c="dimmed">Use the focused reference queue to activate only what the party has reached.</Text>
                </Paper>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper className="km-panel km-run-panel">
            <Group justify="space-between" align="flex-start" mb="md">
              <Stack gap={3}>
                <Text className="km-section-kicker">Focused Reference Queue</Text>
                <Title order={2}>Safe next material</Title>
                <Text c="dimmed">Canon/reference items matching {model.storyPhase.shortLabel}. Activate them when they become real at your table.</Text>
              </Stack>
            </Group>
            <Stack gap="sm">
              {model.referenceRows.length ? (
                model.referenceRows.map((item) => (
                  <ReferenceRow key={`${item.kind}:${item.id}`} item={item} onOpen={handleOpen} onActivate={handleActivate} />
                ))
              ) : (
                <Paper className="km-run-empty">
                  <Text fw={700}>No focused reference records found.</Text>
                  <Text c="dimmed">Search the source library or switch the AP phase to surface a different slice.</Text>
                </Paper>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Paper className="km-panel km-run-panel">
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={3}>
            <Text className="km-section-kicker">AI Context Preview</Text>
            <Title order={2}>What Council should listen to</Title>
            <Text c="dimmed">This is the boundary that keeps advice focused on your current Kingmaker table state.</Text>
          </Stack>
          <Button variant="default" rightSection={<IconArrowRight size={14} />} onClick={() => navigate("/reference/ai-chat")}>
            Open Council
          </Button>
        </Group>
        <Grid gutter="md">
          {model.aiContext.map((item) => (
            <Grid.Col key={item.label} span={{ base: 12, sm: 6, xl: 3 }}>
              <ContextChip item={item} />
            </Grid.Col>
          ))}
        </Grid>
      </Paper>
    </Stack>
  );
}
