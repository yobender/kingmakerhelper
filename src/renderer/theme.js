import { createTheme, rem } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "moss",
  primaryShade: 7,
  defaultRadius: "xl",
  fontFamily: '"Source Serif 4", Georgia, serif',
  fontFamilyMonospace: '"JetBrains Mono", "Courier New", monospace',
  black: "#241c14",
  colors: {
    moss: ["#eef6f1", "#ddece4", "#bfd9cd", "#9cc4b3", "#76b099", "#549d82", "#40806a", "#326553", "#274f42", "#1c3b31"],
    brass: ["#fbf4e6", "#f3e4bf", "#ebd293", "#e3bf64", "#dbaf3d", "#c59223", "#9a7117", "#6f510d", "#473306", "#241901"],
    ember: ["#faefeb", "#f1d1c8", "#e7b0a1", "#dc8f79", "#d36f54", "#bc573b", "#93432d", "#6b2f1f", "#441c11", "#220b05"],
  },
  headings: {
    fontFamily: '"Cinzel", Georgia, serif',
    fontWeight: "700",
    sizes: {
      h1: { fontSize: rem(34), lineHeight: "1.12" },
      h2: { fontSize: rem(28), lineHeight: "1.15" },
      h3: { fontSize: rem(22), lineHeight: "1.2" },
      h4: { fontSize: rem(18), lineHeight: "1.24" },
    },
  },
  shadows: {
    md: "0 14px 36px rgba(63, 47, 26, 0.14)",
    xl: "0 18px 48px rgba(43, 34, 21, 0.18)",
  },
  components: {
    Paper: {
      defaultProps: {
        shadow: "md",
        radius: "xl",
        withBorder: true,
      },
    },
    Button: {
      defaultProps: {
        radius: "xl",
      },
    },
    Badge: {
      defaultProps: {
        radius: "xl",
      },
    },
  },
});
