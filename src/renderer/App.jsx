import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, Center, Loader, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import {
  IconArrowBackUp,
  IconArrowsExchange,
  IconClockHour4,
  IconDownload,
  IconFolders,
  IconLayoutBoardSplit,
  IconLayoutSidebarLeftCollapse,
  IconPin,
  IconUpload,
} from "@tabler/icons-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "./components/AppSidebar";
import CommandPalette from "./components/CommandPalette";
import ObsidianRibbon from "./components/ObsidianRibbon";
import ShellHeader from "./components/ShellHeader";
import WorkspacePane from "./components/WorkspacePane";
import WorkspaceStrip from "./components/WorkspaceStrip";
import { CampaignProvider, useCampaign } from "./context/CampaignContext";
import {
  getPrimaryNavItemForPath,
  getRouteByPath,
  getRoutesForPrimaryNavItem,
  ALL_ROUTES,
  PRIMARY_NAV_ITEMS,
} from "./lib/routes";
import { formatGolarionDate } from "./lib/golarion";
import { readableError } from "./lib/campaignState";
import { getLegacyWorkspaceUrl } from "./lib/desktop";
const AdventureLogPage = lazy(() => import("./pages/AdventureLogPage"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const CommandCenterPage = lazy(() => import("./pages/CommandCenterPage"));
const CompanionsPage = lazy(() => import("./pages/CompanionsPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const HexMapPage = lazy(() => import("./pages/HexMapPage"));
const KingdomPage = lazy(() => import("./pages/KingdomPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const NpcsPage = lazy(() => import("./pages/NpcsPage"));
const QuestsPage = lazy(() => import("./pages/QuestsPage"));
const RunKingmakerPage = lazy(() => import("./pages/RunKingmakerPage"));
const RulesReferencePage = lazy(() => import("./pages/RulesReferencePage"));
const SceneForgePage = lazy(() => import("./pages/SceneForgePage"));
const SourceLibraryPage = lazy(() => import("./pages/SourceLibraryPage"));
const TableNotesPage = lazy(() => import("./pages/TableNotesPage"));
const ExportsLinksPage = lazy(() => import("./pages/ExportsLinksPage"));
const VaultSyncPage = lazy(() => import("./pages/VaultSyncPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage"));

const OPEN_TABS_STORAGE_KEY = "kingmaker-companion.shell-open-tabs.v1";
const PINNED_TABS_STORAGE_KEY = "kingmaker-companion.shell-pinned-tabs.v1";
const RECENT_ROUTES_STORAGE_KEY = "kingmaker-companion.shell-recent-routes.v1";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "kingmaker-companion.shell-sidebar-collapsed.v1";
const SIDEBAR_WIDTH_STORAGE_KEY = "kingmaker-companion.shell-sidebar-width.v1";
const SIDEBAR_MODE_STORAGE_KEY = "kingmaker-companion.shell-sidebar-mode.v1";
const SPLIT_MODE_STORAGE_KEY = "kingmaker-companion.shell-split-open.v1";
const SPLIT_SECONDARY_PATH_STORAGE_KEY = "kingmaker-companion.shell-split-secondary-path.v1";
const SPLIT_RATIO_STORAGE_KEY = "kingmaker-companion.shell-split-ratio.v1";
const ACTIVE_PANE_STORAGE_KEY = "kingmaker-companion.shell-active-pane.v1";
const DEFAULT_SECONDARY_PATH = "/reference/source-library";
const SIDEBAR_MODES = ["explorer", "pinned", "recent", "workspace"];
const DEFAULT_SHELL_SIDEBAR_WIDTH = 196;
const MIN_SHELL_SIDEBAR_WIDTH = 152;
const MAX_SHELL_SIDEBAR_WIDTH = 320;
const SHELL_SIDEBAR_COLLAPSED_WIDTH = 56;
const PAGE_VISUAL_THEMES = Object.freeze({
  run: {
    accent: "#d5aa55",
    accent2: "#5e8d58",
    glow: "rgba(213, 170, 85, 0.24)",
    glow2: "rgba(94, 141, 88, 0.2)",
    spot: "rgba(248, 226, 176, 0.54)",
  },
  dashboard: {
    accent: "#c69a43",
    accent2: "#4f7f48",
    glow: "rgba(79, 127, 72, 0.34)",
    glow2: "rgba(198, 154, 67, 0.2)",
    spot: "rgba(239, 215, 158, 0.68)",
  },
  sessions: {
    accent: "#6f9aa6",
    accent2: "#c69a43",
    glow: "rgba(111, 154, 166, 0.22)",
    glow2: "rgba(198, 154, 67, 0.14)",
    spot: "rgba(204, 226, 224, 0.48)",
  },
  capture: {
    accent: "#9f5b42",
    accent2: "#d6b167",
    glow: "rgba(159, 91, 66, 0.22)",
    glow2: "rgba(214, 177, 103, 0.14)",
    spot: "rgba(236, 205, 160, 0.45)",
  },
  writing: {
    accent: "#b98545",
    accent2: "#7f9f72",
    glow: "rgba(185, 133, 69, 0.22)",
    glow2: "rgba(127, 159, 114, 0.13)",
    spot: "rgba(235, 207, 164, 0.46)",
  },
  kingdom: {
    accent: "#cfa44e",
    accent2: "#486f3f",
    glow: "rgba(207, 164, 78, 0.24)",
    glow2: "rgba(72, 111, 63, 0.16)",
    spot: "rgba(246, 224, 170, 0.5)",
  },
  hexmap: {
    accent: "#5f8a55",
    accent2: "#6d9ba4",
    glow: "rgba(95, 138, 85, 0.24)",
    glow2: "rgba(109, 155, 164, 0.14)",
    spot: "rgba(204, 228, 190, 0.45)",
  },
  companions: {
    accent: "#b87848",
    accent2: "#6f9aa6",
    glow: "rgba(184, 120, 72, 0.22)",
    glow2: "rgba(111, 154, 166, 0.13)",
    spot: "rgba(236, 200, 159, 0.44)",
  },
  events: {
    accent: "#9b4a39",
    accent2: "#c79a43",
    glow: "rgba(155, 74, 57, 0.22)",
    glow2: "rgba(199, 154, 67, 0.13)",
    spot: "rgba(231, 183, 150, 0.42)",
  },
  npcs: {
    accent: "#a57948",
    accent2: "#719ba5",
    glow: "rgba(165, 121, 72, 0.2)",
    glow2: "rgba(113, 155, 165, 0.12)",
    spot: "rgba(232, 204, 167, 0.44)",
  },
  quests: {
    accent: "#c18a42",
    accent2: "#577f47",
    glow: "rgba(193, 138, 66, 0.22)",
    glow2: "rgba(87, 127, 71, 0.13)",
    spot: "rgba(236, 205, 158, 0.44)",
  },
  locations: {
    accent: "#638b56",
    accent2: "#b88c43",
    glow: "rgba(99, 139, 86, 0.22)",
    glow2: "rgba(184, 140, 67, 0.13)",
    spot: "rgba(206, 228, 190, 0.42)",
  },
  rules: {
    accent: "#6f9aa6",
    accent2: "#d1aa5d",
    glow: "rgba(111, 154, 166, 0.2)",
    glow2: "rgba(209, 170, 93, 0.13)",
    spot: "rgba(205, 225, 222, 0.44)",
  },
  "ai-chat": {
    accent: "#6d9f86",
    accent2: "#c49b4a",
    glow: "rgba(109, 159, 134, 0.22)",
    glow2: "rgba(196, 155, 74, 0.13)",
    spot: "rgba(205, 230, 211, 0.42)",
  },
  pdf: {
    accent: "#ba8b48",
    accent2: "#709ba6",
    glow: "rgba(186, 139, 72, 0.2)",
    glow2: "rgba(112, 155, 166, 0.12)",
    spot: "rgba(235, 205, 166, 0.45)",
  },
  "ai-rag": {
    accent: "#5f8f76",
    accent2: "#c69a43",
    glow: "rgba(95, 143, 118, 0.2)",
    glow2: "rgba(198, 154, 67, 0.13)",
    spot: "rgba(204, 228, 213, 0.42)",
  },
  obsidian: {
    accent: "#8fa65d",
    accent2: "#b88f49",
    glow: "rgba(143, 166, 93, 0.18)",
    glow2: "rgba(184, 143, 73, 0.13)",
    spot: "rgba(224, 231, 184, 0.4)",
  },
  foundry: {
    accent: "#9f5b42",
    accent2: "#6f9a7a",
    glow: "rgba(159, 91, 66, 0.2)",
    glow2: "rgba(111, 154, 122, 0.12)",
    spot: "rgba(231, 193, 160, 0.42)",
  },
  settings: {
    accent: "#7891a0",
    accent2: "#c69a43",
    glow: "rgba(120, 145, 160, 0.18)",
    glow2: "rgba(198, 154, 67, 0.13)",
    spot: "rgba(216, 224, 224, 0.42)",
  },
});

function WorkspaceLoadingFallback({ label = "Loading workspace..." }) {
  return (
    <Center className="km-loading-shell">
      <Stack align="center" gap="sm">
        <Loader color="moss" size="lg" />
        <Text c="dimmed">{label}</Text>
      </Stack>
    </Center>
  );
}

function readStoredRoutePaths(storageKey) {
  try {
    if (typeof window === "undefined") return [];
    const raw = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(raw)) return [];
    return Array.from(new Set(raw.filter((path) => typeof path === "string" && getRouteByPath(path))));
  } catch {
    return [];
  }
}

function writeStoredValue(storageKey, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore local storage write failures in restricted environments.
  }
}

function readStoredBoolean(storageKey, fallback = false) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(storageKey);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function readStoredString(storageKey, fallback = "") {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(storageKey);
    return typeof raw === "string" && raw.length ? raw : fallback;
  } catch {
    return fallback;
  }
}

function readStoredNumber(storageKey, fallback, min, max) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = Number(window.localStorage.getItem(storageKey));
    if (Number.isNaN(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
  } catch {
    return fallback;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSidebarMode(value) {
  return SIDEBAR_MODES.includes(value) ? value : "explorer";
}

function toShellClassSegment(value, fallback = "campaign") {
  return (
    String(value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

export default function App() {
  return (
    <CampaignProvider>
      <AppFrame />
    </CampaignProvider>
  );
}

function AppFrame() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [paletteOpened, { open: openPalette, close: closePalette }] = useDisclosure(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => readStoredBoolean(SIDEBAR_COLLAPSED_STORAGE_KEY, false));
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredNumber(SIDEBAR_WIDTH_STORAGE_KEY, DEFAULT_SHELL_SIDEBAR_WIDTH, MIN_SHELL_SIDEBAR_WIDTH, MAX_SHELL_SIDEBAR_WIDTH),
  );
  const [sidebarMode, setSidebarMode] = useState(() => normalizeSidebarMode(readStoredString(SIDEBAR_MODE_STORAGE_KEY, "explorer")));
  const [openTabPaths, setOpenTabPaths] = useState(() => readStoredRoutePaths(OPEN_TABS_STORAGE_KEY));
  const [pinnedTabPaths, setPinnedTabPaths] = useState(() => readStoredRoutePaths(PINNED_TABS_STORAGE_KEY));
  const [recentRoutePaths, setRecentRoutePaths] = useState(() => readStoredRoutePaths(RECENT_ROUTES_STORAGE_KEY));
  const [splitOpen, setSplitOpen] = useState(() => readStoredBoolean(SPLIT_MODE_STORAGE_KEY, false));
  const [secondaryPath, setSecondaryPath] = useState(() => {
    const stored = readStoredString(SPLIT_SECONDARY_PATH_STORAGE_KEY, DEFAULT_SECONDARY_PATH);
    return getRouteByPath(stored)?.path || DEFAULT_SECONDARY_PATH;
  });
  const [activePane, setActivePane] = useState(() => (readStoredString(ACTIVE_PANE_STORAGE_KEY, "primary") === "secondary" ? "secondary" : "primary"));
  const [splitRatio, setSplitRatio] = useState(() => readStoredNumber(SPLIT_RATIO_STORAGE_KEY, 0.56, 0.34, 0.68));
  const location = useLocation();
  const navigate = useNavigate();
  const route = getRouteByPath(location.pathname) || ALL_ROUTES[0];
  const importRef = useRef(null);
  const splitLayoutRef = useRef(null);
  const navbarShellRef = useRef(null);
  const splitDragActiveRef = useRef(false);
  const sidebarDragActiveRef = useRef(false);
  const { campaign, desktopApi, isHydrating, lastSavedAt, persistenceError, actions } = useCampaign();

  const normalizedSecondaryPath = getRouteByPath(secondaryPath)?.path || DEFAULT_SECONDARY_PATH;
  const effectiveActivePane = splitOpen ? activePane : "primary";
  const activeWorkspacePath = effectiveActivePane === "secondary" ? normalizedSecondaryPath : route.path;
  const activeThemeRoute = getRouteByPath(activeWorkspacePath) || route;
  const activePrimaryNavItem = getPrimaryNavItemForPath(activeWorkspacePath);
  const activePrimaryPath = activePrimaryNavItem?.path || route.path;
  const activeSectionRoutes = getRoutesForPrimaryNavItem(activePrimaryNavItem);
  const isHomeRoute = activeThemeRoute?.id === "dashboard" || activeThemeRoute?.id === "run";
  const pageVisualTheme = PAGE_VISUAL_THEMES[activeThemeRoute?.id] || PAGE_VISUAL_THEMES.dashboard;
  const pageThemeStyle = {
    "--km-page-accent": pageVisualTheme.accent,
    "--km-page-accent-2": pageVisualTheme.accent2,
    "--km-page-glow": pageVisualTheme.glow,
    "--km-page-glow-2": pageVisualTheme.glow2,
    "--km-page-spot": pageVisualTheme.spot,
  };
  const shellPageClass = [
    "km-shell",
    "km-shell--soft",
    `km-page-${toShellClassSegment(activeThemeRoute?.id, "dashboard")}`,
    `km-group-${toShellClassSegment(activeThemeRoute?.groupLabel, "campaign")}`,
    isHomeRoute ? "km-shell--home km-shell--landing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const trackWorkspacePath = (path) => {
    if (!path || !getRouteByPath(path)) return;
    setOpenTabPaths((current) => (current.includes(path) ? current : [...current, path].slice(-14)));
    setRecentRoutePaths((current) => [path, ...current.filter((entry) => entry !== path)].slice(0, 12));
  };

  const getAlternateRoutePath = (...excludedPaths) => {
    const excluded = new Set(excludedPaths.filter(Boolean));
    const candidates = [...recentRoutePaths, ...openTabPaths, ...ALL_ROUTES.map((entry) => entry.path)];
    return candidates.find((path) => !excluded.has(path) && getRouteByPath(path)) || DEFAULT_SECONDARY_PATH;
  };

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

  const handleOpenRoute = (path, targetPane = splitOpen ? effectiveActivePane : "primary") => {
    const cleanPath = getRouteByPath(path)?.path;
    if (!cleanPath) return;

    if (cleanPath === route.path) {
      setActivePane("primary");
      close();
      return;
    }

    if (splitOpen && cleanPath === normalizedSecondaryPath) {
      setActivePane("secondary");
      close();
      return;
    }

    if (targetPane === "secondary") {
      setSplitOpen(true);
      setSecondaryPath(cleanPath);
      setActivePane("secondary");
      close();
      return;
    }

    navigate(cleanPath);
    setActivePane("primary");
    close();
  };

  const handleOpenPalette = (paneKey = effectiveActivePane) => {
    setActivePane(splitOpen ? paneKey : "primary");
    setPaletteQuery("");
    openPalette();
  };

  const handleToggleSplit = () => {
    if (splitOpen) {
      setSplitOpen(false);
      setActivePane("primary");
      return;
    }

    const nextPath = getAlternateRoutePath(route.path);
    setSecondaryPath(nextPath);
    setSplitOpen(true);
    setActivePane("secondary");
  };

  const handleCloseSplit = () => {
    setSplitOpen(false);
    setActivePane("primary");
  };

  const handleSwapPanes = () => {
    if (!splitOpen) return;
    const primaryPath = route.path;
    const secondaryRoutePath = normalizedSecondaryPath;
    if (primaryPath === secondaryRoutePath) return;
    setSecondaryPath(primaryPath);
    navigate(secondaryRoutePath);
  };

  const handleCloseTab = (path) => {
    setOpenTabPaths((current) => current.filter((entryPath) => entryPath !== path));

    if (splitOpen && normalizedSecondaryPath === path) {
      const fallback = getAlternateRoutePath(route.path, path);
      if (fallback && fallback !== route.path) {
        setSecondaryPath(fallback);
      } else {
        setSplitOpen(false);
        setActivePane("primary");
      }
    }

    if (route.path === path) {
      const fallback = getAlternateRoutePath(splitOpen ? normalizedSecondaryPath : "", path);
      navigate(fallback || "/campaign/command-center");
      setActivePane("primary");
    }
  };

  const handleTogglePin = () => {
    const currentPath = activeWorkspacePath;
    setPinnedTabPaths((current) =>
      current.includes(currentPath) ? current.filter((path) => path !== currentPath) : [...current, currentPath].slice(-8),
    );
  };

  const handleSelectSidebarMode = (nextMode) => {
    setSidebarMode(normalizeSidebarMode(nextMode));
    if (desktopSidebarCollapsed) {
      setDesktopSidebarCollapsed(false);
    }
  };

  const handleExecuteCommand = (command) => {
    closePalette();
    setPaletteQuery("");
    command.action?.();
  };

  const handleSplitResizeStart = (event) => {
    if (!splitOpen) return;
    event.preventDefault();
    splitDragActiveRef.current = true;
    document.body.classList.add("km-is-resizing");
  };

  const handleSidebarResizeStart = (event) => {
    if (desktopSidebarCollapsed) return;
    event.preventDefault();
    sidebarDragActiveRef.current = true;
    document.body.classList.add("km-is-resizing");
  };

  useEffect(() => {
    trackWorkspacePath(route.path);
  }, [route.path]);

  useEffect(() => {
    if (!splitOpen) return;
    trackWorkspacePath(normalizedSecondaryPath);
  }, [splitOpen, normalizedSecondaryPath]);

  useEffect(() => {
    if (!splitOpen && activePane !== "primary") {
      setActivePane("primary");
    }
  }, [splitOpen, activePane]);

  useEffect(() => {
    writeStoredValue(OPEN_TABS_STORAGE_KEY, openTabPaths);
  }, [openTabPaths]);

  useEffect(() => {
    writeStoredValue(PINNED_TABS_STORAGE_KEY, pinnedTabPaths);
  }, [pinnedTabPaths]);

  useEffect(() => {
    writeStoredValue(RECENT_ROUTES_STORAGE_KEY, recentRoutePaths);
  }, [recentRoutePaths]);

  useEffect(() => {
    writeStoredValue(SIDEBAR_COLLAPSED_STORAGE_KEY, desktopSidebarCollapsed);
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    writeStoredValue(SIDEBAR_WIDTH_STORAGE_KEY, sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    writeStoredValue(SIDEBAR_MODE_STORAGE_KEY, sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    writeStoredValue(SPLIT_MODE_STORAGE_KEY, splitOpen);
  }, [splitOpen]);

  useEffect(() => {
    writeStoredValue(SPLIT_SECONDARY_PATH_STORAGE_KEY, normalizedSecondaryPath);
  }, [normalizedSecondaryPath]);

  useEffect(() => {
    writeStoredValue(ACTIVE_PANE_STORAGE_KEY, effectiveActivePane);
  }, [effectiveActivePane]);

  useEffect(() => {
    writeStoredValue(SPLIT_RATIO_STORAGE_KEY, splitRatio);
  }, [splitRatio]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (sidebarDragActiveRef.current && navbarShellRef.current) {
        const rect = navbarShellRef.current.getBoundingClientRect();
        if (rect.width) {
          const nextWidth = clamp(event.clientX - rect.left, MIN_SHELL_SIDEBAR_WIDTH, MAX_SHELL_SIDEBAR_WIDTH);
          setSidebarWidth(Math.round(nextWidth));
        }
      }

      if (splitDragActiveRef.current && splitLayoutRef.current) {
        const rect = splitLayoutRef.current.getBoundingClientRect();
        if (!rect.width) return;
        const nextRatio = clamp((event.clientX - rect.left) / rect.width, 0.34, 0.68);
        setSplitRatio(Number(nextRatio.toFixed(4)));
      }
    };

    const finishResize = () => {
      if (!splitDragActiveRef.current && !sidebarDragActiveRef.current) return;
      splitDragActiveRef.current = false;
      sidebarDragActiveRef.current = false;
      document.body.classList.remove("km-is-resizing");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      document.body.classList.remove("km-is-resizing");
    };
  }, []);

  useHotkeys([
    ["mod+P", (event) => {
      event.preventDefault();
      handleOpenPalette();
    }],
    ["mod+K", (event) => {
      event.preventDefault();
      handleOpenPalette();
    }],
    ["mod+\\", (event) => {
      event.preventDefault();
      setDesktopSidebarCollapsed((current) => !current);
    }],
    ["mod+alt+\\", (event) => {
      event.preventDefault();
      handleToggleSplit();
    }],
  ]);

  const visibleTabRoutes = useMemo(() => {
    const orderedPaths = [...pinnedTabPaths, ...openTabPaths];
    const deduped = Array.from(new Set(orderedPaths.filter((path) => getRouteByPath(path))));
    if (route?.path && !deduped.includes(route.path)) {
      deduped.push(route.path);
    }
    if (splitOpen && normalizedSecondaryPath && !deduped.includes(normalizedSecondaryPath)) {
      deduped.push(normalizedSecondaryPath);
    }
    return deduped.map((path) => getRouteByPath(path)).filter(Boolean);
  }, [openTabPaths, pinnedTabPaths, route?.path, splitOpen, normalizedSecondaryPath]);

  const pinnedRouteEntries = useMemo(() => pinnedTabPaths.map((path) => getRouteByPath(path)).filter(Boolean).slice(0, 6), [pinnedTabPaths]);

  const recentRouteEntries = useMemo(
    () =>
      recentRoutePaths
        .filter((path) => !pinnedTabPaths.includes(path))
        .map((path) => getRouteByPath(path))
        .filter(Boolean)
        .slice(0, 8),
    [recentRoutePaths, pinnedTabPaths],
  );

  const openRouteEntries = useMemo(() => visibleTabRoutes.slice(0, 12), [visibleTabRoutes]);

  const sidebarTools = useMemo(
    () => [
      { id: "explorer", label: "Explorer", icon: IconFolders },
      { id: "pinned", label: "Pinned", icon: IconPin },
      { id: "recent", label: "Recent", icon: IconClockHour4 },
      { id: "workspace", label: "Workspaces", icon: IconLayoutBoardSplit },
    ],
    [],
  );

  const commandEntries = useMemo(
    () => [
      {
        id: "command:sidebar-explorer",
        label: "Show explorer",
        description: "Open the vault explorer in the left sidebar.",
        group: "Workspace",
        icon: IconFolders,
        keywords: "explorer vault navigation pages",
        action: () => handleSelectSidebarMode("explorer"),
      },
      {
        id: "command:sidebar-pinned",
        label: "Show pinned",
        description: "Open the pinned pages panel in the left sidebar.",
        group: "Workspace",
        icon: IconPin,
        keywords: "pinned favorites starred sidebar",
        action: () => handleSelectSidebarMode("pinned"),
      },
      {
        id: "command:sidebar-recent",
        label: "Show recent",
        description: "Open the recent pages panel in the left sidebar.",
        group: "Workspace",
        icon: IconClockHour4,
        keywords: "recent history sidebar",
        action: () => handleSelectSidebarMode("recent"),
      },
      {
        id: "command:sidebar-workspace",
        label: "Show workspaces",
        description: "Open the pane and open-tab overview in the left sidebar.",
        group: "Workspace",
        icon: IconLayoutBoardSplit,
        keywords: "workspace open tabs split panes sidebar",
        action: () => handleSelectSidebarMode("workspace"),
      },
      {
        id: "command:toggle-sidebar",
        label: desktopSidebarCollapsed ? "Expand navigation" : "Collapse navigation",
        description: "Show or hide the left vault explorer.",
        group: "Workspace",
        icon: IconLayoutSidebarLeftCollapse,
        shortcut: "Ctrl+\\",
        keywords: "sidebar ribbon explorer panel",
        action: () => setDesktopSidebarCollapsed((current) => !current),
      },
      {
        id: "command:toggle-split",
        label: splitOpen ? "Close split view" : "Open split view",
        description: "Toggle the two-pane workspace layout.",
        group: "Workspace",
        icon: IconArrowsExchange,
        shortcut: "Ctrl+Alt+\\",
        keywords: "split pane side by side right pane left pane",
        action: handleToggleSplit,
      },
      ...(splitOpen
        ? [
            {
              id: "command:swap-panes",
              label: "Swap split panes",
              description: "Exchange the current left and right workspace pages.",
              group: "Workspace",
              icon: IconArrowsExchange,
              keywords: "swap panes left right",
              action: handleSwapPanes,
            },
          ]
        : []),
      {
        id: "command:pin-current",
        label: pinnedTabPaths.includes(activeWorkspacePath) ? "Unpin active tab" : "Pin active tab",
        description: "Keep the active workspace tab anchored in the strip.",
        group: "Workspace",
        icon: IconPin,
        keywords: "pin tab workspace active page",
        action: handleTogglePin,
      },
      {
        id: "command:export",
        label: "Export campaign JSON",
        description: "Save the current campaign snapshot to a JSON file.",
        group: "Data",
        icon: IconDownload,
        keywords: "export backup snapshot json",
        action: handleExport,
      },
      {
        id: "command:import",
        label: "Import campaign JSON",
        description: "Load a saved campaign snapshot into the app.",
        group: "Data",
        icon: IconUpload,
        keywords: "import restore json snapshot",
        action: handleImport,
      },
      {
        id: "command:reset",
        label: "Load starter state",
        description: "Replace the current campaign with the starter Kingmaker setup.",
        group: "Data",
        icon: IconArrowBackUp,
        keywords: "reset starter state demo data",
        action: handleReset,
      },
      {
        id: "command:legacy",
        label: "Open legacy workspace",
        description: "Switch this window to the legacy shell.",
        group: "Links",
        icon: IconArrowsExchange,
        keywords: "legacy old workspace previous shell",
        action: () => {
          window.location.href = getLegacyWorkspaceUrl();
        },
      },
      ...ALL_ROUTES.map((entry) => ({
        id: `route:${entry.path}`,
        label: entry.label,
        description: entry.description,
        group: `${entry.groupLabel} / ${effectiveActivePane === "secondary" ? "Right pane" : "Left pane"}`,
        icon: entry.icon,
        keywords: `${entry.groupLabel} ${entry.label} ${entry.description} split pane right left`,
        action: () => handleOpenRoute(entry.path),
      })),
    ],
    [
      activeWorkspacePath,
      desktopSidebarCollapsed,
      effectiveActivePane,
      handleSelectSidebarMode,
      handleTogglePin,
      pinnedTabPaths,
      splitOpen,
      route.path,
      normalizedSecondaryPath,
      recentRoutePaths,
      openTabPaths,
      splitRatio,
    ],
  );

  const renderWorkspaceElement = (path) => {
    switch (path) {
      case "/campaign/run":
        return <RunKingmakerPage />;
      case "/campaign/command-center":
        return <CommandCenterPage />;
      case "/campaign/adventure-log":
        return <AdventureLogPage />;
      case "/campaign/table-notes":
        return <TableNotesPage />;
      case "/campaign/scene-forge":
        return <SceneForgePage />;
      case "/world/kingdom":
        return <KingdomPage />;
      case "/world/hex-map":
        return <HexMapPage />;
      case "/world/companions":
        return <CompanionsPage />;
      case "/world/events":
        return <EventsPage />;
      case "/world/npcs":
        return <NpcsPage />;
      case "/world/quests":
        return <QuestsPage />;
      case "/world/locations":
        return <LocationsPage />;
      case "/reference/rules":
        return <RulesReferencePage />;
      case "/reference/ai-chat":
        return <AIChatPage />;
      case "/reference/source-library":
        return <SourceLibraryPage />;
      case "/reference/ai-rag":
        return <SettingsPage onExport={handleExport} onImport={handleImport} onReset={handleReset} initialTab="ai" />;
      case "/links/vault-sync":
        return <VaultSyncPage />;
      case "/links/exports":
        return <ExportsLinksPage />;
      case "/system/settings":
        return <SettingsPage onExport={handleExport} onImport={handleImport} onReset={handleReset} />;
      case "/system/ai-rag":
        return <SettingsPage onExport={handleExport} onImport={handleImport} onReset={handleReset} initialTab="ai" />;
      default: {
        const entry = getRouteByPath(path);
        return entry ? <PlaceholderPage route={entry} /> : <CommandCenterPage />;
      }
    }
  };

  return (
    <>
      <AppShell
        padding="md"
        header={{ height: 78 }}
        navbar={{
          width: { base: sidebarWidth, sm: desktopSidebarCollapsed ? SHELL_SIDEBAR_COLLAPSED_WIDTH : sidebarWidth },
          breakpoint: "sm",
          collapsed: { mobile: !opened, desktop: isHomeRoute },
        }}
        className={shellPageClass}
        style={pageThemeStyle}
      >
        <AppShell.Header className="km-header">
          <ShellHeader
            opened={opened}
            toggle={toggle}
            campaignName={campaign.meta?.campaignName || "Kingmaker"}
            currentDateLabel={formatGolarionDate(campaign.kingdom?.currentDate)}
            pageTitle={activeThemeRoute?.label || route.label}
            routeGroup={activeThemeRoute?.groupLabel || route.groupLabel}
            lastSavedAt={lastSavedAt}
            persistenceError={persistenceError}
            isDesktop={Boolean(desktopApi)}
            onOpenPalette={() => handleOpenPalette()}
            onToggleSidebar={() => setDesktopSidebarCollapsed((current) => !current)}
            desktopSidebarCollapsed={desktopSidebarCollapsed}
          />
        </AppShell.Header>

        <AppShell.Navbar className="km-navbar">
          <div ref={navbarShellRef} className="km-navbar-shell">
            {desktopSidebarCollapsed ? (
              <ObsidianRibbon
                tools={sidebarTools}
                activeTool={sidebarMode}
                desktopSidebarCollapsed={desktopSidebarCollapsed}
                onToggleSidebar={() => setDesktopSidebarCollapsed((current) => !current)}
                onOpenPalette={() => handleOpenPalette()}
                onSelectTool={handleSelectSidebarMode}
              />
            ) : null}
            <div className={`km-sidebar-pane${desktopSidebarCollapsed ? " is-desktop-collapsed" : ""}`}>
              <AppSidebar
                campaignName={campaign.meta?.campaignName || "Kingmaker"}
                sidebarMode={sidebarMode}
                onOpenRoute={handleOpenRoute}
                onToggleSidebar={() => setDesktopSidebarCollapsed((current) => !current)}
                activePath={activeWorkspacePath}
                primaryPath={route.path}
                secondaryPath={normalizedSecondaryPath}
                splitOpen={splitOpen}
                pinnedRoutes={pinnedRouteEntries}
                recentRoutes={recentRouteEntries}
                openRoutes={openRouteEntries}
                sidebarTools={sidebarTools}
                onSelectSidebarMode={handleSelectSidebarMode}
              />
            </div>
            {desktopSidebarCollapsed ? null : (
              <div
                className="km-navbar-resize-handle"
                onPointerDown={handleSidebarResizeStart}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
              />
            )}
          </div>
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
                pageTitle={getRouteByPath(activeWorkspacePath)?.label || route.label}
                workspaceTabs={PRIMARY_NAV_ITEMS}
                sectionTabs={activeSectionRoutes}
                activeWorkspacePath={activePrimaryPath}
                activePath={activeWorkspacePath}
                pinnedPaths={pinnedTabPaths}
                onSelectTab={handleOpenRoute}
                onTogglePin={handleTogglePin}
                onOpenPalette={() => handleOpenPalette()}
                splitOpen={splitOpen}
                onToggleSplit={handleToggleSplit}
                activePaneLabel={effectiveActivePane === "secondary" ? "Right focused" : "Left focused"}
              />

              <div
                ref={splitLayoutRef}
                className={`km-workspace-canvas${splitOpen ? " is-split" : ""}`}
                style={splitOpen ? { "--km-primary-width": `${(splitRatio * 100).toFixed(3)}%` } : undefined}
              >
                <WorkspacePane
                  paneKey="primary"
                  route={route}
                  focused={effectiveActivePane === "primary"}
                  splitOpen={splitOpen}
                  onFocus={() => setActivePane("primary")}
                  onOpenPalette={() => handleOpenPalette("primary")}
                >
                  <Suspense fallback={<WorkspaceLoadingFallback />}>
                    <Routes>
                      <Route path="/" element={<Navigate to="/campaign/run" replace />} />
                      <Route path="/campaign/run" element={<RunKingmakerPage />} />
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
                      <Route path="/reference/ai-chat" element={<AIChatPage />} />
                      <Route path="/reference/source-library" element={<SourceLibraryPage />} />
                      <Route
                        path="/reference/ai-rag"
                        element={<SettingsPage onExport={handleExport} onImport={handleImport} onReset={handleReset} initialTab="ai" />}
                      />
                      <Route path="/links/vault-sync" element={<VaultSyncPage />} />
                      <Route path="/links/exports" element={<ExportsLinksPage />} />
                      <Route path="/system/settings" element={<SettingsPage onExport={handleExport} onImport={handleImport} onReset={handleReset} />} />
                      <Route path="/system/ai-rag" element={<Navigate to="/reference/ai-rag" replace />} />
                      {ALL_ROUTES.filter((entry) => entry.status !== "rebuilt").map((entry) => (
                        <Route key={entry.path} path={entry.path} element={<PlaceholderPage route={entry} />} />
                      ))}
                      <Route path="*" element={<Navigate to="/campaign/run" replace />} />
                    </Routes>
                  </Suspense>
                </WorkspacePane>

                {splitOpen ? (
                  <>
                    <div className="km-workspace-divider" onPointerDown={handleSplitResizeStart} role="separator" aria-orientation="vertical" />
                    <WorkspacePane
                      paneKey="secondary"
                      route={getRouteByPath(normalizedSecondaryPath)}
                      focused={effectiveActivePane === "secondary"}
                      splitOpen={splitOpen}
                      onFocus={() => setActivePane("secondary")}
                      onOpenPalette={() => handleOpenPalette("secondary")}
                      onSwap={handleSwapPanes}
                      onClose={handleCloseSplit}
                    >
                      <Suspense fallback={<WorkspaceLoadingFallback label="Loading split workspace..." />}>
                        {renderWorkspaceElement(normalizedSecondaryPath)}
                      </Suspense>
                    </WorkspacePane>
                  </>
                ) : null}
              </div>
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

      <CommandPalette
        opened={paletteOpened}
        onClose={closePalette}
        query={paletteQuery}
        onQueryChange={setPaletteQuery}
        commands={commandEntries}
        onExecute={handleExecuteCommand}
      />
    </>
  );
}
