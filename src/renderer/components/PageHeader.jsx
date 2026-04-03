import { Group, Paper, Stack, Text, Title } from "@mantine/core";

export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <Paper className="km-panel hero-panel">
      <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap" className="hero-panel__header">
        <Stack gap="xs" maw={880} className="hero-panel__copy">
          {eyebrow ? <Text className="km-eyebrow">{eyebrow}</Text> : null}
          <Title order={1}>{title}</Title>
          <Text size="lg" c="dimmed">
            {description}
          </Text>
        </Stack>
        {actions ? (
          <Group gap="sm" className="hero-panel__actions" justify="flex-end">
            {actions}
          </Group>
        ) : null}
      </Group>
    </Paper>
  );
}
