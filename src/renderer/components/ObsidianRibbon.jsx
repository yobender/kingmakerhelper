import { ActionIcon, Divider, Stack, Text, Tooltip } from "@mantine/core";
import { IconCommand, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";

export default function ObsidianRibbon({ tools, activeTool, desktopSidebarCollapsed, onToggleSidebar, onOpenPalette, onSelectTool }) {
  return (
    <div className="km-ribbon" aria-label="Workspace ribbon">
      <Stack gap="xs" align="center" className="km-ribbon__top">
        <div className="km-ribbon__glyph" aria-hidden="true">
          <Text span>K</Text>
        </div>

        <Tooltip label={desktopSidebarCollapsed ? "Expand navigation" : "Collapse navigation"} position="right" withArrow>
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            className="km-ribbon__action"
            onClick={onToggleSidebar}
            aria-label={desktopSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {desktopSidebarCollapsed ? <IconLayoutSidebarLeftExpand size={17} stroke={1.9} /> : <IconLayoutSidebarLeftCollapse size={17} stroke={1.9} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Open command palette" position="right" withArrow>
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            className="km-ribbon__action"
            onClick={onOpenPalette}
            aria-label="Open command palette"
          >
            <IconCommand size={17} stroke={1.9} />
          </ActionIcon>
        </Tooltip>
      </Stack>

      <Divider className="km-ribbon__divider" />

      <Stack gap="xs" align="center" className="km-ribbon__links">
        {tools.map((entry) => {
          const Icon = entry.icon;
          const active = entry.id === activeTool;
          return (
            <Tooltip key={entry.id} label={entry.label} position="right" withArrow>
              <ActionIcon
                variant={active ? "filled" : "subtle"}
                size="lg"
                radius="md"
                className={`km-ribbon__action${active ? " is-active" : ""}`}
                onClick={() => onSelectTool(entry.id)}
                aria-label={entry.label}
              >
                <Icon size={17} stroke={1.85} />
              </ActionIcon>
            </Tooltip>
          );
        })}
      </Stack>
    </div>
  );
}
