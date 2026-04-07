import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import App from "./App";
import { UiThemeProvider, useUiTheme } from "./context/UiThemeContext";
import { createMantineTheme } from "./theme";
import "./styles.css";

function ThemedApp() {
  const { uiThemeId, activeTheme } = useUiTheme();

  return (
    <MantineProvider
      theme={createMantineTheme(uiThemeId)}
      defaultColorScheme={activeTheme.colorScheme || "light"}
      forceColorScheme={activeTheme.colorScheme || "light"}
    >
      <Notifications position="top-right" />
      <HashRouter>
        <App />
      </HashRouter>
    </MantineProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <UiThemeProvider>
      <ThemedApp />
    </UiThemeProvider>
  </StrictMode>
);
