import { useEffect, useMemo, useRef } from "react";
import { Badge, Group, Kbd, Modal, ScrollArea, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesCommand(command, query) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return true;
  const haystack = [command.label, command.description, command.group, command.keywords].map(normalizeText).join(" ");
  return cleanQuery.split(/\s+/).every((token) => haystack.includes(token));
}

export default function CommandPalette({ opened, onClose, query, onQueryChange, commands, onExecute }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!opened) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [opened]);

  const filteredCommands = useMemo(() => commands.filter((command) => matchesCommand(command, query)).slice(0, 18), [commands, query]);

  const handleRun = (command) => {
    onExecute(command);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      withCloseButton={false}
      size={760}
      padding="md"
      classNames={{
        content: "km-command-palette__content",
        body: "km-command-palette__body",
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center" className="km-command-palette__meta">
          <Text className="km-section-kicker">Command Palette</Text>
          <Group gap={6}>
            <Kbd>Ctrl</Kbd>
            <Kbd>P</Kbd>
          </Group>
        </Group>

        <TextInput
          ref={inputRef}
          leftSection={<IconSearch size={16} />}
          placeholder="Search pages, commands, or workflows..."
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          className="km-command-palette__input"
          onKeyDown={(event) => {
            if (event.key === "Enter" && filteredCommands[0]) {
              event.preventDefault();
              handleRun(filteredCommands[0]);
            }
          }}
        />

        <ScrollArea.Autosize mah={460} offsetScrollbars>
          <Stack gap="xs">
            {filteredCommands.length ? (
              filteredCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <UnstyledButton key={command.id} className="km-command-palette__item" onClick={() => handleRun(command)}>
                    <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                      <Group gap="sm" align="flex-start" wrap="nowrap">
                        <div className="km-command-palette__icon">{Icon ? <Icon size={15} stroke={1.8} /> : null}</div>
                        <Stack gap={2}>
                          <Text className="km-command-palette__label">{command.label}</Text>
                          {command.description ? (
                            <Text size="sm" c="dimmed" className="km-command-palette__description">
                              {command.description}
                            </Text>
                          ) : null}
                        </Stack>
                      </Group>

                      <Group gap={8} wrap="wrap" justify="flex-end" className="km-command-palette__badges">
                        {command.group ? (
                          <Badge variant="light" color="gray">
                            {command.group}
                          </Badge>
                        ) : null}
                        {command.shortcut ? (
                          <Text className="km-command-palette__shortcut">{command.shortcut}</Text>
                        ) : null}
                      </Group>
                    </Group>
                  </UnstyledButton>
                );
              })
            ) : (
              <div className="km-command-palette__empty">
                <Text fw={600}>No command matched that search.</Text>
                <Text size="sm" c="dimmed">
                  Try a page name like Hex Map, Vault Sync, or Source Library.
                </Text>
              </div>
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
}
