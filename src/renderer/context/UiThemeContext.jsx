import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_UI_THEME_ID, UI_THEME_PRESETS, UI_THEME_STORAGE_KEY, getUiThemePreset } from "../theme";

const UiThemeContext = createContext(null);

function readStoredUiThemeId() {
  try {
    if (typeof window === "undefined") return DEFAULT_UI_THEME_ID;
    return getUiThemePreset(window.localStorage.getItem(UI_THEME_STORAGE_KEY)).id;
  } catch {
    return DEFAULT_UI_THEME_ID;
  }
}

export function UiThemeProvider({ children }) {
  const [uiThemeId, setUiThemeIdState] = useState(readStoredUiThemeId);
  const activeTheme = getUiThemePreset(uiThemeId);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.kmTheme = activeTheme.id;
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(UI_THEME_STORAGE_KEY, activeTheme.id);
      }
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [activeTheme.id]);

  const setUiThemeId = (nextThemeId) => {
    setUiThemeIdState(getUiThemePreset(nextThemeId).id);
  };

  return (
    <UiThemeContext.Provider
      value={{
        uiThemeId: activeTheme.id,
        activeTheme,
        themePresets: UI_THEME_PRESETS,
        setUiThemeId,
      }}
    >
      {children}
    </UiThemeContext.Provider>
  );
}

export function useUiTheme() {
  const context = useContext(UiThemeContext);
  if (!context) {
    throw new Error("useUiTheme must be used inside UiThemeProvider.");
  }
  return context;
}
