import { ActionIcon, Button, Group, ScrollArea, Text, UnstyledButton } from "@mantine/core";
import { IconPin, IconSearch } from "@tabler/icons-react";

export default function WorkspaceStrip({
  campaignName,
  pageTitle,
  workspaceTabs,
  sectionTabs,
  activeWorkspacePath,
  activePath,
  pinnedPaths,
  onSelectTab,
  onTogglePin,
  onOpenPalette,
  splitOpen,
  onToggleSplit,
  activePaneLabel,
}) {
  const currentPinned = pinnedPaths.includes(activePath);
  const activeWorkspace = workspaceTabs.find((tab) => tab.path === activeWorkspacePath) || workspaceTabs[0];
  const stripStateLabel = splitOpen ? activePaneLabel : null;

  return (
    <div className="km-workspace-strip">
      <Group justify="space-between" align="center" gap="sm" wrap="nowrap" className="km-workspace-strip__top">
        <ScrollArea type="never" className="km-workspace-strip__tabs-scroll">
          <Group gap={6} wrap="nowrap" className="km-workspace-strip__tabs">
            {workspaceTabs.map((tab) => {
              const active = tab.path === activeWorkspacePath;
              const Icon = tab.icon;
              return (
                <UnstyledButton
                  key={tab.path}
                  className={`km-workspace-tab-shell km-workspace-tab-shell--primary${active ? " is-active" : ""}`}
                  onClick={() => onSelectTab(tab.path)}
                  title={tab.label}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="km-workspace-tab">
                    <Group gap={8} align="center" wrap="nowrap">
                      <Icon size={14} stroke={1.8} className="km-workspace-tab__icon" />
                      <Text className="km-workspace-tab__label">{tab.sidebarLabel || tab.label}</Text>
                    </Group>
                  </span>
                </UnstyledButton>
              );
            })}
          </Group>
        </ScrollArea>

        <Group gap="xs" wrap="nowrap" className="km-workspace-strip__actions">
          {stripStateLabel ? <Text className="km-workspace-strip__pane-state">{stripStateLabel}</Text> : null}
          <Button variant="default" size="compact-sm" className="km-workspace-strip__split-button" onClick={onToggleSplit}>
            {splitOpen ? "Close split" : "Split"}
          </Button>
          <ActionIcon
            variant={currentPinned ? "filled" : "subtle"}
            radius="md"
            aria-label={currentPinned ? "Unpin current workspace tab" : "Pin current workspace tab"}
            className="km-workspace-strip__action"
            onClick={onTogglePin}
          >
            <IconPin size={14} stroke={1.9} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            radius="md"
            aria-label="Open command palette"
            className="km-workspace-strip__action"
            onClick={onOpenPalette}
          >
            <IconSearch size={14} stroke={1.9} />
          </ActionIcon>
        </Group>
      </Group>

      <Group justify="space-between" align="center" gap="sm" wrap="wrap" className="km-workspace-strip__bottom">
        <Group gap={8} align="center" wrap="wrap" className="km-workspace-strip__crumbs">
          <Text className="km-workspace-strip__label">{campaignName}</Text>
          <Text className="km-workspace-strip__divider">/</Text>
          <Text className="km-workspace-strip__crumb">{activeWorkspace?.sidebarLabel || activeWorkspace?.label || "Workspace"}</Text>
          {pageTitle ? (
            <>
              <Text className="km-workspace-strip__divider">/</Text>
              <Text className="km-workspace-strip__crumb km-workspace-strip__crumb--active">{pageTitle}</Text>
            </>
          ) : null}
        </Group>
        <Group gap={6} wrap="wrap" className="km-workspace-strip__section-tabs">
          {sectionTabs.map((tab) => (
            <UnstyledButton
              key={tab.path}
              className={`km-workspace-section-tab${tab.path === activePath ? " is-active" : ""}`}
              onClick={() => onSelectTab(tab.path)}
              aria-current={tab.path === activePath ? "page" : undefined}
            >
              {tab.label}
            </UnstyledButton>
          ))}
        </Group>
      </Group>
    </div>
  );
}
