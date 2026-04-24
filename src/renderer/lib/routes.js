import {
  IconArrowsExchange,
  IconBellRinging,
  IconBook2,
  IconBooks,
  IconCrown,
  IconLayoutDashboard,
  IconLibrary,
  IconListDetails,
  IconMap2,
  IconMapPin,
  IconMasksTheater,
  IconNotebook,
  IconPlayerPlay,
  IconSettings2,
  IconScale,
  IconSparkles,
  IconUsersGroup,
} from "@tabler/icons-react";

export const NAV_GROUPS = [
  {
    label: "Campaign",
    items: [
      {
        id: "run",
        path: "/campaign/run",
        label: "Run Kingmaker",
        description: "Current AP phase, active table state, and focused reference queue.",
        icon: IconPlayerPlay,
        legacyTab: "dashboard",
        status: "rebuilt",
      },
      {
        id: "dashboard",
        path: "/campaign/command-center",
        label: "Command Center",
        description: "Pressure, prep focus, and the next move.",
        icon: IconLayoutDashboard,
        legacyTab: "dashboard",
        status: "rebuilt",
      },
      {
        id: "sessions",
        path: "/campaign/adventure-log",
        label: "Adventure Log",
        description: "Session timeline, prep handoff, and month close.",
        icon: IconBook2,
        legacyTab: "sessions",
        status: "rebuilt",
      },
      {
        id: "capture",
        path: "/campaign/table-notes",
        label: "Table Notes",
        description: "Live notes, rulings, retcons, and scene fragments.",
        icon: IconNotebook,
        legacyTab: "capture",
        status: "rebuilt",
      },
      {
        id: "writing",
        path: "/campaign/scene-forge",
        label: "Scene Forge",
        description: "Draft scenes, summaries, and export-ready text.",
        icon: IconSparkles,
        legacyTab: "writing",
        status: "rebuilt",
      },
    ],
  },
  {
    label: "World",
    items: [
      {
        id: "kingdom",
        path: "/world/kingdom",
        label: "Kingdom",
        description: "Calendar, leadership, turns, and kingdom fallout.",
        icon: IconCrown,
        legacyTab: "kingdom",
        status: "rebuilt",
      },
      {
        id: "hexmap",
        path: "/world/hex-map",
        label: "Hex Map",
        description: "Regions, discovery, travel routes, and markers.",
        icon: IconMap2,
        legacyTab: "hexmap",
        status: "rebuilt",
      },
      {
        id: "companions",
        path: "/world/companions",
        label: "Companions",
        description: "Influence, travel state, and personal beats.",
        icon: IconUsersGroup,
        legacyTab: "companions",
        status: "rebuilt",
      },
      {
        id: "events",
        path: "/world/events",
        label: "Events",
        description: "Pressure clocks, triggers, and consequences.",
        icon: IconBellRinging,
        legacyTab: "events",
        status: "rebuilt",
      },
      {
        id: "npcs",
        path: "/world/npcs",
        label: "NPCs",
        description: "Political players, allies, enemies, and fallout.",
        icon: IconMasksTheater,
        legacyTab: "npcs",
        status: "rebuilt",
      },
      {
        id: "quests",
        path: "/world/quests",
        label: "Quests",
        description: "Objective stack, chapter links, and next beats.",
        icon: IconListDetails,
        legacyTab: "quests",
        status: "rebuilt",
      },
      {
        id: "locations",
        path: "/world/locations",
        label: "Locations",
        description: "Settlements, landmarks, and changing sites.",
        icon: IconMapPin,
        legacyTab: "locations",
        status: "rebuilt",
      },
    ],
  },
  {
    label: "Reference",
    items: [
      {
        id: "rules",
        path: "/reference/rules",
        label: "Rules Reference",
        description: "Manual rulings, canon, and AON lookups.",
        icon: IconScale,
        legacyTab: "rules",
        status: "rebuilt",
      },
      {
        id: "ai-chat",
        path: "/reference/ai-chat",
        label: "Ask AI",
        description: "Talk to Companion AI with @app, @pdf, @rules, and @vault tags.",
        icon: IconSparkles,
        legacyTab: "",
        status: "rebuilt",
      },
      {
        id: "pdf",
        path: "/reference/source-library",
        label: "Source Library",
        description: "PDF search, summaries, and book grounding.",
        icon: IconBooks,
        legacyTab: "pdf",
        status: "rebuilt",
      },
      {
        id: "ai-rag",
        path: "/reference/ai-rag",
        label: "AI / RAG",
        description: "Ollama connection, embeddings, and PDF grounding.",
        icon: IconSparkles,
        legacyTab: "",
        status: "rebuilt",
      },
    ],
  },
  {
    label: "Links",
    items: [
      {
        id: "obsidian",
        path: "/links/vault-sync",
        label: "Vault Sync",
        description: "Obsidian note sync and AI context pull.",
        icon: IconLibrary,
        legacyTab: "obsidian",
        status: "rebuilt",
      },
      {
        id: "foundry",
        path: "/links/exports",
        label: "Exports & Links",
        description: "Foundry, JSON export, and optional bridge work.",
        icon: IconArrowsExchange,
        legacyTab: "foundry",
        status: "rebuilt",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "settings",
        path: "/system/settings",
        label: "Settings",
        description: "Appearance, workspace actions, and local AI defaults.",
        icon: IconSettings2,
        legacyTab: "",
        status: "rebuilt",
      },
    ],
  },
];

