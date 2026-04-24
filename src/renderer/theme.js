import { createTheme, rem } from "@mantine/core";

export const UI_THEME_STORAGE_KEY = "kingmaker-companion.ui-theme.v3";

const OBSIDIAN_FONT_STACK = '"Segoe UI", system-ui, sans-serif';
const OBSIDIAN_MONO_STACK = '"JetBrains Mono", "Cascadia Code", monospace';

export const UI_THEME_PRESETS = [
  {
    id: "kingmaker-atlas",
    label: "Kingmaker Atlas",
    shortLabel: "Atlas",
    description: "High-contrast forest, bright parchment, and brass trim built for the current Kingmaker look.",
    colorScheme: "dark",
    preview: {
      top: "#0c1d1d",
      bottom: "#061014",
      accent: "#49c585",
      warm: "#f0c86b",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#061014",
    defaultRadius: "md",
    colors: {
      moss: ["#eefbf4", "#d9f6e6", "#b1ecca", "#85e0ab", "#5fd38f", "#49c585", "#329b66", "#24734c", "#174b32", "#092519"],
      brass: ["#fff7e5", "#ffedc0", "#ffe09a", "#f8d277", "#f0c86b", "#dca94d", "#aa7f33", "#7a5920", "#4d3511", "#251707"],
      ember: ["#fff0e9", "#fbd7c9", "#f2b9a5", "#e89478", "#d97851", "#bd5f3d", "#93472c", "#6a301d", "#431d10", "#220b05"],
    },
    shadows: {
      md: "0 14px 34px rgba(0, 0, 0, 0.3)",
      xl: "0 24px 62px rgba(0, 0, 0, 0.42)",
    },
  },
  {
    id: "brevoy-banner",
    label: "Brevoy Banner",
    shortLabel: "Brevoy",
    description: "Noble blue-black, ivory text, warm gold, and a restrained Aldori red accent.",
    colorScheme: "dark",
    preview: {
      top: "#102033",
      bottom: "#071016",
      accent: "#78b7d7",
      warm: "#d4a24f",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#071016",
    defaultRadius: "md",
    colors: {
      moss: ["#eff8ff", "#d9edf8", "#b7ddf0", "#8fc9e5", "#68b4d8", "#4ea2ca", "#367e9e", "#265d75", "#173d4e", "#09202a"],
      brass: ["#fff5e7", "#f6e2c1", "#edce95", "#e3b863", "#d4a24f", "#b88337", "#8f6428", "#66451a", "#40290d", "#201104"],
      ember: ["#faeeeb", "#f0d1ca", "#e2ada1", "#d18776", "#c2614d", "#a94936", "#833526", "#5d2418", "#3a140d", "#1d0704"],
    },
    shadows: {
      md: "0 15px 36px rgba(0, 0, 0, 0.32)",
      xl: "0 26px 66px rgba(0, 0, 0, 0.44)",
    },
  },
  {
    id: "river-kingdoms",
    label: "River Kingdoms",
    shortLabel: "River",
    description: "Deep river teal, moonlit cyan, and trade-road copper for map and travel-heavy sessions.",
    colorScheme: "dark",
    preview: {
      top: "#09212a",
      bottom: "#041013",
      accent: "#6bd7d1",
      warm: "#cf8f51",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#041013",
    defaultRadius: "md",
    colors: {
      moss: ["#eafffd", "#cef8f4", "#9debe5", "#6bd7d1", "#43c3bd", "#28aaa5", "#1f837f", "#185f5c", "#0f3f3d", "#052120"],
      brass: ["#fff2e6", "#f4d9be", "#e8bd8e", "#d99d62", "#cf8f51", "#b36f35", "#8b5227", "#633719", "#3e210d", "#1f0e04"],
      ember: ["#faece6", "#f2d0c1", "#e7b097", "#d98d6d", "#ca6e4d", "#ae5639", "#854029", "#5f2b1b", "#3c190e", "#1d0904"],
    },
    shadows: {
      md: "0 15px 36px rgba(0, 0, 0, 0.34)",
      xl: "0 26px 66px rgba(0, 0, 0, 0.46)",
    },
  },
  {
    id: "stag-lord-ember",
    label: "Stag Lord Ember",
    shortLabel: "Ember",
    description: "Charcoal, campfire amber, and bandit-rust accents for a rougher frontier board.",
    colorScheme: "dark",
    preview: {
      top: "#241811",
      bottom: "#0d0d0c",
      accent: "#e18b50",
      warm: "#f0c36a",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#0d0d0c",
    defaultRadius: "md",
    colors: {
      moss: ["#fff2e8", "#f8dcc8", "#efbd9d", "#e69a6d", "#e18b50", "#c96f37", "#9c5228", "#71381a", "#48220d", "#220e04"],
      brass: ["#fff7e5", "#f7e7bf", "#efd493", "#e8bf66", "#f0c36a", "#d19c3f", "#a1752a", "#724f1a", "#49300c", "#241504"],
      ember: ["#ffefe7", "#f8d3c2", "#efaF94", "#e58a65", "#d96d45", "#bd5634", "#934026", "#692b18", "#42180c", "#210704"],
    },
    shadows: {
      md: "0 15px 36px rgba(0, 0, 0, 0.36)",
      xl: "0 26px 68px rgba(0, 0, 0, 0.48)",
    },
  },
  {
    id: "obsidian-vault",
    label: "Obsidian Vault",
    shortLabel: "Vault",
    description: "Dark graphite panels, note-like surfaces, and a cleaner knowledge-base feel.",
    colorScheme: "dark",
    preview: {
      top: "#2a2d34",
      bottom: "#14161a",
      accent: "#8f9cff",
      warm: "#d0a86a",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#0d1015",
    defaultRadius: "md",
    colors: {
      moss: ["#edf0ff", "#d8deff", "#bbc4ff", "#9aa7ff", "#7b89ff", "#6674ff", "#5864f2", "#4a53cf", "#3d45a5", "#30357d"],
      brass: ["#fbf1e4", "#f4dfbf", "#eccb94", "#e4b667", "#dca248", "#c98a2d", "#9d6a21", "#714a17", "#492f0d", "#241504"],
      ember: ["#faece9", "#f4d2cc", "#ecb4aa", "#e39487", "#d97666", "#c45d49", "#994637", "#6f3024", "#481d14", "#230b07"],
    },
    shadows: {
      md: "0 12px 26px rgba(0, 0, 0, 0.28)",
      xl: "0 22px 54px rgba(0, 0, 0, 0.38)",
    },
  },
  {
    id: "charter-hall",
    label: "Charter Hall",
    shortLabel: "Hall",
    description: "Warm parchment, brass trim, and a courtly campaign desk feel.",
    colorScheme: "dark",
    preview: {
      top: "#fff7eb",
      bottom: "#ead9b5",
      accent: "#326553",
      warm: "#c59223",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#241c14",
    defaultRadius: "md",
    colors: {
      moss: ["#eef6f1", "#ddece4", "#bfd9cd", "#9cc4b3", "#76b099", "#549d82", "#40806a", "#326553", "#274f42", "#1c3b31"],
      brass: ["#fbf4e6", "#f3e4bf", "#ebd293", "#e3bf64", "#dbaf3d", "#c59223", "#9a7117", "#6f510d", "#473306", "#241901"],
      ember: ["#faefeb", "#f1d1c8", "#e7b0a1", "#dc8f79", "#d36f54", "#bc573b", "#93432d", "#6b2f1f", "#441c11", "#220b05"],
    },
    shadows: {
      md: "0 14px 36px rgba(63, 47, 26, 0.14)",
      xl: "0 18px 48px rgba(43, 34, 21, 0.18)",
    },
  },
  {
    id: "war-table",
    label: "War Table",
    shortLabel: "Table",
    description: "Cool slate, signal brass, and a tactical planning board look.",
    colorScheme: "dark",
    preview: {
      top: "#f3f7fa",
      bottom: "#cedae3",
      accent: "#315c70",
      warm: "#af7a34",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#1d2530",
    defaultRadius: "md",
    colors: {
      moss: ["#edf5f7", "#d9e9ee", "#bbd7df", "#98c1cd", "#74abba", "#5394a7", "#41798b", "#315c70", "#234757", "#15313d"],
      brass: ["#fbf1e6", "#f5dec2", "#efca99", "#e7b36f", "#de9e49", "#c9842f", "#9c6522", "#704719", "#482d0f", "#241507"],
      ember: ["#faedeb", "#f3d1cb", "#eaafa3", "#e18b7b", "#d86956", "#c24f39", "#983b2c", "#6e281d", "#47170f", "#230905"],
    },
    shadows: {
      md: "0 16px 34px rgba(28, 40, 50, 0.14)",
      xl: "0 24px 58px rgba(20, 30, 38, 0.2)",
    },
  },
  {
    id: "verdant-atlas",
    label: "Verdant Atlas",
    shortLabel: "Atlas",
    description: "Field-journal greens with brighter survey-map surfaces.",
    colorScheme: "dark",
    preview: {
      top: "#f6fbf1",
      bottom: "#d5e4c3",
      accent: "#41693b",
      warm: "#977129",
    },
    fonts: {
      body: OBSIDIAN_FONT_STACK,
      heading: OBSIDIAN_FONT_STACK,
      mono: OBSIDIAN_MONO_STACK,
    },
    black: "#1f261a",
    defaultRadius: "md",
    colors: {
      moss: ["#eef7eb", "#ddedd7", "#c1dbb8", "#a3c998", "#84b777", "#669f59", "#527f46", "#41693b", "#31502c", "#21381d"],
      brass: ["#faf4e7", "#f1e4c2", "#e7d191", "#ddbd61", "#d2a93b", "#b78a21", "#8f6b18", "#684c10", "#433007", "#221802"],
      ember: ["#faefea", "#f3d5c9", "#ebbaa6", "#e29e82", "#d98463", "#c36949", "#985039", "#6d3828", "#452218", "#220f09"],
    },
    shadows: {
      md: "0 16px 34px rgba(38, 52, 26, 0.13)",
      xl: "0 22px 54px rgba(30, 44, 20, 0.18)",
    },
  },
];

export const DEFAULT_UI_THEME_ID = "kingmaker-atlas";

export function getUiThemePreset(uiThemeId) {
  return UI_THEME_PRESETS.find((preset) => preset.id === uiThemeId) || UI_THEME_PRESETS[0];
}

export function createMantineTheme(uiThemeId = DEFAULT_UI_THEME_ID) {
  const preset = getUiThemePreset(uiThemeId);

  return createTheme({
    primaryColor: "moss",
    primaryShade: preset.colorScheme === "dark" ? { light: 7, dark: 5 } : 7,
    defaultRadius: preset.defaultRadius,
    fontFamily: preset.fonts.body,
    fontFamilyMonospace: preset.fonts.mono,
    black: preset.black,
    colors: preset.colors,
    headings: {
      fontFamily: preset.fonts.heading,
      fontWeight: "700",
      sizes: {
        h1: { fontSize: rem(30), lineHeight: "1.12" },
        h2: { fontSize: rem(24), lineHeight: "1.15" },
        h3: { fontSize: rem(20), lineHeight: "1.2" },
        h4: { fontSize: rem(17), lineHeight: "1.24" },
      },
    },
    shadows: preset.shadows,
    components: {
      Paper: {
        defaultProps: {
          shadow: "md",
          radius: preset.defaultRadius,
          withBorder: true,
        },
      },
      Button: {
        defaultProps: {
          radius: preset.defaultRadius,
        },
      },
      Badge: {
        defaultProps: {
          radius: preset.defaultRadius,
        },
      },
    },
  });
}
