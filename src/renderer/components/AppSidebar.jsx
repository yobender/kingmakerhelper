import { Badge, Box, Divider, Group, NavLink as MantineNavLink, ScrollArea, Stack, Text } from "@mantine/core";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { NAV_GROUPS } from "../lib/routes";

export default function AppSidebar({ campaignName, onNavigate }) {
  const location = useLocation();

  return (
    <ScrollArea className="km-sidebar-scroll" scrollbarSize={6}>
      <Stack gap="xl" p="md">
        <Box className="km-sidebar-brand">
          <Text className="km-eyebrow">Kingmaker Companion</Text>
          <Text className="km-sidebar-title">{campaignName}</Text>
          <Text size="sm" c="dimmed">
            Standalone Kingmaker workspace with a React shell in front and the legacy tools still available while the migration runs.
          </Text>
        </Box>

        {NAV_GROUPS.map((group, index) => (
          <Stack key={group.label} gap="xs">
            {index > 0 ? <Divider variant="dashed" /> : null}
            <Group justify="space-between" align="center">
              <Text className="km-sidebar-section">{group.label}</Text>
              <Badge variant="light" color="moss">
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
                leftSection={<item.icon size={18} stroke={1.8} />}
                onClick={onNavigate}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </ScrollArea>
  );
}
