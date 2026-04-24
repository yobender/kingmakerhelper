import { useEffect, useState } from "react";
import { ActionIcon, Badge, Box, Divider, Group, NavLink as MantineNavLink, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconFolderOpen, IconLayoutSidebarLeftCollapse } from "@tabler/icons-react";
import { PRIMARY_NAV_GROUPS, getRouteByPath } from "../lib/routes";

const SIDEBAR_MODE_META = {
  explorer: {
    eyebrow: "Vault Explorer",
    title: "Explorer",
    description: "Browse the campaign by workspace instead of stacking every navigation block at once.",
  },
  pinned: {
    eyebrow: "Vault Pins",
    title: "Pinned",
    description: "Keep the pages you return to most anchored in one place.",
  },
  recent: {
    eyebrow: "Recent Views",
    title: "Recent",
    description: "Jump back through the pages you opened most recently.",
  },
  workspace: {
    eyebrow: "Open Workspace",
    title: "Workspaces",
    description: "See what is open, which pane it lives in, and what the split is doing right now.",
  },
};

function getPaneSlotLabel(path, primaryPath, secondaryPath, splitOpen) {
  const slots = [];
  if (path === primaryPath) slots.push("L");
  if (splitOpen && path === secondaryPath) slots.push("R");
  return slots.length ? slots.join("/") : "";
}

function routeMatchesItem(item, path) {
  return item.path === path || item.childPaths?.includes(path);
}

function getPrimaryPaneSlotLabel(item, primaryPath, secondaryPath, splitOpen) {
  const slots = [];
  if (routeMatchesItem(item, primaryPath)) slots.push("L");
  if (splitOpen && routeMatchesItem(item, secondaryPath)) slots.push("R");
  return slots.length ? slots.join("/") : "";
}

function getRouteGroupLabel(path) {
  return PRIMARY_NAV_GROUPS.find((group) => group.items.some((item) => routeMatchesItem(item, path)))?.label || "Workspaces";
}

function buildInitialOpenGroups(activePath) {
  const activeGroupLabel = getRouteGroupLabel(activePath);
  return Object.fromEntries(PRIMARY_NAV_GROUPS.map((group) => [group.label, group.label === "Workspaces" || group.label === activeGroupLabel]));
}

function SidebarRouteLink({ item, active, paneSlotLabel, onOpenRoute, compact = false }) {
  return (
    <MantineNavLink
      component="button"
      type="button"
      label={item.sidebarLabel || item.label}
      description={compact ? undefined : item.sidebarDescription || item.description}
      active={active}
      className={`km-nav-link${compact ? " km-nav-link--compact" : ""}`}
      leftSection={<item.icon size={15} stroke={1.7} />}
      rightSection={paneSlotLabel ? <Text className="km-nav-slot">{paneSlotLabel}</Text> : null}
      onClick={() => onOpenRoute(item.path)}
    />
  );
}

function SidebarSection({ title, count, children }) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text className="km-sidebar-section">{title}</Text>
        {typeof count === "number" ? (
          <Badge variant="outline" color="gray">
            {count}
          </Badge>
        ) : null}
      </Group>
      {children}
    </Stack>
  );
}

function SidebarEmptyState({ title, copy }) {
  return (
    <Box className="km-sidebar-card km-sidebar-card--empty">
      <Text fw={600}>{title}</Text>
      <Text size="sm" c="dimmed">
        {copy}
      </Text>
    </Box>
  );
}

