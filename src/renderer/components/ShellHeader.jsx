import { ActionIcon, Burger, Group, Stack, Text, Title } from "@mantine/core";
import { IconCommand, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";

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
  onOpenPalette,
  onToggleSidebar,
  desktopSidebarCollapsed,
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
            <Text className="km-header-route-badge">
              {pageTitle}
            </Text>
          </Group>
        </Stack>
      </Group>
      <Group gap="sm" align="center" wrap="wrap" justify="flex-end" className="km-header-status">
        <ActionIcon variant="subtle" radius="md" className="km-header-action" onClick={onOpenPalette} aria-label="Open command palette">
          <IconCommand size={16} stroke={1.9} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          radius="md"
          className="km-header-action km-header-action--desktop"
          onClick={onToggleSidebar}
          aria-label={desktopSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {desktopSidebarCollapsed ? <IconLayoutSidebarLeftExpand size={16} stroke={1.9} /> : <IconLayoutSidebarLeftCollapse size={16} stroke={1.9} />}
        </ActionIcon>
        <Text className="km-header-meta km-header-meta--date">{currentDateLabel}</Text>
        <Text className={`km-header-meta${persistenceError ? " is-error" : ""}`}>{persistenceError ? "Save issue" : `Saved ${formatSavedAt(lastSavedAt)}`}</Text>
        {isDesktop ? (
          <Text className="km-header-meta km-header-meta--desktop">
            Desktop
          </Text>
        ) : null}
      </Group>
    </Group>
  );
}
