import { Badge, Group, Text } from "@mantine/core";

export default function WorkspaceStrip({ campaignName, sectionLabel, pageTitle }) {
  return (
    <Group justify="space-between" align="center" gap="sm" wrap="wrap" className="km-workspace-strip">
      <Group gap={8} align="center" wrap="wrap" className="km-workspace-strip__crumbs">
        <Text className="km-workspace-strip__label">Workspace</Text>
        <Text className="km-workspace-strip__divider">/</Text>
        <Text className="km-workspace-strip__crumb">{campaignName}</Text>
        {sectionLabel ? (
          <>
            <Text className="km-workspace-strip__divider">/</Text>
            <Text className="km-workspace-strip__crumb">{sectionLabel}</Text>
          </>
        ) : null}
        {pageTitle ? (
          <>
            <Text className="km-workspace-strip__divider">/</Text>
            <Text className="km-workspace-strip__crumb km-workspace-strip__crumb--active">{pageTitle}</Text>
          </>
        ) : null}
      </Group>
      <Badge color="gray" variant="outline" className="km-workspace-strip__badge">
        Local workspace
      </Badge>
    </Group>
  );
}
