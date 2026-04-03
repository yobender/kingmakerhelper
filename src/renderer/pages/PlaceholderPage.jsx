import { Badge, Button, Grid, Paper, Stack, Text, Title } from "@mantine/core";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { getLegacyWorkspaceUrl } from "../lib/desktop";

function buildSnapshot(route, campaign) {
  switch (route.id) {
    case "capture":
      return {
        primary: `${(campaign.liveCapture || []).length} live notes`,
        secondary: `${(campaign.sessions || []).length} logged sessions`,
        detail: "Table Notes is queued to become the dedicated in-session capture surface for rulings, retcons, loot, and quick scene fragments.",
      };
    case "writing":
      return {
        primary: `${(campaign.meta?.aiHistory || []).length} AI memory turns`,
        secondary: `${(campaign.rulesStore || []).length} rule entries`,
        detail: "Scene Forge will become the drafting surface for boxed text, recap cleanup, and export-ready session packets.",
      };
    case "kingdom":
      return {
        primary: `${(campaign.kingdom?.turns || []).length} kingdom turns`,
        secondary: `${(campaign.kingdom?.eventHistory || []).length} kingdom event records`,
        detail: "Kingdom management, calendar advancement, leadership, and event fallout still live in the legacy workspace while the React pages are rebuilt.",
      };
    case "hexmap":
      return {
        primary: `${(campaign.hexMap?.markers || []).length} map markers`,
        secondary: `${(campaign.hexMap?.forces || []).length} tracked forces`,
        detail: "The new shell will eventually replace the hex tools with a cleaner, map-first UI. For now, the full map editor remains in legacy.",
      };
    case "companions":
      return {
        primary: `${(campaign.companions || []).length} companion records`,
        secondary: `${(campaign.events || []).filter((entry) => entry.linkedCompanion).length} linked event beats`,
        detail: "Companion influence, travel state, kingdom roles, and personal beats are still available in the legacy workspace.",
      };
    case "events":
      return {
        primary: `${(campaign.events || []).length} event clocks`,
        secondary: `${(campaign.quests || []).length} quest threads`,
        detail: "Events will be rebuilt around pressure clocks, fallout history, and kingdom-facing consequences.",
      };
    case "npcs":
      return {
        primary: `${(campaign.npcs || []).length} NPCs`,
        secondary: `${(campaign.locations || []).length} locations`,
        detail: "NPC management remains in the legacy workspace until the relationship and faction views are ready.",
      };
    case "quests":
      return {
        primary: `${(campaign.quests || []).length} quest records`,
        secondary: `${(campaign.events || []).filter((entry) => entry.linkedQuest).length} linked event clocks`,
        detail: "Quest routing and chapter/hex tracking stay available in legacy while the new quest board is designed.",
      };
    case "locations":
      return {
        primary: `${(campaign.locations || []).length} location records`,
        secondary: `${(campaign.hexMap?.markers || []).length} map markers`,
        detail: "Location pages will return once the hex-map and location systems are rebuilt together.",
      };
    case "rules":
      return {
        primary: `${(campaign.rulesStore || []).length} rule records`,
        secondary: `${(campaign.meta?.aiMemory?.manualRulings || "").trim() ? "Manual digest loaded" : "No manual digest"}`,
        detail: "Rules Reference remains in legacy until the canon/rulings split is ported cleanly.",
      };
    case "pdf":
      return {
        primary: `${campaign.meta?.pdfIndexedCount || 0} indexed PDFs`,
        secondary: `${(campaign.meta?.pdfIndexedFiles || []).length} known source files`,
        detail: "Source Library still runs in the legacy workspace for PDF indexing, search, and summaries.",
      };
    case "obsidian":
      return {
        primary: `${campaign.meta?.obsidian?.vaultPath ? "Vault configured" : "Vault not configured"}`,
        secondary: `${campaign.meta?.obsidian?.lastSyncAt ? "Previous sync recorded" : "No sync run yet"}`,
        detail: "Vault Sync is waiting on the storage bridge work before it is ported into the React shell.",
      };
    case "foundry":
      return {
        primary: "Legacy export tools available",
        secondary: "JSON import/export already rebuilt in the header",
        detail: "Foundry handoff and external bridge pages remain available in legacy until the new export workflows are ready.",
      };
    default:
      return {
        primary: "Queued for migration",
        secondary: "Legacy tools still available",
        detail: "This tab has not been rebuilt in React yet, but the existing toolset is still accessible from the legacy workspace.",
      };
  }
}

export default function PlaceholderPage({ route }) {
  const { campaign } = useCampaign();
  const snapshot = buildSnapshot(route, campaign);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow={route.label}
        title={`${route.label} Migration Queue`}
        description={snapshot.detail}
        actions={
          <Button component="a" href={getLegacyWorkspaceUrl(route.legacyTab)} color="moss">
            Open Legacy {route.label}
          </Button>
        }
      />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper className="km-panel metric-card">
            <Stack gap="sm">
              <Text className="metric-label">Current Snapshot</Text>
              <Title order={3}>{snapshot.primary}</Title>
              <Text c="dimmed">{snapshot.secondary}</Text>
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper className="km-panel">
            <Stack gap="md">
              <Text className="km-section-kicker">Migration Status</Text>
              <Badge color="brass" variant="light">
                Legacy workspace still active
              </Badge>
              <Text>
                The new shell keeps navigation, persistence, import/export, and the first campaign pages in React. This tab is still using the legacy workspace until its underlying workflows are ported.
              </Text>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
