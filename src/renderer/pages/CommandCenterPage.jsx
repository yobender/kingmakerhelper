import { useEffect, useState } from "react";
import { Badge, Group, Select, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import {
  IconArrowRight,
  IconBellRinging,
  IconBook2,
  IconCalendarStats,
  IconCrown,
  IconMap2,
  IconNotebook,
  IconSparkles,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useCampaign } from "../context/CampaignContext";
import { STORY_PHASE_SELECT_OPTIONS } from "../lib/kingmakerFlow";
import { buildCommandCenterModel, getSessionDateLabel } from "../lib/selectors";

const HOME_ACTIONS = [
  {
    label: "Campaign Journal",
    helper: "Session log, charter handoff, and table notes.",
    path: "/campaign/adventure-log",
    icon: IconNotebook,
    tone: "sun",
  },
  {
    label: "Threat Board",
    helper: "Bandits, omens, clocks, and frontier pressure.",
    path: "/world/events",
    icon: IconBellRinging,
    tone: "ember",
  },
  {
    label: "Greenbelt Atlas",
    helper: "Hexes, routes, landmarks, and wild country.",
    path: "/world/hex-map",
    icon: IconMap2,
    tone: "moss",
  },
  {
    label: "Council Advice",
    helper: "Campaign-aware prep, recall, and rulings.",
    path: "/reference/ai-chat",
    icon: IconSparkles,
    tone: "aqua",
  },
];

const HOME_LAYOUT_STORAGE_KEY = "kingmaker-companion.command-center-layout.v1";
const HOME_LAYOUTS = [
  { id: "focus", label: "Focus", helper: "Least busy" },
  { id: "atlas", label: "Atlas", helper: "Worldbuilder hub" },
  { id: "board", label: "Board", helper: "Full GM dashboard" },
];

const ATLAS_GROUPS = [
  {
    title: "Campaign Desk",
    helper: "Session writing and table-facing notes.",
    entryLabel: "Open Campaign Desk",
    path: "/campaign/adventure-log",
    includes: ["Adventure Log", "Table Notes", "Scene Forge"],
  },
  {
    title: "World Atlas",
    helper: "People, places, quests, and the Greenbelt map.",
    entryLabel: "Open World Atlas",
    path: "/world/hex-map",
    includes: ["Hex Map", "Locations", "NPCs", "Quests"],
  },
  {
    title: "Kingdom Table",
    helper: "Turns, pressure, clocks, and companions.",
    entryLabel: "Open Kingdom Table",
    path: "/world/kingdom",
    includes: ["Kingdom", "Events", "Companions"],
  },
  {
    title: "Reference Shelf",
    helper: "Rules, sources, and campaign-aware AI.",
    entryLabel: "Open Council",
    path: "/reference/ai-chat",
    includes: ["Ask AI", "Rules", "Sources", "RAG"],
  },
];

function readHomeLayout() {
  try {
    if (typeof window === "undefined") return "focus";
    const value = window.localStorage.getItem(HOME_LAYOUT_STORAGE_KEY);
    return HOME_LAYOUTS.some((layout) => layout.id === value) ? value : "focus";
  } catch {
    return "focus";
  }
}

function writeHomeLayout(value) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, value);
    }
  } catch {
    // Non-critical preference write.
  }
}

function HomeLayoutSwitcher({ value, onChange }) {
  return (
    <div className="km-home-layout-switch" aria-label="Command Center layout">
      {HOME_LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          type="button"
          className={`km-home-layout-switch__button${layout.id === value ? " is-active" : ""}`}
          onClick={() => onChange(layout.id)}
        >
          <span>{layout.label}</span>
          <small>{layout.helper}</small>
        </button>
      ))}
    </div>
  );
}

function HomeActionBubble({ item, onOpen }) {
  const Icon = item.icon;

  return (
    <UnstyledButton className={`km-home-action-bubble km-home-tone-${item.tone}`} onClick={() => onOpen(item.path)}>
      <span className="km-home-action-bubble__icon">
        <Icon size={22} stroke={1.8} />
      </span>
      <span className="km-home-action-bubble__copy">
        <Text className="km-home-action-bubble__label">{item.label}</Text>
        <Text className="km-home-action-bubble__helper">{item.helper}</Text>
      </span>
      <IconArrowRight className="km-home-action-bubble__arrow" size={18} stroke={1.9} />
    </UnstyledButton>
  );
}

