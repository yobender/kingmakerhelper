import { Badge, Burger, Button, Group, Stack, Text, Title } from "@mantine/core";
import { getLegacyWorkspaceUrl } from "../lib/desktop";

function formatSavedAt(value) {
  const time = Date.parse(value || "");
  if (Number.isNaN(time)) return "Not saved yet";
  return new Date(time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ShellHeader({
  opened,
  toggle,
  campaignName,
  currentDateLabel,
  pageTitle,
  lastSavedAt,
  persistenceError,
  isDesktop,
  onExport,
  onImport,
  onReset,
}) {
  return (
    <Group justify="space-between" align="center" h="100%" px="lg" gap="lg" wrap="nowrap">
      <Group align="center" gap="md" wrap="nowrap">
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        <Stack gap={2}>
          <Text className="km-eyebrow">{pageTitle}</Text>
          <Group gap="sm" align="center">
            <Title order={3} className="km-shell-title">
              {campaignName}
            </Title>
            <Badge color="moss" variant="light">
              {currentDateLabel}
            </Badge>
            <Badge color={persistenceError ? "red" : "gray"} variant="outline">
              {persistenceError ? "Save issue" : `Saved ${formatSavedAt(lastSavedAt)}`}
            </Badge>
            {isDesktop ? (
              <Badge color="brass" variant="outline">
                Desktop
              </Badge>
            ) : null}
          </Group>
        </Stack>
      </Group>

      <Group gap="sm" visibleFrom="sm">
        <Button variant="default" onClick={onReset}>
          Starter State
        </Button>
        <Button variant="default" onClick={onImport}>
          Import JSON
        </Button>
        <Button color="moss" onClick={onExport}>
          Export JSON
        </Button>
        <Button component="a" href={getLegacyWorkspaceUrl()} variant="light" color="dark">
          Legacy Workspace
        </Button>
      </Group>
    </Group>
  );
}