export default function AppSidebar({
  campaignName,
  sidebarMode,
  onOpenRoute,
  onToggleSidebar,
  activePath,
  primaryPath,
  secondaryPath,
  splitOpen,
  pinnedRoutes,
  recentRoutes,
  openRoutes,
  sidebarTools,
  onSelectSidebarMode,
}) {
  const modeMeta = SIDEBAR_MODE_META[sidebarMode] || SIDEBAR_MODE_META.explorer;
  const primaryRoute = getRouteByPath(primaryPath);
  const secondaryRoute = splitOpen ? getRouteByPath(secondaryPath) : null;
  const [openGroups, setOpenGroups] = useState(() => buildInitialOpenGroups(activePath));

  useEffect(() => {
    const activeGroupLabel = getRouteGroupLabel(activePath);
    setOpenGroups((current) => (current[activeGroupLabel] ? current : { ...current, [activeGroupLabel]: true }));
  }, [activePath]);

  const renderRouteGroup = (title, items, { compact = false } = {}) => {
    if (!items.length) return null;
    return (
      <SidebarSection title={title} count={items.length}>
        {items.map((item) => (
          <SidebarRouteLink
            key={`${title}:${item.path}`}
            item={item}
            active={activePath === item.path}
            paneSlotLabel={getPaneSlotLabel(item.path, primaryPath, secondaryPath, splitOpen)}
            onOpenRoute={onOpenRoute}
            compact={compact}
          />
        ))}
      </SidebarSection>
    );
  };

  const toggleGroup = (groupLabel) => {
    setOpenGroups((current) => ({
      ...current,
      [groupLabel]: !current[groupLabel],
    }));
  };

  return (
    <ScrollArea className="km-sidebar-scroll" scrollbarSize={6}>
      <Stack gap="xs" p={2}>
        <Group justify="space-between" align="center" wrap="nowrap" className="km-sidebar-modebar">
          <Group gap={4} wrap="nowrap" className="km-sidebar-modebar__actions">
            {sidebarTools?.map((tool) => {
              const Icon = tool.icon;
              const active = tool.id === sidebarMode;
              return (
                <Tooltip key={tool.id} label={tool.label} position="bottom" withArrow>
                  <ActionIcon
                    variant={active ? "filled" : "subtle"}
                    size="lg"
                    radius="md"
                    className={`km-sidebar-modebar__button${active ? " is-active" : ""}`}
                    aria-label={tool.label}
                    onClick={() => onSelectSidebarMode?.(tool.id)}
                  >
                    <Icon size={16} stroke={1.85} />
                  </ActionIcon>
                </Tooltip>
              );
            })}
          </Group>
          <Tooltip label="Collapse sidebar" position="bottom" withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              radius="md"
              className="km-sidebar-modebar__button km-sidebar-modebar__button--collapse"
              aria-label="Collapse sidebar"
              onClick={() => onToggleSidebar?.()}
            >
              <IconLayoutSidebarLeftCollapse size={15} stroke={1.85} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {sidebarMode === "explorer" ? null : (
          <Box className="km-sidebar-brand km-sidebar-brand--vault">
            <Text className="km-eyebrow">{modeMeta.eyebrow}</Text>
            <Text className="km-sidebar-title">{modeMeta.title}</Text>
            <Text size="sm" c="dimmed">
              {modeMeta.description}
            </Text>
            <Text className="km-sidebar-caption">{campaignName}</Text>
          </Box>
        )}

        {sidebarMode === "explorer"
          ? PRIMARY_NAV_GROUPS.map((group, index) => (
              <Stack key={group.label} gap="xs">
                {index > 0 ? <Divider variant="dashed" /> : null}
                <button type="button" className="km-sidebar-folder" onClick={() => toggleGroup(group.label)}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="xs" align="center" wrap="nowrap">
                      <ActionIcon variant="subtle" size="sm" radius="xl" className="km-sidebar-folder__chevron" aria-hidden="true">
                        {openGroups[group.label] ? <IconChevronDown size={14} stroke={1.9} /> : <IconChevronRight size={14} stroke={1.9} />}
                      </ActionIcon>
                      <ActionIcon variant="subtle" size="sm" radius="xl" className="km-sidebar-folder__icon" aria-hidden="true">
                        <IconFolderOpen size={14} stroke={1.8} />
                      </ActionIcon>
                      <Text className="km-sidebar-folder__label">{group.label}</Text>
                    </Group>
                    <Badge variant="outline" color="gray">
                      {group.items.length}
                    </Badge>
                  </Group>
                </button>

                {openGroups[group.label] ? (
                  <Stack gap={4} className="km-sidebar-folder__items">
                    {group.items.map((item) => (
                      <SidebarRouteLink
                        key={item.path}
                        item={item}
                        active={routeMatchesItem(item, activePath)}
                        paneSlotLabel={getPrimaryPaneSlotLabel(item, primaryPath, secondaryPath, splitOpen)}
                        onOpenRoute={onOpenRoute}
                        compact
                      />
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            ))
          : null}

        {sidebarMode === "pinned"
          ? pinnedRoutes.length
            ? renderRouteGroup("Pinned pages", pinnedRoutes, { compact: true })
            : (
              <SidebarEmptyState
                title="No pinned pages yet"
                copy="Pin a page from the workspace strip to keep it parked here."
              />
            )
          : null}

        {sidebarMode === "recent"
          ? recentRoutes.length
            ? renderRouteGroup("Recently opened", recentRoutes, { compact: true })
            : (
              <SidebarEmptyState
                title="No recent history yet"
                copy="Open a few pages and they will start appearing here."
              />
            )
          : null}

        {sidebarMode === "workspace" ? (
          <>
            <SidebarSection title="Pane State" count={splitOpen ? 2 : 1}>
              <Box className="km-sidebar-card">
                <Text className="km-sidebar-card__label">Left pane</Text>
                <Text className="km-sidebar-card__title">{primaryRoute?.label || "Command Center"}</Text>
                <Text size="sm" c="dimmed">
                  {primaryRoute?.groupLabel || "Campaign"}
                </Text>
              </Box>

              <Box className="km-sidebar-card">
                <Text className="km-sidebar-card__label">Right pane</Text>
                <Text className="km-sidebar-card__title">{secondaryRoute?.label || "Split closed"}</Text>
                <Text size="sm" c="dimmed">
                  {secondaryRoute?.groupLabel || "Open split view to load a second page."}
                </Text>
              </Box>
            </SidebarSection>

            <Divider variant="dashed" />

            {openRoutes.length
              ? renderRouteGroup("Open tabs", openRoutes, { compact: true })
              : (
                <SidebarEmptyState
                  title="No open workspaces"
                  copy="Open a page to start building the workspace strip."
                />
              )}
          </>
        ) : null}
      </Stack>
    </ScrollArea>
  );
}
