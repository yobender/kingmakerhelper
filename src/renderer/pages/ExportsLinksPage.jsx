import { useMemo, useState } from "react";
import { Badge, Button, Grid, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as Tabs from "@radix-ui/react-tabs";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useCampaign } from "../context/CampaignContext";
import { buildExportsLinksModel } from "../lib/exportsLinks";

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}-${dateStamp()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ExportCard({ entry, active, onSelect, onExport }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`km-export-card${active ? " is-active" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="km-export-card__head">
        <span className="km-export-card__title">{stringValue(entry?.label) || "Export"}</span>
        <span className="km-export-card__meta">{`${Number(entry?.count || 0)} record${Number(entry?.count || 0) === 1 ? "" : "s"}`}</span>
      </span>
      <span className="km-export-card__summary">{stringValue(entry?.description)}</span>
      <span className="km-export-card__footer">
        <span className="km-companion-chip">JSON</span>
        <span className="km-companion-chip">Foundry</span>
      </span>
      <span className="km-export-card__actions">
        <Button size="xs" color="moss" onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onExport();
        }}>
          Export
        </Button>
      </span>
    </div>
  );
}

function BridgeExportCard({ entry, onExport }) {
  return (
    <Paper className="km-export-bridge-card">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div className="km-export-bridge-card__copy">
            <Text fw={700}>{stringValue(entry?.label) || "Bridge Export"}</Text>
            <Text size="sm" c="dimmed">
              {stringValue(entry?.fileName)}.json
            </Text>
          </div>
          <Badge color="moss" variant="light">
            Bridge
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {stringValue(entry?.description)}
        </Text>
        <Group gap="sm" className="km-toolbar-wrap">
          <Button size="xs" color="moss" onClick={onExport}>
            Export JSON
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default function ExportsLinksPage() {
  const navigate = useNavigate();
  const { campaign } = useCampaign();
  const model = useMemo(() => buildExportsLinksModel(campaign), [campaign]);
  const [activeTab, setActiveTab] = useState("foundry");
  const [selectedExportId, setSelectedExportId] = useState("full-pack");
  const [message, setMessage] = useState("");

  const foundryEntries = Object.values(model.foundryExports || {});
  const selectedExport = model.foundryExports?.[selectedExportId] || foundryEntries[0] || null;

  const exportData = (entry, title) => {
    if (!entry) return;
    downloadJson(entry.data, entry.fileName);
    const exportedCount = Array.isArray(entry.data) ? entry.data.length : 1;
    const notice = `${entry.label} exported as ${entry.fileName}-${dateStamp()}.json`;
    setMessage(notice);
    notifications.show({
      color: "moss",
      title,
      message: `${exportedCount} record${exportedCount === 1 ? "" : "s"} exported.`,
    });
  };

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Links"
        title="Exports & Links"
        description="Keep Kingmaker Companion standalone-first, then push clean exports outward when you want Foundry, DM Helper, or another workflow to consume current campaign state."
        actions={(
          <>
            <Button variant="default" onClick={() => navigate("/links/vault-sync")}>
              Open Vault Sync
            </Button>
            <Button color="moss" onClick={() => exportData(model.bridgeExports["bridge-pack"], "Bridge pack exported")}>
              Export Bridge Pack
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
        <Tabs.List className="km-radix-list" aria-label="Exports & Links views">
          <Tabs.Trigger value="foundry" className="km-radix-trigger">
            Foundry Packs
          </Tabs.Trigger>
          <Tabs.Trigger value="bridge" className="km-radix-trigger">
            Bridge Exports
          </Tabs.Trigger>
          <Tabs.Trigger value="workflow" className="km-radix-trigger">
            Link Workflow
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="foundry" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Paper className="km-panel km-content-panel km-export-foundry-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Foundry Export Catalog</Text>
                      <Title order={3}>Pack Builder</Title>
                    </div>
                    <Badge color="moss" variant="light">
                      {foundryEntries.length}
                    </Badge>
                  </Group>

                  <Text c="dimmed">
                    These exports are meant for import into Foundry as actors and journal-like reference content. They are not a live sync layer.
                  </Text>

                  <div className="km-export-card-list">
                    {foundryEntries.map((entry) => (
                      <ExportCard
                        key={entry.id}
                        entry={entry}
                        active={entry.id === selectedExport?.id}
                        onSelect={() => setSelectedExportId(entry.id)}
                        onExport={() => exportData(entry, "Foundry export ready")}
                      />
                    ))}
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Stack gap="lg">
                <Paper className="km-panel km-content-panel km-export-foundry-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Selected Pack</Text>
                        <Title order={3}>{selectedExport ? selectedExport.label : "No export selected"}</Title>
                      </div>
                      {selectedExport ? (
                        <Badge color="brass" variant="light">
                          {`${Number(selectedExport.count || 0)} records`}
                        </Badge>
                      ) : null}
                    </Group>

                    {selectedExport ? (
                      <>
                        <Text>{selectedExport.description}</Text>
                        <Paper className="km-record-card">
                          <Stack gap="xs">
                            <Text fw={700}>Filename</Text>
                            <Text size="sm" c="dimmed" className="km-export-filename">
                              {`${selectedExport.fileName}-${dateStamp()}.json`}
                            </Text>
                          </Stack>
                        </Paper>

                        <Group gap="sm" className="km-toolbar-wrap">
                          <Button color="moss" onClick={() => exportData(selectedExport, "Foundry export ready")}>
                            Export Selected Pack
                          </Button>
                          <Button variant="default" onClick={() => exportData(model.foundryExports["full-pack"], "Full Foundry pack exported")}>
                            Export Full Pack
                          </Button>
                        </Group>
                      </>
                    ) : (
                      <Text c="dimmed">Choose a Foundry export to inspect it here.</Text>
                    )}
                  </Stack>
                </Paper>

                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text className="km-section-kicker">Foundry Checklist</Text>
                        <Title order={3}>Import Order</Title>
                      </div>
                      <Badge color="moss" variant="light">
                        Recommended
                      </Badge>
                    </Group>

                    <div className="km-export-guide-list">
                      <Text component="div" size="sm" c="dimmed">
                        1. Create destination folders in Foundry before import.
                      </Text>
                      <Text component="div" size="sm" c="dimmed">
                        2. Import one smaller pack first, then verify journal formatting and actor naming.
                      </Text>
                      <Text component="div" size="sm" c="dimmed">
                        3. Only move to the full pack after one actor and one journal import cleanly.
                      </Text>
                      <Text component="div" size="sm" c="dimmed">
                        4. Regenerate exports after any major kingdom, quest, or hex-map update.
                      </Text>
                    </div>

                    <Text size="sm" c="dimmed">
                      {message || "Export status messages will appear here after you download a pack."}
                    </Text>
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="bridge" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Paper className="km-panel km-content-panel km-export-bridge-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Cross-Tool JSON</Text>
                      <Title order={3}>Bridge Exports</Title>
                    </div>
                    <Badge color="moss" variant="light">
                      {Object.keys(model.bridgeExports).length}
                    </Badge>
                  </Group>

                  <Text c="dimmed">
                    Use these when another tool needs structured state from the standalone Kingmaker app but should not become the authoritative source of truth.
                  </Text>

                  <div className="km-export-bridge-list">
                    {Object.values(model.bridgeExports).map((entry) => (
                      <BridgeExportCard key={entry.id} entry={entry} onExport={() => exportData(entry, "Bridge export ready")} />
                    ))}
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Stack gap="lg">
                <Paper className="km-panel km-content-panel km-export-bridge-panel">
                  <Stack gap="md">
                    <div>
                      <Text className="km-section-kicker">Use Cases</Text>
                      <Title order={3}>Which Export To Use</Title>
                    </div>

                    <Paper className="km-record-card">
                      <Stack gap="xs">
                        <Text fw={700}>Campaign Snapshot JSON</Text>
                        <Text size="sm" c="dimmed">
                          Use for exact backups and full-fidelity handoff into another Kingmaker Companion instance.
                        </Text>
                      </Stack>
                    </Paper>

                    <Paper className="km-record-card">
                      <Stack gap="xs">
                        <Text fw={700}>Bridge Pack JSON</Text>
                        <Text size="sm" c="dimmed">
                          Use for DM Helper or any external tool that only needs the current frontier state, not every historical note.
                        </Text>
                      </Stack>
                    </Paper>

                    <Paper className="km-record-card">
                      <Stack gap="xs">
                        <Text fw={700}>Latest Session Handoff</Text>
                        <Text size="sm" c="dimmed">
                          Use when you are moving tonight’s prep into another workspace and only need the immediate play surface.
                        </Text>
                      </Stack>
                    </Paper>
                  </Stack>
                </Paper>

                <Paper className="km-panel km-content-panel">
                  <Stack gap="md">
                    <div>
                      <Text className="km-section-kicker">Bridge Principle</Text>
                      <Title order={3}>Standalone First</Title>
                    </div>
                    <Text size="sm" c="dimmed">
                      Kingmaker Companion stays authoritative. External tools should consume exports or vault markdown rather than expecting shared runtime state.
                    </Text>
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="workflow" className="km-radix-content">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Link Targets</Text>
                      <Title order={3}>Workflow Cards</Title>
                    </div>
                    <Badge color="brass" variant="light">
                      {model.linkCards.length}
                    </Badge>
                  </Group>

                  <div className="km-export-workflow-list">
                    {model.linkCards.map((card) => (
                      <Paper key={card.id} className="km-export-workflow-card">
                        <Stack gap="xs">
                          <Text fw={700}>{card.title}</Text>
                          <Text size="sm" c="dimmed">
                            {card.body}
                          </Text>
                        </Stack>
                      </Paper>
                    ))}
                  </div>

                  <Group gap="sm" className="km-toolbar-wrap">
                    <Button variant="default" onClick={() => navigate("/links/vault-sync")}>
                      Open Vault Sync
                    </Button>
                    <Button variant="default" onClick={() => navigate("/campaign/adventure-log")}>
                      Open Adventure Log
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 6 }}>
              <Paper className="km-panel km-content-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className="km-section-kicker">Checklist</Text>
                      <Title order={3}>Before You Link Another Tool</Title>
                    </div>
                    <Badge color="moss" variant="light">
                      Review
                    </Badge>
                  </Group>

                  <div className="km-export-guide-list">
                    {model.importChecklist.map((entry) => (
                      <Text key={entry} component="div" size="sm" c="dimmed">
                        {entry}
                      </Text>
                    ))}
                  </div>

                  <Paper className="km-record-card">
                    <Text size="sm" c="dimmed">
                      Use Foundry exports for VTT-facing actors and journals, Bridge Pack JSON for lightweight app integrations, and Vault Sync when markdown should remain readable and searchable outside the app.
                    </Text>
                  </Paper>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
