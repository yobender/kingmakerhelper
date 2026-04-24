import { ActionIcon, Group, Text } from "@mantine/core";
import { IconArrowsExchange, IconSearch, IconX } from "@tabler/icons-react";

export default function WorkspacePane({
  paneKey,
  route,
  focused,
  splitOpen,
  onFocus,
  onOpenPalette,
  onSwap,
  onClose,
  children,
}) {
  const paneLabel = paneKey === "secondary" ? "Right Pane" : "Left Pane";

  return (
    <section
      className={`km-workspace-pane${focused ? " is-focused" : ""}${paneKey === "secondary" ? " is-secondary" : " is-primary"}${splitOpen ? " is-split" : ""}`}
      onMouseDown={onFocus}
    >
      {splitOpen ? (
        <Group justify="space-between" align="center" gap="sm" wrap="nowrap" className="km-workspace-pane__header">
          <Group gap="sm" wrap="nowrap" className="km-workspace-pane__heading">
            <Text className={`km-workspace-pane__badge${focused ? " is-focused" : ""}`}>
              {paneLabel}
            </Text>
            <div className="km-workspace-pane__titles">
              <Text className="km-workspace-pane__title">{route?.label || "Workspace"}</Text>
              <Text className="km-workspace-pane__subtitle">{route?.groupLabel || "Campaign"}</Text>
            </div>
          </Group>

          <Group gap="xs" wrap="nowrap" className="km-workspace-pane__actions">
            <ActionIcon variant="subtle" radius="md" aria-label={`Open command palette for ${paneLabel.toLowerCase()}`} onClick={onOpenPalette}>
              <IconSearch size={15} stroke={1.9} />
            </ActionIcon>
            {paneKey === "secondary" ? (
              <>
                <ActionIcon variant="subtle" radius="md" aria-label="Swap panes" onClick={onSwap}>
                  <IconArrowsExchange size={15} stroke={1.9} />
                </ActionIcon>
                <ActionIcon variant="subtle" radius="md" aria-label="Close split pane" onClick={onClose}>
                  <IconX size={15} stroke={1.9} />
                </ActionIcon>
              </>
            ) : null}
          </Group>
        </Group>
      ) : null}

      <div className="km-workspace-pane__body">{children}</div>
    </section>
  );
}
