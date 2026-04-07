import { Badge, Burger, Group, Stack, Text, Title } from "@mantine/core";

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
  routeGroup,
  lastSavedAt,
  persistenceError,
  isDesktop,
}) {
  return (
    <Group justify="space-between" align="center" h="100%" px="lg" gap="lg" wrap="wrap" className="km-header-bar">
      <Group align="center" gap="md" wrap="nowrap" className="km-header-bar__brand">
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        <Stack gap={2}>
          <Text className="km-eyebrow km-header-bar__eyebrow">{routeGroup ? `${routeGroup} workspace` : "Campaign workspace"}</Text>
          <Group gap="sm" align="center" wrap="wrap" className="km-header-bar__title-row">
            <Title order={3} className="km-shell-title">
              {campaignName}
            </Title>
            <Badge color="gray" variant="outline" className="km-header-route-badge">
              {pageTitle}
            </Badge>
          </Group>
        </Stack>
      </Group>
      <Group gap="sm" align="center" wrap="wrap" justify="flex-end" className="km-header-status">
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
    </Group>
  );
}