function HomeStatBubble({ card, index, onOpen }) {
  const statIcons = [IconCalendarStats, IconBook2, IconBellRinging, IconCrown];
  const Icon = statIcons[index % statIcons.length];

  return (
    <UnstyledButton className={`km-home-stat-bubble km-home-stat-bubble--${card.valueTone || "compact"}`} onClick={() => onOpen(card.path)}>
      <span className="km-home-stat-bubble__icon">
        <Icon size={20} stroke={1.8} />
      </span>
      <span className="km-home-stat-bubble__copy">
        <Text className="km-section-kicker">{card.label}</Text>
        <Text className="km-home-stat-bubble__value">{card.value}</Text>
        <Text className="km-home-stat-bubble__helper">{[card.chip, card.helper].filter(Boolean).join(" / ")}</Text>
      </span>
    </UnstyledButton>
  );
}

export default function CommandCenterPage() {
  const navigate = useNavigate();
  const { campaign, actions } = useCampaign();
  const model = buildCommandCenterModel(campaign);
  const latestDate = model.latestSession ? getSessionDateLabel(model.latestSession) : "No session date";
  const [homeLayout, setHomeLayout] = useState(readHomeLayout);

  useEffect(() => {
    writeHomeLayout(homeLayout);
  }, [homeLayout]);

  return (
    <Stack gap="xl" className="km-home-page">
      <div className="km-home-control-bar">
        <HomeLayoutSwitcher value={homeLayout} onChange={setHomeLayout} />
        <Select
          className="km-story-focus-select"
          label="Story Focus"
          value={model.storyPhase.id}
          data={STORY_PHASE_SELECT_OPTIONS}
          onChange={(value) => actions.setStoryFocus({ activePhaseId: value || model.storyPhase.id })}
          allowDeselect={false}
        />
      </div>

      {homeLayout === "focus" ? (
        <HomeFocusLayout model={model} latestDate={latestDate} navigate={navigate} />
      ) : null}

      {homeLayout === "atlas" ? (
        <HomeAtlasLayout model={model} latestDate={latestDate} navigate={navigate} />
      ) : null}

      {homeLayout === "board" ? (
        <HomeBoardLayout model={model} latestDate={latestDate} navigate={navigate} />
      ) : null}
    </Stack>
  );
}

function HomeFocusLayout({ model, latestDate, navigate }) {
  const leadPrepItem = model.prepItems[0];

  return (
    <div className="km-home-prototype km-home-prototype--focus">
      <section className="km-home-focus-landing">
        <div className="km-home-focus-landing__copy">
          <Text className="km-home-kicker">Kingmaker Command Center</Text>
          <Title order={1} className="km-home-focus-title">
            Run tonight.
            <br />
            Record what matters.
          </Title>
          <Text className="km-home-focus-copy">
            A quieter table view for {model.storyPhase.shortLabel}: the next session, current pressure, and the few places you actually need to open.
          </Text>
          <Group gap="sm" wrap="wrap" className="km-home-focus-actions">
            <UnstyledButton className="km-home-focus-action" onClick={() => navigate("/campaign/adventure-log")}>
              Open Journal <IconArrowRight size={15} stroke={2} />
            </UnstyledButton>
            <UnstyledButton className="km-home-focus-action" onClick={() => navigate("/world/hex-map")}>
              Open Atlas <IconArrowRight size={15} stroke={2} />
            </UnstyledButton>
            <UnstyledButton className="km-home-focus-action" onClick={() => navigate("/reference/ai-chat")}>
              Ask Council <IconArrowRight size={15} stroke={2} />
            </UnstyledButton>
          </Group>
        </div>

        <aside className="km-home-focus-brief">
          <Text className="km-section-kicker">Tonight's Expedition</Text>
          <Title order={2} className="km-home-focus-brief__title">
            {model.latestSession?.title || "No session logged yet"}
          </Title>
          <Text className="km-home-focus-brief__phase">{model.storyPhase.label}</Text>
          <Text className="km-home-focus-brief__lede">{model.spotlightText}</Text>
          <Text className="km-home-focus-brief__support">
            {model.latestSession?.summary ||
              "Capture the opening situation, visible pressure, and the handoff you want waiting after play."}
          </Text>
          <div className="km-home-focus-brief__meta">
            <span>{latestDate}</span>
            <span>{model.summaryCards[3]?.value || "Kingdom pending"}</span>
          </div>
        </aside>
      </section>

      <section className="km-home-focus-strip">
        <UnstyledButton className="km-home-focus-note" onClick={() => navigate(leadPrepItem?.path || "/campaign/adventure-log")}>
          <Text className="km-section-kicker">Next Pressure</Text>
          <Text className="km-home-focus-note__title">{leadPrepItem?.text || "No open prep pressure"}</Text>
          <Text className="km-home-focus-note__helper">{leadPrepItem?.label || "Open items will appear here when your campaign state has them."}</Text>
        </UnstyledButton>
        <UnstyledButton className="km-home-focus-note" onClick={() => navigate("/world/kingdom")}>
          <Text className="km-section-kicker">Kingdom Pulse</Text>
          <Text className="km-home-focus-note__title">{model.summaryCards[0]?.value || "Current date"}</Text>
          <Text className="km-home-focus-note__helper">{model.summaryCards[0]?.helper || "Review current kingdom state."}</Text>
        </UnstyledButton>
        <UnstyledButton className="km-home-focus-note" onClick={() => navigate("/world/events")}>
          <Text className="km-section-kicker">Open Clock</Text>
          <Text className="km-home-focus-note__title">{model.summaryCards[2]?.value || "0"}</Text>
          <Text className="km-home-focus-note__helper">{model.summaryCards[2]?.helper || "Review campaign pressure."}</Text>
        </UnstyledButton>
      </section>
    </div>
  );
}

