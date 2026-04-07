import { Badge, Group, Stack, Text } from "@mantine/core";
import { useUiTheme } from "../context/UiThemeContext";

export default function UiThemeSwitcher() {
  const { uiThemeId, setUiThemeId, themePresets } = useUiTheme();

  return (
    <Stack gap="sm" className="km-theme-switcher">
      <Group justify="space-between" align="center" gap="sm">
        <Stack gap={1}>
          <Text className="km-sidebar-section">Style Studio</Text>
          <Text size="xs" c="dimmed">
            Swap the shell look without touching campaign data.
          </Text>
        </Stack>
        <Badge variant="light" color="brass">
          {themePresets.length} looks
        </Badge>
      </Group>

      <div className="km-theme-grid">
        {themePresets.map((preset) => {
          const active = preset.id === uiThemeId;

          return (
            <button
              key={preset.id}
              type="button"
              className={`km-theme-chip${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => setUiThemeId(preset.id)}
            >
              <span
                className="km-theme-chip__swatch"
                style={{
                  "--km-theme-preview-top": preset.preview.top,
                  "--km-theme-preview-bottom": preset.preview.bottom,
                  "--km-theme-preview-accent": preset.preview.accent,
                  "--km-theme-preview-warm": preset.preview.warm,
                }}
              />

              <span className="km-theme-chip__copy">
                <span className="km-theme-chip__title-row">
                  <span className="km-theme-chip__title">{preset.label}</span>
                  {active ? <span className="km-theme-chip__state">Live</span> : null}
                </span>
                <span className="km-theme-chip__description">{preset.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Stack>
  );
}
