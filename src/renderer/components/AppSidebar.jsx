import { Badge, Box, Divider, Group, NavLink as MantineNavLink, ScrollArea, Stack, Text } from "@mantine/core";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { NAV_GROUPS } from "../lib/routes";

export default function AppSidebar({ campaignName, onNavigate }) {
  const location = useLocation();
  const brandDescription = "Kingmaker notes, prep, kingdom state, and reference material in one local workspace.";

  return (
    <ScrollArea className="km-sidebar-scroll" scrollbarSize={6}>
      <Stack gap="lg" p="sm">
        <Box className="km-sidebar-brand">
          <Text className="km-eyebrow">Kingmaker Companion</Text>
          <Text className="km-sidebar-title">{campaignName}</Text>
          <Text size="sm" c="dimmed">
            {brandDescription}
          </Text>
        </Box>

        {NAV_GROUPS.map((group, index) => (
          <Stack key={group.label} gap="xs">
            {index > 0 ? <Divider variant="dashed" /> : null}
            <Group justify="space-between" align="center">
              <Text className="km-sidebar-section">{group.label}</Text>
              <Badge variant="outline" color="gray">
                {group.items.length}
              </Badge>
            </Group>
            {group.items.map((item) => (
              <MantineNavLink
                key={item.path}
                component={RouterNavLink}
                to={item.path}
                label={item.label}
                description={item.description}
                active={location.pathname === item.path}
                className="km-nav-link"
                leftSection={<item.icon size={15} stroke={1.7} />}
                onClick={onNavigate}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </ScrollArea>
  );
}