function HomeAtlasLayout({ model, latestDate, navigate }) {
  return (
    <div className="km-home-prototype km-home-prototype--atlas">
      <section className="km-home-atlas-cover">
        <div>
          <Text className="km-home-kicker">Brevoy Charter // Stolen Lands</Text>
          <Title order={1} className="km-home-atlas-title">
            Kingmaker Atlas
          </Title>
          <Text className="km-home-atlas-copy">
            A worldbuilding-style index focused on {model.storyPhase.shortLabel}, closer to a living wiki than a dashboard.
          </Text>
        </div>
        <div className="km-home-atlas-current">
          <Text className="km-section-kicker">Current Page</Text>
          <Text className="km-home-atlas-current__title">{model.latestSession?.title || "No session logged yet"}</Text>
          <Text className="km-home-atlas-current__helper">{latestDate}</Text>
        </div>
      </section>

      <section className="km-home-atlas-index">
        {ATLAS_GROUPS.map((group) => (
          <article key={group.title} className="km-home-atlas-card">
            <Text className="km-section-kicker">{group.title}</Text>
            <Text className="km-home-atlas-card__helper">{group.helper}</Text>
            <UnstyledButton className="km-home-atlas-primary-link" onClick={() => navigate(group.path)}>
              <span>{group.entryLabel}</span>
              <IconArrowRight size={15} stroke={2} />
            </UnstyledButton>
            <Text className="km-home-atlas-card__includes">Includes {group.includes.join(" / ")}</Text>
          </article>
        ))}
      </section>
    </div>
  );
}

