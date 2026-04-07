import { useRef } from "react";
import { AppShell, Center, Loader, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppSidebar from "./components/AppSidebar";
import ShellHeader from "./components/ShellHeader";
import WorkspaceStrip from "./components/WorkspaceStrip";
import { CampaignProvider, useCampaign } from "./context/CampaignContext";
import { getRouteByPath, ALL_ROUTES } from "./lib/routes";
import { formatGolarionDate } from "./lib/golarion";
import { readableError } from "./lib/campaignState";
import AdventureLogPage from "./pages/AdventureLogPage";
import CommandCenterPage from "./pages/CommandCenterPage";
import CompanionsPage from "./pages/CompanionsPage";
import EventsPage from "./pages/EventsPage";
import HexMapPage from "./pages/HexMapPage";
import KingdomPage from "./pages/KingdomPage";
import LocationsPage from "./pages/LocationsPage";
import NpcsPage from "./pages/NpcsPage";
import QuestsPage from "./pages/QuestsPage";
import RulesReferencePage from "./pages/RulesReferencePage";
import SceneForgePage from "./pages/SceneForgePage";
import SourceLibraryPage from "./pages/SourceLibraryPage";
import TableNotesPage from "./pages/TableNotesPage";
import ExportsLinksPage from "./pages/ExportsLinksPage";
import VaultSyncPage from "./pages/VaultSyncPage";
import SettingsPage from "./pages/SettingsPage";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <CampaignProvider>
      <AppFrame />
    </CampaignProvider>
  );
}

function AppFrame() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();
  const route = getRouteByPath(location.pathname) || ALL_ROUTES[0];
  const importRef = useRef(null);
  const { campaign, desktopApi, isHydrating, lastSavedAt, persistenceError, actions } = useCampaign();

  const handleExport = () => {
    const fileName = `kingmaker-companion-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(campaign, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    notifications.show({
      color: "moss",
      title: "Campaign exported",
      message: `${campaign.meta?.campaignName || "Kingmaker"} was exported to JSON.`,
    });
  };

  const handleImport = () => {
    importRef.current?.click();
  };

  const handleImportChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      actions.importCampaign(JSON.parse(raw));
      notifications.show({
        color: "moss",
        title: "Campaign imported",
        message: `${file.name} was loaded into Kingmaker Companion.`,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Import failed",
        message: readableError(error),
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleReset = () => {
    if (!window.confirm("Replace the current campaign with the starter Kingmaker state?")) return;
    actions.resetCampaign();
    notifications.show({
      color: "moss",
      title: "Starter state loaded",
      message: "The campaign was reset to the Kingmaker starter data.",
    });
  };

  return (
    <>
      <AppShell
        padding="md"
        header={{ height: 78 }}
        navbar={{ width: 292, breakpoint: "sm", collapsed: { mobile: !opened } }}
        className="km-shell"
      >
        <AppShell.Header className="km-header">
          <ShellHeader
            opened={opened}
            toggle={toggle}
            campaignName={campaign.meta?.campaignName || "Kingmaker"}
            currentDateLabel={formatGolarionDate(campaign.kingdom?.currentDate)}
            pageTitle={route.label}
            routeGroup={route.groupLabel}
            lastSavedAt={lastSavedAt}
            persistenceError={persistenceError}
            isDesktop={Boolean(desktopApi)}
          />
        </AppShell.Header>

        <AppShell.Navbar className="km-navbar">
          <AppSidebar campaignName={campaign.meta?.campaignName || "Kingmaker"} onNavigate={close} />
        </AppShell.Navbar>

        <AppShell.Main className="km-main km-main--workspace">
          {isHydrating ? (
            <Center className="km-loading-shell">
              <Stack align="center" gap="sm">
                <Loader color="moss" size="lg" />
                <Text c="dimmed">Loading your Kingmaker campaign...</Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="md" className="km-main-stack">
              <WorkspaceStrip
                campaignName={campaign.meta?.campaignName || "Kingmaker"}
                sectionLabel={route.groupLabel}
                pageTitle={route.label}
              />

              <Routes>
                <Route path="/" element={<Navigate to="/campaign/command-center" replace />} />
                <Route path="/campaign/command-center" element={<CommandCenterPage />} />
                <Route path="/campaign/adventure-log" element={<AdventureLogPage />} />
                <Route path="/campaign/table-notes" element={<TableNotesPage />} />
                <Route path="/campaign/scene-forge" element={<SceneForgePage />} />
                <Route path="/world/kingdom" element={<KingdomPage />} />
                <Route path="/world/hex-map" element={<HexMapPage />} />
                <Route path="/world/companions" element={<CompanionsPage />} />
                <Route path="/world/events" element={<EventsPage />} />
                <Route path="/world/npcs" element={<NpcsPage />} />
                <Route path="/world/quests" element={<QuestsPage />} />
                <Route path="/world/locations" element={<LocationsPage />} />
                <Route path="/reference/rules" element={<RulesReferencePage />} />
                <Route path="/reference/source-library" element={<SourceLibraryPage />} />
                <Route path="/links/vault-sync" element={<VaultSyncPage />} />
                <Route path="/links/exports" element={<ExportsLinksPage />} />
                <Route path="/system/settings" element={<SettingsPage onExport={handleExport} onImport={handleImport} onReset={handleReset} />} />
                {ALL_ROUTES.filter((entry) => entry.status !== "rebuilt").map((entry) => (
                  <Route key={entry.path} path={entry.path} element={<PlaceholderPage route={entry} />} />
                ))}
                <Route path="*" element={<Navigate to="/campaign/command-center" replace />} />
              </Routes>
            </Stack>
          )}
        </AppShell.Main>
      </AppShell>

      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleImportChange}
      />
    </>
  );
}