export const ALL_ROUTES = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    groupLabel: group.label,
  })),
);

function primaryNavItem(path, overrides = {}) {
  const route = ALL_ROUTES.find((item) => item.path === path);
  if (!route) return null;
  return {
    ...route,
    ...overrides,
    childPaths: Array.from(new Set([path, ...(overrides.childPaths || [])])),
  };
}

export const PRIMARY_NAV_GROUPS = [
  {
    label: "Command",
    items: [
      primaryNavItem("/campaign/run", {
        sidebarLabel: "Run Kingmaker",
        sidebarDescription: "AP phase, live state, and session cockpit.",
        childPaths: ["/campaign/command-center"],
      }),
    ].filter(Boolean),
  },
  {
    label: "Workspaces",
    items: [
      primaryNavItem("/campaign/adventure-log", {
        sidebarLabel: "Campaign Desk",
        sidebarDescription: "Sessions, notes, and scene writing.",
        childPaths: ["/campaign/table-notes", "/campaign/scene-forge"],
      }),
      primaryNavItem("/world/hex-map", {
        sidebarLabel: "World Atlas",
        sidebarDescription: "Map, places, NPCs, and quests.",
        childPaths: ["/world/locations", "/world/npcs", "/world/quests"],
      }),
      primaryNavItem("/world/kingdom", {
        sidebarLabel: "Kingdom Table",
        sidebarDescription: "Turns, events, and companions.",
        childPaths: ["/world/events", "/world/companions"],
      }),
      primaryNavItem("/reference/ai-chat", {
        sidebarLabel: "Council",
        sidebarDescription: "AI, rules, and source library.",
        childPaths: ["/reference/rules", "/reference/source-library", "/reference/ai-rag"],
      }),
    ].filter(Boolean),
  },
  {
    label: "Tools",
    items: [
      primaryNavItem("/system/settings", {
        sidebarLabel: "Tools & Settings",
        sidebarDescription: "Sync, exports, appearance, and local AI.",
        childPaths: ["/links/vault-sync", "/links/exports", "/system/ai-rag"],
      }),
    ].filter(Boolean),
  },
];

export const PRIMARY_NAV_ITEMS = PRIMARY_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    primaryGroupLabel: group.label,
  })),
);

export function getPrimaryNavItemForPath(pathname) {
  return (
    PRIMARY_NAV_ITEMS.find((item) => item.path === pathname || item.childPaths?.includes(pathname)) ||
    PRIMARY_NAV_ITEMS[0] ||
    null
  );
}

export function getRoutesForPrimaryNavItem(primaryNavItem) {
  if (!primaryNavItem) return [];
  return (primaryNavItem.childPaths || [primaryNavItem.path])
    .map((path) => getRouteByPath(path))
    .filter(Boolean);
}

export function getRouteByPath(pathname) {
  return ALL_ROUTES.find((route) => route.path === pathname) || null;
}