function HomeBoardLayout({ model, latestDate, navigate }) {
  return (
    <>
      <section className="km-home-hero">
        <div className="km-home-hero__orb km-home-hero__orb--one" />
        <div className="km-home-hero__orb km-home-hero__orb--two" />
        <div className="km-home-seal" aria-hidden="true">
          <IconCrown size={30} stroke={1.65} />
          <span>Charter</span>
          <strong>Greenbelt</strong>
        </div>

        <div className="km-home-hero__copy">
          <Text className="km-home-kicker">Brevoy Charter // Stolen Lands</Text>
          <Title order={1} className="km-home-title">
            Claim the Stolen Lands.
          </Title>
          <Text className="km-home-subtitle">
            A focused command table for {model.storyPhase.shortLabel}, active pressure, and the records you have confirmed at your table.
          </Text>
          <Group gap="sm" wrap="wrap" className="km-home-hero__chips">
            <Badge className="km-home-date-pill" variant="light">
              {model.summaryCards[0]?.value || "Current date"}
            </Badge>
            <Badge className="km-home-date-pill km-home-date-pill--soft" variant="light">
              Brevoy Charter
            </Badge>
          </Group>
        </div>

        <aside className="km-home-focus-card">
          <Text className="km-section-kicker">Tonight's Expedition</Text>
          <Title order={2} className="km-home-focus-card__title">
            {model.latestSession?.title || "No session logged yet"}
          </Title>
          <Text className="km-home-focus-card__lede">{model.spotlightText}</Text>
          <Text className="km-home-focus-card__support">
            {model.latestSession?.summary ||
              "Capture the opening situation, the visible pressure, and the handoff you want waiting for next session."}
          </Text>
          <Group justify="space-between" align="center" gap="md" className="km-home-focus-card__footer">
            <Badge className="km-home-session-pill" variant="light">
              {latestDate}
            </Badge>
            <UnstyledButton className="km-home-inline-link" onClick={() => navigate("/campaign/adventure-log")}>
              Open charter log <IconArrowRight size={15} stroke={2} />
            </UnstyledButton>
          </Group>
        </aside>
      </section>

      <section className="km-home-section km-home-section--portals">
        <Group justify="space-between" align="end" gap="md" className="km-home-section__head">
          <div>
            <Text className="km-section-kicker">Start Here</Text>
            <Title order={2} className="km-home-section-title">
              The four tables you actually use
            </Title>
          </div>
          <Text className="km-home-section-copy">
            Clear portals replace the old wall of similar tabs.
          </Text>
        </Group>
        <div className="km-home-action-grid">
          {HOME_ACTIONS.map((item) => (
            <HomeActionBubble key={item.label} item={item} onOpen={navigate} />
          ))}
        </div>
      </section>

      <section className="km-home-ledger-strip" aria-label="Campaign pulse">
        {model.summaryCards.map((card, index) => (
          <HomeStatBubble key={card.label} card={card} index={index} onOpen={navigate} />
        ))}
      </section>

      <div className="km-home-dashboard-grid">
        <section className="km-home-board km-home-board--wide">
          <Group justify="space-between" align="flex-start" gap="md" className="km-home-board__head">
            <div>
              <Text className="km-section-kicker">Charter Route</Text>
              <Title order={2} className="km-home-board__title">
                From campfire to crown
              </Title>
            </div>
            <UnstyledButton className="km-home-inline-link" onClick={() => navigate("/campaign/table-notes")}>
              Table ledger <IconArrowRight size={15} stroke={2} />
            </UnstyledButton>
          </Group>

          <div className="km-home-runway">
            {model.runSheet.map((entry, index) => (
              <UnstyledButton key={entry.label} className="km-home-runway__item" onClick={() => navigate(entry.path)}>
                <span className="km-home-runway__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="km-home-runway__copy">
                  <Text className="km-home-runway__label">{entry.label}</Text>
                  <Text className="km-home-runway__text">{entry.text}</Text>
                  <Text className="km-home-runway__helper">{entry.helper}</Text>
                </span>
                <span className="km-home-runway__action">{entry.actionLabel}</span>
              </UnstyledButton>
            ))}
          </div>
        </section>

        <aside className="km-home-board km-home-queue">
          <Group justify="space-between" align="center">
            <div>
              <Text className="km-section-kicker">Frontier Pressure</Text>
              <Title order={3} className="km-home-board__title">
                Threads that bite
              </Title>
            </div>
            <Text className="km-home-count-pill">{model.prepItems.length} items</Text>
          </Group>

          <div className="km-home-queue__list">
            {model.prepItems.length ? (
              model.prepItems.map((item) => (
                <UnstyledButton key={item.id} className="km-home-queue__item" onClick={() => navigate(item.path)}>
                  <span className="km-home-queue__dot" />
                  <span className="km-home-queue__copy">
                    <Text className="km-home-queue__text">{item.text}</Text>
                    {item.label ? <Text className="km-home-queue__label">{item.label}</Text> : null}
                  </span>
                  <IconArrowRight size={16} stroke={1.9} />
                </UnstyledButton>
              ))
            ) : (
              <Text className="km-home-empty">No prep queue yet. Open quests, clocks, and session notes will surface here.</Text>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
